import type { SystemInfo, PlaywrightRunResult, ProjectScanResult } from '../../../preload/index'

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
}

export const electronService = new ElectronService()
