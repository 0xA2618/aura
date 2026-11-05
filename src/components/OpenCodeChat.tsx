import React, { useState, useRef, useEffect } from 'react';
import { OpenCodeMessage } from '../types';
import {
  Send,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  CornerDownLeft,
  Wand2,
} from 'lucide-react';

interface SkillOption {
  name: string;
  command: string;
  desc: string;
  category: 'builtin' | 'skill';
}

const AVAILABLE_SKILLS: SkillOption[] = [
  { name: 'compact', command: '/compact', desc: '压缩当前会话上下文并保留关键信息 (Compact session history)', category: 'builtin' },
  { name: 'clear', command: '/clear', desc: '清空当前终端与会话屏幕 (Clear conversation context)', category: 'builtin' },
  { name: 'undo', command: '/undo', desc: '撤销上一步操作或代码修改 (Undo last assistant action)', category: 'builtin' },
  { name: 'redo', command: '/redo', desc: '重做已撤销的操作 (Redo undone action)', category: 'builtin' },
  { name: 'context', command: '/context', desc: '查看当前 AI 消耗的 Token 与上下文预算 (Show context metrics)', category: 'builtin' },
  { name: 'help', command: '/help', desc: '列出全部支持的系统指令与帮助说明 (Show help menu)', category: 'builtin' },
  { name: 'goal', command: '/goal', desc: '设定、显示、暂停、恢复或清除当前会话目标 (Goal tracking)', category: 'builtin' },
  { name: 'handoff', command: '/handoff', desc: '创建详细的上下文交接摘要以在全新会话中继续工作 (Session handoff)', category: 'builtin' },
  { name: 'hyperplan', command: '/hyperplan', desc: '多智能体对抗规划团队模式 (Team-mode planning)', category: 'builtin' },
  { name: 'stop-continuation', command: '/stop-continuation', desc: '停止当前会话的一切自主续跑逻辑 (Stop loops)', category: 'builtin' },
  { name: 'init', command: '/init', desc: '初始化工程配置（AGENTS.md、opencode.json）与项目环境', category: 'skill' },
  { name: 'init-gitlab', command: '/init-gitlab', desc: 'GitLab 工程初始化：自动补全 CI/CD、Dockerfile 与工程规约', category: 'skill' },
  { name: 'init-deep', command: '/init-deep', desc: '初始化分层层级式 AGENTS.md 知识库架构', category: 'skill' },
  { name: 'review-work', command: '/review-work', desc: '全维度代码审查：质量把关、漏洞扫描与目标核验', category: 'skill' },
  { name: 'debugging', command: '/debugging', desc: '假设驱动与深入异常排查断点', category: 'skill' },
  { name: 'secret', command: '/secret', desc: '代码安全审计与敏感凭证泄漏挖掘', category: 'skill' },
  { name: 'git-master', command: '/git-master', desc: 'Git 规范提交、变基流转与历史溯源', category: 'skill' },
  { name: 'netx-gitlab-commit-tag', command: '/netx-gitlab-commit-tag', desc: 'GitLab CI/CD 标签触发规范提交与自动化流水线', category: 'skill' },
  { name: 'readme', command: '/readme', desc: '自动代码变更提炼与项目 README 增量更新', category: 'skill' },
  { name: 'refactor', command: '/refactor', desc: '智能架构重构、函数提取与代码简化现代化', category: 'skill' },
  { name: 'remove-ai-slops', command: '/remove-ai-slops', desc: '消除 AI 代码异味与冗余样板结构', category: 'skill' },
  { name: 'programming', command: '/programming', desc: '强类型语言严谨工程开发规范 (TS/Rust/Py/Go)', category: 'skill' },
  { name: 'visual-qa', command: '/visual-qa', desc: 'Web 与终端视觉保真度严谨审查与像素级对比', category: 'skill' },
  { name: 'playwright', command: '/playwright', desc: '端到端浏览器自动化操作、测试与网页截图抓取', category: 'skill' },
  { name: 'frontend', command: '/frontend', desc: '前端 UI/UX 美学设计、微交互与动效打磨', category: 'skill' },
  { name: 'turnstile-spin', command: '/turnstile-spin', desc: '配置或迁移 Cloudflare Turnstile 人机验证', category: 'skill' },
  { name: 'web-perf', command: '/web-perf', desc: '网站交互性能、Lighthouse 与 Core Web Vitals 审计', category: 'skill' },
  { name: 'cloudflare', command: '/cloudflare', desc: '发现并选型 Cloudflare 产品架构与方案', category: 'skill' },
  { name: 'durable-objects', command: '/durable-objects', desc: '构建与调试 Cloudflare Durable Objects 分布式状态', category: 'skill' },
  { name: 'gateway-workers', command: '/gateway-workers', desc: '构建与审查 Cloudflare Gateway 中间件 Workers', category: 'skill' },
  { name: 'wrangler', command: '/wrangler', desc: '运行与排查 Wrangler CLI 命令与部署配置', category: 'skill' },
  { name: 'cf-cli', command: '/cf-cli', desc: '使用 Cloudflare 官方 cf CLI 进行公共 API 与资源操作', category: 'skill' },
];

