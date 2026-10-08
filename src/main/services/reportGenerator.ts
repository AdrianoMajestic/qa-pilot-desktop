import { GoogleGenAI } from '@google/genai'
import type { FinalQAReport, QASessionData, QualityRadarMetrics } from '@shared/types'
import { getApiKey, parseGeminiError } from './geminiClient'
import { getSettings } from './settingsStore'
import { loggerService } from './loggerService'

const NEUTRAL_SUBSCORE = 75

const WEIGHT_ARCHITECTURE = 0.3
const WEIGHT_PLAYWRIGHT = 0.3
const WEIGHT_RUNTIME = 0.2
const WEIGHT_CRAWLER = 0.2

const EXECUTIVE_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    executiveSummary: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 5
    }
  },
  required: ['executiveSummary']
} as const

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round(value)))
}

function resolveArchitectureScore(session: QASessionData): number {
  if (session.architecture?.healthScore !== undefined) {
    return clampScore(session.architecture.healthScore)
  }
  return NEUTRAL_SUBSCORE
}

function resolvePlaywrightPassRate(session: QASessionData): number | null {
  const stats = session.playwright
  if (!stats || stats.totalTests === undefined) {
    return null
  }
  const total = stats.totalTests
  const passed = stats.passedTests
  if (total <= 0) {
    return stats.lastRunSuccess === false ? 0 : null
  }
  return clampScore((passed / total) * 100)
}

function resolveRuntimeStabilityScore(session: QASessionData): number {
  const errors = session.browserErrors ?? []
  if (errors.length === 0) {
    // 0 browser errors MUST equal 100% score (full points) for runtime stability
    return 100
  }

  let penalty = 0
  for (const err of errors) {
    switch (err.type) {
      case 'http_error':
        // HTTP 500+ = heavy server crash penalty, 4xx = medium penalty
        penalty += err.statusCode && err.statusCode >= 500 ? 15 : 6
        break
      case 'network_failure':
        // Connection refused / DNS drops
        penalty += 8
        break
      case 'page_error':
        // Uncaught exceptions / crashes
        penalty += 12
        break
      case 'console_error':
        // JS console error
        penalty += 4
        break
      default:
        // Minor warnings / notices
        penalty += 2
    }
  }

  return clampScore(100 - penalty)
}

function resolveCrawlerSuccessRatio(session: QASessionData): number | null {
  const crawl = session.crawler
  if (!crawl) {
    return null
  }

  const visited = crawl.pagesVisited
  if (visited <= 0) {
    return crawl.success ? NEUTRAL_SUBSCORE : 40
  }

  const pagesWithErrors = crawl.pages.filter((p) => p.errors.length > 0).length
  const cleanPages = Math.max(0, visited - pagesWithErrors)
  const sessionErrors = crawl.errors.length
  const ratioScore = (cleanPages / visited) * 100
  const errorPenalty = Math.min(30, sessionErrors * 5)

  return clampScore(ratioScore - errorPenalty)
}

function computeOverallScore(session: QASessionData): number {
  const architecture = resolveArchitectureScore(session)
  const playwright = resolvePlaywrightPassRate(session)
  const runtime = resolveRuntimeStabilityScore(session)
  const crawler = resolveCrawlerSuccessRatio(session)

  // Dynamic weight normalization:
  // If Playwright tests were not run, or Crawler was not run, scale available axes to 100%
  // Baseline nominal weights: Architecture: 0.35, Playwright: 0.30, Runtime: 0.20, Crawler: 0.15
  let totalWeight = 0
  let weightedSum = 0

  // 1. Architecture is always present (or has fallback neutral score)
  const archWeight = 0.35
  weightedSum += architecture * archWeight
  totalWeight += archWeight

  // 2. Runtime stability is always tracked (0 errors = 100%)
  const runtimeWeight = 0.25
  weightedSum += runtime * runtimeWeight
  totalWeight += runtimeWeight

  // 3. Playwright (if specs/runs exist)
  if (playwright !== null) {
    const playWeight = 0.25
    weightedSum += playwright * playWeight
    totalWeight += playWeight
  }

  // 4. Crawler (if executed)
  if (crawler !== null) {
    const crawlWeight = 0.15
    weightedSum += crawler * crawlWeight
    totalWeight += crawlWeight
  }

  // Normalize so score is strictly out of 100
  const normalized = totalWeight > 0 ? weightedSum / totalWeight : 100
  return clampScore(normalized)
}

