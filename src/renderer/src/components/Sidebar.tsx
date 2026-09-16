import React, { useState } from 'react'
import type { NavigationItem, FileNode } from '../types'

interface SidebarProps {
  activeTab: string
  onTabChange: (tabId: string) => void
  fileTree: FileNode | null
  projectName: string | null
  projectPath: string | null
  isScanning: boolean
  onSelectProject: () => void
  onFileClick?: (node: FileNode) => void
}

const FileTreeNode: React.FC<{
  node: FileNode
  depth?: number
  onFileClick?: (node: FileNode) => void
}> = ({ node, depth = 0, onFileClick }) => {
  const [isOpen, setIsOpen] = useState(depth < 1)

  const getFileIcon = (fileName: string, ext?: string): React.JSX.Element => {
    const extension = ext || (fileName.includes('.') ? `.${fileName.split('.').pop()}` : '')

    if (['.ts', '.tsx'].includes(extension)) {
      return (
        <span className="text-[10px] font-bold font-mono px-1 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800/60 leading-none">
          TS
        </span>
      )
    }
    if (['.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
      return (
        <span className="text-[10px] font-bold font-mono px-1 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800/60 leading-none">
          JS
        </span>
      )
    }
    if (extension === '.json') {
      return (
        <span className="text-[10px] font-bold font-mono px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 leading-none">
          {}
        </span>
      )
    }
    if (['.css', '.scss'].includes(extension)) {
      return (
        <span className="text-[10px] font-bold font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 leading-none">
          #
        </span>
      )
    }
    if (['.md', '.markdown', '.txt'].includes(extension)) {
      return (
        <span className="text-[10px] font-bold font-mono px-1 py-0.2 rounded bg-purple-950 text-purple-400 border border-purple-800/60 leading-none">
          MD
        </span>
      )
    }

    return (
      <svg
        className="w-3.5 h-3.5 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    )
  }

  if (node.isDirectory) {
    return (
      <div className="select-none text-xs">
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${Math.max(4, depth * 12)}px` }}
          className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800/70 text-slate-300 hover:text-white transition-colors text-left group"
        >
          <svg
            className={`w-3 h-3 text-slate-400 group-hover:text-slate-200 transition-transform ${
              isOpen ? 'rotate-90' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <svg
            className={`w-3.5 h-3.5 ${isOpen ? 'text-amber-400' : 'text-amber-500'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d={
                isOpen
                  ? 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z'
                  : 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
              }
            />
          </svg>
          <span className="truncate font-medium text-slate-200">{node.name}</span>
          {node.children && (
            <span className="ml-auto text-[10px] text-slate-400 font-mono">
              {node.children.length}
            </span>
          )}
        </button>

        {isOpen && node.children && node.children.length > 0 && (
          <div className="border-l border-slate-800/80 ml-2">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileClick={onFileClick}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => onFileClick?.(node)}
      style={{ paddingLeft: `${Math.max(16, depth * 12 + 8)}px` }}
      className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors text-left truncate group"
      title={`${node.name} (${node.size ? Math.round(node.size / 1024) : 0} КБ)`}
    >
      <span className="flex-shrink-0">{getFileIcon(node.name, node.extension)}</span>
      <span className="truncate text-xs text-slate-300 group-hover:text-white">{node.name}</span>
      {node.size !== undefined && (
        <span className="ml-auto text-[9px] text-slate-400 font-mono flex-shrink-0">
          {node.size < 1024 ? `${node.size} Б` : `${Math.round(node.size / 1024)} КБ`}
        </span>
      )}
    </button>
  )
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  fileTree,
  projectName,
  projectPath,
  isScanning,
  onSelectProject,
  onFileClick
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarView, setSidebarView] = useState<'navigation' | 'files'>('navigation')

  const navItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Панель управления',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    },
    {
      id: 'tree',
      label: 'Структура проекта',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
      badge: fileTree?.children ? String(fileTree.children.length) : undefined
    },
    {
      id: 'suites',
      label: 'Наборы тестов',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      badge: '12'
    },
    {
      id: 'runs',
      label: 'Активные запуски',
      icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      badge: 'Live'
    },
    { id: 'playwright', label: 'Воркер Playwright', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    {
      id: 'settings',
      label: 'Настройки',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
    }
  ]

  return (
    <aside
      className={`h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Workspace header */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
        {!collapsed && (
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Рабочая область
            </span>
            <span
              className="text-xs font-medium text-slate-200 truncate cursor-pointer hover:text-indigo-300"
              title={projectPath || 'Проект не выбран'}
            >
              {projectName || 'E2E Тест Сьют'}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors mx-auto cursor-pointer"
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* View Switcher (Navigation vs File Tree) */}
      {!collapsed && (
        <div className="px-2 pt-2 pb-1 border-b border-slate-800/60">
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-950/70 rounded-lg border border-slate-800">
            <button
              onClick={() => setSidebarView('navigation')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                sidebarView === 'navigation'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Навигация
            </button>
            <button
              onClick={() => setSidebarView('files')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                sidebarView === 'files'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Файлы</span>
              {fileTree && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Nav Items OR File Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {collapsed || sidebarView === 'navigation' ? (
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id)
                    if (item.id === 'tree' && !collapsed) {
                      setSidebarView('files')
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors group cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <svg
                    className={`w-4 h-4 flex-shrink-0 transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d={item.icon}
                    />
                  </svg>

                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between text-left">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            item.badge === 'Live'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </nav>
        ) : (
          /* Scanned File Tree View */
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Дерево проекта
              </span>
              <button
                onClick={onSelectProject}
                disabled={isScanning}
                className="hover:text-indigo-300 text-[10px] underline cursor-pointer"
              >
                {projectName ? 'Обновить' : 'Выбрать'}
              </button>
            </div>

            {fileTree ? (
              <div className="p-1 rounded-lg bg-slate-950/60 border border-slate-800/80 max-h-[calc(100vh-230px)] overflow-y-auto">
                <FileTreeNode node={fileTree} depth={0} onFileClick={onFileClick} />
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800/60 text-center space-y-3">
                <svg
                  className="w-8 h-8 text-slate-600 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-300">Папка не выбрана</p>
                  <p className="text-[11px] text-slate-400">
                    Откройте проект для отображения дерева файлов и структуры QA
                  </p>
                </div>
                <button
                  onClick={onSelectProject}
                  disabled={isScanning}
                  className="w-full py-1.5 px-3 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm cursor-pointer"
                >
                  Выбрать папку
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Button / Quick Info */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        {!collapsed && (
          <button
            onClick={onSelectProject}
            disabled={isScanning}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
              />
            </svg>
            <span>{projectName ? 'Сменить папку' : 'Выбрать папку'}</span>
          </button>
        )}

        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
            QA
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-slate-200 truncate">
                Инженер по тестированию
              </span>
              <span className="text-[10px] text-slate-400 truncate">Локальная сессия</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
