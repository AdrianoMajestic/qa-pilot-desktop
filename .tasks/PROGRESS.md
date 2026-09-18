# Прогресс разработки QA Pilot Desktop

## Текущий статус проекта

- **Фаза:** Реализован сервис запуска тестов Playwright Test Runner с выбором браузеров (Chromium/Firefox/WebKit) и headed-режимом по умолчанию, модуль автоматизированного обхода веб-приложения (BFS краулер) с эмуляцией пользовательских действий, потоковая передача логов и событий воркеров в реальном времени, селективный парсер кода для Gemini AI, дашборд и сканер.
- **Дата обновления:** 18 сентября 2026 г.

## Регламент работы

1. **Перед внесением любых изменений в код** обязательно прочитать `.tasks/PROGRESS.md`, `ARCHITECTURE.md` и `BACKLOG.md`.
2. **После завершения этапа** обновить чек-боксы `[x]` и зафиксировать список созданных/изменённых файлов в журнале изменений.

---

## Задачи текущего спринта

### 1. Архитектурное управление и протокол задач

- [x] Создать директорию `.tasks/`
- [x] Создать и поддерживать `.tasks/PROGRESS.md` с актуальным роадмапом и статусом
- [x] Создать регламент архитектуры `ARCHITECTURE.md` (модель изоляции процессов, стандарты именования, безопасность, запрет несанкционированных UI-библиотек)
- [x] Создать структурированный бэклог `BACKLOG.md` (модули `[FRONTEND]`, `[BACKEND & IPC]`, `[CORE ENGINE]`, `[AI INTEGRATION]`)

### 2. Главный процесс Electron (`src/main/`)

- [x] Реализовать IPC-обработчик `dialog:select-project` (`src/main/ipc/handlers.ts`)
- [x] Реализовать рекурсивный обход директорий с исключением: `node_modules`, `.git`, `dist`, `build`, `.next`, `out`, `.vscode`, `pnpm-lock.yaml`, `package-lock.json`, `coverage`
- [x] Реализовать расчет статистики: общее количество файлов, папок, JS/TS файлов, JSON файлов
- [x] Обеспечить безопасный парсинг дерева файлов в JSON без циклических ссылок
- [x] Реализовать сервис селективного парсера кода `src/main/services/projectParser.ts` с безопасным чтением файлов (лимит 100 КБ) и автоматической детекцией стека (React, Next.js, Vue, Playwright, Jest, Vitest, Cypress, TypeScript, Tailwind)
- [x] Зарегистрировать обработчик IPC-канала `project:parse-context` (`src/main/ipc/handlers.ts`)
- [x] Реализовать сервис `src/main/services/loggerService.ts` для потоковой передачи событий воркеров и логов в реальном времени через `webContents.send('stream:log-event')`
- [x] Зарегистрировать обработчик диагностического IPC-канала `app:trigger-test-log` (`src/main/ipc/handlers.ts`)
- [x] Реализовать сервис настроек `src/main/services/settingsService.ts` и `settingsStore.ts` для персистентного хранения конфигурации приложения в `settings.json` (`app.getPath('userData')`)
- [x] Зарегистрировать IPC-обработчики `settings:get` и `settings:save` в `src/main/ipc/handlers.ts`
- [x] Установить официальный Google Gen AI SDK (`@google/genai`) как production-зависимость в `package.json`
- [x] Реализовать клиентский сервис `src/main/services/geminiClient.ts` с динамическим чтением API-ключа из `settingsStore` / `process.env`, методами `getApiKey()`, `testGeminiConnection()` и `generateText()`
- [x] Зарегистрировать IPC-обработчик `ai:test-connection` в `src/main/ipc/handlers.ts`
- [x] Реализовать сервис запуска тестов Playwright `src/main/services/playwrightRunner.ts` с поддержкой Chromium/Firefox/WebKit, headed mode по умолчанию, отменой и стримингом в `loggerService`
- [x] Зарегистрировать IPC-обработчики `playwright:run`, `playwright:stop`, `playwright:status` в `src/main/ipc/handlers.ts`
- [x] Реализовать сервис автоматического обхода веб-приложения `src/main/services/crawlerService.ts` с BFS-обходом страниц, обнаружением форм/полей ввода, эмуляцией взаимодействий, контролем домена и глубины
- [x] Зарегистрировать IPC-обработчики `crawler:start`, `crawler:stop` в `src/main/ipc/handlers.ts`

### 3. Preload Bridge и типизация (`src/preload/`, `src/renderer/src/types/`, `src/shared/types/`)

