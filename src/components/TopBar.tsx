import React, { useState, useRef } from 'react';
import { Settings, Bot, Terminal, ChevronDown } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri, startWindowDragging, DetectedAgent } from '../services/fileService';
import { AgentDropdownMenu } from './AgentDropdownMenu';

interface TopBarProps {
  activeView: 'files' | 'git' | 'plugins';
  workspaceDir: string;
  isBottomOpen: boolean;
  onChangeView: (view: 'files' | 'git' | 'plugins') => void;
  onOpenOpenCode: () => void;
  onSelectAgent: (agent: DetectedAgent) => void;
  onRunInstallCommand: (installCmd: string, agentName: string) => void;
  onToggleBottom: () => void;
  onOpenSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  workspaceDir,
  isBottomOpen,
  onChangeView,
  onOpenOpenCode,
  onSelectAgent,
  onRunInstallCommand,
  onToggleBottom,
  onOpenSettings,
}) => {
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
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
      className="h-9 w-full border-b flex items-center justify-between select-none px-2 z-20 cursor-default"
    >
      {/* 80px safe area for macOS native traffic light buttons with subtle inactive contrast ring */}
      <div data-tauri-drag-region className="flex items-center">
        <div data-tauri-drag-region className="w-20 h-full flex-shrink-0 relative">
          <div className="absolute inset-y-1.5 left-2 w-16 rounded-full bg-black/5 dark:bg-white/5 pointer-events-none -z-10" />
        </div>
      </div>

      {/* Center: Current Workspace Directory */}
      <div data-tauri-drag-region className="flex-1 flex items-center justify-center px-4 overflow-hidden h-full">
        {workspaceDir ? (
          <span
            data-tauri-drag-region
            className="text-xs font-mono text-[var(--aura-text-muted,#888888)] truncate cursor-default select-none"
            title={workspaceDir}
          >
            {workspaceDir}
          </span>
        ) : (
          <span data-tauri-drag-region className="text-xs font-mono text-[var(--aura-text-muted,#555555)] cursor-default select-none">Aura IDE</span>
        )}
      </div>

      {/* Right side: Global Actions (Robot Dropdown -> Agents, Terminal -> Toggle Dock, Settings) */}
      <div data-tauri-no-drag className="flex items-center gap-1">
        <div className="relative" ref={agentDropdownRef} data-tauri-no-drag>
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
