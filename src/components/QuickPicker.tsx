import React, { useEffect, useRef } from 'react';
import { Terminal, Bot, Sparkles, X } from 'lucide-react';

interface QuickPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: 'terminal' | 'opencode') => void;
}

export const QuickPicker: React.FC<QuickPickerProps> = ({ isOpen, onClose, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const selectedIndexRef = useRef(0);
  selectedIndexRef.current = selectedIndex;
  const containerRef = useRef<HTMLDivElement>(null);

  const options = [
    {
      id: 'terminal',
      type: 'terminal' as const,
      title: 'Terminal (zsh)',
      desc: 'Native macOS shell with oh-my-zsh environment',
      icon: Terminal,
      color: 'text-green-400',
    },
    {
      id: 'opencode',
      type: 'opencode' as const,
      title: 'OpenCode CLI',
      desc: 'Interactive OpenCode agent session in workspace',
      icon: Bot,
      color: 'text-[#007acc]',
    },
  ];

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIndex(0);

    setTimeout(() => {
      containerRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onSelect(options[selectedIndexRef.current].type);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-24 z-50">
      <div
        ref={containerRef}
        tabIndex={0}
        className="w-[460px] bg-[#252526] border border-[#454545] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 outline-none"
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#333333] bg-[#2d2d2d] select-none">
          <div className="flex items-center gap-1.5 text-xs text-[#cccccc]">
            <Sparkles size={13} className="text-[#007acc]" />
            <span className="font-semibold text-[12.5px]">Split / New Instance</span>
          </div>
          <button onClick={onClose} className="text-[#858585] hover:text-white p-0.5 rounded hover:bg-[#383838]">
            <X size={14} />
          </button>
        </div>

        <div className="p-1.5 space-y-1">
          {options.map((opt, idx) => {
            const isSelected = selectedIndex === idx;
            const Icon = opt.icon;
            return (
              <div
                key={opt.id}
                onClick={() => onSelect(opt.type)}
                className={`flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#04395e] text-white'
                    : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                }`}
              >
                <Icon size={16} className={`mt-0.5 ${opt.color}`} />
                <div className="flex-1">
                  <div className="text-xs font-semibold">{opt.title}</div>
                  <div className="text-[11px] text-[#888888]">{opt.desc}</div>
                </div>
                {isSelected && (
                  <span className="text-[10px] text-[#007acc] bg-[#1e1e1e] px-1.5 py-0.5 rounded font-mono font-medium">
                    Enter
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-3.5 py-1.5 bg-[#1e1e1e] border-t border-[#333333] text-[10px] text-[#666666] flex justify-between font-mono select-none">
          <span>j / k or arrows to select</span>
          <span>Esc to cancel</span>
        </div>
      </div>
    </div>
  );
};
