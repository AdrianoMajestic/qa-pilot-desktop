# QA Pilot Desktop — Архитектурный регламент и дизайн системы (ARCHITECTURE.md)

Документ устанавливает ключевые правила проектирования, процессной изоляции, стандарты именования и ограничения безопасности для кодовой базы **QA Pilot Desktop**.

---

## 1. Модель изоляции процессов (Process Isolation)

Приложение построено на базе Electron с многопроцессной архитектурой. Строго разделяются зоны ответственности процессов `main`, `preload` и `renderer`.

```
┌─────────────────────────────────────────────────────────────┐
│                 Main Process (src/main)                     │
│  - Node.js Runtime (fs, path, child_process)                │
│  - Electron Lifecycle & Native Dialogs (dialog.showOpenDialog)│
│  - Playwright Test Runner & Execution Orchestrator          │
│  - Gemini API Client & AI Reasoning Engine                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ IPC Channels
                               │ (ipcMain.handle / ipcRenderer.invoke)
┌──────────────────────────────┴──────────────────────────────┐
│                Preload Bridge (src/preload)                 │
│  - contextBridge.exposeInMainWorld                          │
│  - Строго типизированный фасад `window.api`                 │
│  - contextIsolation: true, sandbox: false                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Type-Safe API Window Object
┌──────────────────────────────┴──────────────────────────────┐
│               Renderer Process (src/renderer)               │
│  - React 19 + Tailwind CSS (SPA UI)                         │
│  - НИКАКИХ импортов `fs`, `path`, `child_process`, `electron`│
│  - Вызовы системных функций исключительно через `electronService`│
└─────────────────────────────────────────────────────────────┘
```

### 1.1. Главный процесс (`src/main`)

- **Назначение:** Node.js бэкенд приложения.
- **Разрешено:**
  - Работа с локальной файловой системой OS (`node:fs/promises`, `node:path`).
  - Управление окнами приложения (`BrowserWindow`, `app`, `dialog`, `shell`).
  - Оркестрация Playwright воркеров в отдельных процессах.
  - Обращение к внешним SDK (Google Gemini API, сетевые запросы Node.js).
- **Запрещено:**
  - Использовать DOM-элементы, `window`, `document`, React-компоненты.
  - Напрямую манипулировать версткой интерфейса.

### 1.2. Мост предзагрузки (`src/preload`)

- **Назначение:** Защищенный брокер и фасад между Node.js и браузерным контекстом.
- **Правила:**
  - Доступ к системным операциям экспортируется исключительно через `contextBridge.exposeInMainWorld('api', api)`.
  - Каждый вызов должен быть типизирован в `src/preload/index.d.ts` и `src/preload/index.ts`.
  - Запрещено прокидывать весь объект `ipcRenderer` или сырые Node.js модули в глобальный объект `window`.
  - Запрещено использовать тип `any` в IPC-сигнатурах.

### 1.3. Процесс отображения (`src/renderer`)

- **Назначение:** Пользовательский интерфейс на базе React 19 и Tailwind CSS.
- **Строгие ограничения:**
  - **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** импортировать `fs`, `path`, `child_process`, `electron` или любые Node.js built-ins.
  - Взаимодействие с системным бэкендом осуществляется через фасад `src/renderer/src/services/electronService.ts`, обращающийся к `window.api`.
  - Должна сохраняться корректная работа в web-окружении (web-fallback при отсутствии `window.api`).

---

## 2. Стандарты именования и структура проекта

- **React-компоненты:** `PascalCase.tsx` (например: `Topbar.tsx`, `Sidebar.tsx`, `Dashboard.tsx`, `ConsoleLogs.tsx`).
- **Хуки и сервисы:** `camelCase.ts` (например: `useSystemStatus.ts`, `electronService.ts`).
- **Обработчики IPC:** `camelCase.ts` (например: `registerIpcHandlers()`, `handlers.ts`).
- **Файлы типов и интерфейсов:** `*.types.ts` или `types/index.ts`.
- **Каталоги:** `kebab-case` или смысловые группы (`components`, `hooks`, `services`, `types`, `ipc`).

---

## 3. Политика управления пакетами и зависимостями

- **Менеджер пакетов:** Исключительно `pnpm`. Использование `npm` или `yarn` для установки пакетов запрещено.
- **UI-библиотеки:** **Строго запрещена** несанкционированная установка сторонних тяжеловесных UI-библиотек (MUI, Ant Design, Chakra UI, Radix UI) без прямого указания пользователя.
- **Стилизация:** Tailwind CSS v4 с утилитарными классами в темно-графитовой палитре (VS Code / Discord dark theme: `slate-900`, `slate-950`, акценты `indigo-600`, `emerald-500`, `amber-500`, `rose-500`).

---

## 4. Контракт IPC каналов

| Канал                   | Направление      | Описание                                                 | Сигнатура данных                                               |
| :---------------------- | :--------------- | :------------------------------------------------------- | :------------------------------------------------------------- |
| `app:ping`              | Renderer -> Main | Проверка доступности IPC моста                           | `() => Promise<string>`                                        |
| `app:get-system-info`   | Renderer -> Main | Получение версий среды (Node, Electron, OS, Chrome)      | `() => Promise<SystemInfo>`                                    |
| `dialog:select-project` | Renderer -> Main | Нативный диалог выбора папки + рекурсивный сканер файлов | `() => Promise<ProjectScanResult>`                             |
| `worker:playwright-run` | Renderer -> Main | Триггер запуска тестового сценария Playwright            | `(params: { suite?: string }) => Promise<PlaywrightRunResult>` |
| `project:parse-context` | Renderer -> Main | Селективный парсер исходного кода и конфигов для AI      | `(projectPath: string) => Promise<ProjectContext>`             |

---

## 5. Безопасность и целостность

1. **Context Isolation:** Обязательно включен (`contextIsolation: true`).
2. **Node Integration:** Отключен для рендерера (`nodeIntegration: false`).
3. **Фильтрация файловых операций:** Сканер каталогов жестко фильтрует `node_modules`, `.git`, `dist`, `build`, `.next`, `out`, `.vscode`, `coverage`, исключая зависание памяти и утечки чувствительных данных.
4. **Валидация:** Все изменения в кодовой базе проверяются автоматическими проверками `pnpm typecheck`, `pnpm lint`, `pnpm build`.
