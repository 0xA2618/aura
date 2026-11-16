//! Aura 本地代理 — Rust std 手写 HTTP/1.1 兼容接入层
//!
//! 特性
//! - key 池轮询（request-level）：同一 provider 的多个 key 按 cursor 依次
//!   用于每个请求；仅 `enabled=true` 的 key 参与。
//! - 自动健康检查：上游返回 401/402/403/408/429/5xx 时，把该 key
//!   标 `enabled=false`（同时落盘），整个请求自动切下一个 key 重试。
//! - provider 级 on/off：`enabled=false` 的 provider 在 opencode.json 中
//!   无条目（不使用 local-rotation），opencode 重启后完全不可见。
//! - SSE 流式传输：响应字节原样透传给下游 HTTP 客户端。
//! - 不引入任何新依赖：上游 HTTPS 经 curl 子进程完成（-i 透传头）。
//!
//! 路径路由（opencode.json 的 provider baseURL 会被 Aura 改写为）:
//!   http://127.0.0.1:2618/{provider_id}/{rest...}
//!     例:  http://127.0.0.1:2618/hmsi/v1/chat/completions
//! 代理透传到 config 里该 provider 的 `upstream/{rest}`.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

const CONFIG_FILE: &str = "opencode-proxy.json";
const STATUS_FILE: &str = "opencode-proxy-status.json";

// ----------------- 配置结构 -----------------

#[derive(Clone, Serialize, Deserialize)]
pub struct KeyEntry {
    pub key: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(default)]
    pub requests: u64,
    #[serde(default)]
    pub failures: u64,
}

fn default_true() -> bool { true }

#[derive(Clone, Serialize, Deserialize)]
pub struct ProviderCfg {
    pub protocol: String,   // openai | anthropic | google
    pub upstream: String,   // https://host/path
    /// 注入 opencode.json 时使用的包名（默认 openai-compatible）
    #[serde(default = "default_package")]
    pub package: String,
    /// provider 显示名（回写 opencode.json 时用）
    #[serde(default)]
    pub name: Option<String>,
    /// provider 备注（aura 内部使用，不注入 opencode.json）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    /// 注入 opencode.json 时的 models 段（id -> {name}）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub models: Option<serde_json::Value>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub cursor: usize,
    /// Phase 2: 该 provider 注入了哪些 agent CLI 的配置（agent_id -> 是否启用）
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub targets: std::collections::BTreeMap<String, bool>,
    #[serde(default)]
    pub keys: Vec<KeyEntry>,
}

fn default_package() -> String {
    "aisdk:@ai-sdk/openai-compatible".to_string()
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default = "default_port")]
    pub port: u16,
    /// 全局开关：false = opencode.json 中不含任何走代理的 provider
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub providers: BTreeMap<String, ProviderCfg>,
}

fn default_version() -> u32 { 1 }
fn default_port() -> u16 { 2618 }

impl Default for ProxyConfig {
    fn default() -> Self {
        Self { version: 1, port: default_port(), enabled: true, providers: BTreeMap::new() }
    }
}

fn proxy_home(home: &str) -> PathBuf {
    PathBuf::from(home).join(".config/aura")
}
fn config_path(home: &str) -> PathBuf {
    proxy_home(home).join(CONFIG_FILE)
}
fn status_path(home: &str) -> PathBuf {
    proxy_home(home).join(STATUS_FILE)
}

pub fn load_config(home: &str) -> ProxyConfig {
    let path = config_path(home);
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str::<ProxyConfig>(&content).unwrap_or_default()
}

pub fn save_config(home: &str, cfg: &ProxyConfig) -> Result<(), String> {
    let dir = proxy_home(home);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = config_path(home);
    let tmp = path.with_extension("tmp");
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600));
    }
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

// ----------------- 共享状态 -----------------

struct ProxyState {
    cfg: Mutex<ProxyConfig>,
    stop: AtomicBool,
    handle: Mutex<Option<thread::JoinHandle<()>>>,
}

