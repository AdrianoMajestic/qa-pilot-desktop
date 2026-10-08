import React, { useState } from 'react'
import type { FileNode } from '../types'

interface SidebarProps {
  fileTree: FileNode | null
  projectName: string | null
  projectPath: string | null
  onFileClick?: (node: FileNode) => void
}

/**
 * Returns a distinct syntax-colored icon corresponding to the file extension
 */
const FileTypeIcon: React.FC<{ fileName: string; extension?: string }> = ({
  fileName,
  extension
}) => {
  const ext = (extension || (fileName.includes('.') ? `.${fileName.split('.').pop()}` : '')).toLowerCase()

  // TypeScript / TSX
  if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') {
    return (
      <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800/60 leading-none flex-shrink-0 select-none">
        {ext === '.tsx' ? 'TSX' : 'TS'}
      </span>
    )
  }

  // JavaScript / JSX
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') {
    return (
      <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 leading-none flex-shrink-0 select-none">
        {ext === '.jsx' ? 'JSX' : 'JS'}
      </span>
    )
  }

  // JSON configuration / schemas
  if (ext === '.json') {
    return (
      <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 leading-none flex-shrink-0 select-none">
        {'{ }'}
      </span>
    )
  }

  // CSS / SCSS / Tailwind
  if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') {
    return (
      <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 leading-none flex-shrink-0 select-none">
        #
      </span>
    )
  }

  // Markdown / Documentation
  if (ext === '.md' || ext === '.markdown' || ext === '.txt') {
    return (
      <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-purple-950/80 text-purple-400 border border-purple-800/60 leading-none flex-shrink-0 select-none">
        MD
      </span>
    )
  }

  // HTML
  if (ext === '.html' || ext === '.htm') {
    return (
      <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-orange-950/80 text-orange-400 border border-orange-800/60 leading-none flex-shrink-0 select-none">
        &lt;&gt;
      </span>
    )
  }

  // Default File Icon (VS Code sheet outline)
  return (
    <svg
      className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  )
}

const FileTreeNode: React.FC<{
  node: FileNode
  depth?: number
  onFileClick?: (node: FileNode) => void
}> = ({ node, depth = 0, onFileClick }) => {
  // Root and first level are open by default
  const [isOpen, setIsOpen] = useState(depth < 2)

  if (node.isDirectory) {
    const hasChildren = Boolean(node.children && node.children.length > 0)

    return (
      <div className="select-none text-[11px] font-mono leading-tight">
        {/* Folder Header Row */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${Math.max(4, depth * 12 + 2)}px` }}
          className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800/80 text-slate-300 hover:text-white transition-colors text-left group cursor-pointer focus:outline-none focus:bg-slate-800"
          title={`${node.name} (${node.children?.length ?? 0} элементов)`}
        >
          {/* Chevron Toggle Indicator */}
          <svg
            className={`w-3 h-3 text-slate-400 group-hover:text-slate-200 transition-transform duration-150 flex-shrink-0 ${
              isOpen ? 'rotate-90' : 'rotate-0'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>

          {/* Folder Icon (Open / Closed state) */}
          <svg
            className={`w-3.5 h-3.5 flex-shrink-0 ${isOpen ? 'text-amber-400' : 'text-amber-500'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              d={
                isOpen
                  ? 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z'
                  : 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
              }
            />
          </svg>

          <span className="truncate font-medium text-slate-200 group-hover:text-white">
            {node.name}
          </span>

          {hasChildren && (
            <span className="ml-auto text-[10px] text-slate-400 font-mono flex-shrink-0 opacity-80">
              {node.children!.length}
            </span>
          )}
        </button>

        {/* Nested Folder Children with Vertical Guide Line */}
        {isOpen && hasChildren && (
          <div className="border-l border-slate-800/80 ml-2.5">
            {node.children!.map((child) => (
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

  // File Row
  return (
    <button
      onClick={() => onFileClick?.(node)}
      style={{ paddingLeft: `${Math.max(16, depth * 12 + 10)}px` }}
      className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 transition-colors text-left truncate group cursor-pointer focus:outline-none focus:bg-slate-800 text-[11px] font-mono leading-tight"
      title={`${node.name} (${node.size ? Math.round(node.size / 1024) : 0} КБ)`}
    >
      <FileTypeIcon fileName={node.name} extension={node.extension} />
      <span className="truncate text-slate-300 group-hover:text-white">{node.name}</span>
      {node.size !== undefined && (
        <span className="ml-auto text-[9px] text-slate-400 font-mono flex-shrink-0 opacity-70">
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
        collapsed ? 'w-12' : 'w-64'
      }`}
    >
      {/* Workspace / Project Header */}
      <div className="p-2.5 border-b border-slate-800/80 flex items-center justify-between min-h-[42px]">
        {!collapsed && (
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Проводник
            </span>
            <span
              className="text-xs font-semibold text-slate-200 truncate mt-0.5"
              title={projectPath || 'Проект не выбран'}
            >
              {projectName || 'Проект не выбран'}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors mx-auto cursor-pointer focus:outline-none"
          title={collapsed ? 'Развернуть дерево файлов' : 'Свернуть дерево файлов'}
        >
          <svg
            className={`w-3.5 h-3.5 transform transition-transform ${collapsed ? 'rotate-180' : ''}`}
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

      {/* File Explorer Tree View */}
      <div className="flex-1 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-slate-800">
        {collapsed ? (
          <div
            className="flex flex-col items-center pt-3 text-slate-500 cursor-pointer"
            onClick={() => setCollapsed(false)}
            title={projectName || 'Открыть проводник'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
        ) : fileTree && projectPath ? (
          <div className="p-1 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <FileTreeNode node={fileTree} depth={0} onFileClick={onFileClick} />
          </div>
        ) : (
          /* Empty / No Project Placeholder */
          <div className="h-48 flex flex-col items-center justify-center p-4 text-center space-y-2">
            <div className="w-9 h-9 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <div className="text-xs font-medium text-slate-300">📂 Папка не выбрана</div>
            <div className="text-[11px] text-slate-400 leading-snug">
              Откройте проект через верхнюю панель
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

