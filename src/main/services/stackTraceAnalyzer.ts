import { GoogleGenAI } from '@google/genai'
import type {
  CapturedBrowserError,
  ProjectContext,
  StackTraceAnalysisResult
} from '@shared/types'
import { GEMINI_DEFAULT_MODEL, getApiKey, parseGeminiError } from './geminiClient'
import { loggerService } from './loggerService'

type Severity = StackTraceAnalysisResult['severity']

const SYSTEM_INSTRUCTION = `You are a senior full-stack debugger and QA engineer.
Analyze browser/runtime errors using the stack trace, error metadata, and optional project context.
Identify root cause, affected module, severity, sequential fix steps, and a concise code fix snippet or diff.
Respond in Russian for human-readable fields (rootCause, stepsToFix, codeFixSnippet).
Output must strictly match the requested JSON schema.`

const STACK_TRACE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    rootCause: { type: 'string' },
    affectedModule: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    stepsToFix: {
      type: 'array',
      items: { type: 'string' }
    },
    codeFixSnippet: { type: 'string' }
  },
  required: ['rootCause', 'severity', 'stepsToFix']
} as const

function errorTypeLabel(type: CapturedBrowserError['type']): string {
  switch (type) {
    case 'http_error':
      return 'HTTP 500+ response'
    case 'network_failure':
      return 'network failure (requestfailed)'
    case 'console_error':
      return 'browser console error'
    case 'page_error':
      return 'uncaught JavaScript exception (pageerror)'
    default:
      return type
  }
}

function resolveStackTrace(error: CapturedBrowserError): string {
  if (error.stackTrace?.trim()) {
    return error.stackTrace.trim()
  }
  const lines = [error.message]
  if (error.location?.url) {
    lines.push(
      `    at ${error.location.url}:${error.location.lineNumber ?? 0}:${error.location.columnNumber ?? 0}`
    )
  }
  if (error.failureText) {
    lines.push(`Network failure: ${error.failureText}`)
  }
  if (error.statusCode) {
    lines.push(`HTTP ${error.statusCode} ${error.statusText ?? ''}`.trim())
  }
  return lines.join('\n')
}

function normalizeSeverity(value: unknown, error: CapturedBrowserError): Severity {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') {
    return value
  }
  if (error.type === 'page_error') {
    return 'critical'
  }
  if (error.type === 'http_error' && (error.statusCode ?? 0) >= 500) {
    return 'high'
  }
  if (error.type === 'network_failure') {
    return 'medium'
  }
  return 'medium'
}

function normalizeSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((s) => s.trim())
}

/**
 * Builds a Gemini user prompt from captured browser error and optional project context.
 */
export function buildStackTracePrompt(
  error: CapturedBrowserError,
  projectContext?: ProjectContext
): string {
  const stackTrace = resolveStackTrace(error)

  const contextBlock = projectContext
    ? `## Project context
- Project: ${projectContext.projectName}
- Path: ${projectContext.projectPath}
- Frameworks: ${projectContext.detectedStack.frameworks.join(', ') || '—'}
- Test runners: ${projectContext.detectedStack.testRunners.join(', ') || '—'}
- Language: ${projectContext.detectedStack.language}
- Dependencies (sample): ${
        projectContext.packageJson?.dependencies
          ? Object.keys(projectContext.packageJson.dependencies).slice(0, 20).join(', ')
          : '—'
      }

${projectContext.summary.slice(0, 3000)}
`
    : '## Project context\n_not provided — infer from stack trace and URL only_\n'

  return `# Stack trace analysis request

## Error metadata
- Error ID: ${error.id}
- Type: ${errorTypeLabel(error.type)}
- Source: ${error.source}
- URL: ${error.url ?? '—'}
- HTTP status: ${error.statusCode ?? '—'} ${error.statusText ?? ''}
- Network failure: ${error.failureText ?? '—'}
- Timestamp: ${new Date(error.timestamp).toISOString()}

## Error message
${error.message}

## Raw stack trace
\`\`\`
${stackTrace}
\`\`\`

${contextBlock}

Provide rootCause, affectedModule (file path or component if identifiable), severity, stepsToFix (3-6 steps), and codeFixSnippet (corrected code or minimal diff).`
}

function buildFallbackAnalysis(error: CapturedBrowserError): Omit<
  StackTraceAnalysisResult,
  'errorId' | 'timestamp'
