import React, { useState, useEffect, useRef } from 'react';
import { Plus, Download, Terminal, Bot } from 'lucide-react';
import { DetectedAgent, detectSystemAgents } from '../services/fileService';

// Official brand icons for AI agents
export const ClaudeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>
);

export const CodexIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);

export const AntigravityIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <defs>
      <linearGradient id="antigravity-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4285F4" />
        <stop offset="35%" stopColor="#9B72CF" />
        <stop offset="70%" stopColor="#EA4335" />
        <stop offset="100%" stopColor="#FBBC05" />
      </linearGradient>
    </defs>
    <path
      d="M21.751 22.607c1.34 1.005 3.35.335 1.508-1.508C17.73 15.74 18.904 1 12.037 1 5.17 1 6.342 15.74.815 21.1c-2.01 2.009.167 2.511 1.507 1.506 5.192-3.517 4.857-9.714 9.715-9.714 4.857 0 4.522 6.197 9.714 9.715z"
      fill="url(#antigravity-gradient)"
    />
  </svg>
);

export const OpenCodeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="-30 0 300 300" fill="currentColor" className={className}>
    <path d="M180 240H60V120H180V240Z" />
    <path d="M180 60H60V240H180V60ZM240 300H0V0H240V300Z" />
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

const DEFAULT_PRESET_AGENTS: DetectedAgent[] = [
  {
    id: 'claude',
    name: 'Claude Agent',
    command: 'claude',
    description: 'Anthropic Claude Code command line agent',
    category: 'coding',
    is_installed: false,
    install_command: 'npm install -g @anthropic-ai/claude-code',
  },
  {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    description: 'OpenAI Codex CLI developer terminal assistant',
    category: 'terminal',
    is_installed: false,
    install_command: 'npm install -g @openai/codex',
  },
  {
    id: 'agy',
    name: 'Google Antigravity',
    command: 'agy',
    description: 'Google Antigravity CLI advanced agentic coding',
    category: 'research',
    is_installed: false,
    install_command: 'npm install -g @google/antigravity-cli',
  },
  {
    id: 'opencode',
    name: 'OpenCode V2',
    command: 'opencode',
    description: 'OpenCode CLI autonomous coding agent',
    category: 'coding',
    is_installed: true,
    install_command: 'npm install -g @opencode/cli || brew install opencode',
  },
];

export const AgentDropdownMenu: React.FC<AgentDropdownMenuProps> = ({
  isOpen,
  onClose,
  onSelectAgent,
  onRunInstall,
  onOpenAddModal,
  onOpenSettings,
}) => {
  const [agents, setAgents] = useState<DetectedAgent[]>(DEFAULT_PRESET_AGENTS);
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

      // Merge presets with detected data to guarantee all supported agents are displayed
      const map = new Map<string, DetectedAgent>();
      DEFAULT_PRESET_AGENTS.forEach((preset) => map.set(preset.id, { ...preset }));
      data.forEach((agent) => map.set(agent.id, agent));
      customAgents.forEach((ca) => map.set(ca.id, ca));

      const combined = Array.from(map.values());

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
        backgroundColor: 'var(--aura-bg-elevated, var(--aura-card-bg, #252526))',
        borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.25))',
        color: 'var(--aura-text, #cccccc)',
        boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.2)',
      }}
      className="absolute right-0 top-full mt-1.5 w-[260px] rounded-xl border z-[100] overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100 font-sans p-1.5"
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
              className="flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] transition-colors cursor-pointer group"
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
                    <span className="text-[12px] text-[var(--aura-text-muted)] font-sans font-normal tracking-wide">
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
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--aura-accent,#007acc)] text-white hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
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
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] transition-colors text-left cursor-pointer"
        >
          <Plus size={16} className="text-[var(--aura-text-muted)]" />
          <span className="font-normal tracking-tight">Add More Agents</span>
        </button>
      </div>
    </div>
  );
};