- [x] Создать единый изолированный модуль чистых типов `src/shared/types/` и корневой модуль `src/shared/index.ts` (zero runtime dependencies)
- [x] Настроить скоупы и алиасы `@shared/*` в `tsconfig.node.json`, `tsconfig.web.json` и `electron.vite.config.ts`
- [x] Устранить нарушение границ проекта TypeScript: убрать все относительные импорты `../../../preload/index` из `src/renderer/`
- [x] Описать строгие TypeScript-интерфейсы `FileNode`, `ProjectStats`, `ProjectScanResult` (без `any`)
- [x] Описать строгие TypeScript-интерфейсы `ProjectContext`, `PackageJsonSummary`, `DetectedStack`, `ConfigFileInfo`, `EntryPointInfo`
- [x] Описать строгие TypeScript-интерфейсы `LogLevel`, `LogSource`, `LogEvent`
- [x] Описать строгий интерфейс `AppSettings` в `src/shared/types` и константы каналов `SETTINGS_GET`, `SETTINGS_SAVE`
- [x] Описать строгий интерфейс `GeminiConnectionTestResult` и константу канала `AI_TEST_CONNECTION`
- [x] Добавить метод `window.api.selectProject()` в `src/preload/index.ts` и `src/preload/index.d.ts`
- [x] Добавить метод `window.api.parseProjectContext()` в `src/preload/index.ts` и `src/preload/index.d.ts`
- [x] Добавить методы `window.api.getSettings()` и `window.api.saveSettings()` в `src/preload/index.ts` и `src/preload/index.d.ts`
- [x] Добавить метод `window.api.testGeminiConnection(apiKey?: string)` в `src/preload/index.ts` и `src/preload/index.d.ts`
- [x] Описать интерфейсы Playwright `PlaywrightRunOptions`, `PlaywrightRunStatus`, `PlaywrightBrowser` и каналы `PLAYWRIGHT_RUN`, `PLAYWRIGHT_STOP`, `PLAYWRIGHT_STATUS`
- [x] Добавить метод `window.api.selectProject()` в `src/preload/index.ts` и `src/preload/index.d.ts`
- [x] Добавить метод `window.api.parseProjectContext()` в `src/preload/index.ts` и `src/preload/index.d.ts`
- [x] Добавить методы `window.api.getSettings()` и `window.api.saveSettings()` в `src/preload/index.ts` и `src/preload/index.d.ts`
- [x] Добавить методы `window.api.runPlaywright()`, `stopPlaywright()`, `getPlaywrightStatus()` в `src/preload/index.ts` и `CustomAPI`
- [x] Добавить метод потоковой подписки `window.api.onLogEvent(callback)` с обязательной функцией отписки `removeListener` для защиты от утечек памяти
- [x] Добавить метод вызова `window.api.triggerTestLog()`
- [x] Экспортировать `window.electronAPI` для совместимости
- [x] Добавить методы `window.api.startCrawler()` и `window.api.stopCrawler()` в `src/preload/index.ts` и `CustomAPI`
- [x] Интегрировать методы краулера в `src/renderer/src/services/electronService.ts` с безопасным fallback для web-среды
- [x] Интегрировать методы в `src/renderer/src/services/electronService.ts` с безопасным fallback для web-среды
- [x] Реэкспортировать общие типы в `src/renderer/src/types/index.ts` из `@shared/types`

### 4. Русская локализация и интеграция UI (`src/renderer/src/`)

- [x] `Topbar.tsx`: полная русификация, кнопка "Выбрать проект" / "Открыть проект", кнопка "Настройки" с шестеренкой ⚙️, отображение имени открытого проекта
- [x] `Sidebar.tsx`: полная русификация навигации, рекурсивная визуализация дерева файлов со сворачиванием/разворачиванием папок и иконками типов файлов
- [x] `Dashboard.tsx`: полная русификация, блок статистики проекта (путь, файлы, JS/TS файлы, JSON, папки), кнопка выбора проекта
- [x] `ConsoleLogs.tsx`: полная русификация элементов управления и статусов (ИНФО, ПРЕД, ОШИБ, УСПЕХ), бейджи источников (Playwright, Краулер, Gemini AI, Система), кнопка вызова тестового импульса IPC, форматирование меток времени `[16:20:00]`
- [x] `SettingsModal.tsx`: полноценное модальное окно настроек (ввод и безопасный просмотр Gemini API Key, кнопка "Проверить ключ", динамический бейдж статуса "Проверка...", "✓ Ключ активен", "✗ Ошибка API ключа", переключатель Headless/Headed режима, таймаут тестов)
- [x] `useLogStream.ts`: кастомный хук подписки на поток IPC-логов с автоматической отпиской при размонтировании
- [x] `App.tsx`: централизованное управление состоянием проекта, синхронизация настроек с главным процессом через `electronService`, проброс `onLog` в `SettingsModal`

