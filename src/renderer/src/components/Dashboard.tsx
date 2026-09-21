import React, { useState } from 'react'
import type { SystemStatus, TestSuiteSummary, ProjectStats } from '../types'
import { electronService } from '../services/electronService'
import { DashboardOverview } from './DashboardOverview'
import { BrowserErrorsWidget } from './BrowserErrorsWidget'

interface DashboardProps {
  status: SystemStatus
  projectStats: ProjectStats | null
  projectPath: string | null
  projectName: string | null
  isScanning: boolean
  onSelectProject: () => void
  onTriggerLog: (msg: string, level?: 'info' | 'warn' | 'error' | 'success') => void
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
    onTriggerLog(`Запуск выполнения Playwright для набора: "${suiteName}" через IPC...`, 'info')
    try {
      const result = await electronService.runPlaywrightWorker(suiteName)
      onTriggerLog(`[Ответ воркера]: ${result.message} в ${result.timestamp}`, 'success')
    } catch (err) {
      onTriggerLog(
        `Сбой выполнения воркера: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`,
        'error'
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

        {/* Quick Action Buttons */}
        <div className="mt-5 flex flex-wrap gap-3 relative z-10">
          <button
            onClick={() => handleRunPlaywright('Smoke Тесты')}
            disabled={runningWorker}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 ${runningWorker ? 'animate-spin' : ''}`}
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
            <span>{runningWorker ? 'Выполняется воркер...' : 'Запустить Smoke-тесты'}</span>
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

          <button
            onClick={onSelectProject}
            disabled={isScanning}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
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

      {/* Browser Error Interceptor & Monitoring Widget */}
      <BrowserErrorsWidget onTriggerLog={onTriggerLog} />

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
