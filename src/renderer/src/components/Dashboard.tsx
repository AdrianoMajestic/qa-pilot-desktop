import React, { useState, useEffect } from 'react'
import type {
  SystemStatus,
  ProjectStats,
  FinalQAReport,
  QASessionData,
  ProjectContext,
  CrawlResult,
  AppSettings
} from '../types'
import { electronService } from '../services/electronService'

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
  settings?: AppSettings | null
}

export const Dashboard: React.FC<DashboardProps> = ({
  projectPath,
  projectName,
  isScanning,
  onSelectProject,
  onTriggerLog,
  settings
}) => {
  // Step 1: Project Context State
  const [isParsingContext, setIsParsingContext] = useState(false)
  const [activeContextPath, setActiveContextPath] = useState<string | null>(null)
  const [rawContext, setRawContext] = useState<ProjectContext | null>(null)
  const projectContext = activeContextPath === projectPath ? rawContext : null

  // Step 2: Playwright Web Crawler State
  const [targetUrl, setTargetUrl] = useState('http://localhost:3000')
  const [isCrawling, setIsCrawling] = useState(false)
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null)
  const [interceptedErrorCount, setInterceptedErrorCount] = useState<number>(0)

  // Step 3: Gemini AI Audit Report State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [finalReport, setFinalReport] = useState<FinalQAReport | null>(null)
  const [copiedReport, setCopiedReport] = useState(false)

  // Operation Error Alert Banner State
  const [errorBanner, setErrorBanner] = useState<{ title: string; message: string } | null>(null)

  // URL Validation Helper
  const isTargetUrlValid = (): boolean => {
    const trimmed = targetUrl.trim()
    if (!trimmed) return false
    try {
      const parsed = new URL(trimmed)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  // Poll real intercepted error count
  useEffect(() => {
    let mounted = true
    const checkErrors = async (): Promise<void> => {
      try {
        const errors = await electronService.getBrowserErrors()
        if (mounted) {
          setInterceptedErrorCount(errors.length)
        }
      } catch {
        // Ignore error when bridge not ready
      }
    }
    void checkErrors()
    const timer = setInterval(() => {
      void checkErrors()
    }, 3000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  // Action 1: Parse Project Context (IPC project:parse-context)
  const handleParseContext = async (): Promise<void> => {
    if (!projectPath || isParsingContext) return
    setErrorBanner(null)
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

      onTriggerLog(
        `Контекст проекта сформирован (${keyFilesCount} ключевых файлов, ~${tokensK}k токенов)`,
        'success',
        'AI Контекст'
      )
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Неизвестная ошибка'
      setErrorBanner({
        title: 'Ошибка формирования контекста проекта (Карточка 1)',
        message: errMsg
      })
      onTriggerLog(
        `Сбой формирования контекста ИИ: ${errMsg}`,
        'error',
        'AI Контекст'
      )
    } finally {
      setIsParsingContext(false)
    }
  }

  // Action 2: Start Crawler (IPC crawler:start)
  const handleStartCrawl = async (): Promise<void> => {
    const trimmed = targetUrl.trim()
    if (!trimmed) {
      setErrorBanner({
        title: 'Ошибка валидации URL (Карточка 2)',
        message: 'Укажите целевой URL приложения для запуска авто-краулера.'
      })
      onTriggerLog('Укажите целевой URL приложения для запуска авто-краулера.', 'warn', 'Краулер')
      return
    }

    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('URL должен начинаться с http:// или https://')
      }
    } catch {
      setErrorBanner({
        title: 'Невалидный URL (Карточка 2)',
        message: `Невалидный URL: "${trimmed}". Используйте корректный формат, например http://localhost:3000`
      })
      onTriggerLog(
        `Невалидный URL: "${trimmed}". Используйте формат http://localhost:3000`,
        'error',
        'Краулер'
      )
      return
    }

    setErrorBanner(null)
    setIsCrawling(true)
    setCrawlResult(null)
    onTriggerLog(`Запуск автоматического обхода Playwright: ${trimmed}`, 'info', 'Краулер')

    try {
      const result = await electronService.startCrawler({
        startUrl: trimmed,
        maxDepth: 3,
        maxPages: 25,
        sameDomainOnly: true,
        emulateFormSubmission: true
      })
      setCrawlResult(result)

      if (result.aborted) {
        onTriggerLog('Автоматический обход прерван пользователем.', 'warn', 'Краулер')
      } else if (result.success) {
        onTriggerLog(
          `Обход завершен: ${result.pagesVisited} страниц, ${result.totalForms} форм, ${result.totalInputs} полей ввода`,
          'success',
          'Краулер'
        )
      } else {
        onTriggerLog(
          `Обход завершен с предупреждениями: ${result.errors.length} сбоев`,
          'warn',
          'Краулер'
        )
      }

      // Refresh intercepted errors
      const errs = await electronService.getBrowserErrors()
      setInterceptedErrorCount(errs.length)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Неизвестная ошибка'
      setErrorBanner({
        title: 'Сбой авто-краулера Playwright (Карточка 2)',
        message: errMsg
      })
      onTriggerLog(
        `Сбой выполнения авто-краулера: ${errMsg}`,
        'error',
        'Краулер'
      )
    } finally {
      setIsCrawling(false)
    }
  }

  // Action 2: Stop Crawler (IPC crawler:stop)
  const handleStopCrawl = async (): Promise<void> => {
    onTriggerLog('Запрос остановки процесса краулера...', 'warn', 'Краулер')
    try {
      await electronService.stopCrawler()
    } catch (err) {
      console.error('Failed to stop crawler:', err)
    }
  }

  // Action 3: Generate QA Report (IPC ai:generate-qa-report)
  const handleGenerateReport = async (): Promise<void> => {
    if (!projectContext) {
      setErrorBanner({
        title: 'Требуется контекст проекта (Карточка 3)',
        message: 'Сначала сформируйте контекст проекта на Карточке 1.'
      })
      return
    }

    setErrorBanner(null)
    setIsGeneratingReport(true)
    onTriggerLog('Запуск формирования итогового QA-отчёта Gemini...', 'info', 'AI Отчёт')

    try {
      const browserErrors = await electronService.getBrowserErrors()

      let architecture: QASessionData['architecture']
      if (projectPath) {
        onTriggerLog(
          'AI-анализ архитектуры проекта моделью gemini-1.5-flash...',
          'info',
          'AI Отчёт'
        )
        const context = rawContext || (await electronService.parseProjectContext(projectPath))
        architecture = await electronService.analyzeArchitecture(context)
      }

      const sessionData: QASessionData = {
        projectName: projectName ?? undefined,
        architecture,
        crawler: crawlResult || undefined,
        browserErrors
      }

      const report = await electronService.generateFinalReport(sessionData)
      setFinalReport(report)
      onTriggerLog(
        `Итоговый QA-отчёт Gemini готов: скор ${report.overallScore}/100, критических сигналов: ${report.criticalIssuesCount}`,
        'success',
        'AI Отчёт'
      )
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Неизвестная ошибка'
      setErrorBanner({
        title: 'Ошибка формирования QA-отчёта (Карточка 3)',
        message: errMsg
      })
      onTriggerLog(
        `Ошибка формирования QA-отчёта: ${errMsg}`,
        'error',
        'AI Отчёт'
      )
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleCopyReport = (): void => {
    if (!finalReport) return
    const textToCopy =
      finalReport.analysisMarkdown ||
      `# QA-отчёт: ${projectName || 'Проект'}\nСкор: ${finalReport.overallScore}/100\n\nExecutive Summary:\n${finalReport.executiveSummary.map((b) => `- ${b}`).join('\n')}`
    navigator.clipboard.writeText(textToCopy)
    setCopiedReport(true)
    setTimeout(() => setCopiedReport(false), 2000)
  }

  const hasApiKey = Boolean(settings?.geminiApiKey?.trim())
  const keyFilesCount = projectContext
    ? (projectContext.configFiles?.length || 0) +
      (projectContext.entryPoints?.length || 0) +
      (projectContext.hasPackageJson ? 1 : 0)
    : 0

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 select-none">
      {/* 3-Card Functional Layout Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <span>Панель управления QA</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-normal">
              gemini-1.5-flash
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Прямое взаимодействие: парсер кодовой базы, краулер Playwright и аналитика Gemini.
          </p>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorBanner && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-3 shadow-lg shadow-rose-950/40 animate-in fade-in duration-200">
          <div className="p-1 rounded-md bg-rose-900/60 text-rose-400 flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1 space-y-0.5 min-w-0">
            <div className="font-semibold text-rose-100">{errorBanner.title}</div>
            <div className="text-rose-300/90 leading-relaxed break-words">{errorBanner.message}</div>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="p-1 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-900/50 transition-colors cursor-pointer flex-shrink-0"
            title="Закрыть уведомление"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 3-Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Card 1: 📁 Контекст проекта */}
        <div className="rounded-xl bg-slate-900 border border-slate-800/90 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-950/70 border border-indigo-800/60 text-indigo-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-100">1. 📁 Контекст проекта</h3>
            </div>
            <button
              onClick={onSelectProject}
              disabled={isScanning}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer"
            >
              {projectPath ? 'Сменить' : 'Выбрать'}
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-400 block">Путь к проекту:</span>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 truncate select-text">
              {projectPath || <span className="text-slate-500 italic">Папка не выбрана</span>}
            </div>
          </div>

          {/* Badges: Parsed files & estimated tokens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 block">Статус контекста ИИ:</span>
              {projectContext && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/60 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Контекст сформирован
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {projectContext ? (
                <>
                  <span className="px-2.5 py-1 rounded bg-indigo-950/60 border border-indigo-700/60 text-[11px] font-mono text-indigo-300">
                    Файлов: {keyFilesCount}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-700/60 text-[11px] font-mono text-emerald-300">
                    Токенов: ~
                    {projectContext.estimatedTokens
                      ? (projectContext.estimatedTokens / 1000).toFixed(1)
                      : '0'}
                    k
                  </span>
                  {projectContext.detectedStack?.language && (
                    <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-cyan-300">
                      {projectContext.detectedStack.language}
                    </span>
                  )}
                  {projectContext.detectedStack?.frameworks?.map((fw, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded bg-slate-800/80 border border-indigo-700/50 text-[11px] font-mono text-indigo-300"
                    >
                      {fw}
                    </span>
                  ))}
                </>
              ) : (
                <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-500">
                  Не сформирован
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleParseContext}
            disabled={!projectPath || isParsingContext}
            className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
            title={!projectPath ? 'Сначала выберите папку проекта' : undefined}
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span>Парсинг файлов...</span>
              </>
            ) : (
              <span>Сформировать контекст ИИ</span>
            )}
          </button>
        </div>

        {/* Card 2: 🌐 Авто-краулер Playwright */}
        <div className="rounded-xl bg-slate-900 border border-slate-800/90 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-950/70 border border-amber-800/60 text-amber-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-100">
                2. 🌐 Авто-краулер Playwright
              </h3>
            </div>
            {isCrawling && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                Обход...
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="target-url-input"
              className="text-[11px] font-medium text-slate-400 block"
            >
              Target URL:
            </label>
            <input
              id="target-url-input"
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={isCrawling}
              placeholder="http://localhost:3000"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Badges: Real intercepted errors & Crawl stats */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-slate-400 block">
              Сбои браузера / Результаты:
            </span>
            <div className="flex flex-wrap gap-2">
              <span
                className={`px-2.5 py-1 rounded text-[11px] font-mono border ${
                  interceptedErrorCount > 0
                    ? 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                Ошибок браузера: {interceptedErrorCount}
              </span>

              {crawlResult && (
                <>
                  <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                    Страниц: {crawlResult.pagesVisited}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                    Форм: {crawlResult.totalForms}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={isCrawling ? handleStopCrawl : handleStartCrawl}
            disabled={!isCrawling && !isTargetUrlValid()}
            className={`w-full px-4 py-2 rounded-lg text-xs font-medium text-white transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isCrawling
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-indigo-600/20'
            }`}
            title={!isCrawling && !isTargetUrlValid() ? 'Укажите валидный URL (например, http://localhost:3000)' : undefined}
          >
            {isCrawling ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>Остановить краулер</span>
              </>
            ) : (
              <span>Запустить краулер</span>
            )}
          </button>
        </div>

        {/* Card 3: 🤖 ИИ-Отчет Gemini */}
        <div className="rounded-xl bg-slate-900 border border-slate-800/90 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-100">3. 🤖 ИИ-Отчет Gemini</h3>
            </div>
            {finalReport && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-bold">
                {finalReport.overallScore}/100
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-400 block">Статус API-ключа:</span>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
              <span>{hasApiKey ? 'Ключ сохранён' : 'Ключ не задан'}</span>
              <span
                className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'}`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-medium text-slate-400 block">Модель анализа:</span>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-indigo-300">
                gemini-1.5-flash
              </span>
              {finalReport && (
                <span className="px-2.5 py-1 rounded bg-rose-950/60 border border-rose-700/60 text-[11px] font-mono text-rose-300">
                  Сигналов: {finalReport.criticalIssuesCount}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport || !projectContext}
              className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
              title={!projectContext ? 'Сначала сформируйте контекст проекта на Карточке 1' : undefined}
            >
              {isGeneratingReport ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Формирование отчёта...</span>
                </>
              ) : (
                <span>Сформировать QA-отчёт</span>
              )}
            </button>

            {!projectContext && (
              <p className="text-[11px] text-amber-400/90 text-center flex items-center justify-center gap-1">
                <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Сначала сформируйте контекст проекта на Карточке 1</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Gemini Report Output View */}
      <div className="rounded-xl bg-slate-900 border border-slate-800/90 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Отчёт и анализ Gemini</h3>
            {finalReport && (
              <span className="text-[10px] font-mono text-slate-500">
                {new Date(finalReport.generatedAt).toLocaleTimeString('ru-RU')}
              </span>
            )}
          </div>

          {finalReport && (
            <button
              onClick={handleCopyReport}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
            >
              {copiedReport ? '✓ Скопировано' : 'Копировать отчёт'}
            </button>
          )}
        </div>

        <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 min-h-[140px] max-h-[360px] overflow-y-auto text-xs font-mono text-slate-200 select-text leading-relaxed whitespace-pre-wrap">
          {finalReport ? (
            finalReport.analysisMarkdown || (
              <div className="space-y-3">
                <div className="font-semibold text-indigo-300">
                  Совокупный скоринг качества: {finalReport.overallScore}/100 (Критических сигналов:{' '}
                  {finalReport.criticalIssuesCount})
                </div>
                <div className="space-y-1">
                  <div className="text-slate-400 font-bold">Executive Summary:</div>
                  {finalReport.executiveSummary.map((item, idx) => (
                    <div key={idx} className="text-slate-300">
                      • {item}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="text-slate-500 italic flex items-center justify-center h-28">
              Отчёт ещё не сформирован. Нажмите «Сформировать QA-отчёт» на карточке 3.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
