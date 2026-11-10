<div align="center">

# ✨ Aura IDE

**A Minimalist, Modern macOS & Cross-Platform Desktop Coding Workspace**

[![Release](https://img.shields.io/github/v/release/0xA2618/aura?color=007ACC&logo=github)](https://github.com/0xA2618/aura/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Tauri v2](https://img.shields.io/badge/Built%20with-Tauri%20v2-24C8DB.svg?logo=tauri)](https://tauri.app)
[![Rust Backend](https://img.shields.io/badge/Backend-Rust-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![Monaco Editor](https://img.shields.io/badge/Editor-Monaco-007ACC.svg?logo=visualstudiocode)](https://microsoft.github.io/monaco-editor/)
[![Vim Mode](https://img.shields.io/badge/Keybinding-Vim%20Mode-green.svg?logo=vim)](https://www.vim.org/)

[English (README)](README.md) • [**简体中文文档 (Chinese Guide)**](docs/INSTALL_USAGE_ZH.md)

</div>

---

## 📖 Overview

**Aura IDE** is a high-performance desktop coding environment tailored for macOS and modern workstations. Designed with an ultra-lightweight memory footprint (30MB ~ 80MB) and near-instantaneous startup, Aura merges the power of **VS Code's Monaco Editor**, **Vim modal editing**, **native VS Code SCM history swimlanes**, and **POSIX PTY terminals** alongside **OpenCode CLI agent pairing**.

```text
+---------------------+---------------------------------------------------------------+
|  Window 1 (Sidebar) | TopBar: [Project] [🌿 branch]     [◫] [⬒] | [🤖] [🌿 Git] [⚙️]  |
|  [Dir] | [Session]  |---------------------------------------------------------------|
|  - File Explorer    |                       Window 2                                |
|  - Git Swimlanes    |                 (Top-Right Editor)                            |
|  - SCM Changes      |            [Monaco + Vim Mode + DiffEditor]                   |
|  -----------------  |                                                               |
|  - AI Sessions      +---------------------------------------------------------------+
|  - Project Groups   | [Terminal 1] [OpenCode 1] [+]                                 |
|  - Emerald Live Dot |---------------------------------------------------------------|
|  - 2-Step Removal   |                       Window 3                                |
|                     |                (Bottom-Right Terminal)                        |
|                     |          [Native PTY / OpenCode CLI / Process Kill]           |
+---------------------+---------------------------------------------------------------+
```

---

## ⚡ Key Highlights (v1.1.0)

### 🗂️ Window 1: Dual-Section Sidebar (`Dir` & `Session`)

Window 1 provides a unified, full-height left sidebar split into two interactive sections with a draggable divider:

#### 📁 `Dir` Section (Workspace Explorer & Git SCM)
- **Workspace File Explorer**: Deep directory tree with quick actions (`+` New File, New Folder, Collapse All, Refresh Workspace);
- **Full Keyboard Vim Navigation**: Navigate tree with `j`/`k` (or arrow keys), expand/open with `o` or `Enter`, create with `a` (`name.ts` or `dir/`), rename with `r`, delete with `d` (modal confirmation), and copy absolute path with `yyp`;
- **Mouse Multi-Selection**: Supports `Cmd`/`Ctrl` single-item toggle, `Shift` continuous range selection, and `Esc` to clear all selections;
- **Native VS Code SCM Swimlanes**: Exact port of VS Code's official `scmHistory.ts` algorithm with branch-aligned commit dots and continuous downward swimlanes on expanded details;
- **Sub-Second Git Status**: Real-time 1.5s background polling and instant save-time refresh, badge strictly reflects uncommitted changes (`> 0`).

#### 💬 `Session` Section (OpenCode AI Agent Sessions)
- **Project-Grouped Sessions**: Automatically groups AI agent sessions by project workspace with path normalization and deduplication;
- **Active Session Indicator**: Distinct emerald-green glowing dot (`bg-emerald-500`) highlights the currently active project and session;
- **Favorites & Star Management**: Star / favorite projects and sessions for quick top-of-list access;
- **2-Step Safe Project Removal**: Remove projects from the list with a 2-step confirmation modal (`Enter` to confirm, `Esc` to cancel), explicitly ensuring database sessions are preserved and will reload automatically upon reopening;
- **Context Menu Actions**: Right-click to rename session titles, delete sessions with confirmation, and toggle favorites;
- **Draggable Vertical Splitter**: Interactive horizontal split handle between `Dir` and `Session` allowing smooth custom height allocation.

---

### 🌐 TopBar: Git Status, Agent Hub & Window Controls

The unified title bar delivers essential project telemetry and quick global controls:

- **Project & Active Git Branch Status**:
  - Displays the active workspace project name aligned on the left;
  - Displays the current Git branch badge (e.g. `🌿 main`, `🌿 feature/v1.1`); clicking the branch badge instantly opens the **Git Management Modal**;
- **`Git` Management Modal Button**:
  - Dedicated `Git` button in the top-right header providing one-click access to the full Git dialog (`GitModal`);
  - Inspect staged/unstaged changes, review side-by-side diffs, write commit messages, and examine commit graph swimlanes;
- **AI Agent Bot Hub**:
  - One-click Agent Bot selector dropdown to launch and switch active agents (`OpenCode`, `Claude Code`, custom agents) in Window 3;
  - Install custom agent commands with seamless execution;
- **VS Code-Style Window Layout Controls**:
  - `PrimarySidebarIcon` button: Click to show/hide Window 1 (`Dir` & `Session`);
  - `BottomPanelIcon` button: Click to show/hide Window 3 (Terminal / AI Dock);
  - Subtle vertical divider separating window controls from Agent and Git actions;
- **Preferences Button (`Settings`)**: One-click or `Cmd+,` to open the full preferences dialog.

---

### 📝 Window 2: Editor & Diff Comparison

- **Monaco Editor Core**: VS Code Monaco Editor with full syntax highlighting, bracket matching, and theme synchronization;
- **Dual-Mode Vim Editing**:
  - **Normal Mode**: Solid block cursor, `ww` to fast-save, `qq` to close current tab, standard Vim motions (`hjkl`, `w`, `b`, `dd`, `yy`, `p`);
  - **Insert Mode**: Smooth vertical line cursor with full autocomplete;
- **Side-by-Side & Unified Diff Comparison**:
  - Live Git diff stats badge (`+added`, `-deleted`, `~modified`);
  - Segmented toggle between Side-by-Side (`Split`) and Inline (`Unified`) diffs;
  - Seamless one-click return to full `Text Editor (Vim)` directly from the comparison dropdown menu;
- **Smart Markdown View Filtering**:
  - `Markdown Preview Enhanced` and `Markmap Mind Map` are displayed exclusively for Markdown files (`.md` / `.markdown`), keeping source code menus clean and uncluttered;
  - Collapsible Table of Contents (TOC) with synchronized scroll and heading jump.

---

### 💻 Window 3: Terminal & AI Dock

- **Native POSIX PTY Shell**: Direct connection to `/bin/zsh -l`, evaluating local `~/.zshrc` themes, fonts, and powerline glyphs without distortion;
- **OpenCode CLI Pairing**: Single-click or `Shift+Cmd+M` launches real interactive `opencode` coding assistant sessions;
- **Recursive Process Tree Cleanup**: Closing a terminal tab recursively kills child processes via `libc::kill(-pid, SIGKILL)` and `pkill -9 -P`, freeing all RAM & CPU immediately;
- **Drag-and-Drop Path Pasting**: Drag files or folders from Window 1 directly into the terminal to paste absolute paths.

---

### 🎨 Settings & Customization

- **Custom Modern Settings (`CustomSelect`)**: Redesigned dropdown select cards with smooth animations, custom borders, clean typography, and zero clunky native borders or horizontal divider lines;
- **Live Theme Engine**: High-contrast modern themes (`Light 2026`, `VS Code Dark Modern`, `Gruvbox Dark`, `One Dark Pro`, `Nord`, `Cyberpunk Neon`) with dynamic syntax and shell styling;
- **Typography & Font Previews**: Live typeface previews for `JetBrains Mono`, `Fira Code`, `Hack Nerd Font`, `SF Mono`, `Menlo`, `Cascadia Code`, and custom installed fonts;
- **Open VSX Extensions Marketplace**: Search, install, and manage extensions directly within the preferences dialog;
- **macOS Native Touches**: Full-width frameless dragging with double-click maximize/unmaximize; dual `Cmd+qq` exit gate (prevents accidental quits).

---

## 🚀 Quick Start

### Installation

Download prebuilt binaries for macOS from the [Releases](https://github.com/0xA2618/aura/releases) page:
- **`Aura_1.1.0_aarch64.dmg`** (Apple Silicon M1/M2/M3/M4)
- **`Aura_1.1.0_x64.dmg`** (Intel Macs)

> **First Run Note (macOS Gatekeeper)**: If macOS displays *"App cannot be opened because developer cannot be verified"*, right-click `Aura.app` and choose **Open**, or run `xattr -cr /Applications/Aura.app` in Terminal.

For complete installation and usage instructions in Chinese, please refer to:
- 📖 [**中文安装与使用指南 (Chinese Guide)**](docs/INSTALL_USAGE_ZH.md)

---

## ⌨️ Essential Keybindings

| Keybinding | Action |
|---|---|
| **`Ctrl+h`** | Focus **Window 1** (File Tree & Git SCM) |
| **`Ctrl+k`** | Focus **Window 2** (Code Editor) |
| **`Ctrl+l`** | Focus **Window 3** (Terminal / OpenCode Dock) |
| **`Cmd+d`** | Spawn a new native Terminal (zsh) |
| **`Shift+Cmd+m`** | Spawn a native OpenCode AI session |
| **`Cmd+w`** | Close active editor tab or terminal pane |
| **`Cmd+qq`** | Double-tap lowercase `q` within 1.2s to quit Aura safely |
| **`Cmd+,`** | Open Preferences (Themes, Fonts, Extensions, Markdown) |
| **`Cmd+=/+` / `Cmd+-/_`** | Zoom active editor or terminal font size |
| **`Esc`** | Deselect all files in Window 1 / dismiss context menus and modals |
| **`ww`** *(Normal mode)* | Fast save active file |
| **`qq`** *(Normal mode)* | Close active tab |

---

## 🛠️ Development & Building

```bash
# Prerequisites: Node.js 18+, pnpm, Rust toolchain (cargo)
git clone https://github.com/0xA2618/aura.git
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
