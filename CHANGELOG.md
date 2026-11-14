# Aura IDE Changelog

All notable changes to the **Aura IDE** project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1] - 2026-11-15

### 🌟 Executive Overview
Aura IDE v1.2.1 tightens the ACP panel into a polished, steerable chat surface: tool invocations render as compact collapsible one-liners, context usage is a first-class transient chip, images paste directly into the prompt, fixed-slot config chips never shift, and several resume/protocol edge cases are hardened. No behavior removed; the `/usage` client command remains available.

---

### 🚀 What's New & Highlights

#### 1. ACP Tool One-Liners
- **Collapsible tool calls** (`▸` / `✓`): `tool_call` + `tool_call_update` now render as single-line summaries grouped into a `ToolActivityGroup`; click to expand/collapse the full log.
- **`toolCallId` passthrough**: Rust bridge forwards `toolCallId` so each `running` line pairs exactly with its corresponding `done` line — no more ambiguous status updates.
- **Three-phase "Thinking" badge**: thinking / answering / running tools have distinct visuals and an elapsed-seconds ticker.

#### 2. ACP Image Paste
- **Paste screenshots**: `Cmd/Ctrl+V` of a screenshot (or any clipboard image) in the ACP prompt inserts it inline; sent to the agent as an image content block.
- **Image previews inline**: attached images render as thumbnails above the input; multiple images supported (per-agent limits apply).

#### 3. Ctx Chip
- **`Ctx 3%` chip**: occupies the footer area; click to show a popover (`Context — N tokens — n% used`).
- **Model-aware window cache**: `usage_update` `used`/`size` flow through the Rust bridge again, so the footer stays in sync across model switches; when absent, value is kept from the last event.

#### 4. Fixed Slot Layout
- **Model / reasoning effort / permission mode** render in fixed-order, fixed-width slots; missing configs render as `—` placeholder. Positions never shift when the agent advertises different option sets.

#### 5. ACP Transcript Reliability
- **Resume path fall-through**: `session/load` agent response without `sessionId` now synthesizes `session_created` and resumes properly instead of stalling at `Starting…`.
- **Image blocks in `session/new` / `session/load`** paired to the same `agent_session_id` so replays are identical to live turns.
- **appendToLastAssistantMessage** now appends to the newest `assistant` bubble (tool-line interleaves no longer drop chunks).
- **Tool call done-pairing**: completed matches running precisely via `toolCallId`.

#### 6. ACP Panel UX Polish
- **Jump-to-bottom** floating button + 12px scrollbar + auto-scroll-on-open.
- **Cmd+1..9 switches dock tabs** from anywhere, including inside the ACP input.
- **Cmd+R** no longer reloads the app (ACP sessions used to get killed); in the ACP input it triggers a **soft reconnect**; anywhere else it does nothing.
- **Image attachments visual**: drag-and-drop quoted paths (existing) + `{{image:N}}` inline preview.
- **Mermaid diagrams** render inline in ACP messages via `AcpMarkdown`.
- **ErrorBoundary** wraps the app tree — React render crashes surface a real stack trace instead of a white rectangle.

#### 7. Theme & UI
- **Settings**: changes apply to the document immediately and persist; theme toast removed (`"设置已成功保存"` no longer shown).
- **Light theme divider**: deeper `--aura-divider` (`#94a3b8`); dark theme uses `#3f3f46`.
- **Logo font smoothing** for body element.

#### 8. Sidebar QoL
- **`expandedProjects` v2**: missing/absent project key = collapsed; migration from legacy `collapsedProjects` flips words (`true`=expanded, `false`=collapsed) automatically; existing layouts keep working.

---

### 🛠 Fixes
- ACP resume fallback coordinator: ensures first `usage_update` decorates ctx meter correctly.
- `/exit` no longer emits extra messages post-kill.
- Settings theme change applies inline (removes a past toast dependency).

---

## [1.2.0] - 2026-11-14

