import React, { useMemo, useState } from 'react'
import type { DashboardOverviewProps, OverallScoreData, HealthRadarData } from '../types'
import { OverallScoreWidget } from './OverallScoreWidget'
import { HealthRadarWidget } from './HealthRadarWidget'
import { mapFinalReportToHealthRadar, mapFinalReportToOverallScore } from '../utils/qaReportMapping'

const defaultOverallScoreMock: OverallScoreData = {
  score: 86,
  title: 'Совокупный скоринг качества',
  subtitle: 'Агрегированная оценка надежности, безопасности и покрытия',
  grade: 'A',
  statusLabel: 'Отличный уровень',
  trend: {
    value: 4.8,
    direction: 'up',
    label: 'Динамика к прошлому аудиту'
  },
  breakdown: {
    passed: 27,
    warnings: 3,
    failed: 1
  }
}

const defaultHealthRadarMock: HealthRadarData = {
  title: 'Health Radar — Мультиосевой анализ',
  subtitle: 'Оценка 6 ключевых векторов качества и архитектурной надежности',
  benchmarkLabel: 'Целевой порог (80%)',
  currentLabel: 'Текущие показатели',
  metrics: [
    {
      key: 'coverage',
      label: 'Покрытие кода',
      value: 82,
      benchmark: 80,
      description: 'Покрытие строк и ветвлений unit- и e2e-тестами Playwright.'
    },
    {
      key: 'ai_insights',
      label: 'AI Анализ',
      value: 88,
      benchmark: 75,
      description:
        'Эвристическая оценка архитектурных связей и потенциальных регрессий моделью Gemini.'
    },
    {
      key: 'security',
      label: 'Безопасность',
      value: 94,
      benchmark: 85,
      description: 'Отсутствие известных CVE в зависимостях и строгая изоляция контекста IPC.'
    },
    {
      key: 'dependencies',
      label: 'Здоровье зависимостей',
      value: 78,
      benchmark: 80,
      description: 'Актуальность pnpm-пакетов и отсутствие циклических зависимостей.'
    },
    {
      key: 'runtime_stability',
      label: 'Стабильность рантайма',
      value: 91,
      benchmark: 85,
      description: 'Нулевой уровень необработанных исключений и стабильность Playwright воркеров.'
    },
    {
      key: 'test_success',
      label: 'Успешность тестов',
      value: 96,
      benchmark: 90,
      description: 'Доля успешно завершенных автоматических сценариев (27 из 28 тестов).'
    }
  ]
}

