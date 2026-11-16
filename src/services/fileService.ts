import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FileItem, GitCommit, PluginManifest } from '../types';

export const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || Boolean((window as any).__TAURI_INTERNALS__));

export const mockFiles: FileItem[] = [
  {
    name: 'src',
    path: '/src',
    isDirectory: true,
    children: [
      { name: 'components', path: '/src/components', isDirectory: true, children: [
        { name: 'Editor.tsx', path: '/src/components/Editor.tsx', isDirectory: false },
        { name: 'Terminal.tsx', path: '/src/components/Terminal.tsx', isDirectory: false },
        { name: 'OpenCodeChat.tsx', path: '/src/components/OpenCodeChat.tsx', isDirectory: false },
      ]},
      { name: 'App.tsx', path: '/src/App.tsx', isDirectory: false, gitStatus: 'M' },
      { name: 'main.tsx', path: '/src/main.tsx', isDirectory: false },
      { name: 'index.css', path: '/src/index.css', isDirectory: false },
    ]
  },
  { name: 'package.json', path: '/package.json', isDirectory: false },
  { name: 'REQUIREMENTS.md', path: '/REQUIREMENTS.md', isDirectory: false, gitStatus: 'A' },
  { name: 'README.md', path: '/README.md', isDirectory: false },
];

export const mockCommits: GitCommit[] = [
  { hash: 'e4a1b2c', author: 'Yang', date: '2026-11-04', message: 'feat: refactor Aura IDE backend with Rust (portable-pty & tauri)' },
  { hash: 'c8f9021', author: 'Yang', date: '2026-11-03', message: 'docs: complete codingTree requirements specification' },
  { hash: '9b3d11a', author: 'Yang', date: '2026-11-02', message: 'feat(core): setup Monaco editor and OpenCode clean chat' },
];

export const defaultPlugins: PluginManifest[] = [
  {
    id: 'golang.go',
    name: 'Go',
    publisher: 'Go Team at Google',
    version: '0.44.0',
    description: 'Rich Go language support for Visual Studio Code and Aura IDE.',
    downloads: '19M',
    rating: 4.8,
    enabled: true,
    installed: true,
    category: 'Programming Languages',
  },
  {
    id: 'shd101wyy.markdown-preview-enhanced',
    name: 'Markdown Preview Enhanced',
    publisher: 'Yiyi Wang',
    version: '0.8.14',
    description: 'Markdown Preview Enhanced ported to vscode and Aura with KaTeX, Mermaid, PlantUML.',
    downloads: '5.6M',
    rating: 4.9,
    enabled: true,
    installed: true,
    category: 'Markdown',
  },
  {
    id: 'markmap',
    name: 'Markmap',
    publisher: 'Gerald Liu',
    version: '0.3.1',
    description: 'Visualize your markdown in VSCode as interactive mind maps.',
    downloads: '890K',
    rating: 4.8,
    enabled: true,
    installed: true,
    category: 'Markdown',
  },
  {
    id: 'sst.opencode',
    name: 'opencode',
    publisher: 'SST',
    version: '1.0.8',
    description: 'opencode for VS Code - autonomous agent pairing and rapid workflows.',
    downloads: '320K',
    rating: 5.0,
    enabled: true,
    installed: true,
    category: 'AI',
  },
  {
    id: 'vscodevim.vim',
    name: 'Vim',
    publisher: 'vscodevim',
    version: '1.28.1',
    description: 'Vim emulation for Visual Studio Code and Aura IDE.',
    downloads: '8.5M',
    rating: 4.6,
    enabled: true,
    installed: true,
    category: 'Keymaps',
  },
  {
    id: 'tomoki1207.pdf',
    name: 'vscode-pdf',
    publisher: 'tomoki1207',
    version: '1.2.2',
    description: 'Display pdf file in VSCode and Aura.',
    downloads: '2.8M',
    rating: 4.5,
    enabled: true,
    installed: true,
    category: 'Other',
  },
  {
    id: 'opencode-assistant',
    name: 'OpenCode Assistant',
    publisher: 'OhMyOpenCode',
    version: '2.5.0',
    description: 'Intelligent AI coding assistant with autonomous multi-agent orchestration.',
    downloads: '1.2M',
    rating: 5.0,
    enabled: true,
    installed: true,
    category: 'AI',
  },
  {
    id: 'ms-python.python',
    name: 'Python',
    publisher: 'Microsoft',
    version: '2026.1.0',
    description: 'IntelliSense, linting, debugging, code formatting and refactoring for Python.',
    downloads: '142M',
    rating: 4.8,
    enabled: false,
    installed: false,
    category: 'Programming Languages',
  },
  {
    id: 'esbenp.prettier-vscode',
    name: 'Prettier - Code formatter',
    publisher: 'Prettier',
    version: '10.4.0',
    description: 'Code formatter using prettier for JS, TS, HTML, CSS, JSON, Markdown.',
    downloads: '48M',
    rating: 4.9,
    enabled: false,
    installed: false,
    category: 'Formatters',
  },
  {
    id: 'dbaeumer.vscode-eslint',
    name: 'ESLint',
    publisher: 'Microsoft',
    version: '3.0.5',
    description: 'Integrates ESLint JavaScript into VS Code/Aura.',
    downloads: '39M',
    rating: 4.7,
    enabled: false,
    installed: false,
    category: 'Linters',
  },
  {
    id: 'rust-lang.rust-analyzer',
    name: 'rust-analyzer',
    publisher: 'Rust',
    version: '0.4.2100',
    description: 'Rust language support with full completion, diagnostics, and macro expansion.',
    downloads: '12M',
    rating: 4.9,
    enabled: false,
    installed: false,
    category: 'Programming Languages',
  },
  {
    id: 'eamodio.gitlens',
    name: 'GitLens — Git supercharged',
    publisher: 'GitKraken',
    version: '16.0.2',
    description: 'Supercharge Git with blame annotations, commit graphs, and branch comparison.',
    downloads: '35M',
    rating: 4.8,
    enabled: false,
    installed: false,
    category: 'SCM Providers',
  },
  {
    id: 'bradlc.vscode-tailwindcss',
    name: 'Tailwind CSS IntelliSense',
    publisher: 'Tailwind Labs',
    version: '0.14.3',
    description: 'Intelligent Tailwind CSS tooling with autocomplete, syntax highlighting, and linting.',
    downloads: '21M',
    rating: 4.9,
    enabled: false,
    installed: false,
    category: 'CSS',
  },
  {
    id: 'golang.go',
    name: 'Go',
    publisher: 'Go Team at Google',
    version: '0.44.0',
    description: 'Rich Go language support for Aura IDE.',
    downloads: '19M',
    rating: 4.7,
    enabled: false,
    installed: false,
    category: 'Programming Languages',
  },
  {
    id: 'ms-azuretools.vscode-docker',
    name: 'Docker',
    publisher: 'Microsoft',
    version: '1.29.0',
    description: 'Makes it easy to create, manage, and debug containerized applications.',
    downloads: '32M',
    rating: 4.8,
    enabled: false,
    installed: false,
    category: 'DevOps',
  },
  {
    id: 'github.copilot',
    name: 'GitHub Copilot',
    publisher: 'GitHub',
    version: '1.250.0',
    description: 'Your AI pair programmer directly in your editor.',
    downloads: '28M',
    rating: 4.6,
    enabled: false,
    installed: false,
    category: 'AI',
  },
  {
    id: 'pkief.material-icon-theme',
    name: 'Material Icon Theme',
    publisher: 'Philipp Kief',
    version: '5.2.0',
    description: 'Material Design Icons for Files and Folders in Aura.',
    downloads: '26M',
    rating: 4.9,
    enabled: false,
    installed: false,
    category: 'Themes',
  },
];

