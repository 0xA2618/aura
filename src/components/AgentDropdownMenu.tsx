import React, { useState, useEffect, useRef } from 'react';
import { Plus, Terminal, Bot } from 'lucide-react';
import { DetectedAgent, detectSystemAgents, fetchAcpAgents } from '../services/fileService';

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

// Antigravity ACP (Agent Client Protocol) — same flame silhouette, cyan→violet gradient, with a small "A" ACP badge in the corner
export const AntigravityAcpIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <defs>
      <linearGradient id="antigravity-acp-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#00E5FF" />
        <stop offset="35%" stopColor="#38BDF8" />
        <stop offset="70%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#C084FC" />
      </linearGradient>
    </defs>
    <path
      d="M21.751 22.607c1.34 1.005 3.35.335 1.508-1.508C17.73 15.74 18.904 1 12.037 1 5.17 1 6.342 15.74.815 21.1c-2.01 2.009.167 2.511 1.507 1.506 5.192-3.517 4.857-9.714 9.715-9.714 4.857 0 4.522 6.197 9.714 9.715z"
      fill="url(#antigravity-acp-gradient)"
    />
    <circle cx="18.2" cy="18.2" r="4.6" fill="#0e7490" stroke="#0b0b0b" strokeWidth="0.9" />
    <text x="18.2" y="20.4" textAnchor="middle" fontSize="5.2" fontWeight="700" fill="#a5f3fc" fontFamily="ui-monospace, monospace">A</text>
  </svg>
);

// Google Gemini — 4-point sparkle (Google's Gemini mark silhouette) in blue→violet gradient
export const GeminiIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <defs>
      <linearGradient id="gemini-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4285F4" />
        <stop offset="100%" stopColor="#9B72CF" />
      </linearGradient>
    </defs>
    <path
      d="M12 2c.6 4.5 3.5 7.4 10 10-6.5 2.6-9.4 5.5-10 10-.6-4.5-3.5-7.4-10-10 6.5-2.6 9.4-5.5 10-10z"
      fill="url(#gemini-gradient)"
    />
  </svg>
);

// Antigravity ACP (Agent Client Protocol) — uses the same flame as agy cli; icon disambiguation happens via title/status dot

export const OpenCodeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="-30 0 300 300" fill="currentColor" className={className}>
    <path d="M180 240H60V120H180V240Z" />
    <path d="M180 60H60V240H180V60ZM240 300H0V0H240V300Z" />
  </svg>
);

export { ClaudeIcon as ClaudeLogo, CodexIcon as CodexLogo, AntigravityIcon as AntigravityLogo, AntigravityAcpIcon as AntigravityAcpLogo, OpenCodeIcon as OpenCodeLogo, GeminiIcon as GeminiLogo };

