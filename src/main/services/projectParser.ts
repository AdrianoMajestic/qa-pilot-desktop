import { readFile, stat, readdir } from 'node:fs/promises'
import { join, basename, relative, extname } from 'node:path'

import {
  type PackageJsonSummary,
  type DetectedStack,
  type ConfigFileInfo,
  type EntryPointInfo,
  type ProjectContext
} from '@shared/types'

export type { PackageJsonSummary, DetectedStack, ConfigFileInfo, EntryPointInfo, ProjectContext }

const MAX_FILE_SIZE = 100 * 1024 // 100 KB limit for AI context

const IGNORED_SCAN_DIRS = new Set<string>([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'out',
  '.vscode',
  '.idea',
  'coverage',
  '.turbo',
  '.cache'
])

const TARGET_CONFIG_BASENAMES = new Set<string>([
  'package.json',
  'playwright.config.ts',
  'playwright.config.js',
  'playwright.config.mjs',
  'playwright.config.cjs',
  'electron.vite.config.ts',
  'electron.vite.config.js',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.web.json',
  'tsconfig.app.json',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  '.eslintrc.json',
  '.eslintrc.js',
  'vitest.config.ts',
  'vitest.config.js',
  'jest.config.ts',
  'jest.config.js',
  '.env',
  '.env.local',
  '.env.development',
  '.env.example'
])

const TARGET_ENTRY_PATTERNS = [
  'src/main.tsx',
  'src/main.ts',
  'src/main.jsx',
  'src/main.js',
  'src/renderer/src/main.tsx',
  'src/renderer/src/App.tsx',
  'src/renderer/index.html',
  'src/main/index.ts',
  'src/main/index.js',
  'src/preload/index.ts',
  'src/preload/index.js',
  'src/App.tsx',
  'src/App.jsx',
  'src/App.vue',
  'src/App.svelte',
  'src/index.tsx',
  'src/index.ts',
  'src/index.jsx',
  'src/index.js',
  'src/server.ts',
  'src/server.js',
  'src/app.ts',
  'src/app.js',
  'pages/_app.tsx',
  'pages/index.tsx',
  'app/layout.tsx',
  'app/page.tsx',
  'index.html'
]

/**
 * Safely reads a file with strict maximum size limit (100 KB).
 * If file size exceeds the limit, content is truncated and flagged.
 */
async function safeReadFile(
  fullPath: string,
  rootPath: string,
  maxSize: number = MAX_FILE_SIZE
): Promise<{ relativePath: string; content: string; size: number; truncated: boolean } | null> {
  try {
    const fileStat = await stat(fullPath)
    if (!fileStat.isFile()) {
      return null
    }

    const size = fileStat.size
    const relPath = relative(rootPath, fullPath).replace(/\\/g, '/')

    if (size > maxSize) {
      const raw = await readFile(fullPath, 'utf-8')
      const truncatedContent =
        raw.slice(0, maxSize) +
        `\n\n// [ВНИМАНИЕ: Содержимое файла (${size} байт) превысило лимит 100 КБ для контекста Gemini AI и было усечено]\n`
      return {
        relativePath: relPath,
        content: truncatedContent,
        size,
        truncated: true
      }
    }

    const content = await readFile(fullPath, 'utf-8')
    return {
      relativePath: relPath,
      content,
      size,
      truncated: false
    }
  } catch {
    return null
  }
}

interface DiscoveredFile {
  fullPath: string
  relativePath: string
  name: string
  depth: number
}

interface ExtensionCounts {
  html: number
  css: number
  js: number
  ts: number
  php: number
  json: number
  other: number
}

/**
 * Recursively scans directory up to maxDepth (3 levels deep) searching for
 * config files, package.json files, and tallies file extensions.
 */
