import React, { useState, useEffect } from 'react';
import { X, Plus, ShieldCheck, Terminal } from 'lucide-react';
import { registerCustomAgent, DetectedAgent } from '../services/fileService';

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentAdded: (agent: DetectedAgent) => void;
}

export const AddAgentModal: React.FC<AddAgentModalProps> = ({ isOpen, onClose, onAgentAdded }) => {
  const [agentName, setAgentName] = useState<string>('');
  const [agentPath, setAgentPath] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setAgentName('');
      setAgentPath('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          backgroundColor: 'var(--aura-bg-elevated, #252526)',
          borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.25))',
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
            <div className="p-2 rounded-xl bg-[var(--aura-accent,#007acc)]/10 text-[var(--aura-accent,#007acc)]">
              <Plus size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--aura-text,#ffffff)]">Add Custom Agent</h3>
              <p className="text-xs text-[var(--aura-text-muted,#858585)]">
                Provide launch path to register and run in Container 3
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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
            <div>
              <label className="block font-medium mb-1.5 text-[var(--aura-text,#ffffff)]">
                Agent Name
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Hermes Agent, Aider, Gemini CLI"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                style={{
                  backgroundColor: 'var(--aura-input-bg, rgba(0, 0, 0, 0.2))',
                  borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.3))',
                  color: 'var(--aura-text, #ffffff)',
                }}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[var(--aura-accent,#007acc)] text-xs font-sans"
              />
            </div>

            <div>
              <label className="block font-medium mb-1.5 text-[var(--aura-text,#ffffff)]">
                Executable Launch Path or Command
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. ~/.local/bin/hermes or /opt/homebrew/bin/aider"
                  value={agentPath}
                  onChange={(e) => setAgentPath(e.target.value)}
                  style={{
                    backgroundColor: 'var(--aura-input-bg, rgba(0, 0, 0, 0.2))',
                    borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.3))',
                    color: 'var(--aura-text, #ffffff)',
                  }}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:border-[var(--aura-accent,#007acc)] font-mono text-[11px]"
                />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
                <ShieldCheck size={13} className="shrink-0" />
                <span>Automatically applies execution permissions (chmod +x)</span>
              </div>
            </div>
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
              className="aura-btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Add & Launch in Container 3</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
