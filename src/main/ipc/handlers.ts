import { ipcMain, dialog } from 'electron'
import { readdir, stat } from 'node:fs/promises'
import { join, extname, basename, relative } from 'node:path'

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
  ipcMain.handle('app:ping', async () => {
    return 'pong'
  })

  // System Information Handler
  ipcMain.handle('app:get-system-info', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome
    }
  })

  // Local File Scanner Handler
  ipcMain.handle('dialog:select-project', async (): Promise<ProjectScanResult> => {
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
  ipcMain.handle('worker:playwright-run', async (_event, params?: { suite?: string }) => {
    console.log('[Main Process] Playwright worker trigger received:', params)
    return {
      success: true,
      message: `Playwright worker placeholder initialized for suite: ${params?.suite ?? 'all'}`,
      timestamp: new Date().toISOString()
    }
  })
}
