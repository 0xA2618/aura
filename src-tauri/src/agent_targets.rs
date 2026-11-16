//! Phase 2：agent CLI 自动注入适配器（Claude Code / Codex）
//!
//! 语义约定：
//! - enable：先把目标配置文件备份为 `<file>.aura-bak-<unix-ts>`（存在才备份），再做原子写入；
//! - disable：只移除本适配器写入的精确键 / 精确段（surgical），保留用户其余配置；
//! - 绝不覆盖不是 aura 写入的内容；找不到目标文件时按"无事可做"处理；
//! - 所有外部进程调用仅限 python3（TOML 语法校验，可选），不联网、不读密钥。
//! - aura-managed 标记：Codex 段用 `# aura-managed` … `# /aura-managed` 包裹，便于精确识别与移除。

use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

pub struct TargetContext {
    pub home: String,
    pub provider_id: String,
    pub protocol: String,
    pub port: u16,
    /// 第一个启用模型（来自 opencode.json 的 provider.models 键序）；enable 时必须非空
    pub model: String,
}

fn unix_ts() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn backup_file(path: &PathBuf) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let ts = unix_ts();
    let backup = path.with_file_name(format!(
        "{}.aura-bak-{}",
        path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        ts
    ));
    fs::copy(path, &backup)
        .map(|_| ())
        .map_err(|e| format!("failed to back up {}: {}", path.display(), e))
}

fn atomic_write(path: &PathBuf, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed to create {}: {}", parent.display(), e))?;
    }
    let tmp = path.with_extension("aura-tmp");
    fs::write(&tmp, bytes).map_err(|e| format!("failed to write {}: {}", tmp.display(), e))?;
    fs::rename(&tmp, path).map_err(|e| format!("failed to rename {} into place: {}", tmp.display(), e))
}

fn read_config_or_empty(path: &PathBuf) -> Result<String, String> {
    match fs::read_to_string(path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("failed to read {}: {}", path.display(), e)),
    }
}

fn toml_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// 规整空行：连续空行折叠为最多 1 行，并去掉首尾空行 —— enable/disable 往返不留空白漂移
fn tidy_blank_lines(lines: &[String]) -> Vec<String> {
    let mut out = Vec::with_capacity(lines.len());
    let mut prev_blank = false;
    for l in lines {
        let blank = l.trim().is_empty();
        if blank && prev_blank {
            continue;
        }
        out.push(l.clone());
        prev_blank = blank;
    }
    let start = out.iter().position(|l| !l.trim().is_empty()).unwrap_or(out.len());
    out.drain(..start);
    while out.last().map(|l| l.trim().is_empty()).unwrap_or(false) {
        out.pop();
    }
    out
}

fn validate_toml(content: &str) -> Result<(), String> {
    let spawn = Command::new("python3")
        .args(["-c", "import sys, tomllib; tomllib.loads(sys.stdin.read())"])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn();
    let mut child = match spawn {
        Ok(c) => c,
        Err(_) => {
            // 无法运行 python3：跳过校验（仍保留备份），仅告警
            eprintln!("[agent-targets] python3/tomllib unavailable; skipping TOML validation");
            return Ok(());
        }
    };
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(content.as_bytes());
    }
    let output = child.wait_with_output().map_err(|e| format!("failed to wait for python3: {}", e))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "TOML validation failed, aborting without writing: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

// ----------------- Claude Code（~/.claude/settings.json，JSON） -----------------

const CLAUDE_ENV_KEYS: [&str; 4] = [
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_SMALL_FAST_MODEL",
];

fn claude_settings_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".claude").join("settings.json")
}

