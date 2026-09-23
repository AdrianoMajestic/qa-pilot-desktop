import { spawn, ChildProcess } from 'node:child_process'
import { app } from 'electron'
import type { Page, BrowserContext } from 'playwright'
import { loggerService } from './loggerService'
import { getSettings } from './settingsService'
import { attachBrowserMonitor, clearBrowserErrors } from './browserMonitor'
import type { PlaywrightRunOptions, PlaywrightRunStatus, PlaywrightBrowser } from '@shared/types'

/**
 * Service managing Playwright test runner lifecycle in Electron Main process.
 * Controls browser launches, test execution, cancellation, and real-time IPC log streaming.
 */
export class PlaywrightRunner {
  private activeProcess: ChildProcess | null = null
  private activeOptions: PlaywrightRunOptions | null = null
  private startTime: number | null = null
  private isStopping = false

  constructor() {
    // Graceful cleanup when Electron shuts down
    app.on('before-quit', () => {
      this.stopTestsSync()
    })
  }

  /**
   * Retrieves current execution status of the Playwright runner.
   */
  getStatus(): PlaywrightRunStatus {
    const isRunning = this.activeProcess !== null && !this.activeProcess.killed
    return {
      isRunning,
      browser: this.activeOptions?.browser ?? 'chromium',
      headed: this.activeOptions?.headed ?? true,
      startTime: this.startTime ?? undefined,
      pid: this.activeProcess?.pid
    }
  }

  /**
   * Attaches the Browser Error Interceptor to a Playwright Page or BrowserContext.
   */
  attachMonitor(target: Page | BrowserContext): void {
    attachBrowserMonitor(target, 'playwright')
  }

  /**
   * Creates a new managed BrowserContext with attached browser error monitoring.
   */
  async createMonitoredContext(browser: {
    newContext: () => Promise<BrowserContext>
  }): Promise<BrowserContext> {
    const context = await browser.newContext()
    attachBrowserMonitor(context, 'playwright')
    return context
  }

