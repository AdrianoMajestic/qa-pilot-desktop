import { GoogleGenAI } from '@google/genai'
import { getSettings } from './settingsStore'
import { loggerService } from './loggerService'
import type { GeminiConnectionTestResult } from '@shared/types'

/**
 * Default Gemini model used for automated analysis and connection testing.
 */
export const GEMINI_DEFAULT_MODEL = 'gemini-1.5-flash'

/**
 * Retrieves the currently active Gemini API key.
 * Checks persistent settingsStore first, then falls back to process.env.
 */
export function getApiKey(): string {
  try {
    const settings = getSettings()
    if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
      return settings.geminiApiKey.trim()
    }
  } catch (error) {
    console.warn('[GeminiClient] Failed to read API key from settingsStore:', error)
  }

  const envKey = process.env.MAIN_VITE_GEMINI_API_KEY
  return typeof envKey === 'string' ? envKey.trim() : ''
}

/**
 * Parses diverse Google Gemini API errors into user-friendly Russian explanations.
 */
export function parseGeminiError(error: unknown): string {
  if (!error) {
    return 'Неизвестная ошибка API'
  }

  const err = error as Record<string, unknown>
  const status = typeof err.status === 'number' ? err.status : undefined
  const rawMessage = typeof err.message === 'string' ? err.message : String(error)

  // 1. Invalid API Key
  if (
    status === 400 ||
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.includes('API key not valid') ||
    rawMessage.includes('INVALID_ARGUMENT')
  ) {
    return 'Неверный API-ключ Gemini (400: API_KEY_INVALID). Пожалуйста, проверьте корректность токена в Google AI Studio.'
  }

  // 2. Rate limit / Quota exceeded
  if (
    status === 429 ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.includes('quota') ||
    rawMessage.includes('rate limit')
  ) {
    return 'Превышена квота запросов к Google Gemini API (429: RESOURCE_EXHAUSTED). Проверьте лимиты вашего тарифного плана в Google AI Studio.'
  }

  // 3. Network or connectivity errors
  if (
    rawMessage.includes('fetch failed') ||
    rawMessage.includes('ENOTFOUND') ||
    rawMessage.includes('ECONNREFUSED') ||
    rawMessage.includes('ETIMEDOUT') ||
    rawMessage.includes('network')
  ) {
    return 'Ошибка сетевого подключения к Google Gemini API. Проверьте интернет-соединение или настройки прокси/VPN.'
  }

  // 4. Model not found or deprecated
  if (status === 404 || rawMessage.includes('NOT_FOUND') || rawMessage.includes('models/')) {
    return `Запрошенная модель "${GEMINI_DEFAULT_MODEL}" недоступна или не найдена (404: NOT_FOUND).`
  }

  // 5. Access forbidden
  if (status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    return 'Доступ к модели запрещен (403: PERMISSION_DENIED). Проверьте права и ограничения региона для вашего API-ключа.'
  }

  return `Ошибка Google Gemini API: ${rawMessage.length > 200 ? rawMessage.slice(0, 200) + '...' : rawMessage}`
}

/**
 * Performs a lightweight healthcheck ping to verify that the Gemini API key is valid
 * and that Google Gemini API is reachable.
 */
export async function testGeminiConnection(
  overrideApiKey?: string
): Promise<GeminiConnectionTestResult> {
  const activeKey = overrideApiKey?.trim() || getApiKey()

  if (!activeKey) {
    const errorMsg = 'API-ключ Gemini не задан. Укажите ключ в настройках приложения.'
    loggerService.warn('ai', errorMsg)
    return {
      success: false,
      message: errorMsg
    }
  }

  loggerService.info(
    'ai',
    `Проверка подключения к Google Gemini API (модель: ${GEMINI_DEFAULT_MODEL})...`
  )

  try {
    const client = new GoogleGenAI({ apiKey: activeKey })

    const response = await client.models.generateContent({
      model: GEMINI_DEFAULT_MODEL,
      contents: 'Ping'
    })

    const reply = response.text ? response.text.trim() : 'OK'
    const successMsg = `Успешное подключение к Google Gemini API (модель: ${GEMINI_DEFAULT_MODEL}, ответ: "${reply.length > 30 ? reply.slice(0, 30) + '...' : reply}")`

    loggerService.success('ai', successMsg)

    return {
      success: true,
      message: successMsg
    }
  } catch (error: unknown) {
    const parsedError = parseGeminiError(error)
    loggerService.error('ai', `Ошибка подключения к Google Gemini API: ${parsedError}`)

    return {
      success: false,
      message: parsedError
    }
  }
}

/**
 * Universal text generation helper with robust error handling and fallback messages.
 * Used by subsequent AI reasoning, code analysis, and test generation modules.
 */
export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const activeKey = getApiKey()
  if (!activeKey) {
    throw new Error('API-ключ Gemini не настроен. Укажите ключ в настройках приложения.')
  }

  try {
    const client = new GoogleGenAI({ apiKey: activeKey })

    const response = await client.models.generateContent({
      model: GEMINI_DEFAULT_MODEL,
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined
    })

    const resultText = response.text?.trim()
    if (!resultText) {
      throw new Error('Google Gemini API вернул пустой текстовый ответ.')
    }

    return resultText
  } catch (error: unknown) {
    const parsedError = parseGeminiError(error)
    throw new Error(`Сбой генерации текста Gemini: ${parsedError}`)
  }
}