static STATE: OnceLock<Arc<ProxyState>> = OnceLock::new();

/// 启动常驻代理线程。重复调用幂等；端口已被占用则打印错误。
pub fn spawn_proxy_at(home: &str, port: u16) -> Result<(), String> {
    let cfg = load_config(home);
    let existing_cfg = cfg.clone();
    let state = STATE.get_or_init(|| {
        Arc::new(ProxyState {
            cfg: Mutex::new(existing_cfg),
            stop: AtomicBool::new(false),
            handle: Mutex::new(None),
        })
    });
    // 如果已经在跑且端口相同，直接返回
    {
        let running = state.handle.lock().unwrap().is_some();
        let current_port = state.cfg.lock().unwrap().port;
        if running && current_port == port {
            // 确保 stop 标志被清
            state.stop.store(false, Ordering::Relaxed);
            return Ok(());
        }
    }
    // 若已在跑（不同端口），先停掉
    stop_proxy();
    state.stop.store(false, Ordering::Relaxed);
    {
        let mut cfg = state.cfg.lock().unwrap();
        cfg.port = port;
    }

    let home2 = home.to_string();
    let state_cloned = state.clone();
    let listener = TcpListener::bind(("127.0.0.1", port)).map_err(|e| format!("绑定 127.0.0.1:{} 失败: {}", port, e))?;
    listener.set_nonblocking(false).map_err(|e| e.to_string())?;
    listener.set_ttl(3).ok();

    let app_home = home2.clone();
    let handle = thread::Builder::new()
        .name("opencode-proxy".into())
        .spawn(move || {
            eprintln!("[opencode-proxy] 监听 127.0.0.1:{}", port);
            for stream in listener.incoming() {
                if state_cloned.stop.load(Ordering::Relaxed) {
                    break;
                }
                match stream {
                    Ok(s) => {
                        let home = app_home.clone();
                        thread::spawn(move || handle_connection(s, home));
                    }
                    Err(e) => {
                        eprintln!("[opencode-proxy] accept 错误: {}", e);
                        thread::sleep(Duration::from_millis(10));
                    }
                }
            }
            eprintln!("[opencode-proxy] 停止监听");
        })
        .map_err(|e| e.to_string())?;
    *state.handle.lock().unwrap() = Some(handle);
    Ok(())
}

pub fn stop_proxy() {
    if let Some(state) = STATE.get() {
        state.stop.store(true, Ordering::Relaxed);
        // 唤醒 accept 阻塞：连接一下自身端口
        if let Ok(port) = std::net::TcpStream::connect(("127.0.0.1", state.cfg.lock().unwrap().port)) {
            drop(port);
        }
        if let Some(h) = state.handle.lock().unwrap().take() {
            let _ = h.join();
        }
    }
}

pub fn current_port() -> u16 {
    STATE.get().map(|s| s.cfg.lock().unwrap().port).unwrap_or(default_port())
}

// ----------------- HTTP 解析 -----------------

fn find_header_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n")
}

struct ParsedRequest {
    method: String,
    path: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

fn read_request(stream: &mut TcpStream) -> Option<ParsedRequest> {
    let mut buf: Vec<u8> = Vec::with_capacity(8192);
    let mut tmp = [0u8; 8192];
    loop {
        let n = match stream.read(&mut tmp) {
            Ok(0) => break,
            Ok(n) => n,
            Err(_) => return None,
        };
        buf.extend_from_slice(&tmp[..n]);
        if let Some(h) = find_header_end(&buf) {
            // 读够 header 后，按 Content-Length 读 body
            let head_end = h + 4;
            let headers = parse_headers(&buf[..h])?;
            let cl = headers
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case("content-length"))
                .and_then(|(_, v)| v.trim().parse::<usize>().ok())
                .unwrap_or(0);
            let mut have = buf.len().saturating_sub(head_end);
            while have < cl {
                let n = match stream.read(&mut tmp) {
                    Ok(0) => break,
                    Ok(n) => n,
                    Err(_) => return None,
                };
                buf.extend_from_slice(&tmp[..n]);
                have += n;
            }
            let body = buf[head_end..].to_vec();
            let req_line = std::str::from_utf8(&buf[..h]).ok()?;
            let mut it = req_line.split("\r\n");
            let line = it.next()?.trim();
            let mut parts = line.split_whitespace();
            let method = parts.next()?.to_string();
            let path = parts.next()?.to_string();
            return Some(ParsedRequest { method, path, headers, body });
        }
        if buf.len() > 65536 {
            return None;
        }
    }
    None
}

