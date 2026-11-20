import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { Copy, ClipboardPaste, ChevronDown } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import {
  isTauri,
  createTerminalPTY,
  startTerminalReading,
  writeTerminalPTY,
  resizeTerminalPTY,
  killTerminalPTY,
  onTerminalData,
  onTerminalExit,
  fetchConversationPrompts
} from '../services/fileService';

interface TerminalPaneProps {
  id: string;
  cwd?: string;
  mode?: 'shell' | 'opencode' | string;
  autoFocus?: boolean;
  themeId?: string;
  fontSize?: number;
  fontFamily?: string;
  isVisible?: boolean;
}

const DEFAULT_FALLBACK_FONTS = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", monospace';

export const getEffectiveTerminalFont = (customFont?: string) => {
  if (customFont && customFont.trim()) {
    const clean = customFont.trim().replace(/^['"]|['"]$/g, '');
    return `"${clean}", "JetBrains Mono", "Hack Nerd Font", Menlo, Monaco, ${DEFAULT_FALLBACK_FONTS}`;
  }
  return `"JetBrains Mono", "Hack Nerd Font Mono", "Hack Nerd Font", Menlo, Monaco, "Courier New", ${DEFAULT_FALLBACK_FONTS}`;
};

export const TerminalPane = React.memo<TerminalPaneProps>(
  ({ id, cwd, mode = 'shell', autoFocus = false, themeId, fontSize = 13.5, fontFamily, isVisible = true }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermInstance = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [userTurns, setUserTurns] = useState<{ id: string; summary: string; fullText: string }[]>([]);
    const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
    const [isOutlineHovered, setIsOutlineHovered] = useState(false);

    // 解析当前终端会话关联的 conversation id
    const sessionId = useMemo(() => {
      if (mode && mode.includes('--conversation')) {
        const parts = mode.split('--conversation');
        if (parts[1]) return parts[1].trim().split(' ')[0].replace(/['"]/g, '');
      }
      if (mode && mode.includes('-c ')) {
        const parts = mode.split('-c ');
        if (parts[1]) return parts[1].trim().split(' ')[0].replace(/['"]/g, '');
      }
      if (/^[0-9a-f-]{36}$/i.test(id)) return id;
      return null;
    }, [id, mode]);

    // 是否为 agy/AI 对话会话
    const isAgySession = useMemo(() => {
      const m = (mode || '').toLowerCase();
      const i = (id || '').toLowerCase();
      return !!sessionId || m.includes('agy') || m.includes('antigravity') || i.includes('antigravity') || i.includes('agent-');
    }, [id, mode, sessionId]);

    // 外面最多只显示最新的 10 条杠
    const displayedTurns = useMemo(() => {
      if (userTurns.length <= 10) return userTurns;
      return userTurns.slice(-10);
    }, [userTurns]);

    // 实时同步会话提问记录：每发一次就在最下面追加一条，新会话或第一条发出就立刻提示展示
    const refreshPrompts = useCallback(async () => {
      if (!isAgySession) return;
      try {
        const turns = await fetchConversationPrompts(sessionId, cwd);
        if (turns && turns.length > 0) {
          setUserTurns((prev) => {
            if (prev.length !== turns.length || prev[prev.length - 1]?.id !== turns[turns.length - 1]?.id) {
              setActiveTurnId(turns[turns.length - 1].id);
              return turns;
            }
            return prev;
          });
        }
      } catch (err) {
        // ignore
      }
    }, [sessionId, isAgySession, cwd]);

    useEffect(() => {
      if (!isAgySession) {
        setUserTurns([]);
        return;
      }
      refreshPrompts();

      // 自动轮询：每 1200ms 检测一次新写入的提问，确保每发一次立刻在最下面添加一条
      const timer = setInterval(refreshPrompts, 1200);
      return () => clearInterval(timer);
    }, [isAgySession, refreshPrompts]);

    const handleJumpToTurn = useCallback((turn: { id: string; summary: string; fullText: string }) => {
      setActiveTurnId(turn.id);
      const term = xtermInstance.current;
      if (!term || !term.buffer || !term.buffer.active) return;
      const targetText = turn.summary.replace(/\.\.\.$/, '').trim();
      const buf = term.buffer.active;
      for (let i = 0; i < buf.length; i++) {
        const line = buf.getLine(i);
        if (line && line.translateToString().includes(targetText.slice(0, 8))) {
          term.scrollToLine(Math.max(0, i - 2));
          break;
        }
      }
    }, []);

    const handleScrollToBottom = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (xtermInstance.current) {
        xtermInstance.current.scrollToBottom();
      }
      const vp = terminalRef.current?.querySelector('.xterm-viewport') as HTMLElement | null;
      if (vp) {
        vp.scrollTop = vp.scrollHeight;
      }
      setShowScrollBottom(false);
      xtermInstance.current?.focus();
    }, []);

    const safeFit = useCallback(() => {
      if (!fitAddonRef.current || !terminalRef.current) return;
      const w = terminalRef.current.clientWidth;
      const h = terminalRef.current.clientHeight;
      if (w > 20 && h > 20) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.error('[Terminal safeFit error]', e);
        }
      }
    }, []);

    useEffect(() => {
      if (!terminalRef.current) return;

      const computedStyle = getComputedStyle(document.documentElement);
      const dockBg = computedStyle.getPropertyValue('--aura-dock-bg').trim() || '#181818';
      const dockFg = computedStyle.getPropertyValue('--aura-dock-fg').trim() || '#e0e0e0';

      const isLightBg = (hexColor: string) => {
        let c = hexColor.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        if (c.length !== 6) return false;
        const r = parseInt(c.slice(0, 2), 16);
        const g = parseInt(c.slice(2, 4), 16);
        const b = parseInt(c.slice(4, 6), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 140;
      };

      const isLight = isLightBg(dockBg);

      const term = new Terminal({
        allowProposedApi: true,
        cursorBlink: true,
        cursorStyle: 'block',
        cursorInactiveStyle: 'outline',
        fontSize: fontSize,
        fontFamily: getEffectiveTerminalFont(fontFamily),
        lineHeight: 1.18,
        letterSpacing: 0,
        theme: {
          background: dockBg,
          foreground: dockFg,
          cursor: isLight ? '#007acc' : '#ffffff',
          cursorAccent: dockBg,
          selectionBackground: isLight ? 'rgba(0, 122, 204, 0.25)' : 'rgba(255, 255, 255, 0.25)',
          black: isLight ? '#f0f0f0' : '#1e1e1e',
          red: '#f44747',
          green: isLight ? '#22863a' : '#608b4e',
          yellow: isLight ? '#b08800' : '#dcdcaa',
          blue: isLight ? '#0366d6' : '#569cd6',
          magenta: '#c586c0',
          cyan: isLight ? '#0598bc' : '#4ec9b0',
          white: isLight ? '#24292e' : '#d4d4d4',
          brightBlack: isLight ? '#959da5' : '#808080',
          brightRed: '#f44747',
          brightGreen: isLight ? '#28a745' : '#608b4e',
          brightYellow: isLight ? '#ffd33d' : '#dcdcaa',
          brightBlue: isLight ? '#2188ff' : '#569cd6',
          brightMagenta: '#c586c0',
          brightCyan: isLight ? '#17a2b8' : '#4ec9b0',
          brightWhite: isLight ? '#24292e' : '#ffffff',
        },
        allowTransparency: true,
      });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    try {
      const unicode11Addon = new Unicode11Addon();
      term.loadAddon(unicode11Addon);
      term.unicode.activeVersion = '11';
    } catch (err) {
      console.warn('[Unicode11Addon load warning]', err);
    }

    // Suppress unrequested Device Attributes (DA1 / DA2) responses that leak as ^[[?1;2c into stdout
    term.parser.registerCsiHandler({ final: 'c' }, () => true);
    term.parser.registerCsiHandler({ prefix: '>', final: 'c' }, () => true);

    // opencode TUI 把 Option+Enter（xterm.js 发送 \x1b\r，即 META+Enter）解释为“换行”；
    // xterm.js 默认把 Shift+Enter 当成普通 Enter（直接发 \r → 发送消息）。
    // 这里迁移为 Shift+Enter = 换行：捕获后直写 \x1b\r，并阻止 xterm 再发 \r。
    if (typeof mode === 'string' && mode.trim().startsWith('opencode')) {
      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (
          event.type === 'keydown' &&
          event.key === 'Enter' &&
          event.shiftKey &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          event.preventDefault();
          writeTerminalPTY(id, '\x1b\r');
          return false; // 阻止 xterm.js 的默认 Enter 处理
        }
        return true;
      });
    }

    term.onBell(() => {});
    term.open(terminalRef.current);
    safeFit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    const checkScrollBottom = () => {
      const vp = terminalRef.current?.querySelector('.xterm-viewport') as HTMLElement | null;
      if (vp && vp.scrollHeight > vp.clientHeight) {
        const dist = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
        setShowScrollBottom(dist > 15);
        return;
      }
      if (!term || !term.buffer || !term.buffer.active) return;
      const buf = term.buffer.active;
      const atBottom = buf.viewportY >= buf.baseY - 1;
      setShowScrollBottom(!atBottom);
    };

    const scrollDisposer = term.onScroll(() => {
      checkScrollBottom();
    });

    const writeParsedDisposer = term.onWriteParsed(() => {
      checkScrollBottom();
    });

    const termEl = terminalRef.current;
    let vpCleanup: (() => void) | null = null;
    if (termEl) {
      const onWheel = () => {
        requestAnimationFrame(checkScrollBottom);
      };
      termEl.addEventListener('wheel', onWheel, { passive: true });
      const timer = setTimeout(() => {
        const vp = termEl.querySelector('.xterm-viewport') as HTMLElement | null;
        if (vp) {
          const onVpScroll = () => checkScrollBottom();
          vp.addEventListener('scroll', onVpScroll, { passive: true });
          vpCleanup = () => {
            vp.removeEventListener('scroll', onVpScroll);
            termEl.removeEventListener('wheel', onWheel);
          };
        }
      }, 150);
    }

    // ---- xterm.js 5.5/6.0.0 bug workaround (#6144, fixed by PR #6200 in 7.0.0) ----
    // macOS 中文输入法直接上屏的全角符号（？！，。（）等）走 beforeinput → input → keydown
    // （input 事件早于 keydown 到达），会被 xterm 内部的 `_keyDownSeen` 门吞掉，表现为“第一个字符按不进去”。
    // 在祖先容器 capture 阶段提前清掉该内部标志，使组字文本顺利进入 PTY；
    // 组字输入的汉字走 composition 路径不受影响。xterm 7.0.0 含 PR #6200 后可删除此段。
    const handleImeBeforeInput = (ev: Event) => {
      const inputEvent = ev as InputEvent;
      if (inputEvent.inputType !== 'insertText' || !inputEvent.data) return;
      const core = (term as unknown as { _core?: { _keyDownSeen?: boolean } })._core;
      if (core && '_keyDownSeen' in core) {
        core._keyDownSeen = false;
      }
    };
    if (termEl) {
      termEl.addEventListener('beforeinput', handleImeBeforeInput, true);
    }

    const handleNativeDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleNativeDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedPath =
        (window as any).__AURA_DRAGGED_PATH__ ||
        e.dataTransfer?.getData('application/aura-path') ||
        e.dataTransfer?.getData('text/plain');

      if (droppedPath) {
        writeTerminalPTY(id, `"${droppedPath}" `);
        if (typeof window !== 'undefined' && (window as any).electronAPI?.terminalWrite) {
          (window as any).electronAPI.terminalWrite(id, `"${droppedPath}" `);
        }
        term.focus();
      }
    };

    if (termEl) {
      termEl.addEventListener('dragenter', handleNativeDragOver, true);
      termEl.addEventListener('dragover', handleNativeDragOver, true);
      termEl.addEventListener('drop', handleNativeDrop, true);
    }

    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
    let cleanupListeners: (() => void)[] = [];

    if (isTauri) {
      let isSubscribed = true;

      const initTauriPTY = async () => {
        try {
          const unsubData = await onTerminalData(id, (data: string) => {
            if (isSubscribed) {
              term.write(data);
            }
          });
          cleanupListeners.push(unsubData);

          const unsubExit = await onTerminalExit(id, () => {
            if (isSubscribed) {
              term.writeln('\r\n[Process completed]');
            }
          });
          cleanupListeners.push(unsubExit);

          term.onData((data) => {
            writeTerminalPTY(id, data);
            if (data.includes('\r') || data.includes('\n')) {
              setTimeout(refreshPrompts, 350);
              setTimeout(refreshPrompts, 1200);
              setTimeout(refreshPrompts, 2500);
            }
          });

          term.onResize(({ cols, rows }) => {
            resizeTerminalPTY(id, cols, rows);
          });

          safeFit();
          await createTerminalPTY(id, term.cols || 80, term.rows || 24, cwd, mode);
          await startTerminalReading(id);
        } catch (err: any) {
          term.writeln(`\r\n\x1b[31m[Terminal Init Error: ${err?.message || err}]\x1b[0m\r\n`);
        }
      };

      initTauriPTY();

      const focusTimer = setTimeout(() => {
        if (autoFocus && isVisible) {
          term.focus();
        }
        safeFit();
      }, 100);

      const handleResize = () => {
        safeFit();
      };
      window.addEventListener('resize', handleResize);

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && terminalRef.current) {
        resizeObserver = new ResizeObserver(() => {
          safeFit();
        });
        resizeObserver.observe(terminalRef.current);
      }

      setTimeout(() => {
        safeFit();
      }, 300);

      return () => {
        isSubscribed = false;
        clearTimeout(focusTimer);
        window.removeEventListener('resize', handleResize);
        scrollDisposer.dispose();
        writeParsedDisposer.dispose();
        if (vpCleanup) (vpCleanup as () => void)();
        if (termEl) {
          termEl.removeEventListener('dragenter', handleNativeDragOver, true);
          termEl.removeEventListener('dragover', handleNativeDragOver, true);
          termEl.removeEventListener('drop', handleNativeDrop, true);
          termEl.removeEventListener('beforeinput', handleImeBeforeInput, true);
        }
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        cleanupListeners.forEach(fn => fn());
        killTerminalPTY(id);
        term.dispose();
      };
    } else if (isElectron) {
      const api = (window as any).electronAPI;
      api.terminalCreate({ id, cols: term.cols || 80, rows: term.rows || 24, cwd, mode });

      const removeDataListener = api.onTerminalData(id, (data: string) => {
        term.write(data);
      });

      term.onData((data) => {
        api.terminalWrite(id, data);
      });

      term.onResize(({ cols, rows }) => {
        api.terminalResize(id, cols, rows);
      });

      const focusTimer = setTimeout(() => {
        if (autoFocus) {
          term.focus();
        }
        if (fitAddonRef.current) fitAddonRef.current.fit();
      }, 100);

      const handleResize = () => {
        if (fitAddonRef.current) fitAddonRef.current.fit();
      };
      window.addEventListener('resize', handleResize);

      setTimeout(() => {
        if (fitAddonRef.current) fitAddonRef.current.fit();
      }, 300);

      return () => {
        clearTimeout(focusTimer);
        window.removeEventListener('resize', handleResize);
        removeDataListener();
        api.terminalKill(id);
        if (termEl) {
          termEl.removeEventListener('beforeinput', handleImeBeforeInput, true);
        }
        term.dispose();
      };
    } else {
      // Browser Mock Terminal
      term.writeln('\x1b[1;36m➜\x1b[0m \x1b[1;32maura\x1b[0m \x1b[1;34mgit:(main)\x1b[0m \x1b[33m✗\x1b[0m Connected to local zsh session');
      term.writeln('\x1b[90m(Native PTY powered by Rust portable-pty /bin/zsh -l in macOS Aura.app)\x1b[0m\r\n');
      term.write('\x1b[1;36m➜\x1b[0m \x1b[1;32maura\x1b[0m \x1b[1;34mgit:(main)\x1b[0m ');

      let inputBuffer = '';
      term.onData((e) => {
        if (e === '\r') {
          term.write('\r\n');
          if (inputBuffer.trim() === 'clear') {
            term.clear();
          } else if (inputBuffer.trim() === 'ls') {
            term.writeln('src  src-tauri  package.json  todoList.md  README.md');
          } else if (inputBuffer.trim() !== '') {
            term.writeln(`zsh: command executed: ${inputBuffer}`);
          }
          inputBuffer = '';
          term.write('\x1b[1;36m➜\x1b[0m \x1b[1;32maura\x1b[0m \x1b[1;34mgit:(main)\x1b[0m ');
        } else if (e === '\u007F') {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            term.write('\b \b');
          }
        } else {
          inputBuffer += e;
          term.write(e);
        }
      });

      const handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        if (termEl) {
          termEl.removeEventListener('beforeinput', handleImeBeforeInput, true);
        }
        term.dispose();
      };
    }
  }, [id, cwd, mode]);

    useEffect(() => {
      if (!xtermInstance.current) return;
      const computedStyle = getComputedStyle(document.documentElement);
      const dockBg = computedStyle.getPropertyValue('--aura-dock-bg').trim() || '#181818';
      const dockFg = computedStyle.getPropertyValue('--aura-dock-fg').trim() || '#e0e0e0';

      const isLightBg = (hexColor: string) => {
        let c = hexColor.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        if (c.length !== 6) return false;
        const r = parseInt(c.slice(0, 2), 16);
        const g = parseInt(c.slice(2, 4), 16);
        const b = parseInt(c.slice(4, 6), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 140;
      };

      const isLight = isLightBg(dockBg);
      xtermInstance.current.options.theme = {
        background: dockBg,
        foreground: dockFg,
        cursor: isLight ? '#007acc' : '#ffffff',
        cursorAccent: dockBg,
        selectionBackground: isLight ? 'rgba(0, 122, 204, 0.25)' : 'rgba(255, 255, 255, 0.25)',
        black: isLight ? '#f0f0f0' : '#1e1e1e',
        red: '#f44747',
        green: isLight ? '#22863a' : '#608b4e',
        yellow: isLight ? '#b08800' : '#dcdcaa',
        blue: isLight ? '#0366d6' : '#569cd6',
        magenta: '#c586c0',
        cyan: isLight ? '#0598bc' : '#4ec9b0',
        white: isLight ? '#24292e' : '#d4d4d4',
        brightBlack: isLight ? '#959da5' : '#808080',
        brightRed: '#f44747',
        brightGreen: isLight ? '#28a745' : '#608b4e',
        brightYellow: isLight ? '#ffd33d' : '#dcdcaa',
        brightBlue: isLight ? '#2188ff' : '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: isLight ? '#17a2b8' : '#4ec9b0',
        brightWhite: isLight ? '#24292e' : '#ffffff',
      };
    }, [themeId]);

    useEffect(() => {
      if (!xtermInstance.current) return;
      xtermInstance.current.options.fontSize = fontSize;
      safeFit();
    }, [fontSize, safeFit]);

    useEffect(() => {
      if (!xtermInstance.current) return;
      xtermInstance.current.options.fontFamily = getEffectiveTerminalFont(fontFamily);
      safeFit();
    }, [fontFamily, safeFit]);

    useEffect(() => {
      if (isVisible) {
        const timer = setTimeout(() => {
          safeFit();
          if (autoFocus) {
            xtermInstance.current?.focus();
          }
        }, 60);
        return () => clearTimeout(timer);
      }
    }, [isVisible, autoFocus, safeFit]);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
      const handleCloseMenu = () => setContextMenu(null);
      window.addEventListener('click', handleCloseMenu);
      return () => window.removeEventListener('click', handleCloseMenu);
    }, []);

    const handleCopy = () => {
      const selection = xtermInstance.current?.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
      setContextMenu(null);
    };

    const handlePaste = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          writeTerminalPTY(id, text);
          if (typeof window !== 'undefined' && (window as any).electronAPI?.terminalWrite) {
            (window as any).electronAPI.terminalWrite(id, text);
          }
        }
      } catch (err) {
        console.error('Failed to paste:', err);
      }
      setContextMenu(null);
      xtermInstance.current?.focus();
    };

    return (
      <div
        data-terminal-area="true"
        onClick={() => xtermInstance.current?.focus()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const droppedPath = e.dataTransfer.getData('application/aura-path') || e.dataTransfer.getData('text/plain');
          if (droppedPath) {
            writeTerminalPTY(id, `"${droppedPath}" `);
            if (typeof window !== 'undefined' && (window as any).electronAPI?.terminalWrite) {
              (window as any).electronAPI.terminalWrite(id, `"${droppedPath}" `);
            }
            if (xtermInstance.current) {
              xtermInstance.current.focus();
            }
          }
        }}
        ref={terminalRef}
        style={{
          backgroundColor: 'var(--aura-dock-bg, #181818)',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
        }}
        className="h-full w-full p-1.5 overflow-hidden cursor-text relative"
      >
        {contextMenu && (
          <div
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              backgroundColor: 'var(--aura-card-bg, #252526)',
              borderColor: 'var(--aura-border, #454545)',
              color: 'var(--aura-text, #cccccc)',
            }}
            className="fixed z-50 w-44 border rounded-lg shadow-2xl py-1 text-xs select-none animate-in fade-in duration-75 divide-y divide-[var(--aura-border,#333333)] font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-0.5">
              <div
                onClick={handleCopy}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-[#007acc]/20 hover:text-[#007acc] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Copy size={13} />
                  <span>复制 (Copy)</span>
                </div>
                <span className="text-[10px] text-[var(--aura-text-muted)] font-mono">⌘C</span>
              </div>
              <div
                onClick={handlePaste}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-[#007acc]/20 hover:text-[#007acc] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ClipboardPaste size={13} />
                  <span>粘贴 (Paste)</span>
                </div>
                <span className="text-[10px] text-[var(--aura-text-muted)] font-mono">⌘V</span>
              </div>
            </div>
          </div>
        )}

        {showScrollBottom && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            title="跳到终端最底部 (Scroll to bottom)"
            aria-label="跳到终端最底部"
            className="absolute bottom-4 right-5 z-40 flex items-center justify-center w-9 h-9 rounded-full border shadow-2xl backdrop-blur-md transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer select-none group pointer-events-auto"
            style={{
              backgroundColor: 'var(--aura-card-bg, #252526)',
              borderColor: 'var(--aura-accent, #007acc)',
              color: 'var(--aura-accent, #007acc)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
            }}
          >
            <ChevronDown size={18} strokeWidth={2.5} className="group-hover:translate-y-0.5 transition-transform" />
          </button>
        )}

        {/* 右侧会话记录大纲导航：始终垂直居中在右侧，外面只显示10条杠，超过10条对话hover时出现滚动条 */}
        {isAgySession && (
          <div
            onMouseEnter={() => setIsOutlineHovered(true)}
            onMouseLeave={() => setIsOutlineHovered(false)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 pointer-events-auto flex items-center"
          >
            {!isOutlineHovered ? (
              /* 图 1：鼠标未 hover 时外面展示小短横线（若刚开新对话则显示 1 条就绪中杠，有历史则显示最新的 10 条杠） */
              <div className="flex flex-col items-end gap-2.5 py-1.5 px-1 cursor-pointer select-none">
                {userTurns.length === 0 ? (
                  <div className="flex items-center justify-end h-3" title="新对话 (就绪)">
                    <span className="w-4 h-[2.5px] bg-[#3b82f6] shadow-sm rounded-full" />
                  </div>
                ) : (
                  displayedTurns.map((turn) => {
                    const isActive = activeTurnId === turn.id;
                    return (
                      <div
                        key={turn.id}
                        onClick={() => handleJumpToTurn(turn)}
                        title={turn.fullText}
                        className="flex items-center justify-end h-3"
                      >
                        <span
                          className={`rounded-full transition-all duration-200 ${
                            isActive
                              ? 'w-4 h-[2.5px] bg-[#3b82f6] shadow-sm'
                              : 'w-3 h-[2px] bg-[#888888]/50 hover:bg-[#aaaaaa] hover:w-3.5'
                          }`}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* 图 2：鼠标 hover 时直接显示圆角阴影卡片，超过 10 条对话出现滚动条，<=10 条无滚动条 */
              <div
                className={`w-64 select-none font-sans rounded-2xl border shadow-2xl p-2.5 flex flex-col gap-0.5 backdrop-blur-md ${
                  userTurns.length > 10
                    ? 'max-h-[350px] overflow-y-auto outline-card-scroll pr-1'
                    : 'overflow-hidden'
                }`}
                style={{
                  backgroundColor: 'var(--aura-card-bg, #252526)',
                  borderColor: 'var(--aura-border, #454545)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
                }}
              >
                {userTurns.length === 0 ? (
                  <div className="flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-[#3b82f6] font-medium bg-[#3b82f6]/15">
                    <span className="truncate flex-1">新对话 (就绪)</span>
                    <span className="shrink-0 w-4 h-[2.5px] bg-[#3b82f6] rounded-full" />
                  </div>
                ) : (
                  userTurns.map((turn) => {
                    const isActive = activeTurnId === turn.id;
                    return (
                      <div
                        key={turn.id}
                        onClick={() => handleJumpToTurn(turn)}
                        className={`flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                          isActive
                            ? 'text-[#3b82f6] font-medium bg-[#3b82f6]/15'
                            : 'text-[var(--aura-text-muted,#858585)] hover:text-[var(--aura-text,#e0e0e0)] hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate flex-1" title={turn.fullText}>
                          {turn.summary}
                        </span>
                        <span
                          className={`shrink-0 rounded-full transition-all duration-150 ${
                            isActive
                              ? 'w-4 h-[2.5px] bg-[#3b82f6]'
                            : 'w-3 h-[2px] bg-[#888888]/50'
                        }`}
                      />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.id === nextProps.id &&
      prevProps.cwd === nextProps.cwd &&
      prevProps.mode === nextProps.mode &&
      prevProps.autoFocus === nextProps.autoFocus &&
      prevProps.themeId === nextProps.themeId &&
      prevProps.fontSize === nextProps.fontSize &&
      prevProps.fontFamily === nextProps.fontFamily &&
      prevProps.isVisible === nextProps.isVisible
    );
  }
);
