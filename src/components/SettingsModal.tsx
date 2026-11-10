import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Type,
  Palette,
  Save,
  FileCode,
  ListTree,
  Puzzle,
  Search,
  Download,
  Trash2,
  RotateCw,
  Check,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { PluginManifest } from '../types';
import { searchOpenVsxMarketplace } from '../services/fileService';
import { PLUGIN_LOGOS } from '../services/pluginLogos';
import { SupportedLang, translations } from '../services/i18n';
import { THEMES, applyThemeToDocument, getThemeById } from '../services/themeService';

interface CustomSelectOption<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  fontPreview?: string;
}

interface CustomSelectProps<T = string> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
}

function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  className = '',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: 'var(--aura-input-bg, #252526)',
          borderColor: isOpen ? 'var(--aura-accent, #007acc)' : 'var(--aura-border, #3c3c3c)',
          color: 'var(--aura-text, #cccccc)',
        }}
        className="w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-xs font-sans hover:border-[var(--aura-accent,#007acc)]/70 transition-all cursor-pointer shadow-xs focus:outline-none"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {selectedOption?.icon && (
            <span className="shrink-0 text-[var(--aura-text-muted)]">
              {selectedOption.icon}
            </span>
          )}
          <span
            className="truncate font-medium"
            style={selectedOption?.fontPreview ? { fontFamily: selectedOption.fontPreview } : undefined}
          >
            {selectedOption?.label || placeholder || 'Select...'}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--aura-accent,#007acc)]' : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          style={{
            backgroundColor: 'var(--aura-card-bg, #1e1e1e)',
            borderColor: 'var(--aura-border, #3c3c3c)',
          }}
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border shadow-2xl p-1 text-xs max-h-56 overflow-y-auto space-y-0.5 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#007acc]/15 text-[#007acc] font-semibold'
                    : 'text-[var(--aura-text,#cccccc)] hover:bg-[#007acc]/10 hover:text-[var(--aura-text,#ffffff)]'
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  {opt.icon && (
                    <span className="shrink-0 text-gray-400">
                      {opt.icon}
                    </span>
                  )}
                  <span
                    className="truncate"
                    style={opt.fontPreview ? { fontFamily: opt.fontPreview } : undefined}
                  >
                    {opt.label}
                  </span>
                </div>
                {isSelected && (
                  <Check size={14} className="text-[var(--aura-accent,#007acc)] shrink-0 ml-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  workspaceDir?: string;
  lang: SupportedLang;
  themeId: string;
  plugins?: PluginManifest[];
  onTogglePlugin?: (id: string) => void;
  onInstallPlugin?: (plugin: PluginManifest) => void;
  onUninstallPlugin?: (id: string) => void;
  onClose: () => void;
  onChangeWorkspace?: () => void;
  onChangeLang?: (lang: SupportedLang) => void;
  onChangeTheme: (themeId: string) => void;
  onSaveToast: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  workspaceDir: _workspaceDir,
  lang,
  themeId,
  plugins = [],
  onTogglePlugin,
  onInstallPlugin,
  onUninstallPlugin,
  onClose,
  onChangeWorkspace: _onChangeWorkspace,
  onChangeLang,
  onChangeTheme,
  onSaveToast,
}) => {
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<'preferences' | 'plugins'>('preferences');
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

  const [pluginSearchQuery, setPluginSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<PluginManifest[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  useEffect(() => {
    if (!pluginSearchQuery.trim()) {
      setOnlineResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingOnline(true);
      try {
        const results = await searchOpenVsxMarketplace(pluginSearchQuery);
        setOnlineResults(results);
      } catch (err) {
        console.error('Marketplace search failed:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [pluginSearchQuery]);

  const FONT_PRESETS = [
    { label: 'JetBrains Mono (Recommended)', value: 'JetBrains Mono' },
    { label: 'Fira Code (Ligatures)', value: 'Fira Code' },
    { label: 'Hack Nerd Font (Icons)', value: 'Hack Nerd Font' },
    { label: 'SF Mono (Apple SF Mono)', value: 'SF Mono' },
    { label: 'Menlo (macOS Classic)', value: 'Menlo' },
    { label: 'Cascadia Code (Modern Monospace)', value: 'Cascadia Code' },
    { label: 'PingFang SC', value: 'PingFang SC' },
    { label: 'Custom Font...', value: 'Custom' },
  ];

  const [fontFamily, setFontFamily] = useState<string>(() => {
    const saved = localStorage.getItem('aura:editorFontFamily') || localStorage.getItem('aura:terminalFontFamily') || 'JetBrains Mono';
    const isPreset = ['JetBrains Mono', 'Fira Code', 'Hack Nerd Font', 'SF Mono', 'Menlo', 'Cascadia Code', 'PingFang SC'].includes(saved);
    return isPreset ? saved : 'Custom';
  });
  const [customFont, setCustomFont] = useState<string>(() => {
    const saved = localStorage.getItem('aura:editorFontFamily') || localStorage.getItem('aura:terminalFontFamily') || '';
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
    const effectiveFont =
      fontFamily === 'Custom'
        ? customFont.trim() || 'JetBrains Mono'
        : fontFamily;

    localStorage.setItem('aura:theme', theme);
    localStorage.setItem('aura:sidebarFontSize', editorFontSize.toString());
    localStorage.setItem('aura:fontSize', editorFontSize.toString());
    localStorage.setItem('aura:terminalFontSize', editorFontSize.toString());
    localStorage.setItem('aura:fontFamily', effectiveFont);
    localStorage.setItem('aura:editorFontFamily', effectiveFont);
    localStorage.setItem('aura:terminalFontFamily', effectiveFont);
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
            <span>Settings</span>
          </div>
          <button
            onClick={onClose}
            className="aura-btn-ghost p-1 rounded-md"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Tab Switcher: Preferences vs Extensions */}
        <div
          style={{
            backgroundColor: 'var(--aura-sidebar-toolbar-bg, var(--aura-card-bg, #252526))',
            borderColor: 'var(--aura-border, #333333)',
          }}
          className="flex items-center gap-2 px-6 pt-2 pb-2 border-b select-none text-xs"
        >
          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'preferences'
                ? 'bg-[var(--aura-accent,#007acc)]/15 text-[var(--aura-accent,#007acc)] border border-[var(--aura-accent,#007acc)]/30 shadow-xs'
                : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
            }`}
          >
            <Sliders size={13} />
            <span>Preferences</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('plugins')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'plugins'
                ? 'bg-[var(--aura-accent,#007acc)]/15 text-[var(--aura-accent,#007acc)] border border-[var(--aura-accent,#007acc)]/30 shadow-xs'
                : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
            }`}
          >
            <Puzzle size={13} />
            <span>Extensions</span>
            {plugins.filter((p) => p.installed !== false).length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20 dark:bg-white/10 text-[var(--aura-text-muted)]">
                {plugins.filter((p) => p.installed !== false).length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'preferences' ? (
          <div className="p-6 space-y-4 text-xs text-[var(--aura-text)] max-h-[65vh] overflow-y-auto no-scrollbar">
            {/* Card 1: Appearance & Theme */}
            <div
              style={{
                backgroundColor: 'var(--aura-app-bg, #181818)',
                borderColor: 'var(--aura-border, #333333)',
              }}
              className="p-3.5 rounded-xl border space-y-2.5 relative z-30"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-muted)]">
                Appearance
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                  <Palette size={14} className="text-[var(--aura-accent,#007acc)]" />
                  <span>Color Theme</span>
                </label>
                <CustomSelect
                  value={theme}
                  options={THEMES.map((th) => ({
                    value: th.id,
                    label: th.name,
                  }))}
                  onChange={(nextTheme) => {
                    setTheme(nextTheme);
                    onChangeTheme(nextTheme);
                  }}
                />
              </div>
            </div>

            {/* Card 2: Font Size (Panels 1 · 2 · 3) */}
            <div
              style={{
                backgroundColor: 'var(--aura-app-bg, #181818)',
                borderColor: 'var(--aura-border, #333333)',
              }}
              className="p-3.5 rounded-xl border space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-muted)]">
                  Font Size (Panels 1 · 2 · 3)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarFontSize(14);
                    setEditorFontSize(14);
                    setTerminalFontSize(14);
                  }}
                  title="Reset all panels to 14px"
                  className="text-[10px] text-[var(--aura-text-muted)] hover:text-[var(--aura-accent,#007acc)] transition-colors cursor-pointer"
                >
                  Reset (14px)
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="28"
                    step="0.5"
                    value={editorFontSize}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditorFontSize(val);
                      setSidebarFontSize(val);
                      setTerminalFontSize(val);
                    }}
                    style={{
                      backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                      borderColor: 'var(--aura-border, #3c3c3c)',
                      color: 'var(--aura-text)',
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-[var(--aura-accent,#007acc)]"
                  />
                  <span className="text-xs text-[var(--aura-text-muted)] font-mono">px</span>
                </div>
                <div className="text-[10px] text-[var(--aura-text-muted)] font-mono shrink-0">
                  Shortcuts: ⌘+ / ⌘- (Zoom in / out)
                </div>
              </div>
            </div>

            {/* Card 3: Typography & Font Family (Panels 1 · 2 · 3) */}
            <div
              style={{
                backgroundColor: 'var(--aura-app-bg, #181818)',
                borderColor: 'var(--aura-border, #333333)',
              }}
              className="p-3.5 rounded-xl border space-y-3 relative z-20"
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-muted)]">
                  Font Family (Panels 1 · 2 · 3)
                </div>
                <span className="text-[10px] text-emerald-500 font-mono font-medium">✓ Subpixel Antialiased</span>
              </div>

              {/* Font Family for Panels 1 · 2 · 3 */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                  <Type size={14} className="text-[var(--aura-accent,#007acc)]" />
                  <span>Global Font Family</span>
                </label>
                <CustomSelect
                  value={fontFamily}
                  options={FONT_PRESETS.map((fp) => ({
                    value: fp.value,
                    label: fp.label,
                    fontPreview: fp.value !== 'Custom' ? fp.value : undefined,
                  }))}
                  onChange={(val) => setFontFamily(val)}
                />
                {fontFamily === 'Custom' && (
                  <input
                    type="text"
                    placeholder="Enter installed font family name (e.g. Menlo, Consolas)..."
                    value={customFont}
                    onChange={(e) => setCustomFont(e.target.value)}
                    style={{
                      backgroundColor: 'var(--aura-input-bg, #252526)',
                      borderColor: 'var(--aura-border, #3c3c3c)',
                      color: 'var(--aura-text, #cccccc)',
                    }}
                    className="w-full mt-1 border rounded-md px-3 py-1.5 font-mono text-xs outline-none focus:border-[#007acc]"
                  />
                )}
                <p className="text-[11px] text-[var(--aura-text-muted)] mt-0.5">
                  Applied synchronously to 2. Editor and 3. Terminal.
                </p>
              </div>
            </div>

            {/* Card 4: Markdown & Outline */}
            <div
              style={{
                backgroundColor: 'var(--aura-app-bg, #181818)',
                borderColor: 'var(--aura-border, #333333)',
              }}
              className="p-3.5 rounded-xl border space-y-3 relative z-10"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-muted)]">
                Markdown & Outline
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 font-semibold text-[var(--aura-text)]">
                  <FileCode size={14} className="text-sky-400" />
                  <span>Default View Mode</span>
                </label>
                <CustomSelect
                  value={defaultMarkdownMode}
                  options={[
                    { value: 'editor', label: 'Text Editor (Vim mode - Default)' },
                    { value: 'markdown-preview', label: 'Markdown Preview Enhanced' },
                    { value: 'markmap', label: 'Markmap Mind Map' },
                  ]}
                  onChange={(val) => setDefaultMarkdownMode(val as any)}
                />
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
                    <span>Show Table of Contents by Default</span>
                  </div>
                  <div className="text-[11px] text-[var(--aura-text-muted)]">
                    Display outline sidebar in Markdown preview mode.
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
        ) : (
          /* activeTab === 'plugins': Extension Marketplace & Management */
          <div className="flex flex-col flex-1 p-6 space-y-4 text-xs text-[var(--aura-text)] max-h-[65vh] overflow-y-auto no-scrollbar">
            {/* Search Bar */}
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-[var(--aura-text-muted)] pointer-events-none" />
              <input
                type="text"
                value={pluginSearchQuery}
                onChange={(e) => setPluginSearchQuery(e.target.value)}
                placeholder="Search extensions in Open-VSX Marketplace..."
                style={{
                  backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                  borderColor: 'var(--aura-border, #3c3c3c)',
                  color: 'var(--aura-text)',
                }}
                className="w-full border rounded-lg pl-9 pr-8 py-2 text-xs outline-none focus:border-[#007acc] transition-colors"
              />
              {pluginSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPluginSearchQuery('')}
                  className="absolute right-2.5 text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] text-sm"
                >
                  ×
                </button>
              )}
            </div>

            {isSearchingOnline && (
              <div className="h-0.5 bg-[var(--aura-border)]/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#007acc] animate-pulse w-full bg-gradient-to-r from-transparent via-[#007acc] to-transparent" />
              </div>
            )}

            {/* Extension List */}
            <div className="space-y-2.5">
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
                  list = list.filter(
                    (p) =>
                      p.name.toLowerCase().includes(query) ||
                      p.description.toLowerCase().includes(query) ||
                      p.publisher?.toLowerCase().includes(query)
                  );
                }

                if (list.length === 0 && !isSearchingOnline) {
                  return (
                    <div className="text-center py-12 text-[var(--aura-text-muted)] text-xs space-y-2">
                      <Puzzle size={24} className="mx-auto opacity-40 text-[#007acc]" />
                      <p>{!query ? 'No extensions installed yet' : 'No extensions found matching your search'}</p>
                    </div>
                  );
                }

                return list.map((plugin) => {
                  const isInstalled = plugins.some((p) => p.id === plugin.id && p.installed);
                  const isEnabled = plugins.some((p) => p.id === plugin.id && p.enabled);
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
                      style={{
                        backgroundColor: 'var(--aura-app-bg, #181818)',
                        borderColor: 'var(--aura-border, #333333)',
                      }}
                      className="p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors hover:border-[var(--aura-accent,#007acc)]/50 group"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          style={{
                            backgroundColor: 'var(--aura-card-bg, #252526)',
                            borderColor: 'var(--aura-border, #333333)',
                          }}
                          className="w-10 h-10 rounded-lg border p-1 flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5"
                        >
                          {Logo}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[var(--aura-text)] truncate">
                              {plugin.name}
                            </span>
                            {plugin.version && (
                              <span className="text-[10px] font-mono text-[var(--aura-text-muted)] bg-black/10 dark:bg-white/10 px-1 rounded">
                                v{plugin.version}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-[var(--aura-text-muted)] line-clamp-2 leading-relaxed">
                            {plugin.description}
                          </p>

                          <div className="flex items-center gap-2 text-[10px] text-[var(--aura-text-muted)]">
                            <span>{plugin.publisher || 'Community'}</span>
                            {plugin.downloads && <span>• {plugin.downloads} installs</span>}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                        {isInstalled ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onTogglePlugin?.(plugin.id)}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                                isEnabled
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-black/10 dark:bg-white/10 text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]'
                              }`}
                            >
                              {isEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                            {onUninstallPlugin && (
                              <button
                                type="button"
                                onClick={() => onUninstallPlugin(plugin.id)}
                                title="Uninstall extension"
                                className="p-1 rounded text-[var(--aura-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        ) : (
                          onInstallPlugin && (
                            <button
                              type="button"
                              onClick={() => onInstallPlugin(plugin)}
                              className="aura-btn-primary px-3 py-1 flex items-center gap-1.5 text-xs font-medium"
                            >
                              <Download size={12} />
                              <span>Install</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

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
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="aura-btn-primary px-4 py-1.5"
          >
            <Save size={13} />
            <span>Save & Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
};
