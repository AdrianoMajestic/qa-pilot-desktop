import React, { useState } from 'react'
import type { FileNode } from '../types'

interface SidebarProps {
  fileTree: FileNode | null
  projectName: string | null
  projectPath: string | null
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
          { }
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
  fileTree,
  projectName,
  projectPath,
  onFileClick
}) => {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200 select-none ${
        collapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* Workspace / Project Header */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
        {!collapsed && (
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Дерево файлов
            </span>
            <span
              className="text-xs font-medium text-slate-200 truncate"
              title={projectPath || 'Проект не выбран'}
            >
              {projectName || 'Проект не выбран'}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors mx-auto cursor-pointer"
          title={collapsed ? 'Развернуть дерево файлов' : 'Свернуть дерево файлов'}
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

      {/* File Explorer Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {collapsed ? (
          <div className="flex flex-col items-center pt-3 text-slate-500" title={projectName || 'Файлы'}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
        ) : fileTree ? (
          <div className="p-1 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <FileTreeNode node={fileTree} depth={0} onFileClick={onFileClick} />
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center p-4 text-center">
            <span className="text-xs text-slate-500 italic">Проект не выбран</span>
          </div>
        )}
      </div>
    </aside>
  )
}
