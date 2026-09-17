import { readFile, stat } from 'node:fs/promises'
import { join, basename, relative } from 'node:path'

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

const MAX_FILE_SIZE = 100 * 1024 // 100 KB limit for AI context

const TARGET_CONFIG_PATTERNS = [
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
  'jest.config.js'
]

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

/**
 * Parses and extracts dependencies and scripts from package.json
 */
async function parsePackageJson(
  projectPath: string
): Promise<{ summary?: PackageJsonSummary; rawContent?: string; error?: string }> {
  const pkgPath = join(projectPath, 'package.json')
  const fileData = await safeReadFile(pkgPath, projectPath)

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
      error: `Ошибка синтаксиса package.json: ${err instanceof Error ? err.message : 'Невалидный JSON'}`
    }
  }
}

/**
 * Detects frameworks, test runners, languages, and build tools
 */
function detectStack(pkg?: PackageJsonSummary, foundConfigs: string[] = []): DetectedStack {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  const frameworks: string[] = []
  const testRunners: string[] = []
  const buildTools: string[] = []

  // Framework detection
  if (deps['react']) frameworks.push('React')
  if (deps['next']) frameworks.push('Next.js')
  if (deps['vue']) frameworks.push('Vue')
  if (deps['svelte'] || deps['@sveltejs/kit']) frameworks.push('Svelte')
  if (deps['@angular/core']) frameworks.push('Angular')
  if (deps['electron']) frameworks.push('Electron')
  if (deps['express']) frameworks.push('Express')
  if (deps['@nestjs/core']) frameworks.push('NestJS')
  if (deps['fastify']) frameworks.push('Fastify')

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
  if (deps['cypress']) {
    testRunners.push('Cypress')
  }
  if (deps['mocha']) {
    testRunners.push('Mocha')
  }

  // Language detection
  const hasTsConfig = foundConfigs.some((c) => c.toLowerCase().includes('tsconfig'))
  const hasTypeScript = Boolean(deps['typescript'] || hasTsConfig)
  const language = hasTypeScript ? 'TypeScript' : 'JavaScript'

  // Tailwind CSS detection
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
  entries: EntryPointInfo[] = []
): string {
  const versionStr = pkg?.version ? ` (v${pkg.version})` : ''
  const scriptsList = pkg?.scripts
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

  return `### Контекст проекта: ${projectName}${versionStr}
- **Каталог:** \`${projectPath}\`
- **Фреймворки:** ${stack.frameworks.join(', ') || 'Не определены'}
- **Язык разработки:** ${stack.language}
- **Тестовые раннеры:** ${stack.testRunners.join(', ') || 'Не обнаружены'}
- **Инструменты сборки:** ${stack.buildTools.join(', ') || 'Стандартные'}
- **Стилизация:** ${stack.hasTailwind ? 'Tailwind CSS' : 'Стандартные стили'}

#### Конфигурационные файлы:
${configsList}

#### Точки входа приложения:
${entriesList}

#### Скрипты package.json:
${scriptsList}
`
}

/**
 * Main service entry: inspects project, parses package.json, reads configs and entry points,
 * and compiles a structured ProjectContext summary object for Gemini AI reasoning.
 */
export async function parseProjectContext(projectPath: string): Promise<ProjectContext> {
  const projectName = basename(projectPath) || 'project'
  const timestamp = new Date().toISOString()

  try {
    // 1. Parse package.json
    const { summary: pkgSummary, error: pkgError } = await parsePackageJson(projectPath)

    // 2. Locate and selectively read configuration files
    const configFiles: ConfigFileInfo[] = []
    for (const pattern of TARGET_CONFIG_PATTERNS) {
      const fullPath = join(projectPath, pattern)
      const fileData = await safeReadFile(fullPath, projectPath)
      if (fileData) {
        configFiles.push({
          name: pattern,
          relativePath: fileData.relativePath,
          content: fileData.content,
          size: fileData.size,
          truncated: fileData.truncated
        })
      }
    }

    // 3. Locate and selectively read application entry points
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

    // 4. Detect tech stack
    const detectedStack = detectStack(
      pkgSummary,
      configFiles.map((c) => c.relativePath)
    )

    // 5. Generate AI context summary string
    const summary = buildMarkdownSummary(
      projectPath,
      pkgSummary?.name || projectName,
      detectedStack,
      pkgSummary,
      configFiles,
      entryPoints
    )

    return {
      projectPath,
      projectName: pkgSummary?.name || projectName,
      timestamp,
      hasPackageJson: Boolean(pkgSummary),
      packageJson: pkgSummary,
      detectedStack,
      configFiles,
      entryPoints,
      summary,
      error: pkgError
    }
  } catch (error) {
    console.error('[projectParser] Error parsing project context:', error)
    return {
      projectPath,
      projectName,
      timestamp,
      hasPackageJson: false,
      detectedStack: {
        frameworks: [],
        testRunners: [],
        language: 'Unknown',
        hasTypeScript: false,
        hasTailwind: false,
        buildTools: []
      },
      configFiles: [],
      entryPoints: [],
      summary: `Ошибка парсинга проекта: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }
  }
}
