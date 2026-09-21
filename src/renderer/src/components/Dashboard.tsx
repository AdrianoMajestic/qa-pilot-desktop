import React, { useState } from 'react'
import type {
  SystemStatus,
  TestSuiteSummary,
  ProjectStats,
  ProjectContext,
  CrawlResult
} from '../types'
import { electronService } from '../services/electronService'
import { DashboardOverview } from './DashboardOverview'

interface DashboardProps {
  status: SystemStatus
  projectStats: ProjectStats | null
  projectPath: string | null
  projectName: string | null
  isScanning: boolean
  onSelectProject: () => void
  onTriggerLog: (
    msg: string,
    level?: 'info' | 'warn' | 'error' | 'success',
    source?: string
  ) => void
}

export const Dashboard: React.FC<DashboardProps> = ({
  status,
  projectStats,
  projectPath,
  projectName,
  isScanning,
  onSelectProject,
  onTriggerLog
}) => {
  const [runningWorker, setRunningWorker] = useState(false)

  // Project Code Parser AI Context State
  const [isParsingContext, setIsParsingContext] = useState(false)
  const [activeContextPath, setActiveContextPath] = useState<string | null>(null)
  const [rawContext, setRawContext] = useState<ProjectContext | null>(null)
  const projectContext = activeContextPath === projectPath ? rawContext : null

  // Playwright Web Crawler State
  const [targetUrl, setTargetUrl] = useState('http://localhost:3000')
  const [isCrawling, setIsCrawling] = useState(false)
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null)

  const handleParseContext = async (): Promise<void> => {
    if (!projectPath || isParsingContext) return
    setIsParsingContext(true)
    onTriggerLog(
      `Запуск селективного парсера исходного кода: ${projectPath}...`,
      'info',
      'AI Контекст'
    )

    try {
      const ctx = await electronService.parseProjectContext(projectPath)
      setRawContext(ctx)
      setActiveContextPath(projectPath)

      const keyFilesCount =
        (ctx.configFiles?.length || 0) +
        (ctx.entryPoints?.length || 0) +
        (ctx.hasPackageJson ? 1 : 0)
      const tokensK = ctx.estimatedTokens ? (ctx.estimatedTokens / 1000).toFixed(1) : '0'
      const nowTime = new Date().toLocaleTimeString('ru-RU')

      onTriggerLog(
        `[${nowTime}] Контекст проекта успешно сформирован (${keyFilesCount} файлов, ~${tokensK}k токенов)`,
        'success',
        'AI Контекст'
      )
    } catch (err) {
      onTriggerLog(
        `Сбой формирования контекста ИИ: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`,
        'error',
        'AI Контекст'
      )
    } finally {
      setIsParsingContext(false)
    }
  }

  const handleStartCrawl = async (): Promise<void> => {
    const trimmed = targetUrl.trim()
    if (!trimmed) {
      onTriggerLog('Укажите целевой URL приложения для запуска авто-краулера.', 'warn', 'Краулер')
      return
    }

    try {
      new URL(trimmed)
    } catch {
      onTriggerLog(
        `Невалидный URL: "${trimmed}". Используйте формат http://localhost:3000`,
        'error',
        'Краулер'
      )
      return
    }

    setIsCrawling(true)
    setCrawlResult(null)
    const nowTime = new Date().toLocaleTimeString('ru-RU')
    onTriggerLog(
      `[${nowTime}] Запуск автоматического обхода веб-приложения: ${trimmed}`,
      'info',
      'Краулер'
    )

    try {
      const result = await electronService.startCrawler({
        startUrl: trimmed,
        maxDepth: 3,
        maxPages: 25,
        sameDomainOnly: true,
        emulateFormSubmission: true
      })
      setCrawlResult(result)
      const doneTime = new Date().toLocaleTimeString('ru-RU')

      if (result.aborted) {
        onTriggerLog(`[${doneTime}] Автоматический обход прерван пользователем.`, 'warn', 'Краулер')
      } else if (result.success) {
        onTriggerLog(
          `[${doneTime}] Обход успешно завершен: ${result.pagesVisited} страниц, ${result.totalForms} форм, ${result.totalInputs} полей ввода (${(result.durationMs / 1000).toFixed(1)}с)`,
          'success',
          'Краулер'
        )
      } else {
        onTriggerLog(
          `[${doneTime}] Обход завершен с ошибками: ${result.errors.length} сбоев (${(result.durationMs / 1000).toFixed(1)}с)`,
          'warn',
          'Краулер'
        )
      }
    } catch (err) {
      onTriggerLog(
        `Сбой выполнения авто-краулера: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`,
        'error',
        'Краулер'
      )
    } finally {
      setIsCrawling(false)
    }
  }

  const handleStopCrawl = async (): Promise<void> => {
    onTriggerLog('Запрос остановки процесса краулера...', 'warn', 'Краулер')
    try {
      await electronService.stopCrawler()
    } catch (err) {
      console.error('Failed to stop crawler:', err)
    }
  }

  const initialSuites: TestSuiteSummary[] = [
    {
      id: '1',
      name: 'Аутентификация и авторизация',
      description: 'Вход, выход из системы, обновление токена сессии, OAuth провайдеры',
      status: 'passed',
      totalTests: 8,
      passedTests: 8
    },
    {
      id: '2',
      name: 'Оплата и оформление заказов',
      description: 'Вебхуки платежного шлюза, создание заказа, валидация фискальных чеков',
      status: 'idle',
      totalTests: 14,
      passedTests: 14
    },
    {
      id: '3',
      name: 'Настройки профиля и права доступа',
      description: 'Ролевая модель доступа (RBAC), обновление учетной записи',
      status: 'idle',
      totalTests: 6,
      passedTests: 5
    }
  ]

  const handleRunPlaywright = async (suiteName: string): Promise<void> => {
    setRunningWorker(true)
    onTriggerLog(
      `Запуск выполнения Playwright для набора: "${suiteName}" через IPC...`,
      'info',
      'Playwright'
    )
    try {
      const result = await electronService.runPlaywrightWorker(suiteName)
      onTriggerLog(
        `[Ответ воркера]: ${result.message} в ${result.timestamp}`,
        'success',
        'Playwright'
      )
    } catch (err) {
      onTriggerLog(
        `Сбой выполнения воркера: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`,
        'error',
        'Playwright'
      )
    } finally {
      setRunningWorker(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800/80 p-6 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            QA Pilot Desktop — Платформа автоматизации тестирования
          </h2>
          <p className="mt-1 text-sm text-slate-400 leading-relaxed">
            Высокопроизводительный десктопный оркестратор QA-тестов для воркеров Playwright,
            изолированной IPC-диспетчеризации и мониторинга выполнения в реальном времени.
          </p>
        </div>

        {/* Main Action & Target URL Controls */}
        <div className="mt-5 flex flex-wrap items-center gap-3 relative z-10">
          <div className="flex items-center bg-slate-950/80 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
            <span className="text-[11px] font-mono text-slate-400 mr-2 select-none">URL:</span>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={isCrawling}
              placeholder="http://localhost:3000"
              aria-label="Целевой URL приложения"
              className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-52 sm:w-64 font-mono disabled:opacity-50"
            />
          </div>

          <button
            onClick={isCrawling ? handleStopCrawl : handleStartCrawl}
            disabled={isParsingContext}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-medium transition-all shadow-lg cursor-pointer ${
              isCrawling
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            {isCrawling ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-200 animate-ping" />
                <span>Остановить обход</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                </svg>
                <span>Запустить авто-краулер</span>
              </>
            )}
          </button>

          <button
            onClick={onSelectProject}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span>{projectName ? 'Выбрать другой проект' : 'Выбрать папку проекта'}</span>
          </button>

          <button
            onClick={() =>
              onTriggerLog('Диагностический тест системы отправлен через IPC-мост.', 'info')
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <span>Диагностический лог</span>
          </button>
        </div>
      </div>

      {/* Project Overview Stats Panel */}
      <div className="rounded-xl bg-slate-900 border border-slate-800/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Обзор проекта и анализ кода</h3>
              <p className="text-xs text-slate-400">
                {projectPath ? (
                  <span className="font-mono text-indigo-300 select-text">{projectPath}</span>
                ) : (
                  'Проект не выбран. Откройте локальную папку для сканирования структуры.'
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleParseContext}
              disabled={!projectPath || isParsingContext}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
              title="Селективно проанализировать файлы проекта и сформировать контекст для Gemini AI"
            >
              {isParsingContext ? (
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Анализ файлов...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5 text-indigo-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>Сформировать контекст ИИ</span>
                </>
              )}
            </button>

            <button
              onClick={onSelectProject}
              disabled={isScanning}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-400"
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
              <span>{projectStats ? 'Пересканировать' : 'Сканировать папку'}</span>
            </button>
          </div>
        </div>

        {/* Project Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400">Всего файлов</span>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-bold text-slate-100 font-mono">
                {projectStats ? projectStats.totalFiles : '—'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">в проекте</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400">Файлов кода JS / TS</span>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-bold text-indigo-400 font-mono">
                {projectStats ? projectStats.jsTsFilesCount : '—'}
              </span>
              <span className="text-[10px] text-indigo-400/80 font-mono">.js, .ts, .tsx</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400">Конфигураций JSON</span>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-bold text-amber-400 font-mono">
                {projectStats ? projectStats.jsonFilesCount : '—'}
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono">.json</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400">Каталогов (папок)</span>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-bold text-emerald-400 font-mono">
                {projectStats ? projectStats.totalFolders : '—'}
              </span>
              <span className="text-[10px] text-emerald-400/80 font-mono">папок</span>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 bg-slate-950/40 px-3 py-2 rounded-md border border-slate-850 flex items-center justify-between">
          <span>
            Служебные каталоги исключены: node_modules, .git, dist, build, .next, out, coverage
          </span>
          <span className="text-emerald-400 font-medium">Фильтрация активна</span>
        </div>

        {/* AI Context Card */}
        {projectContext && (
          <div className="p-4 rounded-lg bg-indigo-950/40 border border-indigo-500/40 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs font-semibold text-indigo-200">
                  Контекст Gemini AI успешно подготовлен
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-indigo-900/70 border border-indigo-700/60 text-[11px] font-mono text-indigo-300 font-medium">
                  Ключевых файлов:{' '}
                  {(projectContext.configFiles?.length || 0) +
                    (projectContext.entryPoints?.length || 0) +
                    (projectContext.hasPackageJson ? 1 : 0)}
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/60 text-[11px] font-mono text-emerald-300 font-medium">
                  Примерно токенов: ~
                  {projectContext.estimatedTokens
                    ? (projectContext.estimatedTokens / 1000).toFixed(1)
                    : '0'}
                  k
                </span>
              </div>
            </div>

            {projectContext.detectedStack && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                <span className="text-slate-400 mr-1">Определен стек:</span>
                {projectContext.detectedStack.frameworks.map((f) => (
                  <span
                    key={f}
                    className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700 font-mono"
                  >
                    {f}
                  </span>
                ))}
                <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
                  {projectContext.detectedStack.language}
                </span>
                {projectContext.detectedStack.hasTailwind && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700 font-mono">
                    Tailwind CSS
                  </span>
                )}
                {projectContext.detectedStack.testRunners.map((tr) => (
                  <span
                    key={tr}
                    className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700 font-mono"
                  >
                    {tr}
                  </span>
                ))}
                {projectContext.detectedStack.buildTools.map((bt) => (
                  <span
                    key={bt}
                    className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 font-mono"
                  >
                    {bt}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Playwright Auto-Crawler Section */}
      <div className="rounded-xl bg-slate-900 border border-slate-800/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">
                  Автоматизированный обход веб-приложения (Playwright Crawler)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  BFS Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Автономное исследование страниц, сбор ссылок, обнаружение форм и полей ввода с
                эмуляцией взаимодействий
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCrawling ? (
              <button
                onClick={handleStopCrawl}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                <span>Остановить обход</span>
              </button>
            ) : (
              <button
                onClick={handleStartCrawl}
                disabled={isCrawling}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-2"
              >
                <svg
                  className="w-3.5 h-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                </svg>
                <span>Запустить авто-краулер</span>
              </button>
            )}
          </div>
        </div>

        {/* Input & Parameters Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-8 flex flex-col space-y-1.5">
            <label htmlFor="target-url" className="text-xs font-medium text-slate-300">
              Целевой URL приложения
            </label>
            <div className="relative flex items-center">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs font-mono">
                URL
              </span>
              <input
                id="target-url"
                type="url"
                value={targetUrl}
                disabled={isCrawling}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="http://localhost:3000"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-12 pr-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-60"
              />
            </div>
          </div>

          <div className="md:col-span-4 flex items-center gap-2 pt-5">
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Глубина: 3
            </span>
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Лимит: 25 стр.
            </span>
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
              Эмуляция: Да
            </span>
          </div>
        </div>

        {/* Crawl Results Card */}
        {crawlResult && (
          <div className="mt-2 p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    crawlResult.success ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span>Итоги обхода: {crawlResult.startUrl}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Время выполнения: {(crawlResult.durationMs / 1000).toFixed(1)} сек.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Посещено страниц</span>
                <span className="text-lg font-bold text-slate-100 font-mono">
                  {crawlResult.pagesVisited}
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Найдено форм</span>
                <span className="text-lg font-bold text-indigo-400 font-mono">
                  {crawlResult.totalForms}
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Полей ввода</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {crawlResult.totalInputs}
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Ошибок / сбоев</span>
                <span
                  className={`text-lg font-bold font-mono ${
                    crawlResult.errors.length > 0 ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  {crawlResult.errors.length}
                </span>
              </div>
            </div>

            {crawlResult.pages.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-slate-400 block">
                  Обнаруженные страницы и элементы:
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                  {crawlResult.pages.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800/60 text-slate-300"
                    >
                      <span className="truncate flex-1">{p.url}</span>
                      <span className="text-slate-500 text-[10px] ml-2 flex-shrink-0">
                        {p.forms.length} форм / {p.inputs.length} инпутов / {p.links.length} ссылок
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual Quality Dashboard (Overall Score & Health Radar Widgets) */}
      <DashboardOverview />

      {/* General Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Всего тест-кейсов</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-100">28</span>
            <span className="text-xs text-emerald-400 font-medium">100% настроено</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Успешность проверок</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">96.4%</span>
            <span className="text-xs text-slate-400 font-mono">27 / 28 успешно</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Мост IPC</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-indigo-400">Изолированный контекст</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Окружение системы</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xs font-mono text-slate-300 truncate">
              {status.platform || 'windows'} / {status.arch || 'x64'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Node {status.nodeVersion || '22'}
            </span>
          </div>
        </div>
      </div>

      {/* Test Suites Panel */}
      <div className="rounded-xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Настроенные наборы тестов</h3>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {initialSuites.length} набора
            </span>
          </div>
          <span className="text-xs text-slate-400">Воркер Playwright готов</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {initialSuites.map((suite) => (
            <div
              key={suite.id}
              className="p-4 flex items-center justify-between hover:bg-slate-850/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    suite.status === 'passed' ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                />
                <div>
                  <h4 className="text-xs font-medium text-slate-200">{suite.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{suite.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-slate-400">
                  {suite.passedTests}/{suite.totalTests} пройдено
                </span>
                <button
                  onClick={() => handleRunPlaywright(suite.name)}
                  disabled={runningWorker}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors cursor-pointer"
                >
                  Запустить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
