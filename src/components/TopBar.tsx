import React, { useState, useRef } from 'react';
import { Settings, Bot, Terminal, ChevronDown, GitBranch } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri, startWindowDragging, DetectedAgent } from '../services/fileService';
import { AgentDropdownMenu } from './AgentDropdownMenu';

interface TopBarProps {
  activeView: 'files' | 'git' | 'plugins';
  workspaceDir: string;
  gitBranch?: string;
  isBottomOpen: boolean;
  isSidebarOpen?: boolean;
  sidebarWidth?: number;
  onChangeView: (view: 'files' | 'git' | 'plugins') => void;
  onOpenOpenCode: () => void;
  onSelectAgent: (agent: DetectedAgent) => void;
  onRunInstallCommand: (installCmd: string, agentName: string) => void;
  onOpenAddAgentModal: () => void;
  onToggleBottom: () => void;
  onOpenSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  workspaceDir,
  gitBranch,
  isBottomOpen,
  isSidebarOpen = true,
  sidebarWidth = 260,
  onChangeView,
  onOpenOpenCode,
  onSelectAgent,
  onRunInstallCommand,
  onOpenAddAgentModal,
  onToggleBottom,
  onOpenSettings,
}) => {
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  const projectName = workspaceDir
    ? workspaceDir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || workspaceDir
    : '';

  // Left offset aligning directly with the start of Window 2 (Editor container)
  const window2LeftOffset = isSidebarOpen ? sidebarWidth + 6 : 84;
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

      {/* Left-Aligned with Window 2 (Editor container): Project Name & Branch */}
      <div
        data-tauri-drag-region
        style={{
          left: `${window2LeftOffset}px`,
          transition: 'left 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="absolute top-0 bottom-0 flex items-center gap-2 overflow-hidden max-w-[calc(100vw-360px)]"
      >
        {projectName ? (
          <div
            data-tauri-drag-region
            title={workspaceDir}
            className="flex items-center gap-1.5 cursor-default select-none font-sans"
          >
            <span
              data-tauri-drag-region
              className="text-xs font-semibold text-[var(--aura-text,#cccccc)] tracking-tight truncate"
            >
              {projectName}
            </span>

            {gitBranch && (
              <div
                data-tauri-drag-region
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

      {/* Right side: Global Actions (Robot Dropdown -> Agents, Terminal -> Toggle Dock, Settings) */}
      <div data-tauri-no-drag className="flex items-center gap-1 relative z-[70]">
        <div className="relative z-[80]" ref={agentDropdownRef} data-tauri-no-drag>
          <button
            data-tauri-no-drag
            onClick={() => setIsAgentMenuOpen((prev) => !prev)}
            title="Select AI Agent (Container 3 / Shift+⌘+M)"
            style={{
              backgroundColor: isAgentMenuOpen ? 'var(--aura-accent-hover, rgba(0, 122, 204, 0.15))' : 'transparent',
              color: isAgentMenuOpen ? 'var(--aura-accent, #007acc)' : 'var(--aura-text-muted)',
            }}
            className="p-1.5 rounded-lg flex items-center gap-1 text-[var(--aura-text-muted)] hover:text-[var(--aura-accent,#007acc)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.96] transition-all"
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

        <button
          data-tauri-no-drag
          onClick={onToggleBottom}
          title={isBottomOpen ? '隐藏下方 AI/终端 (Space + oc)' : '展开下方 AI/终端 (Space + oc)'}
          style={{
            backgroundColor: isBottomOpen ? 'rgba(125, 125, 125, 0.14)' : 'transparent',
            borderColor: isBottomOpen ? 'var(--aura-accent, #007acc)' : 'transparent',
            color: isBottomOpen ? 'var(--aura-accent, #007acc)' : 'var(--aura-text-muted)'
          }}
          className="p-1.5 rounded-lg border transition-all hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.96]"
        >
          <Terminal size={16} />
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
