import React, { useMemo, useEffect, useRef } from "react";
import { marked } from "marked";
import mermaid from "mermaid";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "../services/fileService";

interface AcpMarkdownProps {
  content: string;
}

marked.setOptions({
  gfm: true,
  breaks: true,
  async: false,
});

const initMermaid = () => {
  const isLightMode =
    typeof document !== "undefined" && document.documentElement.classList.contains("light");
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "antiscript",
    themeVariables: isLightMode
      ? {
          darkMode: false,
          background: "#f5f7fa",
          primaryColor: "#eef2f7",
          primaryBorderColor: "#cbd5e1",
          primaryTextColor: "#1f2937",
          secondaryColor: "#e5ebf3",
          secondaryBorderColor: "#cbd5e1",
          secondaryTextColor: "#1f2937",
          tertiaryColor: "#f8fafc",
          tertiaryBorderColor: "#cbd5e1",
          tertiaryTextColor: "#1f2937",
          lineColor: "#64748b",
          textColor: "#1f2937",
          mainBkg: "#eef2f7",
          nodeBorder: "#cbd5e1",
          clusterBkg: "#f3f6fb",
          clusterBorder: "#e2e8f0",
          titleColor: "#111827",
          edgeLabelBackground: "transparent",
          actorBkg: "#eef2f7",
          actorBorder: "#cbd5e1",
          actorTextColor: "#1f2937",
          actorLineColor: "#64748b",
          activationBkgColor: "#cbd5e1",
          activationBorderColor: "#64748b",
          signalColor: "#64748b",
          signalTextColor: "#1f2937",
          labelBoxBkgColor: "#eef2f7",
          labelBoxBorderColor: "#cbd5e1",
          labelTextColor: "#1f2937",
          loopTextColor: "#1f2937",
          messageTextColor: "#1f2937",
          noteBkg: "#f3f6fb",
          noteBorder: "#cbd5e1",
          noteTextColor: "#1f2937",
          sequenceNumberColor: "#64748b",
          altBkg: "#e5ebf3",
          altBorder: "#cbd5e1",
          fontFamily: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
          fontSize: "12px",
        }
      : {
          darkMode: true,
          background: "#1f1f20",
          primaryColor: "#1f1f20",
          primaryBorderColor: "#3d444d",
          primaryTextColor: "#e0e0e0",
          secondaryColor: "#252526",
          secondaryBorderColor: "#3d444d",
          secondaryTextColor: "#e0e0e0",
          tertiaryColor: "#1a1a1b",
          tertiaryBorderColor: "#3d444d",
          tertiaryTextColor: "#e0e0e0",
          lineColor: "#6e7683",
          textColor: "#e0e0e0",
          mainBkg: "#1f1f20",
          nodeBorder: "#3d444d",
          clusterBkg: "#252526",
          clusterBorder: "#2d2d2d",
          titleColor: "#e0e0e0",
          edgeLabelBackground: "transparent",
          actorBkg: "#1f1f20",
          actorBorder: "#3d444d",
          actorTextColor: "#e0e0e0",
          actorLineColor: "#6e7683",
          activationBkgColor: "#3d444d",
          activationBorderColor: "#6e7683",
          signalColor: "#6e7683",
          signalTextColor: "#e0e0e0",
          labelBoxBkgColor: "#1f1f20",
          labelBoxBorderColor: "#3d444d",
          labelTextColor: "#e0e0e0",
          loopTextColor: "#e0e0e0",
          messageTextColor: "#e0e0e0",
          noteBkg: "#252526",
          noteBorder: "#3d444d",
          noteTextColor: "#e0e0e0",
          sequenceNumberColor: "#6e7683",
          altBkg: "#252526",
          altBorder: "#3d444d",
          fontFamily: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
          fontSize: "12px",
        },
    flowchart: {
      htmlLabels: true,
      useMaxWidth: true,
      padding: 16,
      curve: "basis",
      nodeSpacing: 56,
      rankSpacing: 56,
    },
  });
};