function computeRadarMetrics(session: QASessionData): QualityRadarMetrics {
  const architecture = session.architecture
  const archScore = resolveArchitectureScore(session)
  const playwrightRate = resolvePlaywrightPassRate(session) ?? NEUTRAL_SUBSCORE
  const runtimeScore = resolveRuntimeStabilityScore(session)

  const highRisk = architecture?.untestedAreas.filter((a) => a.riskLevel === 'high').length ?? 0
  const mediumRisk = architecture?.untestedAreas.filter((a) => a.riskLevel === 'medium').length ?? 0
  const lowRisk = architecture?.untestedAreas.filter((a) => a.riskLevel === 'low').length ?? 0

  const coveragePenalty = highRisk * 12 + mediumRisk * 6 + lowRisk * 3
  const codeCoverage = clampScore(archScore - coveragePenalty)

  const vulnCount = architecture?.vulnerabilities.length ?? 0
  const security = clampScore(archScore - vulnCount * 7)

  const dependencyHealth = clampScore(
    architecture ? archScore * 0.85 + (100 - highRisk * 10) * 0.15 : NEUTRAL_SUBSCORE
  )

  return {
    codeCoverage,
    aiInsights: archScore,
    security,
    dependencyHealth,
    runtimeStability: runtimeScore,
    testSuccess: playwrightRate
  }
}

function countCriticalIssues(session: QASessionData): number {
  let count = 0
  const architecture = session.architecture
  if (architecture) {
    count += architecture.untestedAreas.filter((a) => a.riskLevel === 'high').length
    count += architecture.vulnerabilities.length
  }

  const errors = session.browserErrors ?? []
  count += errors.filter(
    (e) =>
      e.type === 'page_error' ||
      e.type === 'http_error' ||
      (e.type === 'network_failure' && e.failureText?.includes('REFUSED'))
  ).length

  const stats = session.playwright
  if (stats && stats.totalTests > 0) {
    count += Math.max(0, stats.totalTests - stats.passedTests)
  } else if (stats?.lastRunSuccess === false) {
    count += 1
  }

  if (session.crawler && !session.crawler.success && session.crawler.errors.length > 0) {
    count += Math.min(3, session.crawler.errors.length)
  }

  return count
}

function buildAggregatedMetricsPayload(
  session: QASessionData,
  overallScore: number,
  radar: QualityRadarMetrics,
  criticalIssuesCount: number
): string {
  const architecture = session.architecture
  const browserErrors = session.browserErrors ?? []
  const playwright = session.playwright
  const crawler = session.crawler

  return JSON.stringify(
    {
      projectName: session.projectName ?? 'unknown',
      overallScore,
      radarMetrics: radar,
      criticalIssuesCount,
      architectureStatus: architecture
        ? {
            healthScore: architecture.healthScore,
            untestedHighRiskCount: architecture.untestedAreas.filter((a) => a.riskLevel === 'high').length,
            untestedMediumRiskCount: architecture.untestedAreas.filter((a) => a.riskLevel === 'medium').length,
            vulnerabilitiesCount: architecture.vulnerabilities.length,
            vulnerabilitySamples: architecture.vulnerabilities.slice(0, 5),
            recommendationSamples: architecture.recommendations.slice(0, 5)
          }
        : 'Архитектурный анализ исходного кода не проводился',
      playwrightStatus:
        playwright && playwright.totalTests > 0
          ? {
              totalTests: playwright.totalTests,
              passedTests: playwright.passedTests,
              failedTests: playwright.failedTests,
              successRate: `${Math.round((playwright.passedTests / playwright.totalTests) * 100)}%`,
              lastRunSuccess: playwright.lastRunSuccess
            }
          : 'Playwright тесты в проекте не запускались (пропуск оценки Playwright, вес распределен между архитектурой и рантаймом)',
      crawlerStatus: crawler
        ? {
            startUrl: crawler.startUrl,
            success: crawler.success,
            pagesVisited: crawler.pagesVisited,
            totalForms: crawler.totalForms,
            totalInputs: crawler.totalInputs,
            errorsCount: crawler.errors.length,
            statusText:
              crawler.errors.length === 0
                ? 'Автоматический обход завершен успешно: битых ссылок и сбоев страниц не обнаружено'
                : `Обнаружено ошибок обхода: ${crawler.errors.length}`
          }
        : 'Краулер страниц не запускался в этой сессии',
      runtimeErrorStatus: {
        totalCapturedErrors: browserErrors.length,
        http500ServerErrors: browserErrors.filter((e) => e.type === 'http_error' && (e.statusCode ?? 0) >= 500).length,
        networkFailures: browserErrors.filter((e) => e.type === 'network_failure').length,
        uncaughtPageExceptions: browserErrors.filter((e) => e.type === 'page_error').length,
        consoleErrors: browserErrors.filter((e) => e.type === 'console_error').length,
        diagnosticMessage:
          browserErrors.length === 0
            ? 'Ошибок в консоли браузера, сетевых сбоев и HTTP 500+ не обнаружено (100% стабильность рантайма)'
            : `Зафиксировано ${browserErrors.length} сбоев рантайма. Требуется исправление сетевых ошибок и исключений.`
      }
    },
    null,
    2
  )
}

