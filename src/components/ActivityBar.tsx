import React from 'react';
import { Files, GitBranch, Puzzle, Settings, Terminal, Bot } from 'lucide-react';

interface ActivityBarProps {
  activeView: 'files' | 'git' | 'plugins';
  onChangeView: (view: 'files' | 'git' | 'plugins') => void;
  onOpenQuickPicker: () => void;
  isBottomOpen: boolean;
  onToggleBottom: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onChangeView,
  onOpenQuickPicker,
  isBottomOpen,
  onToggleBottom,
}) => {
  return (
    <div className="w-12 bg-[#333333] flex flex-col items-center select-none border-r border-[#252526] z-10 justify-between">
      {/* Top Navigation Icons with macOS Traffic Light Spacer */}
      <div className="flex flex-col gap-2 w-full pt-10">
        <button
          onClick={() => onChangeView('files')}
          title="资源管理器 (Explorer)"
          className={`flex justify-center items-center py-2.5 w-full relative transition-colors ${
            activeView === 'files' ? 'text-white' : 'text-[#858585] hover:text-[#cccccc]'
          }`}
        >
          {activeView === 'files' && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-white" />}
          <Files size={20} />
        </button>

        <button
          onClick={() => onChangeView('git')}
          title="源代码管理 (Git Commits)"
          className={`flex justify-center items-center py-2.5 w-full relative transition-colors ${
            activeView === 'git' ? 'text-white' : 'text-[#858585] hover:text-[#cccccc]'
          }`}
        >
          {activeView === 'git' && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-white" />}
          <GitBranch size={20} />
        </button>

        <button
          onClick={() => onChangeView('plugins')}
          title="扩展插件 (Extensions)"
          className={`flex justify-center items-center py-2.5 w-full relative transition-colors ${
            activeView === 'plugins' ? 'text-white' : 'text-[#858585] hover:text-[#cccccc]'
          }`}
        >
          {activeView === 'plugins' && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-white" />}
          <Puzzle size={20} />
        </button>
      </div>

      {/* Bottom Action Controls */}
      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={onOpenQuickPicker}
          title="⌘D 分屏调度：新建 Terminal / OpenCode"
          className="flex justify-center items-center py-2.5 w-full text-[#858585] hover:text-[#007acc] transition-colors"
        >
          <Bot size={20} />
        </button>

        <button
          onClick={onToggleBottom}
          title={isBottomOpen ? '隐藏下方 AI/终端 (Space + oc)' : '展开下方 AI/终端 (Space + oc)'}
          className={`flex justify-center items-center py-2.5 w-full transition-colors ${
            isBottomOpen ? 'text-[#007acc]' : 'text-[#858585] hover:text-white'
          }`}
        >
          <Terminal size={20} />
        </button>

        <button
          title="设置 (Settings)"
          className="flex justify-center items-center py-2.5 w-full text-[#858585] hover:text-[#cccccc] transition-colors"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
};
