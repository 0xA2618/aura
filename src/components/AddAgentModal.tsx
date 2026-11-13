import React, { useState, useEffect } from 'react';
import { X, Plus, ShieldCheck, Terminal, Bot } from 'lucide-react';
import {
  registerCustomAgent,
  fetchAcpAgents,
  saveAcpAgents,
  AcpAgentDef,
  DetectedAgent,
} from '../services/fileService';

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentAdded: (agent: DetectedAgent) => void;
  mode?: 'native' | 'acp';
}

export const AddAgentModal: React.FC<AddAgentModalProps> = ({ isOpen, onClose, onAgentAdded, mode = 'native' }) => {
  const [agentName, setAgentName] = useState<string>('');
  const [agentPath, setAgentPath] = useState<string>('');
  const [command, setCommand] = useState<string>('');
  const [args, setArgs] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setAgentName('');
      setAgentPath('');
      setCommand('');
      setArgs('');
      setDescription('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isAcp = mode === 'acp';

  const slugify = (raw: string) =>
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAcp) {
      if (!agentName.trim()) {
        setErrorMsg('Please enter an agent name');
        return;
      }
      if (!command.trim()) {
        setErrorMsg('Please enter the ACP launch command (e.g. my-acp or npx foo)');
        return;
      }

      setIsSubmitting(true);
      setErrorMsg('');
      try {
        const existing = await fetchAcpAgents();
        const base = slugify(agentName) || `acp-${Date.now()}`;
        let id = base;
        let n = 2;
        const existingIds = new Set(existing.map((a) => a.id));
        while (existingIds.has(id)) {
          id = `${base}-${n++}`;
        }
        const argList = args.trim() ? args.trim().split(/\s+/) : ['acp'];
        const newDef: AcpAgentDef = {
          id,
          name: agentName.trim(),
          command: command.trim(),
          args: argList,
          enabled: true,
        };
        const ok = await saveAcpAgents([...existing, newDef]);
        if (!ok) {
          throw new Error('Failed to write ~/.config/aura/aura.json');
        }
        onAgentAdded({
          id,
          name: newDef.name,
          command: newDef.command,
          description: description.trim() || `Agent ACP: ${newDef.name} (added via aura.json)`,
          category: 'acp',
          is_installed: true,
          install_command: '',
          path: newDef.command,
          acp: true,
        });
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to register ACP agent.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ---- Native mode ----
    if (!agentName.trim()) {
      setErrorMsg('Please enter an agent name');
      return;
    }
    if (!agentPath.trim()) {
      setErrorMsg('Please enter an executable path or command');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const newAgent = await registerCustomAgent(agentName.trim(), agentPath.trim());
      if (newAgent) {
        // Persist to local custom agents list
        try {
          const raw = localStorage.getItem('aura_custom_agents');
          const list: DetectedAgent[] = raw ? JSON.parse(raw) : [];
          const filtered = list.filter((a) => a.id !== newAgent.id);
          localStorage.setItem('aura_custom_agents', JSON.stringify([...filtered, newAgent]));
        } catch (e) {
          console.error(e);
        }
        onAgentAdded(newAgent);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to register agent. Please check path.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-tauri-no-drag
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150 font-sans"
    >
      <div
        style={{
          backgroundColor: 'var(--aura-bg-elevated, var(--aura-card-bg, #252526))',
          borderColor: isAcp ? 'rgba(0, 122, 204, 0.4)' : 'var(--aura-border, rgba(125, 125, 125, 0.25))',
          color: 'var(--aura-text, #cccccc)',
        }}
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{ borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.2))' }}
          className="px-5 py-4 border-b flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isAcp
                  ? 'bg-[#007acc]/15 text-[#4ea8de]'
                  : 'bg-[var(--aura-accent,#007acc)]/10 text-[var(--aura-accent,#007acc)]'
              }`}
            >
              {isAcp ? <Bot size={18} /> : <Plus size={18} />}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--aura-text)] flex items-center gap-2">
                {isAcp ? 'Add Agent ACP' : 'Add Custom Agent'}
                {isAcp && (
                  <span className="text-[9px] font-mono rounded px-1.5 py-0.5 bg-[#007acc]/20 text-[#4ea8de]">ACP</span>
                )}
              </h3>
              <p className="text-xs text-[var(--aura-text-muted)]">
                {isAcp
                  ? 'Saved to ~/.config/aura/aura.json (agents.acp)'
                  : 'Launches in the terminal (Container 3)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <span>⚠️ {errorMsg}</span>
            </div>
          )}

          <div className="space-y-3.5">
            {!isAcp ? (
              <>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--aura-text)]">Agent Name</label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. Aider, Gemini CLI, Kimi Code"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    style={{
                      backgroundColor: 'var(--aura-input-bg)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[var(--aura-accent,#007acc)] text-xs font-sans"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--aura-text)]">
                    Executable Launch Path or Command
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. ~/.local/bin/aider or /opt/homebrew/bin/gemini"
                      value={agentPath}
                      onChange={(e) => setAgentPath(e.target.value)}
                      style={{
                        backgroundColor: 'var(--aura-input-bg)',
                        borderColor: 'var(--aura-border)',
                        color: 'var(--aura-text)',
                      }}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[var(--aura-accent,#007acc)] font-mono text-[11px]"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
                    <ShieldCheck size={13} className="shrink-0" />
                    <span>Automatically applies execution permissions (chmod +x)</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--aura-text)]">Agent Name</label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. Aider ACP, My CLI ACP"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    style={{
                      backgroundColor: 'var(--aura-input-bg)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[var(--aura-accent,#007acc)] text-xs font-sans"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--aura-text)]">
                    ACP Command <span className="text-[var(--aura-text-muted)] font-normal">(executable or npx spec)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. my-acp or npx @my/acp-cli"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    style={{
                      backgroundColor: 'var(--aura-input-bg)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[var(--aura-accent,#007acc)] font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--aura-text)]">
                    Args <span className="text-[var(--aura-text-muted)] font-normal">(space-separated, default: <code>acp</code>)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="acp   or   acp --stdio"
                    value={args}
                    onChange={(e) => setArgs(e.target.value)}
                    style={{
                      backgroundColor: 'var(--aura-input-bg)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[var(--aura-accent,#007acc)] font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--aura-text)]">
                    Description <span className="text-[var(--aura-text-muted)] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Short description shown in the agent menu"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{
                      backgroundColor: 'var(--aura-input-bg)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[var(--aura-accent,#007acc)] text-xs font-sans"
                  />
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-[#4ea8de] bg-[#007acc]/10 border border-[#007acc]/25 rounded-lg px-2.5 py-2 leading-snug">
                  <Bot size={13} className="shrink-0 mt-0.5" />
                  <span>
                    Launched as <span className="font-mono font-semibold">ACP</span> — an external process speaking
                    JSON-RPC over <span className="font-mono">stdin/stdout</span> (<code>session/new → session/prompt</code>).
                    Aura renders streamed messages, tool calls and permission requests.
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-[var(--aura-border,rgba(125,125,125,0.15))] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="aura-btn-secondary px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`aura-btn-primary px-4 py-2 text-xs flex items-center gap-1.5 ${
                isAcp ? '!bg-[#007acc] hover:!bg-[#0062a3]' : ''
              }`}
            >
              {isAcp ? (
                <>
                  <Bot size={14} />
                  <span>Add Agent ACP</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Add & Launch in Container 3</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
