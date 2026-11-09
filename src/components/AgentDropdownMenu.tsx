import React, { useState, useEffect, useRef } from 'react';
import { Plus, Download, Terminal, Bot } from 'lucide-react';
import { DetectedAgent, detectSystemAgents } from '../services/fileService';

// Exact minimal monochrome icons matching user screenshot
export const ClaudeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const CodexIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19.07 10.93a4.5 4.5 0 0 0-.35-3.3 4.6 4.6 0 0 0-4.2-2.27h-.6A4.6 4.6 0 0 0 10.2 3.2a4.6 4.6 0 0 0-4.35 3.05 4.5 4.5 0 0 0-2.88 2.08 4.6 4.6 0 0 0 .44 4.78 4.5 4.5 0 0 0 .35 3.3 4.6 4.6 0 0 0 4 2.27h.6a4.6 4.6 0 0 0 3.92 2.12 4.6 4.6 0 0 0 4.35-3.05 4.5 4.5 0 0 0 2.88-2.08 4.6 4.6 0 0 0-.44-4.74z" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
  </svg>
);

export const AntigravityIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M5.5 19.5c.8-3.2 2.6-8.5 6.5-14.5 3.9 6 5.7 11.3 6.5 14.5-1.8-.2-2.8-.9-3.8-2.6-1.6-2.8-2.2-6-2.7-8.2-.5 2.2-1.1 5.4-2.7 8.2-1 1.7-2 2.4-3.8 2.6z" />
  </svg>
);

export const OpenCodeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="8.5" y="8.5" width="7" height="7" rx="0.5" fill="currentColor" stroke="none" opacity="0.2" />
  </svg>
);

export { ClaudeIcon as ClaudeLogo, CodexIcon as CodexLogo, AntigravityIcon as AntigravityLogo, OpenCodeIcon as OpenCodeLogo };

interface AgentDropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent: (agent: DetectedAgent) => void;
  onRunInstall: (installCmd: string, agentName: string) => void;
  onOpenAddModal?: () => void;
  onOpenSettings?: () => void;
}

export const AgentDropdownMenu: React.FC<AgentDropdownMenuProps> = ({
  isOpen,
  onClose,
  onSelectAgent,
  onRunInstall,
  onOpenAddModal,
  onOpenSettings,
}) => {
  const [agents, setAgents] = useState<DetectedAgent[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchAgents = async () => {
    try {
      const data = await detectSystemAgents();
      // Load custom agents from localStorage
      let customAgents: DetectedAgent[] = [];
      try {
        const raw = localStorage.getItem('aura_custom_agents');
        if (raw) {
          customAgents = JSON.parse(raw);
        }
      } catch (e) {
        console.error(e);
      }

      const combined = [...data];
      for (const ca of customAgents) {
        if (!combined.some((a) => a.id === ca.id)) {
          combined.push(ca);
        }
      }

      // Ensure ordering: Claude Agent, Codex, Google Antigravity, OpenCode V2, then custom
      const order = ['claude', 'codex', 'agy', 'opencode'];
      const sorted = combined.sort((a, b) => {
        const idxA = order.indexOf(a.id);
        const idxB = order.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
      setAgents(sorted);
    } catch (err) {
      console.error('[AgentDropdownMenu detect error]', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAgents();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderIcon = (id: string) => {
    switch (id) {
      case 'claude':
        return <ClaudeIcon size={17} className="text-[var(--aura-text)] shrink-0" />;
      case 'codex':
        return <CodexIcon size={17} className="text-[var(--aura-text)] shrink-0" />;
      case 'agy':
        return <AntigravityIcon size={17} className="text-[var(--aura-text)] shrink-0" />;
      case 'opencode':
        return <OpenCodeIcon size={16} className="text-[var(--aura-text)] shrink-0" />;
      default:
        return <Terminal size={16} className="text-[var(--aura-text)] shrink-0" />;
    }
  };

  const getDisplayName = (agent: DetectedAgent) => {
    switch (agent.id) {
      case 'claude':
        return 'Claude Agent';
      case 'codex':
        return 'Codex';
      case 'agy':
        return 'Google Antigravity';
      case 'opencode':
        return 'OpenCode V2';
      default:
        return agent.name;
    }
  };

  const handleAgentClick = (agent: DetectedAgent) => {
    if (agent.is_installed) {
      onSelectAgent(agent);
    } else {
      onRunInstall(agent.install_command, getDisplayName(agent));
    }
  };

  return (
    <div
      ref={menuRef}
      data-tauri-no-drag
      style={{
        backgroundColor: 'var(--aura-bg-elevated, #252526)',
        borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.25))',
        color: 'var(--aura-text, #cccccc)',
        boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.4)',
      }}
      className="absolute right-0 top-full mt-1.5 w-[250px] rounded-xl border z-[100] overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100 font-sans p-1.5"
    >
      {/* Agents List */}
      <div className="space-y-0.5">
        {agents.map((agent) => {
          const displayName = getDisplayName(agent);
          const isOpencode = agent.id === 'opencode';

          return (
            <div
              key={agent.id}
              onClick={() => handleAgentClick(agent)}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] text-[var(--aura-text,#ffffff)] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="opacity-90 group-hover:opacity-100 transition-opacity">
                  {renderIcon(agent.id)}
                </div>
                <span className="truncate font-normal tracking-tight">
                  {displayName}
                </span>
              </div>

              {/* Right side: Shortcut for default agent or Install badge */}
              <div className="shrink-0 flex items-center">
                {agent.is_installed ? (
                  isOpencode ? (
                    <span className="text-[12px] text-[var(--aura-text-muted,#8c93a0)] font-sans font-normal tracking-wide">
                      ⌘ N
                    </span>
                  ) : null
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAgentClick(agent);
                    }}
                    title={`Click to install ${displayName} in Container 3`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500 text-black hover:bg-amber-400 active:scale-95 transition-all shadow-xs"
                  >
                    <Download size={10} strokeWidth={2.5} />
                    <span>Install</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="my-1 border-t border-[var(--aura-border,rgba(125,125,125,0.15))]" />

      {/* Add More Agents */}
      <div>
        <button
          onClick={() => {
            onClose();
            if (onOpenAddModal) {
              onOpenAddModal();
            } else if (onOpenSettings) {
              onOpenSettings();
            }
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-[var(--aura-text-muted,#8c93a0)] hover:text-[var(--aura-text,#ffffff)] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] transition-colors text-left"
        >
          <Plus size={16} className="text-[var(--aura-text-muted,#8c93a0)]" />
          <span className="font-normal tracking-tight">Add More Agents</span>
        </button>
      </div>
    </div>
  );
};
