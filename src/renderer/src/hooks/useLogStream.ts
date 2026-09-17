import { useState, useEffect, useCallback } from 'react'
import type { LogEntry } from '../types'
import { electronService } from '../services/electronService'
import type { LogEvent, LogLevel, LogSource } from '@shared/types'

export const formatLogSource = (source: LogSource | string): string => {
  switch (source) {
    case 'system':
      return 'Система'
    case 'playwright':
      return 'Playwright'
    case 'crawler':
      return 'Краулер'
    case 'ai':
      return 'Gemini AI'
    default:
      return source
  }
}

export interface UseLogStreamReturn {
  logs: LogEntry[]
  addLog: (message: string, level?: LogEntry['level'], source?: string) => void
  clearLogs: () => void
  triggerTestLog: (params?: {
    message?: string
    level?: LogLevel
    source?: LogSource
    details?: Record<string, unknown>
  }) => Promise<LogEvent>
}

export function useLogStream(initialLogs?: LogEntry[]): UseLogStreamReturn {
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    if (initialLogs && initialLogs.length > 0) {
      return initialLogs
    }
    return [
      {
        id: 'log-init-1',
        timestamp: new Date().toLocaleTimeString('ru-RU'),
        level: 'info',
        source: 'Система',
        message: 'Приложение QA Pilot Desktop успешно инициализировано.'
      },
      {
        id: 'log-init-2',
        timestamp: new Date().toLocaleTimeString('ru-RU'),
        level: 'success',
        source: 'Preload IPC',
        message: 'Мост контекстной изоляции и стриминговый канал логов подключены.'
      }
    ]
  })

  // Append a local or manual log entry
  const addLog = useCallback(
    (message: string, level: LogEntry['level'] = 'info', source = 'Приложение') => {
      const newEntry: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString('ru-RU'),
        level,
        source,
        message
      }
      setLogs((prev) => [...prev, newEntry])
    },
    []
  )

  // Clear all logs in state
  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  // Diagnostic test trigger through IPC
  const triggerTestLog = useCallback(
    async (params?: {
      message?: string
      level?: LogLevel
      source?: LogSource
      details?: Record<string, unknown>
    }) => {
      return await electronService.triggerTestLog(params)
    },
    []
  )

  // Subscribe to real-time IPC log streaming with cleanup
  useEffect(() => {
    const handleLogEvent = (event: LogEvent): void => {
      const entry: LogEntry = {
        id: event.id,
        timestamp: new Date(event.timestamp).toLocaleTimeString('ru-RU'),
        level: event.level,
        source: formatLogSource(event.source),
        message: event.message
      }
      setLogs((prev) => [...prev, entry])
    }

    // Subscribe and obtain cleanup unsubscribe function
    const unsubscribe = electronService.onLogEvent(handleLogEvent)

    return () => {
      // Memory-safe cleanup: removes the IPC listener
      unsubscribe()
    }
  }, [])

  return {
    logs,
    addLog,
    clearLogs,
    triggerTestLog
  }
}
