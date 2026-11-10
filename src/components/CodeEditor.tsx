import React, { useEffect, useRef, useState } from 'react';
import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';
import { OpenTab, PluginManifest } from '../types';
import { X, FileCode, Puzzle, Download, Star, ShieldCheck, CheckCircle2, ChevronDown, ChevronRight, ChevronLeft, ListTree, Code, Eye, Network, PanelRightClose, PanelRightOpen, GitCompare, Columns, Rows } from 'lucide-react';
import { THEMES } from '../services/themeService';
import { PLUGIN_LOGOS } from '../services/pluginLogos';
import { MarkmapViewer } from './MarkmapViewer';
import { MarkdownPreviewEnhanced } from './MarkdownPreviewEnhanced';
import { FileIcon } from './FileIcon';
import { fetchGitHeadContent } from '../services/fileService';

interface CodeEditorProps {
  activeTab: OpenTab | null;
  tabs: OpenTab[];
  plugins?: PluginManifest[];
  themeId?: string;
  fontSize?: number;
  fontFamily?: string;
  onSelectTab: (tab: OpenTab) => void;
  onCloseTab: (tabId: string) => void;
  onChangeContent: (content: string) => void;
  onSave: () => void;
  onQuitNoSave: () => void;
  onTogglePlugin?: (id: string) => void;
  onInstallPlugin?: (plugin: any) => void;
  onUninstallPlugin?: (id: string) => void;
  workspaceDir?: string;
  onOpenFileByPath?: (path: string, forceNormalEditor?: boolean) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const DEFAULT_EDITOR_FALLBACK = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "PingFang SC", "Microsoft YaHei", monospace';

const getEffectiveEditorFont = (customFont?: string) => {
  if (customFont && customFont.trim()) {
    const clean = customFont.trim().replace(/^['"]|['"]$/g, '');
    return `"${clean}", "JetBrains Mono", Menlo, Monaco, 'Courier New', ${DEFAULT_EDITOR_FALLBACK}`;
  }
  return `"JetBrains Mono", Menlo, Monaco, 'Courier New', ${DEFAULT_EDITOR_FALLBACK}`;
};

export interface PyCharmDiffHunk {
  type: 'add' | 'delete' | 'modify';
  origStart: number;
  origEnd: number;
  modStart: number;
  modEnd: number;
}

export const computePyCharmDiffHunks = (orig: string[], mod: string[]): PyCharmDiffHunk[] => {
  const m = orig.length;
  const n = mod.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) {
    return [{ type: 'add', origStart: 0, origEnd: 0, modStart: 1, modEnd: n }];
  }
  if (n === 0) {
    return [{ type: 'delete', origStart: 1, origEnd: m, modStart: 0, modEnd: 0 }];
  }

  let prefix = 0;
  while (prefix < m && prefix < n && orig[prefix] === mod[prefix]) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < m - prefix &&
    suffix < n - prefix &&
    orig[m - 1 - suffix] === mod[n - 1 - suffix]
  ) {
    suffix++;
  }

  const subOrig = orig.slice(prefix, m - suffix);
  const subMod = mod.slice(prefix, n - suffix);
  const subM = subOrig.length;
  const subN = subMod.length;

  if (subM === 0 && subN === 0) return [];

  const dp = Array(subM + 1).fill(0).map(() => new Uint16Array(subN + 1));
  for (let i = 0; i < subM; i++) {
    for (let j = 0; j < subN; j++) {
      if (subOrig[i] === subMod[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i][j + 1], dp[i + 1][j]);
      }
    }
  }