interface AgentDropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent: (agent: DetectedAgent, mode?: 'native' | 'acp') => void;
  onRunInstall: (installCmd: string, agentName: string) => void;
  onOpenAddModal?: (mode: 'native' | 'acp') => void;
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
    acp: true,
  },
  {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    description: 'OpenAI Codex CLI developer terminal assistant',
    category: 'terminal',
    is_installed: false,
    install_command: 'npm install -g @openai/codex',
    acp: true,
  },
  {
    id: 'agy',
    name: 'agy cli',
    command: 'agy',
    description: 'Google Antigravity CLI — native binary (terminal mode)',
    category: 'research',
    is_installed: false,
    install_command: 'npm install -g @google/antigravity-cli',
    acp: false,
  },
  {
    id: 'agy-acp',
    name: 'agy acp',
    command: 'agy',
    description: 'Antigravity ACP — Agent Client Protocol (JSON-RPC over stdio)',
    category: 'coding',
    is_installed: false,
    install_command: 'npm install -g @google/antigravity-cli',
    acp: true,
  },

  {
    id: 'opencode',
    name: 'OpenCode V2',
    command: 'opencode',
    description: 'OpenCode CLI autonomous coding agent',
    category: 'coding',
    is_installed: true,
    install_command: 'npm install -g @opencode/cli || brew install opencode',
    acp: true,
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
  const [agentTab, setAgentTab] = useState<'native' | 'acp'>('native');
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

      // Merge: builtin presets -> auto-detected -> user config (~/.config/aura/aura.json) -> local custom
      const map = new Map<string, DetectedAgent>();
      DEFAULT_PRESET_AGENTS.forEach((preset) => map.set(preset.id, { ...preset }));
      data.forEach((agent) => map.set(agent.id, agent));

      // User config from ~/.config/aura/aura.json (agents.acp) overrides same-id entries;
      // config-only ACP agents are appended as new entries
      try {
        const configAcp = await fetchAcpAgents();
        for (const cfg of configAcp) {
          if (cfg.enabled === false) {
            map.delete(cfg.id);
            continue;
          }
          const existing = map.get(cfg.id);
          map.set(cfg.id, {
            id: cfg.id,
            name: cfg.name,
            command: cfg.command,
            description: existing?.description || 'ACP agent from ~/.config/aura/aura.json',
            category: 'acp',
            is_installed: existing?.is_installed ?? true,
            install_command: existing?.install_command || '',
            path: existing?.path ?? null,
            acp: true,
          });
        }
      } catch (e) {
        console.error('[AgentDropdownMenu config merge error]', e);
      }

      customAgents.forEach((ca) => map.set(ca.id, ca));

      const combined = Array.from(map.values());

      // Ensure ordering: Claude Agent, Codex, agy cli, agy acp, OpenCode V2, then local-bin detected, then custom
      const order = ['claude', 'codex', 'agy', 'agy-acp', 'opencode'];
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

  // Only show installed agents — uninstalled ones are hidden
  const installedAgents = agents.filter((a) => a.is_installed);
  // Native tab: every installed agent except the agy-acp entry (it lives in ACP tab)
  const nativeAgents = installedAgents.filter((a) => a.id !== 'agy-acp');
  // Agent ACP tab for now: agy only
  const acpAgents = installedAgents.filter((a) => a.id === 'agy-acp');
  const visibleAgents = agentTab === 'native' ? nativeAgents : acpAgents;

  const renderIcon = (agent: DetectedAgent) => {
    // Brand icons first (applies to both built-ins and config entries sharing the id)
    switch (agent.id) {
      case 'claude':
        return <ClaudeIcon size={17} className="text-[var(--aura-text)] shrink-0" />;
      case 'codex':
        return <CodexIcon size={17} className="text-[var(--aura-text)] shrink-0" />;
      case 'gemini':
        return <GeminiIcon size={17} className="text-[var(--aura-text)] shrink-0" />;
      case 'agy':
        return <AntigravityIcon size={17} className="text-[var(--aura-text)] shrink-0" />;
      case 'agy-acp':
        return <AntigravityAcpIcon size={17} className="text-[var(--aura-text)] shrink-0" />;
      case 'opencode':
        return <OpenCodeIcon size={16} className="text-[var(--aura-text)] shrink-0" />;
      case 'copilot':
        return <Terminal size={16} className="text-[var(--aura-text)] shrink-0" />;
      default:
        // Config-added ACP agents with no brand icon — generic Bot, tinted ACP blue
        return agent.acp
          ? <Bot size={16} className="text-[#4ea8de] shrink-0" />
          : <Terminal size={16} className="text-[var(--aura-text)] shrink-0" />;
    }
  };

  const getDisplayName = (agent: DetectedAgent) => {
    switch (agent.id) {
      case 'claude':
        return 'claude';
      case 'codex':
        return 'codex';
      case 'gemini':
        return 'gemini';
      case 'opencode':
        return 'opencode';
      case 'agy':
        return 'agy cli';
      case 'agy-acp':
        return 'agy';
      default:
        // Config-added ACP agents: show base name (strip trailing " acp")
        return agent.name.replace(/\s+acp\s*$/i, '').trim() || agent.command;
    }
  };

  const handleAgentClick = (agent: DetectedAgent) => {
    if (agent.is_installed) {
      onSelectAgent(agent, agentTab);
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
      {/* Tabs: Native Agent (default) / Agent ACP */}
      <div className="flex items-center gap-1 px-1 pb-1.5 mb-1 border-b border-[var(--aura-border,rgba(125,125,125,0.15))] select-none">
        <button
          onClick={() => setAgentTab('native')}
          title="原生 Agent — 直接在终端运行原生二进制"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
            agentTab === 'native'
              ? 'text-[var(--aura-text)] bg-black/10 dark:bg-white/10'
              : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]'
          }`}
        >
          <Terminal size={11} />
          <span>原生 Agent</span>
          <span className="text-[9px] opacity-60 font-normal">{nativeAgents.length}</span>
        </button>
        <button
          onClick={() => setAgentTab('acp')}
          title="Agent ACP — Agent Client Protocol (JSON-RPC over stdio)"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
            agentTab === 'acp'
              ? 'text-[#4ea8de] bg-[#007acc]/15'
              : 'text-[var(--aura-text-muted)] hover:text-[#4ea8de]'
          }`}
        >
          <Bot size={11} />
          <span>Agent ACP</span>
          <span className="text-[9px] opacity-60 font-normal">{acpAgents.length}</span>
        </button>
      </div>

      {/* Agents List */}
      <div className="space-y-0.5 min-h-[44px]">
        {visibleAgents.length === 0 && (
          <div className="px-3 py-4 text-center text-[11px] text-[var(--aura-text-muted)]">
            {agentTab === 'native' ? '未检测到已安装的原生 Agent' : '未检测到已安装的 ACP Agent'}
          </div>
        )}
        {visibleAgents.map((agent) => {
          const displayName = getDisplayName(agent);

          return (
            <div
              key={agent.id}
              onClick={() => handleAgentClick(agent)}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="opacity-90 group-hover:opacity-100 transition-opacity">
                  {renderIcon(agent)}
                </div>
                <span className="truncate font-normal tracking-tight">
                  {displayName}
                </span>
                {agentTab === 'acp' && agent.acp && (
                  <span className="shrink-0 text-[9px] font-mono text-[#4ea8de] bg-[#007acc]/15 rounded px-1 py-0.5">ACP</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="my-1 border-t border-[var(--aura-border,rgba(125,125,125,0.15))]" />

      {/* Add agents — mode depends on the active tab */}
      <div>
        {agentTab === 'native' ? (
          <button
            onClick={() => {
              onClose();
              if (onOpenAddModal) {
                onOpenAddModal('native');
              } else if (onOpenSettings) {
                onOpenSettings();
              }
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12] transition-colors text-left cursor-pointer"
          >
            <Plus size={16} className="text-[var(--aura-text-muted)]" />
            <span className="font-normal tracking-tight">Add More Agents</span>
          </button>
        ) : (
          <button
            onClick={() => {
              onClose();
              if (onOpenAddModal) {
                onOpenAddModal('acp');
              } else if (onOpenSettings) {
                onOpenSettings();
              }
            }}
            title="Add a new Agent ACP — launched via JSON-RPC over stdio"
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-[#4ea8de] hover:bg-[#007acc]/10 active:bg-[#007acc]/15 transition-colors text-left cursor-pointer"
          >
            <Bot size={16} className="text-[#4ea8de] shrink-0" />
            <span className="font-normal tracking-tight">Add Agent ACP</span>
            <span className="ml-auto text-[9px] font-mono rounded px-1.5 py-0.5 bg-[#007acc]/20 text-[#4ea8de]">ACP</span>
          </button>
        )}
      </div>
    </div>
  );
};