fn enable_claude(ctx: &TargetContext) -> Result<String, String> {
    if ctx.protocol != "anthropic" {
        return Err("Claude Code requires a provider with protocol=anthropic (Anthropic Messages API)".to_string());
    }
    if ctx.model.trim().is_empty() {
        return Err("no enabled model found in opencode.json for this provider — enable at least one model and save first".to_string());
    }
    let path = claude_settings_path(&ctx.home);
    let raw = read_config_or_empty(&path)?;
    let mut doc: Value = if raw.trim().is_empty() {
        Value::Object(serde_json::Map::new())
    } else {
        serde_json::from_str(&raw).map_err(|e| {
            format!("failed to parse {} as JSON (refusing to clobber): {}", path.display(), e)
        })?
    };
    let obj = doc.as_object_mut().ok_or_else(|| {
        format!("{} is not a JSON object, refusing to modify", path.display())
    })?;
    let mut env = obj.get("env").cloned().unwrap_or(Value::Object(serde_json::Map::new()));
    let env_obj = env
        .as_object_mut()
        .ok_or_else(|| "settings.json `env` field is not an object, refusing to modify".to_string())?;
    backup_file(&path)?;
    env_obj.insert("ANTHROPIC_BASE_URL".to_string(), Value::String(format!("http://127.0.0.1:{}/{}", ctx.port, ctx.provider_id)));
    env_obj.insert("ANTHROPIC_AUTH_TOKEN".to_string(), Value::String("local-rotation".to_string()));
    env_obj.insert("ANTHROPIC_MODEL".to_string(), Value::String(ctx.model.clone()));
    env_obj.insert("ANTHROPIC_SMALL_FAST_MODEL".to_string(), Value::String(ctx.model.clone()));
    obj.insert("env".to_string(), env);
    let out = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    atomic_write(&path, out.as_bytes())?;
    Ok(format!("wrote {} (env) — restart claude to apply", path.display()))
}

fn disable_claude(home: &str) -> Result<String, String> {
    let path = claude_settings_path(home);
    if !path.exists() {
        return Ok("claude settings.json not found — nothing to remove".to_string());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("failed to read {}: {}", path.display(), e))?;
    let mut doc: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("failed to parse {} (refusing to clobber): {}", path.display(), e))?;
    let Some(obj) = doc.as_object_mut() else {
        return Err(format!("{} is not a JSON object", path.display()));
    };
    if let Some(env) = obj.get_mut("env").and_then(|e| e.as_object_mut()) {
        for key in CLAUDE_ENV_KEYS {
            env.remove(key);
        }
        if env.is_empty() {
            obj.remove("env");
        }
    }
    // 如果 settings.json 只剩空对象，也保留文件本身（用户自有文件，不删除）
    let out = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    atomic_write(&path, out.as_bytes())?;
    Ok(format!("removed aura-managed env keys from {}", path.display()))
}

// ----------------- Codex（~/.codex/config.toml，TOML） -----------------

const CODEX_MARK_BEGIN: &str = "# aura-managed";
const CODEX_MARK_END: &str = "# /aura-managed";
const CODEX_TABLE: &str = "[model_providers.aura]";

fn codex_config_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".codex").join("config.toml")
}

/// 移除所有 aura 注入痕迹（标记块、[model_providers.aura] 表、无标记遗留键），其余原样保留。
/// drop_top_model_keys 仅用于 enable：同时移除无表头归属的顶层 `model =` / `model_provider =` 行，
/// 否则 aura 的顶层键会落进最后一个表段，或被用户旧值顶掉（TOML 不允许重复键）。
/// 顶层键只能位于任何 [table] 之前；表内同名键归表所有，必须保留。
fn strip_aura_toml(lines: &[String], drop_top_model_keys: bool) -> Vec<String> {
    let mut out: Vec<String> = Vec::with_capacity(lines.len());
    let mut in_marked = false;
    let mut in_aura_table = false;
    let mut seen_table = false;
    for raw in lines {
        let t = raw.trim();
        if t == CODEX_MARK_BEGIN {
            in_marked = true;
            continue;
        }
        if t == CODEX_MARK_END {
            in_marked = false;
            continue;
        }
        if in_marked {
            continue;
        }
        if t.starts_with('[') {
            seen_table = true;
            in_aura_table = t == CODEX_TABLE;
            if in_aura_table {
                continue; // 丢弃 [model_providers.aura] 表头
            }
            out.push(raw.clone());
            continue;
        }
        if in_aura_table {
            continue;
        }
        // 无标记遗留的顶层键（老版本写入）：只丢弃能明确认出是 aura 的那一行
        if t == "model_provider = \"aura\"" {
            continue;
        }
        if drop_top_model_keys
            && !seen_table
            && (t.starts_with("model = ") || t.starts_with("model=") || t.starts_with("model_provider = ") || t.starts_with("model_provider="))
        {
            continue; // enable 用：腾空顶层，让位给 aura 注入的键（备份已保留原值）
        }
        out.push(raw.clone());
    }
    // 折叠尾部多余空行
    while out.last().map(|l| l.trim().is_empty()).unwrap_or(false) {
        out.pop();
    }
    out
}

