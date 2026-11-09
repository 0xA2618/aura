use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::process::Command;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use notify::{Watcher, RecursiveMode, Event, EventKind};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub git_status: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCommitItem {
    pub hash: String,
    pub parents: Vec<String>,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub date: String,
    pub refs: String,
    pub is_merge: bool,
}

struct TerminalSession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
    reader: Option<Box<dyn Read + Send>>,
}

pub struct AppState {
    terminals: Arc<Mutex<HashMap<String, TerminalSession>>>,
    active_watcher: Arc<Mutex<Option<notify::RecommendedWatcher>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            terminals: Arc::new(Mutex::new(HashMap::new())),
            active_watcher: Arc::new(Mutex::new(None)),
        }
    }
}

// ----------------- File System Commands -----------------

#[tauri::command]
fn fs_get_default_workspace() -> Result<String, String> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    Ok(cwd.to_string_lossy().to_string())
}

#[tauri::command]
fn fs_read_dir(dir_path: Option<String>) -> Result<Vec<FileEntry>, String> {
    let target = match dir_path {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let entries = fs::read_dir(&target).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    let mut git_status_map: HashMap<String, String> = HashMap::new();
    let mut git_root = None;

    if let Ok(root_out) = Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(&target)
        .output()
    {
        if root_out.status.success() {
            let r_str = String::from_utf8_lossy(&root_out.stdout).trim().to_string();
            if !r_str.is_empty() {
                git_root = Some(PathBuf::from(r_str));
            }
        }
    }

    let repo_root = git_root.clone().unwrap_or_else(|| target.clone());

    if let Ok(git_out) = Command::new("git")
        .args(["status", "--porcelain", "-uall", "--ignored"])
        .current_dir(&repo_root)
        .output()
    {
        if git_out.status.success() {
            let stdout = String::from_utf8_lossy(&git_out.stdout);
            for line in stdout.lines() {
                if line.len() >= 3 {
                    let status_flag = &line[..2];
                    let file_part = line[3..].trim().trim_end_matches('/');
                    let display_code = if status_flag == "!!" {
                        "IGNORED"
                    } else if status_flag.contains('M') {
                        "M"
                    } else if status_flag.contains('A') {
                        "A"
                    } else if status_flag.contains('D') {
                        "D"
                    } else if status_flag.contains('?') {
                        "U"
                    } else {
                        "M"
                    };

                    let abs_path = repo_root.join(file_part).to_string_lossy().to_string();
                    git_status_map.insert(abs_path, display_code.to_string());
                }
            }
        }
    }

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".git" || name == ".pnpm-cache" {
            continue;
        }

        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let path = entry.path().to_string_lossy().to_string();

        let mut git_status = git_status_map.get(&path).cloned();
        if git_status.is_none() {
            for (p, status) in &git_status_map {
                if p == &path || p.starts_with(&format!("{}/", path)) {
                    if is_dir {
                        if status == "IGNORED" {
                            if git_status.is_none() {
                                git_status = Some("IGNORED".to_string());
                            }
                        } else {
                            git_status = Some(status.clone());
                            break;
                        }
                    }
                }
            }
        }

        result.push(FileEntry {
            name,
            path,
            is_directory: is_dir,
            git_status,
        });
    }

    result.sort_by(|a, b| {
        if a.is_directory == b.is_directory {
            a.name.cmp(&b.name)
        } else if a.is_directory {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(result)
}

#[tauri::command]
fn fs_read_file(file_path: String) -> Result<String, String> {
    if file_path.is_empty() {
        return Err("Empty file path".into());
    }
    fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn fs_write_file(file_path: String, content: String) -> Result<bool, String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn fs_create_entry(target_path: String, is_directory: bool) -> Result<bool, String> {
    if is_directory {
        fs::create_dir_all(&target_path).map_err(|e| e.to_string())?;
    } else {
        if let Some(parent) = Path::new(&target_path).parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        fs::write(&target_path, "").map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
fn fs_rename_entry(old_path: String, new_path: String) -> Result<bool, String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn fs_delete_entry(target_path: String) -> Result<bool, String> {
    let path = Path::new(&target_path);
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    } else if path.is_file() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
fn fs_open_in_finder(target_path: String) -> Result<bool, String> {
    let p = if target_path.is_empty() { "." } else { &target_path };
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(p)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = p;
        Err("Not supported on this platform".into())
    }
}

#[tauri::command]
fn fs_pick_workspace() -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let script = r#"tell application "System Events"
            activate
            set chosenFolder to choose folder with prompt "Select Workspace Folder"
            POSIX path of chosenFolder
        end tell"#;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().trim_end_matches('/').to_string();
            if !path.is_empty() {
                return Ok(Some(path));
            }
        }
        Ok(None)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn fs_watch_workspace(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    workspace_path: String,
) -> Result<bool, String> {
    let mut watcher_lock = state.active_watcher.lock().map_err(|e| e.to_string())?;
    *watcher_lock = None;

    let target_path = PathBuf::from(&workspace_path);
    if !target_path.exists() {
        return Ok(false);
    }

    let last_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(10)));
    let app_handle = app.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            match event.kind {
                EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                    let should_ignore = event.paths.iter().any(|p| {
                        let s = p.to_string_lossy();
                        s.contains("/.git/") || s.contains("/node_modules/") || s.contains("/target/") || s.contains("/.pnpm-store/")
                    });
                    if !should_ignore {
                        let mut last = last_emit.lock().unwrap();
                        if last.elapsed() >= Duration::from_millis(300) {
                            *last = Instant::now();
                            let _ = app_handle.emit("aura:fs-changed", ());
                        }
                    }
                }
                _ => {}
            }
        }
    }).map_err(|e| e.to_string())?;

    watcher.watch(&target_path, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    *watcher_lock = Some(watcher);

    Ok(true)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitStatusSummary {
    pub total_changed: usize,
    pub files: Vec<FileEntry>,
}

#[tauri::command]
fn git_get_status(workspace: Option<String>) -> Result<GitStatusSummary, String> {
    let target = match workspace {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let mut changed_files = Vec::new();
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&target)
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                if line.len() >= 3 {
                    let status_flag = line[..2].trim().to_string();
                    let file_part = line[3..].trim();
                    let display_code = if status_flag.contains('M') {
                        "M"
                    } else if status_flag.contains('A') {
                        "A"
                    } else if status_flag.contains('D') {
                        "D"
                    } else if status_flag.contains('?') {
                        "U"
                    } else {
                        "M"
                    };

                    let full_path = target.join(file_part).to_string_lossy().to_string();
                    let file_name = Path::new(file_part)
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| file_part.to_string());

                    changed_files.push(FileEntry {
                        name: file_name,
                        path: full_path,
                        is_directory: false,
                        git_status: Some(display_code.to_string()),
                    });
                }
            }
        }
    }

    Ok(GitStatusSummary {
        total_changed: changed_files.len(),
        files: changed_files,
    })
}

