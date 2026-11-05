import React, { useState, useEffect, useRef } from 'react';
import { FileItem, GitCommit, PluginManifest } from '../types';
import {
  fetchDirectory,
  createFileSystemEntry,
  deleteFileSystemEntry,
  renameFileSystemEntry,
  searchOpenVsxMarketplace,
  fetchCommitChangedFiles,
  fetchGitStatus,
} from '../services/fileService';
import {
  FileCode,
  FileText,
  ChevronRight,
  ChevronDown,
  GitBranch,
  GitCommit as GitCommitIcon,
  Puzzle,
  Copy,
  Check,
  FolderSync,
  Files,
  Search,
  LayoutGrid,
  FilePlus,
  FolderPlus,
  RotateCw,
  Download,
  Star,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Settings,
  MoreHorizontal,
  SlidersHorizontal,
  GitPullRequest,
  History,
  FileDiff,
} from 'lucide-react';
import { PLUGIN_LOGOS } from '../services/pluginLogos';
import { FileIcon } from './FileIcon';
import { computeVSCodeHistoryViewModels, HistoryItemViewModel, SWIMLANE_WIDTH, SWIMLANE_HEIGHT } from '../services/gitTopology';

import { SupportedLang, translations } from '../services/i18n';

interface SidebarProps {
  files: FileItem[];
  commits: GitCommit[];
  plugins: PluginManifest[];
  activeView: 'files' | 'git' | 'plugins';
  workspaceDir: string;
  lang?: SupportedLang;
  isFocused?: boolean;
  onSelectFile: (file: FileItem, viewMode?: 'editor' | 'markdown-preview' | 'markmap' | 'outline') => void;
  onOpenDiff?: (commitHash: string, filePath: string) => void;
  onTogglePlugin: (id: string) => void;
  onInstallPlugin?: (plugin: PluginManifest) => void;
  onUninstallPlugin?: (id: string) => void;
  onSelectExtension?: (extension: PluginManifest) => void;
  onChangeView: (view: 'files' | 'git' | 'plugins') => void;
  onChangeWorkspaceDir: () => void;
  onRefreshWorkspace: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  commits,
  plugins,
  activeView,
  workspaceDir,
  lang = 'zh-CN',
  isFocused = false,
  onSelectFile,
  onOpenDiff,
  onTogglePlugin,
  onInstallPlugin,
  onUninstallPlugin,
  onSelectExtension,
  onChangeView,
  onChangeWorkspaceDir,
  onRefreshWorkspace,
}) => {
  const t = translations[lang];
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [folderChildren, setFolderChildren] = useState<Record<string, FileItem[]>>({});
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const [disableMoveConfirm, setDisableMoveConfirm] = useState<boolean>(() => {
    return localStorage.getItem('aura:disableMoveConfirm') === 'true';
  });
  const [doNotAskAgainChecked, setDoNotAskAgainChecked] = useState(false);

  const [inlineCreateParent, setInlineCreateParent] = useState<{
    dirPath: string;
    level: number;
  } | null>(null);
  const [inlineInputVal, setInlineInputVal] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const [actionModal, setActionModal] = useState<{
    type: 'delete' | 'move';
    title: string;
    defaultValue?: string;
    targetPath?: string;
    sourcePath?: string;
    destinationPath?: string;
    sourceParent?: string;
    targetDirPath?: string;
    warningMessage?: string;
  } | null>(null);

  const [inlineRenameItem, setInlineRenameItem] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [inlineRenameVal, setInlineRenameVal] = useState('');
  const inlineRenameInputRef = useRef<HTMLInputElement>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileItem;
  } | null>(null);

  const [openWithModalItem, setOpenWithModalItem] = useState<FileItem | null>(null);

  const [pluginSearchQuery, setPluginSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<PluginManifest[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [openSettingsPluginId, setOpenSettingsPluginId] = useState<string | null>(null);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitFilesMap, setCommitFilesMap] = useState<Record<string, { path: string; status: string }[]>>({});
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [gitViewSection, setGitViewSection] = useState<'changes' | 'history'>('history');
  const [gitStatusData, setGitStatusData] = useState<{ totalChanged: number; files: FileItem[] }>({
    totalChanged: 0,
    files: [],
  });

  useEffect(() => {
    let isMounted = true;
    const updateStatus = async () => {
      if (!workspaceDir) return;
      const status = await fetchGitStatus(workspaceDir);
      if (isMounted) {
        setGitStatusData(status);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1500);

    const onFocus = () => updateStatus();
    window.addEventListener('focus', onFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [workspaceDir, activeView]);

  useEffect(() => {
    if (!selectedCommitHash) return;
    if (!commitFilesMap[selectedCommitHash]) {
      fetchCommitChangedFiles(selectedCommitHash, workspaceDir).then((files) => {
        setCommitFilesMap((prev) => ({ ...prev, [selectedCommitHash]: files }));
      });
    }
  }, [selectedCommitHash, workspaceDir]);

  useEffect(() => {
    setOpenFolders({});
    setFolderChildren({});
    setSelectedItem(null);
    setSelectedPaths(new Set());
  }, [workspaceDir]);

  useEffect(() => {
    const handleCloseSettingsMenu = () => setOpenSettingsPluginId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setActionModal(null);
        setOpenWithModalItem(null);
        setInlineRenameItem(null);
        setInlineCreateParent(null);
        setSelectedItem(null);
        setSelectedPaths(new Set());
      }
    };

    window.addEventListener('click', handleCloseSettingsMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleCloseSettingsMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!pluginSearchQuery.trim()) {
      setOnlineResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOnline(true);
      const res = await searchOpenVsxMarketplace(pluginSearchQuery);
      setOnlineResults(res);
      setIsSearchingOnline(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [pluginSearchQuery]);

  const toggleFolder = async (folderPath: string) => {
    const nextOpen = !openFolders[folderPath];
    setOpenFolders((prev) => ({ ...prev, [folderPath]: nextOpen }));

    if (nextOpen && !folderChildren[folderPath]) {
      const children = await fetchDirectory(folderPath);
      setFolderChildren((prev) => ({ ...prev, [folderPath]: children }));
    }
  };

  const copyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1200);
  };

  const getVisibleItems = (): FileItem[] => {
    const result: FileItem[] = [];
    const traverse = (items: FileItem[]) => {
      for (const item of items) {
        result.push(item);
        if (item.isDirectory && openFolders[item.path]) {
          const children = folderChildren[item.path] || item.children;
          if (children) traverse(children);
        }
      }
    };
    traverse(files);
    return result;
  };

  const handleActionCreate = (asFolder = false) => {
    let targetDir = workspaceDir;
    let targetLevel = 0;

    if (selectedItem) {
      if (selectedItem.isDirectory) {
        targetDir = selectedItem.path;
        if (!openFolders[selectedItem.path]) {
          toggleFolder(selectedItem.path);
        }
      } else {
        targetDir = selectedItem.path.split('/').slice(0, -1).join('/');
      }
    }

    setInlineCreateParent({ dirPath: targetDir, level: targetLevel });
    setInlineInputVal(asFolder ? '/' : '');
  };

  const handleCollapseAll = () => {
    setOpenFolders({});
  };

  const handleActionOpen = () => {
    if (!selectedItem) return;
    if (selectedItem.isDirectory) {
      toggleFolder(selectedItem.path);
    } else {
      onSelectFile(selectedItem);
    }
  };

  const handleActionRename = () => {
    if (!selectedItem) return;
    setInlineRenameItem({
      path: selectedItem.path,
      name: selectedItem.name,
    });
    setInlineRenameVal(selectedItem.name);
  };

  const handleActionDelete = () => {
    if (!selectedItem) return;
    setActionModal({
      type: 'delete',
      title: `Are you sure you want to permanently delete '${selectedItem.name}'?`,
      defaultValue: selectedItem.path,
      targetPath: selectedItem.path,
    });
  };

  useEffect(() => {
    const handleFocusSidebarEvent = (e: any) => {
      const resetToFirst = e.detail?.resetToFirst;
      if (resetToFirst) {
        const visible = getVisibleItems();
        if (visible.length > 0) {
          setSelectedItem(visible[0]);
        }
      }
    };
    window.addEventListener('aura:focus-sidebar', handleFocusSidebarEvent);
    return () => window.removeEventListener('aura:focus-sidebar', handleFocusSidebarEvent);
  }, [files, openFolders, folderChildren]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== document.getElementById('sidebar-container')) return;
      if (inlineCreateParent || actionModal || inlineRenameItem) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const visible = getVisibleItems();
      if (visible.length === 0) return;

      const currentIdx = selectedItem ? visible.findIndex((v) => v.path === selectedItem.path) : -1;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIdx === -1) {
          setSelectedItem(visible[0]);
        } else if (currentIdx < visible.length - 1) {
          setSelectedItem(visible[currentIdx + 1]);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIdx > 0) {
          setSelectedItem(visible[currentIdx - 1]);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedItem?.isDirectory) {
          toggleFolder(selectedItem.path);
        } else {
          handleActionRename();
        }
      } else if (e.key === 'o') {
        e.preventDefault();
        handleActionOpen();
      } else if (e.key === 'a') {
        e.preventDefault();
        handleActionCreate(false);
      } else if (e.key === 'd') {
        e.preventDefault();
        handleActionDelete();
      } else if (e.key === 'r') {
        e.preventDefault();
        handleActionRename();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, inlineCreateParent, actionModal, inlineRenameItem, openFolders, folderChildren, files, workspaceDir]);

  useEffect(() => {
    if (inlineCreateParent && inlineInputRef.current) {
      setTimeout(() => inlineInputRef.current?.focus(), 40);
    }
  }, [inlineCreateParent]);

  useEffect(() => {
    if (inlineRenameItem && inlineRenameInputRef.current) {
      setTimeout(() => {
        inlineRenameInputRef.current?.focus();
        inlineRenameInputRef.current?.select();
      }, 40);
    }
  }, [inlineRenameItem]);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (actionModal) {
      if (confirmBtnRef.current) {
        setTimeout(() => confirmBtnRef.current?.focus(), 40);
      }

      const handleModalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setActionModal(null);
        } else if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          if (document.activeElement === confirmBtnRef.current) {
            cancelBtnRef.current?.focus();
          } else {
            confirmBtnRef.current?.focus();
          }
        }
      };

      window.addEventListener('keydown', handleModalKeyDown, true);
      return () => window.removeEventListener('keydown', handleModalKeyDown, true);
    }
  }, [actionModal]);

  const refreshParentFolder = async (folderPath: string) => {
    const updated = await fetchDirectory(folderPath);
    setFolderChildren((prev) => ({ ...prev, [folderPath]: updated }));
  };

  const handleConfirmInlineCreate = async () => {
    if (!inlineCreateParent) return;
    const trimmed = inlineInputVal.trim();
    if (!trimmed) {
      setInlineCreateParent(null);
      return;
    }

    const isDir = trimmed.endsWith('/');
    const cleanName = isDir ? trimmed.slice(0, -1) : trimmed;
    const targetPath = `${inlineCreateParent.dirPath}/${cleanName}`;
    const parentDir = inlineCreateParent.dirPath;

    if (isDir) {
      setFolderChildren((prev) => ({
        ...prev,
        [targetPath]: [],
      }));
      setOpenFolders((prev) => ({ ...prev, [targetPath]: true }));
    }

    await createFileSystemEntry(targetPath, isDir);
    setInlineCreateParent(null);

    await refreshParentFolder(parentDir);
    onRefreshWorkspace();

    if (!isDir) {
      onSelectFile({
        name: cleanName,
        path: targetPath,
        isDirectory: false,
      });
    }
  };

  const handleConfirmInlineRename = async () => {
    if (!inlineRenameItem) return;
    const trimmed = inlineRenameVal.trim();
    if (trimmed && trimmed !== inlineRenameItem.name) {
      const parent = inlineRenameItem.path.split('/').slice(0, -1).join('/');
      const newPath = `${parent}/${trimmed}`;
      await renameFileSystemEntry(inlineRenameItem.path, newPath);
      await refreshParentFolder(parent);
      onRefreshWorkspace();
    }
    setInlineRenameItem(null);
  };

  const handleMoveEntry = async (sourcePath: string, targetDirPath: string) => {
    if (!sourcePath || !targetDirPath) return;
    if (sourcePath === targetDirPath) return;

    if (targetDirPath.startsWith(`${sourcePath}/`)) {
      setActionModal({
        type: 'move',
        title: '无法移动：目标位置无效',
        defaultValue: `目标位置 '${targetDirPath}' 是源文件夹的子文件夹`,
        warningMessage: '不能将一个文件夹拖入到其自身的内部或子目录中。',
      });
      return;
    }

    const sourceParent = sourcePath.split('/').slice(0, -1).join('/');
    if (sourceParent === targetDirPath) {
      return;
    }

    const itemName = sourcePath.split('/').pop();
    if (!itemName) return;
    const destinationPath = `${targetDirPath}/${itemName}`;

    const targetDirName = targetDirPath === workspaceDir ? (workspaceDir.split('/').filter(Boolean).pop() || 'workspace') : (targetDirPath.split('/').filter(Boolean).pop() || targetDirPath);

    if (disableMoveConfirm) {
      await executeMoveEntry(sourcePath, destinationPath, sourceParent, targetDirPath);
      return;
    }

    setDoNotAskAgainChecked(false);
    setActionModal({
      type: 'move',
      title: `Are you sure you want to move\n'${itemName}' into '${targetDirName}'?`,
      defaultValue: itemName,
      sourcePath,
      destinationPath,
      sourceParent,
      targetDirPath,
    });
  };

  const executeMoveEntry = async (sourcePath: string, destinationPath: string, sourceParent: string, targetDirPath: string) => {
    try {
      const ok = await renameFileSystemEntry(sourcePath, destinationPath);
      if (ok) {
        setFolderChildren((prev) => {
          const next = { ...prev };
          delete next[sourceParent];
          delete next[targetDirPath];
          return next;
        });

        if (sourceParent && sourceParent !== workspaceDir) {
          const pChildren = await fetchDirectory(sourceParent);
          setFolderChildren((prev) => ({ ...prev, [sourceParent]: pChildren }));
        }
        if (targetDirPath && targetDirPath !== workspaceDir) {
          setOpenFolders((prev) => ({ ...prev, [targetDirPath]: true }));
          const tChildren = await fetchDirectory(targetDirPath);
          setFolderChildren((prev) => ({ ...prev, [targetDirPath]: tChildren }));
        }

        onRefreshWorkspace();
      }
    } catch (err) {
      console.error('[Move Error]', err);
    }
  };

  const handleConfirmActionModal = async () => {
    if (!actionModal) return;

    if (actionModal.type === 'delete' && actionModal.targetPath) {
      const parent = actionModal.targetPath.split('/').slice(0, -1).join('/');
      const deletedPath = actionModal.targetPath;
      await deleteFileSystemEntry(deletedPath);
      setSelectedItem(null);

      setFolderChildren((prev) => {
        const next = { ...prev };
        delete next[deletedPath];
        for (const k of Object.keys(next)) {
          if (k.startsWith(`${deletedPath}/`)) {
            delete next[k];
          }
        }
        return next;
      });

      setOpenFolders((prev) => {
        const next = { ...prev };
        delete next[deletedPath];
        for (const k of Object.keys(next)) {
          if (k.startsWith(`${deletedPath}/`)) {
            delete next[k];
          }
        }
        return next;
      });

      await refreshParentFolder(parent);
      onRefreshWorkspace();
    } else if (actionModal.type === 'move' && actionModal.sourcePath && actionModal.destinationPath) {
      if (doNotAskAgainChecked) {
        localStorage.setItem('aura:disableMoveConfirm', 'true');
        setDisableMoveConfirm(true);
      }
      await executeMoveEntry(
        actionModal.sourcePath,
        actionModal.destinationPath,
        actionModal.sourceParent || '',
        actionModal.targetDirPath || ''
      );
    }

    setActionModal(null);
  };

  const currentDirName = workspaceDir ? workspaceDir.split('/').filter(Boolean).pop() || 'workspace' : 'workspace';

  const changedCount = gitStatusData.totalChanged > 0
    ? gitStatusData.totalChanged
    : files.filter((f) => f.gitStatus).length;

  const navTabs = [
    { id: 'files' as const, icon: Files, title: '文件资源 (Files)' },
    {
      id: 'git' as const,
      icon: GitBranch,
      title: '源代码管理 (Git)',
      badge: changedCount > 0 ? String(changedCount) : undefined,
    },
    { id: 'plugins' as const, icon: LayoutGrid, title: '扩展插件 (Plugins)' },
  ];

  const renderFileTree = (items: FileItem[], level = 0, parentDirPath = workspaceDir) => {
    return (
      <div>
        {items.map((item) => {
          const isDir = item.isDirectory;
          const isOpen = openFolders[item.path];
          const isSelected = selectedPaths.has(item.path) || selectedItem?.path === item.path;
          const isRenaming = inlineRenameItem?.path === item.path;
          const isDragOver = dragOverPath === item.path;

          return (
            <div key={item.path}>
              <div
                draggable={!isRenaming}
                data-aura-path={item.path}
                onDragStart={(e) => {
                  (window as any).__AURA_DRAGGED_PATH__ = item.path;
                  e.dataTransfer.setData('text/plain', item.path);
                  e.dataTransfer.setData('application/aura-path', item.path);
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                onDragEnd={() => {
                  setTimeout(() => {
                    (window as any).__AURA_DRAGGED_PATH__ = null;
                  }, 300);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  if (isDir) {
                    if (dragOverPath !== item.path) {
                      setDragOverPath(item.path);
                    }
                  } else {
                    const parentOfFile = item.path.split('/').slice(0, -1).join('/') || workspaceDir;
                    if (dragOverPath !== parentOfFile) {
                      setDragOverPath(parentOfFile);
                    }
                  }
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const related = e.relatedTarget as HTMLElement;
                  if (!related || !e.currentTarget.contains(related)) {
                    if (dragOverPath === item.path) {
                      setDragOverPath(null);
                    }
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverPath(null);
                  const sourcePath =
                    (window as any).__AURA_DRAGGED_PATH__ ||
                    e.dataTransfer.getData('application/aura-path') ||
                    e.dataTransfer.getData('text/plain');
                  if (sourcePath) {
                    const targetDir = isDir
                      ? item.path
                      : (item.path.split('/').slice(0, -1).join('/') || workspaceDir);
                    handleMoveEntry(sourcePath, targetDir);
                  }
                }}
                onClick={(e) => {
                  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
                  const isShift = e.shiftKey;

                  if (isCmdOrCtrl) {
                    setSelectedPaths((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.path)) {
                        next.delete(item.path);
                      } else {
                        next.add(item.path);
                      }
                      return next;
                    });
                    setSelectedItem(item);
                  } else if (isShift && selectedItem) {
                    const visible = getVisibleItems();
                    const fromIdx = visible.findIndex((v) => v.path === selectedItem.path);
                    const toIdx = visible.findIndex((v) => v.path === item.path);
                    if (fromIdx !== -1 && toIdx !== -1) {
                      const start = Math.min(fromIdx, toIdx);
                      const end = Math.max(fromIdx, toIdx);
                      const range = visible.slice(start, end + 1).map((v) => v.path);
                      setSelectedPaths(new Set(range));
                    } else {
                      setSelectedPaths(new Set([item.path]));
                      setSelectedItem(item);
                    }
                  } else {
                    setSelectedPaths(new Set([item.path]));
                    setSelectedItem(item);
                    if (isDir) {
                      toggleFolder(item.path);
                    } else {
                      onSelectFile(item);
                    }
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selectedPaths.has(item.path)) {
                    setSelectedPaths(new Set([item.path]));
                    setSelectedItem(item);
                  }
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    item,
                  });
                }}
                style={{
                  paddingLeft: `${level * 16 + 10}px`,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  backgroundColor: isDragOver
                    ? 'rgba(0, 122, 204, 0.22)'
                    : isSelected
                    ? 'rgba(0, 122, 204, 0.28)'
                    : undefined,
                  borderColor: isSelected
                    ? 'rgba(0, 122, 204, 0.65)'
                    : 'transparent',
                }}
                className={`file-tree-row flex items-center gap-2 px-2.5 py-1 text-sm cursor-pointer group rounded-md border transition-all ${
                  isDragOver
                    ? 'font-semibold shadow-xs'
                    : isSelected
                    ? 'is-selected font-medium shadow-xs'
                    : 'text-[var(--aura-sidebar-fg,var(--aura-text))]'
                }`}
              >
                {isDir ? (
                  <span className="w-4 flex items-center justify-center text-[#aaaaaa] group-hover:text-white pointer-events-none select-none">
                    {isOpen ? <ChevronDown size={15} strokeWidth={2.4} /> : <ChevronRight size={15} strokeWidth={2.4} />}
                  </span>
                ) : (
                  <span className="w-4 flex items-center justify-center pointer-events-none select-none">
                    <FileIcon fileName={item.name} isDirectory={false} className="w-3.5 h-3.5 flex-shrink-0" />
                  </span>
                )}

                {isRenaming ? (
                  <input
                    ref={inlineRenameInputRef}
                    type="text"
                    value={inlineRenameVal}
                    onChange={(e) => setInlineRenameVal(e.target.value)}
                    onBlur={handleConfirmInlineRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmInlineRename();
                      if (e.key === 'Escape') setInlineRenameItem(null);
                    }}
                    style={{
                      backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                      color: 'var(--aura-text, #ffffff)',
                      borderColor: '#007acc',
                    }}
                    className="flex-1 border rounded px-1.5 py-0.5 text-xs outline-none font-mono shadow-xs"
                  />
                ) : (
                  <span
                    style={{
                      pointerEvents: 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      color: item.gitStatus === 'IGNORED'
                        ? '#888888'
                        : item.gitStatus === 'M'
                        ? '#cca700'
                        : item.gitStatus === 'U' || item.gitStatus === 'A'
                        ? '#4d8721'
                        : item.gitStatus === 'D'
                        ? '#ef4444'
                        : undefined,
                      opacity: item.gitStatus === 'IGNORED' ? 0.65 : undefined,
                    }}
                    className="flex-1 truncate font-sans text-[13.5px] tracking-normal"
                  >
                    {item.name}
                  </span>
                )}

                {item.gitStatus && item.gitStatus !== 'IGNORED' && (
                  <span className="flex items-center gap-1 select-none flex-shrink-0 pr-1">
                    {isDir ? (
                      <span
                        style={{
                          backgroundColor:
                            item.gitStatus === 'M'
                              ? '#cca700'
                              : item.gitStatus === 'U' || item.gitStatus === 'A'
                              ? '#73a84e'
                              : '#ef4444',
                        }}
                        className="w-2 h-2 rounded-full inline-block shadow-2xs"
                        title={
                          item.gitStatus === 'M'
                            ? '子文件有修改 (Modified)'
                            : item.gitStatus === 'U' || item.gitStatus === 'A'
                            ? '子文件有新增 (Untracked/Added)'
                            : '子文件有删除 (Deleted)'
                        }
                      />
                    ) : (
                      <span
                        style={{
                          color:
                            item.gitStatus === 'M'
                              ? '#cca700'
                              : item.gitStatus === 'U' || item.gitStatus === 'A'
                              ? '#4d8721'
                              : '#ef4444',
                        }}
                        className="text-[11px] font-mono font-bold"
                      >
                        {item.gitStatus}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {isDir && isOpen && (
                <div>
                  {inlineCreateParent?.dirPath === item.path && (
                    <div
                      className="flex items-center gap-2 py-1 pr-3 my-0.5"
                      style={{ paddingLeft: `${(level + 1) * 16 + 10}px` }}
                    >
                      <FileCode size={15} className="text-[#007acc] flex-shrink-0" />
                      <input
                        ref={inlineInputRef}
                        type="text"
                        value={inlineInputVal}
                        onChange={(e) => setInlineInputVal(e.target.value)}
                        onBlur={handleConfirmInlineCreate}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmInlineCreate();
                          if (e.key === 'Escape') setInlineCreateParent(null);
                        }}
                        style={{
                          backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                          color: 'var(--aura-text, #ffffff)',
                          borderColor: '#007acc',
                        }}
                        className="flex-1 border-2 rounded-md px-2 py-0.5 text-xs outline-none shadow-md font-mono"
                      />
                    </div>
                  )}

                  {folderChildren[item.path]
                    ? renderFileTree(folderChildren[item.path], level + 1, item.path)
                    : item.children
                    ? renderFileTree(item.children, level + 1, item.path)
                    : null}
                </div>
              )}
            </div>
          );
        })}

        {level === 0 && inlineCreateParent?.dirPath === workspaceDir && (
          <div
            className="flex items-center gap-2 py-1 pr-3 my-0.5"
            style={{ paddingLeft: '10px' }}
          >
            <FileCode size={15} className="text-[#007acc] flex-shrink-0" />
            <input
              ref={inlineInputRef}
              type="text"
              value={inlineInputVal}
              onChange={(e) => setInlineInputVal(e.target.value)}
              onBlur={handleConfirmInlineCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmInlineCreate();
                if (e.key === 'Escape') setInlineCreateParent(null);
              }}
              style={{
                backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                color: 'var(--aura-text, #ffffff)',
                borderColor: '#007acc',
              }}
              className="flex-1 border-2 rounded-md px-2 py-0.5 text-xs outline-none shadow-md font-mono"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      tabIndex={0}
      id="sidebar-container"
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      style={{
        backgroundColor: 'var(--aura-sidebar-bg)',
        color: 'var(--aura-text)',
        borderColor: 'var(--aura-border)',
        fontSize: '14px',
      }}
      className="flex flex-col h-full w-full border-r overflow-hidden focus:outline-none"
    >
      <div
        style={{ backgroundColor: 'var(--aura-sidebar-header-bg, var(--aura-sidebar-bg))', borderColor: 'var(--aura-border)' }}
        className="flex items-center gap-1 px-3 pt-2 pb-2 select-none border-b"
      >
        {navTabs.map((tab) => {
          const isActive = activeView === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeView(tab.id)}
              title={tab.title}
              style={{
                backgroundColor: isActive ? 'rgba(0, 122, 204, 0.28)' : undefined,
                borderColor: isActive ? 'rgba(0, 122, 204, 0.65)' : 'transparent',
                color: isActive ? '#007acc' : undefined,
              }}
              className={`p-1.5 rounded-md relative border transition-all ${
                isActive
                  ? 'font-medium shadow-xs'
                  : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-[rgba(0,122,204,0.14)]'
              }`}
            >
              <Icon size={18} strokeWidth={1.9} />
              {tab.badge && (
                <span className="absolute -top-1 -right-1 bg-[#007acc] text-white text-[9px] font-bold px-1 rounded-full leading-tight font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{ backgroundColor: 'var(--aura-sidebar-toolbar-bg, var(--aura-sidebar-bg))', borderColor: 'var(--aura-border)' }}
        className="flex items-center justify-between px-3 py-2 text-xs select-none border-b"
      >
        <span
          onClick={onChangeWorkspaceDir}
          className="font-bold text-[var(--aura-text)] text-[13px] tracking-tight cursor-pointer hover:opacity-80 truncate"
          title={`当前目录: ${workspaceDir} (点击切换)`}
        >
          {currentDirName}
        </span>

        <div className="flex items-center gap-1 text-[var(--aura-text-muted)]">
          <button
            onClick={() => handleActionCreate(false)}
            title={t.newFile}
            className="p-1 hover:bg-black/10 dark:hover:bg-[#383838] hover:text-[var(--aura-text)] rounded transition-colors"
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={() => handleActionCreate(true)}
            title={t.newFolder}
            className="p-1 hover:bg-black/10 dark:hover:bg-[#383838] hover:text-[var(--aura-text)] rounded transition-colors"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={onRefreshWorkspace}
            title={t.refresh}
            className="p-1 hover:bg-black/10 dark:hover:bg-[#383838] hover:text-[var(--aura-text)] rounded transition-colors"
          >
            <RotateCw size={13} />
          </button>
        </div>
      </div>

      {/* 3. Main Content based on active view */}
      <div
        style={{
          borderColor: 'transparent',
          backgroundColor: dragOverPath === workspaceDir ? 'rgba(0, 122, 204, 0.08)' : undefined,
        }}
        onDragOver={(e) => {
          if (activeView === 'files') {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const target = e.target as HTMLElement;
            if (!target.closest('.file-tree-row')) {
              if (dragOverPath !== workspaceDir) {
                setDragOverPath(workspaceDir);
              }
            }
          }
        }}
        onDragLeave={(e) => {
          const related = e.relatedTarget as HTMLElement;
          if (!related || !e.currentTarget.contains(related)) {
            if (dragOverPath === workspaceDir) {
              setDragOverPath(null);
            }
          }
        }}
        onDrop={(e) => {
          if (activeView === 'files') {
            const target = e.target as HTMLElement;
            if (!target.closest('.file-tree-row')) {
              e.preventDefault();
              setDragOverPath(null);
              const sourcePath =
                (window as any).__AURA_DRAGGED_PATH__ ||
                e.dataTransfer.getData('application/aura-path') ||
                e.dataTransfer.getData('text/plain');
              if (sourcePath && workspaceDir) {
                handleMoveEntry(sourcePath, workspaceDir);
              }
            }
          }
        }}
        className={`flex-1 py-0.5 border ${activeView === 'git' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}
      >
        {activeView === 'files' && (
          <div
            onDragOver={(e) => {
              const target = e.target as HTMLElement;
              if (!target.closest('.file-tree-row')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverPath !== workspaceDir) {
                  setDragOverPath(workspaceDir);
                }
              }
            }}
            onDrop={(e) => {
              const target = e.target as HTMLElement;
              if (!target.closest('.file-tree-row')) {
                e.preventDefault();
                setDragOverPath(null);
                const sourcePath =
                  (window as any).__AURA_DRAGGED_PATH__ ||
                  e.dataTransfer.getData('application/aura-path') ||
                  e.dataTransfer.getData('text/plain');
                if (sourcePath && workspaceDir) {
                  handleMoveEntry(sourcePath, workspaceDir);
                }
              }
            }}
            className="min-h-full pb-8"
          >
            {renderFileTree(files)}
          </div>
        )}

        {activeView === 'git' && (
          <div className="flex flex-col h-full overflow-hidden select-none">
            <div className="flex items-center border-b border-[var(--aura-border)] bg-[var(--aura-sidebar-header-bg,var(--aura-sidebar-bg))] text-xs font-semibold px-2 py-1 gap-1">
              <button
                type="button"
                onClick={() => setGitViewSection('changes')}
                className={`flex-1 py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  gitViewSection === 'changes'
                    ? 'bg-[#007acc]/20 text-[#007acc] shadow-2xs font-bold'
                    : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <FileDiff size={13} />
                <span>Changes</span>
                {changedCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-[#007acc] text-white font-mono">
                    {changedCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setGitViewSection('history')}
                className={`flex-1 py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  gitViewSection === 'history'
                    ? 'bg-[#007acc]/20 text-[#007acc] shadow-2xs font-bold'
                    : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <History size={13} />
                <span>Graph</span>
              </button>
            </div>

            {gitViewSection === 'changes' && (
              <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                <div className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>CHANGES (工作区变更)</span>
                  <span className="font-mono text-[10px] text-[#007acc]">
                    {changedCount}
                  </span>
                </div>

                {(() => {
                  const changedFiles = gitStatusData.files.length > 0
                    ? gitStatusData.files
                    : files.filter(f => f.gitStatus);
                  if (changedFiles.length === 0) {
                    return (
                      <div className="py-12 text-center text-xs text-[var(--aura-text-muted)] flex flex-col items-center gap-2">
                        <Check size={20} className="text-emerald-500" />
                        <span>工作区整洁，暂无未提交修改</span>
                      </div>
                    );
                  }

                  return changedFiles.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => onSelectFile(file)}
                      className="file-tree-row flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer hover:bg-[rgba(0,122,204,0.14)] text-[var(--aura-text)] group transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        <FileIcon fileName={file.name} className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate font-mono text-[12px]">{file.name}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          file.gitStatus === 'M'
                            ? 'text-amber-400 bg-amber-400/15'
                            : file.gitStatus === 'A'
                            ? 'text-emerald-400 bg-emerald-400/15'
                            : file.gitStatus === 'D'
                            ? 'text-rose-400 bg-rose-400/15'
                            : 'text-sky-400 bg-sky-400/15'
                        }`}
                      >
                        {file.gitStatus === 'M' ? 'Modified' : file.gitStatus === 'A' ? 'Added' : file.gitStatus === 'D' ? 'Deleted' : 'Untracked'}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            )}

            {gitViewSection === 'history' && (
              <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col select-none divide-y-0">
                {(() => {
                  const viewModels = computeVSCodeHistoryViewModels(commits, null);

                  return viewModels.map((vm) => {
                    const commit = vm.commit;
                    const isSelected = selectedCommitHash === commit.hash;
                    const cleanRef = commit.refs?.replace(/[()]/g, '').trim();

                    const authorInitials = commit.author
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'U';

                    const authorHash = commit.author.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                    const avatarBgColors = [
                      '#0284c7',
                      '#16a34a',
                      '#d97706',
                      '#9333ea',
                      '#db2777',
                      '#0d9488',
                      '#ea580c',
                    ];
                    const avatarColor = avatarBgColors[authorHash % avatarBgColors.length];

                    const inputSwimlanes = vm.inputSwimlanes;
                    const outputSwimlanes = vm.outputSwimlanes;
                    const circleIndex = vm.circleIndex;
                    const circleColor = vm.circleColor;
                    const isMerge = (commit.parents && commit.parents.length > 1) || commit.message.toLowerCase().startsWith('merge');
                    const laneCount = Math.max(inputSwimlanes.length, outputSwimlanes.length, circleIndex + 1, 1);
                    const svgWidth = (laneCount + 1) * SWIMLANE_WIDTH;

                    let outputSwimlaneIndex = 0;
                    const svgPaths: React.ReactNode[] = [];

                    for (let index = 0; index < inputSwimlanes.length; index++) {
                      const color = inputSwimlanes[index].color;

                      if (inputSwimlanes[index].id === commit.hash) {
                        if (index !== circleIndex) {
                          const d = [
                            `M ${SWIMLANE_WIDTH * (index + 1)} 0`,
                            `A ${SWIMLANE_WIDTH} ${SWIMLANE_WIDTH} 0 0 1 ${SWIMLANE_WIDTH * index} ${SWIMLANE_WIDTH}`,
                            `H ${SWIMLANE_WIDTH * (circleIndex + 1)}`,
                          ].join(' ');
                          svgPaths.push(<path key={`in-base-${index}`} d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />);
                        } else {
                          outputSwimlaneIndex++;
                        }
                      } else {
                        if (
                          outputSwimlaneIndex < outputSwimlanes.length &&
                          inputSwimlanes[index].id === outputSwimlanes[outputSwimlaneIndex].id
                        ) {
                          if (index === outputSwimlaneIndex) {
                            svgPaths.push(
                              <path
                                key={`v-${index}`}
                                d={`M ${SWIMLANE_WIDTH * (index + 1)} 0 V ${SWIMLANE_HEIGHT}`}
                                fill="none"
                                stroke={color}
                                strokeWidth="1.6"
                                strokeLinecap="round"
                              />
                            );
                          } else {
                            const d = [
                              `M ${SWIMLANE_WIDTH * (index + 1)} 0`,
                              `V 6`,
                              `A 5 5 0 0 1 ${SWIMLANE_WIDTH * (index + 1) - 5} ${SWIMLANE_HEIGHT / 2}`,
                              `H ${SWIMLANE_WIDTH * (outputSwimlaneIndex + 1) + 5}`,
                              `A 5 5 0 0 0 ${SWIMLANE_WIDTH * (outputSwimlaneIndex + 1)} ${SWIMLANE_HEIGHT / 2 + 5}`,
                              `V ${SWIMLANE_HEIGHT}`,
                            ].join(' ');
                            svgPaths.push(<path key={`curve-${index}-${outputSwimlaneIndex}`} d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />);
                          }
                          outputSwimlaneIndex++;
                        }
                      }
                    }

                    for (let i = 1; i < (commit.parents || []).length; i++) {
                      const parentHash = commit.parents![i];
                      const parentOutputIndex = outputSwimlanes.findIndex((n) => n.id === parentHash);
                      if (parentOutputIndex !== -1) {
                        const parentColor = outputSwimlanes[parentOutputIndex].color;
                        const d = [
                          `M ${SWIMLANE_WIDTH * parentOutputIndex} ${SWIMLANE_HEIGHT / 2}`,
                          `A ${SWIMLANE_WIDTH} ${SWIMLANE_WIDTH} 0 0 1 ${SWIMLANE_WIDTH * (parentOutputIndex + 1)} ${SWIMLANE_HEIGHT}`,
                          `M ${SWIMLANE_WIDTH * parentOutputIndex} ${SWIMLANE_HEIGHT / 2}`,
                          `H ${SWIMLANE_WIDTH * (circleIndex + 1)}`,
                        ].join(' ');
                        svgPaths.push(<path key={`merge-${i}`} d={d} fill="none" stroke={parentColor} strokeWidth="1.6" strokeLinecap="round" />);
                      }
                    }

                    if (inputSwimlanes.some((n) => n.id === commit.hash)) {
                      svgPaths.push(
                        <path
                          key="line-to-dot"
                          d={`M ${SWIMLANE_WIDTH * (circleIndex + 1)} 0 V ${SWIMLANE_HEIGHT / 2}`}
                          fill="none"
                          stroke={circleColor}
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      );
                    }

                    if ((commit.parents || []).length > 0) {
                      svgPaths.push(
                        <path
                          key="line-from-dot"
                          d={`M ${SWIMLANE_WIDTH * (circleIndex + 1)} ${SWIMLANE_HEIGHT / 2} V ${SWIMLANE_HEIGHT}`}
                          fill="none"
                          stroke={circleColor}
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      );
                    }

                    return (
                      <div
                        key={commit.hash}
                        onClick={() => {
                          const sel = window.getSelection();
                          if (sel && sel.toString().trim().length > 0) return;
                          setSelectedCommitHash(isSelected ? null : commit.hash);
                        }}
                        style={{
                          backgroundColor: isSelected ? 'rgba(0, 122, 204, 0.14)' : 'transparent',
                        }}
                        className={`flex items-stretch px-2 cursor-pointer text-xs transition-colors group min-w-0 border-b border-[var(--aura-border)]/20 ${
                          isSelected ? 'font-medium' : 'hover:bg-[rgba(0,122,204,0.12)]'
                        }`}
                      >
                        {/* Native VS Code Per-Row SVG Swimlane Track */}
                        <div
                          style={{ width: `${svgWidth}px` }}
                          className="flex-shrink-0 relative select-none pointer-events-none self-stretch"
                        >
                          {/* Top row header height fixed to SWIMLANE_HEIGHT, with downward continuation line */}
                          <div
                            style={{ width: `${svgWidth}px`, height: `${SWIMLANE_HEIGHT}px` }}
                            className="relative"
                          >
                            <svg
                              style={{
                                width: `${svgWidth}px`,
                                height: `${SWIMLANE_HEIGHT}px`,
                              }}
                              className="overflow-visible block"
                            >
                              {svgPaths}

                              {/* Native VS Code Commit Node Dots */}
                              {vm.kind === 'HEAD' ? (
                                <g>
                                  <circle cx={SWIMLANE_WIDTH * (circleIndex + 1)} cy={SWIMLANE_HEIGHT / 2} r={6.5} fill="none" stroke={circleColor} strokeWidth={2} />
                                  <circle cx={SWIMLANE_WIDTH * (circleIndex + 1)} cy={SWIMLANE_HEIGHT / 2} r={3.2} fill={circleColor} />
                                </g>
                              ) : isMerge ? (
                                <g>
                                  <circle cx={SWIMLANE_WIDTH * (circleIndex + 1)} cy={SWIMLANE_HEIGHT / 2} r={5.2} fill="none" stroke={circleColor} strokeWidth={1.8} />
                                  <circle cx={SWIMLANE_WIDTH * (circleIndex + 1)} cy={SWIMLANE_HEIGHT / 2} r={2.5} fill={circleColor} />
                                </g>
                              ) : (
                                <circle
                                  cx={SWIMLANE_WIDTH * (circleIndex + 1)}
                                  cy={SWIMLANE_HEIGHT / 2}
                                  r={isSelected ? 4.5 : 3.5}
                                  fill={isSelected ? circleColor : 'var(--aura-sidebar-bg, #ffffff)'}
                                  stroke={circleColor}
                                  strokeWidth={2}
                                />
                              )}
                            </svg>
                          </div>

                          {/* When expanded, extend all output swimlane lines down to the bottom of the expanded row */}
                          {isSelected && outputSwimlanes.length > 0 && (
                            <div
                              style={{
                                position: 'absolute',
                                top: `${SWIMLANE_HEIGHT}px`,
                                bottom: 0,
                                left: 0,
                                width: `${svgWidth}px`,
                              }}
                            >
                              <svg className="w-full h-full block overflow-visible">
                                {outputSwimlanes.map((lane, lIdx) => (
                                  <line
                                    key={`ext-${lIdx}`}
                                    x1={SWIMLANE_WIDTH * (lIdx + 1)}
                                    y1={0}
                                    x2={SWIMLANE_WIDTH * (lIdx + 1)}
                                    y2="100%"
                                    stroke={lane.color}
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                  />
                                ))}
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Commit Message directly aligned right behind the swimlane dot */}
                        <div className="flex-1 min-w-0 pr-1 pl-1.5 overflow-hidden flex flex-col justify-start py-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {cleanRef && (
                              <span
                                style={{
                                  backgroundColor: `${circleColor}18`,
                                  borderColor: `${circleColor}40`,
                                  color: circleColor,
                                }}
                                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded font-mono border flex-shrink-0 select-none"
                              >
                                <GitBranch size={9} className="flex-shrink-0" />
                                <span className="truncate max-w-[90px]">{cleanRef}</span>
                              </span>
                            )}

                            <div className={`text-[13px] text-[var(--aura-text)] font-sans leading-snug flex-1 select-text ${
                              isSelected ? 'whitespace-normal break-words font-medium' : 'truncate whitespace-nowrap'
                            }`}>
                              {commit.message}
                            </div>
                          </div>

                          {isSelected && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 pt-2 border-t border-[var(--aura-border)]/40 text-[11px] font-mono text-[var(--aura-text-muted)] flex flex-col gap-2 select-text cursor-text animate-in fade-in duration-100"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                                  <div
                                    style={{ backgroundColor: avatarColor }}
                                    className="w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0 shadow-2xs"
                                    title={commit.author}
                                  >
                                    {authorInitials}
                                  </div>
                                  <span className="truncate whitespace-nowrap text-[11px] text-[var(--aura-text)] select-text font-sans">
                                    {commit.author}
                                  </span>
                                  {commit.author_email && <span className="select-all opacity-80">&lt;{commit.author_email}&gt;</span>}
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0 text-[10px]">
                                  <span className="opacity-80">{commit.date}</span>
                                  <span className="text-[#007acc] font-bold select-all">SHA: {commit.hash}</span>
                                </div>
                              </div>

                              <div className="pt-1.5 border-t border-[var(--aura-border)]/30 space-y-1">
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between">
                                  <span>CHANGED FILES</span>
                                  <span>{(commitFilesMap[commit.hash] || []).length} files</span>
                                </div>
                                <div className="space-y-0.5">
                                  {(commitFilesMap[commit.hash] || []).map((f) => {
                                    const isDiffActive = selectedDiffFile === `${commit.hash}:${f.path}`;
                                    return (
                                      <div
                                        key={f.path}
                                        onClick={() => {
                                          setSelectedDiffFile(`${commit.hash}:${f.path}`);
                                          onOpenDiff?.(commit.hash, f.path);
                                        }}
                                        style={{
                                          backgroundColor: isDiffActive ? 'rgba(0, 122, 204, 0.25)' : undefined,
                                        }}
                                        className={`flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#007acc]/15 cursor-pointer transition-colors group/item ${
                                          isDiffActive ? 'text-[#007acc] font-semibold' : 'text-[var(--aura-text)]'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                          <FileIcon fileName={f.path.split('/').pop() || f.path} className="w-3.5 h-3.5 flex-shrink-0" />
                                          <span className="truncate font-mono text-[11px]">{f.path}</span>
                                        </div>
                                        <span
                                          className={`text-[9px] font-bold px-1 rounded font-mono ${
                                            f.status === 'M'
                                              ? 'text-amber-400 bg-amber-400/15'
                                              : f.status === 'A'
                                              ? 'text-emerald-400 bg-emerald-400/15'
                                              : 'text-rose-400 bg-rose-400/15'
                                          }`}
                                        >
                                          {f.status}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        {activeView === 'plugins' && (
          <div className="flex flex-col h-full overflow-hidden select-none">
            <div className="p-2 border-b border-[#2d2d2d] relative">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={pluginSearchQuery}
                  onChange={(e) => setPluginSearchQuery(e.target.value)}
                  placeholder="Search Extensions in Marketplace"
                  className="w-full bg-[var(--aura-input-bg,#1e1e1e)] border border-[var(--aura-border,#3c3c3c)] rounded px-2.5 py-1 text-xs text-[var(--aura-text)] placeholder-[var(--aura-text-muted,#666666)] outline-none focus:border-[#007acc] pr-12 transition-colors font-sans"
                />
                <div className="absolute right-2 flex items-center gap-1 text-gray-500">
                  {pluginSearchQuery ? (
                    <button
                      onClick={() => setPluginSearchQuery('')}
                      className="hover:text-white text-xs px-0.5"
                    >
                      ×
                    </button>
                  ) : (
                    <SlidersHorizontal size={12} className="cursor-pointer hover:text-white" />
                  )}
                </div>
              </div>

              {isSearchingOnline && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e1e1e] overflow-hidden">
                  <div className="h-full bg-[#007acc] animate-pulse w-full bg-gradient-to-r from-transparent via-[#007acc] to-transparent" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--aura-border)]/20 no-scrollbar">
              {(() => {
                const query = pluginSearchQuery.toLowerCase().trim();
                let list: PluginManifest[] = [];

                if (!query) {
                  list = plugins.filter((p) => p.installed !== false);
                } else {
                  const localMarketplace = plugins.filter((p) => p.installed === false);
                  const map = new Map<string, PluginManifest>();
                  localMarketplace.forEach((p) => map.set(p.id, p));
                  onlineResults.forEach((p) => {
                    if (!plugins.some((existing) => existing.id === p.id && existing.installed)) {
                      map.set(p.id, p);
                    }
                  });
                  list = Array.from(map.values());
                  list = list.filter((p) =>
                    p.name.toLowerCase().includes(query) ||
                    p.description.toLowerCase().includes(query) ||
                    p.publisher?.toLowerCase().includes(query)
                  );
                }

                if (list.length === 0 && !isSearchingOnline) {
                  return (
                    <div className="text-center py-8 text-gray-500 text-xs">
                      {!query ? '暂无已安装插件' : '未找到相关插件，试试搜索 python、rust、theme 等关键词'}
                    </div>
                  );
                }

                return list.map((plugin) => {
                  const isInstalled = plugins.some((p) => p.id === plugin.id && p.installed);
                  const isEnabled = plugins.some((p) => p.id === plugin.id && p.enabled);
                  const isSettingsOpen = openSettingsPluginId === plugin.id;
                  const Logo = PLUGIN_LOGOS[plugin.id] || (
                    plugin.icon ? (
                      <img src={plugin.icon} alt={plugin.name} className="w-full h-full object-contain" />
                    ) : (
                      <Puzzle size={18} className="text-[#007acc]" />
                    )
                  );

                  return (
                    <div
                      key={plugin.id}
                      onClick={() => onSelectExtension?.(plugin)}
                      className="plugin-row px-3 py-2.5 cursor-pointer flex items-start gap-3 text-xs transition-colors group select-none relative"
                    >
                      <div className="w-10 h-10 rounded bg-[#252526] border border-[#333333] p-1 flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5">
                        {Logo}
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5 leading-snug">
                          <span className="font-semibold text-[var(--aura-text)] truncate text-[12px] group-hover:text-[#007acc] transition-colors">
                            {plugin.name}
                          </span>
                          {plugin.id === 'shd101wyy.markdown-preview-enhanced' && (
                            <span className="text-[10px] text-[var(--aura-text-muted)] font-mono flex items-center gap-0.5 flex-shrink-0">
                              <RotateCw size={9} /> 561ms
                            </span>
                          )}
                          {plugin.id === 'vscodevim.vim' && (
                            <span className="text-[10px] text-[var(--aura-text-muted)] font-mono flex items-center gap-0.5 flex-shrink-0">
                              <RotateCw size={9} /> 54ms
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[var(--aura-text-muted)] truncate leading-normal mt-0.5">
                          {plugin.description}
                        </p>

                        <div className="flex items-center gap-1 text-[11px] text-[var(--aura-text-muted)] truncate mt-0.5">
                          <span>{plugin.publisher || 'Community'}</span>
                          {(plugin.publisher === 'Microsoft' || plugin.publisher === 'Go Team at Google' || plugin.publisher === 'GitHub') && (
                            <CheckCircle2 size={11} className="text-[#007acc] fill-[#007acc] text-white flex-shrink-0" />
                          )}
                        </div>
                      </div>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-3 flex items-center gap-1"
                      >
                        {!isInstalled ? (
                          <button
                            onClick={() => onInstallPlugin?.(plugin)}
                            className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#007acc] text-white hover:bg-[#0062a3] transition-all flex items-center gap-1"
                          >
                            <Download size={10} />
                            <span>Install</span>
                          </button>
                        ) : (
                          <div className="relative">
                            <button
                              onClick={() => setOpenSettingsPluginId(isSettingsOpen ? null : plugin.id)}
                              title="管理扩展 (Manage Extension)"
                              className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#3c3c3c] transition-colors"
                            >
                              <Settings size={13} className={isEnabled ? '' : 'text-gray-500'} />
                            </button>

                            {isSettingsOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-6 z-50 w-36 bg-[#252526] border border-[#454545] rounded-md shadow-2xl py-1 text-xs select-none text-[#cccccc]"
                              >
                                <div
                                  onClick={() => {
                                    onTogglePlugin(plugin.id);
                                    setOpenSettingsPluginId(null);
                                  }}
                                  className="px-3 py-1.5 hover:bg-[#04395e] hover:text-white cursor-pointer"
                                >
                                  {isEnabled ? 'Disable' : 'Enable'}
                                </div>
                                <div
                                  onClick={() => {
                                    onUninstallPlugin?.(plugin.id);
                                    setOpenSettingsPluginId(null);
                                  }}
                                  className="px-3 py-1.5 hover:bg-red-900/60 text-red-300 hover:text-white cursor-pointer"
                                >
                                  Uninstall
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {actionModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setActionModal(null);
            }
          }}
        >
          {actionModal.type === 'move' ? (
            <div
              style={{
                backgroundColor: 'var(--aura-card-bg, #ffffff)',
                borderColor: 'var(--aura-border, #d1d5db)',
                color: 'var(--aura-text, #1e293b)',
              }}
              className="w-[280px] border rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-100 select-none"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#007acc] flex items-center justify-center shadow-md p-2">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
                  <path d="M70.5 7.5L46.8 28.2 26.7 13.5 14.5 19.8v60.4l12.2 6.3 20.1-14.7 23.7 20.7 20.5-9.8V17.3L70.5 7.5zm-5 59.8L46.8 50l18.7-17.3v34.6zM24.5 68.3V31.7L40.2 50 24.5 68.3zm61-4.7l-15-13.6 15-13.6v27.2z"/>
                </svg>
              </div>

              <div className="text-xs font-bold text-[var(--aura-text)] leading-snug px-1 whitespace-pre-line">
                {actionModal.title}
              </div>

              <div className="flex flex-col w-full gap-2 pt-1">
                {actionModal.sourcePath && actionModal.destinationPath ? (
                  <button
                    ref={confirmBtnRef}
                    type="button"
                    onClick={handleConfirmActionModal}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#e5e7eb] dark:bg-[#333333] text-[var(--aura-text)] hover:bg-[#d1d5db] dark:hover:bg-[#404040] active:scale-98 transition-all cursor-pointer outline-none"
                  >
                    Move
                  </button>
                ) : null}

                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#e5e7eb] dark:bg-[#333333] text-[var(--aura-text)] hover:bg-[#d1d5db] dark:hover:bg-[#404040] active:scale-98 transition-all cursor-pointer outline-none"
                >
                  Cancel
                </button>
              </div>

              {actionModal.sourcePath && actionModal.destinationPath && (
                <label className="flex items-center gap-2 text-[11px] text-[var(--aura-text-muted)] cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={doNotAskAgainChecked}
                    onChange={(e) => setDoNotAskAgainChecked(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-[#007acc] cursor-pointer"
                  />
                  <span>Do not ask me again</span>
                </label>
              )}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--aura-card-bg, #252526)',
                borderColor: 'var(--aura-border, #454545)',
                color: 'var(--aura-text, #eeeeee)',
              }}
              className="w-[440px] border rounded-xl shadow-2xl p-5 flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-75"
            >
              <div className="text-sm font-semibold text-[var(--aura-text)] leading-snug">
                {actionModal.title}
              </div>

              <div className="space-y-1.5">
                <p
                  style={{
                    backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                    borderColor: 'var(--aura-border, #333333)',
                    color: 'var(--aura-text-muted, #858585)',
                  }}
                  className="text-[11.5px] font-mono truncate px-2.5 py-1.5 rounded border"
                >
                  {actionModal.defaultValue}
                </p>
                <p className="text-[12px] text-[var(--aura-text-muted)]">
                  {t.deleteWarning}
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-1.5">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-3.5 py-1.5 text-xs text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] rounded-md hover:bg-black/10 dark:hover:bg-white/10 focus:ring-2 focus:ring-[#007acc] transition-colors outline-none cursor-pointer"
                >
                  {t.cancel} (Esc)
                </button>
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={handleConfirmActionModal}
                  className="px-4 py-1.5 text-xs text-white rounded-md font-medium shadow-xs transition-all outline-none bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  {t.confirmDelete}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VS Code Style Right-Click Context Menu (Theme-Aware) */}
      {contextMenu && (
        <div
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            backgroundColor: 'var(--aura-card-bg, #252526)',
            borderColor: 'var(--aura-border, #454545)',
            color: 'var(--aura-text, #cccccc)',
          }}
          className="fixed z-50 w-56 border rounded-lg shadow-2xl py-1 text-xs select-none animate-in fade-in duration-75 divide-y divide-[var(--aura-border,#333333)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* For Markdown files, show Open With... */}
          {contextMenu.item.name.toLowerCase().endsWith('.md') && (
            <div className="py-0.5">
              <div
                onClick={() => {
                  setOpenWithModalItem(contextMenu.item);
                  setContextMenu(null);
                }}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-[#007acc]/20 hover:text-[#007acc] cursor-pointer font-medium text-[var(--aura-text)] transition-colors"
              >
                <span>Open With...</span>
                <span className="text-[10px] text-[var(--aura-text-muted)] font-mono">⌥O</span>
              </div>
            </div>
          )}

          <div className="py-0.5">
            <div
              onClick={() => {
                setContextMenu(null);
                handleActionCreate(false);
              }}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-[#007acc]/20 hover:text-[#007acc] cursor-pointer transition-colors"
            >
              <span>New File</span>
              <span className="text-[10px] text-[var(--aura-text-muted)] font-mono">a</span>
            </div>
            <div
              onClick={() => {
                setContextMenu(null);
                handleActionCreate(true);
              }}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-[#007acc]/20 hover:text-[#007acc] cursor-pointer transition-colors"
            >
              <span>New Folder</span>
              <span className="text-[10px] text-[var(--aura-text-muted)] font-mono">/</span>
            </div>
          </div>

          <div className="py-0.5">
            <div
              onClick={() => {
                setContextMenu(null);
                handleActionRename();
              }}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-[#007acc]/20 hover:text-[#007acc] cursor-pointer transition-colors"
            >
              <span>Rename...</span>
              <span className="text-[10px] text-[var(--aura-text-muted)] font-mono">Enter</span>
            </div>
            <div
              onClick={() => {
                setContextMenu(null);
                handleActionDelete();
              }}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-red-500/20 hover:text-red-500 cursor-pointer text-red-500 dark:text-red-400 transition-colors"
            >
              <span>Delete</span>
              <span className="text-[10px] text-inherit font-mono">d</span>
            </div>
          </div>

          <div className="py-0.5">
            <div
              onClick={(e) => {
                setContextMenu(null);
                copyPath(contextMenu.item.path, e);
              }}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-[#007acc]/20 hover:text-[#007acc] cursor-pointer transition-colors"
            >
              <span>Copy Path</span>
              <span className="text-[10px] text-[var(--aura-text-muted)] font-mono">Shift+Alt+C</span>
            </div>
            <div
              onClick={(e) => {
                setContextMenu(null);
                const rel = contextMenu.item.path.replace(workspaceDir, '').replace(/^\//, '');
                copyPath(rel, e);
              }}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-[#007acc]/20 hover:text-[#007acc] cursor-pointer transition-colors"
            >
              <span>Copy Relative Path</span>
              <span className="text-[10px] text-[var(--aura-text-muted)] font-mono">⌥⌘C</span>
            </div>
          </div>
        </div>
      )}

      {/* VS Code Style "Open With..." Modal for Markdown */}
      {openWithModalItem && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setOpenWithModalItem(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--aura-card-bg, #252526)',
              borderColor: 'var(--aura-border, #454545)',
              color: 'var(--aura-text, #cccccc)',
            }}
            className="w-[460px] border rounded-xl shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-75 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--aura-border,#333333)] pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aura-text)]">
                <FileIcon fileName={openWithModalItem.name} className="w-4 h-4" />
                <span>Select editor for '{openWithModalItem.name}'</span>
              </div>
              <button
                onClick={() => setOpenWithModalItem(null)}
                className="text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-1.5">
              <div
                onClick={() => {
                  onSelectFile(openWithModalItem, 'editor');
                  setOpenWithModalItem(null);
                }}
                style={{
                  backgroundColor: 'var(--aura-sidebar-bg, #1e1e1e)',
                  borderColor: 'var(--aura-border, #333333)',
                }}
                className="p-3 rounded-lg border hover:border-[#007acc] hover:bg-[#007acc]/15 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--aura-text)] group-hover:text-[#007acc] text-[12.5px]">
                    Text Editor (Default)
                  </div>
                  <div className="text-[11px] text-[var(--aura-text-muted)]">
                    Standard Monaco code and text editor with full Vim bindings
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: 'var(--aura-input-bg, #2a2a2a)',
                    color: 'var(--aura-text-muted, #888888)',
                  }}
                  className="text-[10px] px-2 py-0.5 rounded font-mono border border-[var(--aura-border)]"
                >
                  Built-in
                </span>
              </div>

              <div
                onClick={() => {
                  const mpePlugin = plugins.find((p) => p.id === 'shd101wyy.markdown-preview-enhanced');
                  if (!mpePlugin?.enabled) {
                    onInstallPlugin?.({
                      id: 'shd101wyy.markdown-preview-enhanced',
                      name: 'Markdown Preview Enhanced',
                      publisher: 'Yiyi Wang',
                      version: '0.8.14',
                      description: 'Markdown Preview Enhanced',
                      enabled: true,
                      installed: true,
                    });
                  }
                  onSelectFile(openWithModalItem, 'markdown-preview');
                  setOpenWithModalItem(null);
                }}
                style={{
                  backgroundColor: 'var(--aura-sidebar-bg, #1e1e1e)',
                  borderColor: 'var(--aura-border, #333333)',
                }}
                className="p-3 rounded-lg border hover:border-[#007acc] hover:bg-[#007acc]/15 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--aura-text)] group-hover:text-[#007acc] text-[12.5px]">
                    Markdown Preview Enhanced
                  </div>
                  <div className="text-[11px] text-[var(--aura-text-muted)]">
                    Rich live preview with KaTeX math, Mermaid charts, PlantUML
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: 'var(--aura-input-bg, #2a2a2a)',
                    color: 'var(--aura-text-muted, #888888)',
                  }}
                  className="text-[10px] px-2 py-0.5 rounded font-mono border border-[var(--aura-border)]"
                >
                  Preview
                </span>
              </div>

              <div
                onClick={() => {
                  const mmPlugin = plugins.find((p) => p.id === 'markmap');
                  if (!mmPlugin?.enabled) {
                    onInstallPlugin?.({
                      id: 'markmap',
                      name: 'Markmap',
                      publisher: 'Gerald Liu',
                      version: '0.3.1',
                      description: 'Visualize markdown as interactive mind maps',
                      enabled: true,
                      installed: true,
                    });
                  }
                  onSelectFile(openWithModalItem, 'markmap');
                  setOpenWithModalItem(null);
                }}
                className="p-3 rounded-lg bg-[#1e1e1e] border border-[#333333] hover:border-[#007acc] hover:bg-[#04395e]/40 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-white group-hover:text-[#007acc] text-[12.5px]">
                    Markmap Mind Map
                  </div>
                  <div className="text-[11px] text-[#888888]">
                    Interactive structural mindmap visualization
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#2a2a2a] text-gray-400 font-mono">
                  Mindmap
                </span>
              </div>

              <div
                onClick={() => {
                  onSelectFile(openWithModalItem, 'outline');
                  setOpenWithModalItem(null);
                }}
                className="p-3 rounded-lg bg-[#1e1e1e] border border-[#333333] hover:border-[#007acc] hover:bg-[#04395e]/40 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-white group-hover:text-[#007acc] text-[12.5px]">
                    Article Structure (Outline)
                  </div>
                  <div className="text-[11px] text-[#888888]">
                    Document outline hierarchy with instant heading navigation
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#2a2a2a] text-gray-400 font-mono">
                  Outline
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setOpenWithModalItem(null)}
                className="px-4 py-1.5 rounded text-xs bg-[#333333] hover:bg-[#444444] text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
