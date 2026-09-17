/**
 * Shared Type Definitions for QA Pilot Desktop
 * Process-isolated declarative types shared across Main, Preload, and Renderer.
 * Pure TypeScript interfaces and types only (zero runtime Node/Electron dependencies).
 */

// ==========================================
// 1. System & Runtime Environment
// ==========================================

export interface SystemInfo {
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  chromeVersion: string
}

// ==========================================
// 2. Playwright & Worker Execution
// ==========================================

export type PlaywrightBrowser = 'chromium' | 'firefox' | 'webkit'

export interface PlaywrightRunOptions {
  browser?: PlaywrightBrowser
  headed?: boolean // default: true
  testMatch?: string
  targetUrl?: string
  projectPath?: string
}

export interface PlaywrightRunStatus {
  isRunning: boolean
  browser: PlaywrightBrowser
  headed: boolean
  startTime?: number
  pid?: number
}

export interface PlaywrightRunResult {
  success: boolean
  message: string
  timestamp: string
}

export interface PlaywrightRunParams {
  suite?: string
}

// ==========================================
// 3. File Tree & Project Scanning
// ==========================================

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

// ==========================================
// 4. Source Code Parser & AI Context
// ==========================================

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

// ==========================================
// 5. IPC Real-Time Event & Log Streaming
// ==========================================

export type LogLevel = 'info' | 'warn' | 'error' | 'success'
export type LogSource = 'system' | 'playwright' | 'crawler' | 'ai'

export interface LogEvent {
  id: string
  timestamp: number
  level: LogLevel
  source: LogSource
  message: string
  details?: Record<string, unknown>
}

export interface TriggerTestLogParams {
  message?: string
  level?: LogLevel
  source?: LogSource
  details?: Record<string, unknown>
}

// ==========================================
// 6. Application Settings & Preferences
// ==========================================

export interface AppSettings {
  geminiApiKey: string
  playwrightHeadless: boolean
  testTimeoutMs: number
}

// ==========================================
// 7. IPC Channels Protocol
// ==========================================

export const IPC_CHANNELS = {
  PING: 'app:ping',
  GET_SYSTEM_INFO: 'app:get-system-info',
  SELECT_PROJECT: 'dialog:select-project',
  PARSE_PROJECT_CONTEXT: 'project:parse-context',
  PLAYWRIGHT_RUN: 'playwright:run',
  PLAYWRIGHT_STOP: 'playwright:stop',
  PLAYWRIGHT_STATUS: 'playwright:status',
  LEGACY_PLAYWRIGHT_WORKER: 'worker:playwright-run',
  STREAM_LOG_EVENT: 'stream:log-event',
  TRIGGER_TEST_LOG: 'app:trigger-test-log',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save'
} as const

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ==========================================
// 8. Typed Electron Bridge API
// ==========================================

export interface CustomAPI {
  ping: () => Promise<string>
  getSystemInfo: () => Promise<SystemInfo>
  selectProject: () => Promise<ProjectScanResult>
  parseProjectContext: (projectPath: string) => Promise<ProjectContext>
  runPlaywrightWorker: (suite?: string) => Promise<PlaywrightRunResult>
  runPlaywright: (options?: PlaywrightRunOptions) => Promise<{ success: boolean; message?: string }>
  stopPlaywright: () => Promise<void>
  getPlaywrightStatus: () => Promise<PlaywrightRunStatus>
  onLogEvent: (callback: (event: LogEvent) => void) => () => void
  triggerTestLog: (params?: TriggerTestLogParams) => Promise<LogEvent>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
}

/**
 * Standard alias for the typed Electron bridge exposed on window.api and window.electronAPI
 */
export type ElectronAPI = CustomAPI
