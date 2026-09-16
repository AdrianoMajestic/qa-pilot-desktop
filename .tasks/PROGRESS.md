# Прогресс разработки QA Pilot Desktop

## Текущий статус проекта

- **Фаза:** Архитектурный регламент системы, бэклог модулей, локальный сканер проектов, русская локализация UI и IPC-мост полностью завершены.
- **Дата обновления:** 16 сентября 2026 г.

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

### 3. Preload Bridge и типизация (`src/preload/`, `src/renderer/src/types/`)

- [x] Описать строгие TypeScript-интерфейсы `FileNode`, `ProjectStats`, `ProjectScanResult` (без `any`)
- [x] Добавить метод `window.api.selectProject()` в `src/preload/index.ts` и `src/preload/index.d.ts`
- [x] Интегрировать метод в `src/renderer/src/services/electronService.ts` с безопасным fallback для web-среды
- [x] Добавить типы состояния проекта в `src/renderer/src/types/index.ts`

### 4. Русская локализация и интеграция UI (`src/renderer/src/`)

- [x] `Topbar.tsx`: полная русификация, кнопка "Выбрать проект" / "Открыть проект", отображение имени открытого проекта
- [x] `Sidebar.tsx`: полная русификация навигации, рекурсивная визуализация дерева файлов со сворачиванием/разворачиванием папок и иконками типов файлов
- [x] `Dashboard.tsx`: полная русификация, блок статистики проекта (путь, файлы, JS/TS файлы, JSON, папки), кнопка выбора проекта
- [x] `ConsoleLogs.tsx`: полная русификация элементов управления и статусов (ИНФО, ПРЕД, ОШИБ, УСПЕХ)
- [x] `App.tsx`: централизованное управление состоянием проекта, форматированные логи процесса сканирования с временными метками

### 5. Верификация и тестирование

- [x] Проверка типов: `pnpm typecheck` (tsc node + web без ошибок)
- [x] Линтер и форматирование: `pnpm lint` и `pnpm format` (0 ошибок, 0 предупреждений)
- [x] Валидация сборки: `pnpm build` (успешная сборка main, preload, renderer)

---

## Журнал изменений (Changelog)

- **16.09.2026**:
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
