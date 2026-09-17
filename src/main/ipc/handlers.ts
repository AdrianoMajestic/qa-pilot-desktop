import { ipcMain, dialog } from 'electron'
import { readdir, stat } from 'node:fs/promises'
import { join, extname, basename, relative } from 'node:path'
import {
  IPC_CHANNELS,
  type FileNode,
  type ProjectStats,
  type ProjectScanResult,
  type ProjectContext,
  type PackageJsonSummary,
  type DetectedStack,
  type ConfigFileInfo,
  type EntryPointInfo,
  type LogLevel,
  type LogSource,
  type LogEvent,
  type AppSettings,
  type GeminiConnectionTestResult
} from '@shared/types'
import { parseProjectContext } from '../services/projectParser'
import { loggerService } from '../services/loggerService'
import { getSettings, saveSettings } from '../services/settingsService'
import { testGeminiConnection } from '../services/geminiClient'

export type {
  FileNode,
  ProjectStats,
  ProjectScanResult,
  ProjectContext,
  PackageJsonSummary,
  DetectedStack,
  ConfigFileInfo,
  EntryPointInfo,
  LogLevel,
  LogSource,
  LogEvent,
  AppSettings,
  GeminiConnectionTestResult
}

const IGNORED_NAMES = new Set<string>([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  '.vscode',
  'pnpm-lock.yaml',
  'package-lock.json',
  'coverage'
])

const JS_TS_EXTENSIONS = new Set<string>([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts'
])

async function scanDirectory(
  dirPath: string,
  rootPath: string,
  stats: ProjectStats
): Promise<FileNode[]> {
  let entries
  try {
    entries = await readdir(dirPath, { withFileTypes: true })
  } catch (error) {
    console.error(`Failed to read directory: ${dirPath}`, error)
    return []
  }

  const nodes: FileNode[] = []

  for (const entry of entries) {
    const entryName = entry.name
    if (IGNORED_NAMES.has(entryName)) {
      continue
    }

    const fullPath = join(dirPath, entryName)
    const relPath = relative(rootPath, fullPath).replace(/\\/g, '/')

    if (entry.isDirectory()) {
      stats.totalFolders += 1
      const children = await scanDirectory(fullPath, rootPath, stats)
      nodes.push({
        name: entryName,
        path: fullPath,
        relativePath: relPath,
        isDirectory: true,
        children
      })
    } else if (entry.isFile()) {
      stats.totalFiles += 1
      const ext = extname(entryName).toLowerCase()

      if (JS_TS_EXTENSIONS.has(ext)) {
        stats.jsTsFilesCount += 1
      }
      if (ext === '.json') {
        stats.jsonFilesCount += 1
      }

      let fileSize = 0
      try {
        const fileStat = await stat(fullPath)
        fileSize = fileStat.size
      } catch {
        fileSize = 0
      }

      nodes.push({
        name: entryName,
        path: fullPath,
        relativePath: relPath,
        isDirectory: false,
        extension: ext,
        size: fileSize
      })
    }
  }

  // Sort: directories first, then alphabetical
  return nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * Register all IPC handlers for the main process.
 * Acts as the communication bridge for system actions, worker triggers, and project scanning.
 */
export function registerIpcHandlers(): void {
  // Test Ping Handler
  ipcMain.handle(IPC_CHANNELS.PING, async () => {
    return 'pong'
  })

  // System Information Handler
  ipcMain.handle(IPC_CHANNELS.GET_SYSTEM_INFO, async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome
    }
  })

  // Local File Scanner Handler
  ipcMain.handle(IPC_CHANNELS.SELECT_PROJECT, async (): Promise<ProjectScanResult> => {
    try {
      const dialogResult = await dialog.showOpenDialog({
        title: 'Выбрать папку проекта для QA анализа',
        properties: ['openDirectory', 'createDirectory']
      })

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return { canceled: true }
      }

      const selectedPath = dialogResult.filePaths[0]
      const projectName = basename(selectedPath)

      const stats: ProjectStats = {
        totalFiles: 0,
        totalFolders: 0,
        jsTsFilesCount: 0,
        jsonFilesCount: 0,
        codeFilesCount: 0
      }

      const children = await scanDirectory(selectedPath, selectedPath, stats)
      stats.codeFilesCount = stats.jsTsFilesCount + stats.jsonFilesCount

      const rootNode: FileNode = {
        name: projectName,
        path: selectedPath,
        relativePath: '',
        isDirectory: true,
        children
      }

      return {
        canceled: false,
        projectPath: selectedPath,
        projectName,
        fileTree: rootNode,
        stats
      }
    } catch (error) {
      console.error('Error during project scanning:', error)
      return {
        canceled: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка сканирования'
      }
    }
  })

  // Future Playwright Worker Execution Handler Placeholder
  ipcMain.handle(IPC_CHANNELS.PLAYWRIGHT_RUN, async (_event, params?: { suite?: string }) => {
    const suiteName = params?.suite ?? 'all'
    loggerService.info('playwright', `Запуск тестового набора Playwright: "${suiteName}"`)

    const result = {
      success: true,
      message: `Воркер Playwright успешно инициализирован для набора: ${suiteName}`,
      timestamp: new Date().toISOString()
    }

    loggerService.success(
      'playwright',
      `Набор "${suiteName}" успешно обработан воркером Playwright.`
    )
    return result
  })

  // Selective Source Code Parser Handler for Gemini AI Context
  ipcMain.handle(
    IPC_CHANNELS.PARSE_PROJECT_CONTEXT,
    async (_event, projectPath: string): Promise<ProjectContext> => {
      loggerService.info('ai', `Запуск селективного парсера проекта: ${projectPath}`)
      const context = await parseProjectContext(projectPath)
      loggerService.success(
        'ai',
        `Контекст проекта сформирован: стек [${context.detectedStack.frameworks.join(', ')}], конфигов: ${context.configFiles.length}`
      )
      return context
    }
  )

  // Real-Time Log Event Test Trigger Handler
  ipcMain.handle(
    IPC_CHANNELS.TRIGGER_TEST_LOG,
    async (
      _event,
      params?: {
        message?: string
        level?: LogLevel
        source?: LogSource
        details?: Record<string, unknown>
      }
    ): Promise<LogEvent> => {
      const level = params?.level ?? 'info'
      const source = params?.source ?? 'system'
      const message =
        params?.message ?? 'Тестовое событие реального времени получено через IPC-стриминг'
      return loggerService.broadcast(level, source, message, params?.details)
    }
  )

  // Persistent Settings Handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (): Promise<AppSettings> => {
    return getSettings()
  })

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SAVE,
    async (_event, newSettings: Partial<AppSettings>): Promise<AppSettings> => {
      return saveSettings(newSettings)
    }
  )

  // Google Gemini API Connection Test Handler
  ipcMain.handle(
    IPC_CHANNELS.AI_TEST_CONNECTION,
    async (_event, apiKey?: string): Promise<GeminiConnectionTestResult> => {
      return testGeminiConnection(apiKey)
    }
  )
}
