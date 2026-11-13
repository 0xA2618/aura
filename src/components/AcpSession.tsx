import React, { useState, useRef, useCallback, useEffect } from "react";
import { Bot, Copy, Check, Activity, Send, ChevronDown, Search } from "lucide-react";
import { acpStart, acpSendPrompt, acpSetConfigOption, listenToAcpSession, trackAcpConversation, memorySave } from "../services/fileService";
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
}

const ConfigSelectChip: React.FC<ConfigSelectChipProps> = ({ opt, isOpen, onToggle, onSelect }) => {
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

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
  const { groups, flat } = filterOptions(opt, query);

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
        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors ${
          selected ? "bg-[#007acc]/25 text-white" : "text-[#cccccc] hover:bg-[#2d2d30]"
        }`}
      >
        <span className="truncate">{o.name}</span>
        {selected && <Check size={12} className="text-[#4ea8de] shrink-0" />}
      </button>
    );
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => onToggle(isOpen ? null : opt.id)}
        title={`${opt.name}: ${label}`}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#aaaaaa] hover:bg-white/5 hover:text-white transition-colors max-w-[240px]"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={11}
          className={`shrink-0 transition-transform duration-150 opacity-60 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-72 max-h-96 flex flex-col rounded-xl border border-[#3c3c3c] bg-[#252526] shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[#333333]">
            <div className="flex items-center gap-1.5 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-2 py-1.5 focus-within:border-[#007acc]">
              <Search size={12} className="text-[#777777] shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-[11px] text-[#cccccc] focus:outline-none placeholder:text-[#666666]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {groups.length === 0 && flat.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-[#666666]">No matches</div>
            )}
            {groups.map((g) => (
              <div key={g.group}>
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-[#777777]">
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

export const AcpSession: React.FC<AcpSessionProps> = ({
  sessionId,
  agentId,
  agentName,
  cwd,
  onSessionClose,
  onStatusChange,
  resumeAgentSessionId,
}) => {
  const [messages, setMessages] = useState<AcpMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [configOptions, setConfigOptions] = useState<AcpConfigOption[]>([]);
  const [openConfigId, setOpenConfigId] = useState<string | null>(null);
  const [connState, setConnState] = useState<"connecting" | "connected" | "error">("connecting");
  const [usage, setUsage] = useState<{ used: number; size: number } | null>(null);
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

  const scrollToEnd = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, scrollToEnd]);

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

  const appendToLastAssistantMessage = useCallback((chunk: string) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next[next.length - 1];
      if (last.role === "assistant") {
        next[next.length - 1] = { ...last, content: last.content + chunk };
      }
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
          if (data?.sessionId) {
            agentSessionIdRef.current = String(data.sessionId);
            trackAcpConversation(String(data.sessionId), agentId);
          }
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
              if (pendingSaveRef.current) break;
              if (data.content) {
                addMessage("system", `💭 ${String(data.content)}`, data);
              }
              break;
            case "user_message_chunk":
              // Agent echoes of the user's prompt are ignored
              break;
            case "tool_call":
              if (pendingSaveRef.current) break;
              streamingRef.current = false;
              addMessage(
                "system",
                `🔧 [${data.title || "Tool"}] ${data.status || "running"}`,
                data
              );
              break;
            case "tool_call_update":
              if (pendingSaveRef.current) break;
              addMessage(
                "system",
                `🔧 [${data.title || "Tool"}] ${data.status || "updated"}`,
                data
              );
              break;
            case "plan":
              if (pendingSaveRef.current) break;
              addMessage("system", `📝 Plan updated`, data);
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
            default:
              addMessage("system", `[ACP] ${kind}`, data);
          }
          if (kind !== "agent_message_chunk" && kind !== "thought_message_chunk") {
            streamingRef.current = false;
          }
          break;
        }

        case "permission":
          addMessage("system", `✔ Auto-approved: ${data.title || "permission request"}`, data);
          break;

        case "fs":
          addMessage(
            "system",
            `${data.op === "read" ? "Read" : "Wrote"}: ${data.path || ""}`,
            data
          );
          break;

        case "stderr":
          addMessage("system", `[stderr] ${data}`, {});
          break;

        case "error":
          setConnState("error");
          if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            void finalizeSaveRef.current();
          }
          addMessage("system", `Error: ${data.message || JSON.stringify(data)}`, data);
          break;

        case "terminated":
          setConnState("error");
          addMessage("system", `[ACP] Agent exited`, data);
          setIsStarted(false);
          break;

        case "message":
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

  const startSession = useCallback(async () => {
    setStartError(null);
    setConnState("connecting");
    try {
      // Subscribe BEFORE spawning so we don't miss session/new or the first chunks.
      const unlisten = await listenToAcpSession(sessionId, handleAcpMessage);
      unlistenRef.current = unlisten;
      await acpStart(sessionId, agentId, cwd || undefined, resumeAgentSessionId);
      setIsStarted(true);
    } catch (e: any) {
      unlistenRef.current?.();
      unlistenRef.current = null;
      console.error("[acp_initialize error]", e);
      setStartError(String(e?.message || e));
    }
  }, [sessionId, agentId, cwd, handleAcpMessage, resumeAgentSessionId]);

  // Auto-start the ACP session on mount — no intermediate Start button screen.
  const startAttemptedRef = useRef(false);
  useEffect(() => {
    if (startAttemptedRef.current) return;
    startAttemptedRef.current = true;
    startSession();
  }, [startSession]);

  useEffect(() => {
    return () => {
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  const handleConfigChange = async (configId: string, value: string) => {
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
    if (!text.trim() || !isStarted || isBusy) return;

    const userContent = text.trim();
    streamingRef.current = false;
    addMessage("user", userContent);
    setInput("");
    setIsBusy(true);

    try {
      const ok = await acpSendPrompt(sessionId, userContent);
      if (!ok) {
        addMessage("system", `Failed to send prompt to ${agentName} (session may not be ready)`, {});
      }
    } catch (e) {
      console.error("[acp_send_prompt error]", e);
      addMessage("system", `Error sending prompt: ${e}`, {});
    } finally {
      // Prompt responses come back asynchronously; clear busy after a tick.
      setTimeout(() => setIsBusy(false), 250);
    }
  };

  const handleSend = async () => {
    await sendPrompt(input);
  };

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectOptions = configOptions.filter((o) => o.type === "select");

  if (!isStarted) {
    return (
      <div className="flex flex-col h-full w-full bg-[#1e1e1e] text-[#cccccc]">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Activity size={40} className="text-[#007acc] animate-pulse" />
          <h2 className="text-lg font-semibold">{agentName}</h2>
          {startError ? (
            <>
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs max-w-md break-all">
                ⚠️ {startError}
              </div>
              <button
                onClick={() => startSession()}
                className="px-4 py-2 bg-[#007acc] text-white text-xs rounded-xl hover:bg-[#0062a3] transition-colors"
              >
                Retry
              </button>
            </>
          ) : (
            <p className="text-xs text-[#888888]">
              Starting <span className="font-mono">{agentName}</span>…
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] text-[#cccccc]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text relative">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[#666666]">
            <Bot size={32} className="mb-2 opacity-50" />
            <p className="text-sm">Ask {agentName} to help with your code</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[88%] ${
              msg.role === "user"
                ? "ml-auto items-end"
                : "mr-auto items-start"
            }`}
          >
            {msg.role !== "user" && (
              <div className="flex items-center gap-1.5 mb-1 text-[#858585]">
                <span className="font-semibold text-[#cccccc] text-xs">
                  {msg.role === "assistant" ? agentName : "System"}
                </span>
                <span className="text-[10px] text-[#666666] font-mono">
                  {msg.timestamp}
                </span>
              </div>
            )}
            <div
              className={`p-3 rounded-2xl border shadow-sm break-words ${
                msg.role === "user"
                  ? "bg-[#007acc] text-white border-[#1188dd] rounded-br-xs"
                  : "bg-[#252526] text-[#e0e0e0] border-[#37373d] rounded-bl-xs"
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed text-[12.5px]">
                {msg.content}
              </div>
              {msg.role === "assistant" && (
                <div className="mt-2 pt-2 border-t border-[#333333] flex justify-end">
                  <button
                    onClick={() => copyCode(msg.content, msg.id)}
                    className="flex items-center gap-1.5 text-[11px] text-[#858585] hover:text-white px-2 py-0.5 rounded hover:bg-[#333333] transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <Check size={12} className="text-green-400" />
                    ) : (
                      <Copy size={12} />
                    )}
                    <span>{copiedId === msg.id ? "已复制" : "复制"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-[#1e1e1e]">
        <div
          className={`relative bg-[#252526] border rounded-2xl p-2 flex flex-col gap-2 shadow-lg transition-all ${
            isDragOver ? 'ring-2 ring-[#007acc] border-[#007acc]' : 'border-[#3c3c3c] focus-within:border-[#007acc]'
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
              <div className="px-2.5 py-1 text-[9.5px] uppercase tracking-wider text-[var(--aura-text-muted)] flex items-center justify-between border-b border-[var(--aura-border,#454545)]/60 mb-0.5">
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
                          i === clampedSlashIndex ? "bg-[#007acc]/25 text-[#7fc1ff]" : "text-[#e0e0e0]"
                        }`}
                      >
                        <span className={`font-mono text-[11px] flex-shrink-0 leading-5 ${row.kind === "client" ? "text-[#e5c07b]" : "text-[#4ec9b0]"}`}>
                          {row.kind === "client" ? "⚡/" : "/"}{row.name}
                        </span>
                        <span className="text-[10.5px] leading-5 text-[#a0a0a0] line-clamp-1 flex-1" title={row.description}>
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
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSlashClosed(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message… 输入 / 显示可用命令`}
            className="w-full bg-transparent text-xs text-[#cccccc] px-2 py-1 focus:outline-none resize-none placeholder:text-[#666666]"
          />
          {usage && (
            <div
              className="flex items-center gap-2 px-2 text-[9.5px] text-[var(--aura-text-muted)]"
              title={`上下文窗口占用 ${usage.used.toLocaleString()} / ${usage.size.toLocaleString()}`}
            >
              <span className="flex-shrink-0">ctx</span>
              <div className="flex-1 h-1 rounded-full bg-[#3a3a3a] overflow-hidden">
                <div
                  className="h-full bg-[#007acc] transition-all duration-150"
                  style={{ width: `${Math.min(100, usage.size > 0 ? (usage.used / usage.size) * 100 : 0).toFixed(1)}%` }}
                />
              </div>
              <span className="flex-shrink-0 font-mono tabular-nums">
                {usage.used.toLocaleString()}/{usage.size.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 px-2 pt-1 border-t border-[#303030]">
            <div className="flex items-center gap-1 min-w-0 flex-1 flex-wrap">
              {selectOptions.map((opt) => (
                <ConfigSelectChip
                  key={opt.id}
                  opt={opt}
                  isOpen={openConfigId === opt.id}
                  onToggle={setOpenConfigId}
                  onSelect={handleConfigChange}
                />
              ))}
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isBusy}
              className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#007acc] text-white text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#0062a3] transition-all shrink-0"
            >
              <span>Send</span>
              <Send size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
