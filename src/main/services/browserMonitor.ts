import type { Page, BrowserContext } from 'playwright'
import { loggerService } from './loggerService'
import type { BrowserError, BrowserErrorType } from '@shared/types'

/** Maximum number of browser error entries preserved in in-memory session buffer */
const MAX_ERRORS_HISTORY = 500

/** WeakSet keeping track of monitored Page instances to prevent duplicate event listener attachments */
const monitoredPages = new WeakSet<Page>()

/**
 * In-memory session store for captured browser errors, stack traces, and network failures.
 * Used for streaming logs and supplying diagnostic context to Google Gemini AI.
 */
export class BrowserErrorStore {
  private errors: BrowserError[] = []

  /**
   * Adds a new captured browser error to the session buffer.
   */
  addError(error: BrowserError): void {
    this.errors.push(error)
    if (this.errors.length > MAX_ERRORS_HISTORY) {
      this.errors.shift()
    }
  }

  /**
   * Retrieves captured browser errors, with optional filtering by source or type.
   */
  getErrors(filter?: {
    source?: 'playwright' | 'crawler'
    type?: BrowserErrorType
  }): BrowserError[] {
    let result = this.errors
    if (filter?.source) {
      result = result.filter((e) => e.source === filter.source)
    }
    if (filter?.type) {
      result = result.filter((e) => e.type === filter.type)
    }
    return [...result]
  }

  /**
   * Clears stored errors. Can optionally clear only errors for a specific source.
   */
  clear(source?: 'playwright' | 'crawler'): void {
    if (source) {
      this.errors = this.errors.filter((e) => e.source !== source)
    } else {
      this.errors = []
    }
  }

  /**
   * Formats captured errors into a structured Markdown text summary for AI reasoning and prompt injection.
   */
  formatForAiContext(limit = 20): string {
    const slice = this.errors.slice(-limit)
    if (slice.length === 0) {
      return 'Сбоев браузера (HTTP 500+, сетевых ошибок, JS console errors, uncaught exceptions) не зафиксировано.'
    }

    const lines: string[] = [`Зафиксировано ошибок браузера (${slice.length}):\n`]
    for (const [idx, err] of slice.entries()) {
      lines.push(`### Ошибка #${idx + 1} [${err.type.toUpperCase()}] (${err.source})`)
      lines.push(`- **Время:** ${new Date(err.timestamp).toLocaleTimeString()}`)
      if (err.url) lines.push(`- **URL:** ${err.url}`)
      if (err.statusCode) lines.push(`- **HTTP Статус:** ${err.statusCode} ${err.statusText ?? ''}`)
      if (err.failureText) lines.push(`- **Сетевой сбой:** ${err.failureText}`)
      if (err.location) {
        lines.push(
          `- **Локация:** ${err.location.url ?? 'inline'}:${err.location.lineNumber ?? 0}:${err.location.columnNumber ?? 0}`
        )
      }
      lines.push(`- **Сообщение:** ${err.message}`)
      if (err.stackTrace) {
        lines.push('```')
        lines.push(err.stackTrace)
        lines.push('```')
      }
      lines.push('')
    }

    return lines.join('\n')
  }
}

export const browserErrorStore = new BrowserErrorStore()

/**
 * Attaches real-time error interception listeners to a Playwright Page or BrowserContext.
 * Intercepts:
 * - HTTP 500+ responses
 * - Network-level request failures (DNS, CORS, ECONNREFUSED)
 * - Console error messages (with source location)
 * - Uncaught JavaScript page exceptions (with full stack trace)
 *
 * Automatically streams formatted events to loggerService.error and archives in browserErrorStore.
 * Guarantees idempotency via WeakSet to prevent duplicate listeners.
 */
