import React, { useState, useEffect } from 'react';
import { X, Plus, Terminal, Search, Check, ShieldCheck, Folder, Sparkles } from 'lucide-react';
import { ScannedBinItem, scanLocalBin, registerCustomAgent, DetectedAgent } from '../services/fileService';

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentAdded: (agent: DetectedAgent) => void;
}

export const AddAgentModal: React.FC<AddAgentModalProps> = ({ isOpen, onClose, onAgentAdded }) => {
  const [scannedItems, setScannedItems] = useState<ScannedBinItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [agentName, setAgentName] = useState<string>('');
  const [agentPath, setAgentPath] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setErrorMsg('');
    setAgentName('');
    setAgentPath('');
    setSearchTerm('');

    scanLocalBin()
      .then((items) => {
        setScannedItems(items);
      })
      .catch((err) => {
        console.error('[AddAgentModal scan error]', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
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

  const handleSelectItem = (item: ScannedBinItem) => {
    setAgentPath(item.path);
    // Format a nice human-readable name if not already set
    if (!agentName || agentName === '') {
      const formatted = item.name
        .split(/[-_]/)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      setAgentName(formatted);
    }
  };

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
        // Save to localStorage persistent list
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

  const filteredItems = scannedItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
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
              <h3 className="font-semibold text-sm text-[var(--aura-text,#ffffff)]">Add More Agents</h3>
              <p className="text-xs text-[var(--aura-text-muted,#858585)]">
                Select from ~/.local/bin or paste any custom binary path
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <span>⚠️ {errorMsg}</span>
            </div>
          )}

          {/* Form Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block font-medium mb-1.5 text-[var(--aura-text)]">
                Agent Display Name
              </label>
              <input
                type="text"
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
              <label className="block font-medium mb-1.5 text-[var(--aura-text)]">
                Executable Path or Command
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. /Users/Yang/.local/bin/hermes-agent or ~/.local/bin/oc"
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
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
                <ShieldCheck size={13} />
                <span>Automatically applies execution permissions (chmod +x)</span>
              </div>
            </div>
          </div>

          {/* Local .local/bin discovery section */}
          <div className="pt-2 border-t border-[var(--aura-border,rgba(125,125,125,0.15))]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-medium text-[var(--aura-text)]">
                <Folder size={14} className="text-[var(--aura-accent,#007acc)]" />
                <span>Discovered in ~/.local/bin/</span>
                <span className="text-[10px] font-mono opacity-60">({scannedItems.length})</span>
              </div>
              {scannedItems.length > 5 && (
                <div className="relative w-36">
                  <input
                    type="text"
                    placeholder="Search tools..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      backgroundColor: 'var(--aura-input-bg, rgba(0, 0, 0, 0.2))',
                      borderColor: 'var(--aura-border, rgba(125, 125, 125, 0.2))',
                    }}
                    className="w-full px-2 py-1 pl-6 rounded border text-[11px] focus:outline-none focus:border-[var(--aura-accent,#007acc)]"
                  />
                  <Search size={11} className="absolute left-2 top-2 text-[var(--aura-text-muted)]" />
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-[var(--aura-text-muted)]">
                Scanning ~/.local/bin/...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-4 text-center text-[var(--aura-text-muted)] text-[11px]">
                No matching executables found in ~/.local/bin. You can paste any path above.
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {filteredItems.map((item) => {
                  const isSelected = agentPath === item.path;
                  return (
                    <div
                      key={item.path}
                      onClick={() => handleSelectItem(item)}
                      style={{
                        borderColor: isSelected
                          ? 'var(--aura-accent, #007acc)'
                          : 'var(--aura-border, rgba(125, 125, 125, 0.15))',
                        backgroundColor: isSelected
                          ? 'var(--aura-accent-hover, rgba(0, 122, 204, 0.15))'
                          : undefined,
                      }}
                      className="px-2.5 py-1.5 rounded-lg border flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Terminal size={13} className="text-[var(--aura-text-muted)] shrink-0" />
                        <span className="font-mono font-medium text-[var(--aura-text)] truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--aura-text-muted)] opacity-60 truncate">
                          {item.path}
                        </span>
                      </div>
                      {isSelected ? (
                        <Check size={14} className="text-[var(--aura-accent,#007acc)] shrink-0" />
                      ) : (
                        <span className="text-[10px] text-[var(--aura-text-muted)] opacity-70 shrink-0">
                          Click to select
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
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