/// Key 失效判定：仅针对真正的认证失败；上游的帐号/限流/余额错误直接透传给客户端即可
fn is_bad_key_status(code: u16) -> bool {
    matches!(code, 401 | 403)
}

/// 2xx 表示一次 chat 探活成功
fn is_ok_status(code: u16) -> bool {
    matches!(code, 200..=299)
}

fn parse_headers(head: &[u8]) -> Option<Vec<(String, String)>> {
    let text = std::str::from_utf8(head).ok()?;
    let mut out = Vec::new();
    let mut iter = text.split("\r\n");
    let _req_line = iter.next();
    for line in iter {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        let idx = t.find(':')?;
        out.push((t[..idx].trim().to_string(), t[idx + 1..].trim().to_string()));
    }
    Some(out)
}

fn write_simple_json(stream: &mut TcpStream, status: u16, body: &Value) {
    let body_bytes = serde_json::to_vec(body).unwrap_or_else(|_| b"{}".to_vec());
    let head = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: authorization, content-type, x-api-key, anthropic-version, x-goog-api-key\r\nConnection: close\r\n\r\n",
        status_text(status),
        body_bytes.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(&body_bytes);
}

fn write_text(stream: &mut TcpStream, status: u16, text: &str) {
    let body = text.as_bytes();
    let head = format!(
        "HTTP/1.1 {}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: authorization, content-type, x-api-key, anthropic-version, x-goog-api-key\r\nConnection: close\r\n\r\n",
        status_text(status),
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body);
}

fn status_text(code: u16) -> String {
    match code {
        200 => "200 OK".into(),
        201 => "201 Created".into(),
        204 => "204 No Content".into(),
        400 => "400 Bad Request".into(),
        401 => "401 Unauthorized".into(),
        402 => "402 Payment Required".into(),
        403 => "403 Forbidden".into(),
        404 => "404 Not Found".into(),
        429 => "429 Too Many Requests".into(),
        500 => "500 Internal Server Error".into(),
        502 => "502 Bad Gateway".into(),
        503 => "503 Service Unavailable".into(),
        504 => "504 Gateway Timeout".into(),
        _ => format!("{} Status", code),
    }
}

