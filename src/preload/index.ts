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

export interface PackageJsonSummary {
  name?: string
  version?: string
  description?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  rawContent?: string
}

export interface DetectedStack {
  frameworks: string[]
  testRunners: string[]
  language: 'TypeScript' | 'JavaScript' | 'Mixed' | 'Unknown'
  hasTypeScript: boolean
  hasTailwind: boolean
  buildTools: string[]
}

export interface ConfigFileInfo {
  name: string
  relativePath: string
  content: string
  size: number
  truncated: boolean
}

export interface EntryPointInfo {
  name: string
  relativePath: string
  content: string
  size: number
  truncated: boolean
}

export interface ProjectContext {
  projectPath: string
  projectName: string
  timestamp: string
  hasPackageJson: boolean
  packageJson?: PackageJsonSummary
  detectedStack: DetectedStack
  configFiles: ConfigFileInfo[]
  entryPoints: EntryPointInfo[]
  summary: string
  error?: string
}

export interface AppSettings {
  geminiApiKey: string
  playwrightHeadless: boolean
  testTimeoutMs: number
}

// Custom typed APIs exposed to the renderer process
export const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),
  getSystemInfo: (): Promise<SystemInfo> => ipcRenderer.invoke('app:get-system-info'),
  selectProject: (): Promise<ProjectScanResult> => ipcRenderer.invoke('dialog:select-project'),
  parseProjectContext: (projectPath: string): Promise<ProjectContext> =>
    ipcRenderer.invoke('project:parse-context', projectPath),
  runPlaywrightWorker: (suite?: string): Promise<PlaywrightRunResult> =>
    ipcRenderer.invoke('worker:playwright-run', { suite }),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', settings)
}

export type CustomAPI = typeof api

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
