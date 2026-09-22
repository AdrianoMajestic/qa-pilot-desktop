import { GoogleGenAI } from '@google/genai'
import type { ArchitectureAnalysisResult, ProjectContext, UntestedArea } from '@shared/types'
import { GEMINI_DEFAULT_MODEL, getApiKey, parseGeminiError } from './geminiClient'
import { loggerService } from './loggerService'

const SYSTEM_INSTRUCTION = `You are a senior QA architect and application security reviewer.
Analyze the supplied open-source project context and produce a concise quality assessment.
Focus on: missing test files (.test.ts, .spec.ts, .test.js, .spec.js) for services and business logic,
architecture risks (missing error handling, IPC/security boundaries, outdated or risky dependencies,
exposed secrets in configs), and actionable recommendations.
Respond in Russian for human-readable string fields (reason, vulnerabilities, recommendations).
Output must strictly match the requested JSON schema.`

const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    healthScore: {
      type: 'number',
      description: 'Overall project quality and security score from 0 to 100'
    },
    untestedAreas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          reason: { type: 'string' },
          riskLevel: { type: 'string', enum: ['high', 'medium', 'low'] }
        },
        required: ['path', 'reason', 'riskLevel']
      }
    },
    vulnerabilities: {
      type: 'array',
      items: { type: 'string' }
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['healthScore', 'untestedAreas', 'vulnerabilities', 'recommendations']
} as const

const MAX_CONFIG_SNIPPET_CHARS = 2500
const MAX_ENTRY_SNIPPET_CHARS = 1500

/**
 * Builds a compact directory outline from known config and entry-point paths.
 */
function buildDirectoryOutline(context: ProjectContext): string {
  const paths = new Set<string>()
  for (const cfg of context.configFiles) {
    const dir = cfg.relativePath.includes('/')
      ? cfg.relativePath.replace(/\/[^/]+$/, '')
      : cfg.relativePath.includes('\\')
        ? cfg.relativePath.replace(/\\[^\\]+$/, '')
        : '.'
    paths.add(dir || '.')
    paths.add(cfg.relativePath)
  }
  for (const entry of context.entryPoints) {
    paths.add(entry.relativePath)
  }

  const sorted = [...paths].sort((a, b) => a.localeCompare(b))
  if (sorted.length === 0) {
    return '- (структура каталогов не передана парсером; опирайтесь на summary и package.json)'
  }
  return sorted.map((p) => `- \`${p}\``).join('\n')
}

/**
 * Formats ProjectContext into a user prompt for Gemini architecture analysis.
 */
export function buildArchitecturePrompt(context: ProjectContext): string {
  const pkg = context.packageJson
  const deps = pkg?.dependencies
    ? Object.entries(pkg.dependencies)
        .slice(0, 40)
        .map(([name, ver]) => `  - ${name}: ${ver}`)
        .join('\n')
    : '  - (нет production-зависимостей или package.json отсутствует)'

  const devDeps = pkg?.devDependencies
    ? Object.entries(pkg.devDependencies)
        .slice(0, 40)
        .map(([name, ver]) => `  - ${name}: ${ver}`)
        .join('\n')
    : '  - (нет devDependencies)'

  const scripts = pkg?.scripts
    ? Object.entries(pkg.scripts)
        .map(([name, cmd]) => `  - ${name}: ${cmd}`)
        .join('\n')
    : '  - (скрипты не заданы)'

  const configBlocks = context.configFiles.length
    ? context.configFiles
        .map((cfg) => {
          const snippet =
            cfg.content.length > MAX_CONFIG_SNIPPET_CHARS
              ? cfg.content.slice(0, MAX_CONFIG_SNIPPET_CHARS) +
                '\n// ... [усечено для лимита контекста]'
              : cfg.content
          return `#### ${cfg.relativePath} (${cfg.size} байт${cfg.truncated ? ', усечено парсером' : ''})\n\`\`\`\n${snippet}\n\`\`\``
        })
        .join('\n\n')
    : '_Конфигурационные файлы не обнаружены._'

  const entryBlocks = context.entryPoints.length
    ? context.entryPoints
        .map((entry) => {
          const snippet =
            entry.content.length > MAX_ENTRY_SNIPPET_CHARS
              ? entry.content.slice(0, MAX_ENTRY_SNIPPET_CHARS) +
                '\n// ... [усечено для лимита контекста]'
              : entry.content
          return `#### ${entry.relativePath}\n\`\`\`\n${snippet}\n\`\`\``
        })
        .join('\n\n')
    : '_Точки входа не обнаружены._'

  const stack = context.detectedStack

  return `# Задача: архитектурный и QA-аудит проекта

## Метаданные
- **Проект:** ${context.projectName}
- **Путь:** ${context.projectPath}
- **Снимок контекста:** ${context.timestamp}
- **package.json:** ${context.hasPackageJson ? 'найден' : 'отсутствует'}
${context.error ? `- **Предупреждение парсера:** ${context.error}` : ''}

## Технологический стек (эвристика парсера)
- Фреймворки: ${stack.frameworks.join(', ') || '—'}
- Тестовые раннеры: ${stack.testRunners.join(', ') || '—'}
- Язык: ${stack.language}
- TypeScript: ${stack.hasTypeScript ? 'да' : 'нет'}
- Tailwind: ${stack.hasTailwind ? 'да' : 'нет'}
- Сборка: ${stack.buildTools.join(', ') || '—'}

## Сводка парсера (markdown)
${context.summary}

## Обнаруженные пути (дерево / ключевые файлы)
${buildDirectoryOutline(context)}

## package.json — scripts
${scripts}

## package.json — dependencies
${deps}

## package.json — devDependencies
${devDeps}

## Конфигурационные файлы
${configBlocks}

## Точки входа
${entryBlocks}

Оцени healthScore (0–100), перечисли untestedAreas с riskLevel, vulnerabilities и recommendations.`
}