### 5. Виджеты визуального дашборда (Visual Dashboard Widgets)

- [x] Описать строгие TypeScript-интерфейсы `OverallScoreData`, `HealthRadarData`, `RadarAxisMetric` в `src/renderer/src/types/dashboard.types.ts`
- [x] Создать радиальный/круговой SVG-индикатор `OverallScoreWidget.tsx` с динамической цветовой кодировкой порогов (< 50: красный, 50–79: янтарный, 80+: изумрудный)
- [x] Создать мультиосевую паутинную/радарную SVG-диаграмму `HealthRadarWidget.tsx` на 6 осей (Покрытие кода, AI Анализ, Безопасность, Здоровье зависимостей, Стабильность рантайма, Успешность тестов)
- [x] Создать базовый контейнер `DashboardOverview.tsx` с набором мок-данных и интерактивным переключением сценариев аудита
- [x] Интегрировать `DashboardOverview` в `Dashboard.tsx` с адаптивной версткой при изменении размера боковой панели

### 6. Верификация и тестирование

- [x] Проверка типов: `pnpm typecheck` (tsc node + web без ошибок)
- [x] Линтер и форматирование: `pnpm lint` и `pnpm format` (0 ошибок, 0 предупреждений)
- [x] Валидация сборки: `pnpm build` (успешная сборка main, preload, renderer)

---

## Журнал изменений (Changelog)

- **18.09.2026 (Модуль автоматизированного обхода веб-приложения — CrawlerService)**:
  - Установлена зависимость `playwright` (`pnpm add playwright`) для использования Playwright library API в главном процессе.
  - Формализованы интерфейсы `CrawlerOptions`, `DiscoveredInput`, `DiscoveredForm`, `DiscoveredPage`, `CrawlResult` и константы каналов `CRAWLER_START`, `CRAWLER_STOP` в `@shared/types`.
  - Создан сервис `src/main/services/crawlerService.ts`: BFS-обход веб-приложения через Playwright Chromium, извлечение ссылок `<a href>` с фильтрацией по домену, обнаружение форм (`<form>`) и интерактивных элементов (`<input>`, `<textarea>`, `<select>`, `<button>`), опциональная эмуляция заполнения полей тестовыми данными (`qa-test-input`), захват JS console errors и page errors.
  - Реализован механизм контроля обхода: `maxDepth` (по умолчанию 3), `maxPages` (по умолчанию 30), `sameDomainOnly` (по умолчанию true), `emulateFormSubmission` (по умолчанию false — безопасный режим).
  - Реализован механизм остановки `stopCrawl()` с graceful-закрытием браузера Playwright и синхронной очисткой по хуку `app.on('before-quit')`.
  - Весь прогресс обхода транслируется в реальном времени через `loggerService` с `source: 'crawler'`.
  - Зарегистрированы IPC-обработчики `IPC_CHANNELS.CRAWLER_START` и `IPC_CHANNELS.CRAWLER_STOP` в `src/main/ipc/handlers.ts`.
  - В Preload-мосте `src/preload/index.ts` и типе `CustomAPI` открыты методы `startCrawler`, `stopCrawler`.
  - В `src/renderer/src/services/electronService.ts` добавлены методы управления краулером с безопасным web-fallback.
  - Обновлены `BACKLOG.md` (отмечена задача автокраулера) и `ARCHITECTURE.md` (таблица IPC-каналов: `crawler:start`, `crawler:stop`).
  - Проведена полная проверка качества: `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm build` завершились успешно с кодом 0.