export async function searchOpenVsxMarketplace(query: string): Promise<PluginManifest[]> {
  if (!query || query.trim().length === 0) return [];
  try {
    const url = `https://open-vsx.org/api/-/search?query=${encodeURIComponent(query.trim())}&size=20`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.extensions)) return [];

    return data.extensions.map((ext: any) => {
      const id = `${ext.namespace}.${ext.name}`;
      const downloads = ext.downloadCount
        ? ext.downloadCount > 1000000
          ? `${(ext.downloadCount / 1000000).toFixed(1)}M`
          : ext.downloadCount > 1000
          ? `${(ext.downloadCount / 1000).toFixed(0)}K`
          : `${ext.downloadCount}`
        : '0';

      return {
        id,
        name: ext.displayName || ext.name,
        publisher: ext.namespace,
        version: ext.version || '1.0.0',
        description: ext.description || 'No description provided.',
        downloads,
        rating: ext.averageRating ? Number(ext.averageRating.toFixed(1)) : 5.0,
        enabled: false,
        installed: false,
        category: 'Marketplace',
        icon: ext.files?.icon || undefined,
      };
    });
  } catch (e) {
    console.error('[Open VSX Search Error]', e);
    return [];
  }
}

// Rust Backend File System Wrappers
export async function getDefaultWorkspace(): Promise<string> {
  if (isTauri) {
    try {
      return await invoke<string>('fs_get_default_workspace');
    } catch (e) {
      console.error('[Rust fs_get_default_workspace error]', e);
    }
  }
  return '';
}

export async function fetchDirectory(dirPath?: string): Promise<FileItem[]> {
  if (isTauri) {
    try {
      const res = await invoke<any[]>('fs_read_dir', { dirPath: dirPath || null });
      if (Array.isArray(res)) {
        return res.map(item => ({
          name: item.name,
          path: item.path,
          isDirectory: item.is_directory ?? item.isDirectory,
          gitStatus: item.git_status || item.gitStatus || undefined,
        }));
      }
    } catch (e) {
      console.error('[Rust fs_read_dir error]', e);
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const res = await (window as any).electronAPI.readDir(dirPath);
    if (res && !res.error && Array.isArray(res)) return res;
  }
  return mockFiles;
}

export async function fetchFileContent(filePath: string): Promise<string> {
  if (isTauri) {
    try {
      return await invoke<string>('fs_read_file', { filePath });
    } catch (e) {
      console.error('[Rust fs_read_file error]', e);
      return '';
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const res = await (window as any).electronAPI.readFile(filePath);
    if (res && !res.error && res.content !== undefined) return res.content;
  }
  return '';
}

export async function saveFileContent(filePath: string, content: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('fs_write_file', { filePath, content });
    } catch (e) {
      console.error('[Rust fs_write_file error]', e);
      return false;
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const res = await (window as any).electronAPI.writeFile(filePath, content);
    return !!res.success;
  }
  return true;
}

export async function promptOpenDirectory(currentPath?: string): Promise<string | null> {
  if (isTauri) {
    try {
      const selected = await invoke<string | null>('fs_pick_workspace');
      return selected || null;
    } catch (e) {
      console.error('[Rust fs_pick_workspace error]', e);
      return null;
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const selected = await (window as any).electronAPI.openDirectoryDialog(currentPath);
    return selected || null;
  }
  return null;
}

export async function watchWorkspaceFS(workspacePath: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('fs_watch_workspace', { workspacePath });
    } catch (e) {
      console.error('[Rust fs_watch_workspace error]', e);
      return false;
    }
  }
  return false;
}

