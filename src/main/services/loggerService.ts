import { BrowserWindow } from 'electron'

import { IPC_CHANNELS, type LogLevel, type LogSource, type LogEvent } from '@shared/types'

export type { LogLevel, LogSource, LogEvent }
export const STREAM_LOG_CHANNEL = IPC_CHANNELS.STREAM_LOG_EVENT

export class LoggerService {
  /**
   * Broadcasts a typed log event to all active renderer processes via IPC streaming.
   */
  broadcast(
    level: LogLevel,
    source: LogSource,
    message: string,
    details?: Record<string, unknown>
  ): LogEvent {
    const event: LogEvent = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      source,
      message,
      details
    }

    try {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(STREAM_LOG_CHANNEL, event)
        }
      }
    } catch (err) {
      console.error('[LoggerService] Failed to broadcast log event:', err)
    }

    return event
  }

  info(source: LogSource, message: string, details?: Record<string, unknown>): LogEvent {
    return this.broadcast('info', source, message, details)
  }

  warn(source: LogSource, message: string, details?: Record<string, unknown>): LogEvent {
    return this.broadcast('warn', source, message, details)
  }

  error(source: LogSource, message: string, details?: Record<string, unknown>): LogEvent {
    return this.broadcast('error', source, message, details)
  }

  success(source: LogSource, message: string, details?: Record<string, unknown>): LogEvent {
    return this.broadcast('success', source, message, details)
  }
}

export const loggerService = new LoggerService()
