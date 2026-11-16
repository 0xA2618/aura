import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Plug,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  AlertCircle,
  Check,
  Pencil,
  SearchCheck,
  TestTube2,
  RotateCcw,
  TriangleAlert,
  Power,
  Eye,
  EyeOff,
  Copy,
  Bot,
  Code2,
  Sparkles,
  Brain,
  Wrench,
  Feather,
  Globe,
} from 'lucide-react';
import {
  fetchOpencodeProviders,
  upsertOpencodeProvider,
  deleteOpencodeProvider,
  fetchOpencodeModels,
  fetchOpencodeProxyStatus,
  upsertOpencodeProviderPool,
  fetchOpencodeProviderKeys,
  deleteOpencodeProviderPool,
  setOpencodeProviderEnabled,
  setOpencodeKeyEnabled,
  testOpencodeKey,
  probeOpencodeModelWithCreds,
  reloadOpencodeProxyPort,
  previewOpencodeSessions,
  restartOpencode,
  OpencodeProviderMap,
  OpencodeProviderProtocol,
  OpencodeProxyStatus,
  OpencodeProxyProviderStatus,
  OpencodeSessionInfo,
  detectSystemAgents,
  DetectedAgent,
  setOpencodeProviderTarget,
} from '../services/fileService';
import {
  ClaudeIcon,
  CodexIcon,
  AntigravityIcon,
  OpenCodeIcon,
  GeminiIcon,
} from './AgentDropdownMenu';

interface ProvidersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestartOpencode?: () => void;
}