export async function createFileSystemEntry(targetPath: string, isDirectory: boolean): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('fs_create_entry', { targetPath, isDirectory });
    } catch (e) {
      console.error('[Rust fs_create_entry error]', e);
      return false;
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const res = await (window as any).electronAPI.createEntry(targetPath, isDirectory);
    return !!res.success;
  }
  return true;
}

export async function deleteFileSystemEntry(targetPath: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('fs_delete_entry', { targetPath });
    } catch (e) {
      console.error('[Rust fs_delete_entry error]', e);
      return false;
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const res = await (window as any).electronAPI.deleteEntry(targetPath);
    return !!res.success;
  }
  return true;
}

export async function renameFileSystemEntry(oldPath: string, newPath: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('fs_rename_entry', { oldPath, newPath });
    } catch (e) {
      console.error('[Rust fs_rename_entry error]', e);
      return false;
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const res = await (window as any).electronAPI.renameEntry(oldPath, newPath);
    return !!res.success;
  }
  return true;
}

export async function fetchCurrentBranch(repoPath?: string): Promise<string> {
  if (isTauri) {
    try {
      const branch = await invoke<string>('git_get_current_branch', { workspace: repoPath || null });
      return branch || '';
    } catch (e) {
      console.error('[Rust git_get_current_branch error]', e);
    }
  }
  return '';
}

export async function fetchGitStatus(repoPath?: string): Promise<{ totalChanged: number; files: FileItem[] }> {
  if (isTauri) {
    try {
      const res = await invoke<{ total_changed: number; files: any[] }>('git_get_status', { workspace: repoPath || null });
      if (res && Array.isArray(res.files)) {
        return {
          totalChanged: res.total_changed,
          files: res.files.map((item) => ({
            name: item.name,
            path: item.path,
            isDirectory: item.is_directory ?? false,
            gitStatus: item.git_status || undefined,
          })),
        };
      }
    } catch (e) {
      console.error('[Rust git_get_status error]', e);
    }
  }
  return { totalChanged: 0, files: [] };
}

