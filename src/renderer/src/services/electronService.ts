import type {
  SystemInfo,
  PlaywrightRunResult,
  ProjectScanResult,
  ProjectContext,
  LogEvent,
  LogLevel,
  LogSource
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
}

export const electronService = new ElectronService()