- **17.09.2026 (Интеграция сервиса Playwright Test Runner в главном процессе)**:
  - Формализованы интерфейсы `PlaywrightRunOptions`, `PlaywrightRunStatus`, `PlaywrightBrowser` (`chromium`, `firefox`, `webkit`) и константы каналов `PLAYWRIGHT_RUN`, `PLAYWRIGHT_STOP`, `PLAYWRIGHT_STATUS` в `@shared/types`.
  - Создан сервис `src/main/services/playwrightRunner.ts`: запуск Playwright тестов через внешний процесс `npx playwright test`, выбор браузера `--project=<browser>`, headed-режим по умолчанию `--headed` с учетом пользовательских настроек, стриминг `stdout`/`stderr` в реальном времени в `loggerService` с фильтрацией ANSI и цветной маркировкой уровней (`success`, `error`, `warn`, `info`).
  - Реализован механизм остановки тестов `stopTests()` с форсированным удалением дерева процессов через `taskkill /pid ... /T /F` на Windows и `SIGTERM`/`SIGKILL` на POSIX, а также синхронная очистка `stopTestsSync()` по хуку `app.on('before-quit')`.
  - Зарегистрированы IPC-обработчики `IPC_CHANNELS.PLAYWRIGHT_RUN`, `IPC_CHANNELS.PLAYWRIGHT_STOP` и `IPC_CHANNELS.PLAYWRIGHT_STATUS` в `src/main/ipc/handlers.ts` (с сохранением обратной совместимости для `worker:playwright-run`).
  - В Preload-мосте `src/preload/index.ts` и типе `CustomAPI` открыты методы `runPlaywright`, `stopPlaywright`, `getPlaywrightStatus`.
  - В `src/renderer/src/services/electronService.ts` добавлены методы управления Playwright с безопасным web-fallback.
  - Обновлены `BACKLOG.md` (отмечена задача Playwright Test Runner) и `ARCHITECTURE.md` (таблица IPC-каналов).

- **17.09.2026 (Сервис постоянных настроек и интеграция модального окна SettingsModal)**:
  - Формализован интерфейс `AppSettings` (`geminiApiKey`, `playwrightHeadless`, `testTimeoutMs`) в `@shared/types` и добавлены константы каналов `SETTINGS_GET`, `SETTINGS_SAVE`.
  - Создан сервис `src/main/services/settingsService.ts` с асинхронными методами `getSettings()` и `saveSettings(partial)`, использующий надежное атомарное хранение в `userData/settings.json` (`settingsStore.ts`).
  - Зарегистрированы IPC-обработчики `IPC_CHANNELS.SETTINGS_GET` и `IPC_CHANNELS.SETTINGS_SAVE` в `src/main/ipc/handlers.ts`.
  - В Preload-мосте `src/preload/index.ts` и `src/preload/index.d.ts` реализованы методы `getSettings` и `saveSettings` в интерфейсе `CustomAPI`.
  - В `src/renderer/src/services/electronService.ts` добавлены методы вызова моста с безопасным браузерным web-fallback.
  - В `App.tsx` завершена интеграция модального окна `SettingsModal`, загрузка настроек при старте и сохранение изменений с логированием в консоль.
  - Обновлен контракт IPC каналов в `ARCHITECTURE.md`.
  - Проведена полная проверка качества: `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm build` завершились успешно с кодом 0.

- **17.09.2026 (Устранение нарушений границ проектов TypeScript и выделение `src/shared/types`)**:
  - Создан выделенный модуль чистых типов `src/shared/types/index.ts` и корневой модуль `src/shared/index.ts` с нулевыми рантайм-зависимостями.
  - Перенесены все общие DTO, модели и интерфейсы: `SystemInfo`, `PlaywrightRunResult`, `FileNode`, `ProjectStats`, `ProjectScanResult`, `PackageJsonSummary`, `DetectedStack`, `ConfigFileInfo`, `EntryPointInfo`, `ProjectContext`, `LogLevel`, `LogSource`, `LogEvent`, `TriggerTestLogParams`, `IPC_CHANNELS`, `CustomAPI`, `ElectronAPI`.
  - Обновлены конфигурации TypeScript: в `tsconfig.node.json` и `tsconfig.web.json` добавлен путь `"src/shared/**/*"` в `include` и настроен алиас `"@shared/*": ["src/shared/*"]`.
  - В `electron.vite.config.ts` зарегистрирован алиас `'@shared': resolve('src/shared')` для всех трех таргетов (`main`, `preload`, `renderer`).
  - Проведен рефакторинг `src/preload/index.ts` и `src/preload/index.d.ts`: убрано дублирование определений типов, внедрен импорт из `@shared/types`.
  - Проведен рефакторинг рендерера: в `src/renderer/src/services/electronService.ts`, `src/renderer/src/hooks/useLogStream.ts` и `src/renderer/src/types/index.ts` устранены прямые импорты из `src/preload/index.ts` (заменены на `@shared/types`).
  - Проведен рефакторинг главного процесса: `src/main/services/loggerService.ts`, `src/main/services/projectParser.ts` и `src/main/ipc/handlers.ts` переведены на `@shared/types` и константы `IPC_CHANNELS`.
  - В `ARCHITECTURE.md` добавлен раздел 1.4 с регламентом совместного использования типов через `src/shared/types` и строгим запретом на кросс-импорты реализации предзагрузки в UI.
  - Проведена полная проверка качества: `pnpm typecheck`, `npx tsc -p tsconfig.web.json --noEmit`, `pnpm lint`, `pnpm format`, `pnpm build` завершились успешно с кодом 0.