function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round(num)))
}

function normalizeRiskLevel(value: unknown): UntestedArea['riskLevel'] {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value
  }
  return 'medium'
}

function normalizeUntestedAreas(raw: unknown): UntestedArea[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const result: UntestedArea[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const record = item as Record<string, unknown>
    const path = typeof record.path === 'string' ? record.path.trim() : ''
    const reason = typeof record.reason === 'string' ? record.reason.trim() : ''
    if (!path || !reason) {
      continue
    }
    result.push({
      path,
      reason,
      riskLevel: normalizeRiskLevel(record.riskLevel)
    })
  }
  return result
}

function normalizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((s) => s.trim())
}

/**
 * Parses model JSON with fallback extraction from fenced code blocks.
 */
export function parseArchitectureResponse(
  rawText: string
): Omit<ArchitectureAnalysisResult, 'timestamp'> {
  const trimmed = rawText.trim()
  let parsed: unknown

  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const candidate = fenceMatch?.[1]?.trim() ?? trimmed
    const jsonMatch = candidate.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Ответ Gemini не содержит валидного JSON объекта.')
    }
    parsed = JSON.parse(jsonMatch[0]) as unknown
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Ответ Gemini имеет неверную структуру (ожидался объект).')
  }

  const record = parsed as Record<string, unknown>

  return {
    healthScore: clampScore(record.healthScore),
    untestedAreas: normalizeUntestedAreas(record.untestedAreas),
    vulnerabilities: normalizeStringList(record.vulnerabilities),
    recommendations: normalizeStringList(record.recommendations)
  }
}

/**
 * Runs Gemini architecture & file-structure analysis for the given project context.
 */
export async function analyzeArchitecture(
  context: ProjectContext
): Promise<ArchitectureAnalysisResult> {
  const activeKey = getApiKey()
  if (!activeKey) {
    const msg = 'API-ключ Gemini не задан. Укажите ключ в настройках приложения.'
    loggerService.warn('ai', msg)
    throw new Error(msg)
  }

  loggerService.info(
    'ai',
    `Запуск AI-анализа архитектуры проекта «${context.projectName}» (модель: ${GEMINI_DEFAULT_MODEL})...`
  )

  const userPrompt = buildArchitecturePrompt(context)

  try {
    const client = new GoogleGenAI({ apiKey: activeKey })

    const response = await client.models.generateContent({
      model: GEMINI_DEFAULT_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema: ANALYSIS_JSON_SCHEMA,
        temperature: 0.25,
        maxOutputTokens: 8192
      }
    })

    const rawText = response.text?.trim()
    if (!rawText) {
      throw new Error('Google Gemini API вернул пустой ответ при анализе архитектуры.')
    }

    let normalized: Omit<ArchitectureAnalysisResult, 'timestamp'>
    try {
      normalized = parseArchitectureResponse(rawText)
    } catch (parseError) {
      const parseMsg =
        parseError instanceof Error ? parseError.message : 'Ошибка разбора JSON ответа Gemini'
      loggerService.error('ai', `Сбой парсинга JSON анализа архитектуры: ${parseMsg}`)
      throw new Error(`Не удалось разобрать структурированный ответ Gemini: ${parseMsg}`)
    }

    const result: ArchitectureAnalysisResult = {
      ...normalized,
      timestamp: Date.now()
    }

    loggerService.success(
      'ai',
      `AI-анализ архитектуры завершён: healthScore=${result.healthScore}, нетестированных зон: ${result.untestedAreas.length}, рисков: ${result.vulnerabilities.length}`
    )

    return result
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('Не удалось разобрать')) {
      throw error
    }
    if (error instanceof Error && error.message.includes('API-ключ Gemini')) {
      throw error
    }
    const parsedError = parseGeminiError(error)
    loggerService.error('ai', `Ошибка AI-анализа архитектуры: ${parsedError}`)
    throw new Error(`Сбой AI-анализа архитектуры: ${parsedError}`)
  }
}
