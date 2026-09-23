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
  totalBytes?: number
  estimatedTokens?: number
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

export type GeminiModel =
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
  | 'gemini-2.0-flash'
  | 'gemini-3.6-flash'
  | 'gemini-3.8-flash'

export interface AppSettings {
  geminiApiKey: string
  geminiModel:
    | 'gemini-1.5-flash'
    | 'gemini-1.5-pro'
    | 'gemini-2.0-flash'
    | 'gemini-3.6-flash'
    | 'gemini-3.8-flash'
  playwrightHeadless: boolean
  testTimeoutMs: number
}

export interface GeminiConnectionTestResult {
  success: boolean
  message: string
}

export interface UntestedArea {
  path: string
  reason: string
  riskLevel: 'high' | 'medium' | 'low'
}

export interface ArchitectureAnalysisResult {
  healthScore: number
  untestedAreas: UntestedArea[]
  vulnerabilities: string[]
  recommendations: string[]
  timestamp: number
}

export interface PlaywrightSessionStats {
  totalTests: number
  passedTests: number
  failedTests: number
  lastRunSuccess?: boolean
}

export interface QASessionData {
  projectName?: string
  architecture?: ArchitectureAnalysisResult
  playwright?: PlaywrightSessionStats
  crawler?: CrawlResult
  browserErrors?: BrowserError[]
}

export interface QualityRadarMetrics {
  codeCoverage: number
  aiInsights: number
  security: number
  dependencyHealth: number
  runtimeStability: number
  testSuccess: number
}

export interface FinalQAReport {
  overallScore: number
  radarMetrics: QualityRadarMetrics
  executiveSummary: string[]
  criticalIssuesCount: number
  generatedAt: number
  analysisMarkdown?: string
}

// ==========================================
// 7. Web Application Crawler
// ==========================================

export interface CrawlerOptions {
  startUrl: string
  maxDepth?: number // default: 3
  maxPages?: number // default: 30
  sameDomainOnly?: boolean // default: true
  emulateFormSubmission?: boolean // default: false (safe mode)
}

export interface DiscoveredInput {
  tag: string // input, textarea, select, button
  type: string // text, email, password, submit, etc.
  name: string
  id: string
  placeholder: string
}

export interface DiscoveredForm {
  action: string
  method: string
  id: string
  fields: DiscoveredInput[]
}

export interface DiscoveredPage {
  url: string
  depth: number
  title: string
  forms: DiscoveredForm[]
  inputs: DiscoveredInput[]
  links: string[]
  errors: string[]
  timestamp: number
}

export interface CrawlResult {
  success: boolean
  startUrl: string
  pagesVisited: number
  pagesDiscovered: number
  totalForms: number
  totalInputs: number
  pages: DiscoveredPage[]
  errors: string[]
  durationMs: number
  aborted: boolean
}

// ==========================================
// 8. Browser Error Interceptor & Monitoring
// ==========================================

export type BrowserErrorType = 'http_error' | 'network_failure' | 'console_error' | 'page_error'

export interface BrowserErrorLocation {
  url?: string
  lineNumber?: number
  columnNumber?: number
}

export interface BrowserError {
  id: string
  timestamp: number
  source: 'playwright' | 'crawler'
  type: BrowserErrorType
  url?: string
  message: string
  statusCode?: number
  statusText?: string
  failureText?: string
  location?: BrowserErrorLocation
  stackTrace?: string
  details?: Record<string, unknown>
}

/** Browser error payload captured by the interceptor, used for AI stack trace analysis. */
export type CapturedBrowserError = BrowserError

export interface StackTraceAnalysisResult {
  errorId: string
  rootCause: string
  affectedModule?: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  stepsToFix: string[]
  codeFixSnippet?: string
  timestamp: number
}

// ==========================================
// 9. IPC Channels Protocol
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
  SETTINGS_SAVE: 'settings:save',
  CRAWLER_START: 'crawler:start',
  CRAWLER_STOP: 'crawler:stop',
  AI_TEST_CONNECTION: 'ai:test-connection',
  AI_ANALYZE_ARCHITECTURE: 'ai:analyze-architecture',
  AI_GENERATE_FINAL_REPORT: 'ai:generate-final-report',
  AI_GENERATE_QA_REPORT: 'ai:generate-qa-report',
  BROWSER_ERRORS_GET: 'browser:get-errors',
  BROWSER_ERRORS_CLEAR: 'browser:clear-errors'
} as const

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ==========================================
// 10. Typed Electron Bridge API
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
  startCrawler: (options: CrawlerOptions) => Promise<CrawlResult>
  stopCrawler: () => Promise<void>
  testGeminiConnection: (apiKey?: string, model?: string) => Promise<GeminiConnectionTestResult>
  analyzeArchitecture: (context: ProjectContext) => Promise<ArchitectureAnalysisResult>
  generateFinalReport: (data: QASessionData) => Promise<FinalQAReport>
  analyzeStackTrace: (
    error: CapturedBrowserError,
    context?: ProjectContext
  ) => Promise<StackTraceAnalysisResult>
  getBrowserErrors: (filter?: {
    source?: 'playwright' | 'crawler'
    type?: BrowserErrorType
  }) => Promise<BrowserError[]>
  clearBrowserErrors: (source?: 'playwright' | 'crawler') => Promise<void>
}

/**
 * Standard alias for the typed Electron bridge exposed on window.api and window.electronAPI
 */
export type ElectronAPI = CustomAPI
