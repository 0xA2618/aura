import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Bot, Check, Activity, ChevronDown, Copy, Download } from "lucide-react";
import { AcpMarkdown } from "./AcpMarkdown";
import { ContextChip } from "./ContextChip";
import { acpStart, acpSendPrompt, acpSetConfigOption, acpCancel, listenToAcpSession, trackAcpConversation, memorySave } from "../services/fileService";
import { AcpConfigOption, AcpConfigSelectOption, AcpConfigSelectGroup } from "../types";

interface AcpMessageData {
  type?: string;
  [key: string]: any;
}

interface AcpMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  raw: AcpMessageData;
  timestamp: string;
  images?: string[]; // 剪贴板粘贴的截图缩略图（dataUrl）
  tool?: { label: string; status: 'running' | 'done'; toolCallId?: string }; // ACP 工具调用一行摘要
  elapsedMs?: number; // 该 assistant 消息所在回合耗时
  tokPerSec?: number; // 回合吞吐（outputTokens / 秒），无 usage 时不显示
}

interface AcpSessionProps {
  sessionId: string;
  agentId: string;
  agentName: string;
  cwd: string;
  onSessionClose: (sessionId: string) => void;
  onStatusChange?: (sessionId: string, status: 'connecting' | 'connected' | 'error') => void;
  /** 恢复用的 agent 侧会话 id（ACP 会话续聊时携带，session/load 重接） */
  resumeAgentSessionId?: string;
  /** ACP 面板字号（跟随 Panel 3 终端字号，⌘+/⌘- 可调） */
  fontSize?: number;
}

// ACP 面板本地客户端命令 —— 全部由 Aura 自己实现（对所有 ACP agent 通用）
const CLIENT_SLASH_COMMANDS: Array<{ name: string; description: string }> = [
  { name: "exit", description: "退出当前 ACP 会话（杀死 agent 进程并关闭标签）" },
  { name: "usage", description: "显示上下文窗口占用（used / size）" },
  { name: "save", description: "提炼本次会话并同步（EverOS 未配置时保存到本地 memo）" },
];

// 从消息记录生成本地兜底摘要（agent 综合提炼失败/ToS 不可用时使用）
const buildLocalDigest = (msgs: AcpMessageItem[]): string => {
  const firstUser = msgs.find((m) => m.role === "user");
  const userPrompts = msgs
    .filter((m) => m.role === "user")
    .slice(0, 12)
    .map((m) => `- ${m.content.trim().split("\n")[0].slice(0, 100)}`);
  const recent = msgs
    .filter((m) => m.role === "assistant" && m.content.trim())
    .slice(-3)
    .map((m) => m.content.replace(/\s+/g, " ").trim().slice(0, 400));
  const errorHits = Array.from(
    new Set(msgs.flatMap((m) => m.content.match(/(?:error|fail\w*|exception|traceback|⚠[^\n]*)/gi) ?? []))
  ).slice(0, 12);
  const lines = [
    "## 目标",
    firstUser ? firstUser.content.trim().split("\n")[0].slice(0, 200) : "（无 user 消息）",
    "",
    "## 用户指令摘要（前 12 条）",
    ...(userPrompts.length ? userPrompts : ["（空）"]),
    "",
    "## 关键进展 / 错误",
    ...(errorHits.length ? errorHits.map((e) => `- ${String(e).slice(0, 160)}`) : ["（未检出明显错误行）"]),
    "",
    "## 最近助手回复（末 3 条，截断）",
    ...(recent.length ? recent.map((t, i) => `- (${i + 1}) ${t}`) : ["（无助手消息）"]),
    "",
    "_由 Aura 本地提炼生成（agent 综合提炼不可用时的降级结果）_",
  ];
  return lines.join("\n");
};

// Resolve a config option's current value to its human-readable name
const getCurrentOptionName = (opt: AcpConfigOption): string => {
  const cur = String(opt.currentValue ?? "");
  const raw = opt.options ?? [];
  if (raw.length > 0 && "group" in raw[0]) {
    for (const g of raw as AcpConfigSelectGroup[]) {
      const found = g.options.find((o) => o.value === cur);
      if (found) return found.name;
    }
    return cur;
  }
  const found = (raw as AcpConfigSelectOption[]).find((o) => o.value === cur);
  return found ? found.name : cur;
};

