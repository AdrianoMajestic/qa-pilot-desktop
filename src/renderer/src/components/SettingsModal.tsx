import React, { useState, useEffect } from 'react'
import type { AppSettings } from '../types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings: AppSettings | null
  onSave: (newSettings: Partial<AppSettings>) => Promise<void>
  onLog?: (message: string, level?: 'info' | 'warn' | 'error' | 'success', source?: string) => void
}

interface SettingsModalContentProps {
  onClose: () => void
  currentSettings: AppSettings | null
  onSave: (newSettings: Partial<AppSettings>) => Promise<void>
  onLog?: (message: string, level?: 'info' | 'warn' | 'error' | 'success', source?: string) => void
}

const SettingsModalContent: React.FC<SettingsModalContentProps> = ({
  onClose,
  currentSettings,
  onSave
}) => {
  const [apiKey, setApiKey] = useState(currentSettings?.geminiApiKey || '')
  const [geminiModel, setGeminiModel] = useState<AppSettings['geminiModel']>(
    currentSettings?.geminiModel || 'gemini-1.5-flash'
  )
  const [showApiKey, setShowApiKey] = useState(false)
  const [showBrowser, setShowBrowser] = useState(!currentSettings?.playwrightHeadless)
  const [timeoutSec, setTimeoutSec] = useState(
    Math.round((currentSettings?.testTimeoutMs || 30000) / 1000)
  )
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !isSaving) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

    try {
      const result = await electronService.testGeminiConnection(trimmed, geminiModel)
      if (result.success) {
        setKeyStatus('active')
        setStatusFeedback(result.message)
      } else {
        setKeyStatus('error')
        setStatusFeedback(result.message)
      }

      // If running in web fallback where Main loggerService cannot broadcast, emit via onLog
      if (typeof window === 'undefined' || !window.api) {
        onLog?.(result.message, result.success ? 'success' : 'error', 'Gemini AI')
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Неизвестная ошибка проверки подключения'
      setKeyStatus('error')
      setStatusFeedback(errMsg)

      if (typeof window === 'undefined' || !window.api) {
        onLog?.(`Ошибка проверки ключа: ${errMsg}`, 'error', 'Gemini AI')
      }
    }
  }

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setValidationError(null)

    if (isNaN(timeoutSec) || timeoutSec < 1 || timeoutSec > 600) {
      setValidationError('Таймаут должен быть в диапазоне от 1 до 600 секунд.')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        geminiApiKey: apiKey.trim(),
        geminiModel,
        playwrightHeadless: !showBrowser,
        testTimeoutMs: timeoutSec * 1000
      })

      setToastMessage('Настройки приложения успешно сохранены!')
      setTimeout(() => {
        setToastMessage(null)
        onClose()
      }, 1000)
    } catch (err) {
      setValidationError(
        `Ошибка сохранения настроек: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none transition-all duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose()
      }}
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Настройки приложения</h2>
              <p className="text-xs text-slate-400">
                Конфигурация AI-интеграций и тестового окружения
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Закрыть (Esc)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Toast / Alert inside modal */}
        {toastMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-medium">{toastMessage}</span>
          </div>
        )}

        {validationError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="font-medium">{validationError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Gemini API Key Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="gemini-key" className="text-xs font-semibold text-slate-200">
                Google Gemini API Key
              </label>

              {apiKey.trim() ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
                  <span className="text-emerald-400 font-bold">✓</span>
                  Задан
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Не задан
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="gemini-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 pr-10 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  title={showApiKey ? 'Скрыть ключ' : 'Показать ключ'}
                >
                  {showApiKey ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              API-токен используется главным процессом для анализа архитектуры и формирования отчёта Gemini.
            </p>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Gemini Model Selection */}
          <div className="space-y-1.5">
            <label htmlFor="gemini-model" className="text-xs font-semibold text-slate-200 block">
              Модель Google Gemini
            </label>
            <div className="relative">
              <select
                id="gemini-model"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value as AppSettings['geminiModel'])}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                <option value="gemini-1.5-flash">gemini-1.5-flash (Быстрая модель)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Глубокий анализ кода)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash (Flash 2.0)</option>
                <option value="gemini-3.6-flash">
                  gemini-3.6-flash (Новейшая стабильная модель Google Gemini)
                </option>
                <option value="gemini-3.8-flash">gemini-3.8-flash (Gemini 3.8 Flash)</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-400">
              Используется сервисами архитектурного анализа, стектрейс-диагностики и генератора
              отчётов.
            </p>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Playwright Headless / Headed Toggle Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  Показывать браузер при автоматическом тестировании
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {showBrowser
                    ? 'Headed режим: окно браузера открывается для визуальной демонстрации'
                    : 'Headless режим: тесты выполняются скрытно в фоновом режиме'}
                </span>
              </div>

              {/* Custom Switch Component */}
              <button
                type="button"
                role="switch"
                aria-checked={showBrowser}
                onClick={() => setShowBrowser(!showBrowser)}
                className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showBrowser ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showBrowser ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Test Timeout Section */}
          <div className="space-y-1.5">
            <label htmlFor="timeout-sec" className="text-xs font-semibold text-slate-200 block">
              Таймаут операций Playwright (секунды)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="timeout-sec"
                type="number"
                min="1"
                max="600"
                step="1"
                value={timeoutSec}
                onChange={(e) => setTimeoutSec(parseInt(e.target.value, 10) || 0)}
                className="w-32 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <span className="text-xs text-slate-400">
                сек. (эквивалентно {(timeoutSec * 1000).toLocaleString()} мс)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Максимальное время ожидания загрузки страницы, поиска DOM-селекторов и выполнения
              шагов тестового раннера.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
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
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Сохранить</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSave,
  onLog
}) => {
  if (!isOpen) return null

  return (
    <SettingsModalContent
      key={`${currentSettings?.geminiApiKey ?? 'initial'}-${currentSettings?.geminiModel ?? 'default'}`}
      onClose={onClose}
      currentSettings={currentSettings}
      onSave={onSave}
      onLog={onLog}
    />
  )
}
