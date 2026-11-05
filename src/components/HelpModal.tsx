import React, { useEffect } from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutCategory {
  title: string;
  items: { key: string; desc: string }[];
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
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

  const categories: ShortcutCategory[] = [
    {
      title: '窗口与全局 (Window & System)',
      items: [
        { key: '⌘ + qq', desc: '安全退出应用 (连按 2 次 q 退出)' },
        { key: '⌘ + W', desc: '关闭当前激活标签页 / 终端分屏 (不退出应用)' },
        { key: '⌘ + = / +', desc: '放大编辑器字体 (Font Size +)' },
        { key: '⌘ + - / _', desc: '缩小编辑器字体 (Font Size -)' },
        { key: '⌘ + ,', desc: '打开偏好设置 (Preferences & Settings)' },
        { key: '⌘ + 1 ~ 9', desc: '在聚焦终端时快速切换 1~9 号分屏' },
      ],
    },
    {
      title: '编辑器与文件 (Editor & Files)',
      items: [
        { key: '⌘ + S', desc: '保存当前文件内容' },
        { key: 'i / a / o', desc: 'Vim 模式：插入模式 (当前/右侧/下方新行)' },
        { key: 'Esc', desc: 'Vim 模式：退出回到 NORMAL 模式' },
        { key: 'h / j / k / l', desc: 'Vim 模式：左 / 下 / 上 / 右移动光标' },
        { key: 'w / b', desc: 'Vim 模式：按词向前 / 向后移动光标' },
        { key: 'dd / x', desc: 'Vim 模式：剪切删除整行 / 单个字符' },
        { key: 'yy / p', desc: 'Vim 模式：复制整行 / 粘贴剪贴板内容' },
      ],
    },
    {
      title: '1号窗口 资源管理 (Window 1 Explorer)',
      items: [
        { key: 'j / k', desc: '向下 / 向上移动选中高亮条目' },
        { key: 'Enter', desc: '原地重命名选中的文件或文件夹' },
        { key: 'o', desc: '打开选中的文件或折叠/展开文件夹' },
        { key: 'a', desc: '在当前选中的层级下方原地新建文件' },
        { key: 'd', desc: '删除当前选中的文件或文件夹' },
        { key: 'Shift+Alt+C', desc: '复制当前条目的完整绝对路径' },
        { key: '⌥ + ⌘ + C', desc: '复制当前条目的工程相对路径' },
      ],
    },
    {
      title: '3号窗口 终端与 AI (Window 3 Terminal & AI)',
      items: [
        { key: 'Space + oc', desc: '一键展开 / 隐藏 3 号多模态终端窗口' },
        { key: 'Ctrl + L', desc: '展开 3 号窗口并立即聚焦到终端' },
        { key: '⌘ + Shift + M', desc: '新建原生 OpenCode 智能对话抽屉' },
        { key: '⌘ + T', desc: '新建原生系统终端 (Terminal - zsh)' },
        { key: '⌘ + D', desc: '水平分屏当前终端 (Split Horizontal)' },
        { key: '⌘ + Shift + D', desc: '垂直分屏当前终端 (Split Vertical)' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-[660px] bg-[#252526] border border-[#454545] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 select-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333333] bg-[#2d2d2d]">
          <div className="flex items-center gap-2 text-sm text-[#cccccc] font-semibold">
            <Keyboard size={16} className="text-[#007acc]" />
            <span>快捷键配置与操作指南 (Keyboard Shortcuts & Help)</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#858585] hover:text-white p-1 rounded hover:bg-[#3c3c3c] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto no-scrollbar">
          {categories.map((cat, idx) => (
            <div key={idx} className="p-3 bg-[#1e1e1e] rounded-xl border border-[#333333] space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#007acc] flex items-center gap-1.5">
                <Command size={12} />
                <span>{cat.title}</span>
              </div>
              <div className="grid grid-cols-1 divide-y divide-[#2a2a2a]">
                {cat.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-1 text-xs">
                    <span className="text-[#cccccc] text-[12px]">{item.desc}</span>
                    <span className="font-mono text-[11px] bg-[#2d2d2d] text-[#4ec9b0] px-2 py-0.5 rounded border border-[#3c3c3c] shadow-xs">
                      {item.key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-2.5 bg-[#1e1e1e] border-t border-[#333333] flex items-center justify-between text-xs text-gray-500 font-mono">
          <span>只读配置信息 (Read-Only)</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 rounded bg-[#333333] hover:bg-[#444444] text-[#cccccc] hover:text-white transition-colors"
          >
            关闭 (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