function buildFallbackExecutiveSummary(
  session: QASessionData,
  overallScore: number,
  criticalIssuesCount: number
): string[] {
  const bullets: string[] = []

  bullets.push(
    `Совокупный QA Score: ${overallScore}/100 (${criticalIssuesCount} критических сигналов в текущей сессии).`
  )

  if (session.architecture) {
    const high = session.architecture.untestedAreas.filter((a) => a.riskLevel === 'high').length
    if (high > 0) {
      bullets.push(
        `Архитектурный анализ: ${high} высокорисковых зон без тестов — приоритизируйте покрытие ключевых сервисов.`
      )
    } else if (session.architecture.vulnerabilities.length > 0) {
      bullets.push(
        `Безопасность: обнаружено ${session.architecture.vulnerabilities.length} потенциальных уязвимостей — проверьте конфигурации и зависимости.`
      )
    } else {
      bullets.push(
        'Архитектура стабильна: критических структурных дефектов и уязвимостей в кодовой базе не обнаружено.'
      )
    }
  }

  const failedTests =
    session.playwright && session.playwright.totalTests > 0
      ? session.playwright.totalTests - session.playwright.passedTests
      : 0
  if (failedTests > 0) {
    bullets.push(
      `Playwright: ${failedTests} тест(ов) не пройдено — устраните сбои тестовых сценариев перед релизом.`
    )
  }

  const errCount = session.browserErrors?.length ?? 0
  if (errCount > 0) {
    bullets.push(
      `Рантайм: зафиксировано ${errCount} ошибок браузера/сети — устраните HTTP 500+ и необработанные исключения.`
    )
  } else {
    bullets.push(
      'Рантайм стабилен: ошибок в консоли браузера, сетевых сбоев и HTTP 500+ не зафиксировано (100% стабильность).'
    )
  }

  if (session.crawler && session.crawler.errors.length > 0) {
    bullets.push(
      `Краулер: ${session.crawler.errors.length} сбоев обхода — проверьте доступность страниц и маршрутов.`
    )
  }

  if (bullets.length < 3) {
    bullets.push(
      'Рекомендация: поддерживайте текущий уровень качества, регулярно запуская авто-тесты и аудит архитектуры.'
    )
  }

  return bullets.slice(0, 5)
}

