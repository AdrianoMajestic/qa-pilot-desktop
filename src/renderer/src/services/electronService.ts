import type {
  SystemInfo,
  PlaywrightRunResult,
  ProjectScanResult,
  ProjectContext,
  LogEvent,
  LogLevel,
  LogSource,
  AppSettings,
  GeminiConnectionTestResult
  PlaywrightRunOptions,
  PlaywrightRunStatus,
  CrawlerOptions,
  CrawlResult
} from '@shared/types'

class ElectronService {
  private isElectronAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(window.api)
  }

  async ping(): Promise<string> {
    if (this.isElectronAvailable()) {
      return await window.api.ping()
    }
    return 'mock-pong'
  }

  async getSystemInfo(): Promise<SystemInfo> {
    if (this.isElectronAvailable()) {
      return await window.api.getSystemInfo()
    }
    return {
      platform: 'web-fallback',
      arch: 'x64',
      nodeVersion: 'browser',
      electronVersion: 'none',
      chromeVersion: navigator.userAgent
    }
  }

  async selectProject(): Promise<ProjectScanResult> {
    if (this.isElectronAvailable() && typeof window.api.selectProject === 'function') {
      return await window.api.selectProject()
    }
    return {
      canceled: true,
      error: 'Electron API недоступен в web-режиме'
    }
  }

  async parseProjectContext(projectPath: string): Promise<ProjectContext> {
    if (this.isElectronAvailable() && typeof window.api.parseProjectContext === 'function') {
      return await window.api.parseProjectContext(projectPath)
    }
    return {
      projectPath,
      projectName: 'web-fallback',
      timestamp: new Date().toISOString(),
      hasPackageJson: false,
      detectedStack: {
        frameworks: ['React'],
        testRunners: ['Playwright'],
        language: 'TypeScript',
        hasTypeScript: true,
        hasTailwind: true,
        buildTools: ['Vite']
      },
      configFiles: [],
      entryPoints: [],
      summary: 'Web fallback: Electron IPC недоступен в браузерной среде.',
      error: 'Electron API недоступен в web-режиме'
    }
  }

  async runPlaywrightWorker(suite?: string): Promise<PlaywrightRunResult> {
    if (this.isElectronAvailable()) {
      return await window.api.runPlaywrightWorker(suite)
    }
    return {
      success: true,
      message: `Simulated worker response for suite: ${suite ?? 'default'}`,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Triggers execution of Playwright test runner in Main process.
   */
  async runPlaywright(
    options?: PlaywrightRunOptions
  ): Promise<{ success: boolean; message?: string }> {
    if (this.isElectronAvailable() && typeof window.api.runPlaywright === 'function') {
      return await window.api.runPlaywright(options)
    }
    return {
      success: true,
      message: `[Web Fallback] Тесты Playwright симулированы (Браузер: ${options?.browser ?? 'chromium'}, Режим: ${(options?.headed ?? true) ? 'Headed' : 'Headless'}).`
    }
  }

  /**
   * Requests cancellation of active Playwright test runner.
   */
  async stopPlaywright(): Promise<void> {
    if (this.isElectronAvailable() && typeof window.api.stopPlaywright === 'function') {
      await window.api.stopPlaywright()
    }
  }

  /**
   * Retrieves current status of Playwright test runner.
   */
  async getPlaywrightStatus(): Promise<PlaywrightRunStatus> {
    if (this.isElectronAvailable() && typeof window.api.getPlaywrightStatus === 'function') {
      return await window.api.getPlaywrightStatus()
    }
    return {
      isRunning: false,
      browser: 'chromium',
      headed: true
    }
  }

  /**
   * Subscribes to real-time Main process log streaming events via Preload bridge.
   * Returns a cleanup function that detaches the IPC listener.
   */
  onLogEvent(callback: (event: LogEvent) => void): () => void {
    if (this.isElectronAvailable() && typeof window.api.onLogEvent === 'function') {
      return window.api.onLogEvent(callback)
    }
    return () => {}
  }

  /**
   * Triggers a diagnostic log event through IPC to verify real-time stream execution.
   */
  async triggerTestLog(params?: {
    message?: string
    level?: LogLevel
    source?: LogSource
    details?: Record<string, unknown>
  }): Promise<LogEvent> {
    if (this.isElectronAvailable() && typeof window.api.triggerTestLog === 'function') {
      return await window.api.triggerTestLog(params)
    }
    return {
      id: `mock-log-${Date.now()}`,
      timestamp: Date.now(),
      level: params?.level ?? 'info',
      source: params?.source ?? 'system',
      message: params?.message ?? 'Simulated test log in web-fallback'
    }
  }

  async getSettings(): Promise<AppSettings> {
    if (this.isElectronAvailable() && typeof window.api.getSettings === 'function') {
      return await window.api.getSettings()
    }
    return {
      geminiApiKey: '',
      playwrightHeadless: false,
      testTimeoutMs: 30000
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    if (this.isElectronAvailable() && typeof window.api.saveSettings === 'function') {
      return await window.api.saveSettings(settings)
    }
    return {
      geminiApiKey: settings.geminiApiKey ?? '',
      playwrightHeadless: settings.playwrightHeadless ?? false,
      testTimeoutMs: settings.testTimeoutMs ?? 30000
    }
  }

  /**
   * Starts automated web application crawl in Main process.
   */
  async startCrawler(options: CrawlerOptions): Promise<CrawlResult> {
    if (this.isElectronAvailable() && typeof window.api.startCrawler === 'function') {
      return await window.api.startCrawler(options)
    }
    return {
      success: false,
      startUrl: options.startUrl,
      pagesVisited: 0,
      pagesDiscovered: 0,
      totalForms: 0,
      totalInputs: 0,
      pages: [],
      errors: ['Electron API недоступен в web-режиме'],
      durationMs: 0,
      aborted: false
    }
  }

  /**
   * Requests cancellation of active crawler.
   */
  async stopCrawler(): Promise<void> {
    if (this.isElectronAvailable() && typeof window.api.stopCrawler === 'function') {
      await window.api.stopCrawler()
   * Tests connection to Google Gemini API using the provided or saved API key.
   */
  async testGeminiConnection(apiKey?: string): Promise<GeminiConnectionTestResult> {
    if (this.isElectronAvailable() && typeof window.api.testGeminiConnection === 'function') {
      return await window.api.testGeminiConnection(apiKey)
    }
    return {
      success: false,
      message: 'Electron API недоступен в web-режиме (web-fallback).'
    }
  }
}

export const electronService = new ElectronService()
