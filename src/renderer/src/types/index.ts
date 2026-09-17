export interface SystemStatus {
  ready: boolean
  message: string
  platform?: string
  arch?: string
  nodeVersion?: string
  electronVersion?: string
  chromeVersion?: string
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

export interface ProjectState {
  projectPath: string | null
  projectName: string | null
  fileTree: import('@shared/types').FileNode | null
  stats: import('@shared/types').ProjectStats | null
  isScanning: boolean
}

export * from './dashboard.types'
export * from '@shared/types'
