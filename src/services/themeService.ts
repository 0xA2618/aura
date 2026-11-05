export interface ThemeDefinition {
  id: string;
  name: string;
  type: 'dark' | 'light';
  ui: {
    appBg: string;
    sidebarBg: string;
    topBarBg: string;
    editorBg: string;
    dockBg: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    highlight: string;
  };
  monacoTheme: {
    base: 'vs-dark' | 'vs';
    inherit: boolean;
    rules: { token: string; foreground?: string; fontStyle?: string }[];
    colors: Record<string, string>;
  };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'light-2026',
    name: 'Light 2026 Default Light (macOS Modern)',
    type: 'light',
    ui: {
      appBg: '#f3f4f6',
      sidebarBg: '#f8fafc',
      topBarBg: '#f1f5f9',
      editorBg: '#ffffff',
      dockBg: '#f8fafc',
      border: '#e2e8f0',
      text: '#1e293b',
      textMuted: '#64748b',
      accent: '#007acc',
      highlight: '#e0f2fe',
    },
    monacoTheme: {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0284c7' },
        { token: 'string', foreground: '16a34a' },
        { token: 'number', foreground: 'd97706' },
        { token: 'type', foreground: '9333ea' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1e293b',
        'editorCursor.foreground': '#007acc',
        'editor.selectionBackground': '#e0f2fe',
        'editorLineNumber.foreground': '#94a3b8',
      },
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark (Neovim Classic)',
    type: 'dark',
    ui: {
      appBg: '#1d2021',
      sidebarBg: '#282828',
      topBarBg: '#282828',
      editorBg: '#282828',
      dockBg: '#1d2021',
      border: '#3c3836',
      text: '#ebdbb2',
      textMuted: '#928374',
      accent: '#fabd2f',
      highlight: '#504945',
    },
    monacoTheme: {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '928374', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'fb4934' },
        { token: 'string', foreground: 'b8bb26' },
        { token: 'number', foreground: 'd3869b' },
        { token: 'type', foreground: 'fabd2f' },
      ],
      colors: {
        'editor.background': '#282828',
        'editor.foreground': '#ebdbb2',
        'editorCursor.foreground': '#fabd2f',
        'editor.selectionBackground': '#504945',
      },
    },
  },
  {
    id: 'vs-dark',
    name: 'VS Code Dark Modern',
    type: 'dark',
    ui: {
      appBg: '#181818',
      sidebarBg: '#252526',
      topBarBg: '#1e1e1e',
      editorBg: '#1e1e1e',
      dockBg: '#181818',
      border: '#2d2d2d',
      text: '#cccccc',
      textMuted: '#858585',
      accent: '#007acc',
      highlight: '#094771',
    },
    monacoTheme: {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
      },
    },
  },
];

export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function applyThemeToDocument(theme: ThemeDefinition) {
  const root = document.documentElement;

  const isLight = theme.type === 'light';
  if (isLight) {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }

  const cardBg = isLight ? '#ffffff' : '#252526';
  const inputBg = isLight ? '#f1f5f9' : '#1e1e1e';
  const dockHeaderBg = isLight ? '#f1f5f9' : '#252526';
  const sidebarHeaderBg = isLight ? '#eef2f7' : '#1f1f20';
  const sidebarToolbarBg = isLight ? '#f1f5f9' : '#252526';
  const editorTabBg = isLight ? '#f1f5f9' : '#252526';

  root.style.setProperty('--aura-app-bg', theme.ui.appBg);
  root.style.setProperty('--aura-sidebar-bg', theme.ui.sidebarBg);
  root.style.setProperty('--aura-sidebar-fg', theme.ui.text);
  root.style.setProperty('--aura-sidebar-header-bg', sidebarHeaderBg);
  root.style.setProperty('--aura-sidebar-toolbar-bg', sidebarToolbarBg);
  root.style.setProperty('--aura-topbar-bg', theme.ui.topBarBg);
  root.style.setProperty('--aura-editor-bg', theme.ui.editorBg);
  root.style.setProperty('--aura-editor-fg', theme.ui.text);
  root.style.setProperty('--aura-editor-tab-bg', editorTabBg);
  root.style.setProperty('--aura-dock-bg', theme.ui.dockBg);
  root.style.setProperty('--aura-dock-fg', theme.ui.text);
  root.style.setProperty('--aura-dock-header-bg', dockHeaderBg);
  root.style.setProperty('--aura-card-bg', cardBg);
  root.style.setProperty('--aura-input-bg', inputBg);
  root.style.setProperty('--aura-border', theme.ui.border);
  root.style.setProperty('--aura-text', theme.ui.text);
  root.style.setProperty('--aura-text-muted', theme.ui.textMuted);
  root.style.setProperty('--aura-accent', theme.ui.accent);
  root.style.setProperty('--aura-highlight', theme.ui.highlight);
}