/** 绿色胶囊开关（instant：点击立即生效），样式与列表里的 On/Off 一致 */
const PillSwitch: React.FC<{
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  label?: string;
}> = ({ on, disabled, onClick, title, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    disabled={disabled}
    onClick={onClick}
    title={title}
    className="flex shrink-0 select-none items-center gap-1.5 outline-none disabled:cursor-not-allowed disabled:opacity-40"
  >
    <span
      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 ${
        on ? 'bg-emerald-500' : 'bg-neutral-600'
      }`}
    >
      <span
        className={`absolute top-[2px] left-[2px] h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${
          on ? 'translate-x-[12px]' : 'translate-x-0'
        }`}
      />
    </span>
    <span
      className={`text-[9px] font-bold tracking-wider ${
        on ? 'text-emerald-400' : 'text-[var(--aura-text-muted)]'
      }`}
    >
      {on ? 'On' : 'Off'}
    </span>
    {label ? <span className="sr-only">{label}</span> : null}
  </button>
);

/** agent tile：品牌图标在上、名称在中、胶囊开关/Copy 在下（类似顶栏 agent 图标选择器的视觉语言）
 *  variant: opencode = provider 总开关 + DEFAULT 徽章；agent = 自动注入（claude/codex）或标记 + Copy；generic = 无开关，Copy only */
const AgentTile: React.FC<{
  icon: React.ElementType;
  name: string;
  iconClassName: string;
  variant?: 'opencode' | 'agent' | 'generic';
  on: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  onCopy?: () => void;
  copied?: boolean;
  toggleTitle?: string;
}> = ({
  icon: Icon,
  name,
  iconClassName,
  variant = 'agent',
  on,
  disabled,
  onToggle,
  onCopy,
  copied,
  toggleTitle,
}) => (
  <div
    className="flex w-[70px] flex-col items-center gap-1 rounded-lg border border-[var(--aura-border,#454545)] bg-white/[0.02] px-1 py-1.5"
    title={name}
  >
    <Icon size={22} className={iconClassName} />
    <span className="w-full truncate text-center text-[9px] leading-3 text-[var(--aura-text-muted)]">
      {name}
    </span>
    {variant === 'generic' ? (
      <div className="h-4" />
    ) : (
      <PillSwitch on={on} disabled={disabled} onClick={onToggle ?? (() => {})} title={toggleTitle} label={name} />
    )}
    {variant === 'opencode' ? (
      <span className="rounded border border-[var(--aura-accent,#007acc)]/30 bg-[var(--aura-accent,#007acc)]/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[var(--aura-accent,#007acc)]">
        default
      </span>
    ) : (
      <button
        type="button"
        onClick={onCopy}
        title={`Copy ${name} setup snippet`}
        className="flex shrink-0 items-center gap-1 rounded border border-[var(--aura-border,#454545)] px-1 py-0.5 text-[8px] uppercase tracking-wider text-[var(--aura-text-muted)] transition-colors hover:text-[var(--aura-text)] hover:border-[var(--aura-accent,#007acc)]/60"
      >
        {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
        Copy
      </button>
    )}
  </div>
);

interface ModelEntry {
  id: string;
  enabled: boolean;
}

/** 单个模型的探测结果详情：fail 时可展开查看 HTTP 状态与响应片段 */
interface ModelProbeDetail {
  status: 'ok' | 'fail';
  http?: number;
  error?: string;
  body?: string;
}

const PROTOCOLS: ReadonlyArray<{ value: OpencodeProviderProtocol; label: string; sublabel: string }> = [
  { value: 'openai', label: 'OpenAI Compatible', sublabel: 'aisdk:@ai-sdk/openai-compatible' },
  { value: 'anthropic', label: 'Anthropic (Claude)', sublabel: 'aisdk:@ai-sdk/anthropic' },
  { value: 'google', label: 'Google Gemini', sublabel: 'aisdk:@ai-sdk/google' },
];

const PROTOCOL_DEFAULTS: Record<OpencodeProviderProtocol, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
};

const PACKAGES: Record<OpencodeProviderProtocol, string> = {
  openai: 'aisdk:@ai-sdk/openai-compatible',
  anthropic: 'aisdk:@ai-sdk/anthropic',
  google: 'aisdk:@ai-sdk/google',
};

const DEFAULT_PORT = 2618;

const slugify = (s: string): string => {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'provider';
};

const protocolOf = (provider: any): OpencodeProviderProtocol => {
  const pkg = String(provider?.package ?? '').toLowerCase();
  if (pkg.includes('anthropic')) return 'anthropic';
  if (pkg.includes('google')) return 'google';
  return 'openai';
};

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--aura-input-bg, var(--aura-card-bg, #252526))',
  borderColor: 'var(--aura-border, #454545)',
  color: 'var(--aura-text, #cccccc)',
};

export const ProvidersModal: React.FC<ProvidersModalProps> = ({ isOpen, onClose, onRestartOpencode }) => {
  const [providers, setProviders] = useState<OpencodeProviderMap>({});
  const [proxyStatus, setProxyStatus] = useState<OpencodeProxyStatus>({ ok: true, port: DEFAULT_PORT, providers: {} });
  const [detectedAgents, setDetectedAgents] = useState<DetectedAgent[]>([]);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [protocol, setProtocol] = useState<OpencodeProviderProtocol>('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKeys, setApiKeys] = useState<string[]>(['']);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [manualModels, setManualModels] = useState('');
  const [saving, setSaving] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [portDraft, setPortDraft] = useState<number>(DEFAULT_PORT);
  const [portApplying, setPortApplying] = useState(false);
  const [probingKey, setProbingKey] = useState<number | null>(null);
  const [keyVisible, setKeyVisible] = useState<Set<number>>(new Set());
  const [testResults, setTestResults] = useState<Record<number, string>>({});
  const [modelTestResults, setModelTestResults] = useState<Record<string, ModelProbeDetail>>({});
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [testingModels, setTestingModels] = useState(false);
  const [testingProgress, setTestingProgress] = useState(0);
  const [testingTotal, setTestingTotal] = useState(0);
  const testCancelRef = useRef(false);

  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingKeyError, setPendingKeyError] = useState<number | null>(null);
  const [previewSessions, setPreviewSessions] = useState<OpencodeSessionInfo[]>([]);
  const [restarting, setRestarting] = useState(false);

  const loadProviders = useCallback(async () => {
    setLoadingList(true);
    try {
      const [res, status, agents] = await Promise.all([
        fetchOpencodeProviders(),
        fetchOpencodeProxyStatus(),
        detectSystemAgents().catch(() => [] as DetectedAgent[]),
      ]);
      setProviders(res ?? {});
      setProxyStatus(status);
      setDetectedAgents(agents ?? []);
      setPortDraft(status.port || DEFAULT_PORT);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const [protoOpen, setProtoOpen] = useState(false);
  const protoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (protoRef.current && !protoRef.current.contains(e.target as Node)) {
        setProtoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadProviders();
      setNotice(null);
      setErrorMsg(null);
      setFetchError(null);
      setTestResults({});
      // Reset state on open — only show current providers.
      setFormOpen(false);
      setEditingId(null);
      setManualModels('');
      setName('');
      setModels([]);
      setListCollapsed(false);
    }
  }, [isOpen, loadProviders]);

  // 关闭面板时取消正在进行的模型测试
  useEffect(() => {
    if (!isOpen) {
      testCancelRef.current = true;
    }
  }, [isOpen]);

  // Notice auto-dismisses after 5s.
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Poll proxy status every 2s.
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(async () => {
      const status = await fetchOpencodeProxyStatus();
      setProxyStatus(status);
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showRestartConfirm) {
          handleCancelRestart();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose, showRestartConfirm]);

  if (!isOpen) return null;

  const resetForm = (forEditId: string | null) => {
    setFormOpen(true);
    setEditingId(forEditId);
    setNotice(null);
    setErrorMsg(null);
    setFetchError(null);
    setManualModels('');
    setTestResults({});
    if (forEditId === null) {
      setName('');
      setNote('');
      setProtocol('openai');
      setBaseUrl('');
      setApiKeys(['']);
      setModels([]);
    } else {
      // Async: read real key array from the aura pool; non-blocking.
      const p = providers[forEditId] ?? {};
      const poolStatus = proxyStatus.providers[forEditId];
      setName(p?.name ?? forEditId);
      setNote(poolStatus?.note ?? '');
      setProtocol(protocolOf(p));
      setBaseUrl(poolStatus?.upstream ?? p?.settings?.baseURL ?? '');
      setApiKeys(poolStatus ? poolStatus.keys.map(() => '…') : [p?.settings?.apiKey ?? '']);
      setModels(Object.keys(p?.models ?? {}).map((mid) => ({ id: mid, enabled: true })));
      fetchOpencodeProviderKeys(forEditId).then((keys) => {
        if (keys.length > 0) {
          setApiKeys(keys);
        } else {
          setApiKeys([p?.settings?.apiKey ?? '']);
        }
      });
    }
  };

  const addKey = () => setApiKeys((prev) => [...prev, '']);
  const removeKey = (idx: number) =>
    setApiKeys((prev) => {
      if (prev.length <= 1) return [''];
      const next = prev.slice();
      next.splice(idx, 1);
      return next;
    });
  const updateKey = (idx: number, v: string) =>
    setApiKeys((prev) => prev.map((k, i) => (i === idx ? v : k)));
  const clearKey = (idx: number) => updateKey(idx, '');

  const toggleKeyVisible = (idx: number) => {
    setKeyVisible((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleTestAll = async () => {
    // Requires the provider to be persisted to the aura pool first.
    const trimmedId = editingId ?? slugify(name.trim());
    if (!trimmedId || !proxyStatus.providers[trimmedId]) {
      setFetchError('Please save the provider first, then test');
      return;
    }
    const validIdx = apiKeys
      .map((k, i) => (k.trim().length > 0 ? i : -1))
      .filter((i) => i >= 0);
    for (const i of validIdx) {
      const result = await testOpencodeKey(trimmedId, i);
      const text = result.ok
        ? `HTTP ${result.http}${typeof result.models === 'number' ? ` · ${result.models} models` : ''}`
        : `HTTP ${result.http}${result.error ? ` · ${result.error}` : ''}`;
      setTestResults((prev) => ({ ...prev, [i]: text }));
      if (result.ok) {
        await setOpencodeKeyEnabled(trimmedId, i, true);
      }
    }
    await loadProviders();
  };

  const handleTestSelectedModels = async () => {
    // 直接用表单当前的 protocol / baseURL / 第一个 key 探测，无需先保存 provider
    const firstKey = apiKeys.map((k) => k.trim()).find((k) => k.length > 0);
    if (!firstKey) {
      setFetchError('At least one API key is required');
      return;
    }
    if (!baseUrl.trim()) {
      setFetchError('Please enter a Base URL');
      return;
    }
    const selected = models.filter((m) => m.enabled).map((m) => m.id);
    if (selected.length === 0) {
      setFetchError('Select at least one model to test');
      return;
    }
    testCancelRef.current = false;
    setTestingModels(true);
    setTestingProgress(0);
    setTestingTotal(selected.length);
    setExpandedModelId(null);
    setFetchError(null);
    const results: Record<string, ModelProbeDetail> = { ...modelTestResults };

    // APINEX 免费档 15 RPM —— 串行 + 4s 间隔，44 个模型约 3 分钟。并发打会被 429 全标 fail。
    const REQUEST_GAP_MS = 4000;

    for (let i = 0; i < selected.length; i++) {
      if (testCancelRef.current) break;
      const mid = selected[i];
      try {
        // 未保存的 provider 也可以直接测：用表单里的实时凭据探测
        const res = await probeOpencodeModelWithCreds(protocol, baseUrl.trim(), firstKey, mid);
        results[mid] = res.ok
          ? { status: 'ok', http: res.http }
          : { status: 'fail', http: res.http, error: res.error, body: res.body };
      } catch (e: any) {
        results[mid] = { status: 'fail', error: String(e?.message ?? e) };
      }
      setTestingProgress(i + 1);
      setModelTestResults({ ...results });
      if (i + 1 < selected.length) {
        // 可打断的 4s 等待：点击 Cancel 立即跳出，不用干等限流窗口结束
        await new Promise<void>((resolve) => {
          const deadline = Date.now() + REQUEST_GAP_MS;
          const tick = () => {
            if (testCancelRef.current || Date.now() >= deadline) {
              resolve();
              return;
            }
            window.setTimeout(tick, 150);
          };
          tick();
        });
      }
    }

    setTestingModels(false);
    if (testCancelRef.current) {
      setNotice('Test cancelled. Models already tested keep their results.');
    }
  };

  const handleCancelTest = () => {
    testCancelRef.current = true;
  };

  const handleTestKey = async (idx: number) => {
    const trimmedId = (editingId ?? slugify(name.trim())) || '';
    if (!trimmedId) {
      setFetchError('Please enter a name');
      return;
    }
    setProbingKey(idx);
    const result = await testOpencodeKey(trimmedId, idx);
    setProbingKey(null);
    const text = result.ok
      ? `HTTP ${result.http}${typeof result.models === 'number' ? ` · ${result.models} models` : ''}`
      : `HTTP ${result.http}${result.error ? ` · ${result.error}` : ''}`;
    // Successful Test auto-re-enables; failed keys stay excluded.
    if (result.ok) {
      await setOpencodeKeyEnabled(trimmedId, idx, true);
      await loadProviders();
    }
    setTestResults((prev) => ({ ...prev, [idx]: text }));
  };

  // ---------- Use with agent CLIs（顶部 Port 下方按 provider 分组；品牌图标横向排列，胶囊开关即时生效） ----------
  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // WKWebView 剪贴板受限时降级到 execCommand
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const agentSnippet = (
    agentId: string,
    providerId: string,
    port: number,
    modelIds: string[]
  ): string => {
    const base = `http://127.0.0.1:${port}/${providerId}`;
    const openaiBase = `${base}/v1`;
    const model = modelIds[0] ?? '<model>';
    const modelsList = modelIds.slice(0, 5).join(', ');
    if (agentId === 'claude') {
      return [
        '# Claude Code — Anthropic-compatible endpoint (provider must use protocol=anthropic)',
        `export ANTHROPIC_BASE_URL=${base}`,
        'export ANTHROPIC_AUTH_TOKEN=local-rotation',
        `export ANTHROPIC_MODEL=${model}`,
        `export ANTHROPIC_SMALL_FAST_MODEL=${model}`,
        `# enabled models: ${modelsList || '(none)'}`,
      ].join('\n');
    }
    if (agentId === 'codex') {
      return [
        '# Codex — ~/.codex/config.toml (verify `wire_api` against your codex version)',
        `model = "${model}"`,
        'model_provider = "aura"',
        '',
        '[model_providers.aura]',
        'name = "Aura (local proxy)"',
        `base_url = "${openaiBase}"`,
        'env_key = "AURA_LOCAL_ROTATION"',
        'wire_api = "chat"',
        '',
        '# then: export AURA_LOCAL_ROTATION=local-rotation',
      ].join('\n');
    }
    if (agentId === 'gemini') {
      return [
        '# Gemini CLI — Google-compatible endpoint (provider must use protocol=google)',
        `export GOOGLE_GEMINI_BASE_URL=${base}`,
        'export GEMINI_API_KEY=local-rotation',
        '# verify against your gemini CLI version',
      ].join('\n');
    }
    if (agentId === 'aider') {
      return [
        '# Aider — OpenAI-compatible endpoint',
        `export OPENAI_BASE_URL=${openaiBase}`,
        'export OPENAI_API_KEY=local-rotation',
        `# then: aider --model openai/${model}`,
      ].join('\n');
    }
    if (agentId === 'goose') {
      return [
        '# Goose — OpenAI-compatible endpoint',
        'export GOOSE_PROVIDER=openai',
        `export OPENAI_BASE_URL=${openaiBase}`,
        'export OPENAI_API_KEY=local-rotation',
        `# model: ${model}`,
      ].join('\n');
    }
    return [
      '# Generic OpenAI-compatible CLI',
      `export OPENAI_BASE_URL=${openaiBase}`,
      'export OPENAI_API_KEY=local-rotation',
      `# model: ${model}`,
      `# enabled models: ${modelsList || '(none)'}`,
    ].join('\n');
  };

  /** 每个 agent 的展示图标（品牌 SVG 优先，未知用 lucide 通用图标），类型与 Tile 一致 */
  const agentIcon = (agentId: string): React.ElementType => {
    switch (agentId) {
      case 'opencode':
        return OpenCodeIcon;
      case 'claude':
        return ClaudeIcon;
      case 'codex':
        return CodexIcon;
      case 'gemini':
        return GeminiIcon;
      case 'agy':
      case 'agy-acp':
        return AntigravityIcon;
      case 'qwen':
        return Brain;
      case 'aider':
        return Wrench;
      case 'goose':
        return Feather;
      default:
        return Bot;
    }
  };

  /** 每个 agent 图标的染色（品牌色/默认前景色） */
  const agentIconClass = (agentId: string): string => {
    switch (agentId) {
      case 'opencode':
        return 'text-[#4ea8de]';
      case 'claude':
        return 'text-[#D97757]';
      case 'codex':
        return 'text-[#10a37f]';
      case 'agy':
      case 'agy-acp':
      case 'gemini':
        return '';
      default:
        return 'text-[var(--aura-text)]';
    }
  };

  /** Phase 1 兼容性：只展示协议匹配的 agent（claude=anthropic，gemini=google，其余=openai） */
  const agentSupportsProtocol = (agentId: string, protocol: string): boolean => {
    if (protocol === 'anthropic') return agentId === 'claude';
    if (protocol === 'google') return agentId === 'gemini';
    return agentId !== 'claude' && agentId !== 'gemini';
  };

  /** 已安装且协议兼容的 agent 列表（按支持度排序，同 command 只保留非 acp 变体） */
  const useWithTargets = (protocol: string) => {
    const installed = detectedAgents.filter((a) => a.is_installed && a.id !== 'opencode');
    const byCommand = new Map<string, DetectedAgent>();
    for (const a of installed) {
      const prev = byCommand.get(a.command);
      if (!prev || (prev.acp && !a.acp)) byCommand.set(a.command, a);
    }
    const ORDER = ['claude', 'codex', 'gemini', 'aider', 'goose'];
    const rank = (id: string) => {
      const i = ORDER.indexOf(id);
      return i === -1 ? ORDER.length : i;
    };
    return Array.from(byCommand.values())
      .filter((a) => agentSupportsProtocol(a.id, protocol))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  };

  const handleCopySnippet = async (
    providerId: string,
    protocol: string,
    modelIds: string[],
    agentId: string
  ) => {
    const snippet =
      agentId === 'generic'
        ? agentSnippet('__generic__', providerId, proxyStatus.port, modelIds)
        : agentSnippet(agentId, providerId, proxyStatus.port, modelIds);
    const ok = await copyText(snippet);
    const key = `${providerId}:${agentId}`;
    setCopiedTarget(key);
    window.setTimeout(() => setCopiedTarget((cur) => (cur === key ? null : cur)), 1600);
    if (!ok) setErrorMsg('Copy failed — clipboard write was blocked.');
  };

  /** 点击胶囊开关即生效：claude/codex 真注入（先备份），其余 agent 只标记到 pool */
  const handleToggleAgentTarget = async (providerId: string, agent: string, next: boolean) => {
    const res = await setOpencodeProviderTarget(providerId, agent, next);
    if (res.ok) {
      setNotice(
        res.message ??
          (next
            ? `${agent} enabled for ${providerId}. Restart ${agent} to apply.`
            : `${agent} disabled for ${providerId}.`)
      );
      await loadProviders();
    } else {
      setErrorMsg(res.error ?? `Failed to ${next ? 'enable' : 'disable'} ${agent}`);
    }
  };

  const handleProtocolChange = (p: OpencodeProviderProtocol) => {
    // 协议切换不预填 Base URL（占位提示仍展示该协议示例）；新增场景留空由用户输入
    setProtocol(p);
  };

  const handleFetchModels = async () => {
    const firstKey = apiKeys.find((k) => k.trim().length > 0) ?? '';
    if (!baseUrl.trim() || !firstKey) {
      setFetchError('Please enter Base URL and the first API key');
      return;
    }
    setFetching(true);
    setFetchError(null);
    const result = await fetchOpencodeModels(baseUrl.trim(), firstKey, protocol);
    setFetching(false);
    if (result.error) {
      setFetchError(result.error);
      setModels([]);
      return;
    }
    setModels(result.models.map((mid) => ({ id: mid, enabled: true })));
  };

  const toggleModel = (id: string) => {
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
  };

  const toggleAll = (enabled: boolean) => {
    setModels((prev) => prev.map((m) => ({ ...m, enabled })));
  };

  const applyPort = async () => {
    const target = Number(portDraft);
    if (!Number.isFinite(target) || target <= 0 || target > 65535) {
      setErrorMsg('Port must be between 1 and 65535');
      return;
    }
    if (target === proxyStatus.port) {
      setNotice(`Proxy port unchanged (${target})`);
      return;
    }
    setPortApplying(true);
    const ok = await reloadOpencodeProxyPort(target);
    setPortApplying(false);
    if (ok) {
      setProxyStatus((s) => ({ ...s, port: target }));
      setNotice(`Proxy port switched to ${target}. opencode.json updated — restart opencode to apply`);
      setPreviewSessions(await previewOpencodeSessions());
      setShowRestartConfirm(true);
    } else {
      setErrorMsg('Failed to switch proxy port. See console logs.');
    }
  };

  const enabledCount = models.filter((m) => m.enabled).length;

  const handleSave = async () => {
    const validKeys = apiKeys.map((k) => k.trim()).filter(Boolean);
    const manual = manualModels
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const allIds = Array.from(new Set([...models.filter((m) => m.enabled).map((m) => m.id), ...manual]));

    if (!name.trim()) {
      setFetchError('Name is required');
      return;
    }
    if (!baseUrl.trim() || validKeys.length === 0) {
      setFetchError('Base URL and at least one API key required');
      return;
    }
    if (allIds.length === 0) {
      setFetchError('Enable at least one  or enter  IDs below');
      return;
    }
    const id = editingId ?? slugify(name.trim());
    if (!editingId && providers[id]) {
      setFetchError(`id "${id}" already exists. Pick a different name`);
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    const port = proxyStatus.port;
    const def = {
      name: name.trim(),
      package: PACKAGES[protocol],
      settings: {
        apiKey: 'local-rotation',
        baseURL: `http://127.0.0.1:${port}/${id}/v1`,
      },
      models: Object.fromEntries(allIds.map((mid) => [mid, { name: mid }])),
    };
    const okOpencode = await upsertOpencodeProvider(id, def);
    const okPool = await upsertOpencodeProviderPool(id, protocol, baseUrl.trim().replace(/\/+$/, ''), validKeys, true, note);
    setSaving(false);
    if (!okOpencode || !okPool) {
      setErrorMsg('Failed to save. See console logs.');
      return;
    }
    // Do not close after Save — return to list view.
    setEditingId(null);
    setFormOpen(false);
    setNotice(`Saved ${id}. Restart opencode to apply the changes.`);
    setTestResults({});
    await loadProviders();
  };

  const handleToggleProvider = async (id: string, nextEnabled: boolean) => {
    const ok = await setOpencodeProviderEnabled(id, nextEnabled);
    if (ok) {
      setProviders((prev) => ({ ...prev }));
      await loadProviders();
      setNotice(nextEnabled ? `Provider "${id}" enabled. baseURL now points to local proxy.` : `Provider "${id}" disabled and removed from opencode.json.`);
    }
  };

  const confirmDelete = async (id: string) => {
    const ok = await deleteOpencodeProviderPool(id);
    if (ok) {
      setProviders((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setNotice(`Provider "${id}" deleted`);
      await loadProviders();
    } else {
      setErrorMsg('Failed to delete. See console logs.');
    }
    setPendingDeleteId(null);
  };

  const handleCancelRestart = () => {
    setShowRestartConfirm(false);
    setNotice('Saved. Restart opencode to apply the changes.');
  };

  const handleConfirmRestart = async () => {
    setRestarting(true);
    const res = await restartOpencode();
    setRestarting(false);
    setShowRestartConfirm(false);
    setNotice(
      res.killed > 0
        ? `Closed ${res.killed} opencode processes. Opening a fresh session…`
        : 'No running opencode processes found. Opening a fresh session…'
    );
    onRestartOpencode?.();
  };

  const poolMap: Record<string, OpencodeProxyProviderStatus> = proxyStatus?.providers ?? {};
  const listKeys = Array.from(new Set([...Object.keys(providers ?? {}), ...Object.keys(poolMap)]));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div
        style={{
          backgroundColor: 'var(--aura-card-bg, #252526)',
          borderColor: 'var(--aura-border, #454545)',
          color: 'var(--aura-text, #cccccc)',
        }}
        className="w-[720px] max-h-[86vh] border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: 'var(--aura-topbar-bg, #1f1f1f)',
            borderColor: 'var(--aura-border, #333333)',
          }}
          className="flex items-center justify-between px-4 py-3 border-b select-none"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aura-text)]">
            <Plug size={16} className="text-[#007acc]" />
            <span>Providers</span>
          </div>
          <button onClick={onClose} className="aura-btn-ghost p-1 rounded-md">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {notice && (
            <div className="mx-4 mt-3 flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-1.5">
              <Save size={12} />
              <span>{notice}</span>
            </div>
          )}
          {errorMsg && (
            <div className="mx-4 mt-3 flex items-center gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-2.5 py-1.5">
              <AlertCircle size={12} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Proxy port row */}
          <div className="mx-4 mt-3 flex items-center gap-2">
            <span className="text-[11px] text-[var(--aura-text-muted)]">Port</span>
            <input
              type="number"
              value={portDraft}
              onChange={(e) => setPortDraft(Number(e.target.value) || DEFAULT_PORT)}
              min={1}
              max={65535}
              className="w-16 border rounded-md px-2 py-1 text-xs font-mono outline-none"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={applyPort}
              disabled={portApplying || Number(portDraft) === proxyStatus.port}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-[var(--aura-border,#454545)] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] disabled:opacity-50 transition-all"
            >
              {portApplying ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              <span>Apply</span>
            </button>
          </div>

          {/* Use with agent CLIs — grouped by provider；勾选后点 Apply 生效 */}
          {listKeys.length > 0 && (
            <div
              className="mx-4 mt-2.5 border rounded-lg divide-y overflow-hidden"
              style={{ borderColor: 'var(--aura-border, #454545)' }}
            >
              {listKeys.map((id) => {
                const p = providers[id] ?? {};
                const pool = poolMap[id];
                const proto = pool?.protocol ?? protocolOf(p);
                const pEnabled = pool?.enabled ?? true;
                const agents = useWithTargets(proto);
                const targetsMap = pool?.targets ?? {};
                const modelIds = Object.keys(p?.models ?? {});
                const genericOk = proto === 'openai';
                return (
                  <div key={id} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--aura-text-muted)]">
                        Use with
                      </span>
                      <span className="min-w-0 truncate text-[11px] font-semibold text-[var(--aura-text)]">
                        {p?.name ?? id}
                      </span>
                      <span className="shrink-0 text-[9px] text-[var(--aura-text-muted)]">
                        {proto} · {pEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {/* opencode 默认 tile：胶囊开关 = 该 provider 在 opencode 中启用（与列表里的 On/Off 同一状态） */}
                      <AgentTile
                        icon={OpenCodeIcon}
                        name="opencode"
                        iconClassName="text-[#4ea8de]"
                        variant="opencode"
                        on={pEnabled}
                        onToggle={() => handleToggleProvider(id, !pEnabled)}
                        toggleTitle={pEnabled ? 'opencode enabled — click to disable' : 'opencode disabled — click to enable'}
                      />
                      {agents.map((agent) => {
                        const on = !!targetsMap[agent.id];
                        const AgentIcon = agentIcon(agent.id);
                        return (
                          <AgentTile
                            key={agent.id}
                            icon={AgentIcon}
                            name={agent.name}
                            iconClassName={agentIconClass(agent.id)}
                            variant="agent"
                            on={on}
                            disabled={!pEnabled}
                            onToggle={() => handleToggleAgentTarget(id, agent.id, !on)}
                            onCopy={() => handleCopySnippet(id, proto, modelIds, agent.id)}
                            copied={copiedTarget === `${id}:${agent.id}`}
                            toggleTitle={
                              !pEnabled
                                ? 'Provider is disabled — enable it first'
                                : agent.id === 'claude'
                                  ? on
                                    ? 'claude enabled — click to remove aura-managed env from ~/.claude/settings.json'
                                    : 'Enable claude — writes ANTHROPIC_* env into ~/.claude/settings.json (backup first)'
                                  : agent.id === 'codex'
                                    ? on
                                      ? 'codex enabled — click to remove aura-managed provider from ~/.codex/config.toml'
                                      : 'Enable codex — writes [model_providers.aura] into ~/.codex/config.toml (backup first)'
                                    : on
                                      ? `Disable ${agent.name} for this provider`
                                      : `Enable ${agent.name} for this provider (mark only — use Copy to set it up)`
                            }
                          />
                        );
                      })}
                      {agents.length === 0 && (
                        <div className="flex h-[86px] items-center text-[9px] text-[var(--aura-text-muted)]">
                          No compatible agent CLI for protocol {proto}.
                        </div>
                      )}
                      <AgentTile
                        icon={Globe}
                        name="Generic"
                        iconClassName="text-[var(--aura-text-muted)]"
                        variant="generic"
                        on={false}
                        onCopy={() => handleCopySnippet(id, proto, modelIds, 'generic')}
                        copied={copiedTarget === `${id}:generic`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Existing providers list */}
          <div className="px-4 pt-3">
            <button
              type="button"
              onClick={() => setListCollapsed((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] transition-colors py-1"
            >
              <span>Configured Providers ({listKeys.length})</span>
              {listCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
            {!listCollapsed && (
              <div className="mt-1 space-y-1.5">
                {loadingList && (
                  <div className="text-[11px] text-[var(--aura-text-muted)] flex items-center gap-2 py-2">
                    <Loader2 size={12} className="animate-spin" /> Loading…
                  </div>
                )}
                {!loadingList && listKeys.length === 0 && (
                  <div className="text-[11px] text-[var(--aura-text-muted)] py-2 border border-dashed border-[var(--aura-border,#454545)] rounded-lg px-3">
                    No providers yet. Click + Add Provider to create one.
                  </div>
                )}
                {listKeys.map((id) => {
                  const p = providers[id] ?? {};
                  const pool = poolMap[id];
                  const Ids = Object.keys(p?.models ?? {});
                  const proto = pool?.protocol ?? protocolOf(p);
                  const enabled = pool?.enabled ?? true;
                  const badKeys = (pool?.keys ?? []).filter((k) => !k.enabled);
                  const totalKeys = pool?.totalKeys ?? (id.length > 0 ? id.length : 1);
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-2 border rounded-lg px-2.5 py-2 transition-colors ${!enabled ? 'opacity-70' : ''}`}
                      style={{ borderColor: 'var(--aura-border, #454545)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--aura-text)] truncate">
                            {p?.name ?? id}
                          </span>
                          <span className="text-[10px] text-[var(--aura-text-muted)]">
                            {totalKeys} key
                          </span>
                          {badKeys.length > 0 && (
                            <span
                              title={badKeys
                                .map((k) => `#${k.index + 1}: ${k.lastError ?? 'excluded'}`)
                                .join('\n')}
                              className="flex items-center gap-1 text-[10px] text-amber-400 cursor-help"
                            >
                              <TriangleAlert size={10} />
                              {badKeys.length} unavailable
                            </span>
                          )}
                        </div>
                        {pool?.note && (
                          <div
                            className="mt-0.5 text-[10px] text-[var(--aura-text-muted)] leading-4 truncate"
                            title={pool.note}
                          >
                            {pool.note}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => resetForm(id)}
                        title="Edit provider"
                        className="aura-btn-ghost p-1.5 rounded-md text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleProvider(id, !enabled)}
                        title={enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                        className="shrink-0 flex items-center gap-1 select-none cursor-pointer outline-none"
                        role="switch"
                        aria-checked={enabled}
                      >
                        <span
                          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 ${
                            enabled
                              ? 'bg-emerald-500'
                              : 'bg-neutral-600'
                          }`}
                        >
                          <span
                            className={`absolute top-[2px] left-[2px] h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${
                              enabled ? 'translate-x-[12px]' : 'translate-x-0'
                            }`}
                          />
                        </span>
                        <span
                          className={`text-[9px] font-bold tracking-wider w-4 text-left ${
                            enabled ? 'text-emerald-400' : 'text-[var(--aura-text-muted)]'
                          }`}
                        >
                          {enabled ? 'On' : 'Off'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(id)}
                        title="Delete this provider"
                        className="aura-btn-ghost p-1.5 rounded-md text-[var(--aura-text-muted)] hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {!formOpen && (
              <button
                type="button"
                onClick={() => resetForm(null)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[var(--aura-border,#454545)] text-[11px] font-medium text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:border-[var(--aura-accent,#007acc)]/60 transition-all"
              >
                <Plus size={13} />
                <span>Add Provider</span>
              </button>
            )}
          </div>

          {/* Add / Edit form */}
          {formOpen && (
            <div className="px-4 pb-4 pt-3">
              <div
                className="border rounded-xl p-3 space-y-2.5"
                style={{ borderColor: 'var(--aura-border, #454545)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-[var(--aura-text)]">
                    {editingId ? `Edit Provider · ${editingId}` : 'Add Provider'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="aura-btn-ghost p-1 rounded-md text-[var(--aura-text-muted)]"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Row: name + protocol */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--aura-text-muted)] mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. apinex"
                      className="w-full border rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[var(--aura-accent,#007acc)]"
                      style={inputStyle}
                    />
                  </div>
                  <div className="w-[210px] relative" ref={protoRef}>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--aura-text-muted)] mb-1">
                      Protocol
                    </label>
                    <button
                      type="button"
                      onClick={() => setProtoOpen((v) => !v)}
                      className="w-full flex items-center justify-between gap-2 border rounded-md px-2.5 py-1.5 text-xs outline-none transition-colors hover:border-[var(--aura-accent,#007acc)]/70"
                      style={inputStyle}
                    >
                      <span className="truncate">{PROTOCOLS.find((p) => p.value === protocol)?.label}</span>
                      <ChevronDown
                        size={12}
                        className={`shrink-0 text-[var(--aura-text-muted)] transition-transform duration-200 ${protoOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {protoOpen && (
                      <div
                        style={{
                          backgroundColor: 'var(--aura-card-bg, #252526)',
                          borderColor: 'var(--aura-border, #454545)',
                        }}
                        className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg border shadow-2xl overflow-hidden backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100"
                      >
                        {PROTOCOLS.map((p) => {
                          const active = p.value === protocol;
                          return (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => {
                                handleProtocolChange(p.value);
                                setProtoOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                                active
                                  ? 'bg-[var(--aura-accent,#007acc)]/15 text-[var(--aura-accent,#007acc)]'
                                  : 'text-[var(--aura-text,#cccccc)] hover:bg-white/5'
                              }`}
                            >
                              <Check size={12} className={active ? 'opacity-100' : 'opacity-0'} />
                              <span className="min-w-0">
                                <span className="block text-[11px] font-medium leading-4">{p.label}</span>
                                <span className="block text-[9px] font-mono text-[var(--aura-text-muted)] leading-3 truncate">
                                  {p.sublabel}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Note (optional remark, stored in aura only) */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[var(--aura-text-muted)] mb-1">
                    Note <span className="normal-case font-normal opacity-60">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. personal use, free tier key, team shared"
                    className="w-full border rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[var(--aura-accent,#007acc)]"
                    style={inputStyle}
                  />
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[var(--aura-text-muted)] mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={PROTOCOL_DEFAULTS[protocol]}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full border rounded-md px-2.5 py-1.5 text-xs font-mono outline-none focus:border-[var(--aura-accent,#007acc)]"
                    style={inputStyle}
                  />
                </div>

                {/* API Key pool */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-[var(--aura-text-muted)]">
                      API Keys
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={addKey}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Plus size={11} /> Add Key
                      </button>
                      <button
                        type="button"
                        onClick={handleTestAll}
                        disabled={probingKey !== null}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[var(--aura-text-muted)] border border-[var(--aura-border,#454545)] hover:text-[var(--aura-text)] transition-colors disabled:opacity-50"
                      >
                        <TestTube2 size={11} /> Test All
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const isKeyEnabled = (idx: number): boolean => {
                      const t = testResults[idx];
                      if (t) return t.startsWith('HTTP 2');
                      const poolStatus = editingId ? proxyStatus?.providers?.[editingId]?.keys?.[idx] : undefined;
                      if (poolStatus) return poolStatus.enabled;
                      return true;
                    };
                    const keyIndices = apiKeys.map((_, i) => i);
                    const okKeys = keyIndices.filter(isKeyEnabled);
                    const badKeys = keyIndices.filter((i) => !isKeyEnabled(i));
                    const renderKeyRow = (idx: number, bad: boolean) => {
                      const visible = keyVisible.has(idx);
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-1.5 ${bad ? 'opacity-80' : ''}`}
                        >
                          <span className="text-[10px] text-[var(--aura-text-muted)] font-mono w-5 text-right">
                            #{idx + 1}
                          </span>
                          <input
                            type={visible ? 'text' : 'password'}
                            value={apiKeys[idx]}
                            onChange={(e) => updateKey(idx, e.target.value)}
                            placeholder={idx === 0 ? 'sk-…' : 'key…'}
                            spellCheck={false}
                            autoCapitalize="none"
                            autoCorrect="off"
                            className="flex-1 border rounded-md px-2 py-1.5 text-xs font-mono outline-none"
                            style={inputStyle}
                          />
                          <button
                            type="button"
                            onClick={() => toggleKeyVisible(idx)}
                            title={visible ? 'Hide plain text' : 'Show plain text'}
                            className="p-1.5 rounded-md text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-white/5 transition-colors"
                          >
                            {visible ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          {testResults[idx] && (
                            testResults[idx].startsWith('HTTP 2') ? (
                              <span title={testResults[idx]} className="flex items-center p-1 text-emerald-400">
                                <Check size={14} />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingKeyError((v) => (v === idx ? null : idx))}
                                className={`flex items-center p-1 text-amber-400 hover:text-amber-300 cursor-pointer rounded-md ${
                                  pendingKeyError === idx ? 'bg-amber-500/10' : ''
                                }`}
                                title="Show full error"
                              >
                                <TriangleAlert size={14} />
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => handleTestKey(idx)}
                            disabled={probingKey !== null}
                            title="Test this key"
                            className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] border border-transparent hover:border-[var(--aura-border,#454545)] disabled:opacity-50 transition-all"
                          >
                            {probingKey === idx ? <Loader2 size={11} className="animate-spin" /> : <TestTube2 size={11} />}
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => removeKey(idx)}
                            title="Remove this key"
                            className="aura-btn-ghost p-1.5 rounded-md text-[var(--aura-text-muted)] hover:text-red-400"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      );
                    };
                    return (
                      <div className="space-y-1.5">
                        {okKeys.map((idx) => renderKeyRow(idx, false))}
                        {okKeys.length > 0 && badKeys.length > 0 && (
                          <div className="my-2 h-px bg-[var(--aura-border,#454545)]/40" />
                        )}
                        {badKeys.map((idx) => renderKeyRow(idx, true))}
                      </div>
                    );
                  })()}
                </div>

                {/* Fetch models + Test selected models */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={fetching}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border border-[var(--aura-border,#454545)] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:border-[var(--aura-accent,#007acc)]/60 disabled:opacity-60 transition-all"
                  >
                    {fetching ? <Loader2 size={12} className="animate-spin" /> : <SearchCheck size={12} />}
                    <span>{fetching ? 'Fetching…' : 'Fetch Models'}</span>
                  </button>
                  {models.length > 0 && (
                    <button
                      type="button"
                      onClick={testingModels ? handleCancelTest : handleTestSelectedModels}
                      disabled={!testingModels && !models.some((m) => m.enabled)}
                      title={testingModels ? 'Click to cancel the current test' : undefined}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border transition-all ${
                        testingModels
                          ? 'border-red-500/40 text-red-400 hover:text-red-300 hover:border-red-500/70'
                          : 'border-[var(--aura-border,#454545)] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:border-[var(--aura-accent,#007acc)]/60 disabled:opacity-60'
                      }`}
                    >
                      {testingModels ? <X size={12} /> : <TestTube2 size={12} />}
                      <span>{testingModels ? `Cancel · ${testingProgress}/${testingTotal}` : 'Test Selected Models'}</span>
                    </button>
                  )}
                  {models.length > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--aura-text-muted)]">
                      <button onClick={() => toggleAll(true)} className="hover:text-[var(--aura-text)]">
                        Select all
                      </button>
                      <span>·</span>
                      <button onClick={() => toggleAll(false)} className="hover:text-[var(--aura-text)]">
                        Deselect all
                      </button>
                      <span className="text-[var(--aura-text)]">Selected {enabledCount}/{models.length}</span>
                    </div>
                  )}
                </div>

                {fetchError && (
                  <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-2.5 py-1.5">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <pre className="whitespace-pre-wrap font-mono text-[10px] leading-4">{fetchError}</pre>
                  </div>
                )}

                {models.length > 0 && (
                  <div
                    className="max-h-40 overflow-y-auto border rounded-md divide-y"
                    style={{ borderColor: 'var(--aura-border, #454545)' }}
                  >
                    {models.map((m) => {
                      const detail = modelTestResults[m.id];
                      const failed = detail?.status === 'fail';
                      const tested = detail?.status === 'ok';
                      const expanded = expandedModelId === m.id;
                      const errorText = detail?.error ?? '';
                      const bodyText = detail?.body ?? '';
                      const reason = `HTTP ${detail?.http ?? 0}${errorText ? ` · ${errorText}` : ''}${bodyText ? `\n${bodyText}` : ''}`;
                      return (
                        <div key={m.id}>
                          <div className="flex items-center gap-1 px-2 py-1.5">
                            <label
                              className={`flex items-center gap-2 flex-1 min-w-0 text-[11px] select-none ${
                                failed
                                  ? 'text-[var(--aura-text-muted)]/40 cursor-not-allowed'
                                  : 'text-[var(--aura-text)] hover:bg-white/5 cursor-pointer'
                              }`}
                              title={failed ? 'Model unavailable (test failed)' : tested ? 'Model available' : undefined}
                            >
                              <input
                                type="checkbox"
                                checked={m.enabled && !failed}
                                disabled={failed}
                                onChange={() => toggleModel(m.id)}
                                className="accent-[#007acc] disabled:opacity-40"
                              />
                              <span className="font-mono flex-1 truncate">{m.id}</span>
                              {tested && <Check size={11} className="text-emerald-400" />}
                            </label>
                            {failed && (
                              <button
                                type="button"
                                onClick={() => setExpandedModelId(expanded ? null : m.id)}
                                className="p-1 rounded hover:bg-white/5 text-amber-400/80 hover:text-amber-300 transition-colors"
                                title={expanded ? 'Hide failure details' : 'Show why this model failed'}
                                aria-label="Toggle failure details"
                              >
                                <TriangleAlert size={12} />
                              </button>
                            )}
                          </div>
                          {failed && expanded && (
                            <div
                              className="mx-2 mb-1.5 ml-7 rounded-md border px-2.5 py-2 text-[10px] leading-4"
                              style={{
                                borderColor: 'rgba(251, 191, 36, 0.25)',
                                background: 'rgba(251, 191, 36, 0.06)',
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-amber-300/90">
                                  HTTP {detail?.http ?? 0}
                                  {errorText ? ` · ${errorText}` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard?.writeText(reason)}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-white/5 transition-colors"
                                  title="Copy failure details"
                                >
                                  <Copy size={10} />
                                  Copy
                                </button>
                              </div>
                              {bodyText ? (
                                <pre className="mt-1.5 whitespace-pre-wrap break-all font-mono text-[10px] leading-4 text-[var(--aura-text-muted)]">
                                  {bodyText}
                                </pre>
                              ) : (
                                <div className="mt-1.5 text-[var(--aura-text-muted)]">
                                  No response body. Check the Base URL, API key, and network.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[var(--aura-text-muted)] mb-1">
                    Other Model IDs
                  </label>
                  <textarea
                    value={manualModels}
                    onChange={(e) => setManualModels(e.target.value)}
                    placeholder={"deepseek-v4.1-flash-free\ngpt-5.5-pro"}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    rows={2}
                    className="w-full border rounded-md px-2.5 py-1.5 text-[11px] font-mono outline-none resize-y"
                    style={inputStyle}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--aura-accent,#007acc)] text-white text-[11px] font-semibold hover:brightness-110 disabled:opacity-60 transition-all"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  <span>{saving ? 'Saving…' : 'Save'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{ borderColor: 'var(--aura-border, #333333)' }}
          className="flex items-center justify-end px-4 py-2.5 border-t"
        >
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md text-[10px] border border-[var(--aura-border,#454545)] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]"
          >
            Close
          </button>
        </div>

        {/* Full error message overlay (click to open / click outside to close) */}
        {pendingKeyError !== null && testResults[pendingKeyError] && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
            onClick={() => setPendingKeyError(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--aura-card-bg, #252526)',
                borderColor: 'var(--aura-border, #454545)',
              }}
              className="w-[520px] max-w-full border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
              <div
                style={{ borderColor: 'var(--aura-border, #333333)' }}
                className="flex items-center gap-2 px-4 py-3 border-b"
              >
                <TriangleAlert size={14} className="text-amber-400" />
                <span className="text-sm font-semibold text-[var(--aura-text,#cccccc)]">
                  Test result (key #{pendingKeyError + 1})
                </span>
                <button
                  type="button"
                  onClick={() => setPendingKeyError(null)}
                  className="ml-auto aura-btn-ghost p-1 rounded-md"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="px-4 py-4">
                <pre
                  className="text-[11px] text-[var(--aura-text,#e0e0e0)] bg-[var(--aura-input-bg,#1b1b1c)] border border-[var(--aura-border,#333333)] rounded-md px-3 py-2 font-mono whitespace-pre-wrap break-all max-h-56 overflow-y-auto"
                >
                  {testResults[pendingKeyError]}
                </pre>
              </div>
              <div
                style={{ borderColor: 'var(--aura-border, #333333)', backgroundColor: 'var(--aura-topbar-bg, #1f1f1f)' }}
                className="flex items-center justify-end gap-2 px-4 py-3 border-t"
              >
                <button
                  type="button"
                  onClick={() => setPendingKeyError(null)}
                  className="px-3 py-1.5 rounded-md border border-[var(--aura-border,#454545)] text-xs text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete provider confirm overlay */}
        {pendingDeleteId && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div
              style={{
                backgroundColor: 'var(--aura-card-bg, #252526)',
                borderColor: 'var(--aura-border, #454545)',
              }}
              className="w-[460px] border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
              <div
                style={{ borderColor: 'var(--aura-border, #333333)' }}
                className="flex items-center gap-2 px-4 py-3 border-b"
              >
                <Trash2 size={14} className="text-red-400" />
                <span className="text-sm font-semibold text-[var(--aura-text,#cccccc)]">
                  Delete provider「{pendingDeleteId}」
                </span>
              </div>
              <div className="px-4 py-4 space-y-3 text-xs text-[var(--aura-text,#cccccc)]">
                <p>
                  This removes the entry from opencode.json, clears every key in the local key pool, and erases all usage state.
                </p>
                <p className="text-red-400/80">This cannot be undone.</p>
              </div>
              <div
                style={{
                  borderColor: 'var(--aura-border, #333333)',
                  backgroundColor: 'var(--aura-topbar-bg, #1f1f1f)',
                }}
                className="flex items-center justify-end gap-2 px-4 py-3 border-t"
              >
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(null)}
                  className="px-3 py-1.5 rounded-md border border-[var(--aura-border,#454545)] text-xs text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete(pendingDeleteId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/80 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restart-opencode confirm overlay */}
        {showRestartConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div
              style={{
                backgroundColor: 'var(--aura-card-bg, #252526)',
                borderColor: 'var(--aura-border, #454545)',
              }}
              className="w-[460px] border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
              <div
                style={{ borderColor: 'var(--aura-border, #333333)' }}
                className="flex items-center gap-2 px-4 py-3 border-b"
              >
                <RotateCcw size={14} className="text-[var(--aura-accent,#007acc)]" />
                <span className="text-sm font-semibold text-[var(--aura-text,#cccccc)]">
                  Restart opencode to apply
                </span>
              </div>
              <div className="px-4 py-4 space-y-3 text-xs text-[var(--aura-text,#cccccc)]">
                <p>
                  Provider config saved to ~/.config/opencode/opencode.json (baseURL → local proxy :{proxyStatus.port}, apiKey=local-rotation). Restart opencode to apply.
                </p>
                {previewSessions.length > 0 ? (
                  <div
                    className="border rounded-lg px-3 py-2 space-y-1"
                    style={{ borderColor: 'var(--aura-border,#454545)' }}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[var(--aura-text-muted)]">
                     Closing {previewSessions.length} opencode process(es)
                    </div>
                    {previewSessions.slice(0, 4).map((s) => (
                      <div key={s.pid} className="flex items-center gap-2 text-[10px]">
                        <span className="font-mono text-[var(--aura-text-muted)] shrink-0">#{s.pid}</span>
                        <span className="font-mono truncate">{s.command}</span>
                      </div>
                    ))}
                    {previewSessions.length > 4 && (
                      <div className="text-[10px] text-[var(--aura-text-muted)]">…and {previewSessions.length - 4} more</div>
                    )}
                  </div>
                ) : (
                  <p className="text-[var(--aura-text-muted)]">
                    No running opencode processes found. Confirming will open a new opencode session with the config applied.
                  </p>
                )}
                {previewSessions.length > 0 && (
                  <p className="text-[10px] text-amber-400/80">Any unsaved session progress will be lost. Save your work first.</p>
                )}
              </div>
              <div
                style={{
                  borderColor: 'var(--aura-border, #333333)',
                  backgroundColor: 'var(--aura-topbar-bg, #1f1f1f)',
                }}
                className="flex items-center justify-end gap-2 px-4 py-3 border-t"
              >
                <button
                  type="button"
                  onClick={handleCancelRestart}
                  disabled={restarting}
                  className="px-3 py-1.5 rounded-md border border-[var(--aura-border,#454545)] text-xs text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestart}
                  disabled={restarting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--aura-accent,#007acc)] text-white text-xs font-semibold hover:brightness-110 disabled:opacity-60 transition-all"
                >
                  {restarting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  <span>{restarting ? 'Restarting…' : 'Restart'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProvidersModal;
