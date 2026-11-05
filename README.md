<div align="center">

# ✨ Aura IDE

**A Minimalist, Modern macOS & Cross-Platform Desktop Coding Workspace**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Tauri v2](https://img.shields.io/badge/Built%20with-Tauri%20v2-24C8DB.svg?logo=tauri)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Backend-Rust-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![Monaco Editor](https://img.shields.io/badge/Editor-Monaco-007ACC.svg?logo=visualstudiocode)](https://microsoft.github.io/monaco-editor/)
[![Vim Mode](https://img.shields.io/badge/Keybinding-Vim%20Mode-green.svg?logo=vim)](https://www.vim.org/)

[English](README.md) • [**简体中文文档**](docs/INSTALL_USAGE_ZH.md)

</div>

---

## 📖 Overview

**Aura IDE** is a high-performance desktop coding environment tailored for macOS and modern workstations. Designed with an ultra-lightweight memory footprint (30MB ~ 80MB) and near-instantaneous startup, Aura merges the power of **VS Code's Monaco Editor**, **Vim modal editing**, **native VS Code SCM history swimlanes**, and **POSIX PTY terminals** alongside **OpenCode CLI agent pairing**.

```text
+---------------------+---------------------------------------------------------+
|                     | [Tab 1] [Tab 2] ...                            [🤖] [⚙️]|
|                     |---------------------------------------------------------|
|                     |                                                         |
|     Window 1        |                       Window 2                          |
|  (Left File Tree    |                 (Top-Right Editor)                      |
|   & Git Swimlanes)  |            [Monaco + Vim Mode + DiffEditor]             |
|   (Full Height)     |                                                         |
|                     +---------------------------------------------------------+
|                     | [Terminal 1] [OpenCode 1] [+]                           |
|                     |---------------------------------------------------------|
|                     |                       Window 3                          |
|                     |                (Bottom-Right Terminal)                  |
|                     |          [Native PTY / OpenCode CLI / Process Kill]     |
+---------------------+---------------------------------------------------------+
```

---

## ⚡ Key Highlights

- **Window 1 (File Explorer & Git SCM)**:
  - Full-height frameless sidebar with smooth width resizing (180px–600px);
  - **Mouse Multi-Selection**: supports `Cmd`/`Ctrl` toggle, `Shift` range selection, and `Esc` to deselect all;
  - Full keyboard Vim-like navigation (`j`/`k`, `o`, `a` to create, `r` to rename, `d` to delete);
  - **Native VS Code SCM Swimlanes**: Ported from VS Code's official `scmHistory.ts`, with branch-aligned commit dots and continuous downward swimlanes on expanded details;
  - **Sub-Second Git Status**: Real-time 1.5s background polling and instant save-time refresh, badge strictly reflects uncommitted changes (`> 0`).

- **Window 2 (Editor & Diff Workspace)**:
  - VS Code Monaco Editor core with rich language highlighting;
  - Strict dual-mode Vim navigation (Block cursor Normal mode with `ww` save and `qq` close; Line cursor Insert mode);
  - **Side-by-side Monaco DiffEditor**: Click any changed file in Git Changes or Graph history to view full diffs instantly;
  - **Markdown Preview Enhanced**: Built-in collapsible table of contents (TOC outline) and Markmap mind mapping.

- **Window 3 (Terminal & AI Dock)**:
  - Native POSIX PTY shell connected directly to `/bin/zsh -l`, evaluating local `~/.zshrc` themes and powerline icons without distortion;
  - **OpenCode CLI Assistant**: Single-click or `Shift+Cmd+M` launches real interactive `opencode` pairing sessions;
  - **Thorough Process Cleanup**: Closing a terminal tab recursively kills child processes via `libc::kill(-pid, SIGKILL)` and `pkill -9 -P`, freeing all RAM & CPU immediately;
  - Drag-and-drop files or folders from Window 1 directly into the terminal to paste absolute paths.

- **Global Experience & macOS Polish**:
  - Full-width frameless dragging with double-click maximize/unmaximize;
  - Dual `Cmd+qq` exit gate (prevents accidental quits);
  - Minimalist 3-dot split handles (`w-0.5 h-0.5`);
  - 5 high-contrast themes (`VS Code Dark Modern`, `Gruvbox Dark`, `One Dark Pro`, `Nord`, `Cyberpunk Neon`) with dynamic syntax and shell styling.

---

## 🚀 Quick Start

### Installation

For macOS users, download prebuilt binaries from the [Releases](https://github.com/your-username/aura/releases) page:
- `Aura_<version>_aarch64.dmg` (Apple Silicon M1/M2/M3/M4)
- `Aura_<version>_x64.dmg` (Intel Macs)

> **First Run Note (macOS Gatekeeper)**: If macOS displays *"App cannot be opened because developer cannot be verified"*, right-click `Aura.app` and choose **Open**, or run `xattr -cr /Applications/Aura.app` in Terminal.

For complete installation and usage instructions in Chinese, please refer to:
- 📖 [**中文安装使用指南 (Chinese Guide)**](docs/INSTALL_USAGE_ZH.md)

---

## ⌨️ Essential Keybindings

| Keybinding | Action |
|---|---|
| **`Ctrl+h`** | Focus **Window 1** (File Tree & Git) |
| **`Ctrl+k`** | Focus **Window 2** (Code Editor) |
| **`Ctrl+l`** | Focus **Window 3** (Terminal / OpenCode Dock) |
| **`Cmd+b`** | Toggle Left Sidebar Visibility |
| **`Cmd+d`** | Spawn a new native Terminal (zsh) |
| **`Shift+Cmd+m`** | Spawn a native OpenCode AI session |
| **`Cmd+w`** | Close active editor tab or terminal pane |
| **`Cmd+qq`** | Double-tap lowercase `q` within 1.2s to quit Aura safely |
| **`Cmd+,`** | Open Preferences (Themes, Language, Settings) |
| **`Cmd+=/+` / `Cmd+-/_`** | Zoom active editor or terminal font size |
| **`Esc`** | Deselect all files in Window 1 / dismiss context menus |

---

## 🛠️ Development & Building

```bash
# Prerequisites: Node.js 18+, pnpm, Rust toolchain
git clone https://github.com/your-username/aura.git
cd aura

# Install frontend dependencies
pnpm install

# Start development mode with HMR and Rust IPC
pnpm tauri:dev

# Build standalone desktop distribution (.dmg and .app)
pnpm tauri:build
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