// ----------------- Git Commands -----------------

#[tauri::command]
fn git_get_commits(workspace: Option<String>) -> Result<Vec<GitCommitItem>, String> {
    let target = match workspace {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let output = Command::new("git")
        .args(["log", "--all", "--pretty=format:%h|%p|%s|%an|%ae|%cr|%d"])
        .current_dir(target)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut commits = Vec::new();
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 6 {
                    let parents: Vec<String> = if parts[1].trim().is_empty() {
                        Vec::new()
                    } else {
                        parts[1].split_whitespace().map(|s| s.to_string()).collect()
                    };
                    let is_merge = parents.len() > 1;
                    let refs = if parts.len() >= 7 { parts[6].trim().to_string() } else { String::new() };

                    commits.push(GitCommitItem {
                        hash: parts[0].to_string(),
                        parents,
                        message: parts[2].to_string(),
                        author: parts[3].to_string(),
                        author_email: parts[4].to_string(),
                        date: parts[5].to_string(),
                        refs,
                        is_merge,
                    });
                }
            }
            Ok(commits)
        }
        _ => Ok(Vec::new()),
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCommitFile {
    pub path: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitFileDiff {
    pub original: String,
    pub modified: String,
}

#[tauri::command]
fn git_get_commit_files(workspace: Option<String>, hash: String) -> Result<Vec<GitCommitFile>, String> {
    let target = match workspace {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let output = Command::new("git")
        .args(["show", "--pretty=", "--name-status", &hash])
        .current_dir(target)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut files = Vec::new();
            for line in stdout.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() { continue; }
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 2 {
                    let status = parts[0].chars().next().unwrap_or('M').to_string();
                    let path = parts[1].to_string();
                    files.push(GitCommitFile { path, status });
                }
            }
            Ok(files)
        }
        _ => Ok(Vec::new()),
    }
}

