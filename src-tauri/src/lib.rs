use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
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
    pub branch: Option<String>,
    pub total_changed: usize,
    pub files: Vec<FileEntry>,
}

#[tauri::command]
fn git_get_current_branch(workspace: Option<String>) -> Result<String, String> {
    let target = match workspace {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(target)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let branch = String::from_utf8_lossy(&out.stdout).trim().to_string();
            Ok(branch)
        }
        _ => Ok(String::new()),
    }
}

#[tauri::command]
fn git_get_status(workspace: Option<String>) -> Result<GitStatusSummary, String> {
    let target = match workspace {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let branch = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&target)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !s.is_empty() { Some(s) } else { None }
            } else {
                None
            }
        });

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
        branch,
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

#[tauri::command]
fn git_commit(workspace: Option<String>, message: String) -> Result<String, String> {
    let target = match workspace {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let msg = message.trim();
    if msg.is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    let add_output = Command::new("git")
        .args(["add", "-A"])
        .current_dir(&target)
        .output()
        .map_err(|e| format!("Failed to run git add: {}", e))?;

    if !add_output.status.success() {
        return Err(String::from_utf8_lossy(&add_output.stderr).to_string());
    }

    let commit_output = Command::new("git")
        .args(["commit", "-m", msg])
        .current_dir(&target)
        .output()
        .map_err(|e| format!("Failed to run git commit: {}", e))?;

    if !commit_output.status.success() {
        return Err(String::from_utf8_lossy(&commit_output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&commit_output.stdout).to_string())
}

#[tauri::command]
fn git_push(workspace: Option<String>) -> Result<String, String> {
    let target = match workspace {
        Some(p) if !p.is_empty() && Path::new(&p).exists() => PathBuf::from(p),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let push_output = Command::new("git")
        .args(["push"])
        .current_dir(&target)
        .output()
        .map_err(|e| format!("Failed to run git push: {}", e))?;

    let stdout = String::from_utf8_lossy(&push_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&push_output.stderr).to_string();

    if !push_output.status.success() {
        let err_msg = if stderr.is_empty() { stdout } else { stderr };
        return Err(err_msg);
    }

    Ok(if stdout.is_empty() { stderr } else { stdout })
}

// ----------------- Native Agent Detection & Resolution -----------------

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DetectedAgent {
    pub id: String,
    pub name: String,
    pub command: String,
    pub description: String,
    pub category: String,
    pub is_installed: bool,
    pub install_command: String,
    pub path: Option<String>,
    #[serde(default)]
    pub acp: bool,
}

fn is_executable_path(path: &std::path::Path) -> bool {
    if !path.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.metadata().map(|m| m.permissions().mode() & 0o111 != 0).unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn resolve_candidate_path(cmd_name: &str) -> Option<PathBuf> {
    let direct_path = PathBuf::from(cmd_name);
    if is_executable_path(&direct_path) {
        return Some(direct_path);
    }

    for dir in agent_scan_dirs() {
        let candidate = dir.join(cmd_name);
        if is_executable_path(&candidate) {
            return Some(candidate);
        }
        #[cfg(windows)]
        {
            let exe_candidate = dir.join(format!("{}.exe", cmd_name));
            if exe_candidate.is_file() {
                return Some(exe_candidate);
            }
            let cmd_candidate = dir.join(format!("{}.cmd", cmd_name));
            if cmd_candidate.is_file() {
                return Some(cmd_candidate);
            }
        }
    }

    None
}

#[derive(serde::Deserialize, Clone)]
struct KnownAgent {
    id: String,
    command: String,
    name: String,
    description: String,
    category: String,
    install_command: String,
    acp: bool,
}

const KNOWN_AGENTS_JSON: &str = include_str!("../known-agents.json");

fn detect_known_agents() -> Vec<DetectedAgent> {
    let known: Vec<KnownAgent> = serde_json::from_str(KNOWN_AGENTS_JSON).unwrap_or_default();
    known
        .into_iter()
        .map(|k| {
            let maybe_path = resolve_candidate_path(&k.command);
            let is_installed = maybe_path.is_some();
            DetectedAgent {
                id: k.id,
                name: k.name,
                command: k.command,
                description: k.description,
                category: k.category,
                is_installed,
                install_command: k.install_command,
                path: maybe_path.map(|p| p.to_string_lossy().to_string()),
                acp: k.acp,
            }
        })
        .collect()
}

// ----------------- agent detection cache (~/.config/aura/agent-detect-cache.json) -----------------

#[derive(Serialize, Deserialize, Clone)]
struct DetectionCache {
    version: u32,
    scanned_at: i64,
    agents: Vec<DetectedAgent>,
}

fn detection_cache_path() -> Result<PathBuf, String> {
    let cfg = aura_config_path()?;
    Ok(cfg.with_file_name("agent-detect-cache.json"))
}

fn detection_cache_valid(path: &std::path::Path) -> bool {
    if !path.exists() {
        return false;
    }
    let Ok(meta) = std::fs::metadata(path) else {
        return false;
    };
    if let Ok(modified) = meta.modified() {
        if let Ok(elapsed) = modified.elapsed() {
            if elapsed.as_secs() > 300 {
                return false;
            }
        }
    }
    // Invalidate when aura.json changes (agents config is merged live on top of cache)
    if let Ok(cfg) = aura_config_path() {
        if let Ok(cfg_meta) = std::fs::metadata(&cfg) {
            if let Ok(cfg_modified) = cfg_meta.modified() {
                if let Ok(cache_modified) = meta.modified() {
                    if cfg_modified > cache_modified {
                        return false;
                    }
                }
            }
        }
    }
    true
}

fn read_detection_cache() -> Option<Vec<DetectedAgent>> {
    let path = detection_cache_path().ok()?;
    if !detection_cache_valid(&path) {
        return None;
    }
    let raw = std::fs::read_to_string(&path).ok()?;
    let cache: DetectionCache = serde_json::from_str(&raw).ok()?;
    if cache.version != 1 {
        return None;
    }
    Some(cache.agents)
}

fn write_detection_cache(agents: &[DetectedAgent]) {
    if let Ok(path) = detection_cache_path() {
        let cache = DetectionCache {
            version: 1,
            scanned_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0),
            agents: agents.to_vec(),
        };
        if let Ok(serialized) = serde_json::to_string_pretty(&cache) {
            let _ = std::fs::write(path, serialized);
        }
    }
}

fn merge_config_agents(list: &mut Vec<DetectedAgent>) {
    if let Ok(cfg) = read_aura_config() {
        if let Some(agents) = cfg.agents {
            for def in agents.acp {
                let cmd = def.command.trim();
                if cmd.is_empty() {
                    continue;
                }
                let maybe_path = if cmd.contains('/') || cmd.contains('\\') {
                    let p = PathBuf::from(cmd);
                    if p.is_file() { Some(p) } else { None }
                } else {
                    resolve_candidate_path(cmd)
                };
                list.push(DetectedAgent {
                    id: def.id.clone(),
                    name: def.name.clone(),
                    command: def.command.clone(),
                    description: "ACP agent from ~/.config/aura/aura.json".to_string(),
                    category: "acp".to_string(),
                    is_installed: maybe_path.is_some(),
                    install_command: String::new(),
                    path: maybe_path.map(|p| p.to_string_lossy().to_string()),
                    acp: true,
                });
            }
        }
    }
}

#[tauri::command]
fn system_detect_agents() -> Result<Vec<DetectedAgent>, String> {
    // Cache hit: known-agents detection from disk (fast), config agents are always resolved live
    if let Some(mut cached) = read_detection_cache() {
        merge_config_agents(&mut cached);
        return Ok(cached);
    }

    let known = detect_known_agents();
    write_detection_cache(&known);

    let mut list = known;
    merge_config_agents(&mut list);
    Ok(list)
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ScannedBinItem {
    pub name: String,
    pub path: String,
    pub is_executable: bool,
}

/// Shared list of every common install directory (brew Apple Silicon / Intel, linuxbrew,
/// apt/dnf system dirs, rustup, npm-global, nvm, pnpm, go, snap, ~/.local/bin, PATH entries).
fn agent_scan_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        dirs.push(PathBuf::from(&home).join(".local/bin"));
        dirs.push(PathBuf::from(&home).join(".cargo/bin"));
        dirs.push(PathBuf::from(&home).join(".npm-global/bin"));
        dirs.push(PathBuf::from(&home).join(".node/bin"));
        dirs.push(PathBuf::from(&home).join(".opencode/bin"));
        dirs.push(PathBuf::from(&home).join(".gemini/antigravity-cli/bin"));
        dirs.push(PathBuf::from(&home).join(".gemini/bin"));
        dirs.push(PathBuf::from(&home).join(".local/share/pnpm"));
        dirs.push(PathBuf::from(&home).join("Library/pnpm/global"));
        dirs.push(PathBuf::from(&home).join("go/bin"));

        if let Ok(entries) = std::fs::read_dir(PathBuf::from(&home).join(".nvm/versions/node")) {
            for entry in entries.flatten() {
                let bin_dir = entry.path().join("bin");
                if bin_dir.is_dir() {
                    dirs.push(bin_dir);
                }
            }
        }
    }
    dirs.push(PathBuf::from("/opt/homebrew/bin"));
    dirs.push(PathBuf::from("/opt/homebrew/Cargo/bin"));
    dirs.push(PathBuf::from("/home/linuxbrew/.linuxbrew/bin"));
    dirs.push(PathBuf::from("/usr/local/bin"));
    dirs.push(PathBuf::from("/usr/bin"));
    dirs.push(PathBuf::from("/bin"));
    dirs.push(PathBuf::from("/snap/bin"));

    if let Ok(path_var) = std::env::var("PATH") {
        for p in std::env::split_paths(&path_var) {
            if !dirs.contains(&p) {
                dirs.push(p);
            }
        }
    }
    dirs.retain(|d| d.is_dir());
    dirs
}

fn do_scan_dirs_for_bins() -> Vec<ScannedBinItem> {
    let mut map: HashMap<String, ScannedBinItem> = HashMap::new();
    for dir in agent_scan_dirs() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() && !path.is_symlink() {
                    continue;
                }
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with('.') || file_name.ends_with('~') || file_name.ends_with(".bak") {
                    continue;
                }
                if map.contains_key(&file_name) {
                    continue;
                }
                #[cfg(unix)]
                let is_executable = {
                    use std::os::unix::fs::PermissionsExt;
                    entry.metadata().map(|m| m.permissions().mode() & 0o111 != 0).unwrap_or(false)
                };
                #[cfg(not(unix))]
                let is_executable = true;

                map.insert(
                    file_name.clone(),
                    ScannedBinItem {
                        name: file_name,
                        path: path.to_string_lossy().to_string(),
                        is_executable,
                    },
                );
            }
        }
    }
    let mut items: Vec<ScannedBinItem> = map.into_values().collect();
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    items
}

