import { ElectronAPI as ElectronToolkitAPI } from '@electron-toolkit/preload'
import type { CustomAPI } from '@shared/types'

export * from '@shared/types'

declare global {
  interface Window {
    electron: ElectronToolkitAPI
    api: CustomAPI
    electronAPI?: CustomAPI
  }
}
