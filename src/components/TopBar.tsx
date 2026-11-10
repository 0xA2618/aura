import React, { useState, useRef } from 'react';
import { Settings, Bot, ChevronDown, GitBranch } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri, startWindowDragging, DetectedAgent } from '../services/fileService';
import { AgentDropdownMenu } from './AgentDropdownMenu';

/**
 * Layout Toggle: Primary Side Bar (Window 1)
 * Matches VS Code layout control icon in title bar
 */
export const PrimarySidebarIcon: React.FC<{ isOpen: boolean; size?: number; className?: string }> = ({
  isOpen,
  size = 16,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {isOpen && (
      <path
        d="M 3.5 2.2 L 5.5 2.2 L 5.5 13.8 L 3.5 13.8 A 1.8 1.8 0 0 1 1.7 12 L 1.7 4 A 1.8 1.8 0 0 1 3.5 2.2 Z"
        fill="currentColor"
      />
    )}
    <rect
      x="1.5"
      y="2"
      width="13"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.2"
      fill="none"
    />
    <line
      x1="5.5"
      y1="2"
      x2="5.5"
      y2="14"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

/**
 * Layout Toggle: Bottom Dock / Panel (Window 3)
 * Matches VS Code layout control icon in title bar
 */
export const BottomPanelIcon: React.FC<{ isOpen: boolean; size?: number; className?: string }> = ({
  isOpen,
  size = 16,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {isOpen && (
      <path
        d="M 1.7 9.5 L 14.3 9.5 L 14.3 12 A 1.8 1.8 0 0 1 12.5 13.8 L 3.5 13.8 A 1.8 1.8 0 0 1 1.7 12 Z"
        fill="currentColor"
      />
    )}
    <rect
      x="1.5"
      y="2"
      width="13"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.2"
      fill="none"
    />
    <line
      x1="1.5"
      y1="9.5"
      x2="14.5"
      y2="9.5"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

interface TopBarProps {
  activeView: 'files' | 'git' | 'plugins';
  workspaceDir: string;
  gitBranch?: string;
  isBottomOpen: boolean;
  isSidebarOpen?: boolean;
  sidebarWidth?: number;
  isResizing?: boolean;
  onChangeView: (view: 'files' | 'git' | 'plugins') => void;
  onChangeWorkspaceDir: () => void;
  onOpenOpenCode: () => void;
  onSelectAgent: (agent: DetectedAgent) => void;
  onRunInstallCommand: (installCmd: string, agentName: string) => void;
  onOpenAddAgentModal: () => void;
  onToggleSidebar?: () => void;
  onToggleBottom: () => void;
  onOpenSettings: () => void;
  onOpenGitModal?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  workspaceDir,
  gitBranch,
  isBottomOpen,
  isSidebarOpen = true,
  sidebarWidth = 260,
  isResizing = false,
  onChangeView,
  onChangeWorkspaceDir,
  onOpenOpenCode,
  onSelectAgent,
  onRunInstallCommand,
  onOpenAddAgentModal,
  onToggleSidebar,
  onToggleBottom,
  onOpenSettings,
  onOpenGitModal,
}) => {
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  const projectName = workspaceDir
    ? workspaceDir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || workspaceDir
    : '';

  // Left offset aligning with Window 2, clamped at the robot popup position (270px)
  const ROBOT_POPUP_LEFT_LIMIT = 270;
  const currentWindow2Left = isSidebarOpen ? sidebarWidth + 6 : 0;
  const window2LeftOffset = Math.max(ROBOT_POPUP_LEFT_LIMIT, currentWindow2Left);
  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && isTauri) {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('[data-tauri-no-drag]')) {
        return;
      }
      startWindowDragging();
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    if (isTauri) {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('[data-tauri-no-drag]')) {
        return;
      }
      try {
        const win = getCurrentWindow();
        const isMax = await win.isMaximized();
        if (isMax) {
          await win.unmaximize();
        } else {
          await win.maximize();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleDragMouseDown}
      onDoubleClick={handleDoubleClick}
      style={{ backgroundColor: 'var(--aura-topbar-bg)', borderColor: 'var(--aura-border)' }}
      className="h-9 w-full border-b flex items-center justify-between select-none px-2 relative z-[60] cursor-default"
    >
      {/* 80px safe area for macOS native traffic light buttons with subtle inactive contrast ring */}
      <div data-tauri-drag-region className="flex items-center">
        <div data-tauri-drag-region className="w-20 h-full flex-shrink-0 relative">
          <div className="absolute inset-y-1.5 left-2 w-16 rounded-full bg-black/5 dark:bg-white/5 pointer-events-none -z-10" />
        </div>
      </div>

      {/* Left-Aligned with Window 2 (Editor container): Project Name & Branch Status */}
      <div
        data-tauri-drag-region
        style={{
          left: `${window2LeftOffset}px`,
          transition: isResizing ? 'none' : 'left 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="absolute top-0 bottom-0 flex items-center gap-2 overflow-hidden max-w-[calc(100vw-380px)]"
      >
        {projectName ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-tauri-no-drag
              onClick={onChangeWorkspaceDir}
              title={`当前工作区: ${workspaceDir}\n点击切换工作区目录 (Switch Project Directory)`}
              className="flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] cursor-pointer select-none font-sans group transition-all"
            >
              <span
                className="text-xs font-semibold text-[var(--aura-text,#cccccc)] group-hover:text-[var(--aura-accent,#007acc)] tracking-tight truncate max-w-[280px]"
              >
                {projectName}
              </span>
            </button>

            {gitBranch && (
              <div
                data-tauri-drag-region
                title={`当前分支: ${gitBranch}`}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium text-[var(--aura-text-muted,#858585)] bg-black/5 dark:bg-white/5 border border-[var(--aura-border,rgba(125,125,125,0.15))]"
              >
                <GitBranch size={11} className="text-[var(--aura-accent,#007acc)]" />
                <span>{gitBranch}</span>
              </div>
            )}
          </div>
        ) : (
          <span data-tauri-drag-region className="text-xs font-mono text-[var(--aura-text-muted,#555555)] cursor-default select-none">
            Aura IDE
          </span>
        )}
      </div>

      <div data-tauri-drag-region className="flex-1" />

      {/* Right side: Global Actions (Layout Toggles -> Divider -> Robot Dropdown -> Git -> Settings) */}
      <div data-tauri-no-drag className="flex items-center gap-1 relative z-[70]">
        {/* Toggle Primary Side Bar (Window 1) */}
        <button
          type="button"
          data-tauri-no-drag
          onClick={onToggleSidebar}
          title={isSidebarOpen ? '隐藏侧边栏 (Hide Primary Side Bar)' : '显示侧边栏 (Show Primary Side Bar)'}
          style={{
            color: isSidebarOpen ? 'var(--aura-text, #e0e0e0)' : 'var(--aura-text-muted, #858585)',
          }}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.96] transition-all cursor-pointer flex items-center justify-center hover:text-[var(--aura-text,#ffffff)]"
        >
          <PrimarySidebarIcon isOpen={isSidebarOpen} size={16} />
        </button>

        {/* Toggle Bottom Dock Panel (Window 3) */}
        <button
          type="button"
          data-tauri-no-drag
          onClick={onToggleBottom}
          title={isBottomOpen ? '隐藏下方终端面板 (Hide Bottom Panel)' : '显示下方终端面板 (Show Bottom Panel)'}
          style={{
            color: isBottomOpen ? 'var(--aura-text, #e0e0e0)' : 'var(--aura-text-muted, #858585)',
          }}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.96] transition-all cursor-pointer flex items-center justify-center hover:text-[var(--aura-text,#ffffff)]"
        >
          <BottomPanelIcon isOpen={isBottomOpen} size={16} />
        </button>

        {/* Subtle vertical divider between layout buttons and Agent icon */}
        <div className="h-3.5 w-px bg-[var(--aura-border,rgba(125,125,125,0.25))] mx-1 self-center shrink-0 select-none" />

        <div className="relative z-[80]" ref={agentDropdownRef} data-tauri-no-drag>
          <button
            data-tauri-no-drag
            onClick={() => setIsAgentMenuOpen((prev) => !prev)}
            title="Select AI Agent (Container 3 / Shift+⌘+M)"
            style={{
              backgroundColor: isAgentMenuOpen ? 'color-mix(in srgb, var(--aura-accent, #007acc) 16%, transparent)' : 'transparent',
              color: isAgentMenuOpen ? 'var(--aura-accent, #007acc)' : 'var(--aura-text-muted)',
            }}
            className="p-1.5 rounded-lg flex items-center gap-1 text-[var(--aura-text-muted)] hover:text-[var(--aura-accent,#007acc)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.96] transition-all cursor-pointer"
          >
            <Bot size={16} />
            <ChevronDown
              size={11}
              className={`transition-transform duration-200 ${isAgentMenuOpen ? 'rotate-180' : 'opacity-60'}`}
            />
          </button>

          {isAgentMenuOpen && (
            <AgentDropdownMenu
              isOpen={isAgentMenuOpen}
              onClose={() => setIsAgentMenuOpen(false)}
              onSelectAgent={(agent) => {
                setIsAgentMenuOpen(false);
                onSelectAgent(agent);
              }}
              onRunInstall={(cmd, name) => {
                setIsAgentMenuOpen(false);
                onRunInstallCommand(cmd, name);
              }}
              onOpenAddModal={onOpenAddAgentModal}
              onOpenSettings={onOpenSettings}
            />
          )}
        </div>

        {/* Git Button placed immediately to the right of Terminal (Click opens Git modal) */}
        <button
          type="button"
          data-tauri-no-drag
          onClick={onOpenGitModal}
          title="Git 源代码管理与提交历史 (Git Status & Commits)"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[var(--aura-text-muted,#858585)] hover:text-[var(--aura-text,#ffffff)] hover:bg-black/5 dark:hover:bg-white/10 border border-transparent hover:border-[var(--aura-border,rgba(125,125,125,0.15))] active:scale-[0.96] transition-all"
        >
          <GitBranch size={12} className="text-[var(--aura-accent,#007acc)]" />
          <span>Git</span>
        </button>

        <button
          data-tauri-no-drag
          onClick={onOpenSettings}
          title="首选项与设置 (⌘, / Settings)"
          className="p-1.5 rounded-lg text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.96] transition-all"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
};
