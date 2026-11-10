import React, { useState } from 'react';
import { X, Keyboard, Search, Sparkles } from 'lucide-react';

interface ShortcutItem {
  command: string;
  keybinding: string;
  category: 'General' | 'Navigation' | 'Editor' | 'Terminal & AI';
  description: string;
}

const VSCODE_KEYBINDINGS: ShortcutItem[] = [
  // General
  { command: 'workbench.action.quickOpen', keybinding: '⌘P', category: 'General', description: '快速打开文件 (Quick Open File)' },
  { command: 'workbench.action.showCommands', keybinding: '⇧⌘P', category: 'General', description: '打开全局命令面板 (Command Palette)' },
  { command: 'workbench.action.openKeybindings', keybinding: '⌘K ⌘S', category: 'General', description: '打开键盘快捷键参考 (Keyboard Shortcuts)' },
  { command: 'workbench.action.openSettings', keybinding: '⌘,', category: 'General', description: '打开偏好设置 (Preferences / Settings)' },
  { command: 'workbench.action.quitApp', keybinding: '⌘Q Q', category: 'General', description: '双击退出应用程序 (Double Press to Quit)' },

  // Navigation
  { command: 'workbench.action.focusFiles', keybinding: '⇧⌘E', category: 'Navigation', description: '聚焦资源管理器文件树 (Focus Explorer)' },
  { command: 'workbench.action.findInFiles', keybinding: '⇧⌘F', category: 'Navigation', description: '在工作区全局搜索文件内容 (Global Search)' },
  { command: 'workbench.action.focusSourceControl', keybinding: '⌃⇧G', category: 'Navigation', description: '聚焦源代码管理 Git 面板 (Source Control)' },
  { command: 'workbench.action.focusExtensions', keybinding: '⇧⌘X', category: 'Navigation', description: '聚焦扩展插件面板 (Extensions)' },
  { command: 'workbench.action.copyFilePath', keybinding: 'yyp', category: 'Navigation', description: '复制当前选中文件/文件夹绝对路径 (Copy Path)' },

  // Editor
  { command: 'workbench.action.files.save', keybinding: '⌘S', category: 'Editor', description: '保存当前文件 (Save File / ww)' },
  { command: 'workbench.action.closeActiveEditor', keybinding: '⌘W', category: 'Editor', description: '关闭当前活动文件标签页 (Close Tab / qq)' },
  { command: 'workbench.action.nextEditor', keybinding: '⌃⇥', category: 'Editor', description: '切换至下一个文件标签页 (Next Editor Tab)' },
  { command: 'workbench.action.previousEditor', keybinding: '⌃⇧⇥', category: 'Editor', description: '切换至上一个文件标签页 (Previous Editor Tab)' },
  { command: 'actions.find', keybinding: '⌘F', category: 'Editor', description: '查找代码内容 (Find in Editor)' },
  { command: 'editor.action.formatDocument', keybinding: '⇧⌥F', category: 'Editor', description: '格式化当前代码文件 (Format Document)' },

  // Terminal & AI
  { command: 'workbench.action.splitTerminalOrAi', keybinding: '⌘D', category: 'Terminal & AI', description: '分屏调度器：新建 Terminal 或 OpenCode' },
  { command: 'workbench.action.terminal.toggleTerminal', keybinding: '⌘J', category: 'Terminal & AI', description: '一键显示/隐藏底栏终端与 AI (Toggle Bottom Panel)' },
  { command: 'workbench.action.toggleOpenCode', keybinding: 'Space oc', category: 'Terminal & AI', description: 'Vim 风格一键切换底栏 AI 对话窗口' },
  { command: 'workbench.action.terminal.clear', keybinding: '⌘K', category: 'Terminal & AI', description: '清空当前终端屏幕缓冲区 (Clear Terminal)' },
];

interface KeybindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeybindingsModal: React.FC<KeybindingsModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  if (!isOpen) return null;

  const filtered = VSCODE_KEYBINDINGS.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesQuery =
      item.command.toLowerCase().includes(search.toLowerCase()) ||
      item.keybinding.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const categories = ['All', 'General', 'Navigation', 'Editor', 'Terminal & AI'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div
        style={{
          backgroundColor: 'var(--aura-card-bg, #252526)',
          borderColor: 'var(--aura-border, #454545)',
          color: 'var(--aura-text, #cccccc)',
        }}
        className="w-[740px] max-h-[85vh] border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: 'var(--aura-topbar-bg, #2d2d2d)',
            borderColor: 'var(--aura-border, #333333)',
          }}
          className="flex items-center justify-between px-4 py-3 border-b select-none"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aura-text)]">
            <Keyboard size={16} className="text-[#007acc]" />
            <span>键盘快捷键 (Keyboard Shortcuts - VS Code Mappings)</span>
          </div>
          <button onClick={onClose} className="aura-btn-ghost p-1 rounded-md">
            <X size={16} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            backgroundColor: 'var(--aura-app-bg, #1e1e1e)',
            borderColor: 'var(--aura-border, #2d2d2d)',
          }}
          className="p-3 border-b flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-[var(--aura-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="键入以搜索快捷键命令 (Type to search keybindings, e.g. ⌘P, 保存, Terminal)..."
              style={{
                backgroundColor: 'var(--aura-input-bg, #252526)',
                borderColor: 'var(--aura-border, #3c3c3c)',
                color: 'var(--aura-text, #cccccc)',
              }}
              className="w-full text-xs pl-9 pr-3 py-1.5 rounded-lg border focus:outline-none focus:border-[#007acc]"
            />
          </div>

          <div
            style={{
              backgroundColor: 'var(--aura-card-bg, #252526)',
              borderColor: 'var(--aura-border, #333333)',
            }}
            className="flex items-center gap-1 p-1 rounded-lg border"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={
                  selectedCategory === cat
                    ? { backgroundColor: 'var(--aura-accent)', color: 'var(--aura-accent-fg, #ffffff)' }
                    : undefined
                }
                className={`px-2.5 py-1 text-[11px] rounded-md transition-all font-medium cursor-pointer ${
                  selectedCategory === cat
                    ? 'shadow-xs'
                    : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Keybindings Table */}
        <div
          style={{ borderColor: 'var(--aura-border, #2d2d2d)' }}
          className="flex-1 overflow-y-auto p-2 divide-y divide-[var(--aura-border,#2d2d2d)]"
        >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-[var(--aura-text-muted)]">未找到匹配的快捷键</div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.command}
                className="flex items-center justify-between px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 rounded-md group transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-[var(--aura-text)] font-sans font-medium">{item.description}</span>
                  <span className="text-[10px] text-[var(--aura-text-muted)] font-mono">{item.command}</span>
                </div>
                <div className="flex items-center gap-1">
                  {item.keybinding.split(' ').map((key, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: 'var(--aura-input-bg, #1e1e1e)',
                        borderColor: 'var(--aura-border, #3c3c3c)',
                        color: 'var(--aura-accent, #007acc)',
                      }}
                      className="px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold shadow-xs"
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: 'var(--aura-topbar-bg, #1e1e1e)',
            borderColor: 'var(--aura-border, #333333)',
            color: 'var(--aura-text-muted, #858585)',
          }}
          className="px-4 py-2.5 border-t flex items-center justify-between text-[11px] select-none"
        >
          <div className="flex items-center gap-1">
            <Sparkles size={12} className="text-[#007acc]" />
            <span>深度兼容 VS Code 标准快捷键体系与 Neovim 经典流转键位</span>
          </div>
          <span className="font-mono">Esc 键快速关闭</span>
        </div>
      </div>
    </div>
  );
};