fn handle_connection(mut stream: TcpStream, home: String) {
    stream.set_read_timeout(Some(Duration::from_secs(30))).ok();
    stream.set_write_timeout(Some(Duration::from_secs(60))).ok();
    let req = match read_request(&mut stream) {
        Some(r) => r,
        None => {
            write_text(&mut stream, 400, "bad request\n");
            return;
        }
    };

    // OPTIONS preflight
    if req.method == "OPTIONS" {
        write_simple_json(&mut stream, 204, &json!({}));
        return;
    }

    // /_proxy/status — 面板轮询
    if req.method == "GET" && req.path == "/_proxy/status" {
        write_simple_json(&mut stream, 200, &status_snapshot(&home));
        return;
    }

    // /_proxy/test/{pid}/{idx} — 面板 Test 按钮
    if req.method == "GET" && req.path.starts_with("/_proxy/test/") {
        let rest = &req.path["/_proxy/test/".len()..];
        let mut segs = rest.splitn(2, '/');
        let pid = segs.next().unwrap_or("");
        let idx: usize = segs.next().and_then(|s| s.parse().ok()).unwrap_or(usize::MAX);
        let home2 = home.clone();
        let cfg = load_config(&home2);
        match cfg.providers.get(pid) {
            Some(p) => {
                let key = match p.keys.get(idx) {
                    Some(k) => k.key.clone(),
                    None => {
                        write_simple_json(&mut stream, 400, &json!({ "error": "key index out of range" }));
                        return;
                    }
                };
                let probe = probe_key_public(&p.protocol, &p.upstream, &key);
                write_simple_json(&mut stream, 200, &probe);
            }
            None => write_simple_json(&mut stream, 404, &json!({ "error": "provider not found" })),
        }
        return;
    }

    // 其余：代理转发
    let trimmed = req.path.trim_start_matches('/');
    let mut segs = trimmed.splitn(2, '/');
    let pid = segs.next().unwrap_or("").to_string();
    let rest = segs.next().unwrap_or("").to_string();
    if pid.is_empty() {
        write_simple_json(&mut stream, 404, &json!({ "error": "missing provider id in path" }));
        return;
    }

    let home2 = home.clone();
    let mut cfg = load_config(&home2);
    let provider = match cfg.providers.get(&pid).cloned() {
        Some(p) => p,
        None => {
            write_simple_json(&mut stream, 404, &json!({ "error": format!("provider '{}' not found", pid) }));
            return;
        }
    };
    if !provider.enabled {
        write_simple_json(&mut stream, 503, &json!({ "error": "provider disabled" }));
        return;
    }
    let total = provider.keys.len();
    if total == 0 {
        write_simple_json(&mut stream, 503, &json!({ "error": "no keys configured for provider" }));
        return;
    }
    let candidates: Vec<usize> = (0..total)
        .map(|i| (provider.cursor + i) % total)
        .filter(|&i| provider.keys[i].enabled)
        .collect();
    if candidates.is_empty() {
        write_simple_json(&mut stream, 503, &json!({ "error": "all keys disabled" }));
        return;
    }
    // 轮询重试：按 candidate 顺序选 key 调上游，整个请求最多尝试 len(candidates) 次
    let rest = if rest.is_empty() { String::new() } else { format!("/{}", rest) };
    let target_url = format!("{}{}", provider.upstream.trim_end_matches('/'), rest);
    let mut last_response: Option<Vec<u8>> = None;
    for idx in &candidates {
        let key = provider.keys[*idx].key.clone();
        let (status, _upstream_body, body_preview, client_response) = curl_roundtrip(
            &provider.protocol,
            &req.method,
            &target_url,
            &req.headers,
            &req.body,
            &key,
        );
        // 统计
        if let Some(p) = cfg.providers.get_mut(&pid) {
            if let Some(k) = p.keys.get_mut(*idx) {
                k.requests = k.requests.saturating_add(1);
                if is_bad_key_status(status) {
                    k.failures = k.failures.saturating_add(1);
                    k.last_error = Some(format!("HTTP {} · {}", status, body_preview));
                    k.enabled = false; // 自动排除
                    eprintln!("[opencode-proxy] {} key#{} -> HTTP {}, marked disabled", pid, idx, status);
                } else {
                    // 成功：把 cursor 推进到下一个 key
                    p.cursor = (*idx + 1) % total;
                    k.requests = k.requests;
                }
            }
            let cursor = p.cursor;
            let _ = save_config(&home2, &cfg);
            let _ = cursor;
        }
        if !is_bad_key_status(status) {
            // 直接把下游响应 bytes 透给客户端
            let _ = stream.write_all(&client_response);
            return;
        }
        last_response = Some(client_response);
    }
    // 所有 key 都失败：返回最后一个响应
    if let Some(bytes) = last_response {
        let _ = stream.write_all(&bytes);
    } else {
        write_text(&mut stream, 502, "all keys failed\n");
    }
}

// ----------------- 上游请求核心 -----------------

const HOP_BY_HOP: &[&str] = &[
    "host",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "content-length",
    "upgrade",
];

fn is_hop_by_hop(name: &str) -> bool {
    HOP_BY_HOP.iter().any(|h| name.eq_ignore_ascii_case(h))
}

