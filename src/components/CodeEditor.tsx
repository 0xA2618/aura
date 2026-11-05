import React, { useEffect, useRef, useState } from 'react';
import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';
import { OpenTab, PluginManifest } from '../types';
import { X, FileCode, Puzzle, Download, Star, ShieldCheck, CheckCircle2, ChevronDown, ChevronRight, ChevronLeft, ListTree, Code, Eye, Network, PanelRightClose, PanelRightOpen, GitCompare } from 'lucide-react';
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
  onSelectTab: (tab: OpenTab) => void;
  onCloseTab: (tabId: string) => void;
  onChangeContent: (content: string) => void;
  onSave: () => void;
  onQuitNoSave: () => void;
  onTogglePlugin?: (id: string) => void;
  onInstallPlugin?: (plugin: any) => void;
  onUninstallPlugin?: (id: string) => void;
  workspaceDir?: string;
  onOpenFileByPath?: (path: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  activeTab,
  tabs,
  plugins = [],
  themeId = 'vs-dark',
  fontSize = 13,
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
  const gitHeadContentRef = useRef<Record<string, string>>({});
  const editorDecorationsRef = useRef<any>(null);

  const updateGitGutterDecorations = async () => {
    if (!editorRef.current || !monaco || !activeTab) return;
    if (activeTab.type === 'diff' || activeTab.type === 'extension') return;

    let headText = gitHeadContentRef.current[activeTab.path];
    if (headText === undefined) {
      headText = await fetchGitHeadContent(activeTab.path, workspaceDir);
      gitHeadContentRef.current[activeTab.path] = headText;
    }

    if (!headText) {
      if (editorDecorationsRef.current) {
        editorDecorationsRef.current.clear();
      }
      return;
    }

    const currentText = editorRef.current.getValue();
    const originalLines = headText.split('\n');
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
    const newDecorations: any[] = [];

    hunks.forEach((hunk) => {
      let marginClassName = '';
      let overviewColor = '';

      if (hunk.type === 'add') {
        marginClassName = 'aura-git-gutter-added';
        overviewColor = '#28a745';
      } else if (hunk.type === 'delete') {
        marginClassName = 'aura-git-gutter-deleted';
        overviewColor = '#e5534b';
      } else {
        marginClassName = 'aura-git-gutter-modified';
        overviewColor = '#e3b341';
      }

      newDecorations.push({
        range: new monaco.Range(hunk.startLine, 1, hunk.endLine, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: marginClassName,
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

        {activeTab && activeTab.type !== 'extension' && (
          <div className="flex-shrink-0 px-3 flex items-center relative z-50">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsModeMenuOpen(!isModeMenuOpen);
              }}
              style={{
                backgroundColor: 'var(--aura-card-bg)',
                borderColor: 'var(--aura-border)',
                color: 'var(--aura-text)'
              }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border shadow-xs hover:border-[#007acc] transition-colors font-medium cursor-pointer"
            >
              <span>
                {activeTab.viewMode === 'markdown-preview'
                  ? 'Markdown Preview Enhanced'
                  : activeTab.viewMode === 'markmap'
                  ? 'Markmap Mind Map'
                  : activeTab.viewMode === 'outline'
                  ? 'Article Structure'
                  : 'Text Editor (Vim)'}
              </span>
              <ChevronDown size={13} className="text-gray-400" />
            </button>

            {isModeMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: 'var(--aura-card-bg)',
                  borderColor: 'var(--aura-border)',
                  color: 'var(--aura-text)'
                }}
                className="absolute right-3 top-8 w-60 border rounded-lg shadow-2xl py-1 text-xs select-none z-50 divide-y divide-[var(--aura-border)]"
              >
                <div className="py-1">
                  <div
                    onClick={() => {
                      activeTab.viewMode = 'editor';
                      onSelectTab({ ...activeTab });
                      setIsModeMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[#007acc]/20 cursor-pointer ${
                      !activeTab.viewMode || activeTab.viewMode === 'editor' ? 'text-[#007acc] font-semibold' : ''
                    }`}
                  >
                    <Code size={13} />
                    <span>Text Editor (Vim)</span>
                  </div>
                </div>

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

                  <div
                    onClick={() => {
                      activeTab.viewMode = 'outline';
                      onSelectTab({ ...activeTab });
                      setIsModeMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[#007acc]/20 cursor-pointer ${
                      activeTab.viewMode === 'outline' ? 'text-[#007acc] font-semibold' : ''
                    }`}
                  >
                    <ListTree size={13} />
                    <span>Article Structure</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
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
                                className="px-3 py-1 rounded text-xs font-medium bg-[var(--aura-card-bg,#3c3c3c)] hover:bg-[#4a4a4a] text-[var(--aura-text)] border border-[var(--aura-border)] transition-colors"
                              >
                                {isLiveEnabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => {
                                  onUninstallPlugin?.(activeTab.extensionData!.id);
                                }}
                                className="px-3 py-1 rounded text-xs font-medium bg-[var(--aura-card-bg,#3c3c3c)] hover:bg-red-900/60 text-red-500 hover:text-white border border-[var(--aura-border)] transition-colors"
                              >
                                Uninstall
                              </button>
                            </>
                          );
                        }

                        return (
                          <button
                            onClick={() => onInstallPlugin?.(activeTab.extensionData)}
                            className="px-4 py-1 rounded text-xs font-medium bg-[#007acc] hover:bg-[#0062a3] text-white transition-colors flex items-center gap-1.5"
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
                <div className="w-full max-w-4xl space-y-4">
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
          ) : activeTab.viewMode === 'outline' ? (
            <div className="h-full w-full overflow-y-auto p-8 select-text bg-[var(--aura-editor-bg)] text-[var(--aura-editor-fg)]">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="space-y-2 pt-2">
                  {activeTab.content
                    .split('\n')
                    .map((line, lineIdx) => ({ line, lineIdx }))
                    .filter(({ line }) => line.trim().startsWith('#'))
                    .map(({ line, lineIdx }) => {
                      const level = line.match(/^#+/)?.[0].length || 1;
                      const title = line.replace(/^#+\s*/, '');
                      return (
                        <div
                          key={lineIdx}
                          style={{ paddingLeft: `${(level - 1) * 20}px` }}
                          onClick={() => {
                            activeTab.viewMode = 'editor';
                            onSelectTab({ ...activeTab });
                            setTimeout(() => {
                              if (editorRef.current) {
                                editorRef.current.revealLineInCenter(lineIdx + 1);
                                editorRef.current.setPosition({ lineNumber: lineIdx + 1, column: 1 });
                                editorRef.current.focus();
                              }
                            }, 50);
                          }}
                          className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-[#007acc]/15 cursor-pointer text-xs transition-colors border border-transparent hover:border-[#007acc]/40 group"
                        >
                          <span
                            style={{
                              backgroundColor: level === 1 ? '#007acc' : level === 2 ? '#10b981' : '#f59e0b',
                            }}
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          />
                          <span className={`font-mono text-gray-500 text-[11px]`}>H{level}</span>
                          <span className="text-[var(--aura-text)] font-medium group-hover:text-[#007acc] truncate">
                            {title}
                          </span>
                          <span className="ml-auto text-[10px] text-gray-500 font-mono opacity-0 group-hover:opacity-100">
                            line {lineIdx + 1}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : activeTab.type === 'diff' ? (
            <div className="h-full w-full flex flex-col bg-[var(--aura-editor-bg)]">
              <div className="flex-1 overflow-hidden">
                <DiffEditor
                  key={activeTab.id}
                  height="100%"
                  theme={themeId}
                  language={activeTab.language || 'plaintext'}
                  original={activeTab.diffOriginal ?? ''}
                  modified={activeTab.diffModified ?? activeTab.content}
                  options={{
                    fontSize: fontSize || 14,
                    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: true, scale: 0.75 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    lineNumbers: 'on',
                    lineNumbersMinChars: 4,
                    glyphMargin: false,
                    lineDecorationsWidth: 10,
                    folding: true,
                    wordWrap: 'on',
                    originalEditable: false,
                    contextmenu: false,
                  }}
                />
              </div>
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
                    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
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
                <span></span>
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
