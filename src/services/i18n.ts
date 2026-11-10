export type SupportedLang = 'zh-CN' | 'en-US';

export const translations = {
  'zh-CN': {
    // TopBar & General
    settings: '首选项与设置',
    splitTitle: '分屏调度 / 新建会话',
    terminal: '系统终端',
    toggleBottom: '切换底部面板显示',
    explorer: '资源管理器',
    search: '全局搜索',
    gitCommits: '源代码管理',
    extensions: '扩展插件',
    
    // Sidebar Actions
    newFile: '新建文件',
    newFolder: '新建文件夹',
    refresh: '刷新目录',
    collapseAll: '全部折叠',
    copyPath: '复制绝对路径',
    copyRelativePath: '复制相对路径',
    rename: '重命名',
    delete: 'Delete',
    renameTitle: '重命名',
    deleteConfirmTitle: (name: string) => `Are you sure you want to permanently delete '${name}'?`,
    deleteWarning: 'This action will permanently delete this file or folder from disk.',
    cancel: 'Cancel',
    confirmDelete: 'Delete',
    confirmOk: '确定',
    inputNewName: '输入新名称',
    inputNewFileFolder: '输入名称 (末尾加 / 即为创建目录)',
    searchPlaceholder: '搜索工作区文本...',
    cleanBranch: '分支: main (干净状态)',
    enabled: '已启用',
    disabled: '已禁用',
    vimHints: 'j/k:上下  o:展开/折叠  a:新建  r:重命名  d:删除',

    // Settings
    settingsTitle: '首选项与设置 (Preferences & Settings)',
    workspaceRoot: '当前工作区路径',
    changeWorkspace: '切换目录',
    editorFontSize: '编辑器字号',
    colorTheme: '色彩主题',
    displayLanguage: '显示语言 (Language)',
    saveSettings: '保存设置',
    settingsSaved: '设置已成功保存',
    coreShortcuts: '核心快捷键一览',
    shortcutCmdD: '⌘D：调度终端或 OpenCode',
    shortcutSpaceOc: 'Space + oc：切换底栏展开/折叠',
    shortcutSave: '⌘S / ww：快速保存文件',
    shortcutCopyPath: 'yyp：复制文件绝对路径',

    // QuickPicker
    terminalZshTitle: '系统终端 (Terminal - zsh)',
    terminalZshDesc: '原生 macOS 终端并加载完整的 oh-my-zsh 环境',
    opencodeTitle: 'OpenCode 原生 CLI',
    opencodeDesc: '在当前工作区启动原生交互式 OpenCode 会话',
    enterToSelect: '回车进入',
    quickPickerHint: 'j / k 或上下箭头选择，Esc 取消',

    // Toasts
    savedFile: (name: string) => `已保存: ${name}`,
    openedDir: (name: string) => `已打开工作区: ${name}`,
    openedTerminal: '已启动系统终端',
    openedOpenCode: '已启动 OpenCode 会话',
    pathCopied: '路径已复制到剪贴板',
    textCopied: '选中文本已自动复制到剪贴板',
    quitWarning: '再按一次 ⌘Q 退出 Aura (Press ⌘Q again to quit)',
  },
  'en-US': {
    // TopBar & General
    settings: 'Preferences & Settings',
    splitTitle: 'Split / New Instance',
    terminal: 'Terminal',
    toggleBottom: 'Toggle Bottom Panel',
    explorer: 'Explorer',
    search: 'Search',
    gitCommits: 'Source Control',
    extensions: 'Extensions',
    
    // Sidebar Actions
    newFile: 'New File',
    newFolder: 'New Folder',
    refresh: 'Refresh',
    collapseAll: 'Collapse All',
    copyPath: 'Copy Path',
    copyRelativePath: 'Copy Relative Path',
    rename: 'Rename',
    delete: 'Delete',
    renameTitle: 'Rename',
    deleteConfirmTitle: (name: string) => `Are you sure you want to permanently delete '${name}'?`,
    deleteWarning: 'You can restore this file from the Trash if needed.',
    cancel: 'Cancel',
    confirmDelete: 'Delete',
    confirmOk: 'OK',
    inputNewName: 'Enter new name',
    inputNewFileFolder: 'Name (append / for folder)',
    searchPlaceholder: 'Search files across workspace...',
    cleanBranch: 'branch: main (clean)',
    enabled: 'Enabled',
    disabled: 'Disabled',
    vimHints: 'j/k:move  o:toggle  a:new  r:rename  d:delete',

    // Settings
    settingsTitle: 'Preferences & Settings',
    workspaceRoot: 'Workspace Root Directory',
    changeWorkspace: 'Change Folder',
    editorFontSize: 'Editor Font Size',
    colorTheme: 'Color Theme',
    displayLanguage: 'Display Language',
    saveSettings: 'Save Settings',
    settingsSaved: 'Settings saved successfully',
    coreShortcuts: 'Core Keyboard Shortcuts',
    shortcutCmdD: '⌘D: Split Terminal / OpenCode',
    shortcutSpaceOc: 'Space + oc: Toggle Bottom Panel',
    shortcutSave: '⌘S / ww: Save Active File',
    shortcutCopyPath: 'yyp: Copy Absolute Path',

    // QuickPicker
    terminalZshTitle: 'Terminal (zsh)',
    terminalZshDesc: 'Native macOS shell with oh-my-zsh environment',
    opencodeTitle: 'OpenCode CLI',
    opencodeDesc: 'Interactive OpenCode agent session in workspace',
    enterToSelect: 'Enter',
    quickPickerHint: 'j / k or arrows to select, Esc to cancel',

    // Toasts
    savedFile: (name: string) => `Saved: ${name}`,
    openedDir: (name: string) => `Workspace opened: ${name}`,
    openedTerminal: 'Terminal started',
    openedOpenCode: 'OpenCode session started',
    pathCopied: 'Path copied to clipboard',
    textCopied: 'Selected text copied to clipboard',
    quitWarning: 'Press ⌘Q again to quit Aura',
  },
};

export function getInitialLanguage(): SupportedLang {
  const saved = localStorage.getItem('aura:language') as SupportedLang;
  if (saved && (saved === 'zh-CN' || saved === 'en-US')) {
    return saved;
  }
  const sysLang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  return sysLang.startsWith('zh') ? 'zh-CN' : 'en-US';
}
