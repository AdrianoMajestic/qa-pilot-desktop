import type {
  FinalQAReport,
  OverallScoreData,
  HealthRadarData,
  PlaywrightSessionStats
} from '../types'

export function playwrightStatsFromSuites(
  suites: { totalTests: number; passedTests: number }[]
): PlaywrightSessionStats {
  const totalTests = suites.reduce((sum, s) => sum + s.totalTests, 0)
  const passedTests = suites.reduce((sum, s) => sum + s.passedTests, 0)
  return {
    totalTests,
    passedTests,
    failedTests: Math.max(0, totalTests - passedTests)
  }
}

export function mapFinalReportToOverallScore(report: FinalQAReport): OverallScoreData {
  const failed = Math.min(10, report.criticalIssuesCount)
  const warnings = Math.min(5, Math.max(0, Math.ceil(report.criticalIssuesCount / 2) - failed))
  const passed = Math.max(0, 10 - failed - warnings)

  return {
    score: report.overallScore,
    title: 'Совокупный скоринг качества',
    subtitle: 'Агрегированная оценка архитектуры, тестов, краулера и стабильности рантайма',
    trend: {
      value: 0,
      direction: 'neutral',
      label: 'Текущая сессия QA Pilot'
    },
    breakdown: {
      passed,
      warnings,
      failed
    }
  }
}

export function mapFinalReportToHealthRadar(report: FinalQAReport): HealthRadarData {
  const m = report.radarMetrics
  return {
    title: 'Health Radar — Мультиосевой анализ',
    subtitle: 'Метрики из итогового QA-отчёта (Main process aggregator)',
    benchmarkLabel: 'Целевой порог (80%)',
    currentLabel: 'Текущие показатели',
    metrics: [
      {
        key: 'coverage',
        label: 'Покрытие кода',
        value: m.codeCoverage,
        benchmark: 80,
        description: 'Оценка покрытия с учётом нетестированных зон из AI-анализа архитектуры.'
      },
      {
        key: 'ai_insights',
        label: 'AI Анализ',
        value: m.aiInsights,
        benchmark: 75,
        description: 'Health score архитектурного аудита Gemini.'
      },
      {
        key: 'security',
        label: 'Безопасность',
        value: m.security,
        benchmark: 85,
        description: 'Штрафы за выявленные уязвимости и риски в зависимостях/конфигах.'
      },
      {
        key: 'dependencies',
        label: 'Здоровье зависимостей',
        value: m.dependencyHealth,
        benchmark: 80,
        description: 'Комбинированная оценка здоровья зависимостей и архитектуры.'
      },
      {
        key: 'runtime_stability',
        label: 'Стабильность рантайма',
        value: m.runtimeStability,
        benchmark: 85,
        description: 'Штрафы за HTTP 500+, сетевые сбои и ошибки консоли/страниц.'
      },
      {
        key: 'test_success',
        label: 'Успешность тестов',
        value: m.testSuccess,
        benchmark: 90,
        description: 'Доля успешно пройденных тестов Playwright в текущей сессии.'
      }
    ]
  }
}
