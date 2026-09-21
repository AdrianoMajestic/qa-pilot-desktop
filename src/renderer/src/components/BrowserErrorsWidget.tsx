import React, { useState, useEffect, useCallback } from 'react'
import type { BrowserError, BrowserErrorType } from '@shared/types'
import { electronService } from '../services/electronService'

interface BrowserErrorsWidgetProps {
  onTriggerLog?: (msg: string, level?: 'info' | 'warn' | 'error' | 'success') => void
}

export const BrowserErrorsWidget: React.FC<BrowserErrorsWidgetProps> = ({ onTriggerLog }) => {
  const [errors, setErrors] = useState<BrowserError[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSource, setSelectedSource] = useState<'all' | 'playwright' | 'crawler'>('all')
  const [selectedType, setSelectedType] = useState<'all' | BrowserErrorType>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    try {
      const data = await electronService.getBrowserErrors(
        selectedSource !== 'all' || selectedType !== 'all'
          ? {
              source: selectedSource !== 'all' ? selectedSource : undefined,
              type: selectedType !== 'all' ? selectedType : undefined
            }
          : undefined
      )
      setErrors(data)
    } catch (err) {
      console.error('Failed to fetch browser errors:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedSource, selectedType])

  // Periodic polling when auto-refresh is active
  useEffect(() => {
    const run = async (): Promise<void> => {
      await fetchErrors()
    }

    void run()

    if (!autoRefresh) return undefined

    const interval = setInterval(() => {
      void run()
    }, 4000)

    return () => clearInterval(interval)
  }, [fetchErrors, autoRefresh])

  const handleClearErrors = async (): Promise<void> => {
    try {
      await electronService.clearBrowserErrors(
        selectedSource !== 'all' ? selectedSource : undefined
      )
      setErrors([])
      if (onTriggerLog) {
        onTriggerLog(
          `Журнал сбоев браузера ${selectedSource !== 'all' ? `(${selectedSource}) ` : ''}успешно очищен`,
          'info'
        )
      }
    } catch (err) {
      console.error('Failed to clear browser errors:', err)
    }
  }

  const handleCopyStack = (id: string, text: string): void => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getTypeBadge = (type: BrowserErrorType, statusCode?: number): React.JSX.Element => {
    switch (type) {
      case 'http_error':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/60 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            HTTP {statusCode || '500+'}
          </span>
        )
      case 'network_failure':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            СЕТЕВОЙ СБОЙ
          </span>
        )
      case 'console_error':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-orange-950/70 text-orange-300 border border-orange-800/60 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
            КОНСОЛЬ ОШИБКА
          </span>
        )
      case 'page_error':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/60 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            ИСКЛЮЧЕНИЕ JS
          </span>
        )
      default:
        return (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {type}
          </span>
        )
    }
  }

  const getSourceBadge = (source: 'playwright' | 'crawler'): React.JSX.Element => {
    if (source === 'playwright') {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
          Playwright
        </span>
      )
    }
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
        Краулер
      </span>
    )
  }

  // Count summaries
  const totalCount = errors.length
  const httpCount = errors.filter((e) => e.type === 'http_error').length
  const netCount = errors.filter((e) => e.type === 'network_failure').length
  const consoleCount = errors.filter((e) => e.type === 'console_error').length
  const crashCount = errors.filter((e) => e.type === 'page_error').length

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800/80 shadow-md overflow-hidden transition-all">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Мониторинг сбоев браузера (Browser Error Interceptor)
              </h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  totalCount > 0
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800/60 animate-pulse'
                    : 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50'
                }`}
              >
                {totalCount > 0 ? `${totalCount} сбоев` : '0 сбоев'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Автоматический перехват HTTP 500+, сетевых отказов, JS-ошибок консоли и крашей страниц
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Автоматическое обновление данных"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-indigo-400 animate-ping' : 'bg-slate-500'}`}
            ></span>
            <span>Авто {autoRefresh ? 'Вкл' : 'Выкл'}</span>
          </button>

          <button
            onClick={fetchErrors}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            title="Обновить список сбоев"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          <button
            onClick={handleClearErrors}
            disabled={totalCount === 0}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>Очистить</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Type Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-1">Тип сбоя:</span>
          <button
            onClick={() => setSelectedType('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              selectedType === 'all'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Все ({totalCount})
          </button>
          <button
            onClick={() => setSelectedType('http_error')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              selectedType === 'http_error'
                ? 'bg-rose-900/80 text-rose-200 border border-rose-700'
                : 'text-slate-400 hover:text-rose-300 hover:bg-slate-800/60'
            }`}
          >
            HTTP 500+ ({httpCount})
          </button>
          <button
            onClick={() => setSelectedType('network_failure')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              selectedType === 'network_failure'
                ? 'bg-amber-900/80 text-amber-200 border border-amber-700'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
            }`}
          >
            Сетевые сбои ({netCount})
          </button>
          <button
            onClick={() => setSelectedType('console_error')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              selectedType === 'console_error'
                ? 'bg-orange-900/80 text-orange-200 border border-orange-700'
                : 'text-slate-400 hover:text-orange-300 hover:bg-slate-800/60'
            }`}
          >
            Консоль ({consoleCount})
          </button>
          <button
            onClick={() => setSelectedType('page_error')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              selectedType === 'page_error'
                ? 'bg-purple-900/80 text-purple-200 border border-purple-700'
                : 'text-slate-400 hover:text-purple-300 hover:bg-slate-800/60'
            }`}
          >
            Исключения ({crashCount})
          </button>
        </div>

        {/* Source Filters */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-1">Источник:</span>
          {(['all', 'playwright', 'crawler'] as const).map((src) => (
            <button
              key={src}
              onClick={() => setSelectedSource(src)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                selectedSource === src
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {src === 'all' ? 'Все' : src === 'playwright' ? 'Playwright' : 'Краулер'}
            </button>
          ))}
        </div>
      </div>

      {/* Errors Content List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
        {totalCount === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-slate-200">
              Сбоев браузера не зафиксировано
            </h4>
            <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
              Все сетевые запросы завершились успешно (HTTP &lt; 500), ошибки консоли и
              необработанные исключения JavaScript в сессиях Playwright и Краулера отсутствуют.
            </p>
          </div>
        ) : (
          errors.map((item) => {
            const isExpanded = expandedId === item.id
            const timeStr = new Date(item.timestamp).toLocaleTimeString()

            return (
              <div
                key={item.id}
                className="p-3.5 hover:bg-slate-850/40 transition-colors space-y-2 text-xs"
              >
                {/* Error Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {getTypeBadge(item.type, item.statusCode)}
                    {getSourceBadge(item.source)}
                    <span className="text-[11px] font-mono text-slate-400">[{timeStr}]</span>
                    {item.location && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {item.location.url ? `${item.location.url.split('/').pop()}:` : ''}
                        {item.location.lineNumber ?? 0}:{item.location.columnNumber ?? 0}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {(item.stackTrace || item.details) && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                      >
                        {isExpanded ? 'Свернуть детали' : 'Подробнее'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Error Message & Target URL */}
                <div className="space-y-1">
                  <p className="text-xs font-mono text-rose-300 font-medium break-all">
                    {item.message}
                  </p>
                  {item.url && (
                    <p className="text-[11px] font-mono text-slate-400 truncate">
                      <span className="text-slate-400 mr-1">URL:</span>
                      <span className="text-indigo-300 select-all">{item.url}</span>
                    </p>
                  )}
                  {item.failureText && (
                    <p className="text-[11px] text-amber-300/90 font-mono">
                      Причина отказа сети: {item.failureText}
                    </p>
                  )}
                </div>

                {/* Expanded Details & Stack Trace */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-2">
                    {item.stackTrace && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-400">
                            Стек-трейс исключения:
                          </span>
                          <button
                            onClick={() => handleCopyStack(item.id, item.stackTrace || '')}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer font-medium"
                          >
                            {copiedId === item.id ? '✓ Скопировано' : 'Копировать стек'}
                          </button>
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-rose-300/90 border border-slate-800 overflow-x-auto whitespace-pre leading-relaxed select-text">
                          {item.stackTrace}
                        </pre>
                      </div>
                    )}

                    {item.details && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Диагностические данные (IPC Payload):
                        </span>
                        <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-indigo-300/90 border border-slate-800 overflow-x-auto whitespace-pre leading-relaxed select-text">
                          {JSON.stringify(item.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
