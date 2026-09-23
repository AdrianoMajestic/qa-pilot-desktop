import { GoogleGenAI } from '@google/genai'
import type { FinalQAReport, QASessionData, QualityRadarMetrics } from '@shared/types'
import { GEMINI_DEFAULT_MODEL, getApiKey, parseGeminiError } from './geminiClient'
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

function resolvePlaywrightPassRate(session: QASessionData): number {
  const stats = session.playwright
  if (!stats) {
    return NEUTRAL_SUBSCORE
  }
  const total = stats.totalTests
  const passed = stats.passedTests
  if (total <= 0) {
    return stats.lastRunSuccess === false ? 0 : NEUTRAL_SUBSCORE
  }
  return clampScore((passed / total) * 100)
}

function resolveRuntimeStabilityScore(session: QASessionData): number {
  const errors = session.browserErrors ?? []
  if (errors.length === 0) {
    return 100
  }

  let penalty = 0
  for (const err of errors) {
    switch (err.type) {
      case 'http_error':
        penalty += err.statusCode && err.statusCode >= 500 ? 8 : 5
        break
      case 'network_failure':
        penalty += 4
        break
      case 'console_error':
        penalty += 3
        break
      case 'page_error':
        penalty += 6
        break
      default:
        penalty += 2
    }
  }

  return clampScore(100 - penalty)
}

function resolveCrawlerSuccessRatio(session: QASessionData): number {
  const crawl = session.crawler
  if (!crawl) {
    return NEUTRAL_SUBSCORE
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

  const weighted =
    architecture * WEIGHT_ARCHITECTURE +
    playwright * WEIGHT_PLAYWRIGHT +
    runtime * WEIGHT_RUNTIME +
    crawler * WEIGHT_CRAWLER

  return clampScore(weighted)
}

function computeRadarMetrics(session: QASessionData): QualityRadarMetrics {
  const architecture = session.architecture
  const archScore = resolveArchitectureScore(session)
  const playwrightRate = resolvePlaywrightPassRate(session)
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
  return JSON.stringify(
    {
      projectName: session.projectName ?? 'unknown',
      overallScore,
      radarMetrics: radar,
      criticalIssuesCount,
      architecture: architecture
        ? {
            healthScore: architecture.healthScore,
            untestedHigh: architecture.untestedAreas.filter((a) => a.riskLevel === 'high').length,
            vulnerabilitySamples: architecture.vulnerabilities.slice(0, 5),
            recommendationSamples: architecture.recommendations.slice(0, 5)
          }
        : null,
      playwright: session.playwright ?? null,
      crawler: session.crawler
        ? {
            success: session.crawler.success,
            pagesVisited: session.crawler.pagesVisited,
            errorCount: session.crawler.errors.length
          }
        : null,
      browserErrorSummary: {
        total: session.browserErrors?.length ?? 0,
        http500Plus:
          session.browserErrors?.filter(
            (e) => e.type === 'http_error' && (e.statusCode ?? 0) >= 500
          ).length ?? 0
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
        `Архитектурный анализ: ${high} высокорисковых зон без тестов — приоритизируйте покрытие сервисов и IPC-слоя.`
      )
    } else if (session.architecture.vulnerabilities.length > 0) {
      bullets.push(
        `Безопасность: обнаружено ${session.architecture.vulnerabilities.length} потенциальных уязвимостей — проверьте зависимости и конфигурации.`
      )
    }
  }

  const failedTests =
    session.playwright && session.playwright.totalTests > 0
      ? session.playwright.totalTests - session.playwright.passedTests
      : 0
  if (failedTests > 0) {
    bullets.push(
      `Playwright: ${failedTests} тест(ов) не пройдено — стабилизируйте падающие сценарии перед релизом.`
    )
  }

  const errCount = session.browserErrors?.length ?? 0
  if (errCount > 0) {
    bullets.push(
      `Рантайм: зафиксировано ${errCount} ошибок браузера/сети — устраните HTTP 500+ и необработанные исключения.`
    )
  }

  if (session.crawler && session.crawler.errors.length > 0) {
    bullets.push(
      `Краулер: ${session.crawler.errors.length} сбоев обхода — проверьте маршруты и доступность страниц.`
    )
  }

  if (bullets.length < 3) {
    bullets.push(
      'Поддерживайте текущий уровень качества: регулярно запускайте Playwright и AI-аудит архитектуры.'
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
  const apiKey = getApiKey()
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

  const systemInstruction = `You are a QA release manager. Given aggregated QA metrics JSON, produce 3-5 concise bullet points in Russian highlighting the most critical issues and immediate fixes. Output JSON only.`

  try {
    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: GEMINI_DEFAULT_MODEL,
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
    const parsed = parseGeminiError(error)
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

  const sections: string[] = []

  sections.push(`# Отчёт QA-аудита: ${projectName}`)
  sections.push(`*Дата генерации:* ${dateStr}\n`)
  sections.push(`## 📊 Сводные показатели качества`)
  sections.push(`- **Совокупный скоринг надежности:** ${overallScore}/100`)
  sections.push(`- **Количество критических сигналов:** ${criticalIssuesCount}`)
  sections.push(`- **Зафиксировано сбоев браузера/сети:** ${errors.length}`)

  sections.push(`\n## 🤖 Выводы и рекомендации Gemini AI (Executive Summary)`)
  if (executiveSummary.length > 0) {
    for (const item of executiveSummary) {
      sections.push(`- ${item}`)
    }
  } else {
    sections.push('- Критических замечаний не выявлено.')
  }

  if (arch) {
    sections.push(`\n## 🏗 Архитектурный анализ исходного кода`)
    sections.push(`- **Оценка здоровья архитектуры:** ${arch.healthScore}/100`)
    if (arch.untestedAreas && arch.untestedAreas.length > 0) {
      sections.push(`\n### Непокрытые тестами модули:`)
      for (const area of arch.untestedAreas) {
        sections.push(`- \`${area.path}\` [${area.riskLevel.toUpperCase()}]: ${area.reason}`)
      }
    }
    if (arch.vulnerabilities && arch.vulnerabilities.length > 0) {
      sections.push(`\n### Потенциальные риски и уязвимости:`)
      for (const v of arch.vulnerabilities) {
        sections.push(`- ⚠️ ${v}`)
      }
    }
    if (arch.recommendations && arch.recommendations.length > 0) {
      sections.push(`\n### Рекомендации QA-инженера:`)
      for (const rec of arch.recommendations) {
        sections.push(`- 💡 ${rec}`)
      }
    }
  }

  if (crawl) {
    sections.push(`\n## 🌐 Результаты автоматического обхода Playwright`)
    sections.push(`- **Целевой URL:** ${crawl.startUrl}`)
    sections.push(`- **Посещено страниц:** ${crawl.pagesVisited}`)
    sections.push(`- **Обнаружено форм / полей ввода:** ${crawl.totalForms} / ${crawl.totalInputs}`)
    sections.push(`- **Ошибок в ходе обхода:** ${crawl.errors.length}`)
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