> {
  const severity = normalizeSeverity(undefined, error)
  const steps: string[] = []

  if (error.type === 'http_error') {
    steps.push(
      'Проверьте серверные логи для эндпоинта, вернувшего HTTP 500+.',
      'Воспроизведите запрос через DevTools Network и сравните payload/headers.',
      'Добавьте интеграционный тест, покрывающий этот API-маршрут.'
    )
  } else if (error.type === 'network_failure') {
    steps.push(
      'Убедитесь, что целевой хост доступен и DNS/прокси настроены корректно.',
      'Проверьте CORS, TLS-сертификат и блокировки mixed-content.',
      'Добавьте retry/backoff и пользовательское сообщение об ошибке сети.'
    )
  } else if (error.type === 'page_error') {
    steps.push(
      'Локализуйте строку в стек-трейсе, где выброшено исключение.',
      'Добавьте null-check/guard для undefined-значений.',
      'Покройте сценарий e2e-тестом Playwright с перехватом pageerror.'
    )
  } else {
    steps.push(
      'Откройте DevTools Console на проблемной странице и воспроизведите ошибку.',
      'Сопоставьте сообщение консоли с исходником по location/stack.',
      'Исправьте первопричину и добавьте регрессионный тест.'
    )
  }

  return {
    rootCause: `Эвристический анализ (${errorTypeLabel(error.type)}): ${error.message}`,
    affectedModule: error.location?.url ?? error.url,
    severity,
    stepsToFix: steps,
    codeFixSnippet: error.stackTrace
      ? `// Проверьте участок кода из стек-трейса:\n${error.stackTrace.split('\n').slice(0, 5).join('\n')}`
      : undefined
  }
}

export function parseStackTraceResponse(
  rawText: string,
  error: CapturedBrowserError
): Omit<StackTraceAnalysisResult, 'errorId' | 'timestamp'> {
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
  const stepsToFix = normalizeSteps(record.stepsToFix)
  if (stepsToFix.length === 0) {
    throw new Error('Ответ Gemini не содержит stepsToFix.')
  }

  const rootCause = typeof record.rootCause === 'string' ? record.rootCause.trim() : ''
  if (!rootCause) {
    throw new Error('Ответ Gemini не содержит rootCause.')
  }

  return {
    rootCause,
    affectedModule:
      typeof record.affectedModule === 'string' && record.affectedModule.trim()
        ? record.affectedModule.trim()
        : undefined,
    severity: normalizeSeverity(record.severity, error),
    stepsToFix,
    codeFixSnippet:
      typeof record.codeFixSnippet === 'string' && record.codeFixSnippet.trim()
        ? record.codeFixSnippet.trim()
        : undefined
  }
}

/**
 * Analyzes a captured browser error stack trace via Gemini and returns structured fix guidance.
 */
export async function analyzeStackTrace(
  error: CapturedBrowserError,
  projectContext?: ProjectContext
): Promise<StackTraceAnalysisResult> {
  const activeKey = getApiKey()
  if (!activeKey) {
    const msg = 'API-ключ Gemini не задан. Укажите ключ в настройках приложения.'
    loggerService.warn('ai', msg)
    const fallback = buildFallbackAnalysis(error)
    return {
      errorId: error.id,
      ...fallback,
      timestamp: Date.now()
    }
  }

  loggerService.info(
    'ai',
    `AI-анализ стек-трейса [${error.id}] (${errorTypeLabel(error.type)}, модель: ${GEMINI_DEFAULT_MODEL})...`
  )

  const userPrompt = buildStackTracePrompt(error, projectContext)

  try {
    const client = new GoogleGenAI({ apiKey: activeKey })

    const response = await client.models.generateContent({
      model: GEMINI_DEFAULT_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema: STACK_TRACE_JSON_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 4096
      }
    })

    const rawText = response.text?.trim()
    if (!rawText) {
      throw new Error('Google Gemini API вернул пустой ответ при анализе стек-трейса.')
    }

    let normalized: Omit<StackTraceAnalysisResult, 'errorId' | 'timestamp'>
    try {
      normalized = parseStackTraceResponse(rawText, error)
    } catch (parseError) {
      const parseMsg =
        parseError instanceof Error ? parseError.message : 'Ошибка разбора JSON ответа Gemini'
      loggerService.warn('ai', `Fallback анализа стек-трейса (parse): ${parseMsg}`)
      normalized = buildFallbackAnalysis(error)
    }

    const result: StackTraceAnalysisResult = {
      errorId: error.id,
      ...normalized,
      timestamp: Date.now()
    }

    loggerService.success(
      'ai',
      `AI-анализ стек-трейса [${error.id}] завершён: severity=${result.severity}, модуль=${result.affectedModule ?? '—'}`
    )

    return result
  } catch (errorUnknown: unknown) {
    const parsedError = parseGeminiError(errorUnknown)
    loggerService.warn('ai', `Fallback анализа стек-трейса (API): ${parsedError}`)
    const fallback = buildFallbackAnalysis(error)
    return {
      errorId: error.id,
      ...fallback,
      rootCause: `${fallback.rootCause} (Gemini недоступен: ${parsedError})`,
      timestamp: Date.now()
    }
  }
}
