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
      name: 'OpenCode Agent',
      command: 'opencode',
      description: 'OpenCode CLI autonomous coding agent',
      category: 'coding',
      is_installed: true,
      install_command: 'npm install -g @opencode/cli || brew install opencode',
      path: '/opt/homebrew/bin/opencode',
    },
    {
      id: 'agy',
      name: 'Antigravity Agent (AGY)',
      command: 'agy',
      description: 'Google Antigravity CLI advanced agentic coding',
      category: 'research',
      is_installed: true,
      install_command: 'npm install -g @google/antigravity-cli',
      path: '/Users/Yang/.local/bin/agy',
    },
    {
      id: 'codex',
      name: 'Codex Agent',
      command: 'codex',
      description: 'OpenAI Codex CLI developer terminal assistant',
      category: 'terminal',
      is_installed: true,
      install_command: 'npm install -g @openai/codex',
      path: '/opt/homebrew/bin/codex',
    },
    {
      id: 'claude',
      name: 'Claude Code',
      command: 'claude',
      description: 'Anthropic Claude Code command line agent',
      category: 'coding',
      is_installed: true,
      install_command: 'npm install -g @anthropic-ai/claude-code',
      path: '/Users/Yang/.local/bin/claude',
    },
  ];
}

export interface ScannedBinItem {
  name: string;
  path: string;
  is_executable: boolean;
}

export async function scanLocalBin(): Promise<ScannedBinItem[]> {
  if (isTauri) {
    try {
      return await invoke<ScannedBinItem[]>('system_scan_local_bin');
    } catch (e) {
      console.error('[scanLocalBin error]', e);
    }
  }
  return [];
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
