import React, { useState, useEffect } from 'react';
import { X, Sliders, Type, Palette, Keyboard, Folder, Save, Languages, LayoutGrid, FileCode, ListTree, Check } from 'lucide-react';
import { SupportedLang, translations } from '../services/i18n';
import { THEMES, CustomWindowColors, getCustomWindowColors, saveCustomWindowColors, applyThemeToDocument, getThemeById } from '../services/themeService';

interface SettingsModalProps {
  isOpen: boolean;
  workspaceDir: string;
  lang: SupportedLang;
  themeId: string;
  onClose: () => void;
  onChangeWorkspace: () => void;
  onChangeLang: (lang: SupportedLang) => void;
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

  const [fontSize, setFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura:fontSize') || '13');
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem('aura:fontFamily') || 'JetBrainsMono Nerd Font, Menlo, Monaco';
  });
  const [theme, setTheme] = useState<string>(themeId || 'vs-dark');
  const [currentLang, setCurrentLang] = useState<SupportedLang>(lang);
  const [customColors, setCustomColors] = useState<CustomWindowColors>(getCustomWindowColors);
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
    localStorage.setItem('aura:fontSize', fontSize.toString());
    localStorage.setItem('aura:fontFamily', fontFamily);
    localStorage.setItem('aura:theme', theme);
    localStorage.setItem('aura:language', currentLang);
    localStorage.setItem('aura:defaultMarkdownMode', defaultMarkdownMode);
    localStorage.setItem('aura:mpeTocVisible', String(defaultShowToc));
    saveCustomWindowColors(customColors);
    applyThemeToDocument(getThemeById(theme), customColors);
    onChangeTheme(theme);
    onChangeLang(currentLang);
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
            backgroundColor: 'var(--aura-dock-header-bg, #2d2d2d)',
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
            className="text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-[var(--aura-text)] max-h-[70vh] overflow-y-auto no-scrollbar">
          {/* Section 1: General & Workspace */}
          <div
            style={{
              backgroundColor: 'var(--aura-sidebar-bg, #1e1e1e)',
              borderColor: 'var(--aura-border, #333333)',
            }}
            className="p-3.5 rounded-xl border space-y-3"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-muted)]">常规与工作区 (General & Workspace)</div>
            
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                <Languages size={14} className="text-[#007acc]" />
                <span>{t.displayLanguage}</span>
              </label>
              <select
                value={currentLang}
                onChange={(e) => setCurrentLang(e.target.value as SupportedLang)}
                style={{
                  backgroundColor: 'var(--aura-input-bg, #252526)',
                  borderColor: 'var(--aura-border, #3c3c3c)',
                  color: 'var(--aura-text, #cccccc)',
                }}
                className="w-full border rounded-md px-3 py-1.5 outline-none focus:border-[#007acc] transition-colors"
              >
                <option value="zh-CN">简体中文 (Simplified Chinese)</option>
                <option value="en-US">English (United States)</option>
              </select>
            </div>

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
                  style={{
                    backgroundColor: 'var(--aura-dock-header-bg, #333333)',
                    borderColor: 'var(--aura-border, #444444)',
                    color: 'var(--aura-text, #ffffff)',
                  }}
                  className="hover:opacity-90 border px-3 py-1.5 rounded-md transition-colors font-medium cursor-pointer"
                >
                  {t.changeWorkspace}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Editor & Theme */}
          <div
            style={{
              backgroundColor: 'var(--aura-sidebar-bg, #1e1e1e)',
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

            <div
              style={{
                backgroundColor: 'var(--aura-dock-header-bg, #252526)',
                borderColor: 'var(--aura-border, #333333)',
              }}
              className="flex items-center justify-between p-2.5 rounded-lg border text-[11px] text-[var(--aura-text-muted)]"
            >
              <div className="flex items-center gap-1.5">
                <Type size={13} className="text-blue-400" />
                <span>字号调节快捷键</span>
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

          {/* Section 3: Markdown & Outline Preferences */}
          <div
            style={{
              backgroundColor: 'var(--aura-sidebar-bg, #1e1e1e)',
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
                backgroundColor: 'var(--aura-dock-header-bg, #252526)',
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

          {/* 3 Windows Independent Colors Customizer */}
          <div
            style={{ borderColor: 'var(--aura-border, #333333)' }}
            className="space-y-3 pt-3 border-t"
          >
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                <LayoutGrid size={14} className="text-cyan-400" />
                <span>3 窗口独立配色 (3 Windows Custom Colors)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setCustomColors({});
                  applyThemeToDocument(getThemeById(theme), {});
                }}
                className="text-[10px] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] underline cursor-pointer"
              >
                恢复主题默认
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Window 1 */}
              <div
                style={{
                  backgroundColor: 'var(--aura-sidebar-bg, #1e1e1e)',
                  borderColor: 'var(--aura-border, #333333)',
                }}
                className="p-2.5 rounded-lg border space-y-2"
              >
                <div className="font-semibold text-[11px] text-[#007acc] flex items-center justify-between">
                  <span>1号 侧边栏 (Sidebar)</span>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-[var(--aura-text-muted)]">背景色</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={customColors.window1Bg || getThemeById(theme).ui.sidebarBg}
                      onChange={(e) => {
                        const updated = { ...customColors, window1Bg: e.target.value };
                        setCustomColors(updated);
                        applyThemeToDocument(getThemeById(theme), updated);
                      }}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[9px] text-[var(--aura-text-muted)]">
                      {customColors.window1Bg || getThemeById(theme).ui.sidebarBg}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-[var(--aura-text-muted)]">前景色</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={customColors.window1Fg || getThemeById(theme).ui.text}
                      onChange={(e) => {
                        const updated = { ...customColors, window1Fg: e.target.value };
                        setCustomColors(updated);
                        applyThemeToDocument(getThemeById(theme), updated);
                      }}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[9px] text-[var(--aura-text-muted)]">
                      {customColors.window1Fg || getThemeById(theme).ui.text}
                    </span>
                  </div>
                </div>
              </div>

              {/* Window 2 */}
              <div
                style={{
                  backgroundColor: 'var(--aura-sidebar-bg, #1e1e1e)',
                  borderColor: 'var(--aura-border, #333333)',
                }}
                className="p-2.5 rounded-lg border space-y-2"
              >
                <div className="font-semibold text-[11px] text-emerald-400 flex items-center justify-between">
                  <span>2号 编辑器 (Editor)</span>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-[var(--aura-text-muted)]">背景色</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={customColors.window2Bg || getThemeById(theme).ui.editorBg}
                      onChange={(e) => {
                        const updated = { ...customColors, window2Bg: e.target.value };
                        setCustomColors(updated);
                        applyThemeToDocument(getThemeById(theme), updated);
                      }}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[9px] text-[var(--aura-text-muted)]">
                      {customColors.window2Bg || getThemeById(theme).ui.editorBg}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-[var(--aura-text-muted)]">前景色</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={customColors.window2Fg || getThemeById(theme).ui.text}
                      onChange={(e) => {
                        const updated = { ...customColors, window2Fg: e.target.value };
                        setCustomColors(updated);
                        applyThemeToDocument(getThemeById(theme), updated);
                      }}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[9px] text-[var(--aura-text-muted)]">
                      {customColors.window2Fg || getThemeById(theme).ui.text}
                    </span>
                  </div>
                </div>
              </div>

              {/* Window 3 */}
              <div
                style={{
                  backgroundColor: 'var(--aura-sidebar-bg, #1e1e1e)',
                  borderColor: 'var(--aura-border, #333333)',
                }}
                className="p-2.5 rounded-lg border space-y-2"
              >
                <div className="font-semibold text-[11px] text-amber-400 flex items-center justify-between">
                  <span>3号 终端 (Terminal)</span>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-[var(--aura-text-muted)]">背景色</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={customColors.window3Bg || getThemeById(theme).ui.dockBg}
                      onChange={(e) => {
                        const updated = { ...customColors, window3Bg: e.target.value };
                        setCustomColors(updated);
                        applyThemeToDocument(getThemeById(theme), updated);
                      }}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[9px] text-[var(--aura-text-muted)]">
                      {customColors.window3Bg || getThemeById(theme).ui.dockBg}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-[var(--aura-text-muted)]">前景色</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={customColors.window3Fg || getThemeById(theme).ui.text}
                      onChange={(e) => {
                        const updated = { ...customColors, window3Fg: e.target.value };
                        setCustomColors(updated);
                        applyThemeToDocument(getThemeById(theme), updated);
                      }}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[9px] text-[var(--aura-text-muted)]">
                      {customColors.window3Fg || getThemeById(theme).ui.text}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div
          style={{
            backgroundColor: 'var(--aura-dock-header-bg, #1e1e1e)',
            borderColor: 'var(--aura-border, #333333)',
          }}
          className="px-6 py-3 border-t flex justify-end gap-2"
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs bg-[#007acc] text-white hover:bg-[#0062a3] transition-colors cursor-pointer shadow-xs"
          >
            <Save size={13} />
            <span>{t.saveSettings}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
