import React, { useState, useEffect } from 'react';
import { X, Sliders, Type, Palette, Folder, Save, FileCode, ListTree } from 'lucide-react';
import { SupportedLang, translations } from '../services/i18n';
import { THEMES, applyThemeToDocument, getThemeById } from '../services/themeService';

interface SettingsModalProps {
  isOpen: boolean;
  workspaceDir: string;
  lang: SupportedLang;
  themeId: string;
  onClose: () => void;
  onChangeWorkspace: () => void;
  onChangeLang?: (lang: SupportedLang) => void;
  onChangeTheme: (themeId: string) => void;
  onSaveToast: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  workspaceDir,
  lang,
  themeId,
  onClose,
  onChangeWorkspace,
  onChangeLang,
  onChangeTheme,
  onSaveToast,
}) => {
  const t = translations[lang];

  const [theme, setTheme] = useState<string>(themeId || 'vs-dark');
  const [sidebarFontSize, setSidebarFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura:sidebarFontSize') || '14');
  });
  const [editorFontSize, setEditorFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura:fontSize') || '14');
  });
  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura:terminalFontSize') || '13.5');
  });

  const FONT_PRESETS = [
    { label: 'JetBrains Mono (外显高清晰推荐 · Recommended)', value: 'JetBrains Mono' },
    { label: 'Fira Code (等宽连字推荐 · Ligatures)', value: 'Fira Code' },
    { label: 'Hack Nerd Font (图标符号支持 · Icons)', value: 'Hack Nerd Font' },
    { label: 'SF Mono (Apple 官方等宽)', value: 'SF Mono' },
    { label: 'Menlo (macOS 经典等宽)', value: 'Menlo' },
    { label: 'Cascadia Code (清晰现代等宽)', value: 'Cascadia Code' },
    { label: 'PingFang SC (原生优雅中文搭配)', value: 'PingFang SC' },
    { label: '自定义字体名称 (Custom Font)...', value: 'Custom' },
  ];

  const [editorFontFamily, setEditorFontFamily] = useState<string>(() => {
    const saved = localStorage.getItem('aura:editorFontFamily') || 'JetBrains Mono';
    const isPreset = ['JetBrains Mono', 'Fira Code', 'Hack Nerd Font', 'SF Mono', 'Menlo', 'Cascadia Code', 'PingFang SC'].includes(saved);
    return isPreset ? saved : 'Custom';
  });
  const [customEditorFont, setCustomEditorFont] = useState<string>(() => {
    const saved = localStorage.getItem('aura:editorFontFamily') || '';
    const isPreset = ['JetBrains Mono', 'Fira Code', 'Hack Nerd Font', 'SF Mono', 'Menlo', 'Cascadia Code', 'PingFang SC'].includes(saved);
    return isPreset ? '' : saved;
  });

  const [terminalFontFamily, setTerminalFontFamily] = useState<string>(() => {
    const saved = localStorage.getItem('aura:terminalFontFamily') || 'JetBrains Mono';
    const isPreset = ['JetBrains Mono', 'Fira Code', 'Hack Nerd Font', 'SF Mono', 'Menlo', 'Cascadia Code', 'PingFang SC'].includes(saved);
    return isPreset ? saved : 'Custom';
  });
  const [customTerminalFont, setCustomTerminalFont] = useState<string>(() => {
    const saved = localStorage.getItem('aura:terminalFontFamily') || '';
    const isPreset = ['JetBrains Mono', 'Fira Code', 'Hack Nerd Font', 'SF Mono', 'Menlo', 'Cascadia Code', 'PingFang SC'].includes(saved);
    return isPreset ? '' : saved;
  });

  const [defaultMarkdownMode, setDefaultMarkdownMode] = useState<'editor' | 'markdown-preview' | 'markmap' | 'outline'>(() => {
    return (localStorage.getItem('aura:defaultMarkdownMode') as any) || 'editor';
  });
  const [defaultShowToc, setDefaultShowToc] = useState<boolean>(() => {
    return localStorage.getItem('aura:mpeTocVisible') !== 'false';
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    const effectiveEditorFont =
      editorFontFamily === 'Custom'
        ? customEditorFont.trim() || 'JetBrains Mono'
        : editorFontFamily;
    const effectiveTerminalFont =
      terminalFontFamily === 'Custom'
        ? customTerminalFont.trim() || 'JetBrains Mono'
        : terminalFontFamily;

    localStorage.setItem('aura:theme', theme);
    localStorage.setItem('aura:sidebarFontSize', sidebarFontSize.toString());
    localStorage.setItem('aura:fontSize', editorFontSize.toString());
    localStorage.setItem('aura:terminalFontSize', terminalFontSize.toString());
    localStorage.setItem('aura:editorFontFamily', effectiveEditorFont);
    localStorage.setItem('aura:terminalFontFamily', effectiveTerminalFont);
    localStorage.setItem('aura:defaultMarkdownMode', defaultMarkdownMode);
    localStorage.setItem('aura:mpeTocVisible', String(defaultShowToc));
    applyThemeToDocument(getThemeById(theme));
    onChangeTheme(theme);
    onSaveToast(t.settingsSaved);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div
        style={{
          backgroundColor: 'var(--aura-card-bg, #252526)',
          borderColor: 'var(--aura-border, #454545)',
          color: 'var(--aura-text, #cccccc)',
        }}
        className="w-[620px] border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
      >
        <div
          style={{
            backgroundColor: 'var(--aura-topbar-bg, #1f1f1f)',
            borderColor: 'var(--aura-border, #333333)',
          }}
          className="flex items-center justify-between px-4 py-3 border-b select-none"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aura-text)]">
            <Sliders size={16} className="text-[#007acc]" />
            <span>{t.settingsTitle}</span>
          </div>
          <button
            onClick={onClose}
            className="aura-btn-ghost p-1 rounded-md"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-[var(--aura-text)] max-h-[70vh] overflow-y-auto no-scrollbar">
          {/* Section 1: Workspace */}
          <div
            style={{
              backgroundColor: 'var(--aura-app-bg, #181818)',
              borderColor: 'var(--aura-border, #333333)',
            }}
            className="p-3.5 rounded-xl border space-y-3"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-muted)]">工作区 (Workspace)</div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                <Folder size={14} className="text-amber-400" />
                <span>{t.workspaceRoot}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={workspaceDir || 'N/A'}
                  style={{
                    backgroundColor: 'var(--aura-input-bg, #252526)',
                    borderColor: 'var(--aura-border, #3c3c3c)',
                    color: 'var(--aura-text-muted, #aaaaaa)',
                  }}
                  className="flex-1 border rounded-md px-3 py-1.5 font-mono text-xs"
                />
                <button
                  onClick={onChangeWorkspace}
                  className="aura-btn-secondary"
                >
                  {t.changeWorkspace}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Editor & Theme */}
          <div
            style={{
              backgroundColor: 'var(--aura-app-bg, #181818)',
              borderColor: 'var(--aura-border, #333333)',
            }}
            className="p-3.5 rounded-xl border space-y-3"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-muted)]">编辑器与主题 (Editor & Theme)</div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                <Palette size={14} className="text-emerald-400" />
                <span>{t.colorTheme}</span>
              </label>
              <select
                value={theme}
                onChange={(e) => {
                  const nextTheme = e.target.value;
                  setTheme(nextTheme);
                  onChangeTheme(nextTheme);
                }}
                style={{
                  backgroundColor: 'var(--aura-input-bg, #252526)',
                  borderColor: 'var(--aura-border, #3c3c3c)',
                  color: 'var(--aura-text, #cccccc)',
                }}
                className="w-full border rounded-md px-3 py-1.5 outline-none focus:border-[#007acc] transition-colors"
              >
                {THEMES.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                  <Type size={14} className="text-amber-400" />
                  <span>1 号窗口侧边栏字号 (Sidebar Font Size)</span>
                </label>
                <span className="font-mono text-xs text-[#007acc] font-bold">{sidebarFontSize}px</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="11"
                  max="18"
                  step="0.5"
                  value={sidebarFontSize}
                  onChange={(e) => setSidebarFontSize(Number(e.target.value))}
                  className="flex-1 accent-[#007acc] cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setSidebarFontSize(14)}
                  className="aura-btn-secondary text-[11px] py-0.5 px-2.5"
                >
                  重置 14px
                </button>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--aura-card-bg, #252526)',
                borderColor: 'var(--aura-border, #333333)',
              }}
              className="flex items-center justify-between p-2.5 rounded-lg border text-[11px] text-[var(--aura-text-muted)]"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[var(--aura-text)] font-semibold">
                  <Type size={13} className="text-[#007acc]" />
                  <span>2、3 号窗口字号调节快捷键</span>
                </div>
                <div className="text-[11px] text-[var(--aura-text-muted)]">
                  2 号编辑器与 3 号终端默认 14px，支持按键随时全局无级缩放
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span
                  style={{
                    backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                    borderColor: 'var(--aura-border, #333333)',
                  }}
                  className="px-2 py-0.5 rounded border text-[#007acc] dark:text-[#4ec9b0]"
                >
                  ⌘ + 加号/等号 (放大)
                </span>
                <span
                  style={{
                    backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                    borderColor: 'var(--aura-border, #333333)',
                  }}
                  className="px-2 py-0.5 rounded border text-[#007acc] dark:text-[#4ec9b0]"
                >
                  ⌘ + 减号 (缩小)
                </span>
              </div>
            </div>
          </div>

          {/* Section: Typography & External Display Customization */}
          <div
            style={{
              backgroundColor: 'var(--aura-app-bg, #181818)',
              borderColor: 'var(--aura-border, #333333)',
            }}
            className="p-3.5 rounded-xl border space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-muted)]">
                字体与外接显示器设置 (Typography & External Display)
              </div>
              <span className="text-[10px] text-[#38a169] font-mono font-medium">✓ Emoji / CJK 宽字符已对齐</span>
            </div>

            {/* Editor Font Family */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                <Type size={14} className="text-[#007acc]" />
                <span>2 号编辑器字体 (Editor Font Family)</span>
              </label>
              <select
                value={editorFontFamily}
                onChange={(e) => setEditorFontFamily(e.target.value)}
                style={{
                  backgroundColor: 'var(--aura-input-bg, #252526)',
                  borderColor: 'var(--aura-border, #3c3c3c)',
                  color: 'var(--aura-text, #cccccc)',
                }}
                className="w-full border rounded-md px-3 py-1.5 outline-none focus:border-[#007acc] transition-colors"
              >
                {FONT_PRESETS.map((fp) => (
                  <option key={fp.value} value={fp.value}>
                    {fp.label}
                  </option>
                ))}
              </select>
              {editorFontFamily === 'Custom' && (
                <input
                  type="text"
                  placeholder="输入本机已安装字体族名称 (如: Consolas, Monaco, 霞鹜文楷)..."
                  value={customEditorFont}
                  onChange={(e) => setCustomEditorFont(e.target.value)}
                  style={{
                    backgroundColor: 'var(--aura-input-bg, #252526)',
                    borderColor: 'var(--aura-border, #3c3c3c)',
                    color: 'var(--aura-text, #cccccc)',
                  }}
                  className="w-full mt-1 border rounded-md px-3 py-1.5 font-mono text-xs outline-none focus:border-[#007acc]"
                />
              )}
            </div>

            {/* Editor Font Size Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-[var(--aura-text-muted)]">
                  编辑器基准字号 (Editor Font Size)
                </label>
                <span className="font-mono text-xs text-[#007acc] font-bold">{editorFontSize}px</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="11"
                  max="24"
                  step="0.5"
                  value={editorFontSize}
                  onChange={(e) => setEditorFontSize(Number(e.target.value))}
                  className="flex-1 accent-[#007acc] cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setEditorFontSize(14)}
                  className="aura-btn-secondary text-[11px] py-0.5 px-2.5"
                >
                  重置 14px
                </button>
              </div>
            </div>

            <div className="border-t border-[var(--aura-border,#333333)] my-2" />

            {/* Terminal Font Family */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                <Type size={14} className="text-emerald-400" />
                <span>3 号终端字体 (Terminal Font Family)</span>
              </label>
              <select
                value={terminalFontFamily}
                onChange={(e) => setTerminalFontFamily(e.target.value)}
                style={{
                  backgroundColor: 'var(--aura-input-bg, #252526)',
                  borderColor: 'var(--aura-border, #3c3c3c)',
                  color: 'var(--aura-text, #cccccc)',
                }}
                className="w-full border rounded-md px-3 py-1.5 outline-none focus:border-[#007acc] transition-colors"
              >
                {FONT_PRESETS.map((fp) => (
                  <option key={fp.value} value={fp.value}>
                    {fp.label}
                  </option>
                ))}
              </select>
              {terminalFontFamily === 'Custom' && (
                <input
                  type="text"
                  placeholder="输入本机已安装等宽字体族名称 (如: JetBrainsMono Nerd Font, Menlo)..."
                  value={customTerminalFont}
                  onChange={(e) => setCustomTerminalFont(e.target.value)}
                  style={{
                    backgroundColor: 'var(--aura-input-bg, #252526)',
                    borderColor: 'var(--aura-border, #3c3c3c)',
                    color: 'var(--aura-text, #cccccc)',
                  }}
                  className="w-full mt-1 border rounded-md px-3 py-1.5 font-mono text-xs outline-none focus:border-[#007acc]"
                />
              )}
            </div>

            {/* Terminal Font Size Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-[var(--aura-text-muted)]">
                  终端基准字号 (Terminal Font Size)
                </label>
                <span className="font-mono text-xs text-[#007acc] font-bold">{terminalFontSize}px</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="11"
                  max="24"
                  step="0.5"
                  value={terminalFontSize}
                  onChange={(e) => setTerminalFontSize(Number(e.target.value))}
                  className="flex-1 accent-[#007acc] cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setTerminalFontSize(13.5)}
                  className="aura-btn-secondary text-[11px] py-0.5 px-2.5"
                >
                  重置 13.5px
                </button>
              </div>
            </div>

            {/* External Display Clarity & Antialiasing Notice Card */}
            <div
              style={{
                backgroundColor: 'var(--aura-card-bg, #202022)',
                borderColor: 'var(--aura-border, #333333)',
              }}
              className="p-3 rounded-lg border text-[11px] text-[var(--aura-text-muted)] space-y-1.5"
            >
              <div className="flex items-center gap-1.5 text-[var(--aura-text)] font-semibold">
                <Sliders size={13} className="text-[#38a169]" />
                <span>外接显示器清晰度优化说明 (External Display Optimization)</span>
              </div>
              <div className="leading-relaxed">
                Aura 已开启底层亚像素双抗锯齿 (<code className="text-[#007acc]">antialiased</code>) 与 Emoji 字体优先解析。连接 2K / 1080p 外接显示器时，若字体发虚或辨识度不足，推荐将字体设为笔画饱满的 <strong className="text-[var(--aura-text)]">JetBrains Mono</strong> 或 <strong className="text-[var(--aura-text)]">Fira Code</strong>，并将字号微调至 <strong className="text-[var(--aura-text)]">14 ~ 15.5px</strong>。
              </div>
            </div>
          </div>

          {/* Section 3: Markdown & Outline Preferences */}
          <div
            style={{
              backgroundColor: 'var(--aura-app-bg, #181818)',
              borderColor: 'var(--aura-border, #333333)',
            }}
            className="p-3.5 rounded-xl border space-y-3"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-muted)]">Markdown 与大纲目录 (Markdown & Outline)</div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                <FileCode size={14} className="text-sky-400" />
                <span>Markdown 文件默认打开视图 (Default View Mode)</span>
              </label>
              <select
                value={defaultMarkdownMode}
                onChange={(e) => setDefaultMarkdownMode(e.target.value as any)}
                style={{
                  backgroundColor: 'var(--aura-input-bg, #252526)',
                  borderColor: 'var(--aura-border, #3c3c3c)',
                  color: 'var(--aura-text, #cccccc)',
                }}
                className="w-full border rounded-md px-3 py-1.5 outline-none focus:border-[#007acc] transition-colors"
              >
                <option value="editor">Text Editor (Vim 源码模式 - 默认)</option>
                <option value="markdown-preview">Markdown Preview Enhanced (富文本增强预览)</option>
                <option value="markmap">Markmap Mind Map (思维导图全景)</option>
                <option value="outline">Article Structure (文章结构大纲)</option>
              </select>
            </div>

            <div
              style={{
                backgroundColor: 'var(--aura-card-bg, #252526)',
                borderColor: 'var(--aura-border, #333333)',
              }}
              className="flex items-center justify-between p-2.5 rounded-lg border"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                  <ListTree size={14} className="text-[#007acc]" />
                  <span>预览时右侧展示标题大纲 (Show Table of Contents by Default)</span>
                </div>
                <div className="text-[11px] text-[var(--aura-text-muted)]">
                  开启后在 Markdown 预览模式下默认于右侧展开目录结构，可随时一键向右收起
                </div>
              </div>
              <input
                type="checkbox"
                checked={defaultShowToc}
                onChange={(e) => setDefaultShowToc(e.target.checked)}
                className="w-4 h-4 accent-[#007acc] cursor-pointer rounded"
              />
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--aura-topbar-bg, #1f1f1f)',
            borderColor: 'var(--aura-border, #333333)',
          }}
          className="px-6 py-3 border-t flex justify-end gap-2"
        >
          <button
            onClick={onClose}
            className="aura-btn-ghost px-4 py-1.5"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            className="aura-btn-primary px-4 py-1.5"
          >
            <Save size={13} />
            <span>{t.saveSettings}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
