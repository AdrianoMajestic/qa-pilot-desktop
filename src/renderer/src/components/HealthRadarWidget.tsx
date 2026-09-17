import React, { useState, useMemo, useCallback } from 'react'
import type { HealthRadarWidgetProps } from '../types'

const GRID_LEVELS = [0.2, 0.4, 0.6, 0.8, 1.0]

export const HealthRadarWidget: React.FC<HealthRadarWidgetProps> = ({
  data,
  className = '',
  size = 340
}) => {
  const {
    metrics,
    title = 'Health Radar — Мультиосевой анализ',
    subtitle = 'Оценка 6 ключевых векторов качества и надежности',
    benchmarkLabel = 'Целевой порог (80%)',
    currentLabel = 'Текущие показатели'
  } = data

  const [activeMetricKey, setActiveMetricKey] = useState<string | null>(null)

  // Chart Dimensions & Geometry
  const viewBoxSize = 360
  const center = viewBoxSize / 2
  const maxRadius = 115
  const totalAxes = metrics.length || 6

  // Angles: Start at -90deg (12 o'clock) and divide 360deg by totalAxes
  const axisAngles = useMemo(() => {
    return metrics.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / totalAxes)
  }, [metrics, totalAxes])

  // Calculate polygon points string for a given radius fraction or per-metric values
  const getPolygonPoints = useCallback(
    (values: number[]): string => {
      return values
        .map((val, i) => {
          const angle = axisAngles[i]
          const clamped = Math.min(100, Math.max(0, val))
          const r = (clamped / 100) * maxRadius
          const x = center + r * Math.cos(angle)
          const y = center + r * Math.sin(angle)
          return `${x.toFixed(2)},${y.toFixed(2)}`
        })
        .join(' ')
    },
    [axisAngles, center, maxRadius]
  )

  // Grid level polygon points
  const gridPolygons = useMemo(() => {
    return GRID_LEVELS.map((lvl) => {
      const pts = axisAngles.map((angle) => {
        const x = center + lvl * maxRadius * Math.cos(angle)
        const y = center + lvl * maxRadius * Math.sin(angle)
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      return pts.join(' ')
    })
  }, [axisAngles, center, maxRadius])

  // Current metric values polygon
  const currentPoints = useMemo(() => {
    return getPolygonPoints(metrics.map((m) => m.value))
  }, [metrics, getPolygonPoints])

  // Benchmark values polygon
  const benchmarkPoints = useMemo(() => {
    return getPolygonPoints(metrics.map((m) => m.benchmark ?? 80))
  }, [metrics, getPolygonPoints])

  // Computed vertex coordinates for interactive dots
  const vertexPoints = useMemo(() => {
    return metrics.map((metric, i) => {
      const angle = axisAngles[i]
      const clamped = Math.min(100, Math.max(0, metric.value))
      const r = (clamped / 100) * maxRadius
      return {
        key: metric.key,
        metric,
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        outerX: center + (maxRadius + 22) * Math.cos(angle),
        outerY: center + (maxRadius + 22) * Math.sin(angle),
        angle
      }
    })
  }, [metrics, axisAngles, center, maxRadius])

  // Overall average across radar axes
  const averageValue = useMemo(() => {
    if (!metrics.length) return 0
    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return Math.round(sum / metrics.length)
  }, [metrics])

  const activeMetric = useMemo(() => {
    return metrics.find((m) => m.key === activeMetricKey) || null
  }, [metrics, activeMetricKey])

  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl bg-slate-900 border border-slate-800/80 p-5 shadow-sm hover:border-slate-700/80 transition-all duration-200 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-1 bg-indigo-500 rounded-full" />
            <span className="text-slate-300 font-medium">{currentLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-slate-400" />
            <span className="text-slate-400">{benchmarkLabel}</span>
          </span>
        </div>
      </div>

      {/* Spider Chart Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* SVG Radar */}
        <div className="lg:col-span-7 flex items-center justify-center select-none py-1">
          <div className="relative" style={{ width: size, height: size, maxWidth: '100%' }}>
            <svg
              className="w-full h-full overflow-visible"
              viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
              aria-label="Health Radar диаграмма"
            >
              <defs>
                {/* Radial Gradient for Data Polygon */}
                <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
                  <stop offset="70%" stopColor="#6366f1" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.10" />
                </radialGradient>

                <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx="0"
                    dy="0"
                    stdDeviation="3"
                    floodColor="rgba(99, 102, 241, 0.45)"
                  />
                </filter>
              </defs>

              {/* Concentric Background Grid Polygons */}
              {gridPolygons.map((pts, idx) => (
                <polygon
                  key={`grid-${idx}`}
                  points={pts}
                  fill={idx % 2 === 0 ? '#0f172a' : 'transparent'}
                  fillOpacity={idx % 2 === 0 ? 0.35 : 0}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeOpacity={0.4 + idx * 0.1}
                />
              ))}

              {/* Grid Scale Level Markers (along top axis) */}
              {GRID_LEVELS.map((lvl, idx) => (
                <text
                  key={`lvl-text-${idx}`}
                  x={center + 4}
                  y={center - lvl * maxRadius + 3}
                  className="text-[9px] fill-slate-500 font-mono select-none"
                >
                  {Math.round(lvl * 100)}%
                </text>
              ))}

              {/* Radial Axis Lines */}
              {axisAngles.map((angle, idx) => {
                const endX = center + maxRadius * Math.cos(angle)
                const endY = center + maxRadius * Math.sin(angle)
                const isHovered = activeMetricKey === metrics[idx]?.key

                return (
                  <line
                    key={`axis-${idx}`}
                    x1={center}
                    y1={center}
                    x2={endX}
                    y2={endY}
                    stroke={isHovered ? '#818cf8' : '#334155'}
                    strokeWidth={isHovered ? 1.5 : 1}
                    strokeDasharray={isHovered ? 'none' : '2 3'}
                    strokeOpacity={isHovered ? 0.9 : 0.6}
                    className="transition-colors duration-200"
                  />
                )
              })}

              {/* Benchmark Contour Polygon */}
              <polygon
                points={benchmarkPoints}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeOpacity="0.6"
              />

              {/* Current Metrics Filled Polygon */}
              <polygon
                points={currentPoints}
                fill="url(#radarFillGrad)"
                stroke="#818cf8"
                strokeWidth="2.5"
                filter="url(#radarGlow)"
                className="transition-all duration-700 ease-out"
              />

              {/* Interactive Vertex Dots & Metric Values */}
              {vertexPoints.map(({ key, metric, x, y }) => {
                const isHovered = activeMetricKey === key
                const valColor =
                  metric.value >= 80 ? '#10b981' : metric.value >= 50 ? '#f59e0b' : '#f43f5e'

                return (
                  <g
                    key={`vertex-${key}`}
                    className="cursor-pointer group"
                    onMouseEnter={() => setActiveMetricKey(key)}
                    onMouseLeave={() => setActiveMetricKey(null)}
                  >
                    {/* Pulsing ring on hover */}
                    {isHovered && (
                      <circle
                        cx={x}
                        cy={y}
                        r="9"
                        fill="none"
                        stroke="#818cf8"
                        strokeWidth="1.5"
                        strokeOpacity="0.7"
                        className="animate-ping"
                      />
                    )}

                    {/* Outer vertex circle */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 6 : 4.5}
                      fill="#0f172a"
                      stroke={isHovered ? '#ffffff' : valColor}
                      strokeWidth={isHovered ? 2.5 : 2}
                      className="transition-all duration-200"
                    />
                  </g>
                )
              })}

              {/* Outer Axes Text Labels */}
              {vertexPoints.map(({ key, metric, outerX, outerY, angle }) => {
                const isHovered = activeMetricKey === key
                const cosA = Math.cos(angle)
                const sinA = Math.sin(angle)

                // Align label relative to vertex angle
                let textAnchor: 'start' | 'middle' | 'end' = 'middle'
                if (cosA > 0.35) textAnchor = 'start'
                else if (cosA < -0.35) textAnchor = 'end'

                let dy = '0.35em'
                if (sinA < -0.6) dy = '-0.6em'
                else if (sinA > 0.6) dy = '1.1em'

                return (
                  <g
                    key={`label-${key}`}
                    className="cursor-pointer transition-all duration-200 select-none"
                    onMouseEnter={() => setActiveMetricKey(key)}
                    onMouseLeave={() => setActiveMetricKey(null)}
                  >
                    <text
                      x={outerX}
                      y={outerY}
                      dy={dy}
                      textAnchor={textAnchor}
                      className={`text-[10px] font-semibold transition-colors duration-150 ${
                        isHovered ? 'fill-indigo-300 font-bold' : 'fill-slate-300'
                      }`}
                    >
                      {metric.label}
                    </text>
                    <text
                      x={outerX}
                      y={outerY}
                      dy={sinA > 0.6 ? '2.1em' : sinA < -0.6 ? '0.4em' : '1.35em'}
                      textAnchor={textAnchor}
                      className={`text-[10px] font-mono font-bold ${
                        metric.value >= 80
                          ? 'fill-emerald-400'
                          : metric.value >= 50
                            ? 'fill-amber-400'
                            : 'fill-rose-400'
                      }`}
                    >
                      {metric.value}%
                    </text>
                  </g>
                )
              })}

              {/* Center Dot */}
              <circle cx={center} cy={center} r="2.5" fill="#64748b" />
            </svg>
          </div>
        </div>

        {/* Right Details Panel: Axes Breakdown Table & Active Metric Card */}
        <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-3">
          {/* Active Highlight or Summary Badge */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                {activeMetric ? activeMetric.label : 'Средний индекс радар-профиля'}
              </span>
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                  (activeMetric ? activeMetric.value : averageValue) >= 80
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : (activeMetric ? activeMetric.value : averageValue) >= 50
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                {activeMetric ? `${activeMetric.value}%` : `${averageValue}%`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              {activeMetric
                ? activeMetric.description ||
                  `Ось "${activeMetric.label}" отражает текущую готовность компонента к релизу.`
                : 'Наведите курсор на вершины или строки в таблице для детального анализа каждого измерения.'}
            </p>
          </div>

          {/* Detailed Axes List */}
          <div className="space-y-1.5">
            {metrics.map((metric) => {
              const isHovered = activeMetricKey === metric.key
              const valColor =
                metric.value >= 80
                  ? 'bg-emerald-500 text-emerald-400'
                  : metric.value >= 50
                    ? 'bg-amber-500 text-amber-400'
                    : 'bg-rose-500 text-rose-400'

              return (
                <div
                  key={metric.key}
                  onMouseEnter={() => setActiveMetricKey(metric.key)}
                  onMouseLeave={() => setActiveMetricKey(null)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer flex items-center justify-between ${
                    isHovered
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${valColor.split(' ')[0]}`} />
                    <span className="truncate text-slate-200 font-medium text-[11px]">
                      {metric.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${valColor.split(' ')[0]}`}
                        style={{ width: `${metric.value}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-100 w-8 text-right">
                      {metric.value}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