  let i = subM;
  let j = subN;
  const ops: Array<{ type: 'same' | 'add' | 'delete'; oIdx: number; mIdx: number }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && subOrig[i - 1] === subMod[j - 1]) {
      ops.unshift({ type: 'same', oIdx: prefix + i, mIdx: prefix + j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', oIdx: prefix + i, mIdx: prefix + j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      ops.unshift({ type: 'delete', oIdx: prefix + i, mIdx: prefix + j });
      i--;
    }
  }

  const hunks: PyCharmDiffHunk[] = [];
  let curOrig: number[] = [];
  let curMod: number[] = [];
  let lastAnchorOrig = prefix;
  let lastAnchorMod = prefix;

  const flush = () => {
    if (curOrig.length === 0 && curMod.length === 0) return;
    if (curOrig.length > 0 && curMod.length > 0) {
      hunks.push({
        type: 'modify',
        origStart: curOrig[0],
        origEnd: curOrig[curOrig.length - 1],
        modStart: curMod[0],
        modEnd: curMod[curMod.length - 1],
      });
    } else if (curMod.length > 0) {
      hunks.push({
        type: 'add',
        origStart: lastAnchorOrig,
        origEnd: lastAnchorOrig,
        modStart: curMod[0],
        modEnd: curMod[curMod.length - 1],
      });
    } else {
      hunks.push({
        type: 'delete',
        origStart: curOrig[0],
        origEnd: curOrig[curOrig.length - 1],
        modStart: lastAnchorMod,
        modEnd: lastAnchorMod,
      });
    }
    curOrig = [];
    curMod = [];
  };

  for (const op of ops) {
    if (op.type === 'same') {
      flush();
      lastAnchorOrig = op.oIdx;
      lastAnchorMod = op.mIdx;
    } else if (op.type === 'add') {
      curMod.push(op.mIdx);
      lastAnchorOrig = op.oIdx;
    } else if (op.type === 'delete') {
      curOrig.push(op.oIdx);
      lastAnchorMod = op.mIdx;
    }
  }
  flush();

  return hunks;
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  activeTab,
  tabs,
  plugins = [],
  themeId = 'vs-dark',
  fontSize = 13,
  fontFamily,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onSave,
  onQuitNoSave,
  onTogglePlugin,
  onInstallPlugin,
  onUninstallPlugin,
  workspaceDir,
  onOpenFileByPath,
  isSidebarOpen = true,
  onToggleSidebar,
}) => {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onQuitNoSaveRef = useRef(onQuitNoSave);
  onQuitNoSaveRef.current = onQuitNoSave;
  const onSelectTabRef = useRef(onSelectTab);
  onSelectTabRef.current = onSelectTab;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const diffEditorRef = useRef<any>(null);
  const [vimMode, setVimMode] = useState<'NORMAL' | 'INSERT' | 'VISUAL'>('NORMAL');
  const vimModeRef = useRef<'NORMAL' | 'INSERT' | 'VISUAL'>('NORMAL');
  vimModeRef.current = vimMode;

  const lastKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });
  const vimRegisterRef = useRef<{ text: string; isLine: boolean }>({ text: '', isLine: false });
  const visualAnchorRef = useRef<{ lineNumber: number; column: number } | null>(null);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [collapsedOutlineSections, setCollapsedOutlineSections] = useState<Record<string, boolean>>({});
  const [isTocVisible, setIsTocVisible] = useState<boolean>(() => {
    return localStorage.getItem('aura:mpeTocVisible') !== 'false';
  });
  const [isSplitDiff, setIsSplitDiff] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<'split' | 'unified'>('split');
  const [originalDiffText, setOriginalDiffText] = useState<string>('');
  const [diffStats, setDiffStats] = useState<{ added: number; modified: number; deleted: number }>({ added: 0, modified: 0, deleted: 0 });
  const initialFileSnapshotRef = useRef<Record<string, string>>({});
  const gitHeadContentRef = useRef<Record<string, string>>({});
  const editorDecorationsRef = useRef<any>(null);

  const updateGitGutterDecorations = async () => {
    if (!editorRef.current || !monaco || !activeTab) return;
    if (activeTab.type === 'diff' || activeTab.type === 'extension') return;

    if (initialFileSnapshotRef.current[activeTab.path] === undefined) {
      initialFileSnapshotRef.current[activeTab.path] = activeTab.content;
    }

    let headText = gitHeadContentRef.current[activeTab.path];
    if (headText === undefined) {
      headText = await fetchGitHeadContent(activeTab.path, workspaceDir);
      gitHeadContentRef.current[activeTab.path] = headText;
    }

    const baselineText = (headText && headText.trim() !== '') ? headText : initialFileSnapshotRef.current[activeTab.path] || '';

    if (!baselineText) {
      if (editorDecorationsRef.current) {
        editorDecorationsRef.current.clear();
      }
      setDiffStats({ added: 0, modified: 0, deleted: 0 });
      return;
    }

    const currentText = editorRef.current.getValue();
    const originalLines = baselineText.split('\n');
    const modifiedLines = currentText.split('\n');

    const computeDiffHunks = (orig: string[], mod: string[]) => {
      const hunks: { type: 'add' | 'delete' | 'modify'; startLine: number; endLine: number }[] = [];
      const m = orig.length;
      const n = mod.length;

      let i = 0;
      let j = 0;

      while (i < m || j < n) {
        if (i < m && j < n && orig[i] === mod[j]) {
          i++;
          j++;
          continue;
        }

        const startMod = j + 1;
        let origMismatch = 0;
        let modMismatch = 0;

        let foundMatch = false;
        let matchI = i;
        let matchJ = j;

        outer: for (let d = 1; d <= 40; d++) {
          for (let di = 0; di <= d; di++) {
            const dj = d - di;
            const testI = i + di;
            const testJ = j + dj;
            if (testI < m && testJ < n && orig[testI] === mod[testJ]) {
              matchI = testI;
              matchJ = testJ;
              foundMatch = true;
              break outer;
            }
          }
        }

        if (foundMatch) {
          origMismatch = matchI - i;
          modMismatch = matchJ - j;
          i = matchI;
          j = matchJ;
        } else {
          origMismatch = m - i;
          modMismatch = n - j;
          i = m;
          j = n;
        }

        if (origMismatch > 0 && modMismatch > 0) {
          hunks.push({
            type: 'modify',
            startLine: startMod,
            endLine: startMod + modMismatch - 1,
          });
        } else if (modMismatch > 0) {
          hunks.push({
            type: 'add',
            startLine: startMod,
            endLine: startMod + modMismatch - 1,
          });
        } else if (origMismatch > 0) {
          const deleteAnchor = Math.max(1, Math.min(startMod, mod.length));
          hunks.push({
            type: 'delete',
            startLine: deleteAnchor,
            endLine: deleteAnchor,
          });
        }
      }

      return hunks;
    };

    const hunks = computeDiffHunks(originalLines, modifiedLines);
    let added = 0;
    let modified = 0;
    let deleted = 0;
    hunks.forEach((hunk) => {
      const span = hunk.endLine - hunk.startLine + 1;
      if (hunk.type === 'add') added += span;
      else if (hunk.type === 'modify') modified += span;
      else if (hunk.type === 'delete') deleted += 1;
    });
    setDiffStats({ added, modified, deleted });

    const newDecorations: any[] = [];

    hunks.forEach((hunk) => {
      let marginClassName = '';
      let lineClassName = '';
      let overviewColor = '';

      if (hunk.type === 'add') {
        marginClassName = 'aura-git-gutter-added';
        lineClassName = 'aura-git-line-added';
        overviewColor = '#28a745';
      } else if (hunk.type === 'delete') {
        marginClassName = 'aura-git-gutter-deleted';
        lineClassName = 'aura-git-line-deleted';
        overviewColor = '#e5534b';
      } else {
        marginClassName = 'aura-git-gutter-modified';
        lineClassName = 'aura-git-line-modified';
        overviewColor = '#e3b341';
      }

      newDecorations.push({
        range: new monaco.Range(hunk.startLine, 1, hunk.endLine, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: marginClassName,
          className: lineClassName,
          overviewRuler: {
            color: overviewColor,
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      });
    });

    if (!editorDecorationsRef.current) {
      editorDecorationsRef.current = editorRef.current.createDecorationsCollection(newDecorations);
    } else {
      editorDecorationsRef.current.set(newDecorations);
    }
  };

  const handleOpenSplitDiff = async () => {
    if (!activeTab) return;
    if (initialFileSnapshotRef.current[activeTab.path] === undefined) {
      initialFileSnapshotRef.current[activeTab.path] = activeTab.content;
    }
    let head = gitHeadContentRef.current[activeTab.path];
    if (head === undefined) {
      head = await fetchGitHeadContent(activeTab.path, workspaceDir);
      gitHeadContentRef.current[activeTab.path] = head;
    }
    const base = (head && head.trim() !== '') ? head : initialFileSnapshotRef.current[activeTab.path] || '';
    setOriginalDiffText(base);
    setIsSplitDiff(true);
    setDiffViewMode('split');
    setIsModeMenuOpen(false);
  };

  const handleCloseSplitDiff = () => {
    setIsSplitDiff(false);
    if (activeTab) {
      activeTab.isSplitDiff = false;
    }
    setTimeout(() => {
      if (editorRef.current && activeTabRef.current) {
        if (editorRef.current.getValue() !== activeTabRef.current.content) {
          editorRef.current.setValue(activeTabRef.current.content);
        }
      }
      updateGitGutterDecorations();
    }, 60);
  };

  const handleDiffMount = (diffEditor: any, monacoInstance: any) => {
    diffEditorRef.current = diffEditor;
    const modifiedEditor = diffEditor.getModifiedEditor();
    const originalEditor = diffEditor.getOriginalEditor();

    originalEditor.updateOptions({ renderValidationDecorations: 'off' });
    modifiedEditor.updateOptions({ renderValidationDecorations: 'off' });

    if (monacoInstance) {
      if (monacoInstance.languages?.typescript) {
        monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: true,
          noSyntaxValidation: true,
        });
        monacoInstance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: true,
          noSyntaxValidation: true,
        });
      }

      const origModel = originalEditor.getModel();
      const modModel = modifiedEditor.getModel();
      if (origModel) monacoInstance.editor.setModelMarkers(origModel, 'typescript', []);
      if (modModel) monacoInstance.editor.setModelMarkers(modModel, 'typescript', []);

      modifiedEditor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
        onSaveRef.current?.();
        setTimeout(() => {
          updateGitGutterDecorations();
        }, 80);
      });
    }

    modifiedEditor.onDidChangeModelContent(() => {
      const val = modifiedEditor.getValue();
      onChangeContent(val || '');
    });

    modifiedEditor.focus();
  };

  useEffect(() => {
    if (activeTab?.isSplitDiff) {
      setIsSplitDiff(true);
      if (activeTab.diffOriginal !== undefined && activeTab.diffOriginal !== '') {
        setOriginalDiffText(activeTab.diffOriginal);
      } else {
        handleOpenSplitDiff();
      }
    } else {
      setIsSplitDiff(false);
    }
  }, [activeTab?.id, activeTab?.isSplitDiff]);

  const handleToggleToc = () => {
    setIsTocVisible((prev) => {
      const next = !prev;
      localStorage.setItem('aura:mpeTocVisible', String(next));
      return next;
    });
  };

  const toggleOutlineSection = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedOutlineSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    const handleCloseMenu = () => setIsModeMenuOpen(false);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  useEffect(() => {
    if (!monaco) return;
    THEMES.forEach((th) => {
      if (th.id !== 'vs-dark') {
        monaco.editor.defineTheme(th.id, th.monacoTheme as any);
      }
    });
    monaco.editor.setTheme(themeId);
  }, [monaco, themeId]);

  useEffect(() => {
    updateGitGutterDecorations();
  }, [activeTab?.path, activeTab?.content, workspaceDir]);

  const updateVimMode = (newMode: 'NORMAL' | 'INSERT' | 'VISUAL') => {
    setVimMode(newMode);
    if (!editorRef.current) return;

    if (newMode === 'NORMAL') {
      editorRef.current.updateOptions({
        cursorStyle: 'block',
        cursorBlinking: 'solid',
        readOnly: false,
        renderLineHighlight: 'none',
      });
      const pos = editorRef.current.getPosition();
      if (pos) {
        editorRef.current.setSelection({
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column,
        });
      }
    } else if (newMode === 'VISUAL') {
      editorRef.current.updateOptions({
        cursorStyle: 'block',
        cursorBlinking: 'solid',
        readOnly: false,
        renderLineHighlight: 'none',
      });
    } else {
      editorRef.current.updateOptions({
        cursorStyle: 'line',
        cursorBlinking: 'blink',
        readOnly: false,
        renderLineHighlight: 'line',
      });
    }
  };

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;
    editor.focus();
    updateVimMode('NORMAL');
    updateGitGutterDecorations();

    editor.updateOptions({ renderValidationDecorations: 'off' });

    if (monacoInstance && monacoInstance.languages?.typescript) {
      monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
      monacoInstance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
      const model = editor.getModel();
      if (model) {
        monacoInstance.editor.setModelMarkers(model, 'typescript', []);
      }
    }

    editor.onDidChangeModelContent(() => {
      updateGitGutterDecorations();
    });

    editor.addAction({
      id: 'aura-save-file',
      label: 'Save File',
      keybindings: [
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS
      ],
      run: () => {
        onSaveRef.current?.();
        setTimeout(() => {
          updateGitGutterDecorations();
        }, 80);
      }
    });

    editor.onKeyDown((e: any) => {
      const mode = vimModeRef.current;

      const browserEvt = e.browserEvent;
      if (browserEvt?.isComposing || browserEvt?.keyCode === 229 || e.keyCode === 229) {
        if (mode === 'NORMAL' || mode === 'VISUAL') {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      const key = e.browserEvent?.key || '';
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta) {
        if (key.toLowerCase() === 'l' && e.ctrlKey && !e.metaKey) {
          return;
        }
        if (key.toLowerCase() === 'h' && e.ctrlKey && !e.metaKey) {
          return;
        }
        if (key.toLowerCase() === 'k' && e.ctrlKey && !e.metaKey) {
          return;
        }
        if (key.toLowerCase() === 's') {
          e.preventDefault();
          e.stopPropagation();
          onSaveRef.current?.();
          setTimeout(() => {
            updateGitGutterDecorations();
          }, 80);
          return;
        }
        if (key.toLowerCase() === 'w') {
          e.preventDefault();
          e.stopPropagation();
          onQuitNoSaveRef.current?.();
          return;
        }
        return;
      }

      if (mode === 'INSERT') {
        if (key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          updateVimMode('NORMAL');
          return;
        }
        return;
      }

      if (mode === 'VISUAL') {
        if (key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          visualAnchorRef.current = null;
          updateVimMode('NORMAL');
          return;
        }

        if (key === 'h' || key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorLeftSelect', {});
          return;
        }

        if (key === 'l' || key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorRightSelect', {});
          return;
        }

        if (key === 'j' || key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorDownSelect', {});
          return;
        }

        if (key === 'k' || key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorUpSelect', {});
          return;
        }

        if (key === 'w') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorWordStartRightSelect', {});
          return;
        }

        if (key === 'b') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorWordStartLeftSelect', {});
          return;
        }

        if (key === 'y') {
          e.preventDefault();
          e.stopPropagation();
          const sel = editor.getSelection();
          const model = editor.getModel();
          if (sel && model) {
            const selectedText = model.getValueInRange(sel);
            if (selectedText) {
              vimRegisterRef.current = { text: selectedText, isLine: false };
              navigator.clipboard?.writeText(selectedText);
            }
          }
          visualAnchorRef.current = null;
          updateVimMode('NORMAL');
          return;
        }

        if (key === 'd' || key === 'x') {
          e.preventDefault();
          e.stopPropagation();
          const sel = editor.getSelection();
          const model = editor.getModel();
          if (sel && model) {
            const selectedText = model.getValueInRange(sel);
            if (selectedText) {
              vimRegisterRef.current = { text: selectedText, isLine: false };
              navigator.clipboard?.writeText(selectedText);
              editor.executeEdits('vim', [{
                range: sel,
                text: '',
                forceMoveMarkers: true,
              }]);
            }
          }
          visualAnchorRef.current = null;
          updateVimMode('NORMAL');
          return;
        }

        if (key.length === 1) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (mode === 'NORMAL') {
        const now = Date.now();

        if (key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();

          const currentTabs = tabsRef.current;
          const currentActive = activeTabRef.current;
          if (currentTabs && currentTabs.length > 1) {
            const curIdx = currentActive
              ? currentTabs.findIndex((t) => t.id === currentActive.id)
              : -1;

            if (e.shiftKey) {
              const prevIdx = curIdx <= 0 ? currentTabs.length - 1 : curIdx - 1;
              onSelectTabRef.current?.(currentTabs[prevIdx]);
            } else {
              const nextIdx = curIdx >= currentTabs.length - 1 ? 0 : curIdx + 1;
              onSelectTabRef.current?.(currentTabs[nextIdx]);
            }
          }
          return;
        }

        if (key === '^') {
          e.preventDefault();
          e.stopPropagation();
          const model = editor.getModel();
          const pos = editor.getPosition();
          if (model && pos) {
            const lineContent = model.getLineContent(pos.lineNumber);
            const firstNonWhitespace = lineContent.search(/\S/);
            const targetCol = firstNonWhitespace === -1 ? 1 : firstNonWhitespace + 1;
            editor.setPosition({ lineNumber: pos.lineNumber, column: targetCol });
          } else {
            editor.trigger('keyboard', 'cursorLineStart', {});
          }
          return;
        }

        if (key === 'v') {
          e.preventDefault();
          e.stopPropagation();
          const pos = editor.getPosition();
          if (pos) {
            visualAnchorRef.current = { lineNumber: pos.lineNumber, column: pos.column };
            editor.setSelection({
              selectionStartLineNumber: pos.lineNumber,
              selectionStartColumn: pos.column,
              positionLineNumber: pos.lineNumber,
              positionColumn: pos.column + 1,
            });
            updateVimMode('VISUAL');
          }
          return;
        }

        if (key === 'd') {
          if (lastKeyRef.current.key === 'd' && now - lastKeyRef.current.time < 600) {
            e.preventDefault();
            e.stopPropagation();
            const model = editor.getModel();
            const pos = editor.getPosition();
            if (model && pos) {
              const lineContent = model.getLineContent(pos.lineNumber);
              vimRegisterRef.current = { text: lineContent, isLine: true };
              navigator.clipboard?.writeText(lineContent);
            }
            editor.trigger('keyboard', 'editor.action.deleteLines', {});
            lastKeyRef.current = { key: '', time: 0 };
            return;
          }
          lastKeyRef.current = { key: 'd', time: now };
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (key === 'y') {
          if (lastKeyRef.current.key === 'y' && now - lastKeyRef.current.time < 600) {
            e.preventDefault();
            e.stopPropagation();
            const model = editor.getModel();
            const pos = editor.getPosition();
            if (model && pos) {
              const lineContent = model.getLineContent(pos.lineNumber);
              vimRegisterRef.current = { text: lineContent, isLine: true };
              navigator.clipboard?.writeText(lineContent);
            }
            lastKeyRef.current = { key: '', time: 0 };
            return;
          }
          lastKeyRef.current = { key: 'y', time: now };
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (key === 'p') {
          e.preventDefault();
          e.stopPropagation();
          const reg = vimRegisterRef.current;
          const model = editor.getModel();
          const pos = editor.getPosition();
          if (reg.text && model && pos) {
            if (reg.isLine) {
              const lineCount = model.getLineCount();
              const isLastLine = pos.lineNumber === lineCount;
              if (isLastLine) {
                const lastLineMaxCol = model.getLineMaxColumn(pos.lineNumber);
                editor.executeEdits('vim-paste', [{
                  range: {
                    startLineNumber: pos.lineNumber,
                    startColumn: lastLineMaxCol,
                    endLineNumber: pos.lineNumber,
                    endColumn: lastLineMaxCol,
                  },
                  text: '\n' + reg.text,
                  forceMoveMarkers: true,
                }]);
                editor.setPosition({ lineNumber: pos.lineNumber + 1, column: 1 });
              } else {
                editor.executeEdits('vim-paste', [{
                  range: {
                    startLineNumber: pos.lineNumber + 1,
                    startColumn: 1,
                    endLineNumber: pos.lineNumber + 1,
                    endColumn: 1,
                  },
                  text: reg.text + '\n',
                  forceMoveMarkers: true,
                }]);
                editor.setPosition({ lineNumber: pos.lineNumber + 1, column: 1 });
              }
            } else {
              editor.executeEdits('vim-paste', [{
                range: {
                  startLineNumber: pos.lineNumber,
                  startColumn: pos.column,
                  endLineNumber: pos.lineNumber,
                  endColumn: pos.column,
                },
                text: reg.text,
                forceMoveMarkers: true,
              }]);
              editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + reg.text.length });
            }
          } else {
            editor.trigger('keyboard', 'editor.action.clipboardPasteAction', {});
          }
          return;
        }

        if (key === 'u') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'undo', {});
          return;
        }

        if (key === 'x') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'deleteRight', {});
          return;
        }

        if (key === '0') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorLineStart', {});
          return;
        }

        if (key === '$') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorLineEnd', {});
          return;
        }

        if (key === 'w') {
          if (lastKeyRef.current.key === 'w' && now - lastKeyRef.current.time < 600) {
            e.preventDefault();
            e.stopPropagation();
            onSaveRef.current?.();
            lastKeyRef.current = { key: '', time: 0 };
            return;
          }
          lastKeyRef.current = { key: 'w', time: now };
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorWordStartRight', {});
          return;
        }

        if (key === 'b') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorWordStartLeft', {});
          return;
        }

        if (key === 'a') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorRight', {});
          updateVimMode('INSERT');
          return;
        }

        if (key === 'A') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorLineEnd', {});
          updateVimMode('INSERT');
          return;
        }

        if (key === 'I') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorLineStart', {});
          updateVimMode('INSERT');
          return;
        }

        if (key === 'g') {
          if (lastKeyRef.current.key === 'g' && now - lastKeyRef.current.time < 600) {
            e.preventDefault();
            e.stopPropagation();
            editor.trigger('keyboard', 'cursorTop', {});
            lastKeyRef.current = { key: '', time: 0 };
            return;
          }
          lastKeyRef.current = { key: 'g', time: now };
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (key === 'G') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorBottom', {});
          return;
        }

        if (key === 'q') {
          if (lastKeyRef.current.key === 'q' && now - lastKeyRef.current.time < 600) {
            e.preventDefault();
            e.stopPropagation();
            onQuitNoSave();
            lastKeyRef.current = { key: '', time: 0 };
            return;
          }
          lastKeyRef.current = { key: 'q', time: now };
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        lastKeyRef.current = { key: '', time: 0 };

        if (key === 'h' || key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorLeft', {});
          return;
        }
        if (key === 'l' || key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorRight', {});
          return;
        }
        if (key === 'j' || key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorDown', {});
          return;
        }
        if (key === 'k' || key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorUp', {});
          return;
        }

        if (key === 'i') {
          e.preventDefault();
          e.stopPropagation();
          updateVimMode('INSERT');
          return;
        }

        if (key === 'o') {
          e.preventDefault();
          e.stopPropagation();
          editor.trigger('keyboard', 'cursorLineEnd', {});
          editor.trigger('keyboard', 'type', { text: '\n' });
          updateVimMode('INSERT');
          return;
        }

        if (key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          updateVimMode('NORMAL');
          return;
        }

        if (key.length === 1 && !isCtrlOrMeta) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (key === 'Backspace' || key === 'Delete' || key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    });
  };

  return (
    <div
      style={{ backgroundColor: 'var(--aura-editor-bg)', color: 'var(--aura-text)' }}
      className="flex flex-col h-full w-full relative"
    >
      <div
        style={{ backgroundColor: 'var(--aura-editor-tab-bg, var(--aura-editor-bg))', borderColor: 'var(--aura-border)' }}
        className="flex items-center justify-between border-b h-9 relative z-30 select-none"
      >
        <div className="flex-1 flex items-center overflow-x-auto no-scrollbar h-full min-w-0">
          {tabs.map((tab) => {
            const isActive = activeTab?.id === tab.id;
            return (
              <div
                key={tab.id}
                style={{
                  borderColor: 'var(--aura-border)',
                  backgroundColor: isActive ? 'var(--aura-editor-bg)' : 'transparent',
                  borderTopColor: isActive ? 'var(--aura-accent)' : 'transparent',
                }}
                className={`group flex items-center justify-between gap-1.5 px-3 py-1 text-xs cursor-pointer border-r border-t-2 h-full transition-colors relative max-w-[190px] min-w-[90px] flex-shrink-0 ${
                  isActive ? 'text-[var(--aura-editor-fg)] font-semibold' : 'text-[var(--aura-text-muted,#858585)] hover:text-[var(--aura-editor-fg)]'
                }`}
              >
                <div
                  className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden"
                  onClick={() => onSelectTab(tab)}
                  title={tab.name}
                >
                  {tab.type === 'extension' ? (
                    <Puzzle size={13} className="text-[#007acc] flex-shrink-0" />
                  ) : tab.type === 'diff' ? (
                    <GitCompare size={13} className="text-amber-400 flex-shrink-0" />
                  ) : (
                    <FileIcon fileName={tab.name} className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span className="font-mono text-[12px] truncate whitespace-nowrap leading-none flex-1">
                    {tab.name}
                  </span>
                  {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5 flex-shrink-0" />}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onCloseTab(tab.id);
                  }}
                  className="hover:bg-black/10 dark:hover:bg-[#4a4a4a] rounded p-1 text-gray-400 hover:text-[var(--aura-text)] cursor-pointer flex-shrink-0 z-30"
                  title="关闭此标签页 (qq / Cmd+W)"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {activeTab && activeTab.type !== 'extension' && (() => {
          const isDiffTab = activeTab.type === 'diff';
          const isDiffActive = isSplitDiff || isDiffTab;
          const isMarkdownFile = Boolean(
            activeTab.language === 'markdown' ||
            activeTab.name?.toLowerCase().endsWith('.md') ||
            activeTab.name?.toLowerCase().endsWith('.markdown') ||
            activeTab.path?.toLowerCase().endsWith('.md') ||
            activeTab.path?.toLowerCase().endsWith('.markdown')
          );

          return (
            <div className="flex-shrink-0 px-3 flex items-center relative z-50 gap-2">
              {isDiffActive ? (
                <div className="flex items-center gap-2">
                  {/* Segmented Switcher for Split / Unified Diff */}
                  <div
                    style={{
                      backgroundColor: 'var(--aura-card-bg)',
                      borderColor: 'var(--aura-border)',
                    }}
                    className="flex items-center rounded border p-0.5 text-xs font-medium shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setDiffViewMode('split')}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        diffViewMode === 'split'
                          ? 'bg-[#007acc] text-white font-semibold shadow-xs'
                          : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]'
                      }`}
                      title="左右分栏对比 (Side-by-Side Diff)"
                    >
                      <Columns size={12} />
                      <span>Split</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiffViewMode('unified')}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        diffViewMode === 'unified'
                          ? 'bg-[#007acc] text-white font-semibold shadow-xs'
                          : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]'
                      }`}
                      title="单栏行内对比 (Unified Inline Diff)"
                    >
                      <Rows size={12} />
                      <span>Unified</span>
                    </button>
                  </div>

                  {/* Mode Switcher */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsModeMenuOpen(!isModeMenuOpen);
                    }}
                    style={{
                      backgroundColor: 'var(--aura-card-bg)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border shadow-xs hover:border-[#007acc] transition-colors font-medium cursor-pointer"
                  >
                    <span>
                      {activeTab.viewMode === 'markdown-preview'
                        ? 'Markdown Preview Enhanced'
                        : activeTab.viewMode === 'markmap'
                        ? 'Markmap Mind Map'
                        : 'Diff Comparison'}
                    </span>
                    <ChevronDown size={13} className="text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  {/* Code Diff info badge */}
                  {(diffStats.added > 0 || diffStats.modified > 0 || diffStats.deleted > 0) && (
                    <div
                      onClick={handleOpenSplitDiff}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 select-none shadow-xs"
                      title="代码差异 (Code Diff): 点击切换左右分栏对比"
                    >
                      <GitCompare size={12} />
                      <span>Code Diff: +{diffStats.added} -{diffStats.deleted} ~{diffStats.modified}</span>
                    </div>
                  )}

                  {/* Split Diff / Side-by-Side Diff button */}
                  <button
                    type="button"
                    onClick={handleOpenSplitDiff}
                    style={{
                      backgroundColor: 'var(--aura-card-bg)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border shadow-xs hover:border-[#007acc] transition-colors font-medium cursor-pointer"
                    title="Side-by-side code diff comparison (Split Diff)"
                  >
                    <GitCompare size={13} className="text-gray-400" />
                    <span>Split Diff</span>
                  </button>

                  {/* Mode Switcher */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsModeMenuOpen(!isModeMenuOpen);
                    }}
                    style={{
                      backgroundColor: 'var(--aura-card-bg)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border shadow-xs hover:border-[#007acc] transition-colors font-medium cursor-pointer"
                  >
                    <span>
                      {activeTab.viewMode === 'markdown-preview'
                        ? 'Markdown Preview Enhanced'
                        : activeTab.viewMode === 'markmap'
                        ? 'Markmap Mind Map'
                        : 'Text Editor (Vim)'}
                    </span>
                    <ChevronDown size={13} className="text-gray-400" />
                  </button>
                </>
              )}

              {isModeMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: 'var(--aura-card-bg)',
                    borderColor: 'var(--aura-border)',
                    color: 'var(--aura-text)',
                  }}
                  className="absolute right-3 top-8 w-60 border rounded-lg shadow-2xl py-1 text-xs select-none z-50 divide-y divide-[var(--aura-border)]"
                >
                  <div className="py-1">
                    <div
                      onClick={() => {
                        setIsModeMenuOpen(false);
                        if (isDiffTab) {
                          const targetPath = activeTab.path;
                          onCloseTab(activeTab.id);
                          if (targetPath && onOpenFileByPath) {
                            onOpenFileByPath(targetPath, true);
                          }
                        } else {
                          activeTab.viewMode = 'editor';
                          activeTab.isSplitDiff = false;
                          onSelectTab({ ...activeTab, viewMode: 'editor', isSplitDiff: false });
                          if (isSplitDiff) {
                            handleCloseSplitDiff();
                          }
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[#007acc]/20 cursor-pointer ${
                        (!activeTab.viewMode || activeTab.viewMode === 'editor') && !isDiffActive ? 'text-[#007acc] font-semibold' : ''
                      }`}
                    >
                      <Code size={13} />
                      <span>Text Editor (Vim)</span>
                    </div>

                    <div
                      onClick={() => {
                        if (!isDiffActive) {
                          handleOpenSplitDiff();
                        }
                        setIsModeMenuOpen(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[#007acc]/20 cursor-pointer ${
                        isDiffActive ? 'text-[#007acc] font-semibold' : ''
                      }`}
                    >
                      <GitCompare size={13} />
                      <span>Split Diff</span>
                    </div>
                  </div>

                  {isMarkdownFile && (
                    <div className="py-1">
                      <div
                        onClick={() => {
                          activeTab.viewMode = 'markdown-preview';
                          onSelectTab({ ...activeTab });
                          setIsModeMenuOpen(false);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[#007acc]/20 cursor-pointer ${
                          activeTab.viewMode === 'markdown-preview' ? 'text-[#007acc] font-semibold' : ''
                        }`}
                      >
                        <Eye size={13} />
                        <span>Markdown Preview Enhanced</span>
                      </div>

                      <div
                        onClick={() => {
                          activeTab.viewMode = 'markmap';
                          onSelectTab({ ...activeTab });
                          setIsModeMenuOpen(false);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[#007acc]/20 cursor-pointer ${
                          activeTab.viewMode === 'markmap' ? 'text-[#007acc] font-semibold' : ''
                        }`}
                      >
                        <Network size={13} />
                        <span>Markmap Mind Map</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="flex-1 relative overflow-hidden">
        {activeTab ? (
          activeTab.type === 'extension' && activeTab.extensionData ? (
            <div className="h-full w-full overflow-y-auto p-8 select-text">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-start gap-6 pb-6 border-b border-[var(--aura-border)]">
                  <div className="w-24 h-24 rounded-xl bg-[var(--aura-card-bg,#252526)] border border-[var(--aura-border)] p-3 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg">
                    {PLUGIN_LOGOS[activeTab.extensionData.id] || (
                      activeTab.extensionData.icon ? (
                        <img src={activeTab.extensionData.icon} alt={activeTab.extensionData.name} className="w-full h-full object-contain" />
                      ) : (
                        <Puzzle size={40} className="text-[#007acc]" />
                      )
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-[var(--aura-text)] tracking-tight">{activeTab.extensionData.name}</h1>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--aura-card-bg,#2d2d2d)] text-[var(--aura-text-muted)] font-mono">v{activeTab.extensionData.version}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--aura-text-muted)]">
                      <span className="text-[#007acc] font-medium">{activeTab.extensionData.publisher || 'Community'}</span>
                      {(activeTab.extensionData.publisher === 'Microsoft' || activeTab.extensionData.publisher === 'Go Team at Google' || activeTab.extensionData.publisher === 'GitHub') && (
                        <CheckCircle2 size={13} className="text-[#007acc] fill-[#007acc] text-white" />
                      )}
                      <span>•</span>
                      <span className="flex items-center gap-1"><Download size={12} /> {activeTab.extensionData.downloads || '100K+'} installs</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-amber-400"><Star size={12} fill="currentColor" /> {activeTab.extensionData.rating || 5.0}</span>
                    </div>

                    <p className="text-sm text-[var(--aura-text)] leading-relaxed pt-1">
                      {activeTab.extensionData.description}
                    </p>

                    <div className="pt-3 flex items-center gap-2">
                      {(() => {
                        const isLiveInstalled = plugins.some(
                          (p) => p.id === activeTab.extensionData!.id && p.installed !== false
                        );
                        const isLiveEnabled = plugins.some(
                          (p) => p.id === activeTab.extensionData!.id && p.enabled
                        );

                        if (isLiveInstalled) {
                          return (
                            <>
                              <button
                                onClick={() => onTogglePlugin?.(activeTab.extensionData!.id)}
                                className="aura-btn-secondary px-3 py-1"
                              >
                                {isLiveEnabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => {
                                  onUninstallPlugin?.(activeTab.extensionData!.id);
                                }}
                                className="aura-btn-danger px-3 py-1"
                              >
                                Uninstall
                              </button>
                            </>
                          );
                        }

                        return (
                          <button
                            onClick={() => onInstallPlugin?.(activeTab.extensionData)}
                            className="aura-btn-primary px-4 py-1"
                          >
                            <Download size={13} />
                            <span>Install</span>
                          </button>
                        );
                      })()}
                      <span className="text-xs px-2.5 py-1 rounded bg-[var(--aura-card-bg,#2a2a2a)] text-[var(--aura-text-muted)] font-medium ml-2 border border-[var(--aura-border)]">
                        {activeTab.extensionData.category || 'General'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-4 border-b border-[var(--aura-border)] pb-2 text-xs font-semibold text-[var(--aura-text-muted)]">
                    <span className="text-[#007acc] border-b-2 border-[#007acc] pb-2 -mb-2.5">Details (Overview)</span>
                    <span className="hover:text-[var(--aura-text)] cursor-pointer">Feature Contributions</span>
                    <span className="hover:text-[var(--aura-text)] cursor-pointer">Changelog</span>
                  </div>

                  <div className="prose max-w-none text-xs text-[var(--aura-text)] space-y-4 font-sans leading-relaxed">
                    <h2 className="text-lg font-bold text-[var(--aura-text)] pt-2 border-b border-[var(--aura-border)] pb-1">Overview</h2>
                    <p>
                      {activeTab.extensionData.name} provides first-class support for {activeTab.extensionData.category || 'development'} workflows in Aura IDE.
                    </p>

                    <h3 className="text-sm font-semibold text-[var(--aura-text)] pt-2">Key Features</h3>
                    <ul className="list-disc pl-5 space-y-1 text-[var(--aura-text-muted)]">
                      <li>IntelliSense code completion and signature documentation</li>
                      <li>Semantic highlighting and real-time syntax verification</li>
                      <li>Integrated code navigation, hover previews and symbol outlines</li>
                      <li>Zero configuration needed — works natively with Aura desktop workspace</li>
                    </ul>

                    <h3 className="text-sm font-semibold text-[var(--aura-text)] pt-2">Extension Identifier</h3>
                    <div className="p-3 bg-[var(--aura-card-bg,#181818)] rounded-md font-mono text-[11px] text-[#007acc] border border-[var(--aura-border)]">
                      {activeTab.extensionData.id}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab.viewMode === 'markdown-preview' ? (
            <div className="h-full w-full flex bg-[var(--aura-editor-bg)] text-[var(--aura-editor-fg)] overflow-hidden relative">
              <div className="flex-1 h-full overflow-y-auto px-8 py-6 select-text no-scrollbar">
                <div className="w-full space-y-4">
                  <MarkdownPreviewEnhanced
                    content={activeTab.content}
                    currentFilePath={activeTab.path}
                    workspaceDir={workspaceDir}
                    onOpenFileByPath={onOpenFileByPath}
                  />
                </div>
              </div>

              {/* Right-aligned Sticky Table of Contents Outline with Collapse/Expand */}
              {isTocVisible ? (
                <div
                  style={{ borderColor: 'var(--aura-border)' }}
                  className="w-72 h-full border-l flex-shrink-0 flex flex-col bg-[var(--aura-editor-tab-bg,var(--aura-editor-bg))] text-[var(--aura-editor-fg)] overflow-hidden select-none transition-all"
                >
                  <div className="p-2.5 border-b border-[var(--aura-border)] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--aura-text)]">
                      <ListTree size={14} className="text-[#007acc]" />
                      <span>Table of Contents</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleToc}
                      title="向右收起大纲目录"
                      className="p-1 rounded text-gray-400 hover:text-[var(--aura-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <PanelRightClose size={14} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar text-xs">
                    {(() => {
                      const rawHeadings = activeTab.content
                        .split('\n')
                        .map((line, lineIdx) => ({ line, lineIdx }))
                        .filter(({ line }) => line.trim().startsWith('#'))
                        .map(({ line, lineIdx }, headingIdx) => {
                          const level = line.match(/^#+/)?.[0].length || 1;
                          const title = line.replace(/^#+\s*/, '');
                          return {
                            headingIdx,
                            level,
                            title,
                            lineIdx,
                          };
                        });

                      if (rawHeadings.length === 0) {
                        return (
                          <div className="p-4 text-center text-xs text-[var(--aura-text-muted)]">
                            暂无标题层级
                          </div>
                        );
                      }

                      return rawHeadings.map((h, i) => {
                        const nextHeading = rawHeadings[i + 1];
                        const hasSub = nextHeading && nextHeading.level > h.level;
                        const isCollapsed = !!collapsedOutlineSections[`h-${h.headingIdx}`];

                        let isHiddenByParent = false;
                        for (let j = i - 1; j >= 0; j--) {
                          if (rawHeadings[j].level < h.level) {
                            if (collapsedOutlineSections[`h-${rawHeadings[j].headingIdx}`]) {
                              isHiddenByParent = true;
                              break;
                            }
                          }
                        }
                        if (isHiddenByParent) return null;

                        return (
                          <div
                            key={h.headingIdx}
                            style={{ paddingLeft: `${(h.level - 1) * 12 + 4}px` }}
                            onClick={() => {
                              const targetEl = document.getElementById(`heading-${h.headingIdx}`);
                              if (targetEl) {
                                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            }}
                            className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-[#007acc]/15 cursor-pointer text-xs transition-colors group"
                          >
                            {hasSub ? (
                              <span
                                onClick={(e) => toggleOutlineSection(`h-${h.headingIdx}`, e)}
                                className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-[var(--aura-text)] flex-shrink-0"
                              >
                                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                              </span>
                            ) : (
                              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-400">
                                <span className="w-1 h-1 rounded-full bg-gray-400" />
                              </span>
                            )}

                            <span
                              title={h.title}
                              className={`truncate flex-1 text-[12px] leading-snug ${
                                h.level === 1
                                  ? 'text-[#007acc] font-semibold'
                                  : h.level === 2
                                  ? 'text-[#0284c7] font-medium'
                                  : 'text-[var(--aura-text)] opacity-90'
                              } group-hover:text-[#007acc]`}
                            >
                              {h.title}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleToc}
                  title="展开大纲目录 (Table of Contents)"
                  style={{
                    backgroundColor: 'var(--aura-card-bg)',
                    borderColor: 'var(--aura-border)',
                  }}
                  className="absolute right-3 top-3 p-1.5 rounded-lg border shadow-lg hover:border-[#007acc] text-gray-400 hover:text-[var(--aura-text)] transition-all z-20 flex items-center gap-1.5 text-xs"
                >
                  <PanelRightOpen size={15} className="text-[#007acc]" />
                  <span className="font-mono text-[11px]">Outline</span>
                </button>
              )}
            </div>
          ) : activeTab.viewMode === 'markmap' ? (
            <div className="h-full w-full flex flex-col bg-[var(--aura-editor-bg)] text-[var(--aura-editor-fg)] select-none">
              <div className="flex-1 w-full h-full min-h-0 relative">
                <MarkmapViewer content={activeTab.content} themeId={themeId} />
              </div>
            </div>
          ) : (activeTab.type === 'diff' || isSplitDiff) ? (
            <div className="h-full w-full flex flex-col bg-[var(--aura-editor-bg)] overflow-hidden relative select-none">
              <DiffEditor
                key={`diff-${activeTab.id}-${diffViewMode}`}
                height="100%"
                theme={themeId}
                language={activeTab.language}
                original={(activeTab.type === 'diff' && activeTab.diffOriginal) ? activeTab.diffOriginal : originalDiffText}
                modified={activeTab.content}
                onMount={handleDiffMount}
                options={{
                  fontSize: fontSize || 14,
                  fontFamily: getEffectiveEditorFont(fontFamily),
                  readOnly: false,
                  originalEditable: false,
                  renderSideBySide: diffViewMode === 'split',
                  enableSplitViewResizing: true,
                  renderIndicators: true,
                  renderMarginRevertIcon: true,
                  renderOverviewRuler: true,
                  renderValidationDecorations: 'off',
                  diffAlgorithm: 'advanced',
                  ignoreTrimWhitespace: false,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  minimap: { enabled: true, scale: 0.75 },
                  diffWordWrap: 'on',
                  wordWrap: 'on',
                  automaticLayout: true,
                  hideUnchangedRegions: {
                    enabled: true,
                    revealLineCount: 20,
                    minimumLineCount: 10,
                    contextLineCount: 3,
                  },
                  lineNumbers: 'on',
                  lineNumbersMinChars: 4,
                  glyphMargin: true,
                  folding: true,
                  contextmenu: false,
                }}
              />
            </div>
          ) : (
            <div className="h-full w-full flex flex-col">
              <div className="flex-1 overflow-hidden">
                <Editor
                  key={activeTab.id}
                  height="100%"
                  theme={themeId}
                  path={activeTab.path}
                  defaultLanguage={activeTab.language}
                  defaultValue={activeTab.content}
                  onMount={handleEditorDidMount}
                  onChange={(val) => onChangeContent(val || '')}
                  options={{
                    fontSize: fontSize || 14,
                    fontFamily: getEffectiveEditorFont(fontFamily),
                    tabSize: 2,
                    readOnly: false,
                    renderLineHighlight: vimMode === 'INSERT' ? 'line' : 'none',
                    minimap: { enabled: true, scale: 0.75 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    lineNumbers: 'on',
                    lineNumbersMinChars: 4,
                    glyphMargin: false,
                    lineDecorationsWidth: 10,
                    folding: true,
                    wordWrap: 'on',
                    unicodeHighlight: {
                      ambiguousCharacters: false,
                      invisibleCharacters: false,
                      nonBasicASCII: false,
                    },
                    contextmenu: false,
                  }}
                />
              </div>
              <div
                style={{
                  backgroundColor: 'var(--aura-editor-tab-bg, var(--aura-editor-bg))',
                  borderColor: 'var(--aura-border)',
                  color: vimMode === 'INSERT' ? '#4ec9b0' : (vimMode === 'VISUAL' ? '#dcdcaa' : 'var(--aura-accent)'),
                }}
                className="h-5 px-3 border-t text-[11px] font-mono flex items-center justify-between select-none"
              >
                <span>-- {vimMode} --</span>
                <div className="flex items-center gap-3">
                  {(diffStats.added > 0 || diffStats.modified > 0 || diffStats.deleted > 0) && (
                    <span
                      onClick={handleOpenSplitDiff}
                      className="text-[10px] text-amber-400 font-mono hover:underline cursor-pointer"
                      title="点击开启左右分栏对比"
                    >
                      Code Diff: +{diffStats.added} -{diffStats.deleted} ~{diffStats.modified}
                    </span>
                  )}
                  <span>{activeTab.language}</span>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="h-full w-full select-none flex flex-col items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 opacity-20">
              <span className="text-6xl font-black tracking-widest font-mono text-[var(--aura-text)] select-none">
                Aura
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