async function generateExecutiveSummary(
  session: QASessionData,
  overallScore: number,
  radar: QualityRadarMetrics,
  criticalIssuesCount: number
): Promise<string[]> {
  const settings = getSettings()
  const apiKey = settings.geminiApiKey?.trim() || getApiKey()
  const model = settings.geminiModel || 'gemini-1.5-flash'

  if (!apiKey) {
    loggerService.warn(
      'ai',
      'Gemini API-ключ не задан — используется локальный executive summary без LLM.'
    )
    return buildFallbackExecutiveSummary(session, overallScore, criticalIssuesCount)
  }

  const metricsJson = buildAggregatedMetricsPayload(
    session,
    overallScore,
    radar,
    criticalIssuesCount
  )

  const systemInstruction = `You are a Senior QA Release Manager and Systems Architect. Given aggregated QA metrics JSON, produce 3-5 concise, factual bullet points in Russian highlighting the overall quality, key risks (or noting their absence if clean), and immediate action items. Never hallucinate bugs when metrics indicate 0 errors or clean states. Output JSON only according to the specified schema.`

  try {
    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: settings.geminiModel || 'gemini-1.5-flash',
      contents: `Сформируй executive summary для итогового QA-отчёта на основе метрик:\n\n${metricsJson}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseJsonSchema: EXECUTIVE_SUMMARY_SCHEMA,
        temperature: 0.3,
        maxOutputTokens: 2048
      }
    })

    const raw = response.text?.trim()
    if (!raw) {
      throw new Error('Пустой ответ Gemini при генерации executive summary.')
    }

    const parsed = JSON.parse(raw) as { executiveSummary?: unknown }
    if (!Array.isArray(parsed.executiveSummary)) {
      throw new Error('Неверная структура executiveSummary.')
    }

    const bullets = parsed.executiveSummary
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((s) => s.trim())
      .slice(0, 5)

    if (bullets.length < 3) {
      return buildFallbackExecutiveSummary(session, overallScore, criticalIssuesCount)
    }

    return bullets
  } catch (error) {
    const parsed = parseGeminiError(error, model)
    loggerService.warn('ai', `Fallback executive summary (Gemini): ${parsed}`)
    return buildFallbackExecutiveSummary(session, overallScore, criticalIssuesCount)
  }
}

function formatReportMarkdown(
  sessionData: QASessionData,
  overallScore: number,
  criticalIssuesCount: number,
  executiveSummary: string[]
): string {
  const dateStr = new Date().toLocaleString('ru-RU')
  const projectName = sessionData.projectName || 'Текущий проект'
  const arch = sessionData.architecture
  const crawl = sessionData.crawler
  const errors = sessionData.browserErrors || []
  const playwright = sessionData.playwright

  const sections: string[] = []

  sections.push(`# Отчёт QA-аудита: ${projectName}`)
  sections.push(`*Дата генерации:* ${dateStr}\n`)

  // Section 1: 📊 Итоговая оценка и сводка
  sections.push(`## 📊 Итоговая оценка и сводка`)
  sections.push(`- **Совокупный QA Health Score:** ${overallScore}/100`)
  sections.push(`- **Количество критических сигналов:** ${criticalIssuesCount}`)
  sections.push(
    `- **Рантайм-стабильность:** ${
      errors.length === 0
        ? '100% (Ошибок в консоли браузера, сетевых сбоев и HTTP 500+ не обнаружено)'
        : `${errors.length} зафиксированных сбоев браузера/сети`
    }`
  )
  if (playwright && playwright.totalTests > 0) {
    sections.push(
      `- **Playwright тесты:** ${playwright.passedTests}/${playwright.totalTests} пройдено (${Math.round((playwright.passedTests / playwright.totalTests) * 100)}%)`
    )
  } else {
    sections.push(
      `- **Playwright тесты:** Не запускались в этой сессии (вес динамически распределен)`
    )
  }
  if (crawl) {
    sections.push(
      `- **Обход краулера:** ${crawl.pagesVisited} страниц, ${crawl.totalForms} форм (ошибок: ${crawl.errors.length})`
    )
  }
  if (executiveSummary.length > 0) {
    sections.push(`\n**Ключевые выводы:**`)
    for (const item of executiveSummary) {
      sections.push(`- ${item}`)
    }
  }

  // Section 2: 🚨 Критические риски и уязвимости
  sections.push(`\n## 🚨 Критические риски и уязвимости`)
  const criticalItems: string[] = []
  if (arch?.vulnerabilities && arch.vulnerabilities.length > 0) {
    for (const v of arch.vulnerabilities) {
      criticalItems.push(`- ⚠️ **Уязвимость:** ${v}`)
    }
  }
  const highRiskAreas = arch?.untestedAreas?.filter((a) => a.riskLevel === 'high') ?? []
  if (highRiskAreas.length > 0) {
    for (const area of highRiskAreas) {
      criticalItems.push(`- ⚠️ **Высокорисковая зона без тестов:** \`${area.path}\` — ${area.reason}`)
    }
  }
  const http500Errors = errors.filter((e) => e.type === 'http_error' && (e.statusCode ?? 0) >= 500)
  if (http500Errors.length > 0) {
    criticalItems.push(`- ⚠️ **Критические серверные ошибки (HTTP 500+):** зафиксировано ${http500Errors.length}`)
  }
  const pageCrashes = errors.filter((e) => e.type === 'page_error')
  if (pageCrashes.length > 0) {
    criticalItems.push(`- ⚠️ **Неперехваченные исключения страниц:** зафиксировано ${pageCrashes.length}`)
  }

  if (criticalItems.length > 0) {
    for (const item of criticalItems) {
      sections.push(item)
    }
  } else {
    sections.push(`- ✅ Критических рисков и уязвимостей не обнаружено. Кодовая база и рантайм находятся в стабильном состоянии.`)
  }

  // Section 3: 🔍 Анализ архитектуры и покрытия
  sections.push(`\n## 🔍 Анализ архитектуры и покрытия`)
  if (arch) {
    sections.push(`- **Оценка здоровья архитектуры:** ${arch.healthScore}/100`)
    if (arch.untestedAreas && arch.untestedAreas.length > 0) {
      sections.push(`\n### Непокрытые модули:`)
      for (const area of arch.untestedAreas) {
        sections.push(`- \`${area.path}\` [${area.riskLevel.toUpperCase()}]: ${area.reason}`)
      }
    } else {
      sections.push(`- Все ключевые модули покрыты тестами или имеют достаточную изоляцию.`)
    }
  } else {
    sections.push(`- Архитектурный анализ исходного кода не запускался.`)
  }

  // Section 4: 🛠️ Пошаговый план улучшения QA
  sections.push(`\n## 🛠️ Пошаговый план улучшения QA`)
  const actionPlan: string[] = []
  if (arch?.recommendations && arch.recommendations.length > 0) {
    for (const rec of arch.recommendations) {
      actionPlan.push(`- 💡 ${rec}`)
    }
  }
  if (!playwright || playwright.totalTests === 0) {
    actionPlan.push(`- 🧪 **Внедрить E2E тесты:** Создайте Playwright spec-тесты для критических пользовательских сценариев.`)
  } else if (playwright.failedTests > 0) {
    actionPlan.push(`- 🔧 **Стабилизация упавших тестов:** Локализуйте и устраните причины сбоя ${playwright.failedTests} тестов Playwright.`)
  }
  if (errors.length > 0) {
    actionPlan.push(`- 🛡️ **Устранение ошибок рантайма:** Проверьте стек-трейсы ${errors.length} зафиксированных сбоев браузера.`)
  }
  if (actionPlan.length === 0) {
    actionPlan.push(`- 🚀 Продолжайте мониторинг при каждом PR и регулярно запускайте авто-краулер перед релизами.`)
  }
  for (const step of actionPlan) {
    sections.push(step)
  }

  return sections.join('\n')
}

/**
 * Aggregates session signals into weighted Overall QA Score, radar metrics, and Gemini executive summary.
 */
export async function generateFinalQAReport(sessionData: QASessionData): Promise<FinalQAReport> {
  loggerService.info(
    'ai',
    `Формирование итогового QA-отчёта${sessionData.projectName ? `: «${sessionData.projectName}»` : ''}...`
  )

  const radarMetrics = computeRadarMetrics(sessionData)
  const overallScore = computeOverallScore(sessionData)
  const criticalIssuesCount = countCriticalIssues(sessionData)

  const executiveSummary = await generateExecutiveSummary(
    sessionData,
    overallScore,
    radarMetrics,
    criticalIssuesCount
  )

  const analysisMarkdown = formatReportMarkdown(
    sessionData,
    overallScore,
    criticalIssuesCount,
    executiveSummary
  )

  const report: FinalQAReport = {
    overallScore,
    radarMetrics,
    executiveSummary,
    criticalIssuesCount,
    generatedAt: Date.now(),
    analysisMarkdown
  }

  loggerService.success(
    'ai',
    `Итоговый QA-отчёт готов: overallScore=${overallScore}, criticalIssues=${criticalIssuesCount}`
  )

  return report
}

