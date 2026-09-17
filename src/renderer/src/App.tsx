import { useState, useCallback, useEffect } from 'react'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { ConsoleLogs } from './components/ConsoleLogs'
import { SettingsModal } from './components/SettingsModal'
import { useSystemStatus } from './hooks/useSystemStatus'
import { electronService } from './services/electronService'
import type { LogEntry, FileNode, ProjectStats, AppSettings } from './types'

export default function App(): React.JSX.Element {
  const { status, loading } = useSystemStatus()
  const [activeTab, setActiveTab] = useState('dashboard')

  // Application Settings State
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Project Scanner State
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [projectStats, setProjectStats] = useState<ProjectStats | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      level: 'info',
      source: 'Система',
      message: 'Приложение QA Pilot Desktop успешно инициализировано.'
    },
    {
      id: 'log-2',
      timestamp: new Date().toLocaleTimeString('ru-RU'),
      level: 'success',
      source: 'Preload IPC',
      message: 'Мост контекстной изоляции установлен успешно.'
    }
  ])

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

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  // Pre-load settings on initial app load
  useEffect(() => {
    electronService
      .getSettings()
      .then((loaded) => {
        setSettings(loaded)
      })
      .catch((err) => {
        addLog(
          `Ошибка загрузки конфигурации: ${err instanceof Error ? err.message : 'Сбой'}`,
          'warn',
          'Настройки'
        )
      })
  }, [addLog])

  const handleSaveSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      const saved = await electronService.saveSettings(newSettings)
      setSettings(saved)
      addLog('Настройки приложения успешно сохранены.', 'success', 'Настройки')
    },
    [addLog]
  )

  const handleSelectProject = useCallback(async () => {
    setIsScanning(true)
    addLog('Открытие диалога выбора папки проекта...', 'info', 'Диалог')

    try {
      const result = await electronService.selectProject()

      if (result.canceled) {
        addLog('Выбор папки отменен пользователем.', 'warn', 'Сканер')
        return
      }

      if (result.error) {
        addLog(`Ошибка при сканировании каталога: ${result.error}`, 'error', 'Сканер')
        return
      }

      if (result.projectPath && result.fileTree) {
        setProjectPath(result.projectPath)
        setProjectName(result.projectName || 'Проект')
        setFileTree(result.fileTree)
        setProjectStats(result.stats || null)

        addLog(`Проект выбран: ${result.projectPath}`, 'info', 'Сканер')

        const stats = result.stats
        const filesCount = stats?.totalFiles ?? 0
        const foldersCount = stats?.totalFolders ?? 0
        const jsTsCount = stats?.jsTsFilesCount ?? 0
        const jsonCount = stats?.jsonFilesCount ?? 0

        addLog(
          `Просканировано ${filesCount} файлов, ${foldersCount} папок (JS/TS: ${jsTsCount}, JSON: ${jsonCount}), node_modules и служебные каталоги пропущены.`,
          'success',
          'Сканер'
        )
      }
    } catch (error) {
      addLog(
        `Сбой при выборе проекта: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        'error',
        'Сканер'
      )
    } finally {
      setIsScanning(false)
    }
  }, [addLog])

  const handleFileClick = useCallback(
    (file: FileNode) => {
      const sizeStr = file.size !== undefined ? ` (${Math.round(file.size / 1024)} КБ)` : ''
      addLog(`Выбран файл: ${file.relativePath || file.name}${sizeStr}`, 'info', 'Файлы')
    },
    [addLog]
  )

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none antialiased">
      {/* Topbar: Название, Статус и Кнопка проекта */}
      <Topbar
        status={status}
        loading={loading}
        projectName={projectName}
        projectPath={projectPath}
        isScanning={isScanning}
        onSelectProject={handleSelectProject}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Основная рабочая область */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Боковая панель со структурой файлов */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          fileTree={fileTree}
          projectName={projectName}
          projectPath={projectPath}
          isScanning={isScanning}
          onSelectProject={handleSelectProject}
          onFileClick={handleFileClick}
        />

        {/* Главная панель и консоль логов */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
          <Dashboard
            status={status}
            projectStats={projectStats}
            projectPath={projectPath}
            projectName={projectName}
            isScanning={isScanning}
            onSelectProject={handleSelectProject}
            onTriggerLog={addLog}
          />

          <ConsoleLogs logs={logs} onClearLogs={clearLogs} />
        </main>
      </div>

      {/* Модальное окно настроек */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  )
}
