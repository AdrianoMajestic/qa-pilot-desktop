import type {
  SystemInfo,
  PlaywrightRunResult,
  ProjectScanResult,
  ProjectContext,
  AppSettings
} from '../../../preload/index'

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

  async getSettings(): Promise<AppSettings> {
    if (this.isElectronAvailable() && typeof window.api.getSettings === 'function') {
      return await window.api.getSettings()
    }
    try {
      const stored = localStorage.getItem('qa_pilot_settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          geminiApiKey: typeof parsed.geminiApiKey === 'string' ? parsed.geminiApiKey : '',
          playwrightHeadless:
            typeof parsed.playwrightHeadless === 'boolean' ? parsed.playwrightHeadless : false,
          testTimeoutMs:
            typeof parsed.testTimeoutMs === 'number' && parsed.testTimeoutMs > 0
              ? parsed.testTimeoutMs
              : 30000
        }
      }
    } catch {
      // ignore
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
    const current = await this.getSettings()
    const updated: AppSettings = {
      geminiApiKey:
        typeof settings.geminiApiKey === 'string'
          ? settings.geminiApiKey.trim()
          : current.geminiApiKey,
      playwrightHeadless:
        typeof settings.playwrightHeadless === 'boolean'
          ? settings.playwrightHeadless
          : current.playwrightHeadless,
      testTimeoutMs:
        typeof settings.testTimeoutMs === 'number' && settings.testTimeoutMs > 0
          ? Math.round(settings.testTimeoutMs)
          : current.testTimeoutMs
    }
    try {
      localStorage.setItem('qa_pilot_settings', JSON.stringify(updated))
    } catch {
      // ignore
    }
    return updated
  }
}

export const electronService = new ElectronService()
