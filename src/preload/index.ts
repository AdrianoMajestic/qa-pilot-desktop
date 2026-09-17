import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IPC_CHANNELS,
  type SystemInfo,
  type PlaywrightRunResult,
  type ProjectScanResult,
  type ProjectContext,
  type LogEvent,
  type TriggerTestLogParams,
  type CustomAPI
} from '@shared/types'

export * from '@shared/types'

export interface AppSettings {
  geminiApiKey: string
  playwrightHeadless: boolean
  testTimeoutMs: number
}

// Custom typed APIs exposed to the renderer process
export const api: CustomAPI = {
  ping: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.PING),
  getSystemInfo: (): Promise<SystemInfo> => ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_INFO),
  selectProject: (): Promise<ProjectScanResult> => ipcRenderer.invoke(IPC_CHANNELS.SELECT_PROJECT),
  parseProjectContext: (projectPath: string): Promise<ProjectContext> =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSE_PROJECT_CONTEXT, projectPath),
  runPlaywrightWorker: (suite?: string): Promise<PlaywrightRunResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.PLAYWRIGHT_RUN, { suite }),
  onLogEvent: (callback: (event: LogEvent) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, logEvent: LogEvent): void => {
      callback(logEvent)
    }
    ipcRenderer.on(IPC_CHANNELS.STREAM_LOG_EVENT, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STREAM_LOG_EVENT, subscription)
    }
  },
  triggerTestLog: (params?: TriggerTestLogParams): Promise<LogEvent> =>
    ipcRenderer.invoke(IPC_CHANNELS.TRIGGER_TEST_LOG, params)
}

// Expose APIs via contextBridge when context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error('Preload contextBridge error:', error)
  }
} else {
  // @ts-ignore fallback for non-context-isolated environments
  window.electron = electronAPI
  // @ts-ignore fallback
  window.api = api
  // @ts-ignore fallback
  window.electronAPI = api
}
