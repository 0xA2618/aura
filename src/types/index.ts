export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
  gitStatus?: 'M' | 'A' | 'D' | 'U' | 'IGNORED' | string;
}

export interface GitCommitFileItem {
  path: string;
  status: 'M' | 'A' | 'D' | string;
}

export interface GitFileDiffResult {
  original: string;
  modified: string;
}

export interface OpenTab {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty?: boolean;
  type?: 'file' | 'extension' | 'diff';
  diffOriginal?: string;
  diffModified?: string;
  isSplitDiff?: boolean;
  diffViewMode?: 'split' | 'unified';
  viewMode?: 'editor' | 'markdown-preview' | 'markmap' | 'outline';
  extensionData?: PluginManifest;
}

export type BottomTabType = 'terminal' | 'opencode' | 'agent';

export type PaneSplitDirection = 'horizontal' | 'vertical'; // horizontal = side-by-side (left/right, Cmd+D), vertical = stacked (top/bottom, Shift+Cmd+D)

export type PaneLayoutNode =
  | {
      type: 'leaf';
      id: string; // terminal pane id
    }
  | {
      type: 'split';
      id: string; // unique node id
      direction: PaneSplitDirection;
      children: [PaneLayoutNode, PaneLayoutNode];
    };

export interface BottomTab {
  id: string;
  type: BottomTabType;
  title: string;
  agentCommand?: string;
  cwd?: string;
  rootLayout?: PaneLayoutNode;
}

export interface GitCommit {
  hash: string;
  author: string;
  author_email?: string;
  date: string;
  message: string;
  parents?: string[];
  refs?: string;
  is_merge?: boolean;
}

export interface OpenCodeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  publisher?: string;
  downloads?: string;
  rating?: number;
  icon?: string;
  category?: string;
  installed?: boolean;
}
