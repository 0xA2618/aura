import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { CodeEditor } from './components/CodeEditor';
import { TerminalPane } from './components/TerminalPane';
import { OpenCodeChat } from './components/OpenCodeChat';
import { QuickPicker } from './components/QuickPicker';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import {
  FileItem,
  OpenTab,
  BottomTab,
  PaneLayoutNode,
  PaneSplitDirection,
  GitCommit,
  PluginManifest,
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
  isTauri,
  exitApp,
} from './services/fileService';
import { Terminal, Bot, Plus, X, ChevronUp, ChevronDown, Check } from 'lucide-react';

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
  bottomTabs: BottomTab[];
  activeBottomTabId: string;
  focusedPaneId?: string;
  isBottomOpen: boolean;
  bottomHeight: number;
  isResizing: boolean;
  editingDockTabId: string | null;
  editingDockTabTitle: string;
  dockRenameInputRef: any;
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
  bottomTabs,
  activeBottomTabId,
  focusedPaneId,
  isBottomOpen,
  bottomHeight,
  isResizing,
  editingDockTabId,
  editingDockTabTitle,
  dockRenameInputRef,
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
        className="h-1.5 hover:h-1.5 cursor-row-resize hover:bg-[#007acc]/20 rounded-full transition-colors flex items-center justify-center gap-1 select-none z-20 group relative my-0"
        title="按住鼠标上下拖动调整高度"
      >
        <div className="w-0.5 h-0.5 rounded-full bg-gray-500/50 group-hover:bg-[#007acc] transition-colors" />
        <div className="w-0.5 h-0.5 rounded-full bg-gray-500/50 group-hover:bg-[#007acc] transition-colors" />
        <div className="w-0.5 h-0.5 rounded-full bg-gray-500/50 group-hover:bg-[#007acc] transition-colors" />
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
              const Icon = bt.type === 'terminal' ? Terminal : Bot;
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
                  <Icon
                    size={13}
                    className={bt.type === 'terminal' ? 'text-green-400' : 'text-[#007acc]'}
                  />
                  {isRenaming ? (
                    <input
                      ref={dockRenameInputRef}
                      type="text"
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
                    <span className="font-mono text-[11.5px]">{bt.title}</span>
                  )}
                  <button
                    onClick={(e) => onCloseDockTab(bt.id, e)}
                    className="hover:bg-[#404040] rounded p-0.5 ml-1 text-gray-400 hover:text-white"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}

            <button
              onClick={onNewTerminalTab}
              title="新建终端 (New Terminal)"
              className="p-1 hover:bg-black/10 dark:hover:bg-[#333333] rounded-md text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] ml-1"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onToggleHeight}
              title="切换高度"
              className="p-1 hover:bg-black/10 dark:hover:bg-[#333333] rounded-md text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]"
            >
              {bottomHeight === 480 ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
            <button
              onClick={onCloseDock}
              title="最小化收起 (Space + oc)"
              className="p-1 hover:bg-black/10 dark:hover:bg-[#333333] rounded-md text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]"
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
                writeTerminalPTY(targetTerminalId, `${droppedPath} `);
              }
              if ((window as any).electronAPI) {
                (window as any).electronAPI.terminalWrite(activeBottomTab.id, `${droppedPath} `);
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
                    <TerminalPane
                      id={leaf.id}
                      cwd={workspaceDir || undefined}
                      mode={bt.type === 'terminal' ? 'shell' : 'opencode'}
                      themeId={themeId}
                      fontSize={fontSize}
                    />
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
    prev.activeBottomTabId === next.activeBottomTabId &&
    prev.isBottomOpen === next.isBottomOpen &&
    prev.bottomHeight === next.bottomHeight &&
    prev.isResizing === next.isResizing &&
    prev.editingDockTabId === next.editingDockTabId &&
    prev.editingDockTabTitle === next.editingDockTabTitle &&
    prev.bottomTabs === next.bottomTabs
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
  const [editorFontSize, setEditorFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura:fontSize') || '13');
  });
  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura:terminalFontSize') || '13.5');
  });

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
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    const saved = localStorage.getItem('aura:bottomHeight');
    return saved ? Number(saved) : 460;
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('aura:sidebarWidth');
    return saved ? Number(saved) : 260;
  });
  const isDraggingSidebar = useRef(false);
  const isDraggingBottom = useRef(false);

  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
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
    const fileList = await fetchDirectory(targetDir || undefined);
    setFiles(fileList);
    const commitList = await fetchGitCommits(targetDir || undefined);
    setCommits(commitList);
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
    const currentTheme = getThemeById(themeId);
    applyThemeToDocument(currentTheme);
  }, [themeId]);

  useEffect(() => {
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

        if (isFocusInWindow1) {
          return;
        }

        if (isFocusInWindow3) {
          setTerminalFontSize((prev) => {
            const next = Math.min(28, prev + 1);
            localStorage.setItem('aura:terminalFontSize', String(next));
            showToast(`终端字号: ${next}px`);
            return next;
          });
        } else {
          setEditorFontSize((prev) => {
            const next = Math.min(32, prev + 1);
            localStorage.setItem('aura:fontSize', String(next));
            showToast(`编辑器字号: ${next}px`);
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

        if (isFocusInWindow1) {
          return;
        }

        if (isFocusInWindow3) {
          setTerminalFontSize((prev) => {
            const next = Math.max(9, prev - 1);
            localStorage.setItem('aura:terminalFontSize', String(next));
            showToast(`终端字号: ${next}px`);
            return next;
          });
        } else {
          setEditorFontSize((prev) => {
            const next = Math.max(9, prev - 1);
            localStorage.setItem('aura:fontSize', String(next));
            showToast(`编辑器字号: ${next}px`);
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

  const handleSelectFile = async (file: FileItem, viewMode?: 'editor' | 'markdown-preview' | 'markmap' | 'outline') => {
    if (file.isDirectory) return;

    let targetTab: OpenTab | undefined = undefined;
    setTabs((currentTabs) => {
      targetTab = currentTabs.find((t) => t.path === file.path);
      return currentTabs;
    });

    const isMarkdown = file.name.toLowerCase().endsWith('.md');
    const resolvedMode = viewMode || (isMarkdown ? ((localStorage.getItem('aura:defaultMarkdownMode') as any) || 'editor') : 'editor');

    if (targetTab) {
      if (viewMode && (targetTab as OpenTab).viewMode !== viewMode) {
        setTabs((prev) =>
          prev.map((t) => (t.path === file.path ? { ...t, viewMode } : t))
        );
      }
      setActiveTabId((targetTab as OpenTab).id);
      return;
    }

    const content = await fetchFileContent(file.path);
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

  const handleOpenFileByPath = async (filePath: string) => {
    const fileName = filePath.split('/').pop() || filePath;
    await handleSelectFile({
      name: fileName,
      path: filePath,
      isDirectory: false,
    });
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
    const title = count === 0 ? 'OpenCode' : `OpenCode ${count + 1}`;
    const newBottomTab: BottomTab = { id, type: 'opencode', title };
    setBottomTabs((prev) => [...prev, newBottomTab]);
    setActiveBottomTabId(id);
    focusActiveTerminal(id);
  };

  const handleCloseActiveBottomTab = () => {
    const curTabId = activeBottomTabIdRef.current;
    if (!curTabId) return;

    const currentTab = bottomTabsRef.current.find((t) => t.id === curTabId);
    if (!currentTab) return;

    const currentLayout: PaneLayoutNode = currentTab.rootLayout || { type: 'leaf', id: currentTab.id };
    const currentPanes = collectLeafPaneIds(currentLayout);
    const focusedPane = (focusedPaneIdRef.current && currentPanes.includes(focusedPaneIdRef.current))
      ? focusedPaneIdRef.current
      : currentPanes[0];

    if (currentPanes.length > 1) {
      killTerminalPTY(focusedPane);
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
      killTerminalPTY(pid);
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
    const panesToKill = tabToClose ? collectLeafPaneIds(tabToClose.rootLayout || { type: 'leaf', id: tabToClose.id }) : [id];
    panesToKill.forEach((pid) => {
      killTerminalPTY(pid);
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

  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDownSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebar.current = true;
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    let animFrame: number | null = null;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const newWidth = Math.max(180, Math.min(600, startWidth + (moveEvent.clientX - startX)));
        setSidebarWidth(newWidth);
      });
    };

    const handleMouseUp = () => {
      isDraggingSidebar.current = false;
      setIsResizing(false);
      if (animFrame) cancelAnimationFrame(animFrame);
      setSidebarWidth((latest) => {
        localStorage.setItem('aura:sidebarWidth', String(latest));
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
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = bottomHeight;

    let animFrame: number | null = null;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingBottom.current) return;
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const newHeight = Math.max(180, Math.min(800, startHeight - (moveEvent.clientY - startY)));
        setBottomHeight(newHeight);
      });
    };

    const handleMouseUp = () => {
      isDraggingBottom.current = false;
      setIsResizing(false);
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
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = sidebarWidth;
    const startHeight = bottomHeight;

    let animFrame: number | null = null;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const newWidth = Math.max(180, Math.min(600, startWidth + (moveEvent.clientX - startX)));
        const newHeight = Math.max(180, Math.min(800, startHeight - (moveEvent.clientY - startY)));
        setSidebarWidth(newWidth);
        setBottomHeight(newHeight);
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (animFrame) cancelAnimationFrame(animFrame);
      setSidebarWidth((latest) => {
        localStorage.setItem('aura:sidebarWidth', String(latest));
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
        isBottomOpen={isBottomOpen}
        onChangeView={setActiveView}
        onOpenOpenCode={handleOpenOpenCodeTab}
        onToggleBottom={handleToggleTerminalBottom}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className={`flex flex-1 p-0.5 gap-0 overflow-hidden ${isResizing ? 'select-none pointer-events-auto' : ''}`}>
        <div
          style={{
            width: `${sidebarWidth}px`,
            backgroundColor: 'var(--aura-sidebar-bg)',
            color: 'var(--aura-sidebar-fg, var(--aura-text))',
            borderColor: 'var(--aura-border)'
          }}
          className={`flex-shrink-0 h-full rounded-md overflow-hidden border shadow-xs ${
            isResizing ? 'transition-none' : 'transition-[width] duration-75'
          }`}
        >
          <Sidebar
            files={files}
            commits={commits}
            plugins={plugins}
            activeView={activeView}
            workspaceDir={workspaceDir}
            lang={lang}
            onSelectFile={handleSelectFile}
            onTogglePlugin={handleTogglePlugin}
            onInstallPlugin={handleInstallPlugin}
            onUninstallPlugin={handleUninstallPlugin}
            onSelectExtension={handleSelectExtension}
            onChangeView={setActiveView}
            onChangeWorkspaceDir={handleOpenWorkspaceDialog}
            onOpenDiff={handleOpenCommitDiff}
            onRefreshWorkspace={() => loadWorkspace(workspaceDir)}
          />
        </div>

        <div
          onMouseDown={handleMouseDownSidebar}
          className="w-1.5 hover:w-1.5 cursor-col-resize hover:bg-[#007acc]/20 rounded-full transition-colors flex flex-col items-center justify-center gap-1 select-none z-20 group relative py-0.5"
          title="按住鼠标左右拖动调整宽度"
        >
          <div className="w-0.5 h-0.5 rounded-full bg-gray-500/50 group-hover:bg-[#007acc] transition-colors" />
          <div className="w-0.5 h-0.5 rounded-full bg-gray-500/50 group-hover:bg-[#007acc] transition-colors" />
          <div className="w-0.5 h-0.5 rounded-full bg-gray-500/50 group-hover:bg-[#007acc] transition-colors" />
        </div>

        <div className="flex-1 flex flex-col h-full gap-0 overflow-hidden">
          <div
            style={{
              backgroundColor: 'var(--aura-editor-bg)',
              color: 'var(--aura-editor-fg, var(--aura-text))',
              borderColor: 'var(--aura-border)'
            }}
            className="flex-1 overflow-hidden min-h-[160px] rounded-md border shadow-xs"
          >
            <CodeEditor
              activeTab={activeTab}
              tabs={tabs}
              plugins={plugins}
              themeId={themeId}
              fontSize={editorFontSize}
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
            />
          </div>

          <div className="relative flex-shrink-0 flex flex-col w-full">
            <BottomDockArea
              workspaceReady={workspaceReady}
              workspaceDir={workspaceDir}
              themeId={themeId}
              fontSize={terminalFontSize}
              bottomTabs={bottomTabs}
              activeBottomTabId={activeBottomTabId}
              focusedPaneId={focusedPaneIdRef.current}
              isBottomOpen={isBottomOpen}
              bottomHeight={bottomHeight}
              isResizing={isResizing}
              editingDockTabId={editingDockTabId}
              editingDockTabTitle={editingDockTabTitle}
              dockRenameInputRef={dockRenameInputRef}
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
        onClose={() => setIsSettingsOpen(false)}
        onChangeWorkspace={handleOpenWorkspaceDialog}
        onChangeLang={setLang}
        onChangeTheme={(newThemeId) => {
          setThemeId(newThemeId);
          applyThemeToDocument(getThemeById(newThemeId));
        }}
        onSaveToast={(msg) => {
          const updatedSize = Number(localStorage.getItem('aura:fontSize') || '13');
          setEditorFontSize(updatedSize);
          showToast(msg);
        }}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
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