async function scanProjectFiles(
  dirPath: string,
  rootPath: string,
  currentDepth: number = 0,
  maxDepth: number = 3
): Promise<{
  configFiles: DiscoveredFile[]
  packageJsonFiles: DiscoveredFile[]
  extCounts: ExtensionCounts
}> {
  const result: {
    configFiles: DiscoveredFile[]
    packageJsonFiles: DiscoveredFile[]
    extCounts: ExtensionCounts
  } = {
    configFiles: [],
    packageJsonFiles: [],
    extCounts: { html: 0, css: 0, js: 0, ts: 0, php: 0, json: 0, other: 0 }
  }

  let entries
  try {
    entries = await readdir(dirPath, { withFileTypes: true })
  } catch {
    return result
  }

  for (const entry of entries) {
    const name = entry.name
    if (IGNORED_SCAN_DIRS.has(name)) {
      continue
    }

    const fullPath = join(dirPath, name)
    const relPath = relative(rootPath, fullPath).replace(/\\/g, '/')

    if (entry.isDirectory()) {
      if (currentDepth < maxDepth) {
        const subResult = await scanProjectFiles(fullPath, rootPath, currentDepth + 1, maxDepth)
        result.configFiles.push(...subResult.configFiles)
        result.packageJsonFiles.push(...subResult.packageJsonFiles)
        result.extCounts.html += subResult.extCounts.html
        result.extCounts.css += subResult.extCounts.css
        result.extCounts.js += subResult.extCounts.js
        result.extCounts.ts += subResult.extCounts.ts
        result.extCounts.php += subResult.extCounts.php
        result.extCounts.json += subResult.extCounts.json
        result.extCounts.other += subResult.extCounts.other
      }
    } else if (entry.isFile()) {
      // Extension statistics
      const ext = extname(name).toLowerCase()
      if (ext === '.html' || ext === '.htm') result.extCounts.html += 1
      else if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') result.extCounts.css += 1
      else if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') result.extCounts.js += 1
      else if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') result.extCounts.ts += 1
      else if (ext === '.php') result.extCounts.php += 1
      else if (ext === '.json') result.extCounts.json += 1
      else result.extCounts.other += 1

      // Package.json detection
      if (name === 'package.json') {
        result.packageJsonFiles.push({
          fullPath,
          relativePath: relPath,
          name,
          depth: currentDepth
        })
      }

      // Config files matching
      if (TARGET_CONFIG_BASENAMES.has(name) && name !== 'package.json') {
        result.configFiles.push({
          fullPath,
          relativePath: relPath,
          name,
          depth: currentDepth
        })
      }
    }
  }

  return result
}

/**
 * Parses and extracts dependencies and scripts from package.json files
 */
async function parseSinglePackageJson(
  fullPath: string,
  rootPath: string
): Promise<{ summary?: PackageJsonSummary; rawContent?: string; error?: string }> {
  const fileData = await safeReadFile(fullPath, rootPath)
  if (!fileData) {
    return {}
  }

  try {
    const parsed = JSON.parse(fileData.content)
    const summary: PackageJsonSummary = {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
      scripts: typeof parsed.scripts === 'object' && parsed.scripts !== null ? parsed.scripts : {},
      dependencies:
        typeof parsed.dependencies === 'object' && parsed.dependencies !== null
          ? parsed.dependencies
          : {},
      devDependencies:
        typeof parsed.devDependencies === 'object' && parsed.devDependencies !== null
          ? parsed.devDependencies
          : {},
      rawContent: fileData.content
    }
    return { summary, rawContent: fileData.content }
  } catch (err) {
    return {
      error: `Ошибка синтаксиса ${relative(rootPath, fullPath)}: ${err instanceof Error ? err.message : 'Невалидный JSON'}`
    }
  }
}

/**
 * Aggregates multiple package.json files (monorepo / subfolders) into a unified summary
 * and discovers sub-services (e.g. Frontend, Backend).
 */
