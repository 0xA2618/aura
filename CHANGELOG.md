# Aura IDE Changelog

All notable changes to the **Aura IDE** project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.2] - 2026-11-09

### 🌟 Executive Overview
Aura IDE v1.0.2 delivers critical improvements to the embedded terminal engine, fixes line-duplication anomalies during streaming outputs in modern AI CLI tools, introduces an end-to-end custom typography system optimized for external high-resolution displays, and refines the global theme and button design hierarchy across dark, light, and high-contrast palettes.

---

### 🚀 What's New & Highlights

#### 1. Custom Typography & Multi-Display Optimization
- **Dual Independent Font Controls**: Tailor editor and terminal font sizes separately from 11px to 24px via the unified Settings panel.
- **Curated Monospace Presets & Custom Fonts**: Pick between `JetBrains Mono`, `Fira Code`, `Hack Nerd Font`, `SF Mono`, `Menlo`, `Cascadia Code`, or specify any locally installed font family.
- **External Display Anti-Aliasing**: Applied hardware-accelerated subpixel anti-aliasing (`-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`) to prevent text blurring on non-integer DPI external monitors.

#### 2. Standardized Design System & Button Hierarchy
- **Semantic Button Framework**: Standardized action buttons into cohesive visual levels (`.aura-btn-primary`, `.aura-btn-secondary`, `.aura-btn-ghost`, `.aura-btn-danger`).
- **Decoupled Accent Contrast**: Introduced `--aura-accent-fg` to ensure readable text against vivid accent colors (such as Gruvbox gold `#fabd2f`).
- **Modal & Sidebar Polish**: Unified hover states, borders, and backdrop blurs across Settings, Shortcuts, Help, and file tree sidebars.

---

### 🛠 Bug Fixes & Stability

#### Terminal Streaming & Rendering Reliability
- **Streaming Line Duplication Fix**: Resolved an issue where AI CLI tools (such as `OpenCode`, `agy`, or python rich loggers) caused output lines to duplicate repeatedly when streaming tokens.
- **Lossless PTY Stream Decoder**: Added cross-chunk buffer handling in Rust backend (`src-tauri/src/lib.rs`) to prevent multi-byte UTF-8 sequences (4-byte emojis, CJK glyphs) from truncating across 4096-byte socket boundaries.
- **Unicode 11 Character Width Alignment**: Integrated `@xterm/addon-unicode11@0.9.0` so modern terminal emoji/CJK character widths synchronize with modern CLI layout engines.
- **Device Attribute (DA1) Escape Leak Suppression**: Intercepted unsolicited CSI `c` / `>c` response sequences, preventing rogue `^[[?1;2c` strings from leaking into the command prompt.
- **Safe Dynamic Fit**: Added client dimension checks before invoking `FitAddon` to eliminate 0-dimension terminal resize exceptions.

---

### 📦 Detailed Commit Log
- `c9e03e9` style(theme): refine UI color contrast and standardize button hierarchy
- `6e32854` feat(settings): add custom typography and font size controls for editor and terminal
- `a4776c0` fix(terminal): resolve duplicate output streaming, emoji widths and escape sequence leak
- `7c834db` chore(deps): add @xterm/addon-unicode11 dependency

---

## [1.0.1] - 2026-11-06

### Added
- **Full-Width Markdown Preview**: Enhanced split preview to fill entire container width without right margin cut-off.
- **Modern Context Menus**: Added sleek right-click actions on file tree and editor tabs.
- **Collapsible Sidebar**: Dynamic drawer toggle to maximize coding space.

### Fixed
- Fixed window border resizing and theme palette synchronization on macOS.

---

## [1.0.0] - 2026-11-05

### Initial Release
- Minimalist macOS Desktop Code Workspace powered by Rust and Monaco Editor.
- Built-in POSIX pseudo-terminal (PTY) with seamless tab management.
- Theme engine featuring Dark Modern, Gruvbox, and Light 2026 themes.