- **17.09.2026 (Потоковая передача логов и событий воркеров в реальном времени)**:
  - Создан сервис `src/main/services/loggerService.ts`: широковещательная трансляция событий воркеров и системы через `webContents.send('stream:log-event', payload)` с генерацией уникальных `id`, меток времени `timestamp`, уровней `LogLevel` (`info`, `warn`, `error`, `success`) и источников `LogSource` (`system`, `playwright`, `crawler`, `ai`).
  - Реализован IPC-обработчик `app:trigger-test-log` в `src/main/ipc/handlers.ts` и добавлено логирование событий запуска Playwright воркера и парсинга контекста Gemini.
  - В Preload-мосте `src/preload/index.ts` и `src/preload/index.d.ts` реализован метод `onLogEvent(callback)`, возвращающий функцию очистки `() => ipcRenderer.removeListener(...)` для защиты от накопления слушателей и утечек памяти в React.
  - Создан кастомный React-хук `src/renderer/src/hooks/useLogStream.ts` с подпиской на поток IPC, форматированием источников и автоматической очисткой при unmount.
  - Обновлен `ConsoleLogs.tsx`: добавлены цветные бейджи источников, индикатор активности IPC-стриминга и кнопка "Тест IPC" для проверки в реальном времени.
  - Интегрирован `useLogStream` в `App.tsx` и `electronService.ts`.
  - Обновлен `BACKLOG.md` (отмечена задача потоковой передачи) и `ARCHITECTURE.md` (добавлены `stream:log-event` и `app:trigger-test-log`).
  - Проведена полная валидация: `pnpm typecheck`, `pnpm lint`, `pnpm build` завершились успешно с кодом 0.

- **17.09.2026 (Селективный парсер исходного кода для Gemini AI)**:
  - Создан сервис `src/main/services/projectParser.ts`: безопасное чтение `package.json`, конфигурационных файлов (`playwright.config.*`, `tsconfig*.json`, `vite.config.*`, `next.config.*`, `tailwind.config.*`, `eslint.config.*`) и точек входа (`src/main.tsx`, `src/App.tsx`, `src/index.ts`, `src/main/index.ts`) с лимитом размера 100 КБ и защитой от зависания памяти.
  - Реализован анализатор технологического стека `detectStack`: автоматическое определение фреймворков (`React`, `Electron`, `Vue`, `Next.js`), тестовых раннеров (`Playwright`, `Jest`, `Vitest`, `Cypress`), языка (`TypeScript`/`JavaScript`), стилей (`Tailwind CSS`) и сборщиков (`electron-vite`, `Vite`, `Webpack`).
  - Генерация markdown-саммари `buildMarkdownSummary` для контекстной инъекции в Google Gemini API.
  - Зарегистрирован IPC-канал `project:parse-context` в `src/main/ipc/handlers.ts`.
  - Обновлены типы и мост в `src/preload/index.ts` и `src/preload/index.d.ts` (`parseProjectContext`, `window.api`, `window.electronAPI`).
  - Добавлен метод `parseProjectContext` с web-fallback в `src/renderer/src/services/electronService.ts`.
  - Обновлен `BACKLOG.md` (отмечена задача селективного парсера) и таблица IPC каналов в `ARCHITECTURE.md`.
  - Успешно протестирована работа парсера, валидация `pnpm typecheck`, `pnpm lint`, `pnpm build` завершилась с кодом 0.

