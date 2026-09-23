import type { AppSettings, GeminiModel } from '@shared/types'
import {
  getSettings as getStoredSettings,
  saveSettings as saveStoredSettings
} from './settingsStore'

export type { AppSettings, GeminiModel }

/**
 * Default fallback Gemini model identifier.
 */
export const DEFAULT_GEMINI_MODEL: AppSettings['geminiModel'] = 'gemini-1.5-flash'

/**
 * Asynchronously retrieves the persistent application settings.
 * Ensures the default fallback model is returned if undefined.
 */
export async function getSettings(): Promise<AppSettings> {
  const settings = getStoredSettings()
  return {
    ...settings,
    geminiModel: settings.geminiModel || DEFAULT_GEMINI_MODEL
  }
}

/**
 * Synchronous getter for persistent application settings.
 */
export function getSettingsSync(): AppSettings {
  const settings = getStoredSettings()
  return {
    ...settings,
    geminiModel: settings.geminiModel || DEFAULT_GEMINI_MODEL
  }
}

/**
 * Asynchronously merges and saves partial application settings to persistent disk storage.
 */
export async function saveSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
  return saveStoredSettings(newSettings)
}
