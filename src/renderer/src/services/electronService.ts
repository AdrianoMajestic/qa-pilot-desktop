import type {
  SystemInfo,
  PlaywrightRunResult,
  ProjectScanResult,
  ProjectContext,
  LogEvent,
  LogLevel,
  LogSource,
  AppSettings,
  GeminiConnectionTestResult,
  PlaywrightRunOptions,
  PlaywrightRunStatus,
  CrawlerOptions,
  CrawlResult,
  BrowserError,
  BrowserErrorType
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
    }
  }

  /**
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

  private mockBrowserErrors: BrowserError[] = [
    {
      id: 'mock-err-1',
      timestamp: Date.now() - 42000,
      source: 'playwright',
      type: 'http_error',
      statusCode: 502,
      statusText: 'Bad Gateway',
      url: 'https://api.staging-qa.local/v1/auth/token',
      message: '[HTTP 502] Bad Gateway: https://api.staging-qa.local/v1/auth/token',
      details: {
        method: 'POST',
        resourceType: 'fetch',
        status: 502,
        statusText: 'Bad Gateway'
      }
    },
    {
      id: 'mock-err-2',
      timestamp: Date.now() - 25000,
      source: 'crawler',
      type: 'network_failure',
      url: 'https://cdn.staging-qa.local/assets/bundle.chunk.js',
      failureText: 'net::ERR_CONNECTION_REFUSED',
      message:
        'Сетевой сбой запроса (net::ERR_CONNECTION_REFUSED): https://cdn.staging-qa.local/assets/bundle.chunk.js',
      details: {
        method: 'GET',
        resourceType: 'script',
        failureText: 'net::ERR_CONNECTION_REFUSED'
      }
    },
    {
      id: 'mock-err-3',
      timestamp: Date.now() - 12000,
      source: 'playwright',
      type: 'console_error',
      url: 'https://staging-qa.local/dashboard',
      message:
        'Консольная ошибка браузера: Uncaught TypeError: Cannot read properties of undefined (reading "permissions")',
      location: {
        url: 'https://staging-qa.local/static/js/app.js',
        lineNumber: 142,
        columnNumber: 28
      },
      details: {
        text: 'Uncaught TypeError: Cannot read properties of undefined (reading "permissions")',
        pageUrl: 'https://staging-qa.local/dashboard'
      }
    },
    {
      id: 'mock-err-4',
      timestamp: Date.now() - 5000,
      source: 'crawler',
      type: 'page_error',
      url: 'https://staging-qa.local/checkout',
      message:
        'Неперехваченное исключение страницы (Page Error): ChunkLoadError: Loading chunk 42 failed',
      stackTrace:
        'ChunkLoadError: Loading chunk 42 failed.\n    at __webpack_require__.f.j (webpack:///src/lazy/checkout.tsx:28:12)\n    at ensureChunk (webpack:///src/router.tsx:84:9)\n    at HTMLButtonElement.dispatch (https://staging-qa.local/assets/vendor.js:4012:15)',
      details: {
        name: 'ChunkLoadError',
        pageUrl: 'https://staging-qa.local/checkout'
      }
    }
  ]

  /**
   * Retrieves captured browser errors from the in-memory session store.
   */
  async getBrowserErrors(filter?: {
    source?: 'playwright' | 'crawler'
    type?: BrowserErrorType
  }): Promise<BrowserError[]> {
    if (this.isElectronAvailable() && typeof window.api.getBrowserErrors === 'function') {
      return await window.api.getBrowserErrors(filter)
    }
    let res = this.mockBrowserErrors
    if (filter?.source) {
      res = res.filter((e) => e.source === filter.source)
    }
    if (filter?.type) {
      res = res.filter((e) => e.type === filter.type)
    }
    return [...res]
  }

  /**
   * Clears captured browser errors from the session buffer.
   */
  async clearBrowserErrors(source?: 'playwright' | 'crawler'): Promise<void> {
    if (this.isElectronAvailable() && typeof window.api.clearBrowserErrors === 'function') {
      await window.api.clearBrowserErrors(source)
      return
    }
    if (source) {
      this.mockBrowserErrors = this.mockBrowserErrors.filter((e) => e.source !== source)
    } else {
      this.mockBrowserErrors = []
    }
  }
}

export const electronService = new ElectronService()