// ----------------- agent detection cache (~/.config/aura/agent-cache.json) -----------------

#[derive(Serialize, Deserialize, Clone)]
struct AgentCache {
    version: u32,
    scanned_at: i64,
    results: Vec<ScannedBinItem>,
}

fn aura_cache_path() -> Result<PathBuf, String> {
    let cfg = aura_config_path()?;
    Ok(cfg.with_file_name("agent-cache.json"))
}

fn agent_cache_valid() -> bool {
    // Cache expires after 5 minutes or whenever aura.json changes
    let cache_path = match aura_cache_path() {
        Ok(p) => p,
        Err(_) => return false,
    };
    if !cache_path.exists() {
        return false;
    }
    let cache_meta = match std::fs::metadata(&cache_path) {
        Ok(m) => m,
        Err(_) => return false,
    };
    if let Ok(modified) = cache_meta.modified() {
        if let Ok(elapsed) = modified.elapsed() {
            if elapsed.as_secs() > 300 {
                return false;
            }
        }
    }
    if let Ok(cfg) = aura_config_path() {
        if let Ok(cfg_meta) = std::fs::metadata(&cfg) {
            if let Ok(cfg_modified) = cfg_meta.modified() {
                if let Ok(cache_modified) = cache_meta.modified() {
                    if cfg_modified > cache_modified {
                        return false;
                    }
                }
            }
        }
    }
    true
}

fn read_agent_cache() -> Option<Vec<ScannedBinItem>> {
    let path = aura_cache_path().ok()?;
    let raw = std::fs::read_to_string(&path).ok()?;
    let cache: AgentCache = serde_json::from_str(&raw).ok()?;
    if cache.version != 1 {
        return None;
    }
    Some(cache.results)
}

fn write_agent_cache(results: &[ScannedBinItem]) {
    if let Ok(path) = aura_cache_path() {
        let cache = AgentCache {
            version: 1,
            scanned_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0),
            results: results.to_vec(),
        };
        if let Ok(serialized) = serde_json::to_string_pretty(&cache) {
            let _ = std::fs::write(path, serialized);
        }
    }
}

fn scan_agent_dirs_cached(force_refresh: bool) -> Result<Vec<ScannedBinItem>, String> {
    if !force_refresh && agent_cache_valid() {
        if let Some(cached) = read_agent_cache() {
            return Ok(cached);
        }
    }
    let results = do_scan_dirs_for_bins();
    write_agent_cache(&results);
    Ok(results)
}

#[tauri::command]
fn system_scan_agent_dirs(force_refresh: Option<bool>) -> Result<Vec<ScannedBinItem>, String> {
    scan_agent_dirs_cached(force_refresh.unwrap_or(false))
}

#[tauri::command]
fn system_scan_local_bin() -> Result<Vec<ScannedBinItem>, String> {
    scan_agent_dirs_cached(false)
}

#[tauri::command]
fn system_refresh_agent_cache() -> Result<Vec<ScannedBinItem>, String> {
    scan_agent_dirs_cached(true)
}

#[tauri::command]
fn system_register_custom_agent(name: String, raw_path: String) -> Result<DetectedAgent, String> {
    let clean_path = raw_path.trim();
    if clean_path.is_empty() {
        return Err("Agent path cannot be empty".to_string());
    }

    let expanded_path_str = if clean_path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            clean_path.replacen('~', &home, 1)
        } else {
            clean_path.to_string()
        }
    } else {
        clean_path.to_string()
    };

    let target_path = PathBuf::from(&expanded_path_str);

    if target_path.is_file() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = std::fs::metadata(&target_path) {
                let mut perms = meta.permissions();
                let current_mode = perms.mode();
                if current_mode & 0o111 == 0 {
                    perms.set_mode(current_mode | 0o755);
                    let _ = std::fs::set_permissions(&target_path, perms);
                }
            }
        }
    }

    let agent_id = format!("custom-{}", name.to_lowercase().replace(' ', "-"));
    Ok(DetectedAgent {
        id: agent_id,
        name: name.clone(),
        command: expanded_path_str.clone(),
        description: format!("Custom Agent: {}", name),
        category: "custom".to_string(),
        is_installed: true,
        install_command: String::new(),
        path: Some(expanded_path_str),
        acp: false,
    })
}

// ----------------- ACP (Agent Client Protocol) Support -----------------