export function attachBrowserMonitor(
  target: Page | BrowserContext,
  source: 'playwright' | 'crawler' = 'playwright',
  onError?: (err: BrowserError) => void
): void {
  // If a BrowserContext is passed, monitor all current and future pages
  if ('pages' in target && typeof target.pages === 'function') {
    const context = target as BrowserContext

    // Attach to any page opened in this context in the future
    context.on('page', (page: Page) => {
      attachBrowserMonitor(page, source, onError)
    })

    // Attach to existing pages in context
    for (const page of context.pages()) {
      attachBrowserMonitor(page, source, onError)
    }
    return
  }

  const page = target as Page

  // Idempotency check: prevent duplicate attachment to the same Page instance
  if (monitoredPages.has(page)) {
    return
  }
  monitoredPages.add(page)

  // 1. Intercept HTTP 500+ responses
  page.on('response', (response) => {
    try {
      const status = response.status()
      if (status >= 500) {
        const url = response.url()
        const statusText = response.statusText()
        const message = `[HTTP ${status}] ${statusText || 'Server Error'}: ${url}`
        const details: Record<string, unknown> = {
          url,
          status,
          statusText,
          method: response.request().method(),
          resourceType: response.request().resourceType()
        }

        const errorItem: BrowserError = {
          id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          source,
          type: 'http_error',
          url,
          message,
          statusCode: status,
          statusText,
          details
        }

        browserErrorStore.addError(errorItem)
        loggerService.error(source, message, details)
        onError?.(errorItem)
      }
    } catch {
      // Ignore errors inside event handler
    }
  })

  // 2. Intercept network-level failures (ECONNREFUSED, CORS, DNS, etc.)
  page.on('requestfailed', (request) => {
    try {
      const url = request.url()
      const failure = request.failure()
      const failureText = failure?.errorText || 'Unknown network failure'
      const message = `Сетевой сбой запроса (${failureText}): ${url}`
      const details: Record<string, unknown> = {
        url,
        failureText,
        method: request.method(),
        resourceType: request.resourceType()
      }

      const errorItem: BrowserError = {
        id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        source,
        type: 'network_failure',
        url,
        message,
        failureText,
        details
      }

      browserErrorStore.addError(errorItem)
      loggerService.error(source, message, details)
      onError?.(errorItem)
    } catch {
      // Ignore errors inside event handler
    }
  })

  // 3. Intercept console.error messages
  page.on('console', (msg) => {
    try {
      if (msg.type() === 'error') {
        const text = msg.text()
        const loc = msg.location()
        const locationStr = loc.url
          ? ` (${loc.url}:${loc.lineNumber ?? 0}:${loc.columnNumber ?? 0})`
          : ''
        const message = `Консольная ошибка браузера: ${text}${locationStr}`
        const details: Record<string, unknown> = {
          text,
          type: msg.type(),
          location: {
            url: loc.url,
            lineNumber: loc.lineNumber,
            columnNumber: loc.columnNumber
          },
          pageUrl: page.url()
        }

        const errorItem: BrowserError = {
          id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          source,
          type: 'console_error',
          url: loc.url || page.url(),
          message,
          location: {
            url: loc.url,
            lineNumber: loc.lineNumber,
            columnNumber: loc.columnNumber
          },
          details
        }

        browserErrorStore.addError(errorItem)
        loggerService.error(source, message, details)
        onError?.(errorItem)
      }
    } catch {
      // Ignore errors inside event handler
    }
  })

  // 4. Intercept uncaught JavaScript exceptions and crash stack traces
  page.on('pageerror', (err) => {
    try {
      const errorMsg = err.message || String(err)
      const stack = err.stack
      let pageUrl = ''
      try {
        pageUrl = page.url()
      } catch {
        pageUrl = ''
      }

      const message = `Неперехваченное исключение страницы (Page Error): ${errorMsg}`
      const details: Record<string, unknown> = {
        message: errorMsg,
        name: err.name,
        stackTrace: stack,
        pageUrl
      }

      const errorItem: BrowserError = {
        id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        source,
        type: 'page_error',
        url: pageUrl,
        message,
        stackTrace: stack,
        details
      }

      browserErrorStore.addError(errorItem)
      loggerService.error(source, message, details)
      onError?.(errorItem)
    } catch {
      // Ignore errors inside event handler
    }
  })
}

/**
 * Returns captured browser errors from the in-memory session store.
 */
export function getBrowserErrors(filter?: {
  source?: 'playwright' | 'crawler'
  type?: BrowserErrorType
}): BrowserError[] {
  return browserErrorStore.getErrors(filter)
}

/**
 * Clears captured browser errors from the in-memory session store.
 */
export function clearBrowserErrors(source?: 'playwright' | 'crawler'): void {
  browserErrorStore.clear(source)
}