  /**
   * Creates a new managed Page with attached browser error monitoring.
   */
  async createMonitoredPage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage()
    attachBrowserMonitor(page, 'playwright')
    return page
  }

  /**
   * Runs Playwright test suite with specified options.
   * Default: headed: true, browser: 'chromium'.
   */
  async runTests(
    options: PlaywrightRunOptions = {}
  ): Promise<{ success: boolean; message?: string }> {
    // If a test run is already active, prevent concurrent overlapping runs
    if (this.activeProcess && !this.activeProcess.killed) {
      const msg =
        'Тестовый запуск Playwright уже выполняется. Остановите текущий запуск перед стартом нового.'
      loggerService.warn('playwright', msg)
      return { success: false, message: msg }
    }

    // Reset previous playwright error session
    clearBrowserErrors('playwright')

    const persistentSettings = await getSettings()

    // Determine headed mode: default to true per architectural requirement
    // If explicitly set in options, use that; otherwise respect headed default (true)
    const headed = options.headed ?? (persistentSettings.playwrightHeadless ? false : true)
    const browser: PlaywrightBrowser = options.browser ?? 'chromium'
    const workingDir = options.projectPath || process.cwd()

    this.activeOptions = {
      ...options,
      browser,
      headed,
      projectPath: workingDir
    }
    this.startTime = Date.now()
    this.isStopping = false

    loggerService.info(
      'playwright',
      `Инициализация Playwright Test Runner (Браузер: ${browser}, Режим: ${headed ? 'Headed (графический)' : 'Headless (фоновый)'})`
    )

    if (options.targetUrl) {
      loggerService.info('playwright', `Целевой URL тестирования: ${options.targetUrl}`)
    }

    // Build command-line arguments for Playwright CLI
    const args: string[] = ['playwright', 'test']

    // Browser selection
    args.push(`--project=${browser}`)

    // Headed mode flag
    if (headed) {
      args.push('--headed')
    }

    // Specific test match pattern or file
    if (options.testMatch && options.testMatch.trim().length > 0) {
      args.push(options.testMatch.trim())
    }

    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    loggerService.info(
      'playwright',
      `Выполняется команда: npx ${args.join(' ')} (каталог: ${workingDir})`
    )

    return new Promise<{ success: boolean; message?: string }>((resolve) => {
      try {
        const child = spawn(command, args, {
          cwd: workingDir,
          shell: process.platform === 'win32',
          env: {
            ...process.env,
            BASE_URL: options.targetUrl || process.env.BASE_URL || '',
            PLAYWRIGHT_TEST_BASE_URL:
              options.targetUrl || process.env.PLAYWRIGHT_TEST_BASE_URL || '',
            FORCE_COLOR: '0' // Plain text output for cleaner log parsing
          }
        })

        this.activeProcess = child

        // Helper to strip ANSI codes from console output
        const cleanAnsi = (str: string): string =>
          str.replace(
            // eslint-disable-next-line no-control-regex
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
            ''
          )

        // Stream standard output in real time
        child.stdout?.on('data', (chunk: Buffer) => {
          const lines = cleanAnsi(chunk.toString('utf-8')).split(/\r?\n/)
          for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line) continue

            // Determine log level based on test results indicators
            if (
              line.includes('passed') ||
              line.includes('Passed') ||
              line.includes('✓') ||
              line.includes('PASSED')
            ) {
              loggerService.success('playwright', line)
            } else if (
              line.includes('failed') ||
              line.includes('Failed') ||
              line.includes('✘') ||
              line.includes('Error:') ||
              line.includes('FAILED')
            ) {
              loggerService.error('playwright', line)
            } else {
              loggerService.info('playwright', line)
            }
          }
        })

        // Stream standard error in real time
        child.stderr?.on('data', (chunk: Buffer) => {
          const lines = cleanAnsi(chunk.toString('utf-8')).split(/\r?\n/)
          for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line) continue
            loggerService.warn('playwright', line)
          }
        })

        // Handle process execution failure (e.g. npx not found or permissions)
        child.on('error', (err: Error) => {
          this.cleanup()
          const errMsg = `Сбой запуска процесса Playwright: ${err.message}`
          loggerService.error('playwright', errMsg)
          resolve({ success: false, message: errMsg })
        })

        // Handle process completion
        child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
          const wasManualStop = this.isStopping
          this.cleanup()

          if (wasManualStop || signal === 'SIGTERM' || signal === 'SIGINT') {
            const msg = 'Выполнение тестов Playwright было остановлено пользователем.'
            loggerService.warn('playwright', msg)
            resolve({ success: false, message: msg })
            return
          }

          if (code === 0) {
            const msg = 'Тестовый сценарий Playwright успешно выполнен (Код 0).'
            loggerService.success('playwright', msg)
            resolve({ success: true, message: msg })
          } else {
            const msg = `Тестовый сценарий Playwright завершился с ошибками (Код завершения: ${code ?? 'неизвестно'}).`
            loggerService.error('playwright', msg)
            resolve({ success: false, message: msg })
          }
        })
      } catch (err) {
        this.cleanup()
        const errMsg = `Не удалось запустить процесс: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`
        loggerService.error('playwright', errMsg)
        resolve({ success: false, message: errMsg })
      }
    })
  }

  /**
   * Stops currently running Playwright tests and gracefully terminates child processes and browsers.
   */
  async stopTests(): Promise<void> {
    if (!this.activeProcess || this.activeProcess.killed) {
      loggerService.info('playwright', 'Нет активных тестовых процессов для остановки.')
      return
    }

    this.isStopping = true
    const pid = this.activeProcess.pid

    loggerService.warn(
      'playwright',
      `Запрос на остановку тестов Playwright (PID: ${pid ?? 'неизвестно'})...`
    )

    if (pid && process.platform === 'win32') {
      // Windows taskkill kills entire process tree (/T) forcefully (/F)
      try {
        spawn('taskkill', ['/pid', String(pid), '/T', '/F'])
      } catch (e) {
        console.error('[PlaywrightRunner] Error killing process on Windows:', e)
      }
    } else if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM')
        setTimeout(() => {
          if (this.activeProcess && !this.activeProcess.killed) {
            this.activeProcess.kill('SIGKILL')
          }
        }, 2000)
      } catch (e) {
        console.error('[PlaywrightRunner] Error killing process:', e)
      }
    }

    this.cleanup()
    loggerService.info('playwright', 'Процесс Playwright успешно остановлен.')
  }

  /**
   * Synchronous cleanup for application shutdown hook.
   */
  private stopTestsSync(): void {
    if (this.activeProcess && !this.activeProcess.killed) {
      const pid = this.activeProcess.pid
      if (pid && process.platform === 'win32') {
        try {
          spawn('taskkill', ['/pid', String(pid), '/T', '/F'])
        } catch {
          // Ignore error on quit
        }
      } else {
        try {
          this.activeProcess.kill('SIGKILL')
        } catch {
          // Ignore error on quit
        }
      }
      this.cleanup()
    }
  }

  private cleanup(): void {
    this.activeProcess = null
    this.activeOptions = null
    this.startTime = null
    this.isStopping = false
  }
}

export const playwrightRunner = new PlaywrightRunner()
