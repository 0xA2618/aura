import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  X,
  Download,
  Bot
} from 'lucide-react';
import { DetectedAgent, detectSystemAgents } from '../services/fileService';

// Official Agent Brand Logos
export const OpenCodeLogo: React.FC<{ size?: number; className?: string }> = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="7" fill="#18181B" />
    <rect x="5.5" y="5.5" width="21" height="21" rx="4.5" fill="#27272A" stroke="#3F3F46" strokeWidth="1.2" />
    <path d="M11 13l3.5 3-3.5 3M17 19h4" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const AntigravityLogo: React.FC<{ size?: number; className?: string }> = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="7" fill="#0B1329" />
    <path
      d="M16 4.5C16 11 11 16 4.5 16C11 16 16 21 16 27.5C16 21 21 16 27.5 16C21 16 16 11 16 4.5Z"
      fill="url(#agyGrad)"
    />
    <defs>
      <linearGradient id="agyGrad" x1="4.5" y1="4.5" x2="27.5" y2="27.5" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285F4" />
        <stop offset="0.33" stopColor="#EA4335" />
        <stop offset="0.66" stopColor="#FBBC05" />
        <stop offset="1" stopColor="#34A853" />
      </linearGradient>
    </defs>
  </svg>
);

export const CodexLogo: React.FC<{ size?: number; className?: string }> = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="7" fill="#0A0A0A" />
    <path
      d="M24.7 13.9a5.2 5.2 0 0 0-.4-3.8 5.3 5.3 0 0 0-4.6-2.6h-.7A5.3 5.3 0 0 0 14.5 5a5.3 5.3 0 0 0-5 3.5 5.2 5.2 0 0 0-3.3 2.4 5.3 5.3 0 0 0 .5 5.5 5.2 5.2 0 0 0 .4 3.8 5.3 5.3 0 0 0 4.6 2.6h.7A5.3 5.3 0 0 0 17 25.4a5.3 5.3 0 0 0 5-3.5 5.2 5.2 0 0 0 3.3-2.4 5.3 5.3 0 0 0-.6-5.6z"
      stroke="#10A37F"
      strokeWidth="1.5"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="16" cy="15.2" r="2.2" fill="#10A37F" />
  </svg>
);

export const ClaudeLogo: React.FC<{ size?: number; className?: string }> = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="7" fill="#1E1715" />
    <path
      d="M16 6.5v19M6.5 16h19M9.3 9.3l13.4 13.4M22.7 9.3L9.3 22.7"
      stroke="#D97706"
      strokeWidth="2.3"
      strokeLinecap="round"
    />
    <circle cx="16" cy="16" r="3.2" fill="#F59E0B" />
  </svg>
);

interface AgentDropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent: (agent: DetectedAgent) => void;
  onRunInstall: (installCmd: string, agentName: string) => void;
}

export const AgentDropdownMenu: React.FC<AgentDropdownMenuProps> = ({
  isOpen,
  onClose,
  onSelectAgent,
  onRunInstall,
}) => {
  const [agents, setAgents] = useState<DetectedAgent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const data = await detectSystemAgents();
      setAgents(data);
    } catch (err) {
      console.error('[AgentDropdownMenu detect error]', err);
    } finally {
      setLoading(false);
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

  const renderAgentLogo = (id: string) => {
    switch (id) {
      case 'opencode':
        return <OpenCodeLogo size={24} />;
      case 'agy':
        return <AntigravityLogo size={24} />;
      case 'codex':
        return <CodexLogo size={24} />;
      case 'claude':
        return <ClaudeLogo size={24} />;
      default:
        return <Bot size={22} className="text-[var(--aura-accent,#007acc)]" />;
    }
  };

  const handleAgentClick = (agent: DetectedAgent) => {
    if (agent.is_installed) {
      onSelectAgent(agent);
    } else {
      // Directly trigger installation workflow in Container 3 terminal
      onRunInstall(agent.install_command, agent.name);
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
      }}
      className="absolute right-0 top-full mt-2 w-[390px] rounded-xl border shadow-2xl z-50 overflow-hidden flex flex-col text-xs select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div
        style={{ borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.2))' }}
        className="px-3.5 py-2.5 border-b flex items-center justify-between bg-black/10 dark:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--aura-accent,#007acc)]/10 text-[var(--aura-accent,#007acc)]">
            <Bot size={16} />
          </div>
          <div>
            <div className="font-semibold text-sm text-[var(--aura-text,#ffffff)] flex items-center gap-1.5">
              <span>AI Agents</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--aura-accent,#007acc)]/20 text-[var(--aura-accent,#007acc)] font-medium">
                Container 3
              </span>
            </div>
            <div className="text-[11px] text-[var(--aura-text-muted,#858585)]">
              Launch intelligent coding agents in bottom dock
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={fetchAgents}
            title="Rescan system agents"
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] transition-all"
          >
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] transition-all"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Agent List */}
      <div className="p-2 space-y-1.5 max-h-[360px] overflow-y-auto">
        {loading && agents.length === 0 ? (
          <div className="py-8 text-center text-[var(--aura-text-muted)] flex flex-col items-center gap-2">
            <RotateCw size={20} className="animate-spin text-[var(--aura-accent,#007acc)]" />
            <span>Scanning system agents...</span>
          </div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.id}
              style={{
                borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.18))',
              }}
              className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                agent.is_installed
                  ? 'hover:border-[var(--aura-accent,#007acc)] hover:bg-black/5 dark:hover:bg-white/5'
                  : 'hover:border-amber-500/50 hover:bg-amber-500/5 bg-black/5 dark:bg-white/[0.02]'
              }`}
              onClick={() => handleAgentClick(agent)}
            >
              {/* Left Brand Icon + Agent Details */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="shrink-0 drop-shadow-sm">
                  {renderAgentLogo(agent.id)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-[var(--aura-text,#ffffff)] truncate">
                      {agent.name}
                    </span>
                    <code className="text-[10px] text-[var(--aura-text-muted)] px-1 py-0.2 rounded bg-black/15 dark:bg-white/10 font-mono">
                      {agent.command}
                    </code>
                  </div>
                  <div className="text-[11px] text-[var(--aura-text-muted)] truncate mt-0.5">
                    {agent.description}
                  </div>
                  {agent.path ? (
                    <div className="text-[9.5px] font-mono text-[var(--aura-text-muted)] opacity-70 truncate mt-0.5">
                      {agent.path}
                    </div>
                  ) : (
                    <div className="text-[9.5px] font-mono text-amber-500/80 truncate mt-0.5">
                      Click to auto-install
                    </div>
                  )}
                </div>
              </div>

              {/* Action / Status Badge */}
              <div className="shrink-0">
                {agent.is_installed ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ready
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAgentClick(agent);
                    }}
                    title={`Click to automatically install ${agent.name} in Container 3`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium bg-amber-500 text-black hover:bg-amber-400 active:scale-95 shadow-xs transition-all"
                  >
                    <Download size={11} strokeWidth={2.5} />
                    <span>Install</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div
        style={{ borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.15))' }}
        className="px-3 py-2 border-t text-[10px] text-[var(--aura-text-muted,#858585)] bg-black/5 dark:bg-white/[0.02] flex items-center justify-between"
      >
        <span>💡 Tip: Press ⌘D in bottom panel to split panes & compare agents</span>
        <span className="font-mono opacity-60">Aura Multi-Agent</span>
      </div>
    </div>
  );
};