### 🌟 Executive Overview
Aura IDE v1.2.0 brings full **Agent Client Protocol (ACP)** integration — every installed agent runs in a structured, streaming chat panel with model/permission pickers, a `/`-triggered command autocomplete (agent-advertised commands + Aura's client-side `/exit` `/usage` `/save`), session persistence with accurate ACP vs native resume semantics, precise per-agent session deletion, plus a batch of terminal IME/drag-drop reliability fixes.

---

### 🚀 What's New & Highlights

#### 1. Agent Client Protocol (ACP) Integration
- **Native ACP Panels**: Streaming assistant chunks, thinking traces, tool calls, plan updates rendered inline across `agy acp` / `opencode acp` / `claude acp` / `codex acp` / `gemini acp`.
- **Config Pickers**: `configOptions` pushed by each agent surface as selectors in the panel footer — switch model, reasoning effort, permission modes at runtime.
- **Slash-Command Autocomplete**: `/`-triggered fuzzy completion mixing agent-advertised commands (`available_commands_update`) with Aura-owned client commands (`/exit`, `/usage`, `/save`).
- **Session Resume by Origin**: Sidebar rows distinguish ACP vs native with icons; clicking an ACP-originated conversation reopens it via ACP (`session/load`), native ones through the agent's native resume command.
- **Scoped Session Delete**: Matching per agent — `agy` (`conversation_summaries` + `conversations/*.db` + `brain/`), `opencode` (`PRAGMA foreign_keys=ON; DELETE FROM session_v2…`), `codex` (`threads`), `claude` (`history.jsonl` rewrite) — plus deletion of the associated `/save` memo files.

#### 2. Client-Side ACP Slash Commands
- **`/save`**: Compresses the session into a markdown memo saved at `~/.config/aura/memos/<workspace>__<agent>__<session-id>.md` and synced to EverOS when `~/.config/aura/aura.json` carries `memory.everos.baseUrl` (default group `coding:<workspace>`).
- **`/usage`**: Live context pressure rendered as `ctx` usage meter above the input row.
- **`/exit`**: Terminates the ACP agent process and closes its dock tab.

#### 3. Terminal Reliability
- **Fullwidth IME Commit Fix**: First byte drop for macOS Pinyin fullwidth punctuation (`？`/`！`/`（`) resolved via capture-phase `beforeinput` workaround for xterm.js #6144.
- **Shift+Enter = Newline in opencode**: xterm emits `\x1b\r` (META+Enter), matching opencode's Option+Enter newline.
- **Quoted Drag-Drop Paths**: File drag into terminals and the ACP chat panel inserts `"absolute/path"` with quotes.

#### 4. Sidebar & Session QoL
- **Dir unified single-source tree**: new folders appear expanded; no stale subtree cache; create/rename/move refresh atomically from disk.
- **Session Copy ID**: Context-menu `Copy` stores the native session id (e.g. `agy --conversation <id>`) to the clipboard.
- **AutoCapitalize Disabled**: File/session rename inputs preserve exact typed casing.

---

### 🛠 Fixes
- **Native Agent Launch via Binary**: Stripped `npm_*` / `pnpm_*` environment before launching native agents; no more `_jsr-registry` contamination failures.
- **ACP Bridge Field Passthrough**: `availableCommands` now flows through the Rust forwarding layer (was dropped as noise).

---

### 📦 Detailed Commit Log
- `8bc6950` chore(git): normalize lib.rs file mode to non-executable
- `1e1592d` fix(terminal): quote drag paths, allow fullwidth IME symbols, map Shift+Enter to newline in opencode
- `d952bb2` refactor(sidebar): unify Dir tree data source, add session Copy menu, disable autoCapitalize on inline inputs
- `8b100e2` feat(acp): add agent picker ACP tab, chat panel, and session resume flow
- `13449e6` feat(acp): integrate Agent Client Protocol with detection, resume, delete-mapping

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