#[tauri::command]
fn git_get_file_diff(workspace: Option<String>, hash: String, file_path: String) -> Result<GitFileDiff, String> {
    let target = match workspace {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let mod_spec = format!("{}:{}", hash, file_path);
    let mod_output = Command::new("git")
        .args(["show", &mod_spec])
        .current_dir(&target)
        .output();
    let modified = match mod_output {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).to_string(),
        _ => String::new(),
    };

    let orig_spec = format!("{}^:{}", hash, file_path);
    let orig_output = Command::new("git")
        .args(["show", &orig_spec])
        .current_dir(&target)
        .output();
    let original = match orig_output {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).to_string(),
        _ => String::new(),
    };

    Ok(GitFileDiff { original, modified })
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitLineChange {
    pub original_start_line: usize,
    pub original_end_line: usize,
    pub modified_start_line: usize,
    pub modified_end_line: usize,
    pub change_type: String,
}

#[tauri::command]
fn git_get_head_content(workspace: Option<String>, file_path: String) -> Result<String, String> {
    let target = match workspace {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let rel_path = if Path::new(&file_path).is_absolute() {
        if let Ok(rel) = Path::new(&file_path).strip_prefix(&target) {
            rel.to_string_lossy().to_string()
        } else {
            file_path.clone()
        }
    } else {
        file_path.clone()
    };

    let spec = format!("HEAD:{}", rel_path);
    let output = Command::new("git")
        .args(["show", &spec])
        .current_dir(&target)
        .output();

    match output {
        Ok(out) if out.status.success() => Ok(String::from_utf8_lossy(&out.stdout).to_string()),
        _ => Ok(String::new()),
    }
}

// ----------------- Native Terminal PTY Commands -----------------

#[tauri::command]
fn terminal_create(
    _app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    mode: Option<String>,
) -> Result<bool, String> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: if rows > 0 { rows } else { 24 },
            cols: if cols > 0 { cols } else { 80 },
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let default_shell = std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(windows) {
            "powershell.exe".to_string()
        } else {
            "/bin/zsh".to_string()
        }
    });
    let mut cmd = CommandBuilder::new(&default_shell);

    let resolved_cwd = match cwd {
        Some(ref p) if Path::new(p).exists() => PathBuf::from(p),
        _ => std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default()),
    };
    cmd.cwd(resolved_cwd.clone());

    for (k, v) in std::env::vars() {
        if k != "PWD" {
            cmd.env(k, v);
        }
    }
    cmd.env("PWD", resolved_cwd.to_string_lossy().to_string());
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let is_opencode = mode.as_deref() == Some("opencode");
    if is_opencode {
        let opencode_path = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map(|h| format!("{}/.opencode/bin/opencode", h))
            .unwrap_or_default();
        let bin = if Path::new(&opencode_path).exists() {
            opencode_path
        } else {
            "opencode".to_string()
        };
        if cfg!(windows) {
            cmd.arg("-Command");
            cmd.arg(format!("Set-Location '{}'; & '{}'", resolved_cwd.to_string_lossy(), bin));
        } else {
            cmd.arg("-l");
            cmd.arg("-c");
            cmd.arg(format!("cd '{}' && exec {}", resolved_cwd.to_string_lossy(), bin));
        }
    } else if !cfg!(windows) {
        cmd.arg("-l");
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Do NOT start reader thread here — shell output accumulates in the PTY
    // kernel buffer until the frontend calls terminal_ready.

    let mut lock = state.terminals.lock().map_err(|e| e.to_string())?;
    lock.insert(
        id,
        TerminalSession {
            master: pair.master,
            writer,
            child,
            reader: Some(reader),
        },
    );

    Ok(true)
}

/// Frontend calls this AFTER its event listeners are 100% registered.
/// Takes the buffered reader out of the session and spawns the read→emit loop.
/// All shell output produced between spawn and now is flushed in one burst.
#[tauri::command]
fn terminal_ready(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let mut lock = state.terminals.lock().map_err(|e| e.to_string())?;
    let session = lock.get_mut(&id).ok_or("Terminal not found")?;
    let mut reader = session.reader.take().ok_or("Reader already started")?;

    let event_id = id.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut leftover = Vec::new();
        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 {
                break;
            }
            let combined = if leftover.is_empty() {
                buf[..n].to_vec()
            } else {
                let mut c = std::mem::take(&mut leftover);
                c.extend_from_slice(&buf[..n]);
                c
            };

            let mut slice = &combined[..];
            while !slice.is_empty() {
                match std::str::from_utf8(slice) {
                    Ok(valid_str) => {
                        let _ = app_handle.emit(&format!("terminal:data:{}", event_id), valid_str.to_string());
                        slice = &[];
                    }
                    Err(e) => {
                        let valid_up_to = e.valid_up_to();
                        if valid_up_to > 0 {
                            let valid_str = unsafe { std::str::from_utf8_unchecked(&slice[..valid_up_to]) };
                            let _ = app_handle.emit(&format!("terminal:data:{}", event_id), valid_str.to_string());
                        }
                        if let Some(error_len) = e.error_len() {
                            let _ = app_handle.emit(&format!("terminal:data:{}", event_id), "\u{FFFD}".to_string());
                            slice = &slice[valid_up_to + error_len..];
                        } else {
                            // Incomplete multi-byte sequence (such as a split Emoji or CJK character) at chunk boundary.
                            // Retain remaining bytes in leftover buffer to decode with subsequent read chunk.
                            leftover = slice[valid_up_to..].to_vec();
                            break;
                        }
                    }
                }
            }
        }
        if !leftover.is_empty() {
            let data = String::from_utf8_lossy(&leftover).to_string();
            let _ = app_handle.emit(&format!("terminal:data:{}", event_id), data);
        }
        let _ = app_handle.emit(&format!("terminal:exit:{}", event_id), ());
    });

    Ok(true)
}

