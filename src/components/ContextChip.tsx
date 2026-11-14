import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface ContextChipProps {
  /** Live context usage; null = no usage_update received yet */
  usage: { used: number; size: number } | null;
}

/** Percentage chip; click to toggle a `Context / N tokens / n% used` popover; Esc or click-outside closes */
export const ContextChip: React.FC<ContextChipProps> = ({ usage }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onMouse = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse);
    };
  }, [open]);

  const pct = usage && usage.size > 0 ? Math.round((usage.used / usage.size) * 100) : null;
  const usedTxt = usage ? usage.used.toLocaleString() : "—";

  return (
    <div ref={rootRef} className="relative flex flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Context window usage"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[0.78em] font-mono transition-colors border border-transparent hover:border-[var(--aura-border,#3a3a3a)] hover:bg-[var(--aura-input-bg,#1e1e1e)] text-[var(--aura-text-muted,#9ca3af)] hover:text-[var(--aura-text,#dbe2ec)]"
      >
        <span className="tabular-nums">Ctx {pct == null ? "—" : `${pct}%`}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Context"
          className="absolute bottom-full right-0 mb-2 z-50 w-[220px] rounded-xl border border-[var(--aura-border,#3a3a3a)] bg-[var(--aura-card-bg,#252526)] shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
            <span className="text-[0.82em] font-semibold text-[var(--aura-text,#e0e0e0)]">Context</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="p-1 rounded-md text-[var(--aura-text-muted,#9ca3af)] hover:text-[var(--aura-text,#dbe2ec)] hover:bg-white/5"
            >
              <X size={12} />
            </button>
          </div>
          <div className="px-3 pb-3">
            <div className="text-[0.78em] leading-snug font-mono text-[var(--aura-text,#dbe2ec)] tabular-nums">
              {usedTxt} tokens
            </div>
            <div className="mt-0.5 text-[0.78em] text-[var(--aura-text-muted,#9ca3af)]">
              {pct == null ? "no usage_update yet" : `${pct}% used`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextChip;