#[derive(Debug)]
pub struct AcpSession {
    pub id: String,
    pub agent_id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub process: Option<std::process::Child>,
    pub writer: Option<BufWriter<std::process::ChildStdin>>,
    pub state: AcpSessionState,
    pub agent_session_id: Option<String>,
    pub next_request_id: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AcpSessionState {
    Initializing,
    Active,
    Terminated,
}

pub struct AcpState {
    pub sessions: Arc<Mutex<HashMap<String, AcpSession>>>,
}

impl AcpState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// ACP command registry: agent id -> (binary, args...)
fn acp_agent_commands() -> HashMap<String, (String, Vec<String>)> {
    let mut map = HashMap::new();
    map.insert("agy".into(), ("agy".into(), vec!["acp".into()]));
    map.insert("agy-acp".into(), ("agy".into(), vec!["acp".into()]));
    map.insert("opencode".into(), ("opencode".into(), vec!["acp".into()]));
    map.insert("gemini".into(), ("gemini".into(), vec!["--acp".into()]));
    map.insert("claude".into(), ("npx".into(), vec!["@agentclientprotocol/claude-agent-acp".into()]));
    map.insert("codex".into(), ("npx".into(), vec!["@agentclientprotocol/codex-acp".into()]));
    map.insert("copilot".into(), ("npx".into(), vec!["@github/copilot-cli".into(), "--acp".into()]));
    map.insert("goose".into(), ("goose".into(), vec!["acp".into()]));
    map.insert("cursor-agent".into(), ("cursor-agent".into(), vec!["acp".into()]));
    map.insert("cursor".into(), ("cursor-agent".into(), vec!["acp".into()]));
    map.insert("kimi".into(), ("kimi".into(), vec!["acp".into()]));
    map.insert("qwen".into(), ("qwen".into(), vec!["--acp".into()]));
    map.insert("cline".into(), ("cline".into(), vec!["--acp".into()]));
    map.insert("auggie".into(), ("npx".into(), vec!["@augmentcode/auggie".into(), "--acp".into()]));
    map.insert("kilo".into(), ("npx".into(), vec!["@kilocode/cli".into(), "acp".into()]));
    map.insert("pi".into(), ("npx".into(), vec!["pi-acp".into()]));
    map.insert("vtcode".into(), ("vtcode".into(), vec!["acp".into()]));
    map.insert("stakpak".into(), ("stakpak".into(), vec!["acp".into()]));
    map.insert("fast-agent".into(), ("uvx".into(), vec!["fast-agent-acp".into()]));
    map.insert("devin".into(), ("devin".into(), vec!["acp".into()]));
    map.insert("grok".into(), ("grok".into(), vec!["agent".into(), "stdio".into()]));
    map
}

fn acp_agent_display_name(agent_id: &str) -> String {
    match agent_id {
        "agy" => "agy acp".to_string(), // ACP mode launches `agy acp`
        "agy-acp" => "agy acp".to_string(),
        "opencode" => "OpenCode ACP".to_string(),
        "gemini" => "Gemini CLI ACP".to_string(),
        "claude" => "Claude Code ACP".to_string(),
        "codex" => "Codex ACP".to_string(),
        "goose" => "Goose ACP".to_string(),
        "cursor" => "Cursor ACP".to_string(),
        "cursor-agent" => "Cursor Agent ACP".to_string(),
        "kimi" => "Kimi Code ACP".to_string(),
        "qwen" => "Qwen Code ACP".to_string(),
        "cline" => "Cline ACP".to_string(),
        "auggie" => "Auggie ACP".to_string(),
        "kilo" => "Kilo Code ACP".to_string(),
        "pi" => "Pi ACP".to_string(),
        "vtcode" => "VT Code ACP".to_string(),
        "stakpak" => "Stakpak ACP".to_string(),
        "fast-agent" => "fast-agent ACP".to_string(),
        "devin" => "Devin ACP".to_string(),
        "grok" => "Grok Build ACP".to_string(),
        "copilot" => "GitHub Copilot ACP".to_string(),
        other => format!("{} ACP", other),
    }
}

fn write_jsonrpc(writer: &mut BufWriter<std::process::ChildStdin>, msg: &Value) -> Result<(), String> {
    let s = serde_json::to_string(msg).map_err(|e| e.to_string())?;
    writer.write_all(s.as_bytes()).map_err(|e| e.to_string())?;
    writer.write_all(b"\n").map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

fn dispatch_to_session(state: &AcpState, session_id: &str, msg: &Value) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get_mut(session_id).ok_or_else(|| "ACP session not found".to_string())?;
    let writer = session.writer.as_mut().ok_or_else(|| "ACP session writer is closed".to_string())?;
    write_jsonrpc(writer, msg)
}

fn extract_update_content(update: &Value) -> Value {
    if let Some(s) = update.get("content").and_then(|c| c.as_str()) {
        return json!(s);
    }
    if let Some(s) = update.pointer("/content/text").and_then(|v| v.as_str()) {
        return json!(s);
    }
    if let Some(arr) = update.get("content").and_then(|c| c.as_array()) {
        let joined = arr
            .iter()
            .filter_map(|c| c.get("text").and_then(|t| t.as_str()))
            .collect::<Vec<_>>()
            .join("");
        if !joined.is_empty() {
            return json!(joined);
        }
    }
    json!("")
}

fn handle_acp_message(session_id: &str, app: &tauri::AppHandle, state: &AcpState, msg: &Value) {
    let event = format!("acp:session:{}", session_id);

    // 1) Responses to client-initiated requests
    if let Some(id) = msg.get("id").and_then(|v| v.as_i64()) {
        if msg.get("error").is_some() {
            let _ = app.emit(&event, json!({ "type": "error", "data": msg.get("error").cloned().unwrap_or(json!({"message":"Unknown ACP error"})) }));
            return;
        }
        if msg.get("result").is_some() {
            if let Some(opts) = msg.pointer("/result/configOptions").cloned() {
                // session/new and session/set_config_option both return full config state
                let _ = app.emit(&event, json!({ "type": "config_options", "data": { "configOptions": opts } }));
            }
            if id == 1 {
                // initialize handshake OK
                let mut sessions = match state.sessions.lock() {
                    Ok(s) => s,
                    Err(_) => return,
                };
                if let Some(s) = sessions.get_mut(session_id) {
                    s.state = AcpSessionState::Active;
                }
                drop(sessions);
                let _ = app.emit(&event, json!({ "type": "info", "data": { "protocolVersion": 1, "message": "ACP handshake complete" } }));
            } else if id == 2 {
                // session/new OK
                if let Some(sid) = msg.pointer("/result/sessionId").and_then(|v| v.as_str()).map(|s| s.to_string()) {
                    let mut sessions = match state.sessions.lock() {
                        Ok(s) => s,
                        Err(_) => return,
                    };
                    if let Some(s) = sessions.get_mut(session_id) {
                        s.agent_session_id = Some(sid.clone());
                        s.state = AcpSessionState::Active;
                    }
                    drop(sessions);
                    let _ = app.emit(&event, json!({ "type": "session_created", "data": { "sessionId": sid } }));
                }
            }
            let _ = app.emit(&event, json!({ "type": "message", "data": msg }));
            return;
        }
    }

    // 2) Requests / notifications from the agent
    if let Some(method) = msg.get("method").and_then(|v| v.as_str()) {
        let params = msg.get("params").cloned().unwrap_or(json!({}));
        match method {
            "session/update" => {
                let update = params.get("update").cloned().unwrap_or(json!({}));
                let update_type = update
                    .get("sessionUpdate")
                    .or_else(|| update.get("type"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                if update_type == "config_option_update" {
                    let opts = update.get("configOptions").cloned().unwrap_or(json!([]));
                    let _ = app.emit(&event, json!({ "type": "config_options", "data": { "configOptions": opts } }));
                    return;
                }
                // 斜杠命令/skill 清单是前端的核心字段，必须透传（否则 ACP 面板无法做 "/" 补全）
                if update_type == "available_commands_update" || update_type == "available_commands" {
                    let cmds = update.get("availableCommands").cloned().unwrap_or(json!([]));
                    let _ = app.emit(&event, json!({ "type": "update", "data": {
                        "sessionUpdate": update_type,
                        "availableCommands": cmds,
                    }}));
                    return;
                }
                let payload = json!({
                    "sessionUpdate": update_type,
                    "title": update.get("title"),
                    "status": update.get("status"),
                    "content": extract_update_content(&update),
                });
                let _ = app.emit(&event, json!({ "type": "update", "data": payload }));
            }
            "session/request_permission" => {
                let title = params
                    .pointer("/toolCall/title")
                    .or_else(|| params.get("title"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Permission requested")
                    .to_string();
                let options = params.get("options").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let option_id = options
                    .iter()
                    .find(|o| {
                        o.get("kind").and_then(|k| k.as_str()).unwrap_or("").starts_with("allow")
                    })
                    .or_else(|| options.first())
                    .and_then(|o| o.get("optionId").and_then(|v| v.as_str()).map(|s| s.to_string()));
                let outcome = if let Some(opt) = option_id {
                    json!({ "outcome": "selected", "optionId": opt })
                } else {
                    json!({ "outcome": "cancelled" })
                };
                let id = msg.get("id").cloned().unwrap_or(json!(0));
                let response = json!({ "jsonrpc": "2.0", "id": id, "result": { "outcome": outcome } });
                let _ = dispatch_to_session(state, session_id, &response);
                let _ = app.emit(&event, json!({ "type": "permission", "data": { "title": title, "granted": true } }));
            }
            "fs/read_text_file" => {
                let id = msg.get("id").cloned().unwrap_or(json!(0));
                let path = params.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
                match std::fs::read_to_string(&path) {
                    Ok(content) => {
                        let response = json!({ "jsonrpc": "2.0", "id": id, "result": { "content": content } });
                        let _ = dispatch_to_session(state, session_id, &response);
                        let _ = app.emit(&event, json!({ "type": "fs", "data": { "op": "read", "path": path } }));
                    }
                    Err(e) => {
                        let response = json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32000, "message": format!("Failed to read {}: {}", path, e) } });
                        let _ = dispatch_to_session(state, session_id, &response);
                    }
                }
            }
            "fs/write_text_file" => {
                let id = msg.get("id").cloned().unwrap_or(json!(0));
                let path = params.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let content = params.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
                match std::fs::write(&path, content) {
                    Ok(_) => {
                        let response = json!({ "jsonrpc": "2.0", "id": id, "result": null });
                        let _ = dispatch_to_session(state, session_id, &response);
                        let _ = app.emit(&event, json!({ "type": "fs", "data": { "op": "write", "path": path } }));
                    }
                    Err(e) => {
                        let response = json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32000, "message": format!("Failed to write {}: {}", path, e) } });
                        let _ = dispatch_to_session(state, session_id, &response);
                    }
                }
            }
            m if m.starts_with("terminal/") => {
                let id = msg.get("id").cloned().unwrap_or(json!(0));
                let response = json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": "Terminal forwarding is not supported in this ACP client yet" } });
                let _ = dispatch_to_session(state, session_id, &response);
                let _ = app.emit(&event, json!({ "type": "error", "data": { "message": "Agent tool 'terminal/*' rejected (not supported yet in Aura ACP MVP)" } }));
            }
            _ => {
                let _ = app.emit(&event, json!({ "type": "message", "data": msg }));
            }
        }
        return;
    }

    let _ = app.emit(&event, json!({ "type": "message", "data": msg }));
}

