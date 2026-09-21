import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { app } from 'electron'
import { loggerService } from './loggerService'
import { attachBrowserMonitor } from './browserMonitor'
import type {
  CrawlerOptions,
  CrawlResult,
  DiscoveredPage,
  DiscoveredForm,
  DiscoveredInput
} from '@shared/types'

/** Default crawler configuration values */
const DEFAULTS = {
  maxDepth: 3,
  maxPages: 30,
  sameDomainOnly: true,
  emulateFormSubmission: false,
  navigationTimeoutMs: 30_000,
  testFillValue: 'qa-test-input'
} as const

/** Queue entry for BFS exploration */
interface CrawlQueueEntry {
  url: string
  depth: number
}

/**
 * Automated web application crawler service for the Electron Main process.
 * Uses Playwright to navigate pages via BFS, discover forms/inputs,
 * emulate basic user interactions, and stream progress in real time.
 */
export class CrawlerService {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private isRunning = false
  private aborted = false

  constructor() {
    // Graceful cleanup on Electron shutdown
    app.on('before-quit', () => {
      this.forceCleanup()
    })
  }

  /**
   * Starts BFS crawl from the given URL.
   * Returns a CrawlResult with all discovered pages, forms, inputs, and errors.
   */
  async startCrawl(options: CrawlerOptions): Promise<CrawlResult> {
    if (this.isRunning) {
      const msg = 'Краулер уже выполняется. Остановите текущий обход перед запуском нового.'
      loggerService.warn('crawler', msg)
      return this.buildEmptyResult(options.startUrl, msg)
    }

    const startTime = Date.now()
    this.isRunning = true
    this.aborted = false

    const maxDepth = options.maxDepth ?? DEFAULTS.maxDepth
    const maxPages = options.maxPages ?? DEFAULTS.maxPages
    const sameDomainOnly = options.sameDomainOnly ?? DEFAULTS.sameDomainOnly
    const emulateFormSubmission = options.emulateFormSubmission ?? DEFAULTS.emulateFormSubmission

    const visited = new Set<string>()
    const discoveredPages: DiscoveredPage[] = []
    const globalErrors: string[] = []
    let totalForms = 0
    let totalInputs = 0

    let startDomain: string
    try {
      startDomain = new URL(options.startUrl).hostname
    } catch {
      const errMsg = `Невалидный стартовый URL: ${options.startUrl}`
      loggerService.error('crawler', errMsg)
      this.isRunning = false
      return this.buildEmptyResult(options.startUrl, errMsg)
    }

    loggerService.info(
      'crawler',
      `Запуск автоматического обхода: ${options.startUrl} (глубина: ${maxDepth}, лимит страниц: ${maxPages}, домен: ${sameDomainOnly ? 'только ' + startDomain : 'все'})`
    )

    // Launch Playwright browser
    try {
      this.browser = await chromium.launch({ headless: true })
      this.context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) QA-Pilot-Crawler/1.0 AppleWebKit/537.36',
        ignoreHTTPSErrors: true
      })
    } catch (err) {
      const errMsg = `Не удалось запустить браузер Playwright: ${err instanceof Error ? err.message : String(err)}`
      loggerService.error('crawler', errMsg)
      this.isRunning = false
      return this.buildEmptyResult(options.startUrl, errMsg)
    }

    // BFS queue
    const queue: CrawlQueueEntry[] = [{ url: this.normalizeUrl(options.startUrl), depth: 0 }]

    try {
      while (queue.length > 0 && !this.aborted) {
        if (visited.size >= maxPages) {
          loggerService.info('crawler', `Достигнут лимит страниц (${maxPages}). Завершение обхода.`)
          break
        }

        const entry = queue.shift()!
        const normalizedUrl = this.normalizeUrl(entry.url)

        if (visited.has(normalizedUrl)) continue
        visited.add(normalizedUrl)

        // Domain check
        if (sameDomainOnly) {
          try {
            const urlDomain = new URL(normalizedUrl).hostname
            if (urlDomain !== startDomain) {
              continue
            }
          } catch {
            continue
          }
        }

        loggerService.info(
          'crawler',
          `[${visited.size}/${maxPages}] Обход страницы (глубина ${entry.depth}): ${normalizedUrl}`
        )

        // Analyze page
        const pageResult = await this.analyzePage(normalizedUrl, entry.depth, emulateFormSubmission)

        if (pageResult) {
          discoveredPages.push(pageResult)
          totalForms += pageResult.forms.length
          totalInputs += pageResult.inputs.length

          if (pageResult.errors.length > 0) {
            globalErrors.push(...pageResult.errors.map((e) => `[${normalizedUrl}] ${e}`))
          }

          // Enqueue discovered links within depth limit
          if (entry.depth < maxDepth) {
            for (const link of pageResult.links) {
              const normalizedLink = this.normalizeUrl(link)
              if (!visited.has(normalizedLink)) {
                // Domain check before enqueuing
                if (sameDomainOnly) {
                  try {
                    if (new URL(normalizedLink).hostname !== startDomain) continue
                  } catch {
                    continue
                  }
                }
                queue.push({ url: normalizedLink, depth: entry.depth + 1 })
              }
            }
          }
        }
      }
    } catch (err) {
      const errMsg = `Критическая ошибка обхода: ${err instanceof Error ? err.message : String(err)}`
      loggerService.error('crawler', errMsg)
      globalErrors.push(errMsg)
    } finally {
      await this.closeBrowser()
    }

    const durationMs = Date.now() - startTime
    this.isRunning = false

    const result: CrawlResult = {
      success: !this.aborted && globalErrors.length === 0,
      startUrl: options.startUrl,
      pagesVisited: discoveredPages.length,
      pagesDiscovered: visited.size,
      totalForms,
      totalInputs,
      pages: discoveredPages,
      errors: globalErrors,
      durationMs,
      aborted: this.aborted
    }

    if (this.aborted) {
      loggerService.warn(
        'crawler',
        `Обход прерван пользователем. Посещено страниц: ${result.pagesVisited}, время: ${(durationMs / 1000).toFixed(1)}с`
      )
    } else {
      loggerService.success(
        'crawler',
        `Обход завершён. Посещено: ${result.pagesVisited} страниц, форм: ${totalForms}, полей ввода: ${totalInputs}, ошибок: ${globalErrors.length}, время: ${(durationMs / 1000).toFixed(1)}с`
      )
    }

    return result
  }

  /**
   * Gracefully stops the currently running crawl.
   */
  async stopCrawl(): Promise<void> {
    if (!this.isRunning) {
      loggerService.info('crawler', 'Нет активного обхода для остановки.')
      return
    }

    loggerService.warn('crawler', 'Запрос на остановку обхода...')
    this.aborted = true
    await this.closeBrowser()
  }

  /**
   * Navigates to a URL and analyzes the page for links, forms, and interactive elements.
   */
  private async analyzePage(
    url: string,
    depth: number,
    emulateFormSubmission: boolean
  ): Promise<DiscoveredPage | null> {
    if (!this.context || this.aborted) return null

    let page: Page | null = null
    const pageErrors: string[] = []

    try {
      page = await this.context.newPage()

      // Attach browser monitor to intercept HTTP 500+, network failures, console errors, and page exceptions
      attachBrowserMonitor(page, 'crawler', (err) => {
        pageErrors.push(`[${err.type.toUpperCase()}] ${err.message}`)
      })

      // Navigate with timeout
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULTS.navigationTimeoutMs
      })

      if (!response) {
        pageErrors.push('Навигация не вернула ответ')
        loggerService.warn('crawler', `[${url}] Навигация не вернула ответ`)
      }

      // Wait for initial content to stabilize
      await page.waitForTimeout(500)

      // Get page title
      const title = await page.title().catch(() => '')

      // Extract links
      const links = await this.extractLinks(page, url)

      // Discover forms
      const forms = await this.discoverForms(page)

      // Discover standalone inputs (not inside forms)
      const inputs = await this.discoverStandaloneInputs(page)

      // Emulate soft interactions if enabled
      if (emulateFormSubmission && (forms.length > 0 || inputs.length > 0)) {
        await this.emulateInteractions(page, forms, inputs, url)
      }

      loggerService.info(
        'crawler',
        `[${url}] Найдено: ${links.length} ссылок, ${forms.length} форм, ${inputs.length} полей ввода`
      )

      return {
        url,
        depth,
        title,
        forms,
        inputs,
        links,
        errors: pageErrors,
        timestamp: Date.now()
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)

      // Classify error
      if (errMsg.includes('Timeout') || errMsg.includes('timeout')) {
        loggerService.warn(
          'crawler',
          `[${url}] Таймаут навигации (${DEFAULTS.navigationTimeoutMs}мс)`
        )
        pageErrors.push(`Таймаут навигации: ${errMsg}`)
      } else if (errMsg.includes('ERR_') || errMsg.includes('net::')) {
        loggerService.warn('crawler', `[${url}] Сетевая ошибка: ${errMsg}`)
        pageErrors.push(`Сетевая ошибка: ${errMsg}`)
      } else {
        loggerService.error('crawler', `[${url}] Ошибка анализа страницы: ${errMsg}`)
        pageErrors.push(`Ошибка: ${errMsg}`)
      }

      return {
        url,
        depth,
        title: '',
        forms: [],
        inputs: [],
        links: [],
        errors: pageErrors,
        timestamp: Date.now()
      }
    } finally {
      if (page) {
        try {
          await page.close()
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * Extracts all internal href links from the page.
   */
  private async extractLinks(page: Page, currentUrl: string): Promise<string[]> {
    try {
      const rawHrefs = await page.$$eval('a[href]', (anchors) =>
        anchors.map((a) => a.getAttribute('href') ?? '')
      )

      const links: string[] = []
      const seen = new Set<string>()

      for (const href of rawHrefs) {
        if (
          !href ||
          href.startsWith('#') ||
          href.startsWith('javascript:') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:')
        ) {
          continue
        }

        try {
          const absoluteUrl = new URL(href, currentUrl).href
          const normalized = this.normalizeUrl(absoluteUrl)
          if (!seen.has(normalized)) {
            seen.add(normalized)
            links.push(normalized)
          }
        } catch {
          // Ignore malformed URLs
        }
      }

      return links
    } catch {
      return []
    }
  }

  /**
   * Discovers all <form> elements and their child fields.
   */
  private async discoverForms(page: Page): Promise<DiscoveredForm[]> {
    try {
      return await page.$$eval('form', (formElements) => {
        return formElements.map((form) => {
          const fields = Array.from(form.querySelectorAll('input, textarea, select, button')).map(
            (el) => ({
              tag: el.tagName.toLowerCase(),
              type:
                el.getAttribute('type') ??
                (el.tagName.toLowerCase() === 'textarea'
                  ? 'textarea'
                  : el.tagName.toLowerCase() === 'select'
                    ? 'select'
                    : ''),
              name: el.getAttribute('name') ?? '',
              id: el.getAttribute('id') ?? '',
              placeholder: el.getAttribute('placeholder') ?? ''
            })
          )

          return {
            action: form.getAttribute('action') ?? '',
            method: (form.getAttribute('method') ?? 'GET').toUpperCase(),
            id: form.getAttribute('id') ?? '',
            fields
          }
        })
      })
    } catch {
      return []
    }
  }

  /**
   * Discovers standalone interactive elements NOT inside <form> tags.
   */
  private async discoverStandaloneInputs(page: Page): Promise<DiscoveredInput[]> {
    try {
      return await page.$$eval(
        'input:not(form input), textarea:not(form textarea), select:not(form select), button:not(form button)',
        (elements) => {
          return elements.map((el) => ({
            tag: el.tagName.toLowerCase(),
            type:
              el.getAttribute('type') ??
              (el.tagName.toLowerCase() === 'textarea'
                ? 'textarea'
                : el.tagName.toLowerCase() === 'select'
                  ? 'select'
                  : ''),
            name: el.getAttribute('name') ?? '',
            id: el.getAttribute('id') ?? '',
            placeholder: el.getAttribute('placeholder') ?? ''
          }))
        }
      )
    } catch {
      return []
    }
  }

  /**
   * Emulates soft interactions: fills text inputs with test data.
   * Does NOT submit forms to avoid unintended mutations.
   */
  private async emulateInteractions(
    page: Page,
    forms: DiscoveredForm[],
    standaloneInputs: DiscoveredInput[],
    url: string
  ): Promise<void> {
    const fillableTypes = new Set(['text', 'email', 'search', 'tel', 'url', 'password'])
    let filledCount = 0

    try {
      // Fill form fields
      for (const form of forms) {
        for (const field of form.fields) {
          if (this.aborted) return

          if (field.tag === 'input' && fillableTypes.has(field.type)) {
            const selector = field.id
              ? `#${CSS.escape(field.id)}`
              : field.name
                ? `input[name="${field.name}"]`
                : null
            if (selector) {
              try {
                await page.fill(selector, DEFAULTS.testFillValue, { timeout: 2000 })
                filledCount++
              } catch {
                // Skip unfillable fields
              }
            }
          } else if (field.tag === 'textarea') {
            const selector = field.id
              ? `#${CSS.escape(field.id)}`
              : field.name
                ? `textarea[name="${field.name}"]`
                : null
            if (selector) {
              try {
                await page.fill(selector, DEFAULTS.testFillValue, { timeout: 2000 })
                filledCount++
              } catch {
                // Skip unfillable fields
              }
            }
          } else if (field.tag === 'select') {
            const selector = field.id
              ? `#${CSS.escape(field.id)}`
              : field.name
                ? `select[name="${field.name}"]`
                : null
            if (selector) {
              try {
                const firstOption = await page.$eval(
                  `${selector} option:nth-child(2)`,
                  (opt) => opt.getAttribute('value') ?? ''
                )
                if (firstOption) {
                  await page.selectOption(selector, firstOption, { timeout: 2000 })
                  filledCount++
                }
              } catch {
                // Skip unselectable fields
              }
            }
          }
        }
      }

      // Fill standalone inputs
      for (const input of standaloneInputs) {
        if (this.aborted) return

        if (input.tag === 'input' && fillableTypes.has(input.type)) {
          const selector = input.id
            ? `#${CSS.escape(input.id)}`
            : input.name
              ? `input[name="${input.name}"]`
              : null
          if (selector) {
            try {
              await page.fill(selector, DEFAULTS.testFillValue, { timeout: 2000 })
              filledCount++
            } catch {
              // Skip unfillable fields
            }
          }
        } else if (input.tag === 'textarea') {
          const selector = input.id
            ? `#${CSS.escape(input.id)}`
            : input.name
              ? `textarea[name="${input.name}"]`
              : null
          if (selector) {
            try {
              await page.fill(selector, DEFAULTS.testFillValue, { timeout: 2000 })
              filledCount++
            } catch {
              // Skip unfillable fields
            }
          }
        }
      }

      if (filledCount > 0) {
        loggerService.info(
          'crawler',
          `[${url}] Эмуляция: заполнено ${filledCount} полей тестовыми данными`
        )
      }
    } catch (err) {
      loggerService.warn(
        'crawler',
        `[${url}] Ошибка эмуляции взаимодействий: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Normalizes a URL by removing hash fragments and trailing slashes for deduplication.
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      parsed.hash = ''
      // Remove trailing slash except for root path
      let normalized = parsed.href
      if (normalized.endsWith('/') && parsed.pathname !== '/') {
        normalized = normalized.slice(0, -1)
      }
      return normalized
    } catch {
      return url
    }
  }

  /**
   * Builds an empty CrawlResult for early-exit error scenarios.
   */
  private buildEmptyResult(startUrl: string, errorMsg: string): CrawlResult {
    return {
      success: false,
      startUrl,
      pagesVisited: 0,
      pagesDiscovered: 0,
      totalForms: 0,
      totalInputs: 0,
      pages: [],
      errors: [errorMsg],
      durationMs: 0,
      aborted: false
    }
  }

  /**
   * Closes the Playwright browser and context gracefully.
   */
  private async closeBrowser(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close()
        this.context = null
      }
    } catch {
      this.context = null
    }

    try {
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
    } catch {
      this.browser = null
    }
  }

  /**
   * Synchronous force cleanup for application shutdown.
   */
  private forceCleanup(): void {
    this.aborted = true
    this.isRunning = false

    if (this.browser) {
      try {
        // Fire and forget close on shutdown
        this.browser.close().catch(() => {})
      } catch {
        // Ignore errors during shutdown
      }
      this.browser = null
      this.context = null
    }
  }
}

export const crawlerService = new CrawlerService()