export async function fetchGitCommits(repoPath?: string): Promise<GitCommit[]> {
  if (isTauri) {
    try {
      const res = await invoke<any[]>('git_get_commits', { workspace: repoPath || null });
      if (Array.isArray(res)) return res;
    } catch (e) {
      console.error('[Rust git_get_commits error]', e);
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const commits = await (window as any).electronAPI.gitGetHistory(repoPath);
    if (commits && commits.length > 0) return commits;
  }
  return mockCommits;
}

export async function fetchCommitChangedFiles(hash: string, repoPath?: string): Promise<{ path: string; status: string }[]> {
  if (isTauri) {
    try {
      const res = await invoke<any[]>('git_get_commit_files', { workspace: repoPath || null, hash });
      if (Array.isArray(res)) return res;
    } catch (e) {
      console.error('[Rust git_get_commit_files error]', e);
    }
  }
  return [];
}

export async function fetchGitHeadContent(filePath: string, repoPath?: string): Promise<string> {
  if (isTauri) {
    try {
      return await invoke<string>('git_get_head_content', {
        workspace: repoPath || null,
        filePath,
      });
    } catch (e) {
      console.error('[Rust git_get_head_content error]', e);
    }
  }
  return '';
}

export async function fetchCommitFileDiff(hash: string, filePath: string, repoPath?: string): Promise<{ original: string; modified: string }> {
  if (isTauri) {
    try {
      const res = await invoke<{ original: string; modified: string }>('git_get_file_diff', {
        workspace: repoPath || null,
        hash,
        filePath,
      });
      if (res) return res;
    } catch (e) {
      console.error('[Rust git_get_file_diff error]', e);
    }
  }
  return { original: '', modified: '' };
}

export async function executeGitCommit(message: string, repoPath?: string): Promise<string> {
  if (isTauri) {
    return await invoke<string>('git_commit', {
      workspace: repoPath || null,
      message,
    });
  }
  return 'Mock commit successful';
}

export async function executeGitPush(repoPath?: string): Promise<string> {
  if (isTauri) {
    return await invoke<string>('git_push', {
      workspace: repoPath || null,
    });
  }
  return 'Mock push successful';
}

// System AI Agent Detection
export interface DetectedAgent {
  id: string;
  name: string;
  command: string;
  description: string;
  category: string;
  is_installed: boolean;
  install_command: string;
  path?: string | null;
  /** true when the agent exposes ACP (Agent Client Protocol) */
  acp?: boolean;
}

export async function detectSystemAgents(): Promise<DetectedAgent[]> {
  if (isTauri) {
    try {
      return await invoke<DetectedAgent[]>('system_detect_agents');
    } catch (e) {
      console.error('[detectSystemAgents error]', e);
    }
  }
  return [
    {
      id: 'opencode',
      name: 'opencode',
      command: 'opencode',
      description: 'OpenCode CLI autonomous coding agent',
      category: 'coding',
      is_installed: true,
      install_command: 'npm install -g @opencode/cli || brew install opencode',
      path: '/opt/homebrew/bin/opencode',
      acp: true,
    },
    {
      id: 'agy',
      name: 'agy cli',
      command: 'agy',
      description: 'Google Antigravity CLI — native binary (terminal mode)',
      category: 'research',
      is_installed: true,
      install_command: 'npm install -g @google/antigravity-cli',
      path: '/Users/Yang/.local/bin/agy',
      acp: false,
    },
    {
      id: 'agy-acp',
      name: 'agy acp',
      command: 'agy',
      description: 'Antigravity ACP — Agent Client Protocol (JSON-RPC over stdio)',
      category: 'coding',
      is_installed: true,
      install_command: 'npm install -g @google/antigravity-cli',
      path: '/Users/Yang/.local/bin/agy',
      acp: true,
    },
    {
      id: 'codex',
      name: 'codex',
      command: 'codex',
      description: 'OpenAI Codex CLI developer terminal assistant',
      category: 'terminal',
      is_installed: true,
      install_command: 'npm install -g @openai/codex',
      path: '/opt/homebrew/bin/codex',
      acp: true,
    },
    {
      id: 'claude',
      name: 'claude',
      command: 'claude',
      description: 'Anthropic Claude Code command line agent',
      category: 'coding',
      is_installed: true,
      install_command: 'npm install -g @anthropic-ai/claude-code',
      path: '/Users/Yang/.local/bin/claude',
      acp: true,
    },
  ];
}

export async function registerCustomAgent(name: string, rawPath: string): Promise<DetectedAgent | null> {
  if (isTauri) {
    try {
      return await invoke<DetectedAgent>('system_register_custom_agent', { name, rawPath });
    } catch (e) {
      console.error('[registerCustomAgent error]', e);
      throw e;
    }
  }
  return {
    id: `custom-${Date.now()}`,
    name,
    command: rawPath,
    description: `Custom Agent: ${name}`,
    category: 'custom',
    is_installed: true,
    install_command: '',
    path: rawPath,
  };
}

// ----------------- ACP (Agent Client Protocol) Wrappers -----------------

export interface AcpSessionInfo {
  id: string;
  agent_id: string;
  name: string;
  command: string;
  args: string[];
  cwd: string;
  state: 'initializing' | 'active' | 'error' | 'terminated';
}

export interface AcpMessage {
  type: 'message' | 'stderr' | 'error' | 'terminated';
  data: any;
}

export interface AcpCapabilities {
  fs: boolean;
  terminal: boolean;
  permission: boolean;
  modes: string[];
  authMethods: any[];
}

export interface AcpAgentInfo {
  name: string;
  protocolVersion: string;
  capabilities: AcpCapabilities;
}

/** ACP agent definition as stored in ~/.config/aura/aura.json */
export interface AcpAgentDef {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled?: boolean;
}

/** Built-in defaults — used as seed for a fresh aura.json and as the pre-fetch cache */
export const BUILTIN_ACP_AGENTS: AcpAgentDef[] = [
  { id: 'agy-acp',    name: 'agy acp',      command: 'agy',          args: ['acp'] },
  { id: 'opencode',   name: 'opencode acp', command: 'opencode',     args: ['acp'] },
  { id: 'gemini',     name: 'gemini acp',   command: 'gemini',       args: ['--acp'] },
  { id: 'claude',     name: 'claude acp',   command: 'npx',          args: ['@agentclientprotocol/claude-agent-acp'] },
  { id: 'codex',      name: 'codex acp',    command: 'npx',          args: ['@agentclientprotocol/codex-acp'] },
  { id: 'kimi',       name: 'kimi acp',     command: 'kimi',         args: ['acp'] },
  { id: 'qwen',       name: 'qwen acp',     command: 'qwen',         args: ['--acp'] },
  { id: 'cline',      name: 'cline acp',    command: 'cline',        args: ['--acp'] },
  { id: 'goose',      name: 'goose acp',    command: 'goose',        args: ['acp'] },
  { id: 'cursor-agent', name: 'cursor-agent acp', command: 'cursor-agent', args: ['acp'] },
  { id: 'copilot',    name: 'copilot acp',  command: 'copilot',      args: ['--acp'] },
  { id: 'auggie',     name: 'auggie acp',   command: 'npx',          args: ['@augmentcode/auggie', '--acp'] },
  { id: 'kilo',       name: 'kilo acp',     command: 'npx',          args: ['@kilocode/cli', 'acp'] },
  { id: 'pi',         name: 'pi acp',       command: 'npx',          args: ['pi-acp'] },
  { id: 'vtcode',     name: 'vtcode acp',   command: 'vtcode',       args: ['acp'] },
  { id: 'stakpak',    name: 'stakpak acp',  command: 'stakpak',      args: ['acp'] },
  { id: 'fast-agent', name: 'fast-agent acp', command: 'uvx',        args: ['fast-agent-acp'] },
  { id: 'devin',      name: 'devin acp',    command: 'devin',        args: ['acp'] },
  { id: 'grok',       name: 'grok acp',     command: 'grok',         args: ['agent', 'stdio'] },
];

/** In-memory mirror of ~/.config/aura/aura.json agents.acp (seeded with built-ins) */
let acpAgentsCache: AcpAgentDef[] = [...BUILTIN_ACP_AGENTS];

/** Replace the in-memory ACP registry (called after fetching/saving or local edits) */
export function setAcpAgentsCache(agents: AcpAgentDef[]) {
  acpAgentsCache = agents;
}

/** Read the ACP agents from ~/.config/aura/aura.json via the Rust backend */
export async function fetchAcpAgents(): Promise<AcpAgentDef[]> {
  if (isTauri) {
    try {
      const agents = await invoke<AcpAgentDef[]>('config_read_acp_agents');
      if (Array.isArray(agents)) {
        setAcpAgentsCache(agents);
        return agents;
      }
    } catch (e) {
      console.error('[fetchAcpAgents error]', e);
    }
  }
  setAcpAgentsCache([...BUILTIN_ACP_AGENTS]);
  return [...BUILTIN_ACP_AGENTS];
}

/** Persist the ACP agents list back to ~/.config/aura/aura.json */
export async function saveAcpAgents(agents: AcpAgentDef[]): Promise<boolean> {
  if (isTauri) {
    try {
      const ok = await invoke<boolean>('config_write_acp_agents', { agents });
      if (ok) setAcpAgentsCache(agents);
      return !!ok;
    } catch (e) {
      console.error('[saveAcpAgents error]', e);
      return false;
    }
  }
  setAcpAgentsCache(agents);
  return true;
}

/** Check if an agent id is configured as an ACP agent (config-driven) */
export function isAcpAgent(agentId: string): boolean {
  return acpAgentsCache.some((a) => a.id === agentId && a.enabled !== false);
}

// ----------------- ACP conversation tracking (local-only, per agent) -----------------

const ACP_CONVERSATIONS_KEY = 'aura:acpConversations';
const MAX_TRACKED_ACP_CONVERSATIONS = 200;

export interface AcpConversationRecord {
  id: string;
  agentId: string;   // ACP agent id as configured, e.g. 'agy-acp', 'opencode', 'claude-acp'
  createdAt: number; // ms epoch (0 = migrated from the legacy flat string[] format)
}

/** Read the tracked ACP conversation records (auto-migrates the legacy string[] shape) */
function readAcpRecords(): AcpConversationRecord[] {
  try {
    const raw = localStorage.getItem(ACP_CONVERSATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): AcpConversationRecord =>
        typeof item === 'string'
          ? { id: item, agentId: 'agy-acp', createdAt: 0 }
          : {
              id: String(item?.id ?? ''),
              agentId: String(item?.agentId ?? 'agy-acp'),
              createdAt: Number(item?.createdAt ?? 0),
            }
      )
      .filter((r) => r.id);
  } catch {
    return [];
  }
}