async function aggregatePackageJsons(
  packageFiles: DiscoveredFile[],
  rootPath: string
): Promise<{
  aggregatedSummary?: PackageJsonSummary
  subServices: string[]
  errors: string[]
}> {
  if (packageFiles.length === 0) {
    return { subServices: [], errors: [] }
  }

  // Sort: root level package.json first, then shallower subfolders
  packageFiles.sort((a, b) => a.depth - b.depth)

  const mergedScripts: Record<string, string> = {}
  const mergedDeps: Record<string, string> = {}
  const mergedDevDeps: Record<string, string> = {}
  const subServices: string[] = []
  const errors: string[] = []
  let primaryName: string | undefined
  let primaryVersion: string | undefined
  let primaryDescription: string | undefined
  let primaryRawContent: string | undefined

  for (const pkgFile of packageFiles) {
    const { summary, rawContent, error } = await parseSinglePackageJson(pkgFile.fullPath, rootPath)
    if (error) {
      errors.push(error)
      continue
    }
    if (!summary) continue

    // Use root package.json for primary project metadata
    if (pkgFile.depth === 0) {
      primaryName = summary.name
      primaryVersion = summary.version
      primaryDescription = summary.description
      primaryRawContent = rawContent
    } else if (!primaryName && summary.name) {
      primaryName = summary.name
    }

    // Merge scripts (prefix with subfolder name if not at root)
    const folderPrefix = pkgFile.depth > 0 ? `${pkgFile.relativePath.replace('/package.json', '')}:` : ''
    for (const [key, val] of Object.entries(summary.scripts || {})) {
      mergedScripts[`${folderPrefix}${key}`] = val
    }

    // Merge dependencies
    Object.assign(mergedDeps, summary.dependencies || {})
    Object.assign(mergedDevDeps, summary.devDependencies || {})

    // Sub-service tagging (e.g. Frontend: React, Backend: Express)
    const allPkgDeps = { ...(summary.dependencies || {}), ...(summary.devDependencies || {}) }
    const subTags: string[] = []
    if (allPkgDeps['react']) subTags.push('React')
    if (allPkgDeps['next']) subTags.push('Next.js')
    if (allPkgDeps['vue']) subTags.push('Vue')
    if (allPkgDeps['svelte']) subTags.push('Svelte')
    if (allPkgDeps['vite']) subTags.push('Vite')
    if (allPkgDeps['express']) subTags.push('Express')
    if (allPkgDeps['fastify']) subTags.push('Fastify')
    if (allPkgDeps['@nestjs/core']) subTags.push('NestJS')
    if (allPkgDeps['electron']) subTags.push('Electron')

    if (pkgFile.depth > 0) {
      const folderName = pkgFile.relativePath.replace('/package.json', '')
      const techLabel = subTags.length > 0 ? subTags.join(' + ') : 'Node.js'
      subServices.push(`${folderName} (${techLabel})`)
    }
  }

  const aggregatedSummary: PackageJsonSummary = {
    name: primaryName,
    version: primaryVersion,
    description: primaryDescription,
    scripts: mergedScripts,
    dependencies: mergedDeps,
    devDependencies: mergedDevDeps,
    rawContent: primaryRawContent
  }

  return { aggregatedSummary, subServices, errors }
}

/**
 * Detects frameworks, test runners, languages, and build tools.
 * Includes static web project fallback if no package.json exists.
 */
