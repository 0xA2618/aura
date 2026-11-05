import React from 'react';

interface FileIconProps {
  fileName: string;
  isDirectory?: boolean;
  isOpen?: boolean;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({
  fileName,
  isDirectory = false,
  isOpen = false,
  className = 'w-3.5 h-3.5 flex-shrink-0',
}) => {
  if (isDirectory) {
    return null; // Folders are handled by chevrons and directory names
  }

  const lower = fileName.toLowerCase();

  // Git files: .gitignore, .gitmodules, etc.
  if (lower === '.gitignore' || lower.startsWith('.git')) {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" transform="rotate(45 8 8)" fill="#F05032" />
        <circle cx="8" cy="8" r="1.8" fill="#FFFFFF" />
        <circle cx="11.5" cy="8" r="1.2" fill="#FFFFFF" />
        <path d="M8 8l3.5 0" stroke="#FFFFFF" strokeWidth="1.2" />
      </svg>
    );
  }

  // Markdown files: AGENTS.md, todoList.md, *.md
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return (
      <svg viewBox="0 0 16 16" className={className}>
        <rect x="1" y="2" width="14" height="12" rx="1.5" fill="#42A5F5" />
        <path d="M3.5 11V5h2l1.5 2.5L8.5 5h2v6h-1.5V7.5L7.5 10h-1L5 7.5V11H3.5z" fill="#FFFFFF" />
        <path d="M12.5 8l-2 2.5h1.2v-3h1.6v3h1.2L12.5 8z" fill="#FFFFFF" />
      </svg>
    );
  }

  // HTML files: index.html
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none">
        <path d="M2.5 1h11l-1 12.5L8 15l-4.5-1.5L2.5 1z" fill="#E44D26" />
        <path d="M8 13.8l3.6-1.2.8-10.1H8v11.3z" fill="#F16529" />
        <path d="M5.2 6.5l.2 2.2H8V7.2H6.7l-.1-1.2H8V4.8H4.2l.4 4.5h3.4v-1.5H6.2l-.2-1.3z" fill="#FFFFFF" />
      </svg>
    );
  }

  // Vite config: vite.config.ts, vite.config.js
  if (lower.startsWith('vite.config.')) {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none">
        <path d="M14.5 2.5L8.5 14l-1-4.5L3 8l11.5-5.5z" fill="#BD34FE" />
        <path d="M14.5 2.5L8 9.5l-.5-3.5 7-3.5z" fill="#FFD427" />
      </svg>
    );
  }

  // TypeScript config or TS files: tsconfig.json, *.ts, *.tsx
  if (lower === 'tsconfig.json') {
    return (
      <svg viewBox="0 0 16 16" className={className}>
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#3178C6" />
        <text x="3" y="11.5" fill="#FFFFFF" fontSize="9" fontWeight="bold" fontFamily="monospace">TS</text>
      </svg>
    );
  }

  // JSON files: opencode.json, package.json
  if (lower.endsWith('.json') || lower.endsWith('.jsonc')) {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none">
        <text x="2" y="12" fill="#FBC02D" fontSize="13" fontWeight="bold" fontFamily="monospace">{'{'}</text>
        <text x="9" y="12" fill="#FBC02D" fontSize="13" fontWeight="bold" fontFamily="monospace">{'}'}</text>
      </svg>
    );
  }

  // YAML & Lock files: pnpm-lock.yaml, *.yaml, *.yml
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return (
      <svg viewBox="0 0 16 16" className={className}>
        <circle cx="8" cy="8" r="7" fill="#CB171E" />
        <text x="8" y="12" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">!</text>
      </svg>
    );
  }

  // JS config or JS files: postcss.config.js, tailwind.config.js, *.js
  if (lower.endsWith('.js') || lower.endsWith('.cjs') || lower.endsWith('.mjs')) {
    return (
      <svg viewBox="0 0 16 16" className={className}>
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#F7DF1E" />
        <text x="8" y="11.5" fill="#000000" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">JS</text>
      </svg>
    );
  }

  // TS files: *.ts, *.tsx
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) {
    return (
      <svg viewBox="0 0 16 16" className={className}>
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#3178C6" />
        <text x="8" y="11.5" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">TS</text>
      </svg>
    );
  }

  // Rust: *.rs
  if (lower.endsWith('.rs')) {
    return (
      <svg viewBox="0 0 16 16" className={className}>
        <circle cx="8" cy="8" r="6.5" fill="#CE412B" />
        <text x="8" y="11.5" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">R</text>
      </svg>
    );
  }

  // CSS: *.css, *.scss, *.less
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.less')) {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none">
        <path d="M2.5 1h11l-1 12.5L8 15l-4.5-1.5L2.5 1z" fill="#42A5F5" />
        <text x="8" y="11.5" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">#</text>
      </svg>
    );
  }

  // Python: *.py
  if (lower.endsWith('.py')) {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none">
        <circle cx="8" cy="8" r="6" fill="#387EB8" />
        <circle cx="10" cy="10" r="4" fill="#FFD43B" />
      </svg>
    );
  }

  if (lower.startsWith('.env')) {
    return (
      <svg viewBox="0 0 16 16" className={className}>
        <rect x="1" y="2" width="14" height="12" rx="2" fill="#EAB308" />
        <path d="M8 4v8M5 7h6" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (lower.startsWith('.')) {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none">
        <circle cx="8" cy="8" r="6" fill="#6B7280" />
        <circle cx="8" cy="8" r="2.5" fill="#FFFFFF" />
      </svg>
    );
  }

  // Default file fallback
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none">
      <path d="M3 2h7l3 3v9H3V2z" stroke="#9E9E9E" strokeWidth="1.2" fill="#252526" />
      <path d="M10 2v3h3" stroke="#9E9E9E" strokeWidth="1.2" />
    </svg>
  );
};