fn run_acp_session_reader(
    session_id: String,
    app_handle: tauri::AppHandle,
    state: AcpState,
    mut stdout: BufReader<std::process::ChildStdout>,
    mut stderr: BufReader<std::process::ChildStderr>,
) {
    // stderr drain thread
    let app_err = app_handle.clone();
    let sid_err = session_id.clone();
    std::thread::spawn(move || {
        let mut line = String::new();
        loop {
            line.clear();
            match stderr.read_line(&mut line) {
                Ok(0) => break,
                Ok(n) if n > 0 => {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        let _ = app_err.emit(
                            &format!("acp:session:{}:stderr", sid_err),
                            json!({ "type": "stderr", "data": trimmed }),
                        );
                    }
                }
                _ => break,
            }
        }
    });

    // stdout reader loop
    let mut line = String::new();
    loop {
        line.clear();
        match stdout.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match serde_json::from_str::<Value>(trimmed) {
                    Ok(msg) => handle_acp_message(&session_id, &app_handle, &state, &msg),
                    Err(_) => {
                        let _ = app_handle.emit(
                            &format!("acp:session:{}:stderr", session_id),
                            json!({ "type": "stderr", "data": trimmed }),
                        );
                    }
                }
            }
            Err(_) => break,
        }
    }

    // Agent exited - cleanup
    let mut sessions = match state.sessions.lock() {
        Ok(s) => s,
        Err(_) => return,
    };
    if let Some(mut s) = sessions.remove(&session_id) {
        s.state = AcpSessionState::Terminated;
        if let Some(mut child) = s.process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        drop(sessions);
        let _ = app_handle.emit(
            &format!("acp:session:{}", session_id),
            json!({ "type": "terminated", "data": { "reason": "Agent process exited" } }),
        );
    }
}

#[tauri::command]
fn acp_initialize(
    app: tauri::AppHandle,
    state: State<'_, AcpState>,
    session_id: String,
    agent_id: String,
    cwd: Option<String>,
    resume_session_id: Option<String>,
) -> Result<Value, String> {
    // Config-driven registry first (~/.config/aura/aura.json), built-ins as fallback
    let from_config = read_aura_config().ok().and_then(|cfg| {
        cfg.agents?
            .acp
            .into_iter()
            .find(|a| a.id == agent_id && a.enabled)
            .map(|a| (a.command, a.args))
    });
    let (command, args) = match from_config {
        Some(pair) => pair,
        None => {
            let commands = acp_agent_commands();
            commands.get(&agent_id).cloned().ok_or_else(|| {
                format!(
                    "ACP agent '{}' not found in built-in registry or ~/.config/aura/aura.json",
                    agent_id
                )
            })?
        }
    };

    let cwd_str = cwd.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });
    let cwd_path = PathBuf::from(&cwd_str);
    if !cwd_path.exists() {
        return Err(format!("Working directory does not exist: {}", cwd_str));
    }

    let mut cmd = Command::new(&command);
    cmd.args(&args)
        .current_dir(&cwd_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut process = cmd.spawn().map_err(|e| {
        format!(
            "Failed to launch ACP agent '{} {}': {}. Make sure it is installed and available on PATH.",
            command,
            args.join(" "),
            e
        )
    })?;

    let stdout = process.stdout.take().ok_or("Failed to take stdout from agent process")?;
    let stdin = process.stdin.take().ok_or("Failed to take stdin from agent process")?;
    let stderr = process.stderr.take().ok_or("Failed to take stderr from agent process")?;

    let mut session = AcpSession {
        id: session_id.clone(),
        agent_id: agent_id.clone(),
        name: acp_agent_display_name(&agent_id),
        command: command.clone(),
        args: args.clone(),
        cwd: cwd_str.clone(),
        process: Some(process),
        writer: Some(BufWriter::new(stdin)),
        state: AcpSessionState::Initializing,
        agent_session_id: resume_session_id.clone(),
        next_request_id: 3,
    };

    // Handshake: initialize + session/new 或 session/load 立即发出。
    // 带 resume_session_id 时 session/load 重接已知会话（agent 会回放历史），否则创建新会话。
    let init_req = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": 1,
            "clientCapabilities": {
                "fs": { "readTextFile": true, "writeTextFile": true },
                "terminal": true
            },
            "clientInfo": { "name": "Aura IDE", "version": env!("CARGO_PKG_VERSION") }
        }
    });
    write_jsonrpc(session.writer.as_mut().unwrap(), &init_req)?;

    match resume_session_id.as_ref() {
        Some(rid) => {
            let load_req = json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "session/load",
                "params": { "sessionId": rid, "cwd": cwd_str, "mcpServers": [] }
            });
            write_jsonrpc(session.writer.as_mut().unwrap(), &load_req)?;
        }
        None => {
            let new_req = json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "session/new",
                "params": { "cwd": cwd_str, "mcpServers": [] }
            });
            write_jsonrpc(session.writer.as_mut().unwrap(), &new_req)?;
        }
    }

    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        sessions.insert(session_id.clone(), session);
    }

    let reader_state = AcpState {
        sessions: state.sessions.clone(),
    };
    let reader_app = app.clone();
    let reader_session_id = session_id.clone();
    std::thread::spawn(move || {
        run_acp_session_reader(
            reader_session_id,
            reader_app,
            reader_state,
            BufReader::new(stdout),
            BufReader::new(stderr),
        );
    });

    Ok(json!({
        "protocolVersion": 1,
        "agentInfo": {
            "name": agent_id,
            "protocolVersion": 1,
            "capabilities": {
                "fs": true,
                "terminal": true,
                "permission": true,
                "authMethods": []
            }
        }
    }))
}

#[tauri::command]
fn acp_send_prompt(
    session_id: String,
    message: String,
    state: State<'_, AcpState>,
) -> Result<bool, String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get_mut(&session_id).ok_or("ACP session not found")?;

    let agent_session_id = session
        .agent_session_id
        .clone()
        .ok_or_else(|| "Session not ready yet (waiting for ACP session/new response)".to_string())?;

    let id = session.next_request_id;
    session.next_request_id += 1;

    let msg = json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "session/prompt",
        "params": {
            "sessionId": agent_session_id,
            "prompt": [{ "type": "text", "text": message }]
        }
    });
    write_jsonrpc(session.writer.as_mut().ok_or("No writer available")?, &msg)?;
    Ok(true)
}

#[tauri::command]
fn acp_cancel(session_id: String, state: State<'_, AcpState>) -> Result<bool, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get(&session_id).ok_or("ACP session not found")?;
    let sid = session
        .agent_session_id
        .clone()
        .ok_or_else(|| "Session not ready yet".to_string())?;
    drop(sessions);
    let msg = json!({ "jsonrpc": "2.0", "method": "session/cancel", "params": { "sessionId": sid } });
    dispatch_to_session(&state, &session_id, &msg)?;
    Ok(true)
}

// ---------- EverOS / local memo (/save) ----------
fn expand_home(p: &str) -> PathBuf {
    if p == "~" {
        return std::env::var("HOME").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from(p));
    }
    if let Some(rest) = p.strip_prefix("~/") {
        return std::env::var("HOME").map(|h| PathBuf::from(h).join(rest)).unwrap_or_else(|_| PathBuf::from(p));
    }
    PathBuf::from(p)
}

fn memo_slug(input: &str) -> String {
    let s: String = input
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let s = s.trim_matches('_').to_string();
    if s.is_empty() {
        "x".to_string()
    } else if s.chars().count() > 64 {
        s.chars().take(64).collect()
    } else {
        s
    }
}

fn iso_utc_now() -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    // civil-from-days (Hinnant algorithm), no chrono dependency needed
    let z = days as i64 + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mo = if mp < 10 { mp + 3 } else { mp - 9 };
    let yr = if mo <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", yr, mo, d, h, m, s)
}

