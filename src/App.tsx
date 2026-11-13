import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar, AgentSessionItem } from './components/Sidebar';
import { CodeEditor } from './components/CodeEditor';
import { TerminalPane } from './components/TerminalPane';
import { OpenCodeChat } from './components/OpenCodeChat';
import { AcpSession } from './components/AcpSession';
import { QuickPicker } from './components/QuickPicker';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { AddAgentModal } from './components/AddAgentModal';
import { GitModal } from './components/GitModal';
import {
  FileItem,
  OpenTab,
  BottomTab,
  PaneLayoutNode,
  PaneSplitDirection,
  GitCommit,
  PluginManifest,
  AcpConnStatus,
} from './types';
import {
  fetchDirectory,
  fetchFileContent,
  saveFileContent,
  fetchGitCommits,
  promptOpenDirectory,
  defaultPlugins,
  getDefaultWorkspace,
  killTerminalPTY,
  writeTerminalPTY,
  fetchCommitFileDiff,
  fetchGitHeadContent,
  watchWorkspaceFS,
  isTauri,
  exitApp,
  DetectedAgent,
  fetchCurrentBranch,
  detectSystemAgents,
  fetchProjectAgentSessions,
  updateProjectAgentSessionTitle,
  deleteProjectAgentSession,
  isAcpAgent,
  acpStop,
  fetchAcpAgents,
  trackAcpConversation,
  getAcpConversationAgent,
  untrackAcpConversation,
  memoryDeleteMemo,
} from './services/fileService';
import { Terminal, Bot, Plus, X, ChevronUp, ChevronDown, Check, Move, PanelLeftOpen, PanelLeftClose, Columns } from 'lucide-react';
import { OpenCodeLogo, AntigravityLogo, AntigravityAcpLogo, CodexLogo, ClaudeLogo, GeminiLogo } from './components/AgentDropdownMenu';

import { SupportedLang, getInitialLanguage, translations } from './services/i18n';
import { getThemeById, applyThemeToDocument } from './services/themeService';

function collectLeafPaneIds(node?: PaneLayoutNode): string[] {
  if (!node) return [];
  if (node.type === 'leaf') return [node.id];
  return [
    ...collectLeafPaneIds(node.children[0]),
    ...collectLeafPaneIds(node.children[1]),
  ];
}

function splitLeafNode(
  node: PaneLayoutNode,
  targetId: string,
  newId: string,
  direction: PaneSplitDirection
): PaneLayoutNode {
  if (node.type === 'leaf') {
    if (node.id === targetId) {
      return {
        type: 'split',
        id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction,
        children: [
          { type: 'leaf', id: node.id },
          { type: 'leaf', id: newId },
        ],
      };
    }
    return node;
  }

  return {
    ...node,
    children: [
      splitLeafNode(node.children[0], targetId, newId, direction),
      splitLeafNode(node.children[1], targetId, newId, direction),
    ],
  };
}

function removeLeafNode(
  node: PaneLayoutNode,
  targetId: string
): PaneLayoutNode | null {
  if (node.type === 'leaf') {
    if (node.id === targetId) {
      return null;
    }
    return node;
  }

  const leftRes = removeLeafNode(node.children[0], targetId);
  const rightRes = removeLeafNode(node.children[1], targetId);

  if (!leftRes && !rightRes) return null;
  if (!leftRes) return rightRes;
  if (!rightRes) return leftRes;

  return {
    ...node,
    children: [leftRes, rightRes],
  };
}