#[tauri::command]
fn terminal_write(
    state: State<'_, AppState>,
    id: String,
    data: String,
) -> Result<bool, String> {
    let mut lock = state.terminals.lock().map_err(|e| e.to_string())?;
    if let Some(session) = lock.get_mut(&id) {
        session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Err("Terminal not found".into())
}

#[tauri::command]
fn terminal_resize(
    state: State<'_, AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<bool, String> {
    let lock = state.terminals.lock().map_err(|e| e.to_string())?;
    if let Some(session) = lock.get(&id) {
        session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Err("Terminal not found".into())
}

#[tauri::command]
fn terminal_kill(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let mut lock = state.terminals.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = lock.remove(&id) {
        #[cfg(unix)]
        if let Some(pid) = session.child.process_id() {
            unsafe {
                libc::kill(-(pid as i32), libc::SIGKILL);
                libc::kill(pid as i32, libc::SIGKILL);
            }
            let _ = Command::new("pkill")
                .args(["-9", "-P", &pid.to_string()])
                .output();
        }
        let _ = session.child.kill();
        let _ = session.child.wait();
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn window_start_dragging(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn app_exit(app: tauri::AppHandle) {
    app.exit(0);
}

// ----------------- App Run Entrypoint -----------------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .menu(|handle| {
            let app_menu = tauri::menu::SubmenuBuilder::new(handle, "Aura")
                .about(Some(tauri::menu::AboutMetadata {
                    name: Some("Aura".into()),
                    version: Some("1.0.0".into()),
                    ..Default::default()
                }))
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .separator()
                .text("quit_hint", "Quit Aura (⌘qq)")
                .build()?;

            let file_menu = tauri::menu::SubmenuBuilder::new(handle, "File")
                .text("file_open_folder", "Open Folder... (打开工作区目录)")
                .separator()
                .text("file_quit", "Quit Aura (⌘qq)")
                .build()?;

            let edit_menu = tauri::menu::SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let window_menu = tauri::menu::SubmenuBuilder::new(handle, "Window")
                .minimize()
                .separator()
                .close_window()
                .separator()
                .text("window_quit", "Quit Aura (⌘qq)")
                .build()?;

            let help_menu = tauri::menu::SubmenuBuilder::new(handle, "Help")
                .text("help_shortcuts", "Keyboard Shortcuts Guide (快捷键一览)")
                .build()?;

            tauri::menu::MenuBuilder::new(handle)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .item(&help_menu)
                .build()
        })
        .on_menu_event(|app, event| {
            if event.id() == &tauri::menu::MenuId::new("quit_hint")
                || event.id() == &tauri::menu::MenuId::new("file_quit")
                || event.id() == &tauri::menu::MenuId::new("window_quit")
            {
                let _ = app.emit("menu:quit_requested", ());
            } else if event.id() == &tauri::menu::MenuId::new("file_open_folder") {
                let _ = app.emit("menu:open_folder_requested", ());
            } else if event.id() == &tauri::menu::MenuId::new("help_shortcuts") {
                let _ = app.emit("menu:help_requested", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            window_start_dragging,
            app_exit,
            fs_get_default_workspace,
            fs_read_dir,
            fs_read_file,
            fs_write_file,
            fs_create_entry,
            fs_rename_entry,
            fs_delete_entry,
            fs_open_in_finder,
            fs_pick_workspace,
            fs_watch_workspace,
            git_get_status,
            git_get_commits,
            git_get_commit_files,
            git_get_file_diff,
            git_get_head_content,
            terminal_create,
            terminal_ready,
            terminal_write,
            terminal_resize,
            terminal_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