/** Normalize an agent id to a family key (e.g. 'agy-acp' -> 'agy') */
function agentFamily(agentId: string): string {
  return agentId.toLowerCase().replace(/-acp$/, '');
}

/** Record a conversation id as created via the given ACP agent */
export function trackAcpConversation(id: string, agentId: string): void {
  if (!id) return;
  try {
    const records = readAcpRecords();
    const idx = records.findIndex((r) => r.id === id);
    if (idx >= 0) {
      records[idx] = { ...records[idx], agentId };
    } else {
      records.unshift({ id, agentId, createdAt: Date.now() });
    }
    if (records.length > MAX_TRACKED_ACP_CONVERSATIONS) {
      records.length = MAX_TRACKED_ACP_CONVERSATIONS;
    }
    localStorage.setItem(ACP_CONVERSATIONS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('[trackAcpConversation error]', e);
  }
  if (isTauri) {
    invoke<any>('system_track_acp_session', { sessionId: id, agentId }).catch((e) => {
      console.error('[system_track_acp_session error]', e);
    });
  }
}

/** Ids of conversations created via ACP; pass a family key ('agy'|'opencode'|'claude'|'codex'|'gemini') to filter */
export function getAcpConversations(agentId?: string): Set<string> {
  const records = readAcpRecords();
  if (!agentId) return new Set(records.map((r) => r.id));
  const family = agentFamily(agentId);
  return new Set(records.filter((r) => agentFamily(r.agentId) === family).map((r) => r.id));
}

/** The ACP agent that owns this conversation id, or null if Aura has no mapping */
export function getAcpConversationAgent(id: string): string | null {
  const found = readAcpRecords().find((r) => r.id === id);
  return found ? found.agentId : null;
}

/** Remove a conversation id from the local ACP tracking map */
export function untrackAcpConversation(id: string): void {
  try {
    const records = readAcpRecords().filter((r) => r.id !== id);
    localStorage.setItem(ACP_CONVERSATIONS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('[untrackAcpConversation error]', e);
  }
  if (isTauri) {
    invoke<any>('system_untrack_acp_session', { sessionId: id }).catch((e) => {
      console.error('[system_untrack_acp_session error]', e);
    });
  }
}

/** Read ACP-tracked session IDs from ~/.gemini/antigravity-cli/.aura-acp-sessions.json (survives WebKit cache wipes) */
export async function fetchAcpTrackedSessions(): Promise<string[]> {
  if (!isTauri) return [];
  try {
    const res = await invoke<{ ids: string[] }>('system_get_acp_tracked_sessions');
    return Array.isArray(res?.ids) ? res.ids.map(String) : [];
  } catch (e) {
    console.error('[fetchAcpTrackedSessions error]', e);
    return [];
  }
}

export interface MemorySaveResult {
  memoPath: string;
  created: boolean;
  everos: { enabled: boolean; ok: boolean; taskId?: string | null; error?: string | null };
}

/** /save 的落盘 + EverOS 同步（Rust 侧：本地 markdown memo + curl 子进程 POST EverOS） */
export async function memorySave(args: {
  sessionId: string;
  agentId: string;
  agentSessionId?: string | null;
  title: string;
  workspace: string;
  body: string;
}): Promise<MemorySaveResult> {
  if (!isTauri) {
    throw new Error('Tauri backend required for /save');
  }
  return await invoke<MemorySaveResult>('memory_save', args);
}

export interface MemoryMemoDeleteResult {
  deleted: string[];
  count: number;
}

/** 会话删除时同步清理该会话产出的 /save memo 文件（EverOS 记忆云端不可删除，仅删本地） */
export async function memoryDeleteMemo(sessionId: string): Promise<MemoryMemoDeleteResult> {
  if (!isTauri) {
    return { deleted: [], count: 0 };
  }
  return await invoke<MemoryMemoDeleteResult>('memory_delete_memo', { sessionId });
}

export async function acpStart(sessionId: string, agentId: string, cwd?: string, resumeAgentSessionId?: string): Promise<AcpAgentInfo> {
  if (!isAcpAgent(agentId)) {
    throw new Error(`ACP agent not supported: ${agentId}. Configure it in ~/.config/aura/aura.json (agents.acp) or use a built-in ACP agent.`);
  }
  if (isTauri) {
    try {
      const info = await invoke<AcpAgentInfo>('acp_initialize', { sessionId, agentId, cwd: cwd ?? null, resumeSessionId: resumeAgentSessionId ?? null });
      return info;
    } catch (e) {
      console.error('[acpStart error]', e);
      throw e;
    }
  }
  throw new Error('Tauri backend required for ACP');
}

export async function acpStop(sessionId: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('acp_stop', { sessionId });
    } catch (e) {
      console.error('[acpStop error]', e);
      return false;
    }
  }
  return false;
}