pub fn probe_chat_public(protocol: &str, upstream: &str, key: &str, model_id: &str) -> Value {
    let base = upstream.trim_end_matches('/');
    let url = format!("{}/chat/completions", base);
    let body = serde_json::to_string(&json!({
        "model": model_id,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
    }))
    .unwrap_or_default()
    .into_bytes();
    let headers = vec![("Content-Type".to_string(), "application/json".to_string())];
    let (status, body_bytes, preview, _client_response) = curl_roundtrip(protocol, "POST", &url, &headers, &body, key);
    // 严谨认证：2xx 且 choices[0].message 存在，并且模型确实产出了内容才算可用。
    // 推理模型（如 DeepSeek v4）会把 max_tokens=1 全部耗在 reasoning_content 上，正文 content 是空串——
    // 这也算真实产出，不能判 fail；只有完全没有任何输出（content/reasoning/tool_calls 都空）才算不可用。
    let content_ok = (|| -> bool {
        let v: Value = match serde_json::from_slice(&body_bytes) {
            Ok(v) => v,
            Err(_) => return false,
        };
        let message = v
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|m| m.get("message"));
        let Some(m) = message else { return false };
        let has_text = |key: &str| {
            m.get(key)
                .and_then(|c| c.as_str())
                .map(|t| !t.trim().is_empty())
                .unwrap_or(false)
        };
        let has_tool_calls = m
            .get("tool_calls")
            .and_then(|t| t.as_array())
            .map(|a| !a.is_empty())
            .unwrap_or(false);
        has_text("content") || has_text("reasoning_content") || has_text("reasoning") || has_tool_calls
    })();
    let ok = is_ok_status(status) && content_ok;
    json!({
        "ok": ok,
        "http": status,
        "preview": preview,
        "chatContent": content_ok,
        "body": String::from_utf8_lossy(&body_bytes).chars().take(200).collect::<String>(),
    })
}

pub fn probe_key_public(protocol: &str, upstream: &str, key: &str) -> Value {
    let base = upstream.trim_end_matches('/');
    let (url, headers): (String, Vec<(String, String)>) = match protocol {
        "openai" => (
            format!("{}/models", base),
            vec![("Authorization".to_string(), format!("Bearer {}", key))],
        ),
        "anthropic" => (
            format!("{}/v1/models", base),
            vec![
                ("x-api-key".to_string(), key.to_string()),
                ("anthropic-version".to_string(), "2023-06-01".to_string()),
            ],
        ),
        "google" => (format!("{}/v1beta/models?key={}", base, key), vec![]),
        _ => (
            format!("{}/models", base),
            vec![("Authorization".to_string(), format!("Bearer {}", key))],
        ),
    };
    let mut args: Vec<String> = vec![
        "-sS".to_string(),
        "--http1.1".to_string(),
        "--max-time".to_string(),
        "15".to_string(),
        "-D".to_string(),
        "-".to_string(),
        "-o".to_string(),
        "-".to_string(),
    ];
    for (k, v) in &headers {
        args.push("-H".to_string());
        args.push(format!("{}: {}", k, v));
    }
    args.push(url.clone());
    let out = match Command::new("curl").args(&args).output() {
        Ok(o) => o,
        Err(e) => {
            return json!({ "ok": false, "http": 0, "error": e.to_string() });
        }
    };
    let raw = out.stdout;
    let (status, _headers, body) = split_response(&raw);
    let models = extract_model_count(protocol, &body);
    json!({
        "ok": is_ok_status(status),
        "http": status,
        "models": models,
        "error": if !is_ok_status(status) { Some(String::from_utf8_lossy(&body).chars().take(200).collect::<String>()) } else { None },
    })
}

fn extract_model_count(protocol: &str, body: &[u8]) -> Option<usize> {
    let v: Value = serde_json::from_slice(body).ok()?;
    match protocol {
        "google" => v.get("models").and_then(|m| m.as_array()).map(|a| a.len()),
        _ => v.get("data").and_then(|m| m.as_array()).map(|a| a.len()),
    }
}

