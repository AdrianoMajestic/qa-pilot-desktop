import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface SystemInfo {
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  chromeVersion: string
}

export interface PlaywrightRunResult {
  success: boolean
  message: string
  timestamp: string
}

export interface FileNode {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  extension?: string
  size?: number
  children?: FileNode[]
}

export interface ProjectStats {
  totalFiles: number
  totalFolders: number
  jsTsFilesCount: number
  jsonFilesCount: number
  codeFilesCount: number
}

export interface ProjectScanResult {
  canceled: boolean
  projectPath?: string
  projectName?: string
  fileTree?: FileNode
  stats?: ProjectStats
  error?: string
}

// Custom typed APIs exposed to the renderer process
export const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),
  getSystemInfo: (): Promise<SystemInfo> => ipcRenderer.invoke('app:get-system-info'),
  selectProject: (): Promise<ProjectScanResult> => ipcRenderer.invoke('dialog:select-project'),
  runPlaywrightWorker: (suite?: string): Promise<PlaywrightRunResult> =>
    ipcRenderer.invoke('worker:playwright-run', { suite })
}

export type CustomAPI = typeof api

// Expose APIs via contextBridge when context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Preload contextBridge error:', error)
  }
} else {
  // @ts-ignore fallback for non-context-isolated environments
  window.electron = electronAPI
  // @ts-ignore fallback
  window.api = api
}