export interface AcpPromptImagePayload {
  data: string;      // base64（不含 data: 前缀）
  mimeType: string;  // 例如 "image/png"
}

export async function acpSendPrompt(sessionId: string, message: string, images?: AcpPromptImagePayload[]): Promise<boolean> {
  if (isTauri) {
    try {
      // Tauri 将 camelCase 键反序列化为 Rust 侧 snake_case 参数 images: Vec<AcpPromptImage>
      return await invoke<boolean>('acp_send_prompt', {
        sessionId,
        message,
        images: images?.map((img) => ({ data: img.data, mimeType: img.mimeType })),
      });
    } catch (e) {
      console.error('[acpSendPrompt error]', e);
      return false;
    }
  }
  return false;
}

export async function listenToAcpSession(sessionId: string, callback: (msg: AcpMessage) => void): Promise<() => void> {
  if (isTauri) {
    const unlistenMessage = await listen<AcpMessage>(`acp:session:${sessionId}`, (event) => {
      try {
        callback(event.payload);
      } catch (e) {
        console.error('[acp message callback error]', e);
      }
    });
    const unlistenStderr = await listen<AcpMessage>(`acp:session:${sessionId}:stderr`, (event) => {
      try {
        callback(event.payload);
      } catch (e) {
        console.error('[acp stderr callback error]', e);
      }
    });
    return () => {
      unlistenMessage();
      unlistenStderr();
    };
  }
  return () => {};
}

export async function acpCancel(sessionId: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('acp_cancel', { sessionId });
    } catch (e) {
      console.error('[acpCancel error]', e);
      return false;
    }
  }
  return false;
}

export async function acpSetConfigOption(sessionId: string, configId: string, value: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('acp_set_config_option', { sessionId, configId, value });
    } catch (e) {
      console.error('[acpSetConfigOption error]', e);
      return false;
    }
  }
  return false;
}

// Rust Backend Terminal PTY Wrappers
export async function createTerminalPTY(
  id: string,
  cols: number,
  rows: number,
  cwd?: string,
  mode?: string
): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('terminal_create', { id, cols, rows, cwd: cwd || null, mode: mode || null });
    } catch (e) {
      console.error('[Rust terminal_create error]', e);
      return false;
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    await (window as any).electronAPI.createTerminal({ id, cols, rows, cwd, mode });
    return true;
  }
  return false;
}

export function writeTerminalPTY(id: string, data: string): void {
  if (isTauri) {
    invoke('terminal_write', { id, data }).catch(e => console.error('[Rust terminal_write error]', e));
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    (window as any).electronAPI.writeTerminal(id, data);
  }
}

export function resizeTerminalPTY(id: string, cols: number, rows: number): void {
  if (isTauri) {
    invoke('terminal_resize', { id, cols, rows }).catch(e => console.error('[Rust terminal_resize error]', e));
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    (window as any).electronAPI.resizeTerminal(id, cols, rows);
  }
}

export function killTerminalPTY(id: string): void {
  if (isTauri) {
    invoke('terminal_kill', { id }).catch(e => console.error('[Rust terminal_kill error]', e));
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    (window as any).electronAPI.killTerminal(id);
  }
}

export async function startTerminalReading(id: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('terminal_ready', { id });
    } catch (e) {
      console.error('[Rust terminal_ready error]', e);
      return false;
    }
  }
  return false;
}

export async function onTerminalData(id: string, callback: (data: string) => void): Promise<() => void> {
  if (isTauri) {
    const unlisten = await listen<string>(`terminal:data:${id}`, (event) => {
      callback(event.payload);
    });
    return () => unlisten();
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    (window as any).electronAPI.onTerminalData(id, callback);
    return () => {};
  }
  return () => {};
}

export async function startWindowDragging(): Promise<void> {
  if (isTauri) {
    try {
      await invoke('window_start_dragging');
      return;
    } catch (e) {
      console.warn('invoke window_start_dragging failed, trying api startDragging()', e);
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      getCurrentWindow().startDragging();
    } catch (e) {
      console.error('startDragging failed', e);
    }
  }
}

export async function exitApp(): Promise<void> {
  if (isTauri) {
    try {
      await invoke('app_exit');
      return;
    } catch (e) {
      console.error('app_exit invoke failed, falling back to window.close()', e);
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      getCurrentWindow().close();
    } catch (e) {
      console.error('window.close() failed', e);
    }
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    (window as any).electronAPI.quitApp?.();
  }
}

export async function onTerminalExit(id: string, callback: () => void): Promise<() => void> {
  if (isTauri) {
    const unlisten = await listen<void>(`terminal:exit:${id}`, () => {
      callback();
    });
    return () => unlisten();
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    (window as any).electronAPI.onTerminalExit(id, callback);
    return () => {};
  }
  return () => {};
}

export interface ProjectAgentSession {
  id: string;
  title: string;
  agent_name: string;
  agent_command: string;
  agent_id: string;
  created_at?: number | null;
  project_path?: string | null;
  project_name?: string | null;
}