function detectStack(
  pkg?: PackageJsonSummary,
  foundConfigs: string[] = [],
  extCounts?: ExtensionCounts,
  subServices: string[] = []
): DetectedStack {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  const frameworks: string[] = []
  const testRunners: string[] = []
  const buildTools: string[] = []

  // Add sub-service tags if monorepo
  for (const sub of subServices) {
    frameworks.push(sub)
  }

  // Framework detection from aggregated deps
  if (deps['react'] && !frameworks.some((f) => f.includes('React'))) frameworks.push('React')
  if (deps['next'] && !frameworks.some((f) => f.includes('Next.js'))) frameworks.push('Next.js')
  if (deps['vue'] && !frameworks.some((f) => f.includes('Vue'))) frameworks.push('Vue')
  if (deps['svelte'] || deps['@sveltejs/kit']) {
    if (!frameworks.some((f) => f.includes('Svelte'))) frameworks.push('Svelte')
  }
  if (deps['@angular/core']) frameworks.push('Angular')
  if (deps['electron']) frameworks.push('Electron')
  if (deps['express'] && !frameworks.some((f) => f.includes('Express'))) frameworks.push('Express')
  if (deps['@nestjs/core'] && !frameworks.some((f) => f.includes('NestJS'))) frameworks.push('NestJS')
  if (deps['fastify'] && !frameworks.some((f) => f.includes('Fastify'))) frameworks.push('Fastify')

  // Test runner detection
  const hasPlaywrightConfig = foundConfigs.some((c) => c.toLowerCase().includes('playwright'))
  if (deps['@playwright/test'] || deps['playwright'] || hasPlaywrightConfig) {
    testRunners.push('Playwright')
  }
  if (deps['vitest'] || foundConfigs.some((c) => c.toLowerCase().includes('vitest'))) {
    testRunners.push('Vitest')
  }
  if (deps['jest'] || foundConfigs.some((c) => c.toLowerCase().includes('jest'))) {
    testRunners.push('Jest')
  }
  if (deps['cypress']) testRunners.push('Cypress')
  if (deps['mocha']) testRunners.push('Mocha')

  // Language & Tailwind detection
  const hasTsConfig = foundConfigs.some((c) => c.toLowerCase().includes('tsconfig'))
  const hasTypeScript = Boolean(deps['typescript'] || hasTsConfig || (extCounts && extCounts.ts > 0))
  let language = hasTypeScript ? 'TypeScript' : 'JavaScript'

  const hasTailwindConfig = foundConfigs.some((c) => c.toLowerCase().includes('tailwind'))
  const hasTailwind = Boolean(deps['tailwindcss'] || deps['@tailwindcss/vite'] || hasTailwindConfig)

  // Build tools detection
  if (deps['electron-vite'] || foundConfigs.some((c) => c.includes('electron.vite.config'))) {
    buildTools.push('electron-vite')
  } else if (deps['vite'] || foundConfigs.some((c) => c.includes('vite.config'))) {
    buildTools.push('Vite')
  }
  if (deps['webpack']) buildTools.push('Webpack')
  if (deps['rollup']) buildTools.push('Rollup')
  if (deps['esbuild']) buildTools.push('esbuild')

  // ==========================================
  // Static Web Project Fallback (No package.json)
  // ==========================================
  if (!pkg && extCounts) {
    if (extCounts.html > 0) frameworks.push('HTML5')
    if (extCounts.css > 0) frameworks.push('CSS3 / Styles')
    if (extCounts.js > 0 && !hasTypeScript) frameworks.push('Vanilla JavaScript')
    if (extCounts.ts > 0) frameworks.push('TypeScript')
    if (extCounts.php > 0) {
      frameworks.push('PHP')
      language = 'PHP / Web'
    } else if (extCounts.html > 0 && extCounts.js === 0 && extCounts.ts === 0) {
      language = 'HTML / CSS'
    }
  }

  // Fallback to avoid empty frameworks array for valid codebases
  if (frameworks.length === 0) {
    if (hasTypeScript) frameworks.push('TypeScript Project')
    else frameworks.push('Web Application')
  }

  return {
    frameworks,
    testRunners,
    language,
    hasTypeScript,
    hasTailwind,
    buildTools
  }
}

/**
 * Builds a markdown summary formatted specifically for Google Gemini context injection
 */
function buildMarkdownSummary(
  projectPath: string,
  projectName: string,
  stack: DetectedStack,
  pkg?: PackageJsonSummary,
  configs: ConfigFileInfo[] = [],
  entries: EntryPointInfo[] = [],
  subServices: string[] = []
): string {
  const versionStr = pkg?.version ? ` (v${pkg.version})` : ''
  const scriptsList = pkg?.scripts && Object.keys(pkg.scripts).length > 0
    ? Object.entries(pkg.scripts)
        .slice(0, 15)
        .map(([k, v]) => `  - \`${k}\`: \`${v}\``)
        .join('\n')
    : '  - Нет настроенных скриптов'

  const configsList = configs.length
    ? configs
        .map(
          (c) =>
            `  - \`${c.relativePath}\` (${Math.round(c.size / 1024)} КБ${c.truncated ? ', усечен' : ''})`
        )
        .join('\n')
    : '  - Конфигурационные файлы не обнаружены'

  const entriesList = entries.length
    ? entries.map((e) => `  - \`${e.relativePath}\` (${Math.round(e.size / 1024)} КБ)`).join('\n')
    : '  - Точки входа не обнаружены'

  const subServicesSection = subServices.length > 0
    ? `\n#### Обнаруженные подмодули / сервисы:\n${subServices.map((s) => `  - 📦 ${s}`).join('\n')}\n`
    : ''

  return `### Контекст проекта: ${projectName}${versionStr}
- **Каталог:** \`${projectPath}\`
- **Тип проекта:** ${pkg ? 'Node.js / Web Project' : 'Статический веб-проект (без package.json)'}
- **Стек и фреймворки:** ${stack.frameworks.join(', ') || 'Стандартный стек'}
- **Основной язык:** ${stack.language}
- **Тестовые раннеры:** ${stack.testRunners.join(', ') || 'Не обнаружены'}
- **Инструменты сборки:** ${stack.buildTools.join(', ') || 'Стандартные'}
- **Стилизация:** ${stack.hasTailwind ? 'Tailwind CSS' : 'Стандартные стили / CSS'}
${subServicesSection}
#### Конфигурационные файлы:
${configsList}

#### Точки входа приложения:
${entriesList}

#### Скрипты:
${scriptsList}
`
}