// 轻量净化：ACP agent 输出可能包含 HTML — 剥 script/style、事件属性、javascript/data: URL
const sanitizeHtml = (input: string): string => {
  let html = input;
  html = html.replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "");
  html = html.replace(/<\s*style[\s\S]*?<\s*\/\s*style\s*>/gi, "");
  html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/(href|src)\s*=\s*(["'])\s*(javascript:[^"']*)\2/gi, '$1=""');
  html = html.replace(/(href|src)\s*=\s*(["'])\s*(data:[^"']*)\2/gi, '$1=""');
  return html;
};

const ACP_MD_CSS = `
.acp-md {
  color: var(--aura-text, #e0e0e0);
  font-size: 0.96em;
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
}
.acp-md p,
.acp-md h1, .acp-md h2, .acp-md h3, .acp-md h4, .acp-md h5, .acp-md h6,
.acp-md li, .acp-md blockquote, .acp-md pre, .acp-md code,
.acp-md table, .acp-md hr {
  max-width: fit-content;
}
.acp-md h1, .acp-md h2, .acp-md h3, .acp-md h4, .acp-md h5, .acp-md h6 {
  font-weight: 700;
  line-height: 1.3;
  margin: 0.8em 0 0.35em;
  color: var(--aura-text, #e0e0e0);
}
.acp-md h1 { font-size: 1.35em; border-bottom: 1px solid var(--aura-border, #3a3a3a); padding-bottom: 0.2em; }
.acp-md h2 { font-size: 1.15em; }
.acp-md h3 { font-size: 0.96em; }
.acp-md p { margin: 0 0 0.55em; }
.acp-md strong { font-weight: 700; color: var(--aura-text, #e0e0e0); }
.acp-md em { font-style: italic; }
.acp-md ul, .acp-md ol { padding-left: 1.25em; margin: 0.15em 0 0.55em; }
.acp-md li { margin: 0.15em 0; }
.acp-md code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.83em;
  background: var(--aura-input-bg, #161616);
  border: 1px solid var(--aura-border, #2e2e2e);
  padding: 1px 4px;
  border-radius: 4px;
  color: var(--aura-text, #e0e0e0);
}
.acp-md pre {
  background: var(--aura-input-bg, #161616);
  border: 1px solid var(--aura-border, #2e2e2e);
  border-radius: 8px;
  padding: 8px 10px;
  overflow-x: auto;
  margin: 0.4em 0 0.7em;
}
.acp-md pre code {
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 0.83em;
  color: var(--aura-text, #e0e0e0);
}
.acp-md a {
  color: var(--aura-accent, #4ea8de);
  text-decoration: none;
}
.acp-md a:hover { text-decoration: underline; }
.acp-md table {
  border-collapse: collapse;
  margin: 0.4em 0 0.7em;
  font-size: 0.83em;
}
.acp-md th, .acp-md td {
  border: 1px solid var(--aura-border, #333333);
  padding: 3px 8px;
  text-align: left;
}
.acp-md th {
  background: var(--aura-input-bg, #202024);
  font-weight: 600;
  color: var(--aura-text, #e0e0e0);
}
.acp-md tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
.acp-md hr {
  border: 0;
  border-top: 1px solid var(--aura-border, #333333);
  margin: 0.7em 0;
}
.acp-md blockquote {
  border-left: 2px solid #007acc;
  padding-left: 0.8em;
  margin: 0.4em 0 0.7em;
  color: var(--aura-text-muted, #888888);
}
`;

export const AcpMarkdown: React.FC<AcpMarkdownProps> = ({ content }) => {
  const mermaidCounterRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // 流程图缩放：[−] 缩小 / [⤢] 恢复自适应 / [+] 放大（基于 viewBox 原始宽度等比缩放）
  const handleMermaidZoom = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('[data-mmd]') as HTMLElement | null;
    if (!btn) return;
    const act = btn.dataset.mmd;
    const fig = btn.closest('.acp-mmd-figure') as HTMLElement | null;
    const slot = fig?.querySelector('.acp-md-mermaid') as HTMLElement | null;
    const svg = slot?.querySelector('svg') as SVGSVGElement | null;
    if (!fig || !slot || !svg) return;
    e.preventDefault();
    e.stopPropagation();
    const vbWidth = svg.viewBox?.baseVal?.width;
    const base = vbWidth && vbWidth > 0 ? vbWidth : svg.getBoundingClientRect().width || 600;
    const cur = slot.dataset.zoom
      ? parseFloat(slot.dataset.zoom)
      : svg.getBoundingClientRect().width / base;
    if (act === "zfit") {
      slot.classList.remove("zoomed");
      slot.style.removeProperty("--mmd-zoom-w");
      delete slot.dataset.zoom;
      return;
    }
    const factor = act === "zin" ? 1.25 : 0.8;
    const next = Math.min(3, Math.max(0.35, cur * factor));
    slot.dataset.zoom = String(next);
    slot.style.setProperty("--mmd-zoom-w", `${Math.round(base * next)}px`);
    slot.classList.add("zoomed");
  };

  const handleLinkClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // 1. 如果用户按住 Ctrl（且未按 Cmd），完全保持 macOS 原生行为（弹出右键复制/粘贴菜单），不予拦截
    if (e.ctrlKey && !e.metaKey) {
      return;
    }

    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (!href) return;

    // 2. 用户明确要求：“我需要的是使用cmd点击打开 ctrl点击保持不变”
    // 如果没有按住 Cmd 键，不拦截点击，直接 return
    if (!e.metaKey) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // 3. 外部链接（http/https/mailto） — 浏览器打开
    if (/^(https?|mailto):\/\//i.test(href)) {
      if (isTauri) {
        try {
          await openUrl(href);
          return;
        } catch (err) {
          console.warn('[AcpMarkdown] openUrl failed, falling back to window.open', err);
        }
      }
      // Web 模式或降级：同步直接触发 window.open（避免在异步 Promise 中被浏览器安全策略静默阻止弹窗）
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    // 4. 本地路径（file:// / 绝对 / 相对 / 带常见代码扩展名）— 本应用内打开
    if (
      href.startsWith('file://') ||
      href.startsWith('./') ||
      href.startsWith('../') ||
      href.startsWith('/') ||
      /\.(ts|tsx|js|jsx|mjs|json|md|py|rs|go|java|c|cc|cpp|cxx|h|hpp|css|scss|html?|sh|zsh|yaml|toml|yml|png|jpg|jpeg|gif|svg|pdf|ino|swift|kt|rb|php|vue|svelte|lock|ini|gradle|env)/i.test(href)
    ) {
      const clean = href.startsWith('file://') ? href.replace(/^file:\/\//, '') : href;
      window.dispatchEvent(new CustomEvent('aura:open-file-path', { detail: clean }));
    }
    // 其他情况：忽略（# 锚链等）
  };

  const { html, mermaidBlocks } = useMemo(() => {
    let safe = sanitizeHtml(String(content ?? ""));
    // 自动将对话中裸露的 file:///... 转换为可点击的 Markdown 链接
    safe = safe.replace(/(?<!\]\()(file:\/\/[^\s<>'"]+)/g, '[$1]($1)');

    // 拆出 ```mermaid … ``` 块，分别渲染成占位 div + 记下源码，事后逐一 mermaid.render
    const fence = /```mermaid\s*([\s\S]*?)```/g;
    const blocks: string[] = [];
    let cursor = 0;
    let out = "";
    let match: RegExpExecArray | null;
    while ((match = fence.exec(safe)) !== null) {
      out += marked.parse(safe.slice(cursor, match.index) || "", { async: false }) as string;
      blocks.push(match[1].trim());
      cursor = fence.lastIndex;
      out += `<div class="acp-md-mermaid" data-marker="${blocks.length - 1}"></div>`;
    }
    out += marked.parse(safe.slice(cursor) || "", { async: false }) as string;

    return {
      html: sanitizeHtml(out),
      mermaidBlocks: blocks,
    };
  }, [content]);

  // 渲染后挂载/更新 mermaid 图表（注入 SVG）+ 清理旧的 Mermaid 初始化
  useEffect(() => {
    // 每次渲染前按当前主题重新初始化 mermaid，确保 SVG 配色与主题匹配
    initMermaid();
    if (!rootRef.current) return;
    const root = rootRef.current;
    const slots = root.querySelectorAll<HTMLElement>(".acp-md-mermaid[data-marker]");
    const jobs: Promise<void>[] = [];

    mermaidCounterRef.current = 0;

    slots.forEach((slot) => {
      const idx = Number(slot.dataset.marker ?? "");
      const code = mermaidBlocks[idx];
      if (!code) {
        slot.innerHTML = `<pre>${String(code).replace(/</g, "&lt;")}</pre>`;
        return;
      }
      const id = `acp-mmd-${mermaidCounterRef.current++}-${Date.now()}`;
      jobs.push(
        mermaid.render(id, code).then(
          ({ svg }) => {
            slot.innerHTML = svg;
            slot.classList.add("is-rendered");
            // 包一层 figure 容器，承载不随横向滚动漂移的缩放按钮组
            let fig = slot.parentElement as HTMLElement | null;
            if (!fig || !fig.classList.contains("acp-mmd-figure")) {
              const wrap = document.createElement("div");
              wrap.className = "acp-mmd-figure";
              slot.replaceWith(wrap);
              wrap.appendChild(slot);
              fig = wrap;
            }
            fig.querySelector(".acp-mmd-zoombar")?.remove();
            const bar = document.createElement("div");
            bar.className = "acp-mmd-zoombar";
            bar.innerHTML =
              '<button type="button" data-mmd="zout" title="缩小">−</button>' +
              '<button type="button" data-mmd="zfit" title="恢复自适应">⤢</button>' +
              '<button type="button" data-mmd="zin" title="放大">+</button>';
            fig.appendChild(bar);
          },
          (err) => {
            console.warn("[AcpMarkdown] mermaid render failed", err);
            slot.innerHTML = `<pre>${String(code).replace(/</g, "&lt;")}</pre>`;
            slot.classList.add("has-error");
          }
        )
      );
    });

    Promise.allSettled(jobs).catch(() => {});
  }, [html, mermaidBlocks]);

  return (
    <>
      <style>{ACP_MD_CSS}</style>
      <style>{`
        .acp-md-mermaid {
          margin: 8px 0;
          max-width: 100%;
          overflow-x: auto;
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 4px 2px;
          text-align: left;
          line-height: 0;
        }
        .acp-md-mermaid svg {
          /* 宽图等比缩放到面板宽；纵向长图等比缩放到视口高；窄图按原始尺寸；均水平居中 */
          display: block !important;
          width: auto !important;
          max-width: 100% !important;
          max-height: 55vh !important;
          min-width: 0 !important;
          height: auto !important;
          margin: 0 auto !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        }
        /* 流程图缩放：figure 容器承载悬浮按钮，slot 负责横向滚动 */
        .acp-mmd-figure {
          position: relative;
          margin: 8px 0;
        }
        .acp-mmd-figure .acp-md-mermaid {
          margin: 0;
        }
        .acp-mmd-zoombar {
          position: absolute;
          top: 6px;
          right: 6px;
          z-index: 6;
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 3px;
          border-radius: 9px;
          border: 1px solid var(--aura-border, #454545);
          background: var(--aura-card-bg, #252526);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          line-height: 1;
        }
        .acp-mmd-figure:hover .acp-mmd-zoombar,
        .acp-mmd-figure:focus-within .acp-mmd-zoombar {
          opacity: 1;
          pointer-events: auto;
        }
        .acp-mmd-zoombar button {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--aura-text-muted, #9ca3af);
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .acp-mmd-zoombar button:hover {
          color: var(--aura-accent, #007acc);
          background: var(--aura-input-bg, #1e1e1e);
        }
        /* 缩放态：解除 max 约束，按固定像素宽渲染，横向滚动 */
        .acp-md-mermaid.zoomed svg {
          width: var(--mmd-zoom-w, 100%) !important;
          max-width: none !important;
          max-height: none !important;
          min-width: 0 !important;
        }
        .acp-md-mermaid .node rect,
        .acp-md-mermaid .node polygon,
        .acp-md-mermaid .node circle {
          rx: 12px !important;
          ry: 12px !important;
          stroke-width: 1.5px !important;
        }
        .acp-md-mermaid .cluster rect {
          rx: 14px !important;
          ry: 14px !important;
        }
        /* Mermaid node/cluster backgrounds — fully theme-aligned */
        .acp-md-mermaid svg .node rect,
        .acp-md-mermaid svg .node polygon,
        .acp-md-mermaid svg .node circle,
        .acp-md-mermaid svg .node ellipse,
        .acp-md-mermaid svg .node path,
        .acp-md-mermaid svg .cluster rect,
        .acp-md-mermaid svg .cluster polygon,
        .acp-md-mermaid svg .cluster circle,
        .acp-md-mermaid svg .cluster ellipse {
          fill: var(--aura-card-bg, #252526) !important;
          stroke: var(--aura-border, #454545) !important;
          stroke-width: 1.4px !important;
          filter: none !important;
        }
        .acp-md-mermaid svg .node rect,
        .acp-md-mermaid svg .cluster rect {
          rx: 12px !important;
          ry: 12px !important;
        }
        /* Mermaid edges */
        .acp-md-mermaid svg .edgePath .path,
        .acp-md-mermaid svg .edgePath path,
        .acp-md-mermaid svg .edgePath path.flowchart-link,
        .acp-md-mermaid svg .edgePath .flowchart-link {
          stroke: #6366f1 !important;
          fill: none !important;
          stroke-width: 1.8px !important;
        }
        /* Mermaid sequence diagrams — direct class overrides */
        .acp-md-mermaid svg .actor,
        .acp-md-mermaid svg .actor rect {
          fill: var(--aura-card-bg, #252526) !important;
          stroke: var(--aura-border, #454545) !important;
          stroke-width: 1.3px !important;
          rx: 8px !important;
          ry: 8px !important;
        }
        .acp-md-mermaid svg .actor-line,
        .acp-md-mermaid svg .messageLine0,
        .acp-md-mermaid svg .messageLine1,
        .acp-md-mermaid svg .actor-line line {
          stroke: var(--aura-border, #454545) !important;
          stroke-width: 1.3px !important;
        }
        .acp-md-mermaid svg .actorLabel,
        .acp-md-mermaid svg .actorLabel text,
        .acp-md-mermaid svg text.actorLabel,
        .acp-md-mermaid svg text {
          fill: var(--aura-text, #dbe2ec) !important;
        }
        .acp-md-mermaid svg .note,
        .acp-md-mermaid svg .note-rect,
        .acp-md-mermaid svg .note rect {
          fill: var(--aura-card-bg, #252526) !important;
          stroke: var(--aura-border, #454545) !important;
          stroke-width: 1.3px !important;
          rx: 8px !important;
          ry: 8px !important;
        }
        .acp-md-mermaid svg .noteText,
        .acp-md-mermaid svg .noteText text,
        .acp-md-mermaid svg .labelText,
        .acp-md-mermaid svg text.labelText {
          fill: var(--aura-text, #dbe2ec) !important;
        }
        .acp-md-mermaid svg .messageText,
        .acp-md-mermaid svg .messageText text,
        .acp-md-mermaid svg text.messageText {
          fill: var(--aura-text, #dbe2ec) !important;
        }
        .acp-md-mermaid svg .activation,
        .acp-md-mermaid svg .activation rect {
          fill: var(--aura-text-muted, #6b7280) !important;
          stroke: none !important;
        }
        .acp-md-mermaid svg .labelBox,
        .acp-md-mermaid svg .labelBox rect {
          fill: var(--aura-card-bg, #252526) !important;
          stroke: var(--aura-border, #454545) !important;
          stroke-width: 1px !important;
          rx: 6px !important;
          ry: 6px !important;
        }
        .acp-md-mermaid svg .sequenceNumber,
        .acp-md-mermaid svg text.sequenceNumber {
          fill: var(--aura-text-muted, #6b7280) !important;
          font-size: 10px !important;
        }
        .acp-md-mermaid svg .arrowheadPath,
        .acp-md-mermaid svg marker path,
        .acp-md-mermaid svg marker polygon,
        .acp-md-mermaid svg marker circle,
        .acp-md-mermaid svg .marker {
          fill: #6366f1 !important;
        }
        .acp-md-mermaid svg marker path[style] {
          fill: #6366f1 !important;
        }
        .acp-md-mermaid svg .messageLine0,
        .acp-md-mermaid svg .messageLine1 {
          fill: none;
        }
        /* Mermaid labels — nodes, edges, subgraphs */
        .acp-md-mermaid svg .label,
        .acp-md-mermaid svg .label-title,
        .acp-md-mermaid svg .edgeLabel,
        .acp-md-mermaid svg .nodeLabel,
        .acp-md-mermaid svg .label-text,
        .acp-md-mermaid svg text,
        .acp-md-mermaid svg tspan {
          fill: var(--aura-text, #e0e0e0) !important;
          color: var(--aura-text, #e0e0e0) !important;
        }
        .acp-md-mermaid svg .labelBox,
        .acp-md-mermaid svg .edgeLabel foreignObject div,
        .acp-md-mermaid svg .edgeLabel rect,
        .acp-md-mermaid svg .edgeLabel span,
        .acp-md-mermaid svg .edgeLabel p,
        .acp-md-mermaid svg .edgeLabel div {
          background: transparent !important;
          background-color: transparent !important;
          color: var(--aura-text, #e0e0e0) !important;
          fill: var(--aura-text, #e0e0e0) !important;
          border: 0 !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .acp-md-mermaid svg .label foreignObject div {
          background: transparent !important;
          color: var(--aura-text, #e0e0e0) !important;
        }
        /* subtle focus */
        .acp-md-mermaid svg .node:hover rect,
        .acp-md-mermaid svg .node:hover polygon {
          stroke: var(--aura-accent, #007acc) !important;
          filter: drop-shadow(0 0 6px rgba(0,122,204,0.18)) !important;
        }
        .acp-md-mermaid:not(.is-rendered) {
          color: #6b7280;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
          font-size: 11px;
          min-height: 40px;
        }
        .acp-md-mermaid svg {
          width: auto !important;
          max-width: 100%;
          height: auto !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        }
      `}</style>
      <div ref={rootRef} className="acp-md" onClick={(e) => { handleMermaidZoom(e); void handleLinkClick(e); }} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
};