export async function fetchProjectAgentSessions(workspaceDir: string): Promise<ProjectAgentSession[]> {
  if (isTauri) {
    try {
      return await invoke<ProjectAgentSession[]>('system_fetch_project_agent_sessions', { workspaceDir });
    } catch (e) {
      console.error('[Rust system_fetch_project_agent_sessions error]', e);
      return [];
    }
  }
  return [];
}

export async function updateProjectAgentSessionTitle(workspaceDir: string, sessionId: string, newTitle: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('system_update_project_agent_session_title', {
        workspaceDir,
        sessionId,
        newTitle,
      });
    } catch (e) {
      console.error('[Rust system_update_project_agent_session_title error]', e);
      return false;
    }
  }
  return false;
}

export async function deleteProjectAgentSession(workspaceDir: string, sessionId: string, agentHint?: string | null): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('system_delete_project_agent_session', {
        workspaceDir,
        sessionId,
        agentHint: agentHint ?? null,
      });
    } catch (e) {
      console.error('[Rust system_delete_project_agent_session error]', e);
      return false;
    }
  }
  return false;
}

// ----------------- OpenCode provider 管理（~/.config/opencode/opencode.json providers 段） -----------------

export type OpencodeProviderMap = Record<string, any>;

/** 读取 opencode.json 的 providers 段（桌面端原子写入） */
export async function fetchOpencodeProviders(): Promise<OpencodeProviderMap> {
  if (!isTauri) return {};
  try {
    const res = await invoke<{ providers: OpencodeProviderMap; legacyProvider?: OpencodeProviderMap }>(
      'system_get_opencode_providers'
    );
    return res?.providers ?? {};
  } catch (e) {
    console.error('[fetchOpencodeProviders error]', e);
    return {};
  }
}

/** 插入/覆盖一个 provider（不保留调用方 JSON 里的其他字段以外的 opencode.json 顶层键都会原样保留） */
export async function upsertOpencodeProvider(id: string, provider: any): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke('system_upsert_opencode_provider', { providerId: id, provider });
    return true;
  } catch (e) {
    console.error('[upsertOpencodeProvider error]', e);
    return false;
  }
}

/** 从 opencode.json 删除一个 provider 键 */
export async function deleteOpencodeProvider(id: string): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke('system_delete_opencode_provider', { providerId: id });
    return true;
  } catch (e) {
    console.error('[deleteOpencodeProvider error]', e);
    return false;
  }
}

export type OpencodeProviderProtocol = 'openai' | 'anthropic' | 'google';

export interface FetchModelsResult {
  models: string[];
  error?: string;
}

/** 抓取某个 provider 的模型列表（curl 子进程，按 protocol 处理鉴权头） */
export async function fetchOpencodeModels(
  baseUrl: string,
  apiKey: string,
  protocol: OpencodeProviderProtocol
): Promise<FetchModelsResult> {
  if (!isTauri) return { models: [], error: 'Not available outside Tauri' };
  try {
    const res = await invoke<{ models: string[] }>('system_fetch_opencode_models', {
      baseUrl,
      apiKey,
      protocol,
    });
    return { models: Array.isArray(res?.models) ? res.models : [] };
  } catch (e: any) {
    return { models: [], error: String(e?.message ?? e) };
  }
}

// ----------------- opencode 进程退出 / 重启 -----------------

export interface OpencodeSessionInfo {
  pid: number;
  command: string;
}

/** 列出将被"确认重启"影响到的 opencode 进程（仅 argv0 恰好为 opencode 的，排除本进程链）*/
export async function previewOpencodeSessions(): Promise<OpencodeSessionInfo[]> {
  if (!isTauri) return [];
  try {
    const res = await invoke<{ sessions: OpencodeSessionInfo[] }>('system_preview_opencode_sessions');
    return Array.isArray(res?.sessions) ? res.sessions : [];
  } catch (e) {
    console.error('[previewOpencodeSessions error]', e);
    return [];
  }
}

/** SIGTERM 所有匹配的 opencode 进程（超时后 SIGKILL），返回关闭数量 */
export async function restartOpencode(): Promise<{ killed: number }> {
  if (!isTauri) return { killed: 0 };
  try {
    const res = await invoke<{ killed: number }>('system_restart_opencode');
    return { killed: res?.killed ?? 0 };
  } catch (e) {
    console.error('[restartOpencode error]', e);
    return { killed: 0 };
  }
}

// ----------------- opencode 本地代理（端口 2618，key 轮询 + 健康检测） -----------------

export interface OpencodeProxyKeyStatus {
  index: number;
  enabled: boolean;
  requests: number;
  failures: number;
  lastError?: string | null;
}

export interface OpencodeProxyProviderStatus {
  protocol: string;
  upstream: string;
  enabled: boolean;
  note?: string | null;
  targets?: Record<string, boolean>;
  enabledKeys: number;
  totalKeys: number;
  cursor: number;
  keys: OpencodeProxyKeyStatus[];
}

export interface OpencodeProxyStatus {
  ok: boolean;
  port: number;
  providers: Record<string, OpencodeProxyProviderStatus>;
}

export async function fetchOpencodeProxyStatus(): Promise<OpencodeProxyStatus> {
  if (!isTauri) return { ok: true, port: 2618, providers: {} };
  try {
    return await invoke<OpencodeProxyStatus>('system_opencode_proxy_status');
  } catch (e) {
    console.error('[fetchOpencodeProxyStatus error]', e);
    return { ok: true, port: 2618, providers: {} };
  }
}

/** 重启代理监听新端口并把所有已启用 provider 的 baseURL 指向新端口 */
export async function reloadOpencodeProxyPort(port: number): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke('system_opencode_reload_port', { port });
    return true;
  } catch (e) {
    console.error('[reloadOpencodeProxyPort error]', e);
    return false;
  }
}