/**
 * Main service entry: inspects project, parses package.json (including monorepos up to 3 levels deep),
 * handles static HTML/CSS web projects without package.json, reads configs and entry points,
 * and compiles a structured ProjectContext summary object for Gemini AI reasoning.
 */
export async function parseProjectContext(projectPath: string): Promise<ProjectContext> {
  const projectName = basename(projectPath) || 'project'
  const timestamp = new Date().toISOString()

  try {
    // 1. Recursive scan up to 3 levels deep for package.json, configs, and file extension tally
    const { configFiles: discoveredConfigs, packageJsonFiles, extCounts } = await scanProjectFiles(
      projectPath,
      projectPath,
      0,
      3
    )

    // 2. Parse and aggregate all discovered package.json files
    const { aggregatedSummary, subServices, errors: pkgErrors } = await aggregatePackageJsons(
      packageJsonFiles,
      projectPath
    )

    // 3. Selectively read discovered configuration files
    const configFiles: ConfigFileInfo[] = []
    for (const disc of discoveredConfigs) {
      const fileData = await safeReadFile(disc.fullPath, projectPath)
      if (fileData) {
        configFiles.push({
          name: disc.name,
          relativePath: fileData.relativePath,
          content: fileData.content,
          size: fileData.size,
          truncated: fileData.truncated
        })
      }
    }

    // 4. Locate and selectively read application entry points
    const entryPoints: EntryPointInfo[] = []
    for (const pattern of TARGET_ENTRY_PATTERNS) {
      const fullPath = join(projectPath, pattern)
      const fileData = await safeReadFile(fullPath, projectPath)
      if (fileData) {
        entryPoints.push({
          name: pattern,
          relativePath: fileData.relativePath,
          content: fileData.content,
          size: fileData.size,
          truncated: fileData.truncated
        })
      }
    }

    // 5. Detect tech stack with monorepo & static fallback support
    const detectedStack = detectStack(
      aggregatedSummary,
      configFiles.map((c) => c.relativePath),
      extCounts,
      subServices
    )

    // 6. Calculate total context volume and approximate token count (1 token ~= 4 bytes UTF-8)
    const pkgBytes = aggregatedSummary?.rawContent
      ? Buffer.byteLength(aggregatedSummary.rawContent, 'utf-8')
      : 0
    const configBytes = configFiles.reduce((acc, f) => acc + f.size, 0)
    const entryBytes = entryPoints.reduce((acc, f) => acc + f.size, 0)
    const totalBytes = pkgBytes + configBytes + entryBytes
    const estimatedTokens = Math.ceil(totalBytes / 4)

    // 7. Generate AI context summary string
    const summary = buildMarkdownSummary(
      projectPath,
      aggregatedSummary?.name || projectName,
      detectedStack,
      aggregatedSummary,
      configFiles,
      entryPoints,
      subServices
    )

    return {
      projectPath,
      projectName: aggregatedSummary?.name || projectName,
      timestamp,
      hasPackageJson: Boolean(aggregatedSummary),
      packageJson: aggregatedSummary,
      detectedStack,
      configFiles,
      entryPoints,
      summary,
      totalBytes,
      estimatedTokens,
      error: pkgErrors.length > 0 ? pkgErrors.join('; ') : undefined
    }
  } catch (error) {
    console.error('[projectParser] Error parsing project context:', error)
    return {
      projectPath,
      projectName,
      timestamp,
      hasPackageJson: false,
      detectedStack: {
        frameworks: ['Web Application'],
        testRunners: [],
        language: 'JavaScript',
        hasTypeScript: false,
        hasTailwind: false,
        buildTools: []
      },
      configFiles: [],
      entryPoints: [],
      summary: `Ошибка парсинга проекта: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      totalBytes: 0,
      estimatedTokens: 0,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }
  }
}