// Additional mock presets to test dynamic thresholds (<50 red, 50-79 amber, 80+ emerald)
const mockPresets: Record<string, { score: OverallScoreData; radar: HealthRadarData }> = {
  optimal: {
    score: defaultOverallScoreMock,
    radar: defaultHealthRadarMock
  },
  warning: {
    score: {
      score: 68,
      title: 'Совокупный скоринг качества',
      subtitle: 'Обнаружены просадки в покрытии и устаревшие пакеты',
      grade: 'B',
      statusLabel: 'Требует внимания',
      trend: {
        value: 3.2,
        direction: 'down',
        label: 'Снижение к прошлому аудиту'
      },
      breakdown: {
        passed: 20,
        warnings: 7,
        failed: 3
      }
    },
    radar: {
      title: 'Health Radar — Мультиосевой анализ',
      subtitle: 'Профиль качества: предупреждения по безопасности и покрытию',
      benchmarkLabel: 'Целевой порог (80%)',
      currentLabel: 'Текущие показатели',
      metrics: [
        {
          key: 'coverage',
          label: 'Покрытие кода',
          value: 58,
          benchmark: 80,
          description: 'Снижение покрытия нового функционала.'
        },
        {
          key: 'ai_insights',
          label: 'AI Анализ',
          value: 72,
          benchmark: 75,
          description: 'Gemini выявил дублирование логики в компонентах.'
        },
        {
          key: 'security',
          label: 'Безопасность',
          value: 65,
          benchmark: 85,
          description: 'Найдены умеренные предупреждения npm audit.'
        },
        {
          key: 'dependencies',
          label: 'Здоровье зависимостей',
          value: 54,
          benchmark: 80,
          description: '3 мажорных обновления требуют миграции.'
        },
        {
          key: 'runtime_stability',
          label: 'Стабильность рантайма',
          value: 80,
          benchmark: 85,
          description: 'Зафиксирован таймаут одного воркера.'
        },
        {
          key: 'test_success',
          label: 'Успешность тестов',
          value: 79,
          benchmark: 90,
          description: '20 из 28 тестов завершились успехом.'
        }
      ]
    }
  },
  critical: {
    score: {
      score: 42,
      title: 'Совокупный скоринг качества',
      subtitle: 'Критические сбои: регрессия тестов и уязвимости',
      grade: 'C-',
      statusLabel: 'Критический уровень',
      trend: {
        value: 14.5,
        direction: 'down',
        label: 'Резкое падение качества'
      },
      breakdown: {
        passed: 12,
        warnings: 6,
        failed: 10
      }
    },
    radar: {
      title: 'Health Radar — Мультиосевой анализ',
      subtitle: 'Критическое состояние: множественные точки отказа',
      benchmarkLabel: 'Целевой порог (80%)',
      currentLabel: 'Текущие показатели',
      metrics: [
        {
          key: 'coverage',
          label: 'Покрытие кода',
          value: 38,
          benchmark: 80,
          description: 'Критически низкое покрытие тестами.'
        },
        {
          key: 'ai_insights',
          label: 'AI Анализ',
          value: 45,
          benchmark: 75,
          description: 'Выявлены архитектурные аномалии и утечки.'
        },
        {
          key: 'security',
          label: 'Безопасность',
          value: 40,
          benchmark: 85,
          description: 'Критические уязвимости в транзитивных зависимостях.'
        },
        {
          key: 'dependencies',
          label: 'Здоровье зависимостей',
          value: 35,
          benchmark: 80,
          description: 'Конфликты версий и устаревшие библиотеки.'
        },
        {
          key: 'runtime_stability',
          label: 'Стабильность рантайма',
          value: 48,
          benchmark: 85,
          description: 'Частые падения браузерного процесса воркеров.'
        },
        {
          key: 'test_success',
          label: 'Успешность тестов',
          value: 46,
          benchmark: 90,
          description: '10 упавших тестов из 28 запланированных.'
        }
      ]
    }
  }
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  overallScore: propScore,
  healthRadar: propRadar,
  finalReport,
  isGeneratingReport = false,
  onGenerateReport,
  className = ''
}) => {
  const [selectedPreset, setSelectedPreset] = useState<'optimal' | 'warning' | 'critical'>(
    'optimal'
  )

  const reportScore = useMemo(
    () => (finalReport ? mapFinalReportToOverallScore(finalReport) : undefined),
    [finalReport]
  )
  const reportRadar = useMemo(
    () => (finalReport ? mapFinalReportToHealthRadar(finalReport) : undefined),
    [finalReport]
  )

  const hasLiveReport = Boolean(finalReport)
  const currentScore = reportScore ?? propScore ?? mockPresets[selectedPreset].score
  const currentRadar = reportRadar ?? propRadar ?? mockPresets[selectedPreset].radar

  return (
    <section className={`space-y-4 ${className}`} aria-label="Визуальный дашборд качества">
      {/* Visual Dashboard Header & Scenario Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800/80 rounded-xl px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-950/70 border border-indigo-800/60 text-indigo-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100">
                Визуальный дашборд метрик качества
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                SVG Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Комплексный мониторинг стабильности, покрытия и AI-аналитики проекта в реальном
              времени
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onGenerateReport && (
            <button
              type="button"
              onClick={onGenerateReport}
              disabled={isGeneratingReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGeneratingReport ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Формирование отчёта...
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 17v-2m3 2v-4m3 4v-6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Сформировать QA-отчёт
                </>
              )}
            </button>
          )}

          {/* Demo Preset Buttons — hidden when live report is active */}
          {!hasLiveReport && !propScore && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-500 px-1 font-medium">Тестовый срез:</span>
              <button
                onClick={() => setSelectedPreset('optimal')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  selectedPreset === 'optimal'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                86% Оптимально
              </button>
              <button
                onClick={() => setSelectedPreset('warning')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  selectedPreset === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                68% Внимание
              </button>
              <button
                onClick={() => setSelectedPreset('critical')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  selectedPreset === 'critical'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                42% Критично
              </button>
            </div>
          )}
        </div>
      </div>

      {hasLiveReport && finalReport && (
        <div className="rounded-xl bg-slate-900 border border-indigo-800/40 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Executive Summary</h3>
            <span className="text-[10px] font-mono text-slate-500">
              {new Date(finalReport.generatedAt).toLocaleString('ru-RU')}
            </span>
          </div>
          <ul className="space-y-2">
            {finalReport.executiveSummary.map((bullet, index) => (
              <li
                key={`${index}-${bullet.slice(0, 24)}`}
                className="flex gap-2 text-xs text-slate-300 leading-relaxed"
              >
                <span className="text-indigo-400 shrink-0">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="text-[11px] text-slate-500">
            Критических сигналов:{' '}
            <span className="text-rose-400 font-mono">{finalReport.criticalIssuesCount}</span>
          </div>
        </div>
      )}

      {/* Widgets Grid: OverallScoreWidget (Radial Gauge) + HealthRadarWidget (Spider Chart) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-5 flex flex-col">
          <OverallScoreWidget data={currentScore} className="h-full" />
        </div>

        <div className="xl:col-span-7 flex flex-col">
          <HealthRadarWidget data={currentRadar} className="h-full" />
        </div>
      </div>
    </section>
  )
}
