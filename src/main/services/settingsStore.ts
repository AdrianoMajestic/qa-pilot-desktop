import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { type AppSettings } from '@shared/types'

export type { AppSettings }

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: process.env.MAIN_VITE_GEMINI_API_KEY || '',
  playwrightHeadless: false,
  testTimeoutMs: 30000
}

/**
 * Resolves the path to the persistent settings JSON file in Electron's userData directory.
 */
function getSettingsFilePath(): string {
  const userDataDir = app.getPath('userData')
  return join(userDataDir, 'settings.json')
}

/**
 * Reads settings from the local JSON file.
 * Returns default configuration if the file does not exist or cannot be parsed.
 */
export function getSettings(): AppSettings {
  try {
    const filePath = getSettingsFilePath()
    if (!existsSync(filePath)) {
      return { ...DEFAULT_SETTINGS }
    }

    const rawData = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(rawData)

    return {
      geminiApiKey:
        typeof parsed.geminiApiKey === 'string'
          ? parsed.geminiApiKey
          : process.env.MAIN_VITE_GEMINI_API_KEY || '',
      playwrightHeadless:
        typeof parsed.playwrightHeadless === 'boolean'
          ? parsed.playwrightHeadless
          : DEFAULT_SETTINGS.playwrightHeadless,
      testTimeoutMs:
        typeof parsed.testTimeoutMs === 'number' &&
        !isNaN(parsed.testTimeoutMs) &&
        parsed.testTimeoutMs > 0
          ? parsed.testTimeoutMs
          : DEFAULT_SETTINGS.testTimeoutMs
    }
  } catch (error) {
    console.error('[SettingsStore] Error loading settings, falling back to defaults:', error)
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Saves and merges partial settings into the local JSON file.
 * Returns the full updated AppSettings object.
 */
export function saveSettings(newSettings: Partial<AppSettings>): AppSettings {
  try {
    const current = getSettings()
    const updated: AppSettings = {
      geminiApiKey:
        typeof newSettings.geminiApiKey === 'string'
          ? newSettings.geminiApiKey.trim()
          : current.geminiApiKey,
      playwrightHeadless:
        typeof newSettings.playwrightHeadless === 'boolean'
          ? newSettings.playwrightHeadless
          : current.playwrightHeadless,
      testTimeoutMs:
        typeof newSettings.testTimeoutMs === 'number' &&
        !isNaN(newSettings.testTimeoutMs) &&
        newSettings.testTimeoutMs > 0
          ? Math.round(newSettings.testTimeoutMs)
          : current.testTimeoutMs
    }

    const filePath = getSettingsFilePath()
    const dir = app.getPath('userData')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8')
    return updated
  } catch (error) {
    console.error('[SettingsStore] Error saving settings to disk:', error)
    return getSettings()
  }
}
