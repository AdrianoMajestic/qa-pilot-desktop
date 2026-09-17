export type ScoreCategory = 'critical' | 'warning' | 'good'

export interface ScoreTrend {
  value: number
  direction: 'up' | 'down' | 'neutral'
  label?: string
}

export interface ScoreBreakdown {
  passed: number
  warnings: number
  failed: number
}

export interface OverallScoreData {
  score: number // 0 - 100
  title?: string
  subtitle?: string
  grade?: string
  statusLabel?: string
  trend?: ScoreTrend
  breakdown?: ScoreBreakdown
}

export interface RadarAxisMetric {
  key: string
  label: string
  value: number // 0 - 100
  fullMark?: number
  benchmark?: number // benchmark or previous scan value (0 - 100)
  description?: string
}

export interface HealthRadarData {
  title?: string
  subtitle?: string
  metrics: RadarAxisMetric[]
  benchmarkLabel?: string
  currentLabel?: string
}

export interface OverallScoreWidgetProps {
  data: OverallScoreData
  className?: string
  size?: number
}

export interface HealthRadarWidgetProps {
  data: HealthRadarData
  className?: string
  size?: number
}

export interface DashboardOverviewProps {
  overallScore?: OverallScoreData
  healthRadar?: HealthRadarData
  className?: string
  onSelectProject?: () => void
}
