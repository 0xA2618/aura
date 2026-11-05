import React, { useMemo } from 'react';
import { marked } from 'marked';
import { openUrl } from '@tauri-apps/plugin-opener';

interface MarkdownPreviewEnhancedProps {
  content: string;
  currentFilePath?: string;
  workspaceDir?: string;
  onOpenFileByPath?: (path: string) => void;
  className?: string;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

export const MarkdownPreviewEnhanced: React.FC<MarkdownPreviewEnhancedProps> = ({
  content,
  currentFilePath,
  workspaceDir,
  onOpenFileByPath,
  className = '',
}) => {
  const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;

    const href = target.getAttribute('href');
    if (!href) return;

    e.preventDefault();
    e.stopPropagation();

    if (href.startsWith('#')) {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
      try {
        await openUrl(href);
      } catch (err) {
        console.warn('Failed to openUrl with tauri-plugin-opener, falling back to window.open', err);
        window.open(href, '_blank');
      }
      return;
    }

    if (onOpenFileByPath) {
      let resolved = href;
      if (href.startsWith('/')) {
        resolved = href;
      } else {
        const baseDir = currentFilePath
          ? currentFilePath.split('/').slice(0, -1).join('/')
          : workspaceDir || '';
        resolved = `${baseDir}/${href}`.replace(/\/+/g, '/');
      }

      const parts = resolved.split('/');
      const cleanParts: string[] = [];
      for (const p of parts) {
        if (p === '.' || !p) continue;
        if (p === '..') cleanParts.pop();
        else cleanParts.push(p);
      }
      const normalized = (resolved.startsWith('/') ? '/' : '') + cleanParts.join('/');
      onOpenFileByPath(normalized);
    }
  };

  const html = useMemo(() => {
    try {
      const renderer = new marked.Renderer();
      let headingIndex = 0;
      renderer.heading = ({ tokens, depth }: { tokens: any[]; depth: number }) => {
        const text = tokens.map((t: any) => t.raw || t.text || '').join('');
        const id = `heading-${headingIndex++}`;
        return `<h${depth} id="${id}" data-heading-index="${headingIndex - 1}">${text}</h${depth}>`;
      };

      const parsed = marked.parse(content || '', { renderer }) as string;
      const withCheckboxes = parsed
        .replace(
          /<li>\s*\[x\]\s*/gi,
          '<li class="task-list-item checked"><span class="mpe-checkbox checked"><svg viewBox="0 0 16 16" width="13" height="13" fill="none"><rect width="16" height="16" rx="3" fill="#1890ff"/><path d="M4 8l3 3 5-6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
        )
        .replace(
          /<li>\s*\[ \]\s*/gi,
          '<li class="task-list-item"><span class="mpe-checkbox"><svg viewBox="0 0 16 16" width="13" height="13" fill="none"><rect x="1" y="1" width="14" height="14" rx="3" stroke="#888" stroke-width="1.8" fill="transparent"/></svg></span>'
        );

      return withCheckboxes;
    } catch (e) {
      console.error(e);
      return content;
    }
  }, [content]);

  return (
    <div className={`mpe-markdown-body ${className}`}>
      <style>{`
        .mpe-markdown-body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 14.5px;
          line-height: 1.7;
          word-wrap: break-word;
          color: var(--aura-text);
        }

        .mpe-markdown-body h1 {
          font-size: 1.9em;
          font-weight: 700;
          margin-top: 1.2em;
          margin-bottom: 0.6em;
          padding-bottom: 0.3em;
          border-bottom: 1px solid var(--aura-border);
          color: var(--aura-text);
        }

        .mpe-markdown-body h2 {
          font-size: 1.5em;
          font-weight: 700;
          margin-top: 1.1em;
          margin-bottom: 0.5em;
          padding-bottom: 0.25em;
          border-bottom: 1px solid var(--aura-border);
          color: var(--aura-text);
        }

        .mpe-markdown-body h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin-top: 1em;
          margin-bottom: 0.4em;
          color: var(--aura-text);
        }

        .mpe-markdown-body p {
          margin-top: 0;
          margin-bottom: 0.8em;
          color: var(--aura-text);
        }

        .mpe-markdown-body strong {
          font-weight: 700;
          color: var(--aura-text);
        }

        /* 3-Level Nesting Bullets matching Image 1 */
        .mpe-markdown-body ul {
          padding-left: 1.8em;
          margin-top: 0.2em;
          margin-bottom: 0.6em;
          list-style-type: disc;
        }

        .mpe-markdown-body ul ul {
          padding-left: 1.6em;
          list-style-type: circle; /* Level 2: Hollow circle ○ */
        }

        .mpe-markdown-body ul ul ul {
          padding-left: 1.6em;
          list-style-type: square; /* Level 3: Solid square ■ */
        }

        .mpe-markdown-body li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }

        .mpe-markdown-body li.task-list-item {
          list-style-type: none;
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin-left: -1.6em;
        }

        .mpe-markdown-body .mpe-checkbox {
          display: inline-flex;
          align-items: center;
          margin-top: 5px;
          flex-shrink: 0;
        }

        /* Inline Code / Kbd Pills matching Image 1 */
        .mpe-markdown-body code:not(pre code) {
          padding: 0.15em 0.45em;
          margin: 0 0.15em;
          font-size: 88%;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
          background-color: rgba(125, 125, 125, 0.14);
          border: 1px solid rgba(125, 125, 125, 0.25);
          border-radius: 5px;
          color: var(--aura-text);
        }

        /* Preformatted Code Blocks */
        .mpe-markdown-body pre {
          padding: 14px 16px;
          overflow: auto;
          font-size: 88%;
          line-height: 1.55;
          background-color: var(--aura-card-bg, rgba(0, 0, 0, 0.04));
          border: 1px solid var(--aura-border);
          border-radius: 8px;
          margin-bottom: 1em;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        }

        .mpe-markdown-body pre code {
          background-color: transparent;
          border: 0;
          padding: 0;
          color: inherit;
        }

        .mpe-markdown-body hr {
          height: 1px;
          padding: 0;
          margin: 1.5em 0;
          background-color: var(--aura-border);
          border: 0;
        }

        .mpe-markdown-body blockquote {
          padding: 0 1em;
          color: var(--aura-text-muted);
          border-left: 0.25em solid #007acc;
          margin: 0 0 1em 0;
        }

        .mpe-markdown-body table {
          border-spacing: 0;
          border-collapse: collapse;
          margin-top: 0;
          margin-bottom: 1em;
          width: 100%;
          overflow: auto;
        }

        .mpe-markdown-body table th {
          font-weight: 600;
          padding: 6px 13px;
          border: 1px solid var(--aura-border);
          background-color: var(--aura-card-bg);
        }

        .mpe-markdown-body table td {
          padding: 6px 13px;
          border: 1px solid var(--aura-border);
        }

        .mpe-markdown-body a {
          color: #007acc;
          text-decoration: underline;
          cursor: pointer;
        }

        .mpe-markdown-body a:hover {
          color: #0098ff;
        }
      `}</style>
      <div onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};
