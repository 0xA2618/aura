import React from 'react';

export const PLUGIN_LOGOS: Record<string, React.ReactNode> = {
  'ms-python.python': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <defs>
        <linearGradient id="pyA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#387EB8" />
          <stop offset="100%" stopColor="#366994" />
        </linearGradient>
        <linearGradient id="pyB" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE873" />
          <stop offset="100%" stopColor="#FFD43B" />
        </linearGradient>
      </defs>
      <path fill="url(#pyA)" d="M63.5 12c-27.4 0-25.7 11.9-25.7 11.9l.03 12.3h26.2v3.7H27.3s-17.1-1.9-17.1 25.5 14.9 26.4 14.9 26.4h8.9v-12.4s-.5-14.8 14.6-14.8h25.2s14.1.2 14.1-13.8V26.2S89.5 12 63.5 12zm-14.2 8.1c2.6 0 4.8 2.1 4.8 4.8s-2.1 4.8-4.8 4.8-4.8-2.1-4.8-4.8 2.2-4.8 4.8-4.8z" />
      <path fill="url(#pyB)" d="M64.5 116c27.4 0 25.7-11.9 25.7-11.9l-.03-12.3H64v-3.7h36.7s17.1 1.9 17.1-25.5-14.9-26.4-14.9-26.4h-8.9v12.4s.5 14.8-14.6 14.8H54.1s-14.1-.2-14.1 13.8v22.6s-1.6 14.2 24.5 14.2zm14.2-8.1c-2.6 0-4.8-2.1-4.8-4.8s2.1-4.8 4.8-4.8 4.8 2.1 4.8 4.8-2.2 4.8-4.8 4.8z" />
    </svg>
  ),
  'esbenp.prettier-vscode': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <path fill="#1A2B34" d="M30 18h68l20 20v72H10V38l20-20z" rx="8" />
      <path fill="#EA5E5E" d="M32 40h20v20H32z" />
      <path fill="#F7B941" d="M56 40h20v20H56z" />
      <path fill="#56B6C2" d="M80 40h20v20H80z" />
      <path fill="#98C379" d="M32 64h20v20H32z" />
      <path fill="#C678DD" d="M56 64h20v20H56z" />
      <path fill="#61AFEF" d="M80 64h20v20H80z" />
      <path fill="#E5C07B" d="M56 88h20v20H56z" />
    </svg>
  ),
  'dbaeumer.vscode-eslint': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <path fill="#4B32C3" d="M64 10l52 30v48l-52 30-52-30V40z" />
      <path fill="#fff" d="M42 42h44v10H42zm0 18h36v10H42zm0 18h44v10H42z" />
    </svg>
  ),
  'rust-lang.rust-analyzer': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <circle cx="64" cy="64" r="54" fill="#000" />
      <circle cx="64" cy="64" r="46" fill="#CE412B" />
      <path fill="#fff" d="M64 24a40 40 0 1 0 40 40A40 40 0 0 0 64 24zm16 56h-8l-8-12h-8v12h-8V48h20a14 14 0 0 1 4 27zm-16-20h6a6 6 0 0 0 0-12h-6z" />
    </svg>
  ),
  'eamodio.gitlens': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <rect width="128" height="128" rx="28" fill="#182A3A" />
      <circle cx="64" cy="64" r="38" fill="none" stroke="#25C1FF" strokeWidth="8" />
      <circle cx="64" cy="64" r="20" fill="#25C1FF" />
      <circle cx="48" cy="48" r="6" fill="#fff" />
    </svg>
  ),
  'bradlc.vscode-tailwindcss': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <rect width="128" height="128" rx="28" fill="#0F172A" />
      <path fill="#38BDF8" d="M42 64c5-10 12-14 20-13 11 2 15 10 21 12 7 2 14-2 19-11-5 10-12 14-20 13-11-2-15-10-21-12-7-2-14 2-19 11zm-16 22c5-10 12-14 20-13 11 2 15 10 21 12 7 2 14-2 19-11-5 10-12 14-20 13-11-2-15-10-21-12-7-2-14 2-19 11z" />
    </svg>
  ),
  'vscodevim.vim': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <rect width="128" height="128" rx="28" fill="#019833" />
      <path fill="#fff" d="M28 28h26l32 50 14-22H86v-8h26v8l-20 32 18 12H86v-8h-6l-16-10-14 22v-4l-8-6V44L30 36v-8z" />
    </svg>
  ),
  'opencode-assistant': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <rect width="128" height="128" rx="28" fill="#0A0F1D" />
      <circle cx="64" cy="64" r="42" fill="none" stroke="#6366F1" strokeWidth="6" />
      <path fill="#00E5FF" d="M64 36l18 36H46z" />
      <circle cx="64" cy="84" r="6" fill="#A855F7" />
    </svg>
  ),
  'golang.go': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <path fill="#00ADD8" d="M12 64c0-14 8-22 20-22 8 0 14 4 18 10l-8 6c-3-4-6-6-10-6-7 0-11 5-11 12s4 12 11 12c4 0 7-2 9-5H26v-9h24v16c-5 6-11 9-18 9-12 0-20-9-20-23zm52 0c0-14 10-23 22-23s22 9 22 23-10 23-22 23-22-9-22-23zm34 0c0-9-5-14-12-14s-12 5-12 14 5 14 12 14 12-5 12-14z" />
      <path fill="#00ADD8" d="M96 38l20-10v8l-15 8 15 8v8l-20-10z" />
    </svg>
  ),
  'shd101wyy.markdown-preview-enhanced': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <defs>
        <linearGradient id="mpeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF2A6D" />
          <stop offset="50%" stopColor="#05D9E8" />
          <stop offset="100%" stopColor="#D1F7FF" />
        </linearGradient>
      </defs>
      <path fill="#1E1E24" d="M14 24h100a10 10 0 0 1 10 10v60a10 10 0 0 1-10 10H14a10 10 0 0 1-10-10V34a10 10 0 0 1 10-10z" />
      <path fill="url(#mpeGrad)" d="M30 40h12l14 24 14-24h12v48H70V60L56 82 42 60v28H30z" />
      <path fill="#05D9E8" d="M88 56h24v8H88zm0 16h18v8H88z" />
    </svg>
  ),
  'markmap': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <rect width="128" height="128" rx="28" fill="#FFFBE6" />
      <circle cx="40" cy="64" r="24" fill="#FADB14" stroke="#D4B106" strokeWidth="6" />
      <path d="M60 64h24m0 0l20-22m-20 22l20 22" fill="none" stroke="#D4B106" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="104" cy="42" r="8" fill="#FA8C16" />
      <circle cx="104" cy="86" r="8" fill="#52C41A" />
    </svg>
  ),
  'sst.opencode': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <rect width="128" height="128" rx="20" fill="#18181B" />
      <rect x="28" y="28" width="72" height="72" rx="14" fill="#27272A" stroke="#3F3F46" strokeWidth="6" />
      <rect x="46" y="44" width="36" height="40" rx="6" fill="#F4F4F5" />
    </svg>
  ),
  'tomoki1207.pdf': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <circle cx="64" cy="64" r="54" fill="#EA4335" />
      <path fill="#fff" d="M40 38h48v52H40z" opacity="0.2" />
      <path fill="#fff" d="M46 44h36v40H46z" opacity="0.3" />
      <path fill="#fff" d="M52 50h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H52a4 4 0 0 1-4-4V54a4 4 0 0 1 4-4zm4 8v16h16V58H56z" />
      <text x="64" y="96" fill="#fff" fontSize="18" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">PDF</text>
    </svg>
  ),
  'ms-azuretools.vscode-docker': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <rect width="128" height="128" rx="28" fill="#1D63ED" />
      <path fill="#fff" d="M34 56h12v10H34zm16 0h12v10H50zm16 0h12v10H66zm-32 14h12v10H34zm16 0h12v10H50zm16 0h12v10H66zm16 0h12v10H82zM98 64c-2-8-8-12-16-12h-4v28c-4 12-16 16-34 16-18 0-32-6-34-22 0 16 14 26 36 26 26 0 46-12 50-32 2 0 8-2 10-6-4-2-6-4-8-8z" />
    </svg>
  ),
  'github.copilot': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <rect width="128" height="128" rx="28" fill="#0D1117" />
      <path fill="#fff" d="M64 28c-22 0-40 18-40 40 0 14 7 26 18 33v-10c-6-5-10-13-10-23 0-16 13-30 32-30s32 14 32 30c0 10-4 18-10 23v10c11-7 18-19 18-33 0-22-18-40-40-40z" />
      <circle cx="50" cy="68" r="6" fill="#3B82F6" />
      <circle cx="78" cy="68" r="6" fill="#3B82F6" />
    </svg>
  ),
  'pkief.material-icon-theme': (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      <rect width="128" height="128" rx="28" fill="#212121" />
      <path fill="#42A5F5" d="M24 36h32l12 12h36v52H24z" />
      <path fill="#90CAF9" d="M28 48h72v44H28z" opacity="0.6" />
    </svg>
  ),
};
