import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { Copy, ClipboardPaste } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import {
  isTauri,
  createTerminalPTY,
  startTerminalReading,
  writeTerminalPTY,
  resizeTerminalPTY,
  killTerminalPTY,
  onTerminalData,
  onTerminalExit
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

    term.onBell(() => {});
    term.open(terminalRef.current);
    safeFit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    const termEl = terminalRef.current;
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
        writeTerminalPTY(id, `${droppedPath} `);
        if (typeof window !== 'undefined' && (window as any).electronAPI?.terminalWrite) {
          (window as any).electronAPI.terminalWrite(id, `${droppedPath} `);
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
        if (termEl) {
          termEl.removeEventListener('dragenter', handleNativeDragOver, true);
          termEl.removeEventListener('dragover', handleNativeDragOver, true);
          termEl.removeEventListener('drop', handleNativeDrop, true);
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
            writeTerminalPTY(id, `${droppedPath} `);
            if (typeof window !== 'undefined' && (window as any).electronAPI?.terminalWrite) {
              (window as any).electronAPI.terminalWrite(id, `${droppedPath} `);
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
