import { useState, useCallback } from 'react'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { ConsoleLogs } from './components/ConsoleLogs'
import { useSystemStatus } from './hooks/useSystemStatus'
import { useLogStream } from './hooks/useLogStream'
import { electronService } from './services/electronService'
import type { FileNode, ProjectStats } from './types'

export default function App(): React.JSX.Element {
  const { status, loading } = useSystemStatus()
  const [activeTab, setActiveTab] = useState('dashboard')

  // Real-Time Log Stream Hook
  const { logs, addLog, clearLogs, triggerTestLog } = useLogStream()

  // Project Scanner State
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [projectStats, setProjectStats] = useState<ProjectStats | null>(null)
  const [isScanning, setIsScanning] = useState(false)

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

          <ConsoleLogs
            logs={logs}
            onClearLogs={clearLogs}
            onTriggerTestLog={() =>
              triggerTestLog({
                message: 'Тестовый импульс IPC-потока получен консолью в реальном времени',
                level: 'info',
                source: 'system'
              })
            }
          />
        </main>
      </div>
    </div>
  )
}