/// curl 子进程 POST JSON —— 不动依赖，和 /usr/bin/sqlite3 子进程模式一致
fn curl_post_json(base_url: &str, path: &str, payload: &Value) -> Result<(u16, Value), String> {
    let url = format!("{}{}", base_url.trim_end_matches('/'), path);
    let body = serde_json::to_string(payload).map_err(|e| e.to_string())?;
    let mut child = Command::new("curl")
        .args([
            "-s", "-m", "20",
            "-w", "\n__HTTP_STATUS__:%{http_code}",
            "-X", "POST",
            "-H", "Content-Type: application/json",
            "--data-binary", "@-",
            &url,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("无法启动 curl（请求 EverOS 失败）: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(body.as_bytes());
    }
    let output = child.wait_with_output().map_err(|e| format!("curl 执行失败: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let (json_part, status) = match stdout.rfind("__HTTP_STATUS__:") {
        Some(pos) => {
            let code = stdout[pos + 16..].trim().parse::<u16>().unwrap_or(0);
            (stdout[..pos].trim().to_string(), code)
        }
        None => (stdout.trim().to_string(), 0),
    };
    let body_json: Value = serde_json::from_str(&json_part).unwrap_or(json!({ "raw": json_part }));
    Ok((status, body_json))
}

#[tauri::command]
fn memory_save(
    session_id: String,
    agent_id: String,
    agent_session_id: Option<String>,
    title: String,
    workspace: String,
    body: String,
) -> Result<Value, String> {
    let ws_path = PathBuf::from(&workspace);
    let ws_slug = ws_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("workspace")
        .to_string();
    let session_part = agent_session_id.clone().unwrap_or_else(|| session_id.clone());
    let agent_slug = memo_slug(&agent_id);
    let sid_slug = memo_slug(&session_part);

    let config = read_aura_config()?;
    let memos_dir = config
        .memory
        .as_ref()
        .and_then(|m| m.memos_dir.as_deref())
        .filter(|s| !s.is_empty())
        .map(expand_home)
        .unwrap_or_else(|| expand_home("~/.config/aura/memos"));
    fs::create_dir_all(&memos_dir).map_err(|e| format!("无法创建 {}: {}", memos_dir.display(), e))?;
    let file_path = memos_dir.join(format!("{}__{}__{}.md", ws_slug, agent_slug, sid_slug));

    let created = !file_path.exists();
    let timestamp = iso_utc_now();
    if created {
        let header = format!(
            "---\nsession_id: {}\nagent_session_id: {}\nagent: {}\nworkspace: {}\ntitle: {}\ncreated: {}\n---\n\n# {}\n\n",
            session_id, session_part, agent_id, workspace, title, timestamp, title
        );
        fs::write(&file_path, header.as_bytes()).map_err(|e| format!("写入 {} 失败: {}", file_path.display(), e))?;
    }
    let section = format!("## {}\n\n{}\n\n---\n\n", timestamp, body.trim());
    let mut file = fs::OpenOptions::new()
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("打开 {} 失败: {}", file_path.display(), e))?;
    file.write_all(section.as_bytes()).map_err(|e| format!("写入 {} 失败: {}", file_path.display(), e))?;
    drop(file);

    let mut everos_ok = false;
    let mut everos_error: Option<String> = None;
    let mut everos_task_id: Option<String> = None;
    let everos = config.memory.as_ref().and_then(|m| m.everos.clone());
    let everos_enabled = everos.as_ref().map(|e| e.enabled).unwrap_or(false);
    if let Some(everos) = everos.filter(|e| {
        e.enabled && e.base_url.as_deref().map(|s| !s.is_empty()).unwrap_or(false)
    }) {
        let base = everos.base_url.clone().unwrap_or_default();
        let base = base.trim_end_matches('/');
        let user_id = everos.user_id.clone().filter(|s| !s.is_empty()).unwrap_or_else(|| "aura".to_string());
        let space = everos.space.clone().filter(|s| !s.is_empty()).unwrap_or_else(|| format!("coding:{}", ws_slug));
        let ts_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        let message_id = format!("msg_{}", ts_ms);
        let store_content = format!("**{}** · {} · {}\n\n{}", title, agent_id, timestamp, body.trim());
        let payload = json!({
            "group_id": space,
            "messages": [{
                "role": "user",
                "timestamp": ts_ms,
                "content": store_content,
                "sender_id": user_id,
                "sender_name": user_id,
                "message_id": message_id
            }],
            "async_mode": true
        });
        match curl_post_json(base, "/api/v1/memories/group", &payload) {
            Ok((code, body)) => {
                if (200..300).contains(&code) {
                    everos_ok = true;
                    everos_task_id = body
                        .pointer("/data/task_id")
                        .and_then(|v| v.as_str())
                        .map(String::from)
                        .or_else(|| body.get("task_id").and_then(|v| v.as_str()).map(String::from));
                } else {
                    let msg = body
                        .get("message")
                        .and_then(|v| v.as_str())
                        .or_else(|| body.get("detail").and_then(|v| v.as_str()))
                        .unwrap_or("")
                        .to_string();
                    everos_error = Some(format!("HTTP {} {}", code, msg));
                }
            }
            Err(e) => everos_error = Some(e),
        }
    }

    Ok(json!({
        "memoPath": file_path.to_string_lossy().to_string(),
        "created": created,
        "everos": {
            "enabled": everos_enabled,
            "ok": everos_ok,
            "taskId": everos_task_id,
            "error": everos_error
        }
    }))
}

/// 会话删除时同步删除该会话产出的 /save memo 文件
#[tauri::command]
fn memory_delete_memo(session_id: String) -> Result<Value, String> {
    let config = read_aura_config()?;
    let memos_dir = config
        .memory
        .as_ref()
        .and_then(|m| m.memos_dir.as_deref())
        .filter(|s| !s.is_empty())
        .map(expand_home)
        .unwrap_or_else(|| expand_home("~/.config/aura/memos"));
    let mut deleted: Vec<String> = Vec::new();
    if memos_dir.exists() {
        let safe_id = memo_slug(&session_id);
        let suffix = format!("__{}.md", safe_id);
        for entry in fs::read_dir(&memos_dir).map_err(|e| format!("读取 {} 失败: {}", memos_dir.display(), e))? {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(&suffix) {
                let path = entry.path();
                if let Err(e) = fs::remove_file(&path) {
                    eprintln!("[aura] 删除 /save memo 失败 {}: {}", path.display(), e);
                } else {
                    deleted.push(path.to_string_lossy().to_string());
                }
            }
        }
    }
    Ok(json!({ "deleted": deleted, "count": deleted.len() }))
}

#[tauri::command]
fn acp_set_config_option(
    session_id: String,
    config_id: String,
    value: String,
    state: State<'_, AcpState>,
) -> Result<bool, String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get_mut(&session_id).ok_or("ACP session not found")?;
    let agent_session_id = session
        .agent_session_id
        .clone()
        .ok_or_else(|| "Session not ready yet".to_string())?;

    let id = session.next_request_id;
    session.next_request_id += 1;

    let msg = json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "session/set_config_option",
        "params": { "sessionId": agent_session_id, "configId": config_id, "value": value }
    });
    write_jsonrpc(session.writer.as_mut().ok_or("No writer available")?, &msg)?;
    Ok(true)
}

// ----------------- Aura user config (~/.config/aura/aura.json) -----------------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AcpAgentDef {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentsSection {
    #[serde(default)]
    pub acp: Vec<AcpAgentDef>,
}

/// EverOS memory service config (记忆服务）. 其他未配置用户跳过 EverOS，落到本地 memo。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EverOsMemoryConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub user_id: Option<String>,
    #[serde(default)]
    pub space: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySection {
    #[serde(default)]
    pub everos: Option<EverOsMemoryConfig>,
    #[serde(default)]
    pub memos_dir: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuraConfig {
    pub version: u32,
    #[serde(default)]
    pub agents: Option<AgentsSection>,
    #[serde(default)]
    pub memory: Option<MemorySection>,
}

impl Default for AuraConfig {
    fn default() -> Self {
        Self {
            version: 1,
            agents: Some(AgentsSection {
                acp: default_acp_agents(),
            }),
            memory: None,
        }
    }
}

fn default_acp_agents() -> Vec<AcpAgentDef> {
    let defs = vec![
        ("agy-acp", "agy acp", "agy", vec!["acp"]),
        ("opencode", "opencode acp", "opencode", vec!["acp"]),
        ("gemini", "gemini acp", "gemini", vec!["--acp"]),
        ("claude", "claude acp", "npx", vec!["@agentclientprotocol/claude-agent-acp"]),
        ("codex", "codex acp", "npx", vec!["@agentclientprotocol/codex-acp"]),
    ];
    defs.into_iter()
        .map(|(id, name, command, args)| AcpAgentDef {
            id: id.to_string(),
            name: name.to_string(),
            command: command.to_string(),
            args: args.into_iter().map(|s| s.to_string()).collect(),
            enabled: true,
        })
        .collect()
}

fn aura_config_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    let dir = PathBuf::from(home).join(".config").join("aura");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
    Ok(dir.join("aura.json"))
}

