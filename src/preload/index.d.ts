import { ElectronAPI } from '@electron-toolkit/preload'

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

export interface CustomAPI {
  ping: () => Promise<string>
  getSystemInfo: () => Promise<SystemInfo>
  selectProject: () => Promise<ProjectScanResult>
  runPlaywrightWorker: (suite?: string) => Promise<PlaywrightRunResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