interface OpenCodeChatProps {
  workspaceDir?: string;
}

export const OpenCodeChat: React.FC<OpenCodeChatProps> = ({ workspaceDir }) => {
  const currentPath = workspaceDir || '/Users/Yang/workspace/local/codingTree';
  const [messages, setMessages] = useState<OpenCodeMessage[]>([
    {
      id: '1',
      role: 'user',
      content: '我想自己实现一个在页面展示像vscode一样的编码工具， 左为目录结构， 右侧上半部分为文件显示区域， 右下半部分为ai对话框(我当前是使用的opencode)，需要有功能还需要支持像vscode一样支持插件， 要有git的提交记录， 在右下半部分通过 cmd+d 在右侧新开一个termini(这里要提示是开启terminal还是开启一个新的opencode的对话框)， 如果在开启opencode的对话时，可以只有一个对话的内容， 不输出opencode 的log, 还要支持一些快捷键， 可以参考这个目录 /Users/Yang/workspace/github/nvim 根据当前的信息 总结再补充一下需求文档， 放到当前目录就好',
      timestamp: '16:30',
    },
    {
      id: '2',
      role: 'assistant',
      content: '已根据你的需求与参考项目深入梳理并生成了完整的需求与技术架构设计文档 REQUIREMENTS.md。包含三栏极简防挤压布局、原生 oh-my-zsh 直连、纯净对话流设计与 macOS 原生打包规范。',
      timestamp: '16:32',
    },
    {
      id: '3',
      role: 'user',
      content: '生成， 按计划生成文件和编写代码， 并打成在macos可用的应用，名称叫 Aura，打包到启动台',
      timestamp: '17:50',
    },
    {
      id: '4',
      role: 'assistant',
      content: '已构建出极简高质感 Aura.app 与安装盘镜像 DMG，并成功部署安装至启动台与应用程序列表。支持 ⌘D 双模调度与无缝 zsh 环境。',
      timestamp: '17:58',
    },
  ]);
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState<Record<string, boolean>>({});
  const [showSkillsPopup, setShowSkillsPopup] = useState(false);
  const [selectedSkillIdx, setSelectedSkillIdx] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.startsWith('/') && !val.includes(' ')) {
      setShowSkillsPopup(true);
      setSelectedSkillIdx(0);
    } else {
      setShowSkillsPopup(false);
    }
  };

  const handleSelectSkill = (skill: SkillOption) => {
    setInput(`${skill.command} `);
    setShowSkillsPopup(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: OpenCodeMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setShowSkillsPopup(false);

    setTimeout(() => {
      let responseText = `针对你的指令：“${currentInput}”，我已完成上下文分析与推导。已准备好高内聚、低耦合的优雅实现。`;
      if (currentInput.startsWith('/init')) {
        responseText = '已根据当前工作区环境完成工程初始化扫描，AGENTS.md 与配置清单已核验完毕。';
      } else if (currentInput.startsWith('/review-work')) {
        responseText = '已启动 5 维度审查流水线：目标约束、代码整洁度、安全门禁已全部通过。';
      } else if (currentInput.startsWith('/secret')) {
        responseText = '代码安全审计完成：未检出高危敏感凭证泄漏，输入边界安全健全。';
      }

      const assistantMsg: OpenCodeMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        thinking: '分析当前项目 AST 与文件拓扑，过滤 RPC 协议噪音，锁定关键代码块与语法节点。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 600);
  };

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleThinking = (id: string) => {
    setShowThinking((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredSkills = AVAILABLE_SKILLS.filter(
    (s) => s.command.toLowerCase().includes(input.toLowerCase()) || s.name.toLowerCase().includes(input.toLowerCase())
  );

  const handleMouseUpSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length > 0) {
      navigator.clipboard.writeText(text);
      setCopiedId('selection');
      setTimeout(() => setCopiedId(null), 1200);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e]">
      {/* 1. Messages Scroll Area */}
      <div
        onMouseUp={handleMouseUpSelection}
        className="flex-1 overflow-y-auto p-4 space-y-4 select-text relative"
      >
        {copiedId === 'selection' && (
          <div className="sticky top-2 left-1/2 -translate-x-1/2 z-40 bg-[#007acc] text-white text-[11px] px-3 py-1 rounded-full shadow-lg font-mono flex items-center gap-1.5 w-fit mx-auto animate-in fade-in">
            <Check size={12} />
            <span>选中文本已自动复制到剪贴板</span>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col text-xs leading-relaxed max-w-[88%] ${
              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[#858585]">
              <span className="font-semibold text-[#cccccc] font-sans">
                {msg.role === 'user' ? 'You' : 'OpenCode'}
              </span>
              <span className="text-[10px] text-[#666666] font-mono">{msg.timestamp}</span>
            </div>

            {msg.thinking && (
              <div className="w-full mb-2 bg-[#252526]/80 backdrop-blur-xs rounded-lg border border-[#333333] overflow-hidden">
                <button
                  onClick={() => toggleThinking(msg.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#999999] hover:text-white w-full text-left transition-colors"
                >
                  {showThinking[msg.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Sparkles size={12} className="text-amber-400" />
                  <span className="font-mono">推理过程与上下文分析 (已收纳)</span>
                </button>
                {showThinking[msg.id] && (
                  <div className="px-3 py-2 text-[11.5px] text-[#888888] bg-[#1a1a1a] border-t border-[#2a2a2a] leading-normal font-mono">
                    {msg.thinking}
                  </div>
                )}
              </div>
            )}

            <div
              className={`p-3.5 rounded-2xl border shadow-sm break-words ${
                msg.role === 'user'
                  ? 'bg-[#007acc] text-white border-[#1188dd] rounded-br-xs'
                  : 'bg-[#252526] text-[#e0e0e0] border-[#37373d] rounded-bl-xs'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed font-sans text-[12.5px]">{msg.content}</div>

              {msg.role === 'assistant' && (
                <div className="mt-2.5 pt-2 border-t border-[#333333] flex justify-end">
                  <button
                    onClick={() => copyCode(msg.content, msg.id)}
                    className="flex items-center gap-1.5 text-[11px] text-[#858585] hover:text-white px-2 py-0.5 rounded hover:bg-[#333333] transition-colors"
                  >
                    {copiedId === msg.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    <span>{copiedId === msg.id ? '已复制' : '复制内容'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-[#1e1e1e] relative">
        {showSkillsPopup && filteredSkills.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#252526] border border-[#404040] rounded-xl shadow-2xl overflow-hidden z-30">
            <div className="px-3 py-1.5 bg-[#2a2a2c] text-[10px] font-mono text-[#888888] border-b border-[#353535] flex items-center justify-between">
              <span>OpenCode 技能工具箱 (Skills)</span>
              <span>↑↓ 选择，Enter / 点击选中</span>
            </div>
            <div className="p-1 space-y-0.5 max-h-48 overflow-y-auto">
              {filteredSkills.map((skill, idx) => (
                <div
                  key={skill.name}
                  onClick={() => handleSelectSkill(skill)}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    selectedSkillIdx === idx ? 'bg-[#007acc] text-white' : 'text-[#cccccc] hover:bg-[#2d2d30]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{skill.command}</span>
                    <span className="text-[11px] opacity-80">{skill.desc}</span>
                  </div>
                  <Wand2 size={12} className="opacity-60" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#252526] border border-[#3c3c3c] rounded-2xl p-2 flex flex-col gap-2 shadow-lg focus-within:border-[#007acc] transition-colors">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (showSkillsPopup) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedSkillIdx((i) => (i + 1) % filteredSkills.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedSkillIdx((i) => (i - 1 + filteredSkills.length) % filteredSkills.length);
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSelectSkill(filteredSkills[selectedSkillIdx]);
                  return;
                }
                if (e.key === 'Escape') {
                  setShowSkillsPopup(false);
                  return;
                }
              }

              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入需求或输入 / 快速唤起 OpenCode 技能 (如 /init, /debugging)..."
            className="w-full bg-transparent text-xs text-[#cccccc] px-2 py-1 focus:outline-none resize-none placeholder:text-[#666666]"
          />
          <div className="flex items-center justify-between px-2 pt-1 border-t border-[#303030]">
            <div className="flex items-center gap-2">
              <div
                onClick={() => setShowSkillsPopup((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-sans text-[#777777] cursor-pointer hover:text-[#cccccc] transition-colors"
                title="输入 / 唤起技能与指令清单"
              >
                <span>按 Enter 发送，输入 / 唤起技能</span>
              </div>
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#007acc] text-white text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#0062a3] transition-all"
            >
              <span>发送</span>
              <CornerDownLeft size={11} />
            </button>
          </div>
        </div>

        {/* Bottom Workspace Directory Bar matching Image 1 exact position */}
        <div className="mt-2 flex items-center justify-between px-1 select-none">
          <div
            onClick={() => setShowSkillsPopup((v) => !v)}
            className="flex items-center pl-2.5 border-l-[3.5px] border-[#00a896] text-[13px] font-mono leading-none cursor-pointer hover:opacity-90 transition-opacity"
            title="当前工作区目录 (点击展开技能清单)"
          >
            <span className="text-[#38a169] font-medium tracking-tight font-mono">{currentPath}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#777777] font-mono">
            <span>Aura · OpenCode</span>
          </div>
        </div>
      </div>
    </div>
  );
};