/// 把 curl -D - 的输出切成 (status, headers_map, raw_body_bytes)
fn split_response(raw: &[u8]) -> (u16, Vec<(String, String)>, Vec<u8>) {
    let needle = b"\r\n\r\n";
    let pos = match raw.windows(needle.len()).position(|w| w == needle) {
        Some(p) => p,
        None => return (0, vec![], raw.to_vec()),
    };
    let head = std::str::from_utf8(&raw[..pos]).unwrap_or("").to_string();
    let body = raw[pos + needle.len()..].to_vec();
    let mut lines = head.lines();
    let status_line = lines.next().unwrap_or("").trim().to_string();
    let status: u16 = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let mut headers = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        if let Some(idx) = line.find(':') {
            headers.push((line[..idx].trim().to_string(), line[idx + 1..].trim().to_string()));
        }
    }
    (status, headers, body)
}

/// 核心上游请求：写 body → stdin，字节流式转发到 stdout，返回 (status, raw_bytes_to_client, body_preview)
fn curl_roundtrip(
    protocol: &str,
    method: &str,
    url: &str,
    req_headers: &[(String, String)],
    body: &[u8],
    key: &str,
) -> (u16, Vec<u8>, String, Vec<u8>) {
    let mut args: Vec<String> = vec![
        "-sS".to_string(),
        "-X".to_string(),
        method.to_string(),
        "-H".to_string(),
        "Accept-Encoding: identity".to_string(),
        "-H".to_string(),
        "Connection: close".to_string(),
        "--http1.1".to_string(),
        "--no-keepalive".to_string(),
        "--data-binary".to_string(),
        "@-".to_string(),
        "-D".to_string(),
        "-".to_string(),
        "-o".to_string(),
        "-".to_string(),
    ];

    // 透传客户端所有非 hop-by-hop / 非鉴权 的请求头（Content-Type / Accept 等）
    for (k, v) in req_headers {
        if is_hop_by_hop(k) {
            continue;
        }
        let lower = k.to_ascii_lowercase();
        if lower == "authorization" || lower == "x-api-key" {
            continue; // 由代理用池中 key 填写
        }
        args.push("-H".to_string());
        args.push(format!("{}: {}", k, v));
    }
    match protocol {
        "openai" | "openai-compat" => {
            args.push("-H".to_string());
            args.push(format!("Authorization: Bearer {}", key));
        }
        "anthropic" => {
            args.push("-H".to_string());
            args.push(format!("x-api-key: {}", key));
            args.push("-H".to_string());
            args.push("anthropic-version: 2023-06-01".to_string());
        }
        "google" => {
            // key 改写为 query 参数？上游 url 可能已带 key= —— 简单起见全部改用 x-goog-api-key header
            args.push("-H".to_string());
            args.push(format!("x-goog-api-key: {}", key));
        }
        _ => {
            args.push("-H".to_string());
            args.push(format!("Authorization: Bearer {}", key));
        }
    }
    args.push(url.to_string());

    // 日志脱敏：不打印任何明文密钥/token（Authorization / x-api-key / x-goog-api-key / URL ?key=）
    let safe_args = redact_args_for_log(&args);
    eprintln!("[opencode-proxy] spawn curl args: {:?}", safe_args);
    eprintln!("[opencode-proxy] body length: {}", body.len());
    let mut child = match Command::new("curl")
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            let status = 502u16;
            let body = format!("failed to spawn curl: {}", e);
            return (status, body.clone().into_bytes(), body.clone(), build_client_response(502, body.as_bytes()));
        }
    };
    if let Some(mut stdin) = child.stdin.take() {
        match stdin.write_all(body) {
            Ok(_) => eprintln!("[opencode-proxy] wrote {} bytes to curl stdin", body.len()),
            Err(e) => eprintln!("[opencode-proxy] stdin write error: {}", e),
        }
    } else {
        eprintln!("[opencode-proxy] child.stdin is None");
    }
    let out = match child.wait_with_output() {
        Ok(o) => o,
        Err(e) => {
            let status = 502u16;
            let body = format!("curl wait error: {}", e);
            return (status, body.clone().into_bytes(), body.clone(), build_client_response(502, body.as_bytes()));
        }
    };
    let raw = out.stdout;
    let (status, response_headers, upstream_body) = split_response(&raw);
    let preview: String = String::from_utf8_lossy(&upstream_body)
        .replace('\n', " ")
        .replace('\r', " ")
        .chars()
        .take(160)
        .collect();

    // 向下游写入响应：透传状态 + 过滤后的头 + 流式 framing（chunked）
    // 注意返回 4 元组：探测函数需要纯上游 body（用于 JSON 解析），代理 HTTP 路径需要重建好的下游响应
    let response = build_client_response_with_headers(status, &response_headers, &upstream_body);
    (status, upstream_body, preview, response)
}