interface LeafGeometry {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function calculateLeafGeometries(
  node: PaneLayoutNode,
  left = 0,
  top = 0,
  width = 100,
  height = 100
): LeafGeometry[] {
  if (node.type === 'leaf') {
    return [{ id: node.id, left, top, width, height }];
  }

  const isVertical = node.direction === 'vertical'; // top/bottom
  if (isVertical) {
    const halfH = height / 2;
    return [
      ...calculateLeafGeometries(node.children[0], left, top, width, halfH),
      ...calculateLeafGeometries(node.children[1], left, top + halfH, width, halfH),
    ];
  } else {
    const halfW = width / 2;
    return [
      ...calculateLeafGeometries(node.children[0], left, top, halfW, height),
      ...calculateLeafGeometries(node.children[1], left + halfW, top, halfW, height),
    ];
  }
}

interface BottomDockProps {
  workspaceReady: boolean;
  workspaceDir: string;
  themeId: string;
  fontSize?: number;
  fontFamily?: string;
  bottomTabs: BottomTab[];
  activeBottomTabId: string;
  focusedPaneId?: string;
  isBottomOpen: boolean;
  bottomHeight: number;
  isResizing: boolean;
  resizingType?: 'sidebar' | 'bottom' | 'corner' | null;
  isCornerHovered?: boolean;
  editingDockTabId: string | null;
  editingDockTabTitle: string;
  dockRenameInputRef: any;
  acpStatus: Record<string, AcpConnStatus>;
  onAcpStatusChange: (id: string, status: AcpConnStatus) => void;
  onPaneFocus: (paneId: string) => void;
  onMouseDownBottom: (e: React.MouseEvent) => void;
  onSelectDockTab: (id: string) => void;
  onStartRenameDockTab: (id: string, title: string) => void;
  onChangeRenameTitle: (val: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onCloseDockTab: (id: string, e: React.MouseEvent) => void;
  onNewTerminalTab: () => void;
  onToggleHeight: () => void;
  onCloseDock: () => void;
}

const BottomDockArea = React.memo<BottomDockProps>(({
  workspaceReady,
  workspaceDir,
  themeId,
  fontSize,
  fontFamily,
  bottomTabs,
  activeBottomTabId,
  focusedPaneId,
  isBottomOpen,
  bottomHeight,
  isResizing,
  resizingType,
  isCornerHovered,
  editingDockTabId,
  editingDockTabTitle,
  dockRenameInputRef,
  acpStatus,
  onAcpStatusChange,
  onPaneFocus,
  onMouseDownBottom,
  onSelectDockTab,
  onStartRenameDockTab,
  onChangeRenameTitle,
  onConfirmRename,
  onCancelRename,
  onCloseDockTab,
  onNewTerminalTab,
  onToggleHeight,
  onCloseDock,
}) => {
  if (!isBottomOpen) return null;

  const activeBottomTab = bottomTabs.find((t) => t.id === activeBottomTabId) || bottomTabs[0];

  return (
    <>
      <div
        onMouseDown={onMouseDownBottom}
        className={`h-1.5 hover:h-1.5 cursor-row-resize transition-all flex items-center justify-center gap-1 select-none z-20 group relative my-0 ${
          resizingType === 'bottom' || resizingType === 'corner'
            ? 'bg-[#007acc] shadow-sm'
            : isCornerHovered
            ? 'bg-[#007acc]/35 shadow-xs'
            : 'hover:bg-[#007acc]/20 rounded-full'
        }`}
        title="按住鼠标上下拖动调整高度"
      >
        <div className={`w-0.5 h-0.5 rounded-full transition-colors ${resizingType === 'bottom' || resizingType === 'corner' ? 'bg-white' : isCornerHovered ? 'bg-[#007acc]' : 'bg-gray-500/50 group-hover:bg-[#007acc]'}`} />
        <div className={`w-0.5 h-0.5 rounded-full transition-colors ${resizingType === 'bottom' || resizingType === 'corner' ? 'bg-white' : isCornerHovered ? 'bg-[#007acc]' : 'bg-gray-500/50 group-hover:bg-[#007acc]'}`} />
        <div className={`w-0.5 h-0.5 rounded-full transition-colors ${resizingType === 'bottom' || resizingType === 'corner' ? 'bg-white' : isCornerHovered ? 'bg-[#007acc]' : 'bg-gray-500/50 group-hover:bg-[#007acc]'}`} />
      </div>

      <div
        id="terminal-dock-container"
        style={{
          height: `${bottomHeight}px`,
          backgroundColor: 'var(--aura-dock-bg)',
          color: 'var(--aura-dock-fg, var(--aura-text))',
          borderColor: 'var(--aura-border)'
        }}
        className={`flex flex-col w-full rounded-md border shadow-xs flex-shrink-0 relative overflow-hidden ${
          isResizing ? 'transition-none' : 'transition-[height] duration-75'
        }`}
      >
        <div
          style={{ backgroundColor: 'var(--aura-dock-header-bg)', borderColor: 'var(--aura-border)' }}
          className="flex items-center justify-between border-b h-9 px-3 select-none"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {bottomTabs.map((bt) => {
              const isCur = activeBottomTabId === bt.id;
              const isRenaming = editingDockTabId === bt.id;
              return (
                <div
                  key={bt.id}
                  onClick={() => onSelectDockTab(bt.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onStartRenameDockTab(bt.id, bt.title);
                  }}
                  style={{
                    backgroundColor: isCur ? 'var(--aura-dock-bg)' : 'transparent',
                    color: isCur ? 'var(--aura-dock-fg, var(--aura-text))' : 'var(--aura-text-muted)'
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs cursor-pointer rounded-lg transition-all ${
                    isCur
                      ? 'shadow-xs font-semibold border border-[var(--aura-border)]'
                      : 'hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-[#2e2e2e]'
                  }`}
                >
                  {bt.agentCommand === 'acp:agy-acp' ? (
                    <AntigravityAcpLogo size={14} />
                  ) : bt.type === 'terminal' ? (
                    <Terminal size={13} className="text-emerald-400" />
                  ) : bt.agentCommand?.startsWith('acp:') ? (
                    bt.agentCommand === 'acp:opencode' ? (
                      <OpenCodeLogo size={14} />
                    ) : bt.agentCommand === 'acp:claude' ? (
                      <ClaudeLogo size={14} />
                    ) : bt.agentCommand === 'acp:codex' ? (
                      <CodexLogo size={14} />
                    ) : bt.agentCommand === 'acp:gemini' ? (
                      <GeminiLogo size={14} />
                    ) : (
                      <Bot size={13} className="text-[#4ea8de] shrink-0" />
                    )
                  ) : bt.agentCommand?.includes('agy') || bt.agentCommand?.includes('antigravity') ? (
                    <AntigravityLogo size={14} />
                  ) : bt.agentCommand?.includes('codex') ? (
                    <CodexLogo size={14} />
                  ) : bt.agentCommand?.includes('claude') ? (
                    <ClaudeLogo size={14} />
                  ) : bt.agentCommand?.includes('opencode') || bt.type === 'opencode' ? (
                    <OpenCodeLogo size={14} />
                  ) : (
                    <Bot size={13} className="text-[var(--aura-accent,#007acc)]" />
                  )}
                  {isRenaming ? (
                    <input
                      ref={dockRenameInputRef}
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="off"
                      value={editingDockTabTitle}
                      onChange={(e) => onChangeRenameTitle(e.target.value)}
                      onBlur={onConfirmRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onConfirmRename();
                        if (e.key === 'Escape') onCancelRename();
                      }}
                      style={{
                        backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                        color: 'var(--aura-text, #ffffff)',
                        borderColor: '#007acc',
                      }}
                      className="border rounded px-1.5 py-0.5 text-xs outline-none font-mono shadow-xs"
                    />
                  ) : (
                    <span className="font-mono text-[11.5px] max-w-[180px] truncate block" title={bt.title}>
                      {bt.title}
                    </span>
                  )}
                  {bt.agentCommand?.startsWith('acp:') && (
                    <span
                      title={
                        acpStatus[bt.id] === 'connected'
                          ? 'ACP session connected'
                          : acpStatus[bt.id] === 'connecting'
                          ? 'ACP connecting…'
                          : acpStatus[bt.id] === 'error'
                          ? 'ACP disconnected'
                          : 'ACP connection'
                      }
                      className={`w-1.5 h-1.5 rounded-full transition-colors duration-700 ml-0.5 shrink-0 ${
                        acpStatus[bt.id] === 'connected'
                          ? 'bg-emerald-400'
                          : acpStatus[bt.id] === 'connecting'
                          ? 'bg-yellow-400 animate-pulse'
                          : acpStatus[bt.id] === 'error'
                          ? 'bg-red-400'
                          : 'bg-zinc-600'
                      }`}
                    />
                  )}
                  <button
                    onClick={(e) => onCloseDockTab(bt.id, e)}
                    className="aura-btn-ghost p-0.5 ml-1 rounded-sm text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}

            <button
              onClick={onNewTerminalTab}
              title="新建终端 (New Terminal)"
              className="aura-btn-ghost p-1 ml-1 text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onToggleHeight}
              title="切换高度"
              className="aura-btn-ghost p-1 text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]"
            >
              {bottomHeight === 480 ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
            <button
              onClick={onCloseDock}
              title="最小化收起 (Space + oc)"
              className="aura-btn-ghost p-1 text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const droppedPath = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/aura-path');
            if (droppedPath) {
              const targetTerminalId = focusedPaneId || activeBottomTab?.id;
              if (targetTerminalId) {
                writeTerminalPTY(targetTerminalId, `"${droppedPath}" `);
              }
              if ((window as any).electronAPI) {
                (window as any).electronAPI.terminalWrite(activeBottomTab.id, `"${droppedPath}" `);
              }
            }
          }}
          className="flex-1 overflow-hidden relative"
        >
          {workspaceReady && bottomTabs.map((bt) => {
            const isVisible = activeBottomTabId === bt.id;
            const layoutNode: PaneLayoutNode = bt.rootLayout || { type: 'leaf', id: bt.id };
            const leaves = calculateLeafGeometries(layoutNode);

            return (
              <div
                key={bt.id}
                data-dock-id={bt.id}
                style={{ display: isVisible ? 'block' : 'none' }}
                className="h-full w-full absolute inset-0"
              >
                {leaves.map((leaf) => (
                  <div
                    key={leaf.id}
                    data-pane-id={leaf.id}
                    onFocusCapture={() => onPaneFocus(leaf.id)}
                    onMouseDown={() => onPaneFocus(leaf.id)}
                    style={{
                      position: 'absolute',
                      left: `${leaf.left}%`,
                      top: `${leaf.top}%`,
                      width: `${leaf.width}%`,
                      height: `${leaf.height}%`,
                    }}
                    className="overflow-hidden border border-[var(--aura-border,#2d2d2d)] transition-[left,top,width,height] duration-75"
                  >
                    {bt.agentCommand?.startsWith('acp:') ? (
                      <AcpSession
                        sessionId={leaf.id}
                        agentId={bt.agentCommand.slice(4)}
                        agentName={bt.title.replace(/ \(ACP\)$/, '')}
                        cwd={bt.cwd || workspaceDir || ''}
                        onSessionClose={(id) => onCloseDockTab(id, { stopPropagation: () => {} } as any)}
                        onStatusChange={onAcpStatusChange}
                        resumeAgentSessionId={bt.resumeAgentSessionId}
                      />
                    ) : (
                      <TerminalPane
                        id={leaf.id}
                        cwd={bt.cwd || workspaceDir || undefined}
                        mode={bt.type === 'terminal' ? 'shell' : (bt.agentCommand || bt.type)}
                        themeId={themeId}
                        fontSize={fontSize}
                        fontFamily={fontFamily}
                        isVisible={isVisible}
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}, (prev, next) => {
  return (
    prev.workspaceReady === next.workspaceReady &&
    prev.workspaceDir === next.workspaceDir &&
    prev.themeId === next.themeId &&
    prev.fontSize === next.fontSize &&
    prev.fontFamily === next.fontFamily &&
    prev.activeBottomTabId === next.activeBottomTabId &&
    prev.isBottomOpen === next.isBottomOpen &&
    prev.bottomHeight === next.bottomHeight &&
    prev.isResizing === next.isResizing &&
    prev.editingDockTabId === next.editingDockTabId &&
    prev.editingDockTabTitle === next.editingDockTabTitle &&
    prev.bottomTabs === next.bottomTabs &&
    prev.acpStatus === next.acpStatus
  );
});

export function App() {
  const [activeView, setActiveView] = useState<'files' | 'git' | 'plugins'>('files');
  const [lang, setLang] = useState<SupportedLang>(getInitialLanguage);
  const [themeId, setThemeId] = useState<string>(() => {
    return localStorage.getItem('aura:theme') || 'vs-dark';
  });
  const [workspaceDir, setWorkspaceDir] = useState<string>(() => {
    return localStorage.getItem('aura:workspaceDir') || '';
  });
  const workspaceDirRef = useRef<string>(workspaceDir);
  workspaceDirRef.current = workspaceDir;
  const [workspaceReady, setWorkspaceReady] = useState<boolean>(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [plugins, setPlugins] = useState<PluginManifest[]>(() => {
    try {
      const saved = localStorage.getItem('aura:installedPlugins');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return defaultPlugins;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savedSessions, setSavedSessions] = useState<AgentSessionItem[]>([]);

  // Automatically load project agent sessions strictly from SQLite databases (~/.gemini, ~/.local/share/opencode, ~/.codex, ~/.claude)
  const refreshAgentSessions = useCallback((targetDir?: string) => {
    const ws = targetDir || workspaceDir;
    if (!ws) return;
    fetchProjectAgentSessions(ws).then((dbSessions) => {
      const mappedDbSessions: AgentSessionItem[] = dbSessions.map((rec) => ({
        id: rec.id,
        title: rec.title,
        agentName: rec.agent_name,
        agentCommand: rec.agent_command,
        agentId: rec.agent_id,
        createdAt: rec.created_at || Date.now(),
        projectPath: rec.project_path || undefined,
        projectName: rec.project_name || undefined,
      }));
      setSavedSessions(mappedDbSessions);
      localStorage.setItem(`aura:agentSessions:${ws}`, JSON.stringify(mappedDbSessions));
    });
  }, [workspaceDir]);

  useEffect(() => {
    if (!workspaceDir) return;
    refreshAgentSessions(workspaceDir);

    const onFocus = () => refreshAgentSessions(workspaceDir);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [workspaceDir, refreshAgentSessions]);
  const [editorFontSize, setEditorFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura:fontSize') || '14');
  });
  const [sidebarFontSize, setSidebarFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura:sidebarFontSize') || '14');
  });
  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura:terminalFontSize') || '13.5');
  });
  const [editorFontFamily, setEditorFontFamily] = useState<string>(() => {
    return localStorage.getItem('aura:editorFontFamily') || 'JetBrains Mono';
  });
  const [terminalFontFamily, setTerminalFontFamily] = useState<string>(() => {
    return localStorage.getItem('aura:terminalFontFamily') || 'JetBrains Mono';
  });

  const [acpStatusMap, setAcpStatusMap] = useState<Record<string, AcpConnStatus>>({});
  const handleAcpStatusChange = useCallback((id: string, status: AcpConnStatus) => {
    setAcpStatusMap((prev) => (prev[id] === status ? prev : { ...prev, [id]: status }));
  }, []);

  // Top-Right Editor Tabs
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const tabsRef = useRef<OpenTab[]>(tabs);
  tabsRef.current = tabs;
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const activeTabIdRef = useRef<string | null>(null);
  activeTabIdRef.current = activeTabId;

  const [bottomTabs, setBottomTabs] = useState<BottomTab[]>([]);
  const bottomTabsRef = useRef<BottomTab[]>(bottomTabs);
  bottomTabsRef.current = bottomTabs;
  const [activeBottomTabId, setActiveBottomTabId] = useState<string>('');
  const activeBottomTabIdRef = useRef<string>('');
  activeBottomTabIdRef.current = activeBottomTabId;
  const focusedPaneIdRef = useRef<string>('');
  const [isBottomOpen, setIsBottomOpen] = useState<boolean>(true);
  const hoveredWindowRef = useRef<1 | 2 | 3>(2);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      if (el.closest('#terminal-dock-container') || el.closest('#terminal-pane-root')) {
        hoveredWindowRef.current = 3;
      } else if (el.closest('#sidebar-container')) {
        hoveredWindowRef.current = 1;
      } else if (el.closest('#editor-container-root') || el.closest('.monaco-editor') || el.closest('.monaco-diff-editor')) {
        hoveredWindowRef.current = 2;
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    const saved = localStorage.getItem('aura:bottomHeight');
    return saved ? Number(saved) : 460;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('aura:isSidebarOpen');
    return saved !== null ? saved === 'true' : true;
  });
  const lastOpenedSidebarWidth = useRef<number>(260);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('aura:sidebarWidth');
    const val = saved ? Number(saved) : 260;
    return val >= 180 ? val : 260;
  });
  const isDraggingSidebar = useRef(false);
  const isDraggingBottom = useRef(false);

  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [addAgentMode, setAddAgentMode] = useState<'native' | 'acp'>('native');
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [gitBranch, setGitBranch] = useState<string>('');
  const [isCornerHovered, setIsCornerHovered] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const loadWorkspace = async (dir?: string) => {
    const targetDir = dir || workspaceDirRef.current || workspaceDir;
    if (dir) {
      setWorkspaceDir(dir);
      workspaceDirRef.current = dir;
      localStorage.setItem('aura:workspaceDir', dir);
    }
    if (targetDir) {
      watchWorkspaceFS(targetDir);
    }
    const fileList = await fetchDirectory(targetDir || undefined);
    setFiles(fileList);
    const commitList = await fetchGitCommits(targetDir || undefined);
    setCommits(commitList);
    const branch = await fetchCurrentBranch(targetDir || undefined);
    setGitBranch(branch);
  };

  const handleOpenWorkspaceDialog = async () => {
    const currentDir = workspaceDirRef.current || workspaceDir;
    const selected = await promptOpenDirectory(currentDir);
    if (selected) {
      setWorkspaceDir(selected);
      workspaceDirRef.current = selected;
      localStorage.setItem('aura:workspaceDir', selected);
      setFiles([]);
      await loadWorkspace(selected);
      showToast(`已打开目录: ${selected.split('/').pop()}`);
    }
  };

  useEffect(() => {
    localStorage.removeItem('aura:customWindowColors');
    const currentTheme = getThemeById(themeId);
    applyThemeToDocument(currentTheme);
  }, [themeId]);

  useEffect(() => {
    // Prime the config-driven ACP registry (~/.config/aura/aura.json)
    fetchAcpAgents().catch(() => {});

    // One-time backfill: tag ACP conversations created before local tracking existed
    try {
      if (!localStorage.getItem('aura:acpConversationsBackfilled')) {
        const known = [
          'bfce9d4b-236a-4772-8673-9d4d62487f63',
          '0ad7778f-ede6-46a2-b904-2a50840e9ce9',
          'ed5af8cc-bb65-4039-b8e6-1c943ce28956',
          'b727632b-4b72-4c1d-91b4-908bed695cc3',
        ];
        known.forEach((id) => trackAcpConversation(id, 'agy-acp'));
        localStorage.setItem('aura:acpConversationsBackfilled', '1');
      }
    } catch (e) {
      console.error('[acp conversation backfill error]', e);
    }

    const initWorkspace = async () => {
      let dir = workspaceDirRef.current;
      if (!dir) {
        dir = await getDefaultWorkspace();
        if (dir) {
          setWorkspaceDir(dir);
          localStorage.setItem('aura:workspaceDir', dir);
        }
      }
      setWorkspaceReady(true);
      loadWorkspace(dir || undefined);

      const defaultTermId = `term-${Date.now()}`;
      setBottomTabs([{ id: defaultTermId, type: 'terminal', title: 'Terminal (zsh)' }]);
      setActiveBottomTabId(defaultTermId);
    };
    initWorkspace();

    if (typeof window !== 'undefined' && (window as any).electronAPI?.onQuitWarning) {
      (window as any).electronAPI.onQuitWarning((msg: string) => {
        showToast(msg);
      });
    }

    let unlistenMenuQuit: (() => void) | undefined;
    let unlistenMenuHelp: (() => void) | undefined;
    let unlistenMenuOpenFolder: (() => void) | undefined;
    let unlistenFsChanged: (() => void) | undefined;
    if (isTauri) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen('menu:quit_requested', () => {
          showToast('使用 ⌘qq 退出应用 (按2次 q 退出)');
        }).then((unlisten) => {
          unlistenMenuQuit = unlisten;
        });

        listen('menu:open_folder_requested', () => {
          handleOpenWorkspaceDialog();
        }).then((unlisten) => {
          unlistenMenuOpenFolder = unlisten;
        });

        listen('menu:help_requested', () => {
          setIsHelpOpen(true);
        }).then((unlisten) => {
          unlistenMenuHelp = unlisten;
        });

        listen('aura:fs-changed', () => {
          loadWorkspace();
          window.dispatchEvent(new CustomEvent('aura:fs-changed'));
        }).then((unlisten) => {
          unlistenFsChanged = unlisten;
        });
      });
    }

    const handleWindowFocus = () => {
      loadWorkspace();
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      if (unlistenMenuQuit) unlistenMenuQuit();
      if (unlistenMenuHelp) unlistenMenuHelp();
      if (unlistenMenuOpenFolder) unlistenMenuOpenFolder();
      if (unlistenFsChanged) unlistenFsChanged();
    };
  }, []);

  useEffect(() => {
    let spacePressed = false;
    let spaceTimeout: any = null;

    let cmdQCount = 0;
    let cmdQResetTimer: any = null;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const keyLower = e.key ? e.key.toLowerCase() : '';
      const isKeyQ = keyLower === 'q' || e.code === 'KeyQ';

      if (isCmdOrCtrl && isKeyQ) {
        e.preventDefault();
        e.stopPropagation();

        cmdQCount += 1;

        if (cmdQResetTimer) clearTimeout(cmdQResetTimer);
        cmdQResetTimer = setTimeout(() => {
          cmdQCount = 0;
        }, 1200);

        if (cmdQCount >= 2) {
          cmdQCount = 0;
          if (cmdQResetTimer) clearTimeout(cmdQResetTimer);
          exitApp();
          return;
        }

        showToast('使用 ⌘qq 退出应用 (按2次 q 退出)');
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        e.stopPropagation();

        const activeElem = document.activeElement;
        const isFocusInWindow3 = activeElem?.closest('.xterm') || activeElem?.closest('#terminal-dock-container') || activeElem?.closest('textarea')?.closest('.xterm');

        if (isFocusInWindow3) {
          handleCloseActiveBottomTab();
        } else {
          const curActiveId = activeTabIdRef.current;
          if (curActiveId) {
            handleCloseTab(curActiveId);
          }
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        e.stopPropagation();

        const activeElem = document.activeElement;
        const isFocusInWindow3 = activeElem?.closest('.xterm') || activeElem?.closest('#terminal-dock-container') || activeElem?.closest('textarea')?.closest('.xterm');
        const isFocusInWindow1 = activeElem?.closest('#sidebar-container');

        if (isFocusInWindow3) {
          setTerminalFontSize((prev) => {
            const next = Math.min(28, prev + 1);
            localStorage.setItem('aura:terminalFontSize', String(next));
            showToast(`终端 (Panel 3) 字号: ${next}px`);
            return next;
          });
        } else if (isFocusInWindow1) {
          setSidebarFontSize((prev) => {
            const next = Math.min(24, prev + 1);
            localStorage.setItem('aura:sidebarFontSize', String(next));
            showToast(`侧边栏 (Panel 1) 字号: ${next}px`);
            return next;
          });
        } else {
          setEditorFontSize((prev) => {
            const next = Math.min(32, prev + 1);
            localStorage.setItem('aura:fontSize', String(next));
            showToast(`编辑器 (Panel 2) 字号: ${next}px`);
            return next;
          });
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        e.stopPropagation();

        const activeElem = document.activeElement;
        const isFocusInWindow3 = activeElem?.closest('.xterm') || activeElem?.closest('#terminal-dock-container') || activeElem?.closest('textarea')?.closest('.xterm');
        const isFocusInWindow1 = activeElem?.closest('#sidebar-container');

        if (isFocusInWindow3) {
          setTerminalFontSize((prev) => {
            const next = Math.max(9, prev - 1);
            localStorage.setItem('aura:terminalFontSize', String(next));
            showToast(`终端 (Panel 3) 字号: ${next}px`);
            return next;
          });
        } else if (isFocusInWindow1) {
          setSidebarFontSize((prev) => {
            const next = Math.max(10, prev - 1);
            localStorage.setItem('aura:sidebarFontSize', String(next));
            showToast(`侧边栏 (Panel 1) 字号: ${next}px`);
            return next;
          });
        } else {
          setEditorFontSize((prev) => {
            const next = Math.max(9, prev - 1);
            localStorage.setItem('aura:fontSize', String(next));
            showToast(`编辑器 (Panel 2) 字号: ${next}px`);
            return next;
          });
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return;
      }

      if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        e.stopPropagation();
        const sidebarEl = document.getElementById('sidebar-container');
        if (sidebarEl) sidebarEl.focus();
        window.dispatchEvent(new CustomEvent('aura:focus-sidebar', { detail: { resetToFirst: !activeTabIdRef.current } }));
        return;
      }

      if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        const monacoTextarea = document.querySelector('.monaco-editor textarea') as HTMLElement;
        if (monacoTextarea) {
          monacoTextarea.focus();
        }
        return;
      }

      if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        e.stopPropagation();
        setIsBottomOpen(true);
        setTimeout(() => {
          focusActiveTerminal();
        }, 50);
        setTimeout(() => {
          focusActiveTerminal();
        }, 150);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleOpenOpenCodeTab();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleOpenTerminalDirect();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleSplitTerminal('vertical');
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleSplitTerminal('horizontal');
        return;
      }

      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        const activeElem = document.activeElement;
        const isFocusInWindow3 = activeElem?.closest('.xterm') || activeElem?.closest('#terminal-dock-container') || activeElem?.closest('textarea')?.closest('.xterm');
        if (isFocusInWindow3) {
          const tabIndex = parseInt(e.key, 10) - 1;
          const currentTabs = bottomTabsRef.current;
          if (tabIndex >= 0 && tabIndex < currentTabs.length) {
            e.preventDefault();
            e.stopPropagation();
            const targetId = currentTabs[tabIndex].id;
            setActiveBottomTabId(targetId);

            setTimeout(() => {
              const activeContainer = document.getElementById('terminal-dock-container');
              const targetPanel = activeContainer?.querySelector(`div[data-dock-id="${targetId}"] .xterm textarea`) as HTMLElement;
              if (targetPanel) {
                targetPanel.focus();
              } else {
                const anyTextarea = document.querySelector('.xterm textarea') as HTMLElement;
                if (anyTextarea) anyTextarea.focus();
              }
            }, 30);
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, []);

  const handleSelectFile = async (
    file: FileItem,
    viewMode?: 'editor' | 'markdown-preview' | 'markmap' | 'outline',
    forceNormalEditor?: boolean
  ) => {
    if (file.isDirectory) return;

    let targetTab: OpenTab | undefined = undefined;
    setTabs((currentTabs) => {
      targetTab = currentTabs.find((t) => t.path === file.path);
      return currentTabs;
    });

    const isMarkdown = file.name.toLowerCase().endsWith('.md');
    const resolvedMode = viewMode || (isMarkdown ? ((localStorage.getItem('aura:defaultMarkdownMode') as any) || 'editor') : 'editor');

    const content = await fetchFileContent(file.path);

    // Check if the file is modified compared to Git HEAD
    let isModified = file.gitStatus === 'M';
    let headContent = '';
    try {
      headContent = await fetchGitHeadContent(file.path, workspaceDir);
      if (headContent && headContent.trim() !== '' && headContent !== content) {
        isModified = true;
      }
    } catch (e) {
      console.error('[fetchGitHeadContent on open]', e);
    }

    if (targetTab) {
      if (forceNormalEditor) {
        setTabs((prev) =>
          prev.map((t) =>
            t.path === file.path
              ? {
                  ...t,
                  isSplitDiff: false,
                  viewMode: 'editor',
                }
              : t
          )
        );
      } else if (isModified && !(targetTab as OpenTab).isSplitDiff) {
        setTabs((prev) =>
          prev.map((t) =>
            t.path === file.path
              ? {
                  ...t,
                  isSplitDiff: true,
                  diffOriginal: headContent || t.diffOriginal,
                  viewMode: viewMode || t.viewMode,
                }
              : t
          )
        );
      } else if (viewMode && (targetTab as OpenTab).viewMode !== viewMode) {
        setTabs((prev) =>
          prev.map((t) => (t.path === file.path ? { ...t, viewMode } : t))
        );
      }
      setActiveTabId((targetTab as OpenTab).id);
      return;
    }

    const fname = file.name.toLowerCase();
    let language = 'plaintext';

    if (fname.endsWith('.ts') || fname.endsWith('.tsx')) language = 'typescript';
    else if (fname.endsWith('.js') || fname.endsWith('.jsx') || fname.endsWith('.mjs') || fname.endsWith('.cjs')) language = 'javascript';
    else if (fname.endsWith('.md') || fname.endsWith('.markdown')) language = 'markdown';
    else if (fname.endsWith('.json') || fname.endsWith('.jsonc')) language = 'json';
    else if (fname.endsWith('.css') || fname.endsWith('.scss') || fname.endsWith('.less')) language = 'css';
    else if (fname.endsWith('.html') || fname.endsWith('.htm')) language = 'html';
    else if (fname.endsWith('.py')) language = 'python';
    else if (fname.endsWith('.rs')) language = 'rust';
    else if (fname.endsWith('.go')) language = 'go';
    else if (fname.endsWith('.lua')) language = 'lua';
    else if (fname.endsWith('.yaml') || fname.endsWith('.yml')) language = 'yaml';
    else if (fname.endsWith('.sh') || fname.endsWith('.zsh')) language = 'shell';
    else if (fname.startsWith('.git') || fname.startsWith('.env') || fname.includes('ignore')) language = 'plaintext';
    else if (fname.endsWith('.txt') || fname.endsWith('.log')) language = 'plaintext';

    const newTab: OpenTab = {
      id: file.path,
      name: file.name,
      path: file.path,
      content,
      language,
      viewMode: resolvedMode,
      isSplitDiff: forceNormalEditor ? false : isModified,
      diffOriginal: headContent || '',
    };
    editorContentMap.current[file.path] = content;

    setTabs((prev) => {
      if (prev.some((t) => t.path === file.path)) {
        return prev;
      }
      return [...prev, newTab];
    });
    setActiveTabId(newTab.id);

    setTimeout(() => {
      const monacoTextarea = document.querySelector('.monaco-editor textarea') as HTMLElement;
      if (monacoTextarea) {
        monacoTextarea.focus();
      }
    }, 40);
  };

  const handleOpenFileByPath = async (filePath: string, forceNormalEditor?: boolean) => {
    let resolvedPath = filePath;
    if (workspaceDir && !filePath.startsWith('/') && !filePath.startsWith('\\')) {
      resolvedPath = `${workspaceDir}/${filePath}`;
    }
    const fileName = resolvedPath.split('/').pop() || resolvedPath;
    await handleSelectFile(
      {
        name: fileName,
        path: resolvedPath,
        isDirectory: false,
      },
      forceNormalEditor ? 'editor' : undefined,
      forceNormalEditor
    );
  };

  const handleOpenCommitDiff = async (commitHash: string, filePath: string) => {
    const diffId = `diff-${commitHash}-${filePath}`;
    const existing = tabsRef.current.find((t) => t.id === diffId);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const { original, modified } = await fetchCommitFileDiff(commitHash, filePath, workspaceDir);
    const fname = filePath.split('/').pop() || filePath;
    let language = 'plaintext';
    if (fname.endsWith('.ts') || fname.endsWith('.tsx')) language = 'typescript';
    else if (fname.endsWith('.js') || fname.endsWith('.jsx')) language = 'javascript';
    else if (fname.endsWith('.json')) language = 'json';
    else if (fname.endsWith('.rs')) language = 'rust';
    else if (fname.endsWith('.py')) language = 'python';
    else if (fname.endsWith('.go')) language = 'go';
    else if (fname.endsWith('.css')) language = 'css';
    else if (fname.endsWith('.html')) language = 'html';
    else if (fname.endsWith('.md')) language = 'markdown';

    const shortHash = commitHash.slice(0, 7);
    const newDiffTab: OpenTab = {
      id: diffId,
      name: `${fname} (${shortHash})`,
      path: filePath,
      content: modified,
      language,
      type: 'diff',
      diffOriginal: original,
      diffModified: modified,
    };

    setTabs((prev) => [...prev, newDiffTab]);
    setActiveTabId(newDiffTab.id);
  };

  const handleSelectExtension = (ext: PluginManifest) => {
    const extTabId = `extension:${ext.id}`;
    const existing = tabsRef.current.find((t) => t.id === extTabId);
    if (existing) {
      setActiveTabId(extTabId);
      return;
    }

    const newTab: OpenTab = {
      id: extTabId,
      name: `Extension: ${ext.name}`,
      path: `extension://${ext.id}`,
      content: ext.description,
      language: 'markdown',
      type: 'extension',
      extensionData: ext,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(extTabId);
  };

  const handleCloseTab = (tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const remaining = prev.filter((t) => t.id !== tabId);
      const curActiveId = activeTabIdRef.current;

      if (curActiveId === tabId) {
        if (remaining.length > 0) {
          const nextActive = idx > 0 ? remaining[idx - 1] : remaining[0];
          setActiveTabId(nextActive.id);
        } else {
          setActiveTabId(null);
        }
      }
      return remaining;
    });
  };

  const editorContentMap = useRef<Record<string, string>>({});

  const handleChangeContent = (val: string) => {
    if (!activeTabId) return;
    editorContentMap.current[activeTabId] = val;
    setTabs((prev) => {
      const cur = prev.find((t) => t.id === activeTabId);
      if (cur && cur.isDirty) {
        return prev;
      }
      return prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: true } : t));
    });
  };

  const [dockContextMenu, setDockContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
    tabTitle: string;
  } | null>(null);
  const [editingDockTabId, setEditingDockTabId] = useState<string | null>(null);
  const [editingDockTabTitle, setEditingDockTabTitle] = useState<string>('');
  const dockRenameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleCloseDockMenu = () => setDockContextMenu(null);
    window.addEventListener('click', handleCloseDockMenu);
    return () => window.removeEventListener('click', handleCloseDockMenu);
  }, []);

  useEffect(() => {
    if (editingDockTabId && dockRenameInputRef.current) {
      setTimeout(() => {
        dockRenameInputRef.current?.focus();
        dockRenameInputRef.current?.select();
      }, 30);
    }
  }, [editingDockTabId]);

  const handleConfirmDockRename = () => {
    if (editingDockTabId && editingDockTabTitle.trim()) {
      setBottomTabs((prev) =>
        prev.map((t) => (t.id === editingDockTabId ? { ...t, title: editingDockTabTitle.trim() } : t))
      );
    }
    setEditingDockTabId(null);
  };

  const focusActiveTerminal = (targetId?: string) => {
    setTimeout(() => {
      const activeContainer = document.getElementById('terminal-dock-container');
      const idToFocus = targetId || focusedPaneIdRef.current || activeBottomTabIdRef.current;
      const targetPanel = activeContainer?.querySelector(`div[data-pane-id="${idToFocus}"] .xterm textarea`) as HTMLElement;
      if (targetPanel) {
        targetPanel.focus();
      } else {
        const fallbackPanel = activeContainer?.querySelector(`div[data-dock-id="${idToFocus}"] .xterm textarea`) as HTMLElement;
        if (fallbackPanel) {
          fallbackPanel.focus();
        } else {
          const visibleTextarea = activeContainer?.querySelector('div[style*="flex"] .xterm textarea, div[style*="block"] .xterm textarea') as HTMLElement;
          if (visibleTextarea) {
            visibleTextarea.focus();
          } else {
            const anyTextarea = document.querySelector('.xterm textarea') as HTMLElement;
            if (anyTextarea) anyTextarea.focus();
          }
        }
      }
    }, 40);
  };

  const handleSplitTerminal = useCallback((direction: PaneSplitDirection) => {
    setIsBottomOpen(true);
    const curTabId = activeBottomTabIdRef.current;
    if (!curTabId) {
      handleOpenTerminalDirect();
      return;
    }

    const currentTab = bottomTabsRef.current.find((t) => t.id === curTabId);
    if (!currentTab) return;

    const currentLayout: PaneLayoutNode = currentTab.rootLayout || { type: 'leaf', id: currentTab.id };
    const allLeafIds = collectLeafPaneIds(currentLayout);
    const targetPaneId = (focusedPaneIdRef.current && allLeafIds.includes(focusedPaneIdRef.current))
      ? focusedPaneIdRef.current
      : allLeafIds[allLeafIds.length - 1];

    const newPaneId = `terminal-pane-${Date.now()}`;
    focusedPaneIdRef.current = newPaneId;

    const updatedLayout = splitLeafNode(currentLayout, targetPaneId, newPaneId, direction);

    setBottomTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === curTabId) {
          return {
            ...tab,
            rootLayout: updatedLayout,
          };
        }
        return tab;
      })
    );

