import React, { useState, useRef, useEffect } from 'react'
import type { LogEntry } from '../types'

interface ConsoleLogsProps {
  logs: LogEntry[]
  onClearLogs: () => void
}

export const ConsoleLogs: React.FC<ConsoleLogsProps> = ({ logs, onClearLogs }) => {
  const [collapsed, setCollapsed] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!collapsed && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, collapsed])

  const getLevelBadge = (level: LogEntry['level']): React.JSX.Element => {
    switch (level) {
      case 'error':
        return (
          <span className="text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded text-[10px] font-mono border border-rose-800/50">
            ОШИБ
          </span>
        )
      case 'warn':
        return (
          <span className="text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded text-[10px] font-mono border border-amber-800/50">
            ПРЕД
          </span>
        )
      case 'success':
        return (
          <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded text-[10px] font-mono border border-emerald-800/50">
            УСПЕХ
          </span>
        )
      case 'info':
      default:
        return (
          <span className="text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded text-[10px] font-mono border border-cyan-800/50">
            ИНФО
          </span>
        )
    }
  }

  return (
    <div
      className={`border-t border-slate-800 bg-slate-900 transition-all duration-200 flex flex-col select-none ${
        collapsed ? 'h-9' : 'h-48'
      }`}
    >
      {/* Log Bar Header */}
      <div className="h-9 px-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-1.5 font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 transform transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
            <span className="uppercase tracking-wider text-[11px] font-mono">
              Логи выполнения и поток IPC
            </span>
          </button>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono">
            {logs.length} соб.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!collapsed && (
            <button
              onClick={onClearLogs}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-[11px] cursor-pointer"
              title="Очистить консоль"
            >
              Очистить
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title={collapsed ? 'Развернуть панель логов' : 'Свернуть панель логов'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d={collapsed ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Log Output Body */}
      {!collapsed && (
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5 bg-slate-950/80 text-slate-300 select-text"
        >
          {logs.length === 0 ? (
            <div className="text-slate-500 italic py-2">Сообщений журнала пока нет.</div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 leading-relaxed hover:bg-slate-900/50 px-1 py-0.5 rounded"
              >
                <span className="text-slate-500 text-[11px] select-none">{log.timestamp}</span>
                {getLevelBadge(log.level)}
                {log.source && <span className="text-slate-500 text-[11px]">[{log.source}]</span>}
                <span className="flex-1 text-slate-200">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