/// 日志脱敏：隐藏 curl 参数里的鉴权信息，只保留结构便于排障
fn redact_args_for_log(args: &[String]) -> Vec<String> {
    args.iter()
        .map(|a| {
            let lower = a.to_ascii_lowercase();
            for prefix in ["authorization:", "x-api-key:", "x-goog-api-key:", "bearer "] {
                if lower.starts_with(prefix) {
                    let head = a.split(':').next().unwrap_or(a);
                    return format!("{} [REDACTED]", head);
                }
            }
            if let Some(idx) = lower.find("key=") {
                // Google 风格 URL ?key=<token>：只保留 key= 之前的部分
                return format!("{}key=[REDACTED]", &a[..idx]);
            }
            a.clone()
        })
        .collect()
}

/// 纯字节透传 build 一段完整 HTTP/1.1 响应（Content-Length，不解码流式）
fn build_client_response(status: u16, body: &[u8]) -> Vec<u8> {
    let mut out = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: authorization, content-type, x-api-key, anthropic-version, x-goog-api-key\r\nConnection: close\r\n\r\n",
        status_text(status),
        body.len()
    )
    .into_bytes();
    out.extend_from_slice(body);
    out
}

fn build_client_response_with_headers(status: u16, upstream_headers: &[(String, String)], body: &[u8]) -> Vec<u8> {
    let mut head = format!("HTTP/1.1 {}\r\n", status_text(status)).into_bytes();
    for (k, v) in upstream_headers {
        if is_hop_by_hop(k) {
            continue;
        }
        head.extend(format!("{}: {}\r\n", k, v).into_bytes());
    }
    head.extend(format!("Content-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: authorization, content-type, x-api-key, anthropic-version, x-goog-api-key\r\nConnection: close\r\n\r\n", body.len()).into_bytes());
    head.extend_from_slice(body);
    head
}


// ----------------- 公共 API（供 lib.rs commands 使用） -----------------

pub fn home_dir() -> String {
    std::env::var("HOME").unwrap_or_else(|_| "/Users/Yang".to_string())
}

/// 面板初始化/轮询用的状态快照
pub fn status_snapshot(home: &str) -> Value {
    let cfg = load_config(home);
    let mut providers_out = serde_json::Map::new();
    for (pid, p) in &cfg.providers {
        let enabled_keys = p.keys.iter().filter(|k| k.enabled).count();
        let mut keys_out = Vec::new();
        for (i, k) in p.keys.iter().enumerate() {
            keys_out.push(json!({
                "index": i,
                "enabled": k.enabled,
                "requests": k.requests,
                "failures": k.failures,
                "lastError": k.last_error,
            }));
        }
        providers_out.insert(pid.clone(), json!({
            "protocol": p.protocol,
            "upstream": p.upstream,
            "enabled": p.enabled,
            "note": p.note,
            "targets": p.targets,
            "enabledKeys": enabled_keys,
            "totalKeys": p.keys.len(),
            "cursor": p.cursor,
            "keys": keys_out,
        }));
    }
    json!({ "ok": true, "port": cfg.port, "providers": providers_out })
}