/** 切换 provider 的 on/off：off 时从 opencode.json 移除条目；on 时重新注入代理条目 */
export async function setOpencodeProviderEnabled(id: string, enabled: boolean): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke('system_opencode_set_provider_enabled', { providerId: id, enabled });
    return true;
  } catch (e) {
    console.error('[setOpencodeProviderEnabled error]', e);
    return false;
  }
}

/** 手动标记/恢复某个 key 的轮询资格 */
export async function setOpencodeKeyEnabled(id: string, keyIndex: number, enabled: boolean): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke('system_opencode_set_key_enabled', { providerId: id, keyIndex, enabled });
    return true;
  } catch (e) {
    console.error('[setOpencodeKeyEnabled error]', e);
    return false;
  }
}

export interface KeyTestResult {
  ok: boolean;
  http: number;
  models?: number;
  error?: string | null;
}

/** 用指定 key 测上游 /models（走代理 /_proxy/test） */
export async function testOpencodeKey(id: string, keyIndex: number): Promise<KeyTestResult> {
  if (!isTauri) return { ok: false, http: 0, error: 'Not Tauri' };
  try {
    return await invoke<KeyTestResult>('system_opencode_test_key', { providerId: id, keyIndex });
  } catch (e: any) {
    return { ok: false, http: 0, error: String(e?.message ?? e) };
  }
}

/** 保存某个 provider 的 key 池（整体替换；≥2 key 触发 round-robin；note 为 aura 内部备注） */
export async function upsertOpencodeProviderPool(
  id: string,
  protocol: OpencodeProviderProtocol,
  upstream: string,
  keys: string[],
  enabled: boolean,
  note?: string
): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke('system_opencode_upsert_provider_pool', {
      providerId: id,
      protocol,
      upstream,
      keys,
      enabled,
      note: note?.trim() ? note.trim() : null,
    });
    return true;
  } catch (e) {
    console.error('[upsertOpencodeProviderPool error]', e);
    return false;
  }
}

/** 删除 provider 的 key 池（同时从 opencode.json 删除该 provider） */
export async function deleteOpencodeProviderPool(id: string): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke('system_opencode_delete_provider_pool', { providerId: id });
    return true;
  } catch (e) {
    console.error('[deleteOpencodeProviderPool error]', e);
    return false;
  }
}

// ----------------- opencode 本地代理全局 on/off -----------------

export interface OpencodeProxyGlobalInfo {
  enabled: boolean;
  port: number;
}

/** 读取代理全局开关状态（默认 enabled=true, port=2618） */
export async function fetchOpencodeProxyGlobal(): Promise<OpencodeProxyGlobalInfo> {
  if (!isTauri) return { enabled: true, port: 2618 };
  try {
    return await invoke<OpencodeProxyGlobalInfo>('system_opencode_proxy_global_get');
  } catch (e) {
    console.error('[fetchOpencodeProxyGlobal error]', e);
    return { enabled: true, port: 2618 };
  }
}

/** 全局开关：
 *  on → 把 aura pool / 备份还原写入 opencode.json，并把 baseURL 改写为本地代理
 *  off → 备份当前 opencode.json providers，然后清空，opencode 重启后无任何 provider 走代理 */
export async function setOpencodeProxyGlobal(enabled: boolean): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke('system_opencode_proxy_global_set', { enabled });
    return true;
  } catch (e) {
    console.error('[setOpencodeProxyGlobal error]', e);
    return false;
  }
}

/** 获取某个 provider 的全部 key（用于编辑回填） */
export async function fetchOpencodeProviderKeys(id: string): Promise<string[]> {
  if (!isTauri) return [];
  try {
    const res = await invoke<{ keys: string[] }>('system_opencode_get_provider_keys', { providerId: id });
    return Array.isArray(res?.keys) ? res.keys : [];
  } catch (e) {
    console.error('[fetchOpencodeProviderKeys error]', e);
    return [];
  }
}

/** 用 Rust(curl) 对指定 provider 的 model 做一次 /chat/completions 探测 */
export interface ChatProbeResult {
  ok: boolean;
  http: number;
  preview?: string;
  body?: string;
  error?: string;
}

export async function probeOpencodeModel(providerId: string, modelId: string): Promise<ChatProbeResult> {
  if (!isTauri) return { ok: false, http: 0, error: 'Not Tauri' };
  try {
    return await invoke<ChatProbeResult>('system_opencode_chat_probe', { providerId, modelId });
  } catch (e: any) {
    return { ok: false, http: 0, error: String(e?.message ?? e) };
  }
}

/** Phase 2: 把某个 provider 注入/移除指定 agent CLI 的配置（claude → settings.json env；codex → config.toml） */
export async function setOpencodeProviderTarget(
  providerId: string,
  agent: string,
  enabled: boolean
): Promise<{ ok: boolean; enabled?: boolean; message?: string; error?: string }> {
  if (!isTauri) return { ok: false, error: 'Not Tauri' };
  try {
    return await invoke('system_opencode_set_provider_target', { providerId, agent, enabled });
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

/** 用给定的协议/baseURL/key 直接探测一次 model；不需要对方 provider 已保存到 aura pool */
export async function probeOpencodeModelWithCreds(
  protocol: string,
  upstream: string,
  apiKey: string,
  modelId: string
): Promise<ChatProbeResult> {
  if (!isTauri) return { ok: false, http: 0, error: 'Not Tauri' };
  try {
    return await invoke<ChatProbeResult>('system_opencode_probe_model_with_creds', {
      protocol,
      upstream,
      apiKey,
      modelId,
    });
  } catch (e: any) {
    return { ok: false, http: 0, error: String(e?.message ?? e) };
  }
}