- **17.09.2026**:
  - Создан `src/renderer/src/types/dashboard.types.ts`: формализованы типы данных `OverallScoreData`, `HealthRadarData`, `RadarAxisMetric`, `ScoreTrend`, `ScoreBreakdown` и props для виджетов.
  - Реэкспортированы dashboard types в `src/renderer/src/types/index.ts`.
  - Создан `src/renderer/src/components/OverallScoreWidget.tsx`: круговой SVG-индикатор с анимированным заполнением дуги (`strokeDashoffset`), градиентами, эффектом свечения (`feDropShadow`), центрированным числовым значением скоринга, шкалой порогов (< 50 красный, 50–79 янтарный, 80+ изумрудный) и динамикой к прошлому запуску.
  - Создан `src/renderer/src/components/HealthRadarWidget.tsx`: радарная/паутинная SVG-диаграмма на 6 осей (`Code Coverage`, `AI Insights`, `Security`, `Dependency Health`, `Runtime Stability`, `Test Success`), многоуровневая концентрическая полигональная сетка, пунктирный контур бенчмарка (80%), интерактивные вершины с анимацией пульсации при наведении и боковая панель с описанием осей.
  - Создан `src/renderer/src/components/DashboardOverview.tsx`: базовый контейнер визуального дашборда с реалистичными мок-данными QA Pilot, интерактивным переключением срезов (86% оптимально, 68% внимание, 42% критично) для проверки порогов и плавной адаптацией к изменению ширины сайдбара.
  - Интегрирован `DashboardOverview` в `src/renderer/src/components/Dashboard.tsx`.
  - Обновлен `BACKLOG.md`: отмечена выполненной задача по виджетам визуального дашборда.
  - Проведена полная валидация: `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm build` завершились успешно с кодом 0.

- **16.09.2026**:
  - Устранены ошибки компиляции TypeScript в IDE:
    - Исправлен импорт в `src/renderer/src/services/electronService.ts`: типы `SystemInfo`, `PlaywrightRunResult`, `ProjectScanResult` вынесены в `src/renderer/src/types/index.ts`, исключив нарушение границ проекта через импорт из `src/preload/index.ts`.
    - Скорректирован `tsconfig.web.json`: добавлен `"outDir": "out/renderer"`, предотвращающий ошибку TS5055 (попытка перезаписи `src/preload/index.d.ts` при обработке composite-проекта).
  - Создан `ARCHITECTURE.md`: формализована трехуровневая модель изоляции процессов (`main`, `preload`, `renderer`), политики безопасности (`contextIsolation: true`, отключение `nodeIntegration`), конвенции именования файлов (`PascalCase`, `camelCase`, `*.types.ts`), запрет на сторонние UI-библиотеки без согласования и контракты IPC каналов.
  - Создан `BACKLOG.md`: структурированы 4 ключевые функциональные группы (`[FRONTEND]`, `[BACKEND & IPC]`, `[CORE ENGINE]`, `[AI INTEGRATION]`) с отслеживаемыми чек-боксами.
  - Проведена верификация сборки `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format` — все тесты и сборки завершены с кодом 0.
- **15.09.2026**:
  - Создан протокол `.tasks/PROGRESS.md`.
  - Изменён `src/main/ipc/handlers.ts`: добавлен обработчик `dialog:select-project`, асинхронный сканер файлов с фильтрацией `node_modules`, `.git`, `dist`, `build`, `.next`, `out`, `.vscode`, `pnpm-lock.yaml`, `package-lock.json`, `coverage` и расчет метрик.
  - Изменён `src/preload/index.ts` и `src/preload/index.d.ts`: типизированы интерфейсы `FileNode`, `ProjectStats`, `ProjectScanResult`, экспортирован метод `selectProject`.
  - Изменён `src/renderer/src/types/index.ts`: добавлены типы для состояния проекта и дерева файлов.
  - Изменён `src/renderer/src/services/electronService.ts`: добавлен метод `selectProject` с web-fallback.
  - Изменён `src/renderer/src/hooks/useSystemStatus.ts`: статус-сообщения переведены на русский язык.
  - Изменён `src/renderer/src/components/Topbar.tsx`: русская локализация, кнопка "Открыть проект", бейдж имени открытого проекта.
  - Изменён `src/renderer/src/components/Sidebar.tsx`: русская локализация пунктов навигации, компонент `FileTreeNode` с иконками типов файлов и подсчетом элементов, кнопка выбора папки.
  - Изменён `src/renderer/src/components/Dashboard.tsx`: полная локализация на русский, карточки метрик выбранного проекта (путь, общее число файлов, JS/TS файлы, JSON, папки), кнопки вызова сканера.
  - Изменён `src/renderer/src/components/ConsoleLogs.tsx`: русская локализация контролов консоли и бейджей уровней логов (ИНФО, ПРЕД, ОШИБ, УСПЕХ).
  - Изменён `src/renderer/src/App.tsx`: управление состоянием сканирования, стриминг форматированных русскоязычных логов в консоль с отметками времени.
  - Изменён `src/renderer/index.html`: атрибут `lang="ru"`.