fn read_aura_config() -> Result<AuraConfig, String> {
    let path = aura_config_path()?;
    if !path.exists() {
        let cfg = AuraConfig::default();
        write_aura_config(&cfg)?;
        return Ok(cfg);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    match serde_json::from_str::<AuraConfig>(&raw) {
        Ok(cfg) => Ok(cfg),
        Err(e) => {
            // Quarantine the broken file, then regenerate defaults
            let backup = path.with_extension(format!("json.broken-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)));
            let _ = fs::rename(&path, &backup);
            eprintln!("[aura] aura.json parse error: {} (quarantined to {}). Regenerating defaults.", e, backup.display());
            let cfg = AuraConfig::default();
            let _ = write_aura_config(&cfg);
            Ok(cfg)
        }
    }
}

fn write_aura_config(cfg: &AuraConfig) -> Result<(), String> {
    let path = aura_config_path()?;
    let tmp = path.with_extension("json.tmp");
    let serialized = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&tmp, serialized).map_err(|e| format!("Failed to write {}: {}", tmp.display(), e))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Failed to replace {}: {}", path.display(), e))?;
    Ok(())
}

#[tauri::command]
fn config_read_acp_agents() -> Result<Vec<AcpAgentDef>, String> {
    let cfg = read_aura_config()?;
    Ok(cfg.agents.map(|a| a.acp).unwrap_or_default())
}

#[tauri::command]
fn config_write_acp_agents(agents: Vec<AcpAgentDef>) -> Result<bool, String> {
    let mut cfg = read_aura_config()?;
    cfg.agents = Some(AgentsSection { acp: agents });
    write_aura_config(&cfg)?;
    Ok(true)
}

#[tauri::command]
fn config_get_path() -> Result<String, String> {
    Ok(aura_config_path()?.to_string_lossy().to_string())
}

#[tauri::command]
fn acp_stop(session_id: String, state: State<'_, AcpState>) -> Result<bool, String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        if let Some(mut child) = session.process.take() {
            #[cfg(unix)]
            {
                let pid = child.id();
                unsafe {
                    libc::kill(-(pid as i32), libc::SIGKILL);
                    libc::kill(pid as i32, libc::SIGKILL);
                }
                let _ = Command::new("pkill").args(["-9", "-P", &pid.to_string()]).output();
            }
            let _ = child.kill();
            let _ = child.wait();
        }
        return Ok(true);
    }
    Ok(false)
}

// ----------------- Agent Session Record -----------------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentSessionRecord {
    pub id: String,
    pub title: String,
    pub agent_name: String,
    pub agent_command: String,
    pub agent_id: String,
    pub created_at: Option<i64>,
    pub project_path: Option<String>,
    pub project_name: Option<String>,
}

fn extract_project_from_uris(uris_str: &str) -> (Option<String>, Option<String>) {
    let clean = uris_str.trim();
    if clean.is_empty() {
        return (None, None);
    }
    if let Ok(arr) = serde_json::from_str::<Vec<String>>(clean) {
        if let Some(first) = arr.first() {
            let path_str = if first.starts_with("file://") {
                first.trim_start_matches("file://")
            } else {
                first.as_str()
            };
            if !path_str.is_empty() {
                let p = Path::new(path_str);
                let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "Project".to_string());
                return (Some(path_str.to_string()), Some(name));
            }
        }
    }
    if let Some(idx) = clean.find("file://") {
        let after = &clean[idx + 7..];
        let end_idx = after.find('"').or_else(|| after.find('\'')).or_else(|| after.find(']')).unwrap_or(after.len());
        let path_str = &after[..end_idx];
        if !path_str.is_empty() {
            let p = Path::new(path_str);
            let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "Project".to_string());
            return (Some(path_str.to_string()), Some(name));
        }
    }
    (None, None)
}

fn extract_project_from_dir(dir_str: &str) -> (Option<String>, Option<String>) {
    let clean = dir_str.trim();
    if clean.is_empty() {
        return (None, None);
    }
    let p = Path::new(clean);
    let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "Project".to_string());
    (Some(clean.to_string()), Some(name))
}

fn run_sqlite_json_query(db_path: &Path, query: &str) -> Option<serde_json::Value> {
    if !db_path.exists() {
        return None;
    }
    let sqlite_cmd = if Path::new("/usr/bin/sqlite3").exists() {
        "/usr/bin/sqlite3"
    } else {
        "sqlite3"
    };
    let output = Command::new(sqlite_cmd)
        .args([db_path.to_str()?, "-json", query])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        return Some(serde_json::Value::Array(Vec::new()));
    }
    serde_json::from_str(&stdout).ok()
}

