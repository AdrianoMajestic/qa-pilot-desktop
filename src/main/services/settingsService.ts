import type { AppSettings } from '@shared/types'
import {
  getSettings as getStoredSettings,
  saveSettings as saveStoredSettings
} from './settingsStore'

export type { AppSettings }

/**
 * Asynchronously retrieves the persistent application settings.
 */
export async function getSettings(): Promise<AppSettings> {
  return getStoredSettings()
}

/**
 * Asynchronously merges and saves partial application settings to persistent disk storage.
 */
export async function saveSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
  return saveStoredSettings(newSettings)
}