    setTimeout(() => {
      focusActiveTerminal(newPaneId);
    }, 80);
  }, []);

  const handleOpenTerminalDirect = () => {
    setIsBottomOpen(true);
    const count = bottomTabsRef.current.filter((t) => t.type === 'terminal').length;
    const id = `terminal-${Date.now()}`;
    const title = count === 0 ? 'Terminal (zsh)' : `Terminal ${count + 1} (zsh)`;
    const newBottomTab: BottomTab = { id, type: 'terminal', title };
    setBottomTabs((prev) => [...prev, newBottomTab]);
    setActiveBottomTabId(id);
    focusActiveTerminal(id);
  };

  const handleToggleTerminalBottom = () => {
    if (isBottomOpen) {
      setIsBottomOpen(false);
    } else {
      setIsBottomOpen(true);
      const terminalTabs = bottomTabsRef.current.filter((t) => t.type === 'terminal');
      if (terminalTabs.length === 0) {
        const id = `terminal-${Date.now()}`;
        const newBottomTab: BottomTab = { id, type: 'terminal', title: 'Terminal (zsh)' };
        setBottomTabs((prev) => [...prev, newBottomTab]);
        setActiveBottomTabId(id);
        focusActiveTerminal(id);
      } else {
        const currentActive = bottomTabsRef.current.find((t) => t.id === activeBottomTabIdRef.current);
        if (!currentActive || currentActive.type !== 'terminal') {
          setActiveBottomTabId(terminalTabs[0].id);
          focusActiveTerminal(terminalTabs[0].id);
        } else {
          focusActiveTerminal(currentActive.id);
        }
      }
    }
  };

  const handleOpenOpenCodeTab = () => {
    setIsBottomOpen(true);
    const count = bottomTabsRef.current.filter((t) => t.type === 'opencode').length;
    const id = `opencode-${Date.now()}`;
    const title = count === 0 ? 'OpenCode V2' : `OpenCode V2 ${count + 1}`;
    const newBottomTab: BottomTab = { id, type: 'opencode', title };
    setBottomTabs((prev) => [...prev, newBottomTab]);
    setActiveBottomTabId(id);
    focusActiveTerminal(id);
  };

  const handleLaunchAgent = useCallback((agent: DetectedAgent, mode?: 'native' | 'acp') => {
    setIsBottomOpen(true);
    // Explicit mode wins; otherwise infer from agent id (default to ACP for ACP-capable agents)
    const useAcp = mode ? mode === 'acp' : isAcpAgent(agent.id);
    const id = `agent-${agent.id}-${Date.now()}`;
    if (useAcp) {
      const acpCount = bottomTabsRef.current.filter((t) => t.agentCommand === `acp:${agent.id}`).length;
      const title = acpCount === 0 ? agent.name : `${agent.name} ${acpCount + 1}`;
      const newBottomTab: BottomTab = {
        id,
        type: 'agent',
        title,
        agentCommand: `acp:${agent.id}`,
        cwd: workspaceDirRef.current,
      };
      setBottomTabs((prev) => [...prev, newBottomTab]);
      setActiveBottomTabId(id);
      return;
    }
    const count = bottomTabsRef.current.filter((t) => t.agentCommand === agent.command || (t.type === 'opencode' && agent.command === 'opencode')).length;
    const title = count === 0 ? agent.name : `${agent.name} ${count + 1}`;
    const newBottomTab: BottomTab = {
      id,
      type: 'agent',
      title,
      agentCommand: agent.command,
    };
    setBottomTabs((prev) => [...prev, newBottomTab]);
    setActiveBottomTabId(id);
    focusActiveTerminal(id);
  }, [focusActiveTerminal]);

  const handleRunInstallCommand = useCallback((installCmd: string, agentName: string) => {
    setIsBottomOpen(true);
    const id = `install-${Date.now()}`;
    const title = `Install ${agentName}`;
    const newBottomTab: BottomTab = {
      id,
      type: 'terminal',
      title,
    };
    setBottomTabs((prev) => [...prev, newBottomTab]);
    setActiveBottomTabId(id);
    setTimeout(() => {
      writeTerminalPTY(id, `${installCmd}\n`);
    }, 450);
  }, []);

  const handleCloseActiveBottomTab = () => {
    const curTabId = activeBottomTabIdRef.current;
    if (!curTabId) return;

    const currentTab = bottomTabsRef.current.find((t) => t.id === curTabId);
    if (!currentTab) return;
    const isAcpTab = currentTab.agentCommand?.startsWith('acp:');
    if (isAcpTab) {
      setAcpStatusMap((prev) => {
        if (!prev[curTabId]) return prev;
        const next = { ...prev };
        delete next[curTabId];
        return next;
      });
    }

    const currentLayout: PaneLayoutNode = currentTab.rootLayout || { type: 'leaf', id: currentTab.id };
    const currentPanes = collectLeafPaneIds(currentLayout);
    const focusedPane = (focusedPaneIdRef.current && currentPanes.includes(focusedPaneIdRef.current))
      ? focusedPaneIdRef.current
      : currentPanes[0];

    const killPane = (pid: string) => {
      if (isAcpTab) {
        acpStop(pid);
      } else {
        killTerminalPTY(pid);
      }
    };

    if (currentPanes.length > 1) {
      killPane(focusedPane);
      if (typeof window !== 'undefined' && (window as any).electronAPI?.terminalKill) {
        (window as any).electronAPI.terminalKill(focusedPane);
      }

      const updatedLayout = removeLeafNode(currentLayout, focusedPane);
      const remainingPanes = collectLeafPaneIds(updatedLayout || undefined);
      const nextFocusPane = remainingPanes[remainingPanes.length - 1];
      focusedPaneIdRef.current = nextFocusPane;

      setBottomTabs((prev) =>
        prev.map((t) => {
          if (t.id === curTabId) {
            return {
              ...t,
              rootLayout: updatedLayout || undefined,
            };
          }
          return t;
        })
      );

      if (nextFocusPane) {
        focusActiveTerminal(nextFocusPane);
      }
      return;
    }

    currentPanes.forEach((pid) => {
      killPane(pid);
      if (typeof window !== 'undefined' && (window as any).electronAPI?.terminalKill) {
        (window as any).electronAPI.terminalKill(pid);
      }
    });

    setBottomTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== curTabId);
      if (remaining.length === 0) {
        setIsBottomOpen(false);
        setActiveBottomTabId('');
        focusedPaneIdRef.current = '';
        return [];
      }
      const idx = prev.findIndex((t) => t.id === curTabId);
      const nextActive = remaining[Math.max(0, idx - 1)];
      setActiveBottomTabId(nextActive.id);
      const nextActivePanes = collectLeafPaneIds(nextActive.rootLayout || { type: 'leaf', id: nextActive.id });
      focusedPaneIdRef.current = nextActivePanes[0];
      focusActiveTerminal(nextActivePanes[0]);
      return remaining;
    });
  };

  const handleSelectDockTab = useCallback((id: string) => {
    setActiveBottomTabId(id);
  }, []);

  const handleStartRenameDockTab = useCallback((id: string, title: string) => {
    setEditingDockTabId(id);
    setEditingDockTabTitle(title);
  }, []);

  const handleChangeRenameTitle = useCallback((val: string) => {
    setEditingDockTabTitle(val);
  }, []);

  const handleCancelRename = useCallback(() => {
    setEditingDockTabId(null);
  }, []);

  const handleNewTerminalTab = useCallback(() => {
    const id = `terminal-${Date.now()}`;
    setBottomTabs((prev) => {
      const count = prev.filter((t) => t.type === 'terminal').length;
      const title = `Terminal ${count + 1} (zsh)`;
      return [...prev, { id, type: 'terminal', title }];
    });
    setActiveBottomTabId(id);
  }, []);

  const handleToggleBottomHeight = useCallback(() => {
    setBottomHeight((h) => (h === 480 ? 280 : 480));
  }, []);

  const handleCloseDock = useCallback(() => {
    setIsBottomOpen(false);
  }, []);

  const handleSave = useCallback(async () => {
    const curActiveId = activeTabIdRef.current;
    if (!curActiveId) return;
    const cur = tabsRef.current.find((t) => t.id === curActiveId);
    if (!cur) return;
    const contentToSave = editorContentMap.current[cur.id] ?? cur.content;
    const ok = await saveFileContent(cur.path, contentToSave);
    if (ok) {
      setTabs((prev) =>
        prev.map((t) => (t.id === curActiveId ? { ...t, content: contentToSave, isDirty: false } : t))
      );
      showToast('文件已保存 (Saved)');
    }
  }, []);

  const handleQuickPickSelect = (type: 'terminal' | 'opencode') => {
    setIsQuickPickerOpen(false);
    setIsBottomOpen(true);
    const id = `${type}-${Date.now()}`;
    const title =
      type === 'terminal'
        ? `Terminal ${bottomTabs.filter((t) => t.type === 'terminal').length + 1} (zsh)`
        : `OpenCode ${bottomTabs.filter((t) => t.type === 'opencode').length + 1}`;

    const newBottomTab: BottomTab = { id, type, title };
    setBottomTabs((prev) => [...prev, newBottomTab]);
    setActiveBottomTabId(id);
    showToast(type === 'terminal' ? 'New Terminal opened' : 'New OpenCode session opened');
  };

  const handleCloseBottomTab = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabToClose = bottomTabsRef.current.find((t) => t.id === id);
    const isAcpTab = tabToClose?.agentCommand?.startsWith('acp:');
    if (isAcpTab) {
      setAcpStatusMap((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    const panesToKill = tabToClose ? collectLeafPaneIds(tabToClose.rootLayout || { type: 'leaf', id: tabToClose.id }) : [id];
    panesToKill.forEach((pid) => {
      if (isAcpTab) {
        acpStop(pid);
      } else {
        killTerminalPTY(pid);
      }
      if (typeof window !== 'undefined' && (window as any).electronAPI?.terminalKill) {
        (window as any).electronAPI.terminalKill(pid);
      }
    });

    setBottomTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        setIsBottomOpen(false);
        setActiveBottomTabId('');
        focusedPaneIdRef.current = '';
        return [];
      }
      if (activeBottomTabIdRef.current === id) {
        const idx = prev.findIndex((t) => t.id === id);
        const nextActive = remaining[Math.max(0, idx - 1)];
        setActiveBottomTabId(nextActive.id);
        const nextActivePanes = collectLeafPaneIds(nextActive.rootLayout || { type: 'leaf', id: nextActive.id });
        focusedPaneIdRef.current = nextActivePanes[0];
        focusActiveTerminal(nextActivePanes[0]);
      }
      return remaining;
    });
  }, []);

  // Track agent sessions for the current project
  const agentSessions: AgentSessionItem[] = useMemo(() => {
    return savedSessions.map((s) => ({
      ...s,
      isActive: isBottomOpen && activeBottomTabId === s.id,
    }));
  }, [savedSessions, isBottomOpen, activeBottomTabId]);

  const handleSelectSession = useCallback((session: AgentSessionItem) => {
    const sessionCwd = session.projectPath || workspaceDir;
    const existing = bottomTabsRef.current.find((t) => t.id === session.id);
    setIsBottomOpen(true);
    // ACP 会话按创建方式恢复：如果该会话是 ACP 产出，点开时用 ACP 方式并 session/load 重接，而不是原生 TUI
    const acpAgentId = !existing ? getAcpConversationAgent(session.id) : null;
    if (acpAgentId) {
      const acpTab: BottomTab = {
        id: session.id,
        type: 'agent',
        title: `${session.title} (ACP)`,
        agentCommand: `acp:${acpAgentId}`,
        cwd: sessionCwd,
        resumeAgentSessionId: session.id,
      };
      setBottomTabs((prev) => [...prev, acpTab]);
      setActiveBottomTabId(session.id);
      focusActiveTerminal(session.id);
      return;
    }
    if (existing) {
      setActiveBottomTabId(existing.id);
      const leafPanes = collectLeafPaneIds(existing.rootLayout || { type: 'leaf', id: existing.id });
      focusActiveTerminal(leafPanes[0] || existing.id);
    } else {
      let resumeCmd = session.agentCommand || 'agy';
      const cmdLower = (session.agentCommand || '').toLowerCase();
      const idLower = (session.agentId || '').toLowerCase();
      const nameLower = (session.agentName || '').toLowerCase();

      if (idLower === 'antigravity' || cmdLower.includes('agy') || nameLower.includes('antigravity')) {
        // agy --conversation <id> (or agy -c) to resume exact conversation and continue chatting
        resumeCmd = session.id ? `agy --conversation ${session.id}` : 'agy -c';
      } else if (idLower === 'opencode' || cmdLower.includes('opencode') || nameLower.includes('opencode')) {
        // opencode --session <id>
        resumeCmd = session.id ? `opencode --session ${session.id}` : 'opencode -c';
      } else if (idLower === 'claude' || cmdLower.includes('claude') || nameLower.includes('claude')) {
        resumeCmd = session.id ? `claude --resume ${session.id}` : 'claude';
      } else if (idLower === 'codex' || cmdLower.includes('codex') || nameLower.includes('codex')) {
        resumeCmd = session.id ? `codex resume ${session.id}` : 'codex';
      }

      const newTab: BottomTab = {
        id: session.id,
        type: 'agent',
        title: session.title,
        agentCommand: resumeCmd,
        cwd: sessionCwd,
      };
      setBottomTabs((prev) => [...prev, newTab]);
      setActiveBottomTabId(session.id);
      focusActiveTerminal(session.id);
    }
  }, [focusActiveTerminal, workspaceDir]);

  const handleSelectProjectFromSession = useCallback((newProjectDir: string) => {
    if (newProjectDir && newProjectDir !== workspaceDirRef.current) {
      setWorkspaceDir(newProjectDir);
      workspaceDirRef.current = newProjectDir;
      localStorage.setItem('aura:workspaceDir', newProjectDir);
      loadWorkspace(newProjectDir);
      // NOTE: Do not touch bottom tabs! Keep original sessions and terminal tabs open as requested.
      showToast(`已切换目录: ${newProjectDir.split('/').filter(Boolean).pop()}`);
    }
  }, []);

  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    setSavedSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s));
      if (workspaceDir) {
        localStorage.setItem(`aura:agentSessions:${workspaceDir}`, JSON.stringify(next));
      }
      return next;
    });
    setBottomTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
    );
    if (workspaceDir) {
      updateProjectAgentSessionTitle(workspaceDir, id, newTitle)
        .then(() => {
          refreshAgentSessions(workspaceDir);
        })
        .catch((err) => {
          console.error('Failed to sync session rename to SQLite:', err);
        });
    }
  }, [workspaceDir, refreshAgentSessions]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    // Resolve which agent owns this conversation:
    //   1) Aura's ACP mapping (localStorage 'aura:acpConversations') — authoritative for ACP-created sessions
    //   2) the session record Aura loaded from the agent DBs (savedSessions.agentId) — authoritative for everything else
    //   3) nothing → the backend falls back to scanning all agent stores
    const mappedAcpAgent = getAcpConversationAgent(sessionId);
    const trackedAgent = mappedAcpAgent ?? savedSessions.find((s) => s.id === sessionId)?.agentId ?? null;

    handleCloseBottomTab(sessionId, { stopPropagation: () => {} } as any);
    setSavedSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (workspaceDir) {
        localStorage.setItem(`aura:agentSessions:${workspaceDir}`, JSON.stringify(next));
      }
      return next;
    });
    // Drop the local ACP mapping for this conversation (it's gone from the agent DB)
    untrackAcpConversation(sessionId);
    // /save 产生的本地 memo 文件同步删除（EverOS 云端记录无法撤回，保留历史）
    memoryDeleteMemo(sessionId).catch((err) => {
      console.error('Failed to delete /save memo for session:', sessionId, err);
    });
    if (workspaceDir) {
      deleteProjectAgentSession(workspaceDir, sessionId, trackedAgent)
        .then(() => {
          refreshAgentSessions(workspaceDir);
        })
        .catch((err) => {
          console.error('Failed to delete session from SQLite:', err);
        });
    }
  }, [handleCloseBottomTab, workspaceDir, refreshAgentSessions, savedSessions]);

  const handleNewAgentSession = useCallback(() => {
    handleOpenOpenCodeTab();
  }, [handleOpenOpenCodeTab]);

  const handleTogglePlugin = (id: string) => {
    setPlugins((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
      localStorage.setItem('aura:installedPlugins', JSON.stringify(next));
      return next;
    });
  };

  const handleInstallPlugin = (pluginOrId: PluginManifest | string) => {
    setPlugins((prev) => {
      let found = false;
      const id = typeof pluginOrId === 'string' ? pluginOrId : pluginOrId.id;
      const next = prev.map((p) => {
        if (p.id === id) {
          found = true;
          return { ...p, installed: true, enabled: true };
        }
        return p;
      });

      let finalList = next;
      if (!found && typeof pluginOrId !== 'string') {
        finalList = [...next, { ...pluginOrId, installed: true, enabled: true }];
      }
      localStorage.setItem('aura:installedPlugins', JSON.stringify(finalList));
      return finalList;
    });
    showToast('插件安装成功 (Extension Installed)');
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('aura:isSidebarOpen', String(next));
      if (next && sidebarWidth < 180) {
        const restored = lastOpenedSidebarWidth.current >= 180 ? lastOpenedSidebarWidth.current : 260;
        setSidebarWidth(restored);
        localStorage.setItem('aura:sidebarWidth', String(restored));
      }
      return next;
    });
  };

  const handleUninstallPlugin = (id: string) => {
    setPlugins((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, installed: false, enabled: false } : p
      );
      localStorage.setItem('aura:installedPlugins', JSON.stringify(next));
      return next;
    });
    showToast('插件已卸载 (Extension Uninstalled)');
  };

  const [resizingType, setResizingType] = useState<'sidebar' | 'bottom' | 'corner' | null>(null);
  const isResizing = resizingType !== null;

  const handleMouseDownSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebar.current = true;
    setResizingType('sidebar');
    const startX = e.clientX;
    const initialOpen = isSidebarOpen;
    const startWidth = initialOpen ? sidebarWidth : 0;

    let animFrame: number | null = null;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const deltaX = moveEvent.clientX - startX;
        if (!initialOpen) {
          if (deltaX > 20) {
            setIsSidebarOpen(true);
            const targetWidth = Math.max(180, Math.min(600, deltaX > 80 ? deltaX : (lastOpenedSidebarWidth.current || 260)));
            setSidebarWidth(targetWidth);
          }
        } else {
          const rawWidth = startWidth + deltaX;
          if (rawWidth < 120) {
            setIsSidebarOpen(false);
          } else {
            setIsSidebarOpen(true);
            const clamped = Math.max(180, Math.min(600, rawWidth));
            lastOpenedSidebarWidth.current = clamped;
            setSidebarWidth(clamped);
          }
        }
      });
    };

    const handleMouseUp = () => {
      isDraggingSidebar.current = false;
      setResizingType(null);
      if (animFrame) cancelAnimationFrame(animFrame);
      setIsSidebarOpen((latestOpen) => {
        localStorage.setItem('aura:isSidebarOpen', String(latestOpen));
        return latestOpen;
      });
      setSidebarWidth((latest) => {
        if (latest >= 180) {
          localStorage.setItem('aura:sidebarWidth', String(latest));
          lastOpenedSidebarWidth.current = latest;
        }
        return latest;
      });
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDownBottom = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingBottom.current = true;
    setResizingType('bottom');
    const startY = e.clientY;
    const startHeight = bottomHeight;

    let animFrame: number | null = null;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingBottom.current) return;
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const maxHeight = window.innerHeight - 70;
        const newHeight = Math.max(80, Math.min(maxHeight, startHeight - (moveEvent.clientY - startY)));
        setBottomHeight(newHeight);
      });
    };

    const handleMouseUp = () => {
      isDraggingBottom.current = false;
      setResizingType(null);
      if (animFrame) cancelAnimationFrame(animFrame);
      setBottomHeight((latest) => {
        localStorage.setItem('aura:bottomHeight', String(latest));
        return latest;
      });
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDownCorner = (e: React.MouseEvent) => {
    e.preventDefault();
    setResizingType('corner');
    const startX = e.clientX;
    const startY = e.clientY;
    const initialOpen = isSidebarOpen;
    const startWidth = initialOpen ? sidebarWidth : 0;
    const startHeight = bottomHeight;

    let animFrame: number | null = null;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        if (!initialOpen) {
          if (deltaX > 20) {
            setIsSidebarOpen(true);
            const targetWidth = Math.max(180, Math.min(window.innerWidth - 200, deltaX > 80 ? deltaX : (lastOpenedSidebarWidth.current || 260)));
            setSidebarWidth(targetWidth);
          }
        } else {
          const rawWidth = startWidth + deltaX;
          if (rawWidth < 120) {
            setIsSidebarOpen(false);
          } else {
            setIsSidebarOpen(true);
            const clamped = Math.max(180, Math.min(window.innerWidth - 200, rawWidth));
            lastOpenedSidebarWidth.current = clamped;
            setSidebarWidth(clamped);
          }
        }

        if (isBottomOpen) {
          const maxHeight = window.innerHeight - 70;
          const newHeight = Math.max(80, Math.min(maxHeight, startHeight - deltaY));
          setBottomHeight(newHeight);
        }
      });
    };

    const handleMouseUp = () => {
      setResizingType(null);
      if (animFrame) cancelAnimationFrame(animFrame);
      setIsSidebarOpen((latestOpen) => {
        localStorage.setItem('aura:isSidebarOpen', String(latestOpen));
        return latestOpen;
      });
      setSidebarWidth((latest) => {
        if (latest >= 180) {
          localStorage.setItem('aura:sidebarWidth', String(latest));
          lastOpenedSidebarWidth.current = latest;
        }
        return latest;
      });
      setBottomHeight((latest) => {
        localStorage.setItem('aura:bottomHeight', String(latest));
        return latest;
      });
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;
  const activeBottomTab = bottomTabs.find((t) => t.id === activeBottomTabId) || bottomTabs[0];

  return (
    <div
      style={{ backgroundColor: 'var(--aura-app-bg)', color: 'var(--aura-text)' }}
      className="flex flex-col h-screen w-screen overflow-hidden"
    >
      <TopBar
        activeView={activeView}
        workspaceDir={workspaceDir}
        gitBranch={gitBranch}
        isBottomOpen={isBottomOpen}
        isSidebarOpen={isSidebarOpen}
        sidebarWidth={sidebarWidth}
        isResizing={isResizing}
        onChangeView={setActiveView}
        onChangeWorkspaceDir={handleOpenWorkspaceDialog}
        onOpenOpenCode={handleOpenOpenCodeTab}
        onSelectAgent={handleLaunchAgent}
        onRunInstallCommand={handleRunInstallCommand}
        onOpenAddAgentModal={(mode?: 'native' | 'acp') => {
          setAddAgentMode(mode ?? 'native');
          setIsAddAgentModalOpen(true);
        }}
        onToggleSidebar={handleToggleSidebar}
        onToggleBottom={handleToggleTerminalBottom}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGitModal={() => setIsGitModalOpen(true)}
      />

      <div className={`flex flex-1 p-0.5 gap-0 overflow-hidden ${isResizing ? 'select-none pointer-events-auto' : ''}`}>
        <div
          style={{
            width: isSidebarOpen ? `${sidebarWidth}px` : '0px',
            backgroundColor: 'var(--aura-sidebar-bg)',
            color: 'var(--aura-sidebar-fg)',
            borderColor: isSidebarOpen ? 'var(--aura-border)' : 'transparent',
            opacity: isSidebarOpen ? 1 : 0,
            display: isSidebarOpen ? 'block' : 'none',
          }}
          className={`flex-shrink-0 h-full rounded-md overflow-hidden border shadow-xs ${
            isResizing ? 'transition-none' : 'transition-[width,opacity] duration-150'
          }`}
        >
          <Sidebar
            files={files}
            commits={commits}
            plugins={plugins}
            activeView={activeView}
            workspaceDir={workspaceDir}
            agentSessions={agentSessions}
            sidebarWidth={sidebarWidth}
            onSetSidebarWidth={(w) => {
              setSidebarWidth(w);
              lastOpenedSidebarWidth.current = w;
              localStorage.setItem('aura:sidebarWidth', String(w));
            }}
            lang={lang}
            fontSize={sidebarFontSize}
            fontFamily={editorFontFamily}
            onSelectFile={handleSelectFile}
            onTogglePlugin={handleTogglePlugin}
            onInstallPlugin={handleInstallPlugin}
            onUninstallPlugin={handleUninstallPlugin}
            onSelectExtension={handleSelectExtension}
            onChangeView={setActiveView}
            onChangeWorkspaceDir={handleOpenWorkspaceDialog}
            onOpenDiff={handleOpenCommitDiff}
            onRefreshWorkspace={() => loadWorkspace(workspaceDir)}
            onCollapseSidebar={handleToggleSidebar}
            onSelectSession={handleSelectSession}
            onSelectProject={handleSelectProjectFromSession}
            onCloseSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
            onNewAgentSession={handleNewAgentSession}
            onSelectAgent={handleLaunchAgent}
            onRunInstallCommand={handleRunInstallCommand}
            onOpenAddAgentModal={(mode?: 'native' | 'acp') => {
          setAddAgentMode(mode ?? 'native');
          setIsAddAgentModalOpen(true);
        }}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        <div
          onMouseDown={handleMouseDownSidebar}
          onDoubleClick={handleToggleSidebar}
          className={`cursor-col-resize transition-all flex flex-col items-center justify-center select-none z-20 group relative py-0.5 ${
            resizingType === 'sidebar' || resizingType === 'corner'
              ? 'bg-[#007acc] w-1.5 shadow-sm'
              : isCornerHovered
              ? 'bg-[#007acc]/35 w-1.5 shadow-xs'
              : 'hover:bg-[#007acc]/20 ' + (isSidebarOpen
                ? 'w-1.5 rounded-full'
                : 'w-2 bg-black/5 dark:bg-white/5 hover:bg-[#007acc]/30 rounded-r-md border-r border-y border-[var(--aura-border)]')
          }`}
          title={
            isSidebarOpen
              ? '按住鼠标左右拖动调整宽度 (向左拖动小于目录宽度自动收起，双击收起)'
              : '1号窗口已收起：向右拖动或双击此处重新展开'
          }
        >
          {/* When sidebar is collapsed: small expand-to-the-right button on the right side of the splitter */}
          {!isSidebarOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleSidebar();
              }}
              title="向右展开1号窗口 (Expand Panel 1)"
              className="absolute left-full top-2.5 ml-1 z-40 p-1 rounded-md bg-[var(--aura-card-bg,#252526)] border border-[var(--aura-border)] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-[#007acc]/15 hover:border-[var(--aura-accent,#007acc)] shadow-md transition-all cursor-pointer flex items-center justify-center"
            >
              <PanelLeftOpen size={13} />
            </button>
          )}

          {/* 3 dots shifted slightly above vertical center for ergonomic visual alignment */}
          <div className="flex flex-col items-center gap-1 -translate-y-12">
            <div className={`w-0.5 h-0.5 rounded-full transition-colors ${resizingType === 'sidebar' || resizingType === 'corner' ? 'bg-white' : isCornerHovered ? 'bg-[#007acc]' : 'bg-gray-500/50 group-hover:bg-[#007acc]'}`} />
            <div className={`w-0.5 h-0.5 rounded-full transition-colors ${resizingType === 'sidebar' || resizingType === 'corner' ? 'bg-white' : isCornerHovered ? 'bg-[#007acc]' : 'bg-gray-500/50 group-hover:bg-[#007acc]'}`} />
            <div className={`w-0.5 h-0.5 rounded-full transition-colors ${resizingType === 'sidebar' || resizingType === 'corner' ? 'bg-white' : isCornerHovered ? 'bg-[#007acc]' : 'bg-gray-500/50 group-hover:bg-[#007acc]'}`} />
          </div>
        </div>

        <div className="relative flex-1 flex flex-col h-full gap-0 overflow-hidden">
          {/* VS Code-style invisible intersection resize area at 1, 2, 3 windows junction */}
          {isBottomOpen && (
            <div
              onMouseDown={handleMouseDownCorner}
              style={{
                bottom: `${bottomHeight}px`,
                transform: 'translate(-50%, 50%)',
              }}
              className="absolute left-0 z-30 w-5 h-5 cursor-move pointer-events-auto bg-transparent select-none"
              title="十字交叉点 (按住拖动可同时调整侧边栏宽度与终端高度)"
            />
          )}

          <div
            id="editor-container-root"
            onMouseEnter={() => { hoveredWindowRef.current = 2; }}
            style={{
              backgroundColor: 'var(--aura-editor-bg)',
              color: 'var(--aura-editor-fg)',
              borderColor: 'var(--aura-border)'
            }}
            className="flex-1 flex flex-col overflow-hidden min-h-[40px] rounded-md border shadow-xs"
          >
            <CodeEditor
              activeTab={activeTab}
              tabs={tabs}
              plugins={plugins}
              themeId={themeId}
              fontSize={editorFontSize}
              fontFamily={editorFontFamily}
              onSelectTab={(t) => setActiveTabId(t.id)}
              onCloseTab={handleCloseTab}
              onChangeContent={handleChangeContent}
              onSave={handleSave}
              onQuitNoSave={() => {
                if (activeTabId) handleCloseTab(activeTabId);
              }}
              onTogglePlugin={handleTogglePlugin}
              onInstallPlugin={handleInstallPlugin}
              onUninstallPlugin={handleUninstallPlugin}
              workspaceDir={workspaceDir}
              onOpenFileByPath={handleOpenFileByPath}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={handleToggleSidebar}
            />
          </div>

          <div className="relative flex-shrink-0 flex flex-col w-full">
            <BottomDockArea
              workspaceReady={workspaceReady}
              workspaceDir={workspaceDir}
              themeId={themeId}
              fontSize={terminalFontSize}
              fontFamily={terminalFontFamily}
              bottomTabs={bottomTabs}
              activeBottomTabId={activeBottomTabId}
              focusedPaneId={focusedPaneIdRef.current}
              isBottomOpen={isBottomOpen}
              bottomHeight={bottomHeight}
              isResizing={isResizing}
              resizingType={resizingType}
              editingDockTabId={editingDockTabId}
              editingDockTabTitle={editingDockTabTitle}
              dockRenameInputRef={dockRenameInputRef}
              acpStatus={acpStatusMap}
              onAcpStatusChange={handleAcpStatusChange}
              onPaneFocus={(paneId) => {
                focusedPaneIdRef.current = paneId;
              }}
              onMouseDownBottom={handleMouseDownBottom}
              onSelectDockTab={handleSelectDockTab}
              onStartRenameDockTab={handleStartRenameDockTab}
              onChangeRenameTitle={handleChangeRenameTitle}
              onConfirmRename={handleConfirmDockRename}
              onCancelRename={handleCancelRename}
              onCloseDockTab={handleCloseBottomTab}
              onNewTerminalTab={handleNewTerminalTab}
              onToggleHeight={handleToggleBottomHeight}
              onCloseDock={handleCloseDock}
            />
          </div>
        </div>
      </div>

      <QuickPicker
        isOpen={isQuickPickerOpen}
        onClose={() => setIsQuickPickerOpen(false)}
        onSelect={handleQuickPickSelect}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        workspaceDir={workspaceDir}
        lang={lang}
        themeId={themeId}
        plugins={plugins}
        onTogglePlugin={handleTogglePlugin}
        onInstallPlugin={handleInstallPlugin}
        onUninstallPlugin={handleUninstallPlugin}
        onClose={() => setIsSettingsOpen(false)}
        onChangeWorkspace={handleOpenWorkspaceDialog}
        onChangeLang={setLang}
        onChangeTheme={(newThemeId) => {
          setThemeId(newThemeId);
          applyThemeToDocument(getThemeById(newThemeId));
        }}
        onSaveToast={(msg) => {
          const updatedSize = Number(localStorage.getItem('aura:fontSize') || '14');
          setEditorFontSize(updatedSize);
          const updatedSidebarSize = Number(localStorage.getItem('aura:sidebarFontSize') || '14');
          setSidebarFontSize(updatedSidebarSize);
          const updatedTermSize = Number(localStorage.getItem('aura:terminalFontSize') || '13.5');
          setTerminalFontSize(updatedTermSize);
          const updatedEditorFont = localStorage.getItem('aura:editorFontFamily') || 'JetBrains Mono';
          setEditorFontFamily(updatedEditorFont);
          const updatedTermFont = localStorage.getItem('aura:terminalFontFamily') || 'JetBrains Mono';
          setTerminalFontFamily(updatedTermFont);
          showToast(msg);
        }}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <AddAgentModal
        isOpen={isAddAgentModalOpen}
        onClose={() => setIsAddAgentModalOpen(false)}
        mode={addAgentMode}
        onAgentAdded={(agent) => handleLaunchAgent(agent)}
      />

      <GitModal
        isOpen={isGitModalOpen}
        workspaceDir={workspaceDir}
        gitBranch={gitBranch}
        commits={commits}
        files={files}
        onClose={() => setIsGitModalOpen(false)}
        onOpenDiff={handleOpenCommitDiff}
        onSelectFile={handleSelectFile}
      />

      {/* Floating in-app Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95">
          <div className="bg-[#1e1e1e]/90 text-white text-xs px-4 py-2 rounded-full shadow-2xl border border-white/20 backdrop-blur-md flex items-center gap-2 font-mono tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#007acc] animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
