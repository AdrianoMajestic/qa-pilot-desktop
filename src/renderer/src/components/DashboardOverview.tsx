import React, { useMemo } from 'react'
import type { DashboardOverviewProps } from '../types'
import { OverallScoreWidget } from './OverallScoreWidget'
import { HealthRadarWidget } from './HealthRadarWidget'
import { mapFinalReportToHealthRadar, mapFinalReportToOverallScore } from '../utils/qaReportMapping'

/**
 * Clean Visual Quality Overview component.
 * Renders real OverallScore & HealthRadar widgets ONLY when a real FinalQAReport is provided.
 * All fake mocks, hardcoded presets, and demo switcher buttons have been purged.
 */
export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  finalReport,
  className = ''
}) => {
  const reportScore = useMemo(
    () => (finalReport ? mapFinalReportToOverallScore(finalReport) : null),
    [finalReport]
  )
  const reportRadar = useMemo(
    () => (finalReport ? mapFinalReportToHealthRadar(finalReport) : null),
    [finalReport]
  )

  if (!finalReport || !reportScore || !reportRadar) {
    return null
  }

  return (
    <section className={`space-y-4 ${className}`} aria-label="Визуальный дашборд качества">
      <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800/80 rounded-xl px-5 py-3 shadow-sm">
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
            <h3 className="text-sm font-semibold text-slate-100">Метрики качества и Health Radar</h3>
            <p className="text-xs text-slate-400">
              Построено на основе фактических данных сессии QA и Gemini-анализа
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-indigo-950/60 border border-indigo-700/60 text-indigo-300">
          Скор: {finalReport.overallScore}/100
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-5 flex flex-col">
          <OverallScoreWidget data={reportScore} className="h-full" />
        </div>
        <div className="xl:col-span-7 flex flex-col">
          <HealthRadarWidget data={reportRadar} className="h-full" />
        </div>
      </div>
    </section>
  )
}