#[tauri::command]
fn system_fetch_project_agent_sessions(workspace_dir: String) -> Result<Vec<AgentSessionRecord>, String> {
    let ws_clean = workspace_dir.trim().trim_end_matches('/');
    let ws_path = if !ws_clean.is_empty() {
        let p = PathBuf::from(ws_clean);
        p.canonicalize().unwrap_or(p)
    } else {
        PathBuf::new()
    };
    let ws_str = ws_path.to_string_lossy().to_string();

    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/Yang".to_string());
    let mut sessions: Vec<AgentSessionRecord> = Vec::new();

    // 1. Antigravity-CLI SQLite DB
    let agy_db = PathBuf::from(&home).join(".gemini/antigravity-cli/conversation_summaries.db");
    if agy_db.exists() {
        let query = "SELECT conversation_id, title, preview, workspace_uris, last_modified_time FROM conversation_summaries ORDER BY last_modified_time DESC";
        if let Some(val) = run_sqlite_json_query(&agy_db, query) {
            if let Some(arr) = val.as_array() {
                for item in arr {
                    let id = item.get("conversation_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if id.is_empty() {
                        continue;
                    }
                    let uris_str = item.get("workspace_uris").and_then(|v| v.as_str()).unwrap_or("");
                    let (proj_path, proj_name) = extract_project_from_uris(uris_str);

                    let raw_title = item.get("title").and_then(|v| v.as_str()).unwrap_or("").trim();
                    let raw_preview = item.get("preview").and_then(|v| v.as_str()).unwrap_or("").trim();
                    let title = if !raw_title.is_empty() {
                        raw_title.to_string()
                    } else if !raw_preview.is_empty() {
                        raw_preview.to_string()
                    } else {
                        "Google Antigravity Session".to_string()
                    };

                    sessions.push(AgentSessionRecord {
                        id,
                        title,
                        agent_name: "Google Antigravity".to_string(),
                        agent_command: "agy".to_string(),
                        agent_id: "antigravity".to_string(),
                        created_at: None,
                        project_path: proj_path,
                        project_name: proj_name,
                    });
                }
            }
        }
    }

    // 2. OpenCode SQLite DB
    let oc_db = PathBuf::from(&home).join(".local/share/opencode/opencode.db");
    if oc_db.exists() {
        let query = "SELECT id, title, slug, directory, time_updated FROM session_v2 ORDER BY time_updated DESC";
        if let Some(val) = run_sqlite_json_query(&oc_db, query) {
            if let Some(arr) = val.as_array() {
                for item in arr {
                    let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if id.is_empty() {
                        continue;
                    }
                    let dir = item.get("directory").and_then(|v| v.as_str()).unwrap_or("");
                    let (proj_path, proj_name) = extract_project_from_dir(dir);

                    let raw_title = item.get("title").and_then(|v| v.as_str()).unwrap_or("").trim();
                    let slug = item.get("slug").and_then(|v| v.as_str()).unwrap_or("").trim();
                    let title = if !raw_title.is_empty() {
                        raw_title.to_string()
                    } else if !slug.is_empty() {
                        slug.to_string()
                    } else {
                        "OpenCode Session".to_string()
                    };
                    let time_updated = item.get("time_updated").and_then(|v| v.as_i64());

                    sessions.push(AgentSessionRecord {
                        id,
                        title,
                        agent_name: "OpenCode".to_string(),
                        agent_command: "opencode".to_string(),
                        agent_id: "opencode".to_string(),
                        created_at: time_updated,
                        project_path: proj_path,
                        project_name: proj_name,
                    });
                }
            }
        }
    }

    // 3. Codex SQLite DB (~/.codex/state_5.sqlite or state_*.sqlite)
    let codex_dir = PathBuf::from(&home).join(".codex");
    if codex_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&codex_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let fname = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                if fname.starts_with("state_") && fname.ends_with(".sqlite") {
                    let query = "SELECT id, title, first_user_message, preview, cwd, updated_at FROM threads ORDER BY updated_at DESC";
                    if let Some(val) = run_sqlite_json_query(&path, query) {
                        if let Some(arr) = val.as_array() {
                            for item in arr {
                                let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                if id.is_empty() {
                                    continue;
                                }
                                let cwd = item.get("cwd").and_then(|v| v.as_str()).unwrap_or("");
                                let (proj_path, proj_name) = extract_project_from_dir(cwd);

                                let raw_title = item.get("title").and_then(|v| v.as_str()).unwrap_or("").trim();
                                let first_msg = item.get("first_user_message").and_then(|v| v.as_str()).unwrap_or("").trim();
                                let preview = item.get("preview").and_then(|v| v.as_str()).unwrap_or("").trim();
                                let title = if !raw_title.is_empty() {
                                    raw_title.to_string()
                                } else if !first_msg.is_empty() {
                                    first_msg.to_string()
                                } else if !preview.is_empty() {
                                    preview.to_string()
                                } else {
                                    "Codex Session".to_string()
                                };
                                let updated_at = item.get("updated_at").and_then(|v| v.as_i64());

                                sessions.push(AgentSessionRecord {
                                    id,
                                    title,
                                    agent_name: "Codex".to_string(),
                                    agent_command: "codex".to_string(),
                                    agent_id: "codex".to_string(),
                                    created_at: updated_at,
                                    project_path: proj_path,
                                    project_name: proj_name,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Claude CLI (~/.claude/history.jsonl)
    let claude_history = PathBuf::from(&home).join(".claude/history.jsonl");
    if claude_history.exists() {
        if let Ok(content) = std::fs::read_to_string(&claude_history) {
            let mut claude_map: std::collections::HashMap<String, (String, i64, Option<String>)> = std::collections::HashMap::new();
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
                    let session_id = val.get("sessionId").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if session_id.is_empty() {
                        continue;
                    }
                    let display = val.get("display").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                    let timestamp = val.get("timestamp").and_then(|v| v.as_i64()).unwrap_or(0);
                    let proj = val.get("project").or_else(|| val.get("cwd")).and_then(|v| v.as_str()).map(|s| s.to_string());

                    match claude_map.get(&session_id) {
                        Some((curr_display, _, _)) => {
                            if curr_display.starts_with('/') && !display.starts_with('/') && !display.is_empty() {
                                claude_map.insert(session_id, (display, timestamp, proj));
                            }
                        }
                        None => {
                            claude_map.insert(session_id, (display, timestamp, proj));
                        }
                    }
                }
            }

            for (session_id, (display, ts, proj)) in claude_map {
                let title = if !display.is_empty() {
                    display
                } else {
                    "Claude Session".to_string()
                };
                let (proj_path, proj_name) = if let Some(ref p) = proj {
                    extract_project_from_dir(p)
                } else {
                    (None, None)
                };
                sessions.push(AgentSessionRecord {
                    id: session_id,
                    title,
                    agent_name: "Claude".to_string(),
                    agent_command: "claude".to_string(),
                    agent_id: "claude".to_string(),
                    created_at: Some(ts),
                    project_path: proj_path,
                    project_name: proj_name,
                });
            }
        }
    }

    // Sort: sessions matching current workspace come first
    if !ws_str.is_empty() {
        sessions.sort_by(|a, b| {
            let a_match = a.project_path.as_deref().map(|p| p == ws_str || p == ws_clean).unwrap_or(false);
            let b_match = b.project_path.as_deref().map(|p| p == ws_str || p == ws_clean).unwrap_or(false);
            b_match.cmp(&a_match)
        });
    }

    Ok(sessions)
}

fn sql_escape_string(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

fn run_sqlite_exec(db_path: &Path, query: &str) -> Option<i32> {
    if !db_path.exists() {
        return None;
    }
    let sqlite_cmd = if Path::new("/usr/bin/sqlite3").exists() {
        "/usr/bin/sqlite3"
    } else {
        "sqlite3"
    };
    let output = Command::new(sqlite_cmd)
        .args([db_path.to_str()?, query])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    stdout.parse::<i32>().ok()
}

#[tauri::command]
fn system_update_project_agent_session_title(
    _workspace_dir: String,
    session_id: String,
    new_title: String,
) -> Result<bool, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/Yang".to_string());
    let clean_title = new_title.trim();
    if clean_title.is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    let escaped_title = sql_escape_string(clean_title);
    let escaped_id = sql_escape_string(&session_id);

    // 1. Antigravity-CLI SQLite DB
    let agy_db = PathBuf::from(&home).join(".gemini/antigravity-cli/conversation_summaries.db");
    if agy_db.exists() {
        let sql = format!(
            "UPDATE conversation_summaries SET title = {} WHERE conversation_id = {}; SELECT changes();",
            escaped_title, escaped_id
        );
        if let Some(changes) = run_sqlite_exec(&agy_db, &sql) {
            if changes > 0 {
                return Ok(true);
            }
        }
    }

    // 2. OpenCode SQLite DB
    let oc_db = PathBuf::from(&home).join(".local/share/opencode/opencode.db");
    if oc_db.exists() {
        let sql = format!(
            "UPDATE session_v2 SET title = {} WHERE id = {}; SELECT changes();",
            escaped_title, escaped_id
        );
        if let Some(changes) = run_sqlite_exec(&oc_db, &sql) {
            if changes > 0 {
                return Ok(true);
            }
        }
    }

    // 3. Codex SQLite DB
    let codex_dir = PathBuf::from(&home).join(".codex");
    if codex_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&codex_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let fname = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                if fname.starts_with("state_") && fname.ends_with(".sqlite") {
                    let sql = format!(
                        "UPDATE threads SET title = {} WHERE id = {}; SELECT changes();",
                        escaped_title, escaped_id
                    );
                    if let Some(changes) = run_sqlite_exec(&path, &sql) {
                        if changes > 0 {
                            return Ok(true);
                        }
                    }
                }
            }
        }
    }

    // 4. Claude CLI (~/.claude/history.jsonl)
    let claude_history = PathBuf::from(&home).join(".claude/history.jsonl");
    if claude_history.exists() {
        if let Ok(content) = std::fs::read_to_string(&claude_history) {
            let mut updated = false;
            let mut new_lines = Vec::new();
            for line in content.lines() {
                if let Ok(mut val) = serde_json::from_str::<serde_json::Value>(line) {
                    if val.get("sessionId").and_then(|v| v.as_str()) == Some(&session_id) {
                        val["display"] = serde_json::Value::String(clean_title.to_string());
                        new_lines.push(serde_json::to_string(&val).unwrap_or_else(|_| line.to_string()));
                        updated = true;
                        continue;
                    }
                }
                new_lines.push(line.to_string());
            }
            if updated {
                let _ = std::fs::write(&claude_history, new_lines.join("\n") + "\n");
                return Ok(true);
            }
        }
    }

    Ok(true)
}

fn delete_agy_session(home: &str, session_id: &str) -> bool {
    let escaped_id = sql_escape_string(session_id);
    let mut changed = false;

    // 1) Conversation index row
    let agy_db = PathBuf::from(home).join(".gemini/antigravity-cli/conversation_summaries.db");
    if agy_db.exists() {
        let sql = format!(
            "DELETE FROM conversation_summaries WHERE conversation_id = {}; SELECT changes();",
            escaped_id
        );
        if run_sqlite_exec(&agy_db, &sql).unwrap_or(0) > 0 {
            changed = true;
        }
    }

    // 2) Per-conversation steps DB (and brain/<id>) — belongs to the conversation
    let conv_db = PathBuf::from(home).join(".gemini/antigravity-cli/conversations").join(format!("{}.db", session_id));
    if conv_db.exists() {
        if std::fs::remove_file(&conv_db).is_ok() {
            changed = true;
        }
    }
    let brain_dir = PathBuf::from(home).join(".gemini/antigravity-cli/brain").join(session_id);
    if brain_dir.is_dir() {
        let _ = std::fs::remove_dir_all(&brain_dir);
    }

    changed
}

fn delete_opencode_session(home: &str, session_id: &str) -> bool {
    let oc_db = PathBuf::from(home).join(".local/share/opencode/opencode.db");
    if !oc_db.exists() {
        return false;
    }
    let escaped_id = sql_escape_string(session_id);
    // session_message / session_part / session_inbox cascade via ON DELETE CASCADE
    let sql = format!(
        "PRAGMA foreign_keys = ON; DELETE FROM session_v2 WHERE id = {}; SELECT changes();",
        escaped_id
    );
    run_sqlite_exec(&oc_db, &sql).unwrap_or(0) > 0
}

fn delete_codex_session(home: &str, session_id: &str) -> bool {
    let codex_dir = PathBuf::from(home).join(".codex");
    if !codex_dir.is_dir() {
        return false;
    }
    let escaped_id = sql_escape_string(session_id);
    let mut changed = false;
    if let Ok(entries) = std::fs::read_dir(&codex_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let fname = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            if fname.starts_with("state_") && fname.ends_with(".sqlite") {
                // thread_dynamic_tools / stage1_outputs / agent_job_items cascade via ON DELETE CASCADE
                let sql = format!(
                    "PRAGMA foreign_keys = ON; DELETE FROM threads WHERE id = {}; SELECT changes();",
                    escaped_id
                );
                if run_sqlite_exec(&path, &sql).unwrap_or(0) > 0 {
                    changed = true;
                }
            }
        }
    }
    changed
}