const filterOptions = (opt: AcpConfigOption, query: string) => {
  const q = query.trim().toLowerCase();
  const raw = opt.options ?? [];
  if (raw.length > 0 && "group" in raw[0]) {
    const groups = (raw as AcpConfigSelectGroup[])
      .map((g) => ({
        ...g,
        options: g.options.filter(
          (o) => !q || o.name.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.options.length > 0);
    return { groups, flat: [] as AcpConfigSelectOption[] };
  }
  const flat = (raw as AcpConfigSelectOption[]).filter(
    (o) => !q || o.name.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
  );
  return { groups: [] as AcpConfigSelectGroup[], flat };
};

interface ConfigSelectChipProps {
  opt: AcpConfigOption;
  isOpen: boolean;
  onToggle: (id: string | null) => void;
  onSelect: (optionId: string, value: string) => void;
  width?: number; // 固定槽位宽度（像素），不传则按内容收缩
}

const ConfigSelectChip: React.FC<ConfigSelectChipProps> = ({ opt, isOpen, onToggle, onSelect, width }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onToggle(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onToggle]);

  const label = getCurrentOptionName(opt);
  const { groups, flat } = filterOptions(opt, "");

  const renderItem = (o: AcpConfigSelectOption) => {
    const selected = String(opt.currentValue ?? "") === o.value;
    return (
      <button
        key={o.value}
        onClick={() => {
          onSelect(opt.id, o.value);
          onToggle(null);
        }}
        title={o.description || o.value}
        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-[0.8em] transition-colors ${
          selected ? "bg-[#007acc]/30 text-[var(--aura-accent,#007acc)]" : "text-[var(--aura-text,#e0e0e0)] hover:bg-white/10"
        }`}
      >
        <span className="truncate">{o.name}</span>
        {selected && <Check size={12} className="text-[var(--aura-accent,#4ea8de)] shrink-0" />}
      </button>
    );
  };

  return (
    <div className="relative" ref={rootRef} style={width ? { width } : undefined}>
      <button
        onClick={() => onToggle(isOpen ? null : opt.id)}
        title={`${opt.name}: ${label}`}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[0.8em] text-[var(--aura-text-muted,#8a8f95)] hover:bg-white/5 hover:text-[var(--aura-text,#dbe2ec)] transition-colors max-w-[240px] min-w-0 flex-shrink${width ? " w-full justify-between" : ""}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={11}
          className={`shrink-0 transition-transform duration-150 opacity-60 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-72 max-w-[calc(100vw-360px)] max-h-96 flex flex-col rounded-xl border border-[var(--aura-border,#3c3c3c)] bg-[var(--aura-card-bg,#252526)] shadow-2xl overflow-hidden">
          <div className="flex-1 overflow-y-auto p-1">
            {groups.map((g) => (
              <div key={g.group}>
                <div className="px-2 py-1 text-[0.72em] uppercase tracking-wide text-[var(--aura-text-muted,#777777)]">
                  {g.name}
                </div>
                {g.options.map(renderItem)}
              </div>
            ))}
            {flat.map(renderItem)}
          </div>
        </div>
      )}
    </div>
  );
};

// 毫秒 → \`Took 12s\` / \`Took 1m 5s\`
const formatElapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};

// 工具调用折叠组：连续出现的工具行合并为一个紧凑按钮；平时只显示最新一条 + 数量；点击展开全部
const ToolActivityGroup: React.FC<{ tools: AcpMessageItem[] }> = ({ tools }) => {
  const [expanded, setExpanded] = useState(false);
  const latest = tools[tools.length - 1];
  const running = tools.some((t) => t.tool?.status === 'running');
  const count = tools.length;
  return (
    <div className="acp-tool-group">
      <button
        type="button"
        className={`acp-tool-group-header ${running ? 'running' : 'done'}`}
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? '收起工具调用列表' : `展开全部 ${count} 条工具调用`}
      >
        <span className="acp-tool-dot" aria-hidden="true" />
        <span className="acp-tool-label">
          {running ? 'Running:' : 'Done:'} {latest.tool?.label}
        </span>
        <span className="acp-tool-count">{count}</span>
        <ChevronDown size={11} className={`acp-tool-caret ${expanded ? 'expanded' : ''}`} />
      </button>
      {expanded && (
        <div className="acp-tool-group-list">
          {tools.map((t) => (
            <div key={t.id} className={`acp-tool-line ${t.tool?.status}`}>
              <span className="acp-tool-dot" aria-hidden="true" />
              <span className="acp-tool-label" title={t.tool?.label}>
                {t.tool?.status === 'running' ? 'Running:' : 'Done:'} {t.tool?.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AcpSession: React.FC<AcpSessionProps> = ({
  sessionId,
  agentId,
  agentName,
  cwd,
  onSessionClose,
  onStatusChange,
  resumeAgentSessionId,
  fontSize = 13.5,
}) => {
  const basePx = `${fontSize}px`;
  const [messages, setMessages] = useState<AcpMessageItem[]>([]);
  const stderrScratchRef = useRef<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState(0);
  const [configOptions, setConfigOptions] = useState<AcpConfigOption[]>([]);
  const [openConfigId, setOpenConfigId] = useState<string | null>(null);
  const [connState, setConnState] = useState<"connecting" | "connected" | "error">("connecting");
  const startWatchdogRef = useRef<number | null>(null);
  // ctx 占用：挂载时从 localStorage 恢复上次已知值（agent 重连 replay 会刷新为最新）
  const usageStorageKey = `aura:acpUsage:${sessionId}`;
  const [usage, setUsage] = useState<{ used: number; size: number } | null>(() => {
    try {
      const raw = localStorage.getItem(`aura:acpUsage:${sessionId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    try {
      if (usage) localStorage.setItem(usageStorageKey, JSON.stringify(usage));
    } catch { /* quota ignored */ }
  }, [usage, usageStorageKey]);
  // 文件拖入 ACP 对话：支持 Aura 内部树拖动或任意 text/plain/aura-path（与 TerminalPane 一致），插入带引号的绝对路径
  const [isDragOver, setIsDragOver] = useState(false);
  const handleAcpDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleAcpDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };
  const handleAcpDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const droppedPath =
      (window as any).__AURA_DRAGGED_PATH__ ||
      e.dataTransfer.getData('application/aura-path') ||
      e.dataTransfer.getData('text/plain') ||
      '';
    const path = String(droppedPath).trim();
    if (!path) return;
    // 统一加双引号引用绝对路径（即使路径不含空格）
    const quoted = `"${path}"`;
    setInput((prev) => (prev ? `${prev} ${quoted} ` : `${quoted} `));
    setSlashClosed(false);
    textareaRef.current?.focus();
  };

  const messagesRef = useRef<AcpMessageItem[]>([]);
  const pendingSaveRef = useRef(false);
  const pendingSaveBufferRef = useRef("");
  const pendingSaveSysMsgIdRef = useRef<string | null>(null);
  const agentSessionIdRef = useRef<string | null>(null);
  const finalizeSaveRef = useRef<() => Promise<void>>(async () => {});
  const [availableCommands, setAvailableCommands] = useState<Array<{ name: string; description: string; input?: { hint?: string } }>>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashClosed, setSlashClosed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Report connection status up (for the dock tab dot in the panel title bar)
  useEffect(() => {
    onStatusChange?.(sessionId, connState);
  }, [connState, onStatusChange, sessionId]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const streamingRef = useRef(false);
  // 实时发送的用户消息回显队列：resume 回放与实时回显区分，避免重复
  const pendingEchoRef = useRef<string[]>([]);
  // 输入历史（↑↓ 回溯，持久化到 localStorage，最多 100 条）
  const [inputHistory, setInputHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('aura:acpInputHistory');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String).slice(0, 100) : [];
    } catch {
      return [];
    }
  });
  const historyIndexRef = useRef(-1);   // -1 = 正在编辑新输入
  const historyDraftRef = useRef('');   // 翻历史前暂存的草稿
  // Thinking 已用时间（秒）：整个回合期间持续计时，避免沉默期看不到状态
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const thinkingStartedAtRef = useRef<number | null>(null);
  // 回合阶段：thinking（等待/思考）→ answering（收到分块）→ tool（工具调用中）
  const [sawAssistantChunk, setSawAssistantChunk] = useState(false);
  const [activeToolLabel, setActiveToolLabel] = useState('');
  // 剪贴板粘贴的图片（最多 5 张，随下一条 prompt 一起发送）
  const [pendingImages, setPendingImages] = useState<
    Array<{ id: string; dataUrl: string; base64: string; mimeType: string; name: string }>
  >([]);
  const turnBusy = isAwaitingResponse || activeToolCalls > 0;
  useEffect(() => {
    if (!turnBusy) {
      thinkingStartedAtRef.current = null;
      setThinkingElapsed(0);
      return;
    }
    if (thinkingStartedAtRef.current == null) thinkingStartedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      if (thinkingStartedAtRef.current) {
        setThinkingElapsed(Math.floor((Date.now() - thinkingStartedAtRef.current) / 1000));
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [turnBusy]);

  const atBottomRef = useRef(true);
  const [showJumpBottom, setShowJumpBottom] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [isOutlineHovered, setIsOutlineHovered] = useState(false);

  const userTurns = useMemo(() => {
    return messages
      .filter((m) => m.role === 'user' && m.content?.trim())
      .map((m) => {
        const full = m.content.trim();
        const firstLine = full.split('\n')[0].trim();
        return {
          id: m.id,
          fullText: full,
          summary: firstLine.length > 28 ? firstLine.slice(0, 28) + '...' : firstLine,
        };
      });
  }, [messages]);

  useEffect(() => {
    if (userTurns.length > 0) {
      setActiveTurnId((prev) => prev || userTurns[userTurns.length - 1].id);
    }
  }, [userTurns]);

  const handleCopyMessage = useCallback(async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgId(msgId);
      setTimeout(() => {
        setCopiedMsgId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  }, []);

  const handleDownloadMessage = useCallback((content: string, timestamp: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTime = (timestamp || new Date().toISOString()).replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `${agentId || 'agent'}-reply-${safeTime}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [agentId]);

  const scrollToEnd = useCallback((force = false) => {
    if (!force && !atBottomRef.current) return;
    atBottomRef.current = true;
    setShowJumpBottom(false);
    const doScroll = () => {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    };
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 40);
    setTimeout(doScroll, 120);
    setTimeout(doScroll, 300);
  }, []);

  // 统一滚动状态更新逻辑：同步 atBottom 与「到底部」按钮显隐，并计算当前视口中浏览的 turn
  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAtBottom = distance < 40;
    atBottomRef.current = isAtBottom;
    setShowJumpBottom(distance > 60);

    if (userTurns.length > 0) {
      if (isAtBottom) {
        setActiveTurnId(userTurns[userTurns.length - 1].id);
      } else {
        const containerTop = el.getBoundingClientRect().top;
        let currentActive = userTurns[0].id;
        for (const turn of userTurns) {
          const msgEl = document.getElementById(`acp-msg-${turn.id}`);
          if (msgEl) {
            const rect = msgEl.getBoundingClientRect();
            if (rect.top - containerTop <= 160) {
              currentActive = turn.id;
            }
          }
        }
        setActiveTurnId(currentActive);
      }
    }
  }, [userTurns]);

  const handleJumpToTurn = useCallback((turnId: string) => {
    setActiveTurnId(turnId);
    const msgEl = document.getElementById(`acp-msg-${turnId}`);
    if (msgEl) {
      msgEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // 平滑跳到底部（「到底部」按钮用）
  const jumpToBottom = useCallback(() => {
    atBottomRef.current = true;
    setShowJumpBottom(false);
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // 监听消息区滚动：维护 atBottom 标记，控制「到底部」按钮显隐
  const handleMessagesScroll = useCallback(() => {
    updateScrollState();
  }, [updateScrollState]);

  // 监听内容尺寸变化（例如 Markdown 异步排版完成、Mermaid SVG 渲染、代码块展开等）
  // 只要用户在底部，就自动保持贴底；若不在底部则更新「到底部」按钮显隐
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) {
        el.scrollTop = el.scrollHeight;
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      } else {
        updateScrollState();
      }
    });
    ro.observe(el);
    for (let i = 0; i < el.children.length; i++) {
      ro.observe(el.children[i]);
    }
    return () => ro.disconnect();
  }, [messages, updateScrollState]);

  // 窗口跨显示器移动 / 缩放时内容高度突变：若用户原本就在底部，重新锚定到底部
  useEffect(() => {
    const onResize = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (atBottomRef.current) {
            scrollToEnd(true);
          } else {
            updateScrollState();
          }
        });
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [scrollToEnd, updateScrollState]);

  useEffect(() => {
    if (atBottomRef.current) {
      scrollToEnd();
    } else {
      updateScrollState();
    }
  }, [messages, scrollToEnd, updateScrollState]);

  // 会话恢复一次性跳到底 — 处理长 history replay 完成后才显示
  const startupScrolledRef = useRef(false);
  useEffect(() => {
    if (isStarted && !startupScrolledRef.current) {
      startupScrolledRef.current = true;
      requestAnimationFrame(() => scrollToEnd(true));
      setTimeout(() => scrollToEnd(true), 100);
      setTimeout(() => scrollToEnd(true), 400);
    }
  }, [isStarted, scrollToEnd]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const addMessage = useCallback(
    (role: "user" | "assistant" | "system", content: string, raw?: AcpMessageData): string => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setMessages((prev) => [
        ...prev,
        {
          id,
          role,
          content,
          raw: raw || {},
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      ]);
      return id;
    },
    []
  );

  // 回合结束：把本回合耗时 + tok/s 盖到最后一条 assistant 消息（用于响应底部 Took / tok/s 行）
  const stampTurnMeta = useCallback((usage: any) => {
    const started = thinkingStartedAtRef.current;
    if (started == null) return;
    const elapsedMs = Date.now() - started;
    const outTok = usage && typeof usage.outputTokens === 'number' ? usage.outputTokens : null;
    const tokPerSec =
      outTok != null && elapsedMs > 0 ? Math.round((outTok / (elapsedMs / 1000)) * 10) / 10 : undefined;
    setMessages((prev) => {
      let idx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'assistant') { idx = i; break; }
      }
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], elapsedMs, tokPerSec };
      return next;
    });
  }, []);

  // 工具调用一行摘要：running → done
  const addToolLine = useCallback((label: string, toolCallId?: string): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: "system",
        content: label,
        raw: {},
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        tool: { label, status: 'running', toolCallId },
      },
    ]);
    return id;
  }, []);

  const toolLineIdsRef = useRef<string[]>([]);

  const markToolLineDone = useCallback((toolCallId?: string) => {
    if (toolCallId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.tool?.toolCallId === toolCallId && m.tool.status === 'running'
            ? { ...m, tool: { ...m.tool!, status: 'done' } }
            : m
        )
      );
      return;
    }
    const id = toolLineIdsRef.current.pop();
    if (!id) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === id && m.tool ? { ...m, tool: { ...m.tool, status: 'done' } } : m))
    );
  }, []);

  // 回合结束兜底：所有仍处于 running 的工具行翻为 done
  const flushToolLines = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.tool?.status === 'running' ? { ...m, tool: { ...m.tool!, status: 'done' } } : m))
    );
    toolLineIdsRef.current = [];
  }, []);

  const appendToLastAssistantMessage = useCallback((chunk: string) => {
    setMessages((prev) => {
      // 找最近一条 assistant 气泡（工具一行摘要等 system 消息可能插在中间，
      // 不能用「最后一条是否是 assistant」来判断，否则回复会被静默丢弃）
      let idx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === "assistant") { idx = i; break; }
      }
      if (idx === -1) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        return [
          ...prev,
          {
            id,
            role: "assistant",
            content: chunk,
            raw: {},
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
        ];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], content: next[idx].content + chunk };
      return next;
    });
  }, []);

  const handleAcpMessage = useCallback(
    (msg: { type: string; data: any }) => {
      const data = msg.data || {};
      switch (msg.type) {
        case "config_options":
          setConfigOptions(Array.isArray(data.configOptions) ? data.configOptions : []);
          streamingRef.current = false;
          break;

        case "session_created":
          if (startWatchdogRef.current != null) {
            window.clearTimeout(startWatchdogRef.current);
            startWatchdogRef.current = null;
          }
          if (data?.sessionId) {
            agentSessionIdRef.current = String(data.sessionId);
            trackAcpConversation(String(data.sessionId), agentId);
          }
          setIsStarted(true);
          setConnState("connected");
          streamingRef.current = false;
          break;

        case "info":
          // handshake noise — not rendered; connState drives the header dot instead
          streamingRef.current = false;
          break;

        case "update": {
          const kind = data.sessionUpdate || "unknown";
          switch (kind) {
            case "agent_message_chunk":
              if (data.content) {
                if (!pendingSaveRef.current) setSawAssistantChunk(true);
                if (pendingSaveRef.current) {
                  pendingSaveBufferRef.current += String(data.content);
                  break;
                }
                if (streamingRef.current) {
                  appendToLastAssistantMessage(String(data.content));
                } else {
                  addMessage("assistant", String(data.content), data);
                  streamingRef.current = true;
                }
              }
              break;
            case "thought_message_chunk":
            case "agent_thought_chunk":
              break;
            case "user_message_chunk": {
              // 回放历史时还原用户气泡；实时发送时按 pendingEchoRef 队列去重
              const text = String(data.content ?? '').trim();
              if (!text) break;
              if (pendingSaveRef.current) break;
              const pending = pendingEchoRef.current;
              const idx = pending.indexOf(text);
              if (idx >= 0) {
                pending.splice(idx, 1);
                break;
              }
              addMessage("user", text, data);
              break;
            }
            case "tool_call":
              if (pendingSaveRef.current) break;
              setActiveToolCalls((n) => n + 1);
              {
                const raw =
                  (data.title != null && String(data.title)) ||
                  (typeof data.content === 'string' ? data.content : '') ||
                  'tool';
                const label = raw.replace(/\s+/g, ' ').trim().slice(0, 64) || 'tool';
                const toolCallId = typeof data.toolCallId === 'string' ? data.toolCallId : undefined;
                setActiveToolLabel(label);
                toolLineIdsRef.current.push(addToolLine(label, toolCallId));
              }
              break;
            case "tool_call_update": {
              if (pendingSaveRef.current) break;
              const s = String(data.status || "").toLowerCase();
              const done = s === "completed" || s === "cancelled" || s === "rejected" || s === "error" || s === "failed";
              if (done) {
                setActiveToolCalls((n) => Math.max(0, n - 1));
                markToolLineDone(typeof data.toolCallId === 'string' ? data.toolCallId : undefined);
              }
              break;
            }
            case "plan":
              break;
            case "available_commands_update":
            case "available_commands": {
              // 每个 agent 广告的命令清单（含其全局/项目 skill）——存起来供 "/" 补全使用
              const cmds = Array.isArray(data.availableCommands) ? data.availableCommands : [];
              const seen = new Set<string>();
              const normalized = cmds
                .map((c: any) => ({
                  name: String(c?.name ?? "").replace(/^\/+/, "").trim(),
                  description: String(c?.description ?? ""),
                  input:
                    c?.input && typeof c.input === "object"
                      ? { hint: String(c.input?.hint ?? "") || undefined }
                      : undefined,
                }))
                .filter((c: { name: string }) => {
                  const key = c.name.toLowerCase();
                  if (!key || seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
              setAvailableCommands(normalized);
              setSlashIndex(0);
              break;
            }
            case "usage_update": {
              const used = Number(data.used);
              const size = Number(data.size);
              if (Number.isFinite(used) && Number.isFinite(size)) {
                setUsage({ used, size });
              }
              break;
            }
            case "config_option_update":
              streamingRef.current = false;
              break;
            case "mode_change":
              addMessage("system", `Mode changed to ${data.mode ?? "unknown"}`, data);
              break;
            case "session_info_update":
              // 会话元信息刷新（如标题、模型等），不在面板显示
              break;
            default:
              addMessage("system", `[ACP] ${kind}`, data);
          }
          if (kind !== "agent_message_chunk" && kind !== "thought_message_chunk") {
            streamingRef.current = false;
          }
          break;
        }

        case "permission":
          // 静默：不再在对话流中显示 auto-approved 行（已经在做自动批准）
          break;

        case "fs":
          addMessage(
            "system",
            `${data.op === "read" ? "Read" : "Wrote"}: ${data.path || ""}`,
            data
          );
          break;

        case "stderr": {
          const line = String(data ?? '').slice(0, 240);
          if (line) {
            const buf = stderrScratchRef.current;
            if (buf.length >= 8) buf.shift();
            buf.push(line);
          }
          break;
        }

        case "error":
          setIsAwaitingResponse(false);
          setActiveToolCalls(0);
          flushToolLines();
          pendingEchoRef.current = [];
          stampTurnMeta(data?.result?.usage ?? null);
          setSawAssistantChunk(false);
          setActiveToolLabel('');
          setConnState("error");
          if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            void finalizeSaveRef.current();
          }
          addMessage("system", `Error: ${data.message || JSON.stringify(data)}`, data);
          break;

            case "terminated":
              setIsAwaitingResponse(false);
              setActiveToolCalls(0);
              flushToolLines();
              stampTurnMeta(null);
          setSawAssistantChunk(false);
          setActiveToolLabel('');
              setConnState("error");
              // 如果还没收到 session_created（agent 刚起来就退出了），把按钮替换成明确错误
              if (!agentSessionIdRef.current) {
                setStartError((prev) => prev ?? "ACP 进程意外退出（agent 启动后立刻断开）。这是账户/server 端问题，不是前端渲染问题。请检查 agy 是否可正常工作（例如 agy --help），或查看 ~/.gemini/antigravity-cli/log/acp-server-*.log 最后几行。");
              }
              addMessage("system", `[ACP] Agent exited`, data);
              setIsStarted(false);
              break;

        case "message":
          setIsAwaitingResponse(false);
          setActiveToolCalls(0);
          flushToolLines();
          pendingEchoRef.current = [];
          stampTurnMeta(data?.result?.usage ?? null);
          setSawAssistantChunk(false);
          setActiveToolLabel('');
          // Raw JSON-RPC responses (initialize / session/new / session/prompt results)
          streamingRef.current = false;
          if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            void finalizeSaveRef.current();
          }
          break;

        default:
          console.log("[AcpSession] unknown event", msg);
      }
    },
    [addMessage, appendToLastAssistantMessage, agentName]
  );

  const handleAcpMessageRef = useRef(handleAcpMessage);
  useEffect(() => {
    handleAcpMessageRef.current = handleAcpMessage;
  }, [handleAcpMessage]);

  const startSession = useCallback(async () => {
    setStartError(null);
    setConnState("connecting");
    stderrScratchRef.current = [];

    // 兜底：8 秒还没看到 session_created，就当启动失败，把 stderr 提示给用户
    startWatchdogRef.current = window.setTimeout(() => {
      const tail = stderrScratchRef.current.slice(-4).join('\n').trim();
      setStartError(
        tail
          ? `ACP 连接超时（45s 未响应）。最近日志：\n${tail}`
          : 'ACP 连接超时（45s 未响应）。请确认 agent 已登录（agy 批量模式要联网）后点击 Retry。'
      );
      setConnState("error");
      unlistenRef.current?.();
      unlistenRef.current = null;
      startWatchdogRef.current = null;
    }, 45_000);

    try {
      // Subscribe BEFORE spawning so we don't miss session/new or the first chunks.
      // Ref-delegate so the listener always dispatches to the latest handleAcpMessage
      // (HMR preserves the panel mid-life; stale closures leak old cases)
      const unlisten = await listenToAcpSession(
        sessionId,
        (msg) => handleAcpMessageRef.current(msg)
      );
      unlistenRef.current = unlisten;
      await acpStart(sessionId, agentId, cwd || undefined, resumeAgentSessionId);
      // ACP 恢复（session/load）可能拿不到 session_created 回执（agy 的 load 响应不带 sessionId），
      // 这里主动补记，保证侧边栏图标与 agy DB 中的会话对应关系一致
      if (resumeAgentSessionId) {
        trackAcpConversation(resumeAgentSessionId, agentId);
      }
    } catch (e: any) {
      if (startWatchdogRef.current != null) {
        window.clearTimeout(startWatchdogRef.current);
        startWatchdogRef.current = null;
      }
      unlistenRef.current?.();
      unlistenRef.current = null;
      console.error("[acp_initialize error]", e);
      const tail = stderrScratchRef.current.slice(-4).join('\n').trim();
      setStartError(`${String(e?.message || e)}${tail ? `\n${tail}` : ''}`);
      setConnState("error");
    }
  }, [sessionId, agentId, cwd, handleAcpMessage, resumeAgentSessionId]);

  // 重连：关闭当前 ACP 连接并重置会话状态，然后重新建立
  const reconnectSession = useCallback(async () => {
    // detach watchers and terminate agent
    try {
      if (startWatchdogRef.current != null) {
        window.clearTimeout(startWatchdogRef.current);
        startWatchdogRef.current = null;
      }
      unlistenRef.current?.();
      unlistenRef.current = null;
      await acpCancel(sessionId).catch(() => {});
    } catch (e) {
      console.warn('[AcpSession] reconnect reset error', e);
    }
    // reset UI/state
    setIsStarted(false);
    setConnState("connecting");
    setIsAwaitingResponse(false);
    setActiveToolCalls(0);
    setStartError(null);
    setMessages([]);
    setInput("");
    setConfigOptions([]);
    setUsage(null);
    stderrScratchRef.current = [];
    streamingRef.current = false;
    pendingSaveRef.current = false;
    setPendingImages([]);
    const sysId = addMessage("system", "🔄 正在重连…");
    pendingSaveSysMsgIdRef.current = sysId;
    // Immediate re-init
    void startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, addMessage]);

  // Auto-start the ACP session on mount — no intermediate Start button screen.
  const startAttemptedRef = useRef(false);
  useEffect(() => {
    if (startAttemptedRef.current) return;
    startAttemptedRef.current = true;
    void startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  const handleConfigChange = async (configId: string, value: string) => {
    // 切换模型时 agy 只在 context 大小变化时才重推 usage_update。
    // 不再主动清 usage —— 保留 agent 最后一次推送的快照，等下一次 usage_update 刷新。
    setConfigOptions((prev) =>
      prev.map((o) => (o.id === configId ? { ...o, currentValue: value } : o))
    );
    try {
      const ok = await acpSetConfigOption(sessionId, configId, value);
      if (!ok) {
        addMessage("system", `⚠️ Failed to set ${configId}`, {});
      }
    } catch (e) {
      addMessage("system", `⚠️ Failed to set ${configId}: ${e}`, {});
    }
  };

  const sendPrompt = async (text: string) => {
    const attached = pendingImages;
    if ((!text.trim() && attached.length === 0) || !isStarted || isBusy) return;

    const userContent = text.trim();
    streamingRef.current = false;
    setSawAssistantChunk(false);
    setActiveToolLabel('');
    if (userContent) {
      pendingEchoRef.current.push(userContent);
      setInputHistory((prev) => {
        const next = [userContent, ...prev.filter((t) => t !== userContent)].slice(0, 100);
        try {
          localStorage.setItem('aura:acpInputHistory', JSON.stringify(next));
        } catch { /* quota ignored */ }
        return next;
      });
      historyIndexRef.current = -1;
      historyDraftRef.current = '';
    }
    const userMsgId = addMessage("user", userContent);
    if (attached.length > 0) {
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsgId ? { ...m, images: attached.map((i) => i.dataUrl) } : m))
      );
      setPendingImages([]);
    }
    setInput("");
    setIsBusy(true);
    setIsAwaitingResponse(true);

    try {
      const ok = await acpSendPrompt(
        sessionId,
        userContent,
        attached.length > 0 ? attached.map((i) => ({ data: i.base64, mimeType: i.mimeType })) : undefined
      );
      if (!ok) {
        addMessage("system", `Failed to send prompt to ${agentName} (session may not be ready)`, {});
        setIsAwaitingResponse(false);
      }
    } catch (e) {
      console.error("[acp_send_prompt error]", e);
      addMessage("system", `Error sending prompt: ${e}`, {});
      setIsAwaitingResponse(false);
    } finally {
      // Prompt responses come back asynchronously; clear busy after a tick.
      setTimeout(() => setIsBusy(false), 250);
    }
  };

  const handleSend = async () => {
    await sendPrompt(input);
  };

  // /save finalize：静默读取 agent 合成文本（缓存在 pendingSaveBufferRef），失败降级 Digest，然后 memorySave + 就地更新 📝 系统消息
  finalizeSaveRef.current = async () => {
    const msgs = messagesRef.current;
    const synth = pendingSaveBufferRef.current.trim();
    const broken = !synth || /terms of service|service has been disabled/i.test(synth) || synth.length < 30;
    const body = broken ? buildLocalDigest(msgs) : synth;
    const firstUser = msgs.find((m) => m.role === "user");
    const title = firstUser ? firstUser.content.trim().split("\n")[0].slice(0, 80) : `${agentName} session`;
    pendingSaveBufferRef.current = "";
    const settleId = pendingSaveSysMsgIdRef.current;
    try {
      const res = await memorySave({
        sessionId,
        agentId,
        agentSessionId: agentSessionIdRef.current,
        title,
        workspace: cwd || "",
        body,
      });
      const ok = res.everos.ok || !res.everos.enabled;
      const finalText = ok
        ? "✅ 提炼完成"
        : `⚠️ 提炼异常：${res.everos.error || "EverOS 同步未知错误"}`;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === settleId ? { ...m, content: finalText } : m
        )
      );
    } catch (e) {
      const errText = e instanceof Error ? e.message : String(e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === settleId ? { ...m, content: `⚠️ 提炼异常：${errText}` } : m
        )
      );
    } finally {
      pendingSaveSysMsgIdRef.current = null;
    }
  };

  // 本地客户端命令的执行入口
  const runClientCommand = async (name: string): Promise<void> => {
    if (name === "exit") {
      setInput("");
      onSessionClose(sessionId);
      return;
    }
    if (name === "usage") {
      setInput("");
      if (!usage) {
        addMessage("system", "⏳ 暂未收到该 ACP 会话的 usage_update 推送；先对 agent 发一条消息后再试。");
        return;
      }
      const pct = usage.size > 0 ? Math.round((usage.used / usage.size) * 100) : 0;
      addMessage(
        "system",
        `🧠 上下文占用：${usage.used.toLocaleString()} / ${usage.size.toLocaleString()}（${pct}%）`
      );
      return;
    }
    if (name === "save") {
      setInput("");
      await handleSave();
      return;
    }
  };

  // /save 主流程：Ask → 等 prompt result → finalizeSaveRef 读取转录做提炼与同步
  const handleSave = async () => {
    if (!isStarted) {
      addMessage("system", "ACP 会话尚未就绪，稍候再试。");
      return;
    }
    if (messagesRef.current.length === 0) {
      addMessage("system", "没有可保存的对话内容。");
      return;
    }
    if (pendingSaveRef.current) {
      addMessage("system", "⏳ 已有一个 /save 正在提炼中，请稍候。");
      return;
    }
    pendingSaveRef.current = true;
    pendingSaveBufferRef.current = "";
    pendingSaveSysMsgIdRef.current = null;
    streamingRef.current = false;
    setIsBusy(true);
    setIsAwaitingResponse(true);
    const sysId = addMessage("system", "📝 /save 提炼中…");
    pendingSaveSysMsgIdRef.current = sysId;
    const synthPrompt =
      "请将本次会话提炼成一份给未来回忆的 markdown 记忆备忘，包含：1) 目标 2) 上下文与关键决策 3) 踩坑与解决方案 4) 未决问题。只输出提炼后的 markdown 正文，不要客套与前言，字数控制在 250 字以内。";
    try {
      await acpSendPrompt(sessionId, synthPrompt);
    } catch (e) {
      addMessage(
        "system",
        `/save 提炼请求失败：${e instanceof Error ? e.message : String(e)}，转为本地转录提炼。`
      );
      pendingSaveRef.current = false;
      void finalizeSaveRef.current();
    } finally {
      setTimeout(() => setIsBusy(false), 250);
    }
    // 安全兜底：超过 90s 还没有 prompt result 也强制 finalize（例如 agent 无响应）
    setTimeout(() => {
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        void finalizeSaveRef.current();
      }
    }, 90_000);
  };

  type SlashRow = { kind: "client" | "agent"; name: string; description: string; hint?: string };

  const slashMatch = input.match(/(?:^|\s)(\/[\w-]*)$/u);
  const slashToken = slashMatch ? slashMatch[1] : null;
  const slashQuery = slashToken ? slashToken.slice(1).toLowerCase() : "";
  const slashRows: SlashRow[] = slashToken
    ? [
        ...CLIENT_SLASH_COMMANDS.filter((c) => c.name.includes(slashQuery)).map((c) => ({
          kind: "client" as const,
          name: c.name,
          description: c.description,
        })),
        ...availableCommands
          .filter((c) => c.name.toLowerCase().includes(slashQuery))
          .map((c) => ({
            kind: "agent" as const,
            name: c.name,
            description: c.description,
            hint: c.input?.hint,
          })),
      ]
    : [];
  const clampedSlashIndex = Math.min(slashIndex, Math.max(0, slashRows.length - 1));
  const slashOpen = !!slashToken && !slashClosed && slashRows.length > 0;

  const applySlashCommand = (cmd: { name: string; description: string; input?: { hint?: string } }, send: boolean) => {
    const m = input.match(/(?:^|\s)(\/[\w-]*)$/u);
    if (!m) return;
    const idx = m.index! + m[0].length - m[1].length; // token 的起始位置
    const next = input.slice(0, idx) + `/${cmd.name}${send ? "" : " "}`;
    setInput(next);
    setSlashIndex(0);
    setSlashClosed(false);
    textareaRef.current?.focus();
    if (send) {
      streamingRef.current = false;
      void sendPrompt(next);
    }
  };

  const commitSlash = (cmd: { name: string; description: string; input?: { hint?: string } }, onlyFill: boolean) => {
    if (onlyFill) {
      applySlashCommand(cmd, false);
      return;
    }
    // 无需参数的命令：Enter/click 直接执行；需要参数的命令：仅填充，等用户继续输入参数
    applySlashCommand(cmd, !cmd.input?.hint);
  };

  const completeRow = (row: SlashRow, onlyFill: boolean) => {
    if (row.kind === "client") {
      setSlashIndex(0);
      void runClientCommand(row.name);
      return;
    }
    commitSlash(
      { name: row.name, description: row.description, input: row.hint ? { hint: row.hint } : undefined },
      onlyFill
    );
  };

  // 粘贴剪贴板中的截图：读取 image/* 文件项，存入 pendingImages，随下一条 prompt 发送
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length === 0) return; // 没有图片，交给默认文本粘贴
    e.preventDefault();
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        addMessage('system', '⚠️ 图片超过 10MB，已忽略');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
        setPendingImages((prev) =>
          prev.length >= 5
            ? prev
            : [...prev, {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                dataUrl,
                base64,
                mimeType: file.type || 'image/png',
                name: file.name || 'pasted-image.png',
              }]
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      e.stopPropagation();
      void reconnectSession();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      const tabIndex = parseInt(e.key, 10) - 1;
      window.dispatchEvent(new CustomEvent('aura:switch-dock-tab', { detail: { index: tabIndex } }));
      return;
    }
    if (e.key === 'Escape' && (isAwaitingResponse || activeToolCalls > 0 || pendingSaveRef.current)) {
      e.preventDefault();
      e.stopPropagation();
      void acpCancel(sessionId).then(() => {
        setIsAwaitingResponse(false);
        setActiveToolCalls(0);
      });
      return;
    }
    if (slashOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) =>
          e.key === "ArrowDown"
            ? Math.min(i + 1, slashRows.length - 1)
            : Math.max(i - 1, 0)
        );
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const row = slashRows[clampedSlashIndex];
        if (row) completeRow(row, true);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const row = slashRows[clampedSlashIndex];
        if (row) completeRow(row, false);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashClosed(true);
        return;
      }
    }
    // ↑↓ 翻输入历史：光标在开头时 ↑ 取更早一条；光标在结尾时 ↓ 逐条前进；否则不拦截（多行编辑）
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && inputHistory.length > 0) {
      const el = textareaRef.current;
      const caret = el?.selectionStart ?? 0;
      if (e.key === "ArrowUp" ? caret === 0 || input.length === 0 : caret === input.length) {
        e.preventDefault();
        e.stopPropagation();
        const idx = historyIndexRef.current;
        if (e.key === "ArrowUp") {
          const next = idx === -1 ? inputHistory.length - 1 : Math.max(0, idx - 1);
          if (idx === -1) historyDraftRef.current = input;
          historyIndexRef.current = next;
          setInput(inputHistory[next]);
        } else {
          if (idx === -1) return;
          const next = idx + 1;
          if (next >= inputHistory.length) {
            historyIndexRef.current = -1;
            setInput(historyDraftRef.current);
            return;
          }
          historyIndexRef.current = next;
          setInput(inputHistory[next]);
        }
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 连续出现的工具行合并为一个 block（渲染时用 ToolActivityGroup 折叠展示）
  const messageBlocks = useMemo(() => {
    const blocks: Array<
      { type: 'msg'; msg: AcpMessageItem } | { type: 'tools'; tools: AcpMessageItem[] }
    > = [];
    let buf: AcpMessageItem[] = [];
    const flush = () => {
      if (buf.length > 0) {
        blocks.push({ type: 'tools', tools: buf });
        buf = [];
      }
    };
    for (const msg of messages) {
      if (msg.tool) {
        buf.push(msg);
        continue;
      }
      flush();
      blocks.push({ type: 'msg', msg });
    }
    flush();
    return blocks;
  }, [messages]);

  const selectOptions = configOptions.filter((o) => o.type === "select");

  // 固定位槽：model / thought_level / mode —— 宽度和顺序固定，切换模型不跳动；缺失显示 —
  const FIXED_SLOTS: Array<{ id: string; width: number }> = [
    { id: 'model', width: 182 },
    { id: 'thought_level', width: 96 },
    { id: 'mode', width: 92 },
  ];
  const fixedSlotIds = new Set(FIXED_SLOTS.map((s) => s.id));
  const optionById = new Map(selectOptions.map((o) => [o.id, o]));

  if (!isStarted) {
    const isHardError = connState === "error" && !startError;
    return (
      <div className="flex flex-col h-full w-full bg-[var(--aura-dock-bg)] text-[var(--aura-text)]" style={{ fontSize: basePx }}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Activity size={40} className={isHardError ? "text-red-400" : "text-[#007acc] animate-pulse"} />
          <h2 className="text-lg font-semibold">{agentName}</h2>
          {startError || isHardError ? (
            <>
              <h1 className="text-base font-semibold text-[var(--aura-text-muted,#888888)]">Connection Failed!</h1>
              <button
                onClick={() => startSession()}
                className="px-5 py-2 bg-[#007acc] text-white text-xs rounded-xl hover:bg-[#0062a3] transition-colors"
              >
                Retry
              </button>
            </>
          ) : (
            <p className="text-xs text-[var(--aura-text-muted,#888888)]">
              Starting <span className="font-mono">{agentName}</span>…
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[var(--aura-dock-bg)] text-[var(--aura-text)]" style={{ fontSize: basePx }}>
      {/* Messages */}
      <div className="relative flex-1 min-h-0">
      <div ref={scrollContainerRef} onScroll={handleMessagesScroll} className="acp-messages-scroll h-full overflow-y-auto p-4 space-y-4 select-text">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--aura-text-muted,#777777)]">
            <Bot size={32} className="mb-2 opacity-50" />
            <p className="text-sm">Ask {agentName} to help with your code</p>
          </div>
        )}
        {messageBlocks.map((block, index) =>
          block.type === 'tools' ? (
            <ToolActivityGroup key={block.tools[0].id} tools={block.tools} />
          ) : (
          <React.Fragment key={block.msg.id}>
          <div
            id={`acp-msg-${block.msg.id}`}
            className="flex flex-col max-w-[88%] mr-auto items-start"
          >
            {(() => { const msg = block.msg; return (<>
            {msg.role === "system" && !msg.tool && (
              <div className="flex items-center gap-1.5 mb-1 text-[var(--aura-text-muted,#858585)]">
                <span className="font-semibold text-[var(--aura-text,#e0e0e0)] text-xs">System</span>
                <span className="text-[0.72em] text-[var(--aura-text-muted,#777777)] font-mono">
                  {msg.timestamp}
                </span>
              </div>
            )}
            {msg.role === "user" ? (
              <div className="acp-user-bubble font-mono text-[0.96em] leading-[1.6em] text-[var(--aura-text,#e0e0e0)]">
                {(msg.content || '').split('\n').map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[var(--aura-accent,#5B9BFF)] font-bold shrink-0 select-none">&gt;</span>
                    <span className="whitespace-pre-wrap break-words min-w-0">{line.length ? line : '\u00A0'}</span>
                  </div>
                ))}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {msg.images.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`pasted ${i + 1}`}
                        className="h-16 max-w-[140px] rounded-lg border border-[var(--aura-border,#3a3a3a)] object-cover"
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : msg.role === "assistant" ? (
              <div className="acp-assistant-bubble max-w-full relative group">
                <AcpMarkdown content={msg.content} />
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--aura-border,#3a3a3a)]/30 text-[0.72em] font-mono text-[var(--aura-text-muted,#858585)] select-none">
                  <div className="flex items-center gap-2 px-1">
                    {msg.elapsedMs != null && <span>Took {formatElapsed(msg.elapsedMs)}</span>}
                    {msg.tokPerSec != null && (
                      <>
                        <span className="opacity-50">·</span>
                        <span>{msg.tokPerSec} tok/s</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      title="复制回复全文 (Copy full reply)"
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--aura-bg-elevated,#2d2d30)] hover:text-[var(--aura-text,#ebeef3)] transition-colors cursor-pointer"
                    >
                      {copiedMsgId === msg.id ? (
                        <>
                          <Check size={11} className="text-[#34d399]" />
                          <span className="text-[#34d399]">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>复制</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadMessage(msg.content, msg.timestamp)}
                      title="下载为 Markdown 文件 (Download as .md)"
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--aura-bg-elevated,#2d2d30)] hover:text-[var(--aura-text,#ebeef3)] transition-colors cursor-pointer"
                    >
                      <Download size={11} />
                      <span>下载</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2 text-[0.8em] text-[var(--aura-text-muted)] border-l-2 border-[var(--aura-border,#3a3a3a)] ml-1 pl-3">
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              </div>
            )}
            </>); })()}
          </div>
          </React.Fragment>
          )
        )}

        {/* Agent working bar — inline indicator while the agent is generating */}
        <style>{`
          .acp-working-bar {
            align-self: flex-start;
            display: inline-flex;
            align-items: center;
            width: max-content;
            max-width: 180px;
            margin: 0 0 4px 0;
            padding: 2px 8px 2px 6px;
            background: var(--aura-card-bg, #252526);
            border: 1px solid var(--aura-border, #3a3a3a);
            border-radius: 9999px;
            cursor: pointer;
            color: var(--aura-text, #ebeef3);
            font-size: 10px;
            font-weight: 500;
            letter-spacing: 0.02em;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
            transition: background 0.15s ease, border-color 0.15s ease;
          }
          .acp-working-bar:hover { background: var(--aura-bg-elevated, #2d2d30); border-color: var(--aura-accent, #007acc); }
          .acp-thinking-label { color: var(--aura-text, #ebeef3) !important; }
          .acp-thinking-elapsed { color: var(--aura-text-muted, #858585) !important; }
          /* 消息区：双方气泡 + 分隔线（跟随主题） */
          .acp-msg-divider {
            height: 1px;
            border: 0;
            background: var(--aura-divider, #3f3f46);
            opacity: 0.35;
            margin: 2px 6%;
          }
          .acp-user-bubble {
            /* 主题自适应：浅色主题呈极淡蓝色调，深色呈极淡暗蓝 */
            background: color-mix(in srgb, var(--aura-accent, #007acc) 3%, transparent);
            border: 1px solid color-mix(in srgb, var(--aura-accent, #007acc) 14%, transparent);
            border-radius: 10px;
            padding: 6px 12px;
          }
          .acp-assistant-bubble {
            /* 主题自适应：中性极淡色块，与用户气泡区分 */
            background: color-mix(in srgb, var(--aura-text, #e0e0e0) 1%, transparent);
            border: 1px solid color-mix(in srgb, var(--aura-border, #3a3a3a) 45%, transparent);
            border-radius: 10px;
            padding: 8px 12px;
            width: 100%;
          }
          .acp-working-row {
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }
          .acp-typing {
            display: inline-flex;
            gap: 3px;
            align-items: flex-end;
            height: 10px;
          }
          .acp-typing i {
            width: 4px;
            height: 4px;
            border-radius: 9999px;
            background: #5b8ddb;
            animation: acpTypingWave 1.15s ease-in-out infinite;
          }
          .acp-typing i:nth-child(2) { animation-delay: 0.14s; }
          .acp-typing i:nth-child(3) { animation-delay: 0.28s; }
          @keyframes acpTypingWave {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
            30%           { transform: translateY(-4px); opacity: 1; background: #7ba6f0; }
          }
          .acp-thinking-label { font-size: 10px; font-variant-numeric: tabular-nums; }
          .phase-answering .acp-typing i { background: #34d399; animation-name: acpTypingWaveGreen; }
          .phase-answering .acp-thinking-label { color: #34d399 !important; }
          .phase-tool .acp-typing i { background: #f0b429; animation-name: acpTypingWaveAmber; }
          /* 工具调用折叠组 */
          .acp-tool-group {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
            margin: 2px 0;
            max-width: 88%;
          }
          .acp-tool-group-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 8px;
            border-radius: 6px;
            border: 1px solid var(--aura-border, #3a3a3a);
            background: color-mix(in srgb, var(--aura-card-bg, #252526) 65%, transparent);
            cursor: pointer;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 11px;
            max-width: 100%;
            transition: background 0.15s ease;
          }
          .acp-tool-group-header:hover { background: var(--aura-input-bg, #1e1e1e); }
          .acp-tool-group-header.running { color: #d9a441; }
          .acp-tool-group-header.running .acp-tool-dot {
            background: #f0b429;
            box-shadow: 0 0 6px rgba(240, 180, 41, 0.6);
            animation: acpToolPulse 1.1s ease-in-out infinite;
          }
          .acp-tool-group-header.done { color: var(--aura-text-muted, #8a8f95); }
          .acp-tool-group-header.done .acp-tool-dot { background: #34d399; }
          .acp-tool-count {
            font-size: 9px;
            padding: 0 5px;
            border-radius: 9999px;
            background: color-mix(in srgb, var(--aura-text, #e0e0e0) 12%, transparent);
            color: var(--aura-text-muted, #9ca3af);
            font-variant-numeric: tabular-nums;
            flex-shrink: 0;
          }
          .acp-tool-caret { opacity: 0.6; transition: transform 0.15s ease; flex-shrink: 0; }
          .acp-tool-caret.expanded { transform: rotate(180deg); }
          .acp-tool-group-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin-left: 10px;
            padding-left: 10px;
            border-left: 1px solid color-mix(in srgb, var(--aura-border, #3a3a3a) 60%, transparent);
          }
          .acp-tool-group-list .acp-tool-line { max-width: 100%; }
          /* 工具调用一行摘要 */
          .acp-tool-line {
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 2px 0 2px 2px;
            padding: 2px 8px;
            max-width: 88%;
            font-size: 11px;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            border-radius: 6px;
            line-height: 1.5;
          }
          .acp-tool-line .acp-tool-dot {
            width: 6px;
            height: 6px;
            border-radius: 9999px;
            flex-shrink: 0;
          }
          .acp-tool-line.running {
            color: #d9a441;
          }
          .acp-tool-line.running .acp-tool-dot {
            background: #f0b429;
            box-shadow: 0 0 6px rgba(240, 180, 41, 0.6);
            animation: acpToolPulse 1.1s ease-in-out infinite;
          }
          .acp-tool-line.done {
            color: var(--aura-text-muted, #8a8f95);
          }
          .acp-tool-line.done .acp-tool-dot {
            background: #34d399;
          }
          .acp-tool-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          @keyframes acpToolPulse {
            0%, 100% { opacity: 0.6; transform: scale(0.85); }
            50%      { opacity: 1;   transform: scale(1.15); }
          }
          .phase-tool .acp-thinking-label { color: #f0b429 !important; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; }
          @keyframes acpTypingWaveGreen {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
            30%           { transform: translateY(-4px); opacity: 1; background: #6ee7b7; }
          }
          @keyframes acpTypingWaveAmber {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
            30%           { transform: translateY(-4px); opacity: 1; background: #fcd34d; }
          }
          .acp-thinking-elapsed { font-size: 10px; font-variant-numeric: tabular-nums; }
        `}</style>
        {turnBusy && (() => {
          const phase: 'thinking' | 'answering' | 'tool' =
            activeToolCalls > 0 ? 'tool' : sawAssistantChunk ? 'answering' : 'thinking';
          const phaseLabel =
            phase === 'tool'
              ? (activeToolLabel ? `Running: ${activeToolLabel}` : 'Running tool')
              : phase === 'answering'
                ? 'Replying'
                : 'Thinking';
          return (
            <button
              type="button"
              className="acp-working-bar"
              onClick={() => {
                void acpCancel(sessionId).then(() => {
                  setIsAwaitingResponse(false);
                  setActiveToolCalls(0);
                });
              }}
              title="Esc 键：中断当前 agent 的回合"
            >
              <div className={`acp-working-row phase-${phase}`}>
                <span className="acp-typing" aria-hidden="true">
                  <i /><i /><i />
                </span>
                <span className="acp-thinking-label">{phaseLabel}</span>
                {thinkingElapsed > 0 && (
                  <span className="acp-thinking-elapsed">· {thinkingElapsed}s</span>
                )}
              </div>
            </button>
          );
        })()}
        <div ref={messagesEndRef} className="h-10 shrink-0 pointer-events-none" />
      </div>

      {/* 跳到底部悬浮按钮（放右边，纯图标提示，无文字） */}
      {showJumpBottom && (
        <button
          type="button"
          onClick={jumpToBottom}
          title="跳到对话最底部 (Scroll to bottom)"
          aria-label="跳到对话最底部"
          className="absolute bottom-3.5 right-4 z-20 flex items-center justify-center w-8 h-8 rounded-full border shadow-lg backdrop-blur-md transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer select-none group"
          style={{
            backgroundColor: 'var(--aura-card-bg, #252526)',
            borderColor: 'var(--aura-border, #454545)',
            color: 'var(--aura-text, #e0e0e0)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
          }}
        >
          <ChevronDown size={16} strokeWidth={2.4} className="text-[var(--aura-accent,#007acc)] group-hover:translate-y-0.5 transition-transform" />
        </button>
      )}

      {/* 右侧会话记录大纲导航：始终垂直居中在右侧，未 hover 显示灰色短横线列，hover 展开提问摘要卡片，去除滚动条 */}
      {userTurns.length > 0 && (
        <div
          onMouseEnter={() => setIsOutlineHovered(true)}
          onMouseLeave={() => setIsOutlineHovered(false)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex items-center"
        >
          {!isOutlineHovered ? (
            /* 鼠标未 hover 时：一列小短横线，支持滚轮滚动且隐藏滚动条 */
            <div className="flex flex-col items-end gap-2.5 py-1.5 px-1 cursor-pointer select-none max-h-[70vh] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {userTurns.map((turn) => {
                const isActive = activeTurnId === turn.id;
                return (
                  <div
                    key={turn.id}
                    onClick={() => handleJumpToTurn(turn.id)}
                    title={turn.fullText}
                    className="flex items-center justify-end h-3"
                  >
                    <span
                      className={`rounded-full transition-all duration-200 ${
                        isActive
                          ? 'w-4 h-[2.5px] bg-[#3b82f6] shadow-sm'
                          : 'w-3 h-[2px] bg-[#888888]/40 hover:bg-[#aaaaaa] hover:w-3.5'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            /* 鼠标 hover 时：直接显示浮动卡片，无缩放过渡动画 */
            <div
              className="w-64 max-h-[70vh] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-2xl border shadow-2xl p-2.5 flex flex-col gap-0.5 select-none font-sans backdrop-blur-md"
              style={{
                backgroundColor: 'var(--aura-card-bg, #252526)',
                borderColor: 'var(--aura-border, #454545)',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
              }}
            >
              {userTurns.map((turn) => {
                const isActive = activeTurnId === turn.id;
                return (
                  <div
                    key={turn.id}
                    onClick={() => handleJumpToTurn(turn.id)}
                    className={`flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isActive
                        ? 'text-[#3b82f6] font-medium bg-[#3b82f6]/15'
                        : 'text-[var(--aura-text-muted,#858585)] hover:text-[var(--aura-text,#e0e0e0)] hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate flex-1" title={turn.fullText}>
                      {turn.summary}
                    </span>
                    <span
                      className={`shrink-0 rounded-full transition-all duration-150 ${
                        isActive
                          ? 'w-4 h-[2.5px] bg-[#3b82f6]'
                          : 'w-3 h-[2px] bg-[#888888]/50'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Input — 与 agy 终端一致的两行分隔线布局 */}
      <div className="border-t border-b border-[var(--aura-divider,#94a3b8)] bg-[var(--aura-dock-bg,#181818)] px-0">
        <div
          className={`relative bg-[var(--aura-dock-bg,#181818)] py-0 flex flex-col gap-0 transition-all ${
            isDragOver ? 'ring-2 ring-[#5B8DFF]' : ''
          }`}
          onDragOver={handleAcpDragOver}
          onDragLeave={handleAcpDragLeave}
          onDrop={handleAcpDrop}
        >
          {slashOpen && (
            <div
              className="absolute left-2 right-2 bottom-[calc(100%+8px)] z-30 max-h-72 overflow-y-auto rounded-xl border shadow-2xl py-1 animate-in fade-in duration-100"
              style={{
                backgroundColor: 'var(--aura-card-bg, #252526)',
                borderColor: 'var(--aura-border, #454545)',
                color: 'var(--aura-text, #e0e0e0)',
              }}
            >
              <div className="px-2.5 py-1 text-[0.68em] uppercase tracking-wider text-[var(--aura-text-muted)] flex items-center justify-between border-b border-[var(--aura-border,#454545)]/60 mb-0.5">
                <span>Commands · 本地命令先列 / agent 命令在后</span>
                <span className="font-mono normal-case">↑↓ 选择 · Tab 补全 · Enter 执行</span>
              </div>
              {(() => {
                let prevKind: string | null = null;
                return slashRows.map((row, i) => {
                  const header =
                    row.kind !== prevKind ? (
                      <div key={`hdr-${row.kind}`} className="px-2.5 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-[var(--aura-text-muted)] border-t border-[var(--aura-border,#454545)]/40 first:border-t-0 mt-0.5 first:mt-0">
                        {row.kind === "client" ? "本地命令（Aura 实现）" : "Agent 命令（该 agent 支持）"}
                      </div>
                    ) : null;
                  prevKind = row.kind;
                  return (
                    <React.Fragment key={`${row.kind}-${row.name}`}>
                      {header}
                      <button
                        type="button"
                        onMouseEnter={() => setSlashIndex(i)}
                        onClick={() => completeRow(row, false)}
                        className={`w-full flex items-start gap-2 px-2.5 py-1.5 text-left transition-colors rounded-md mx-0 ${
                          i === clampedSlashIndex ? "bg-[#007acc]/25 text-[var(--aura-accent,#7fc1ff)]" : "text-[var(--aura-text,#e0e0e0)]"
                        }`}
                      >
                        <span className={`font-mono text-[0.8em] flex-shrink-0 leading-5 ${row.kind === "client" ? "text-[#e5c07b]" : "text-[#4ec9b0]"}`}>
                          {row.kind === "client" ? "⚡/" : "/"}{row.name}
                        </span>
                        <span className="text-[10.5px] leading-5 text-[var(--aura-text-muted,#a0a0a0)] line-clamp-1 flex-1" title={row.description}>
                          {row.description}
                          {row.hint && <span className="text-[#6a6a6a]">（{row.hint}）</span>}
                        </span>
                      </button>
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          )}
          {pendingImages.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap px-3 pt-2">
              {pendingImages.map((img) => (
                <div key={img.id} className="relative w-14 h-14 shrink-0">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-14 h-14 object-cover rounded-lg border border-[var(--aura-border,#3a3a3a)]"
                  />
                  <button
                    type="button"
                    onClick={() => setPendingImages((prev) => prev.filter((p) => p.id !== img.id))}
                    title="移除这张图片"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none border transition-colors"
                    style={{
                      backgroundColor: 'var(--aura-card-bg, #252526)',
                      borderColor: 'var(--aura-border, #454545)',
                      color: 'var(--aura-text-muted, #9ca3af)',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <span className="text-[0.72em] text-[var(--aura-text-muted,#9ca3af)] select-none">
                最多 5 张 · 随消息发送给 agent
              </span>
            </div>
          )}
          <div className="flex items-start gap-2 border-b border-[var(--aura-divider,#94a3b8)] px-3 py-2">
            <span className="shrink-0 text-[var(--aura-accent,#5B9BFF)] font-mono text-[0.96em] leading-[1.55em] select-none pt-[2px] font-bold">&gt;</span>
            <textarea
              ref={textareaRef}
              rows={Math.min(16, Math.max(2, input.split('\n').length))}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setSlashClosed(false);
              }}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder=""
              className="w-full bg-transparent text-[0.96em] font-mono text-[var(--aura-text,#e0e0e0)] px-0 py-[2px] focus:outline-none resize-none placeholder:text-[#3a3a3a] caret-[var(--aura-accent,#007acc)]"
            />
          </div>
          {/* 固定槽位：model / thought_level / mode；缺失渲染 — 占位，位置不跳 */}
          <div className="flex items-center justify-end gap-1 px-3 pt-2 pb-2">
              {FIXED_SLOTS.map((slot) => {
                const opt = optionById.get(slot.id);
                if (!opt) {
                  return (
                    <div
                      key={slot.id}
                      className="flex items-center justify-center px-2 py-1 rounded-lg text-[0.8em] text-[var(--aura-text-muted,#8a8f95)]/60 font-mono cursor-default select-none"
                      style={{ width: slot.width }}
                    >
                      —
                    </div>
                  );
                }
                return (
                  <ConfigSelectChip
                    key={slot.id}
                    opt={opt}
                    isOpen={openConfigId === slot.id}
                    onToggle={setOpenConfigId}
                    onSelect={handleConfigChange}
                    width={slot.width}
                  />
                );
              })}
              {selectOptions.filter((o) => !fixedSlotIds.has(o.id)).map((opt) => (
                <ConfigSelectChip
                  key={opt.id}
                  opt={opt}
                  isOpen={openConfigId === opt.id}
                  onToggle={setOpenConfigId}
                  onSelect={handleConfigChange}
                />
              ))}
              {(isAwaitingResponse || activeToolCalls > 0 || pendingSaveRef.current) && (
                <button
                  type="button"
                  onClick={() => {
                    void acpCancel(sessionId).then(() => {
                      setIsAwaitingResponse(false);
                      setActiveToolCalls(0);
                    });
                  }}
                  title="Esc 键：中断当前 agent 回合"
                  className="font-mono text-[0.78em] text-[#6f6f72] hover:text-[#cdd2da] transition-colors select-none bg-transparent border-0 outline-none py-1 px-1 flex-shrink-0"
                >
                  esc
                </button>
              )}
            <ContextChip usage={usage} />
            </div>
          </div>
        </div>
      </div>
  );
};