fn render_top_block(model: &str) -> Vec<String> {
    vec![
        CODEX_MARK_BEGIN.to_string(),
        format!("model = \"{}\"", toml_escape(model)),
        "model_provider = \"aura\"".to_string(),
        CODEX_MARK_END.to_string(),
    ]
}

fn render_codex_table(base_url: &str) -> Vec<String> {
    vec![
        CODEX_MARK_BEGIN.to_string(),
        CODEX_TABLE.to_string(),
        "name = \"Aura (local proxy)\"".to_string(),
        format!("base_url = \"{}\"", base_url),
        "wire_api = \"responses\"".to_string(),
        "experimental_bearer_token = \"local-rotation\"".to_string(),
        CODEX_MARK_END.to_string(),
    ]
}

fn enable_codex(ctx: &TargetContext) -> Result<String, String> {
    if ctx.protocol != "openai" {
        return Err("codex requires a provider with protocol=openai (Responses API)".to_string());
    }
    if ctx.model.trim().is_empty() {
        return Err("no enabled model found in opencode.json for this provider — enable at least one model and save first".to_string());
    }
    let path = codex_config_path(&ctx.home);
    let raw = read_config_or_empty(&path)?;
    backup_file(&path)?;

    let base_url = format!("http://127.0.0.1:{}/{}/v1", ctx.port, ctx.provider_id);
    let existing_lines: Vec<String> = raw.lines().map(|l| l.to_string()).collect();
    let stripped = strip_aura_toml(&existing_lines, true);

    // 顶层键必须放在任何 [table] 之前；表段放最后（TOML 顺序安全）
    let mut merged: Vec<String> = Vec::with_capacity(stripped.len() + 16);
    merged.extend(render_top_block(ctx.model.trim()));
    if !stripped.is_empty() {
        merged.push(String::new());
        merged.extend(stripped);
    }
    merged.push(String::new());
    merged.extend(render_codex_table(&base_url));
    let merged = tidy_blank_lines(&merged);
    let mut content = merged.join("\n");
    if !content.ends_with('\n') {
        content.push('\n');
    }
    validate_toml(&content)?;
    atomic_write(&path, content.as_bytes())?;
    Ok(format!(
        "wrote {} ([model_providers.aura], wire_api=responses) — restart codex to apply",
        path.display()
    ))
}

fn disable_codex(home: &str) -> Result<String, String> {
    let path = codex_config_path(home);
    if !path.exists() {
        return Ok("codex config.toml not found — nothing to remove".to_string());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("failed to read {}: {}", path.display(), e))?;
    let stripped = strip_aura_toml(&raw.lines().map(|l| l.to_string()).collect::<Vec<_>>(), false);
    let stripped = tidy_blank_lines(&stripped);
    let mut content = stripped.join("\n");
    if !content.is_empty() && !content.ends_with('\n') {
        content.push('\n');
    }
    // 空内容文件保留（用户自有文件），不删除
    validate_toml(&content)?;
    backup_file(&path)?;
    atomic_write(&path, content.as_bytes())?;
    Ok(format!("removed aura-managed provider from {}", path.display()))
}

// ----------------- 公共入口 -----------------

pub fn enable(agent: &str, ctx: &TargetContext) -> Result<String, String> {
    match agent {
        "claude" => enable_claude(ctx),
        "codex" => enable_codex(ctx),
        other => Err(format!("agent '{}' is not supported for auto-inject (phase 2: claude, codex)", other)),
    }
}

/// disable 不要求 provider 存在；忽略未知 agent 以保证删除 provider 时的清理总能完成
pub fn disable(agent: &str, home: &str) -> Result<String, String> {
    match agent {
        "claude" => disable_claude(home),
        "codex" => disable_codex(home),
        other => Err(format!("agent '{}' is not supported for auto-inject", other)),
    }
}