fn delete_claude_session(home: &str, session_id: &str) -> bool {
    let claude_history = PathBuf::from(home).join(".claude/history.jsonl");
    if !claude_history.exists() {
        return false;
    }
    if let Ok(content) = std::fs::read_to_string(&claude_history) {
        let mut changed = false;
        let mut new_lines = Vec::new();
        for line in content.lines() {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                if val.get("sessionId").and_then(|v| v.as_str()) == Some(session_id) {
                    changed = true;
                    continue;
                }
            }
            new_lines.push(line.to_string());
        }
        if changed {
            let _ = std::fs::write(&claude_history, new_lines.join("\n") + "\n");
        }
        return changed;
    }
    false
}

#[tauri::command]
fn system_delete_project_agent_session(
    _workspace_dir: String,
    session_id: String,
    agent_hint: Option<String>,
) -> Result<bool, String> {
    if session_id.trim().is_empty() {
        return Err("session_id cannot be empty".to_string());
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/Yang".to_string());

    // Normalize an optional agent hint into one of the known families.
    let family = agent_hint
        .as_deref()
        .unwrap_or("")
        .to_lowercase();
    let family_key = if family.contains("agy") || family.contains("antigravity") {
        Some("agy")
    } else if family.contains("opencode") {
        Some("opencode")
    } else if family.contains("codex") {
        Some("codex")
    } else if family.contains("claude") {
        Some("claude")
    } else {
        None
    };

    // A resolved hint deletes ONLY from the corresponding agent store.
    // No hint falls back to scanning every store (legacy behavior).
    let mut deleted_any = false;
    match family_key {
        Some("agy") => deleted_any = delete_agy_session(&home, &session_id),
        Some("opencode") => deleted_any = delete_opencode_session(&home, &session_id),
        Some("codex") => deleted_any = delete_codex_session(&home, &session_id),
        Some("claude") => deleted_any = delete_claude_session(&home, &session_id),
        _ => {
            deleted_any |= delete_agy_session(&home, &session_id);
            deleted_any |= delete_opencode_session(&home, &session_id);
            deleted_any |= delete_codex_session(&home, &session_id);
            deleted_any |= delete_claude_session(&home, &session_id);
        }
    }

    Ok(deleted_any)
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

    let agent_cmd_opt = match mode.as_deref() {
        Some("shell") | None => None,
        Some(m) if m.starts_with("agent:") => Some(m.trim_start_matches("agent:")),
        Some(m) => Some(m),
    };

    for (k, v) in std::env::vars() {
        // Skip PWD (set below)
        if k == "PWD" {
            continue;
        }
        // Agent launches only: strip npm/pnpm script-context env vars — they confuse
        // Bun-compiled agent binaries into thinking they were launched via `npm run`
        // (e.g. Claude Code drops into "npm script environment" instead of the TUI).
        if agent_cmd_opt.is_some() {
            let lk = k.to_ascii_lowercase();
            if lk.starts_with("npm_") || lk.starts_with("pnpm_") {
                continue;
            }
        }
        cmd.env(k, v);
    }
    cmd.env("PWD", resolved_cwd.to_string_lossy().to_string());
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    if let Some(agent_cmd) = agent_cmd_opt {
        let parts: Vec<&str> = agent_cmd.split_whitespace().collect();
        let bin_string = if let Some(&first) = parts.first() {
            if let Some(found_path) = resolve_candidate_path(first) {
                let mut full = found_path.to_string_lossy().to_string();
                if parts.len() > 1 {
                    full.push(' ');
                    full.push_str(&parts[1..].join(" "));
                }
                full
            } else {
                agent_cmd.to_string()
            }
        } else {
            agent_cmd.to_string()
        };

        if cfg!(windows) {
            cmd.arg("-Command");
            cmd.arg(format!("Set-Location '{}'; & {}", resolved_cwd.to_string_lossy(), bin_string));
        } else {
            cmd.arg("-l");
            cmd.arg("-c");
            cmd.arg(format!("cd '{}' && exec {}", resolved_cwd.to_string_lossy(), bin_string));
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
        .manage(AcpState::new())
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
            git_get_current_branch,
            git_get_commits,
            git_get_commit_files,
            git_get_file_diff,
            git_get_head_content,
            git_commit,
            git_push,
            system_detect_agents,
            system_scan_agent_dirs,
            system_scan_local_bin,
            system_refresh_agent_cache,
            system_register_custom_agent,
            system_fetch_project_agent_sessions,
            system_update_project_agent_session_title,
            system_delete_project_agent_session,
            terminal_create,
            terminal_ready,
            terminal_write,
            terminal_resize,
            terminal_kill,
            acp_initialize,
            acp_stop,
            acp_send_prompt,
            acp_cancel,
            acp_set_config_option,
            config_read_acp_agents,
            config_write_acp_agents,
            config_get_path,
            memory_save,
            memory_delete_memo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ----------------- Tests -----------------
#[cfg(test)]
mod aura_agent_tests {
    use super::*;

    #[test]
    fn known_agents_json_parses_and_is_unique() {
        let known: Vec<KnownAgent> = serde_json::from_str(KNOWN_AGENTS_JSON).unwrap();
        assert!(!known.is_empty(), "known-agents.json must not be empty");
        let mut ids: Vec<&str> = known.iter().map(|k| k.id.as_str()).collect();
        ids.sort();
        let total = ids.len();
        ids.dedup();
        assert_eq!(total, ids.len(), "known-agents.json contains duplicate ids");
        assert!(known.iter().all(|k| !k.command.is_empty()));
        assert!(known.iter().any(|k| k.id == "agy-acp" && k.acp));
    }

    #[test]
    fn detect_known_agents_finds_agy() {
        let list = detect_known_agents();
        let agy = list.iter().find(|a| a.id == "agy").expect("agy entry missing");
        assert!(agy.is_installed, "agy should be detected in ~/.local/bin");
        assert!(agy.path.as_deref().map(|p| Path::new(p).is_file()).unwrap_or(false));
    }

    #[test]
    fn detect_known_agents_finds_opencode_via_homebrew() {
        let list = detect_known_agents();
        let opencode = list.iter().find(|a| a.id == "opencode").expect("opencode entry missing");
        assert!(opencode.is_installed, "opencode should be detected in /opt/homebrew/bin");
        assert!(
            opencode.path.as_deref().unwrap_or("").starts_with("/opt/homebrew/bin"),
            "opencode should come from /opt/homebrew/bin, got {:?}",
            opencode.path
        );
    }

    #[test]
    fn agent_scan_dirs_includes_homebrew_and_local_bin() {
        let dirs = agent_scan_dirs();
        let joined: Vec<String> = dirs.iter().map(|d| d.to_string_lossy().to_string()).collect();
        assert!(
            joined.contains(&"/opt/homebrew/bin".to_string()),
            "scan dirs must include /opt/homebrew/bin (whyis output location)"
        );
        let home = std::env::var("HOME").unwrap();
        assert!(joined.iter().any(|d| d.ends_with(".local/bin") || d.ends_with("/.local/bin")));
        assert!(joined.iter().any(|d| d.starts_with(&home)));
    }

    #[test]
    fn detection_cache_roundtrip() {
        // Save any pre-existing real cache and restore it afterwards
        let path = detection_cache_path().unwrap();
        let original = std::fs::read_to_string(&path).ok();

        let dummy = DetectedAgent {
            id: "custom-test-agent".into(),
            name: "custom-test-agent".into(),
            command: "custom-test-agent".into(),
            description: "test agent".into(),
            category: "test".into(),
            is_installed: true,
            install_command: String::new(),
            path: Some("/bin/zsh".into()),
            acp: false,
        };
        write_detection_cache(&[dummy]);
        let cached = read_detection_cache().expect("cache should be readable right after writing");
        assert_eq!(cached.len(), 1);
        assert_eq!(cached[0].id, "custom-test-agent");

        match original {
            Some(contents) => { let _ = std::fs::write(&path, contents); }
            None => { let _ = std::fs::remove_file(&path); }
        }
    }
}