/// 触发代理在新端口上重启；opencode.json 的 baseURL 由调用方重写
pub fn reload_on_port(home: &str, new_port: u16) -> Result<(), String> {
    stop_proxy();
    let mut cfg = load_config(home);
    cfg.port = new_port;
    save_config(home, &cfg)?;
    spawn_proxy_at(home, new_port)
}

/// 保存/覆盖某个 provider 的 key 池（整组替换）
pub struct ProviderPoolInput<'a> {
    pub protocol: &'a str,
    pub upstream: &'a str,
    pub package: &'a str,
    pub name: Option<&'a str>,
    pub models_json: Option<serde_json::Value>,
    pub keys: Vec<String>,
    pub enabled: bool,
    /// provider 备注（aura 内部使用；None 表示清空）
    pub note: Option<&'a str>,
}

pub fn set_provider_keys(
    home: &str,
    pid: &str,
    input: ProviderPoolInput<'_>,
) -> Result<(), String> {
    let mut cfg = load_config(home);
    let trimmed: Vec<&String> = input.keys.iter().filter(|k| !k.trim().is_empty()).collect();
    // 保留已有的启用状态：索引位置相同的对应 key 保持原 enabled/requests 等
    let existing = cfg.providers.get(pid).cloned();
    let new_keys: Vec<KeyEntry> = trimmed
        .iter()
        .enumerate()
        .map(|(i, k)| {
            let prev = existing.as_ref().and_then(|p| p.keys.get(i)).cloned();
            match prev {
                Some(rest) => KeyEntry { key: k.to_string(), ..rest },
                None => KeyEntry {
                    key: k.to_string(),
                    enabled: true,
                    last_error: None,
                    requests: 0,
                    failures: 0,
                },
            }
        })
        .collect();
    let models_json = input.models_json;
    let name = input.name.map(str::to_string);
    let note = input.note.map(str::to_string);
    let base = existing.unwrap_or(ProviderCfg {
        protocol: input.protocol.to_string(),
        upstream: input.upstream.to_string(),
        package: input.package.to_string(),
        name: name.clone(),
        note: note.clone(),
        models: models_json.clone(),
        enabled: input.enabled,
        cursor: 0,
        keys: Vec::new(),
        targets: std::collections::BTreeMap::new(),
    });
    cfg.providers.insert(
        pid.to_string(),
        ProviderCfg {
            protocol: input.protocol.to_string(),
            upstream: input.upstream.to_string(),
            package: input.package.to_string(),
            name,
            note,
            models: models_json,
            enabled: input.enabled,
            cursor: base.cursor.min(new_keys.len().saturating_sub(1)),
            keys: new_keys,
            targets: base.targets,
        },
    );
    save_config(home, &cfg)
}

pub fn set_key_enabled(home: &str, pid: &str, idx: usize, enabled: bool) -> Result<(), String> {
    let mut cfg = load_config(home);
    match cfg.providers.get_mut(pid).and_then(|p| p.keys.get_mut(idx)) {
        Some(k) => {
            k.enabled = enabled;
            if enabled {
                k.last_error = None;
            }
            save_config(home, &cfg)
        }
        None => Err("key index out of range or provider not found".to_string()),
    }
}

pub fn set_provider_enabled(home: &str, pid: &str, enabled: bool) -> Result<(), String> {
    let mut cfg = load_config(home);
    match cfg.providers.get_mut(pid) {
        Some(p) => {
            p.enabled = enabled;
            save_config(home, &cfg)
        }
        None => Err("provider not found".to_string()),
    }
}

pub fn get_provider_keys(home: &str, pid: &str) -> Result<Vec<String>, String> {
    let cfg = load_config(home);
    match cfg.providers.get(pid) {
        Some(p) => Ok(p.keys.iter().map(|k| k.key.clone()).collect()),
        None => Ok(Vec::new()),
    }
}

pub fn delete_provider_pool(home: &str, pid: &str) -> Result<(), String> {
    let mut cfg = load_config(home);
    cfg.providers.remove(pid);
    save_config(home, &cfg)
}
