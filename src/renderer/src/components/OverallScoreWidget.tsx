import React from 'react'
import type { OverallScoreWidgetProps } from '../types'

interface ScoreThresholdConfig {
  category: 'good' | 'warning' | 'critical'
  strokeColor: string
  gradientStart: string
  gradientEnd: string
  glowColor: string
  badgeBg: string
  badgeBorder: string
  badgeText: string
  statusLabel: string
  grade: string
  dotColor: string
  description: string
}

const getScoreThresholdConfig = (score: number): ScoreThresholdConfig => {
  if (score >= 80) {
    return {
      category: 'good' as const,
      strokeColor: '#10b981', // emerald-500
      gradientStart: '#34d399', // emerald-400
      gradientEnd: '#059669', // emerald-600
      glowColor: 'rgba(16, 185, 129, 0.35)',
      badgeBg: 'bg-emerald-500/10',
      badgeBorder: 'border-emerald-500/25',
      badgeText: 'text-emerald-400',
      statusLabel: 'Отличный уровень',
      grade: 'A+',
      dotColor: 'bg-emerald-500',
      description: 'Все ключевые критерии качества и стабильности соблюдены'
    }
  }
  if (score >= 50) {
    return {
      category: 'warning' as const,
      strokeColor: '#f59e0b', // amber-500
      gradientStart: '#fbbf24', // amber-400
      gradientEnd: '#d97706', // amber-600
      glowColor: 'rgba(245, 158, 11, 0.35)',
      badgeBg: 'bg-amber-500/10',
      badgeBorder: 'border-amber-500/25',
      badgeText: 'text-amber-400',
      statusLabel: 'Требует внимания',
      grade: 'B',
      dotColor: 'bg-amber-500',
      description: 'Обнаружены некритические предупреждения или просадки тестов'
    }
  }
  return {
    category: 'critical' as const,
    strokeColor: '#f43f5e', // rose-500
    gradientStart: '#fb7185', // rose-400
    gradientEnd: '#e11d48', // rose-600
    glowColor: 'rgba(244, 63, 94, 0.35)',
    badgeBg: 'bg-rose-500/10',
    badgeBorder: 'border-rose-500/25',
    badgeText: 'text-rose-400',
    statusLabel: 'Критический уровень',
    grade: 'C-',
    dotColor: 'bg-rose-500',
    description: 'Высокий риск регрессий или критические сбои в тестах'
  }
}

export const OverallScoreWidget: React.FC<OverallScoreWidgetProps> = ({
  data,
  className = '',
  size = 220
}) => {
  const {
    score,
    title = 'Совокупный скоринг качества',
    subtitle = 'Агрегированный индекс надежности кодовой базы и тестов',
    trend,
    breakdown
  } = data

  const clampedScore = Math.min(100, Math.max(0, Math.round(score)))
  const config = getScoreThresholdConfig(clampedScore)

  // Radial Gauge Geometry
  const viewBoxSize = 200
  const center = viewBoxSize / 2
  const strokeWidth = 14
  const radius = center - strokeWidth - 10 // ~76
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference

  // Inner decorative tick ring geometry
  const innerRadius = radius - 16

  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl bg-slate-900 border border-slate-800/80 p-5 shadow-sm hover:border-slate-700/80 transition-all duration-200 group ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: config.strokeColor }}
            />
            <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config.badgeBg} ${config.badgeBorder} ${config.badgeText}`}
        >
          {data.grade || config.grade}
        </span>
      </div>

      {/* SVG Radial Gauge and Center Metric */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 my-2">
        <div
          className="relative flex items-center justify-center select-none"
          style={{ width: size, height: size }}
        >
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
            aria-label={`Индикатор оценки: ${clampedScore} из 100`}
          >
            <defs>
              <linearGradient id={`scoreGrad-${clampedScore}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={config.gradientStart} />
                <stop offset="100%" stopColor={config.gradientEnd} />
              </linearGradient>

              <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={config.glowColor} />
              </filter>
            </defs>

            {/* Background Track */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#1e293b"
              strokeWidth={strokeWidth}
              className="opacity-70"
            />

            {/* Subtle Inner Decorative Track */}
            <circle
              cx={center}
              cy={center}
              r={innerRadius}
              fill="none"
              stroke="#334155"
              strokeWidth="1.5"
              strokeDasharray="3 6"
              className="opacity-40"
            />

            {/* Animated Foreground Gauge Ring */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={`url(#scoreGrad-${clampedScore})`}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              filter="url(#gaugeGlow)"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Center Numeric Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-4xl font-extrabold font-mono text-slate-100 tracking-tight transition-all">
              {clampedScore}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider -mt-0.5">
              из 100
            </span>
            <div
              className={`mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border ${config.badgeBg} ${config.badgeBorder} ${config.badgeText}`}
            >
              {data.statusLabel || config.statusLabel}
            </div>
          </div>
        </div>

        {/* Breakdown & Context */}
        <div className="flex-1 w-full sm:w-auto flex flex-col justify-center gap-2.5">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Статус аудита</span>
              <span className={`font-semibold ${config.badgeText}`}>
                {data.statusLabel || config.statusLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{config.description}</p>
          </div>

          {breakdown && (
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-slate-950/40 border border-emerald-900/30 text-center">
                <span className="block text-[10px] text-emerald-400 font-medium">Успешно</span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  {breakdown.passed}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/40 border border-amber-900/30 text-center">
                <span className="block text-[10px] text-amber-400 font-medium">Предупр.</span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  {breakdown.warnings}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/40 border border-rose-900/30 text-center">
                <span className="block text-[10px] text-rose-400 font-medium">Сбои</span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  {breakdown.failed}
                </span>
              </div>
            </div>
          )}

          {trend && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-950/30 border border-slate-800/60 text-[11px]">
              <span className="text-slate-400">
                {trend.label || 'Динамика к прошлому запуску'}:
              </span>
              <div
                className={`flex items-center gap-1 font-mono font-semibold ${
                  trend.direction === 'up'
                    ? 'text-emerald-400'
                    : trend.direction === 'down'
                      ? 'text-rose-400'
                      : 'text-slate-400'
                }`}
              >
                {trend.direction === 'up' && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                )}
                {trend.direction === 'down' && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                )}
                <span>
                  {trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : ''}
                  {Math.abs(trend.value)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Threshold Scale Indicator */}
      <div className="mt-2 pt-3 border-t border-slate-800/60">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>Шкала порогов:</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> &lt; 50 Критично
            </span>
            <span className="inline-flex items-center gap-1 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> 50–79 Внимание
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 80+ Отлично
            </span>
          </div>
        </div>

        {/* Mini progress track bar */}
        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex">
          <div
            className="w-1/2 h-full bg-rose-500/40 border-r border-slate-900"
            title="0-49: Критично"
          />
          <div
            className="w-[30%] h-full bg-amber-500/40 border-r border-slate-900"
            title="50-79: Внимание"
          />
          <div className="w-1/5 h-full bg-emerald-500/40" title="80-100: Отлично" />
        </div>
      </div>
    </div>
  )
}
