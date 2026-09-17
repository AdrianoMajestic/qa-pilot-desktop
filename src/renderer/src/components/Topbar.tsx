import React from 'react'
import type { SystemStatus } from '../types'

interface TopbarProps {
  status: SystemStatus
  loading: boolean
  projectName?: string | null
  projectPath?: string | null
  isScanning?: boolean
  onSelectProject: () => void
  onOpenSettings?: () => void
}

export const Topbar: React.FC<TopbarProps> = ({
  status,
  loading,
  projectName,
  projectPath,
  isScanning = false,
  onSelectProject,
  onOpenSettings
}) => {
  return (
    <header className="h-12 bg-slate-900/90 border-b border-slate-800/80 px-4 flex items-center justify-between select-none backdrop-blur-md z-20">
      {/* Brand & App Title */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold text-slate-100 tracking-wide">QA Pilot Desktop</h1>
          <span className="text-[11px] font-medium text-slate-400 bg-slate-800/70 px-1.5 py-0.5 rounded">
            v1.0.0
          </span>
        </div>

        {/* Selected Project Badge */}
        {projectName && (
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-xs text-indigo-300 max-w-xs truncate"
            title={projectPath || ''}
          >
            <svg
              className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"
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
            <span className="truncate font-medium">{projectName}</span>
          </div>
        )}
      </div>

      {/* Center Search / Command palette hint */}
      <div className="hidden md:flex items-center bg-slate-950/60 border border-slate-800 rounded-md px-2.5 py-1 text-xs text-slate-400 gap-2 w-64 shadow-inner">
        <svg
          className="w-3.5 h-3.5 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="flex-1 text-slate-400">Поиск тестов и сценариев...</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded border border-slate-700">
          Ctrl+K
        </kbd>
      </div>

      {/* Actions & Status Badge */}
      <div className="flex items-center gap-3">
        {/* Open Project Button */}
        <button
          onClick={onSelectProject}
          disabled={isScanning}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          title="Выбрать локальную папку проекта"
        >
          {isScanning ? (
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
              <span>Сканирование...</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <span>{projectName ? 'Сменить проект' : 'Открыть проект'}</span>
            </>
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-all border border-slate-700/80 cursor-pointer shadow-sm hover:border-slate-600"
          title="Настройки приложения (Gemini API Key, Playwright)"
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
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="hidden sm:inline">Настройки</span>
        </button>

        {loading ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Подключение IPC...</span>
          </div>
        ) : status.ready ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium shadow-sm shadow-emerald-950">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Система готова</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 text-rose-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{status.message || 'Система офлайн'}</span>
          </div>
        )}

        {status.electronVersion && (
          <span className="hidden sm:inline-block text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 font-mono">
            Electron {status.electronVersion}
          </span>
        )}
      </div>
    </header>
  )
}
