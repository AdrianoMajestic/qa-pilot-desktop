export interface SystemStatus {
  ready: boolean
  message: string
  platform?: string
  arch?: string
  nodeVersion?: string
  electronVersion?: string
  chromeVersion?: string
}

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

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  source?: string
}

export interface NavigationItem {
  id: string
  label: string
  icon: string
  active?: boolean
  badge?: string
}

export interface TestSuiteSummary {
  id: string
  name: string
  description: string
  status: 'idle' | 'running' | 'passed' | 'failed'
  totalTests: number
  passedTests: number
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

export interface ProjectState {
  projectPath: string | null
  projectName: string | null
  fileTree: FileNode | null
  stats: ProjectStats | null
  isScanning: boolean
}
