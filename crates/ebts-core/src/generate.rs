use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{CoreError, CoreResult};
use crate::manifest::{content_manifest, ContentItem, LOOP_SECONDS};
use crate::model::{EventSpec, SamplerOverride};
use crate::pixel::{self, Canvas, Rgb};

pub use crate::comfy::{Progress, ProgressFn};
pub use crate::providers::*;

pub const LOOP_PROMPT: &str = "Use IMAGE_1 as BOTH the exact STARTING FRAME and the exact ENDING FRAME.

1. Preserve IMAGE_1 with maximum photographic and pixel-level detail.
1. Preserve EVERY person's original identity, skin tone, ethnicity, facial features, hair, and streetwear.
2. Absolutely ZERO camera movement or zoom.
3. Absolutely NO PEOPLE SWAYING, ROCKING, BOBBING, OR DRIFTING.
4. Keep every person anchored to their exact original position.
5. Animate only occasional, independent, tiny hand and finger movements.
6. Preserve the original image details minimal internal animation.
7. Keep all branding and typography completely unchanged.
8. Preserve all image details.
9. Return to IMAGE_1 for a seamless continuous loop.

LOCKED CAMERA. ZERO ZOOM. NO BODY SWAYING. NO CROWD DRIFT. NO IDENTITY CHANGES. NO SKIN-TONE CHANGES. MAXIMUM DETAIL FIDELITY. ISOLATED MICRO-MOVEMENTS ONLY. EXACT ORIGINAL COMPOSITION. SEAMLESS LOOP.";

pub const LOOP_PROMPT_SHORT: &str = "Use IMAGE_1 as BOTH the exact STARTING FRAME and the exact ENDING FRAME. Preserve IMAGE_1 with maximum pixel-level detail: every person's identity, skin tone, ethnicity, facial features, hair and streetwear; all branding and typography unchanged. Absolutely ZERO camera movement or zoom. NO swaying, rocking, bobbing or drifting; everyone anchored to their original position. Animate only occasional, independent, tiny hand and finger movements. Return to IMAGE_1 for a seamless continuous loop. LOCKED CAMERA. ZERO ZOOM. SEAMLESS LOOP.";

pub fn video_prompt(prompt: &str) -> String {
    let user = prompt.trim();
    if user.is_empty() {
        LOOP_PROMPT.to_string()
    } else {
        format!("{user}\n\n{LOOP_PROMPT}")
    }
}

pub fn reactor_prompt(prompt: &str, max_chars: usize) -> String {
    let user = prompt.split(LOOP_PROMPT).next().unwrap_or(prompt).trim();
    let room = max_chars.saturating_sub(LOOP_PROMPT_SHORT.chars().count() + 2);
    let head: String = user.chars().take(room).collect();
    let head = head.trim();
    if head.is_empty() {
        LOOP_PROMPT_SHORT.chars().take(max_chars).collect()
    } else {
        format!("{head}\n\n{LOOP_PROMPT_SHORT}")
    }
}

pub const SECRETS_FILE: &str = "secrets.json";
const BODY_LIMIT: u64 = 512 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(900);

pub fn settings_path(root: &Path) -> PathBuf {
    root.join(PROVIDERS_FILE)
}

fn read_settings(path: &Path) -> CoreResult<Option<ProviderSettings>> {
    if !path.is_file() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&raw)?))
}

pub fn workflow_paths(settings: &ProviderSettings) -> Vec<String> {
    settings
        .configs
        .values()
        .flat_map(|config| match config {
            ProviderConfig::Comfyui { image_workflow, video_workflow, .. } => vec![image_workflow.clone(), video_workflow.clone()],
            _ => Vec::new(),
        })
        .filter(|rel| !rel.trim().is_empty() && Path::new(rel).is_relative())
        .collect()
}

fn copy_workflows(from: &Path, to: &Path, settings: &ProviderSettings, overwrite: bool) {
    for rel in workflow_paths(settings) {
        let src = from.join(&rel);
        let dest = to.join(&rel);
        if !src.is_file() || (dest.is_file() && !overwrite) {
            continue;
        }
        if let Some(parent) = dest.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::copy(&src, &dest);
    }
}

pub fn load_settings_from(root: Option<&Path>, user_dir: &Path) -> CoreResult<ProviderSettings> {
    if let Some(root) = root {
        if let Some(own) = read_settings(&settings_path(root))? {
            return Ok(own);
        }
    }
    let Some(remembered) = read_settings(&user_dir.join(PROVIDERS_FILE))? else {
        return Ok(ProviderSettings::default());
    };
    if let Some(root) = root {
        copy_workflows(user_dir, root, &remembered, false);
    }
    Ok(remembered)
}

pub fn save_settings_to(root: Option<&Path>, user_dir: &Path, settings: &ProviderSettings) -> CoreResult<()> {
    let raw = serde_json::to_string_pretty(settings)?;
    if let Some(root) = root {
        fs::create_dir_all(root)?;
        fs::write(settings_path(root), &raw)?;
        copy_workflows(root, user_dir, settings, true);
    }
    fs::create_dir_all(user_dir)?;
    fs::write(user_dir.join(PROVIDERS_FILE), &raw)?;
    Ok(())
}

pub fn load_settings(root: Option<&Path>) -> CoreResult<ProviderSettings> {
    load_settings_from(root, &config_dir())
}

pub fn save_settings(root: Option<&Path>, settings: &ProviderSettings) -> CoreResult<()> {
    save_settings_to(root, &config_dir(), settings)
}

pub fn config_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("EBTS_CONFIG_DIR").filter(|v| !v.is_empty()) {
        return PathBuf::from(dir);
    }
    if let Some(xdg) = std::env::var_os("XDG_CONFIG_HOME").filter(|v| !v.is_empty()) {
        return PathBuf::from(xdg).join("ebts");
    }
    if let Some(home) = std::env::var_os("HOME").filter(|v| !v.is_empty()) {
        return PathBuf::from(home).join(".config").join("ebts");
    }
    if let Some(appdata) = std::env::var_os("APPDATA").filter(|v| !v.is_empty()) {
        return PathBuf::from(appdata).join("ebts");
    }
    PathBuf::from(".ebts")
}

pub fn secrets_path() -> PathBuf {
    config_dir().join(SECRETS_FILE)
}

pub fn read_secrets_from(path: &Path) -> BTreeMap<String, String> {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn store_key_in(path: &Path, name: &str, value: &str) -> CoreResult<()> {
    let mut secrets = read_secrets_from(path);
    if value.trim().is_empty() {
        secrets.remove(name);
    } else {
        secrets.insert(name.to_string(), value.trim().to_string());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_string_pretty(&secrets)?)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

pub fn store_key(name: &str, value: &str) -> CoreResult<()> {
    store_key_in(&secrets_path(), name, value)
}

pub fn resolve_key_from(path: &Path, name: &str) -> Option<String> {
    if let Ok(value) = std::env::var(name) {
        if !value.trim().is_empty() {
            return Some(value.trim().to_string());
        }
    }
    read_secrets_from(path).get(name).cloned().filter(|v| !v.is_empty())
}

pub fn resolve_key(name: &str) -> Option<String> {
    resolve_key_from(&secrets_path(), name)
}

pub fn sampler_defaults_for(root: Option<&Path>, config: &ProviderConfig, video: bool) -> Option<crate::comfy::SamplerDefaults> {
    let ProviderConfig::Comfyui { image_workflow, image_nodes, video_workflow, video_nodes, .. } = config else {
        return None;
    };
    let (rel, nodes) = if video { (video_workflow, video_nodes) } else { (image_workflow, image_nodes) };
    if rel.trim().is_empty() {
        return None;
    }
    let path = Path::new(rel.trim());
    let abs = if path.is_absolute() { path.to_path_buf() } else { root?.join(path) };
    let raw = fs::read_to_string(abs).ok()?;
    let workflow = crate::comfy::parse_workflow(&raw).ok()?;
    crate::comfy::sampler_defaults(&workflow, &nodes.values)
}

pub fn providers(root: Option<&Path>, settings: &ProviderSettings) -> Vec<ProviderInfo> {
    list_providers(settings, &|env| resolve_key(env).is_some(), &|config, video| sampler_defaults_for(root, config, video))
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ReactorStatus {
    pub valid: bool,
    pub message: String,
    pub model: String,
    pub price_per_second_usd: Option<String>,
    pub price_per_clip_usd: Option<String>,
}

pub fn reactor_price(pricing: &Value, model: &str) -> Option<String> {
    let models = pricing.get("models")?.as_array()?;
    let found = models.iter().find(|m| {
        let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let name = m.get("name").and_then(|v| v.as_str()).unwrap_or("");
        id == model || model.ends_with(name) && !name.is_empty()
    })?;
    found.get("rate")?.get("amount_per_sec_usd")?.as_str().map(|s| s.to_string())
}

pub fn clip_cost(price_per_second: &str, seconds: f64) -> Option<String> {
    let rate: f64 = price_per_second.parse().ok()?;
    Some(format!("{:.3}", rate * seconds * 2.0))
}

pub fn reactor_check(api_url: &str, api_key: Option<&str>, seconds: f64) -> ReactorStatus {
    let model = REACTOR_MODEL.to_string();
    let pricing = get_json(&join_url(api_url, "pricing")).ok();
    let price = pricing.as_ref().and_then(|p| reactor_price(p, &model));
    let per_clip = price.as_deref().and_then(|p| clip_cost(p, seconds));
    let Some(key) = api_key.map(str::trim).filter(|k| !k.is_empty()) else {
        return ReactorStatus { valid: false, message: "No API key".into(), model, price_per_second_usd: price, price_per_clip_usd: per_clip };
    };
    let body = json!({
        "expires_after": 60,
        "authorization_details": [{ "type": "session", "resources": { "models": { "match": [model] } }, "constraints": { "max_sessions": 1 } }]
    });
    match post_json_with(&join_url(api_url, "tokens"), &[("Reactor-API-Key", key)], &body) {
        Ok(value) if value.get("jwt").is_some() => {
            ReactorStatus { valid: true, message: "Key accepted".into(), model, price_per_second_usd: price, price_per_clip_usd: per_clip }
        }
        Ok(value) => ReactorStatus { valid: false, message: format!("Unexpected answer: {}", excerpt(&value.to_string())), model, price_per_second_usd: price, price_per_clip_usd: per_clip },
        Err(e) => ReactorStatus { valid: false, message: e.to_string(), model, price_per_second_usd: price, price_per_clip_usd: per_clip },
    }
}

#[derive(Clone)]
pub struct Job<'a> {
    pub prompt: &'a str,
    pub negative_prompt: &'a str,
    pub width: u32,
    pub height: u32,
    pub seconds: f64,
    pub seed: Option<u64>,
    pub init_images: Vec<PathBuf>,
    pub progress: Option<ProgressFn<'a>>,
    pub cancel: Option<&'a std::sync::atomic::AtomicBool>,
    pub sampler: SamplerOverride,
}

impl<'a> Job<'a> {
    pub fn image(prompt: &'a str, width: u32, height: u32) -> Self {
        Job {
            prompt,
            negative_prompt: "",
            width,
            height,
            seconds: LOOP_SECONDS,
            seed: None,
            init_images: Vec::new(),
            progress: None,
            cancel: None,
            sampler: SamplerOverride::default(),
        }
    }
}

pub trait Provider {
    fn supports_video(&self) -> bool {
        false
    }

    fn generate_image(&self, job: &Job) -> CoreResult<Vec<u8>>;

    fn generate_video(&self, _job: &Job) -> CoreResult<Vec<u8>> {
        Err(CoreError::Other(
            "This provider renders images only. Loops need a video provider; drop a file at the listed path instead.".to_string(),
        ))
    }
}

pub struct PlaceholderProvider {
    pub heading: String,
    pub label: String,
    pub accent: Rgb,
}

impl PlaceholderProvider {
    pub fn new(heading: &str, label: &str, accent: Rgb) -> Self {
        PlaceholderProvider { heading: heading.to_string(), label: label.to_string(), accent }
    }

    pub fn for_event(event: &EventSpec, label: &str) -> Self {
        PlaceholderProvider::new(&event.name, label, accent_for(event))
    }
}

pub fn accent_for(event: &EventSpec) -> Rgb {
    event
        .style
        .palette
        .iter()
        .filter_map(|p| pixel::parse_hex_color(p))
        .find(|c| luminance(*c) > 70.0)
        .unwrap_or(pixel::YELLOW)
}

fn luminance(c: Rgb) -> f64 {
    0.2126 * c[0] as f64 + 0.7152 * c[1] as f64 + 0.0722 * c[2] as f64
}

fn center_text(canvas: &mut Canvas, y: i64, text: &str, scale: usize, color: u8) {
    let w = Canvas::text_width(text, scale) as i64;
    let x = (canvas.width as i64 - w) / 2;
    canvas.draw_text(x, y, text, scale, color);
}

pub fn render_placeholder(width: u32, height: u32, heading: &str, label: &str, prompt: &str, accent: Rgb) -> Vec<u8> {
    let w = width.max(16) as usize;
    let h = height.max(16) as usize;
    let mut canvas = Canvas::new(w, h);
    let short = w.min(h);
    let grid = (short / 12).max(24);
    for x in (0..w).step_by(grid) {
        canvas.fill_rect(x as i64, 0, 1, h as i64, 1);
    }
    for y in (0..h).step_by(grid) {
        canvas.fill_rect(0, y as i64, w as i64, 1, 1);
    }
    let frame = (short / 96).max(3) as i64;
    canvas.fill_rect(0, 0, w as i64, frame, 2);
    canvas.fill_rect(0, h as i64 - frame, w as i64, frame, 2);
    canvas.fill_rect(0, 0, frame, h as i64, 2);
    canvas.fill_rect(w as i64 - frame, 0, frame, h as i64, 2);

    let margin = (frame * 6) as usize;
    let usable = w.saturating_sub(margin * 2).max(6 * 6);
    let big = (short / 110).max(2);
    let small = (big / 2).max(1);
    let cols_big = (usable / (6 * big)).max(4);
    let cols_small = (usable / (6 * small)).max(8);

    let mut lines: Vec<(String, usize, u8)> = Vec::new();
    lines.push((heading.to_uppercase(), small, 2));
    for line in pixel::wrap_words(label, cols_big).into_iter().take(3) {
        lines.push((line.to_uppercase(), big, 3));
    }
    lines.push((format!("{} x {}  PLACEHOLDER", width, height), small, 2));
    let mut excerpt = pixel::wrap_words(prompt, cols_small);
    if excerpt.len() > 5 {
        excerpt.truncate(5);
        if let Some(last) = excerpt.last_mut() {
            last.push_str(" ...");
        }
    }
    for line in excerpt {
        lines.push((line.to_uppercase(), small, 3));
    }

    let gap_for = |scale: usize| scale * 4;
    let total: usize = lines.iter().map(|(_, s, _)| Canvas::text_height(*s) + gap_for(*s)).sum::<usize>();
    let mut y = ((h as i64 - total as i64) / 2).max(margin as i64);
    for (text, scale, color) in &lines {
        center_text(&mut canvas, y, text, *scale, *color);
        y += (Canvas::text_height(*scale) + gap_for(*scale)) as i64;
    }
    canvas.encode_png(&[pixel::INK, pixel::GRID, accent, pixel::PAPER])
}

impl Provider for PlaceholderProvider {
    fn generate_image(&self, job: &Job) -> CoreResult<Vec<u8>> {
        Ok(render_placeholder(job.width, job.height, &self.heading, &self.label, job.prompt, self.accent))
    }
}

pub struct OpenAiImages {
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
    pub quality: String,
}

pub fn openai_size(model: &str, width: u32, height: u32) -> String {
    let m = model.to_ascii_lowercase();
    let landscape = width > height;
    let portrait = height > width;
    if m.starts_with("gpt-image") {
        if landscape {
            "1536x1024".to_string()
        } else if portrait {
            "1024x1536".to_string()
        } else {
            "1024x1024".to_string()
        }
    } else if m.starts_with("dall-e-3") {
        if landscape {
            "1792x1024".to_string()
        } else if portrait {
            "1024x1792".to_string()
        } else {
            "1024x1024".to_string()
        }
    } else if m.starts_with("dall-e") {
        "1024x1024".to_string()
    } else {
        format!("{width}x{height}")
    }
}

pub fn openai_request_body(model: &str, prompt: &str, width: u32, height: u32, quality: &str) -> Value {
    let mut body = json!({
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": openai_size(model, width, height),
    });
    if !model.to_ascii_lowercase().starts_with("gpt-image") {
        body["response_format"] = json!("b64_json");
    }
    if !quality.trim().is_empty() {
        body["quality"] = json!(quality.trim());
    }
    body
}

#[derive(Clone, Debug, PartialEq)]
pub enum ImagePayload {
    Base64(String),
    Url(String),
}

pub fn parse_openai_response(value: &Value) -> CoreResult<ImagePayload> {
    let first = value
        .get("data")
        .and_then(|d| d.as_array())
        .and_then(|a| a.first())
        .ok_or_else(|| CoreError::Other(format!("Image API returned no data: {}", excerpt(&value.to_string()))))?;
    if let Some(b64) = first.get("b64_json").and_then(|v| v.as_str()) {
        return Ok(ImagePayload::Base64(b64.to_string()));
    }
    if let Some(url) = first.get("url").and_then(|v| v.as_str()) {
        return Ok(ImagePayload::Url(url.to_string()));
    }
    Err(CoreError::Other("Image API returned neither b64_json nor url".to_string()))
}

pub fn sd_request_body(prompt: &str, negative_prompt: &str, width: u32, height: u32, steps: u32, sampler: &str) -> Value {
    let mut body = json!({
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": width,
        "height": height,
        "steps": steps.max(1),
        "batch_size": 1,
        "n_iter": 1,
    });
    if !sampler.trim().is_empty() {
        body["sampler_name"] = json!(sampler.trim());
    }
    body
}

pub fn parse_sd_response(value: &Value) -> CoreResult<String> {
    value
        .get("images")
        .and_then(|i| i.as_array())
        .and_then(|a| a.first())
        .and_then(|v| v.as_str())
        .map(|s| s.rsplit(',').next().unwrap_or(s).to_string())
        .ok_or_else(|| CoreError::Other(format!("txt2img returned no images: {}", excerpt(&value.to_string()))))
}

pub fn decode_base64(input: &str) -> CoreResult<Vec<u8>> {
    let mut out = Vec::with_capacity(input.len() * 3 / 4);
    let mut buffer = 0u32;
    let mut bits = 0u32;
    for ch in input.bytes() {
        let value = match ch {
            b'A'..=b'Z' => ch - b'A',
            b'a'..=b'z' => ch - b'a' + 26,
            b'0'..=b'9' => ch - b'0' + 52,
            b'+' | b'-' => 62,
            b'/' | b'_' => 63,
            b'=' | b'\n' | b'\r' | b' ' | b'\t' => continue,
            _ => return Err(CoreError::Other(format!("invalid base64 byte {ch:#x}"))),
        } as u32;
        buffer = (buffer << 6) | value;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buffer >> bits) & 0xFF) as u8);
        }
    }
    Ok(out)
}

fn excerpt(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() > 300 {
        format!("{}…", trimmed.chars().take(300).collect::<String>())
    } else {
        trimmed.to_string()
    }
}

fn join_url(base: &str, path: &str) -> String {
    format!("{}/{}", base.trim().trim_end_matches('/'), path.trim_start_matches('/'))
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .http_status_as_error(false)
        .timeout_global(Some(REQUEST_TIMEOUT))
        .build()
        .new_agent()
}

fn transport_err(url: &str, e: ureq::Error) -> CoreError {
    CoreError::Other(format!("Could not reach {url}: {e}"))
}

pub fn post_json(url: &str, bearer: Option<&str>, body: &Value) -> CoreResult<Value> {
    match bearer {
        Some(key) => post_json_with(url, &[("Authorization", &format!("Bearer {key}"))], body),
        None => post_json_with(url, &[], body),
    }
}

pub fn post_json_with(url: &str, headers: &[(&str, &str)], body: &Value) -> CoreResult<Value> {
    let agent = agent();
    let mut request = agent.post(url);
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    let mut response = request.send_json(body).map_err(|e| transport_err(url, e))?;
    let status = response.status().as_u16();
    let bytes = response
        .body_mut()
        .with_config()
        .limit(BODY_LIMIT)
        .read_to_vec()
        .map_err(|e| transport_err(url, e))?;
    let text = String::from_utf8_lossy(&bytes);
    if !(200..300).contains(&status) {
        return Err(CoreError::Other(format!("{url} answered HTTP {status}: {}", excerpt(&text))));
    }
    serde_json::from_str(&text).map_err(|e| CoreError::Other(format!("{url} returned invalid JSON: {e}")))
}

pub fn get_bytes(url: &str) -> CoreResult<Vec<u8>> {
    let agent = agent();
    let mut response = agent.get(url).call().map_err(|e| transport_err(url, e))?;
    let status = response.status().as_u16();
    let bytes = response
        .body_mut()
        .with_config()
        .limit(BODY_LIMIT)
        .read_to_vec()
        .map_err(|e| transport_err(url, e))?;
    if !(200..300).contains(&status) {
        return Err(CoreError::Other(format!("{url} answered HTTP {status}")));
    }
    Ok(bytes)
}

pub fn download_file(url: &str, dest: &Path, progress: &dyn Fn(u64, Option<u64>)) -> CoreResult<u64> {
    let agent = ureq::Agent::config_builder().http_status_as_error(false).timeout_global(None).build().new_agent();
    let mut response = agent.get(url).call().map_err(|e| transport_err(url, e))?;
    let status = response.status().as_u16();
    if !(200..300).contains(&status) {
        return Err(CoreError::Other(format!("{url} answered HTTP {status}")));
    }
    let total = response.headers().get("content-length").and_then(|v| v.to_str().ok()).and_then(|v| v.parse::<u64>().ok());
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    let part = dest.with_extension(format!("{}.part", dest.extension().and_then(|e| e.to_str()).unwrap_or("bin")));
    let mut file = fs::File::create(&part)?;
    let mut reader = response.body_mut().with_config().limit(u64::MAX).reader();
    let mut buffer = vec![0u8; 1 << 20];
    let mut done = 0u64;
    let mut last_report = 0u64;
    loop {
        let read = std::io::Read::read(&mut reader, &mut buffer).map_err(|e| CoreError::Other(format!("{url}: {e}")))?;
        if read == 0 {
            break;
        }
        std::io::Write::write_all(&mut file, &buffer[..read])?;
        done += read as u64;
        if done - last_report >= 8 << 20 {
            last_report = done;
            progress(done, total);
        }
    }
    drop(file);
    fs::rename(&part, dest)?;
    progress(done, total);
    Ok(done)
}

pub fn get_json(url: &str) -> CoreResult<Value> {
    let bytes = get_bytes(url)?;
    serde_json::from_slice(&bytes).map_err(|e| CoreError::Other(format!("{url} returned invalid JSON: {e}")))
}

pub fn post_bytes(url: &str, content_type: &str, body: &[u8]) -> CoreResult<Vec<u8>> {
    let agent = agent();
    let mut response = agent
        .post(url)
        .header("Content-Type", content_type)
        .send(body)
        .map_err(|e| transport_err(url, e))?;
    let status = response.status().as_u16();
    let bytes = response
        .body_mut()
        .with_config()
        .limit(BODY_LIMIT)
        .read_to_vec()
        .map_err(|e| transport_err(url, e))?;
    if !(200..300).contains(&status) {
        return Err(CoreError::Other(format!("{url} answered HTTP {status}: {}", excerpt(&String::from_utf8_lossy(&bytes)))));
    }
    Ok(bytes)
}

impl Provider for OpenAiImages {
    fn generate_image(&self, job: &Job) -> CoreResult<Vec<u8>> {
        if self.api_key.is_none() && is_openai_host(&self.base_url) {
            return Err(CoreError::Other(
                "No API key found. Set the environment variable named in the provider settings, or paste a key in the Content step.".to_string(),
            ));
        }
        let url = join_url(&self.base_url, "images/generations");
        let body = openai_request_body(&self.model, job.prompt, job.width, job.height, &self.quality);
        let response = post_json(&url, self.api_key.as_deref(), &body)?;
        match parse_openai_response(&response)? {
            ImagePayload::Base64(b64) => decode_base64(&b64),
            ImagePayload::Url(image_url) => get_bytes(&image_url),
        }
    }
}

pub struct SdWebui {
    pub base_url: String,
    pub steps: u32,
    pub sampler: String,
    pub negative_prompt: String,
}

impl Provider for SdWebui {
    fn generate_image(&self, job: &Job) -> CoreResult<Vec<u8>> {
        let url = join_url(&self.base_url, "sdapi/v1/txt2img");
        let negative = if job.negative_prompt.trim().is_empty() { self.negative_prompt.as_str() } else { job.negative_prompt };
        let body = sd_request_body(job.prompt, negative, job.width, job.height, self.steps, &self.sampler);
        let response = post_json(&url, None, &body)?;
        decode_base64(&parse_sd_response(&response)?)
    }
}

pub struct ComfyProvider {
    pub root: PathBuf,
    pub base_url: String,
    pub image_workflow: String,
    pub image_nodes: crate::comfy::ComfyNodes,
    pub video_workflow: String,
    pub video_nodes: crate::comfy::ComfyNodes,
    pub timeout_seconds: u64,
    pub seconds: f64,
}

impl ComfyProvider {
    fn workflow_path(&self, rel: &str) -> PathBuf {
        let p = Path::new(rel.trim());
        if p.is_absolute() {
            p.to_path_buf()
        } else {
            self.root.join(p)
        }
    }

    fn load_workflow(&self, rel: &str, what: &str) -> CoreResult<Value> {
        if rel.trim().is_empty() {
            return Err(CoreError::Other(format!("No ComfyUI {what} workflow is set in the provider settings.")));
        }
        let path = self.workflow_path(rel);
        let raw = fs::read_to_string(&path)
            .map_err(|e| CoreError::Other(format!("Cannot read the ComfyUI workflow {}: {e}", path.display())))?;
        serde_json::from_str(&raw).map_err(|e| CoreError::Other(format!("{} is not valid JSON: {e}", path.display())))
    }

    fn run(&self, rel: &str, nodes: &crate::comfy::ComfyNodes, what: &str, job: &Job, video: bool) -> CoreResult<Vec<u8>> {
        let workflow = self.load_workflow(rel, what)?;
        let client = crate::comfy::ComfyClient {
            base_url: self.base_url.clone(),
            timeout: Duration::from_secs(self.timeout_seconds.max(30)),
        };
        let mut uploaded = Vec::new();
        for path in &job.init_images {
            let fitted = fit_init(path, job.width, job.height)?;
            let name = client.upload_image(&fitted);
            let _ = fs::remove_file(&fitted);
            uploaded.push(name?);
        }
        let comfy_job = crate::comfy::ComfyJob {
            prompt: job.prompt,
            negative_prompt: job.negative_prompt,
            width: job.width,
            height: job.height,
            seconds: if video { Some(if self.seconds > 0.0 { self.seconds } else { job.seconds }) } else { None },
            seed: job.seed,
            sampler: job.sampler.clone(),
        };
        let prepared = crate::comfy::prepare(&workflow, &comfy_job, nodes, &uploaded)?;
        client.run(prepared.workflow, video, prepared.nodes.output.as_deref(), job.progress, job.cancel)
    }
}

impl Provider for ComfyProvider {
    fn supports_video(&self) -> bool {
        !self.video_workflow.trim().is_empty()
    }

    fn generate_image(&self, job: &Job) -> CoreResult<Vec<u8>> {
        self.run(&self.image_workflow, &self.image_nodes, "image", job, false)
    }

    fn generate_video(&self, job: &Job) -> CoreResult<Vec<u8>> {
        self.run(&self.video_workflow, &self.video_nodes, "video", job, true)
    }
}

pub struct ReactorProvider {
    pub api_url: String,
    pub api_key: Option<String>,
    pub seconds: f64,
    pub image_role: String,
}

impl Provider for ReactorProvider {
    fn supports_video(&self) -> bool {
        true
    }

    fn generate_image(&self, _job: &Job) -> CoreResult<Vec<u8>> {
        Err(CoreError::Other("Reactor FastH3 renders video loops only. Use another provider for posters.".to_string()))
    }

    fn generate_video(&self, job: &Job) -> CoreResult<Vec<u8>> {
        use ebts_reactor::{reactor::FastH3, GenerateRequest, ImageRole, Progress, VideoGenerator};
        let key = self.api_key.clone();
        let generator = FastH3::new(Box::new(move || key.clone())).with_api_url(&self.api_url);
        let limits = generator.limits();
        let seconds = limits.clamp_seconds(if self.seconds > 0.0 { self.seconds } else { job.seconds });
        let prompt = reactor_prompt(job.prompt, limits.max_prompt_chars);
        let output = std::env::temp_dir().join(format!("ebts-reactor-{}-{}.mp4", std::process::id(), crate::comfy::DEFAULT_FPS as u64 + seconds as u64));
        let request = GenerateRequest {
            prompt,
            seconds,
            image: job.init_images.first().cloned(),
            image_role: ImageRole::Both,
            seed: job.seed,
            output: output.clone(),
        };
        let progress = Progress::default();
        let finished = std::sync::atomic::AtomicBool::new(false);
        let started = std::time::Instant::now();
        let result = std::thread::scope(|scope| {
            let (finished_ref, progress_ref, report, cancel) = (&finished, &progress, job.progress, job.cancel);
            scope.spawn(move || {
                let mut last = String::new();
                while !finished_ref.load(std::sync::atomic::Ordering::Relaxed) {
                    if cancel.map(|c| c.load(std::sync::atomic::Ordering::Relaxed)).unwrap_or(false) && !progress_ref.cancelled() {
                        progress_ref.request_cancel();
                        progress_ref.set_detail("Cancelling and closing the session");
                    }
                    if let Some(report) = report {
                        let detail = progress_ref.detail();
                        let phase = if detail.is_empty() { progress_ref.phase().label().to_string() } else { detail };
                        let elapsed = started.elapsed().as_secs();
                        let line = format!("{phase} · {}:{:02}", elapsed / 60, elapsed % 60);
                        if line != last {
                            report(crate::comfy::Progress { step: 0, total: 0, detail: line.clone() });
                            last = line;
                        }
                    }
                    std::thread::sleep(Duration::from_millis(250));
                }
            });
            let outcome = generator.generate(&request, &progress).map_err(|e| CoreError::Other(format!("Reactor: {e}")));
            finished.store(true, std::sync::atomic::Ordering::Relaxed);
            outcome
        });
        let bytes = result.and_then(|_| fs::read(&output).map_err(|e| CoreError::Other(format!("Reactor clip: {e}"))));
        let _ = fs::remove_file(&output);
        bytes
    }
}

pub fn provider_for(root: &Path, config: &ProviderConfig, event: &EventSpec, item: &ContentItem) -> Box<dyn Provider> {
    match config {
        ProviderConfig::Placeholder => Box::new(PlaceholderProvider::for_event(event, &item.label)),
        ProviderConfig::OpenaiImages { base_url, model, quality, .. } => Box::new(OpenAiImages {
            base_url: base_url.clone(),
            model: model.clone(),
            api_key: config.key_env().and_then(resolve_key),
            quality: quality.clone(),
        }),
        ProviderConfig::SdWebui { base_url, steps, sampler, negative_prompt } => Box::new(SdWebui {
            base_url: base_url.clone(),
            steps: *steps,
            sampler: sampler.clone(),
            negative_prompt: negative_prompt.clone(),
        }),
        ProviderConfig::Comfyui { base_url, image_workflow, image_nodes, video_workflow, video_nodes, timeout_seconds, seconds, .. } => {
            Box::new(ComfyProvider {
                root: root.to_path_buf(),
                base_url: base_url.clone(),
                image_workflow: image_workflow.clone(),
                image_nodes: image_nodes.clone(),
                video_workflow: video_workflow.clone(),
                video_nodes: video_nodes.clone(),
                timeout_seconds: *timeout_seconds,
                seconds: *seconds,
            })
        }
        ProviderConfig::Reactor { api_url, seconds, image_role, .. } => Box::new(ReactorProvider {
            api_url: api_url.clone(),
            api_key: config.key_env().and_then(resolve_key),
            seconds: *seconds,
            image_role: image_role.clone(),
        }),
    }
}

pub fn find_item(event: &EventSpec, root: Option<&Path>, item_id: &str) -> CoreResult<ContentItem> {
    content_manifest(event, root)
        .into_iter()
        .find(|i| i.id == item_id)
        .ok_or_else(|| CoreError::Other(format!("unknown content item {item_id:?}")))
}

pub fn fit_image(bytes: &[u8], width: u32, height: u32) -> CoreResult<Vec<u8>> {
    let decoded = image::load_from_memory(bytes).map_err(|e| CoreError::Other(format!("cannot read the generated image: {e}")))?;
    let fitted = if decoded.width() == width && decoded.height() == height {
        decoded
    } else {
        decoded.resize_to_fill(width, height, image::imageops::FilterType::Lanczos3)
    };
    let mut out = std::io::Cursor::new(Vec::new());
    fitted
        .write_to(&mut out, image::ImageFormat::Png)
        .map_err(|e| CoreError::Other(format!("cannot encode the image: {e}")))?;
    Ok(out.into_inner())
}

pub fn fit_init(path: &Path, width: u32, height: u32) -> CoreResult<PathBuf> {
    let bytes = fs::read(path).map_err(|e| CoreError::Other(format!("{}: {e}", path.display())))?;
    let fitted = fit_image(&bytes, width, height)?;
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("init");
    let out = std::env::temp_dir().join(format!("{stem}-{width}x{height}-{}.png", crate::comfy::random_seed()));
    fs::write(&out, fitted)?;
    Ok(out)
}

pub fn ffmpeg_available() -> bool {
    std::process::Command::new("ffmpeg")
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

pub fn fit_video(bytes: &[u8], width: u32, height: u32) -> CoreResult<Vec<u8>> {
    if !ffmpeg_available() {
        return Ok(bytes.to_vec());
    }
    let (w, h) = (width - width % 2, height - height % 2);
    let tag = format!("ebts-fit-{}-{}", std::process::id(), crate::comfy::random_seed());
    let input = std::env::temp_dir().join(format!("{tag}-in.bin"));
    let output = std::env::temp_dir().join(format!("{tag}-out.mp4"));
    fs::write(&input, bytes)?;
    let status = std::process::Command::new("ffmpeg")
        .args(["-y", "-loglevel", "error", "-i"])
        .arg(&input)
        .args([
            "-map_metadata",
            "-1",
            "-vf",
            &format!("scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-an",
        ])
        .arg(&output)
        .status();
    let result = match status {
        Ok(s) if s.success() => fs::read(&output).map_err(CoreError::from),
        Ok(s) => Err(CoreError::Other(format!("ffmpeg could not fit the clip to {width}×{height} ({s})"))),
        Err(e) => Err(CoreError::Other(format!("ffmpeg: {e}"))),
    };
    let _ = fs::remove_file(&input);
    let _ = fs::remove_file(&output);
    result
}

pub fn write_asset(root: &Path, rel: &str, bytes: &[u8]) -> CoreResult<PathBuf> {
    let abs = root.join(rel);
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = abs.with_extension(format!(
        "{}.part",
        abs.extension().and_then(|e| e.to_str()).unwrap_or("bin")
    ));
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, &abs)?;
    Ok(abs)
}

fn dimension(value: f64) -> u32 {
    value.round().max(16.0) as u32
}

pub fn render_item(
    root: &Path,
    item: &ContentItem,
    provider: &dyn Provider,
    progress: Option<ProgressFn>,
    cancel: Option<&std::sync::atomic::AtomicBool>,
) -> CoreResult<Vec<u8>> {
    let mut init_images = Vec::new();
    for p in &item.init_images {
        let path = Path::new(p);
        let abs = if path.is_absolute() { path.to_path_buf() } else { root.join(path) };
        if !abs.is_file() {
            return Err(CoreError::Other(format!("The init image {} does not exist", abs.display())));
        }
        init_images.push(abs);
    }
    let prompt = if item.kind.is_video() { video_prompt(&item.prompt) } else { item.prompt.clone() };
    let job = Job {
        prompt: &prompt,
        negative_prompt: &item.negative_prompt,
        width: dimension(item.width),
        height: dimension(item.height),
        seconds: item.duration_seconds.unwrap_or(LOOP_SECONDS),
        seed: item.seed,
        init_images,
        progress,
        cancel,
        sampler: item.sampler.clone(),
    };
    let (width, height) = (job.width, job.height);
    let bytes = if item.kind.is_video() { provider.generate_video(&job)? } else { provider.generate_image(&job)? };
    if bytes.is_empty() {
        return Err(CoreError::Other(format!("provider returned an empty file for {}", item.label)));
    }
    let fitted = if item.kind.is_video() { fit_video(&bytes, width, height) } else { fit_image(&bytes, width, height) };
    Ok(fitted.unwrap_or(bytes))
}

pub fn generate_item_with(root: &Path, item: &ContentItem, provider: &dyn Provider) -> CoreResult<ContentItem> {
    let rel = item.canonical();
    let bytes = render_item(root, item, provider, None, None)?;
    write_asset(root, &rel, &bytes)?;
    Ok(ContentItem { path: rel, exists: true, ..item.clone() })
}

pub const CANDIDATE_DIR: &str = "pending";

pub fn candidate_rel(rel: &str) -> String {
    let path = Path::new(rel);
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("result.bin");
    match path.parent().filter(|p| !p.as_os_str().is_empty()) {
        Some(parent) => format!("{}/{CANDIDATE_DIR}/{name}", parent.to_string_lossy().replace('\\', "/")),
        None => format!("{CANDIDATE_DIR}/{name}"),
    }
}

pub fn candidate_target(candidate: &str) -> CoreResult<String> {
    let path = Path::new(candidate);
    let name = path.file_name().and_then(|n| n.to_str());
    let holder = path.parent().filter(|p| p.file_name().and_then(|n| n.to_str()) == Some(CANDIDATE_DIR));
    match (holder, name) {
        (Some(holder), Some(name)) => match holder.parent().filter(|p| !p.as_os_str().is_empty()) {
            Some(parent) => Ok(format!("{}/{name}", parent.to_string_lossy().replace('\\', "/"))),
            None => Ok(name.to_string()),
        },
        _ => Err(CoreError::Other(format!("{candidate} is not a pending result"))),
    }
}

fn drop_empty_holder(root: &Path, candidate: &str) {
    if let Some(holder) = Path::new(candidate).parent() {
        let _ = fs::remove_dir(root.join(holder));
    }
}

pub fn accept_candidate(root: &Path, candidate: &str) -> CoreResult<String> {
    let target = candidate_target(candidate)?;
    let from = root.join(candidate);
    if !from.is_file() {
        return Err(CoreError::Other(format!("The pending result {candidate} is gone")));
    }
    let to = root.join(&target);
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent)?;
    }
    if fs::rename(&from, &to).is_err() {
        fs::copy(&from, &to)?;
        fs::remove_file(&from)?;
    }
    drop_empty_holder(root, candidate);
    Ok(target)
}

pub fn discard_candidate(root: &Path, candidate: &str) -> CoreResult<()> {
    candidate_target(candidate)?;
    let from = root.join(candidate);
    if from.is_file() {
        fs::remove_file(&from)?;
    }
    drop_empty_holder(root, candidate);
    Ok(())
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Generated {
    pub item: ContentItem,
    pub candidate: String,
}

fn job_for(root: &Path, event: &EventSpec, item_id: &str, config: &ProviderConfig) -> CoreResult<(ContentItem, Box<dyn Provider>)> {
    let item = find_item(event, Some(root), item_id)?;
    if item.kind.is_video() && !config.supports_video() {
        return Err(CoreError::Other(format!(
            "{} is a video loop and the {} provider renders images only.",
            item.label,
            config.label()
        )));
    }
    if !item.kind.is_video() && !config.supports_image() {
        return Err(CoreError::Other(format!(
            "{} is an image and the {} provider renders video only.",
            item.label,
            config.label()
        )));
    }
    let provider = provider_for(root, config, event, &item);
    Ok((item, provider))
}

pub fn generate_item(root: &Path, event: &EventSpec, item_id: &str, config: &ProviderConfig) -> CoreResult<ContentItem> {
    let (item, provider) = job_for(root, event, item_id, config)?;
    generate_item_with(root, &item, provider.as_ref())
}

pub fn generate_candidate(
    root: &Path,
    event: &EventSpec,
    item_id: &str,
    config: &ProviderConfig,
    progress: Option<ProgressFn>,
    cancel: Option<&std::sync::atomic::AtomicBool>,
) -> CoreResult<Generated> {
    let (item, provider) = job_for(root, event, item_id, config)?;
    let bytes = render_item(root, &item, provider.as_ref(), progress, cancel)?;
    let candidate = candidate_rel(&item.canonical());
    write_asset(root, &candidate, &bytes)?;
    Ok(Generated { item, candidate })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::example::channelhack;
    use crate::manifest::ContentKind;
    use std::sync::Mutex;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ebts-generate-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn png_dimensions(png: &[u8]) -> (u32, u32) {
        let w = u32::from_be_bytes([png[16], png[17], png[18], png[19]]);
        let h = u32::from_be_bytes([png[20], png[21], png[22], png[23]]);
        (w, h)
    }

    #[test]
    fn placeholder_renders_png_of_requested_size() {
        let provider = PlaceholderProvider::new("Channelhack", "SF / Salon poster", pixel::YELLOW);
        let png = provider.generate_image(&Job::image("Illustrated salon with people talking", 640, 360)).unwrap();
        assert_eq!(&png[1..4], b"PNG");
        assert_eq!(png_dimensions(&png), (640, 360));
        assert!(provider.generate_video(&Job::image("x", 640, 360)).is_err());
        assert!(!provider.supports_video());
    }

    #[test]
    fn placeholder_handles_tiny_and_portrait_sizes() {
        let provider = PlaceholderProvider::new("E", "A very long label that needs wrapping across lines", [255, 0, 128]);
        let png = provider.generate_image(&Job::image("prompt", 1, 1)).unwrap();
        assert_eq!(png_dimensions(&png), (16, 16));
        let tall = provider.generate_image(&Job::image("prompt", 300, 900)).unwrap();
        assert_eq!(png_dimensions(&tall), (300, 900));
    }

    #[test]
    fn generate_item_writes_canonical_path_and_marks_exists() {
        let dir = temp_dir("item");
        let event = channelhack();
        let items = content_manifest(&event, Some(&dir));
        let poster = items.iter().find(|i| i.kind == ContentKind::Poster && i.zone.is_some()).unwrap();
        assert!(!poster.exists);
        let done = generate_item(&dir, &event, &poster.id, &ProviderConfig::Placeholder).unwrap();
        assert!(done.exists);
        assert_eq!(done.path, poster.path);
        assert!(dir.join(&done.path).is_file());
        assert!(!dir.join(format!("{}.part", done.path)).exists());
        let again = content_manifest(&event, Some(&dir));
        assert!(again.iter().find(|i| i.id == poster.id).unwrap().exists);
        let video = items.iter().find(|i| i.kind.is_video()).unwrap();
        assert!(generate_item(&dir, &event, &video.id, &ProviderConfig::Placeholder).is_err());
        assert!(generate_item(&dir, &event, "nope", &ProviderConfig::Placeholder).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn generate_all_missing_posters_with_placeholder() {
        let dir = temp_dir("all");
        let event = channelhack();
        let items = content_manifest(&event, Some(&dir));
        for item in items.iter().filter(|i| !i.kind.is_video()) {
            generate_item(&dir, &event, &item.id, &ProviderConfig::Placeholder).unwrap();
        }
        let after = content_manifest(&event, Some(&dir));
        assert!(after.iter().filter(|i| !i.kind.is_video()).all(|i| i.exists));
        assert!(after.iter().filter(|i| i.kind.is_video()).all(|i| !i.exists));
        let synced = crate::manifest::sync_media(&event, &dir);
        assert!(synced.map.poster.is_some());
        assert!(synced.sites.iter().all(|s| s.map.poster.is_some() && s.zones.iter().all(|z| z.media.poster.is_some())));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_asset_creates_parents() {
        let dir = temp_dir("write");
        let abs = write_asset(&dir, "assets/sites/x/zones/y/poster.png", b"png").unwrap();
        assert_eq!(fs::read(abs).unwrap(), b"png");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn loops_carry_the_lock_block_and_fit_reactor_limits() {
        let full = video_prompt("  a crowded salon  ");
        assert!(full.starts_with("a crowded salon\n\n"));
        assert!(full.ends_with("SEAMLESS LOOP."));
        assert_eq!(video_prompt(""), LOOP_PROMPT);
        let short = reactor_prompt(&full, 800);
        assert!(short.chars().count() <= 800);
        assert!(short.starts_with("a crowded salon\n\n"));
        assert!(short.ends_with("SEAMLESS LOOP."));
        assert!(!short.contains("1. Preserve"));
        let long_user = "x".repeat(2000);
        let squeezed = reactor_prompt(&video_prompt(&long_user), 800);
        assert!(squeezed.chars().count() <= 800);
        assert!(squeezed.ends_with("SEAMLESS LOOP."));
        assert_eq!(reactor_prompt("", 800), LOOP_PROMPT_SHORT);
        let event = channelhack();
        let video = content_manifest(&event, None).into_iter().find(|i| i.kind == ContentKind::LoopVideo).unwrap();
        assert!(!video.prompt.contains("IMAGE_1"), "the card prompt stays the user's own text");
    }

    #[test]
    fn outputs_are_fitted_to_the_slot_size() {
        let provider = PlaceholderProvider::new("ebts", "poster", pixel::YELLOW);
        let wide = provider.generate_image(&Job::image("x", 640, 360)).unwrap();
        let square = fit_image(&wide, 320, 320).unwrap();
        assert_eq!(png_dimensions(&square), (320, 320));
        let same = fit_image(&wide, 640, 360).unwrap();
        assert_eq!(png_dimensions(&same), (640, 360));
        assert!(fit_image(b"not an image", 10, 10).is_err());
        let dir = temp_dir("fit-init");
        let src = dir.join("ref.png");
        fs::write(&src, &wide).unwrap();
        let fitted = fit_init(&src, 100, 200).unwrap();
        assert_eq!(png_dimensions(&fs::read(&fitted).unwrap()), (100, 200));
        let _ = fs::remove_file(&fitted);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn candidates_wait_beside_the_slot_until_accepted() {
        assert_eq!(candidate_rel("assets/sites/a/zones/b/poster.png"), "assets/sites/a/zones/b/pending/poster.png");
        assert_eq!(candidate_target("assets/sites/a/zones/b/pending/poster.png").unwrap(), "assets/sites/a/zones/b/poster.png");
        assert!(candidate_target("assets/sites/a/poster.png").is_err());
        let dir = temp_dir("candidate");
        let event = channelhack();
        let poster = content_manifest(&event, Some(&dir)).into_iter().find(|i| i.kind == ContentKind::Poster).unwrap();
        let steps = Mutex::new(Vec::new());
        let report = |p: Progress| steps.lock().unwrap().push(p.step);
        let made = generate_candidate(&dir, &event, &poster.id, &ProviderConfig::Placeholder, Some(&report), None).unwrap();
        assert_eq!(made.candidate, candidate_rel(&poster.canonical()));
        assert!(dir.join(&made.candidate).is_file());
        assert!(!dir.join(poster.canonical()).exists());
        assert!(!made.item.exists);
        discard_candidate(&dir, &made.candidate).unwrap();
        assert!(!dir.join(&made.candidate).exists());
        assert!(!dir.join(&made.candidate).parent().unwrap().exists());
        let again = generate_candidate(&dir, &event, &poster.id, &ProviderConfig::Placeholder, None, None).unwrap();
        let target = accept_candidate(&dir, &again.candidate).unwrap();
        assert_eq!(target, poster.canonical());
        assert!(dir.join(&target).is_file());
        assert!(!dir.join(&again.candidate).exists());
        assert!(accept_candidate(&dir, &again.candidate).is_err());
        assert!(steps.lock().unwrap().is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn settings_roundtrip_and_defaults() {
        let dir = temp_dir("settings");
        let user = dir.join("user");
        let loaded = load_settings_from(Some(&dir), &user).unwrap();
        assert_eq!(loaded, ProviderSettings::default());
        assert_eq!(loaded.active_config().id(), "comfyui");
        let mut settings = loaded;
        settings.set(
            ProviderConfig::OpenaiImages {
                base_url: "http://localhost:8080/v1".into(),
                model: "flux".into(),
                api_key_env: "MY_KEY".into(),
                quality: String::new(),
            },
            true,
        );
        save_settings_to(Some(&dir), &user, &settings).unwrap();
        let back = load_settings_from(Some(&dir), &user).unwrap();
        assert_eq!(back.active, "openai-images");
        assert_eq!(back.active_config().id(), "openai-images");
        let infos = list_providers(&back, &|_| false, &|config, video| sampler_defaults_for(None, config, video));
        assert_eq!(infos.len(), 2);
        assert!(infos.iter().all(|i| !i.active));
        let reactor = infos.iter().find(|i| i.id == "reactor").unwrap();
        assert!(reactor.supports_video && !reactor.supports_image && reactor.needs_key && reactor.video_init_slots == 1);
        assert_eq!(reactor.key_env.as_deref(), Some(DEFAULT_REACTOR_KEY_ENV));
        let comfy = infos.iter().find(|i| i.id == "comfyui").unwrap();
        assert!(comfy.supports_image && !comfy.supports_video && comfy.image_init_slots == 1);
        assert!(load_settings_from(None, &dir.join("nowhere")).unwrap().configs.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn last_settings_follow_into_new_projects() {
        let dir = temp_dir("remember");
        let user = dir.join("user");
        let first = dir.join("first");
        let second = dir.join("second");
        fs::create_dir_all(first.join("workflows")).unwrap();
        fs::write(first.join("workflows/krea.json"), r#"{"1":{"class_type":"KSampler","inputs":{}}}"#).unwrap();
        let mut settings = ProviderSettings::default();
        settings.set(
            ProviderConfig::Comfyui {
                base_url: "https://comfy.example".into(),
                image_workflow: "workflows/krea.json".into(),
                image_nodes: crate::comfy::ComfyNodes::default(),
                video_workflow: String::new(),
                video_nodes: crate::comfy::ComfyNodes::default(),
                timeout_seconds: 300,
                models_dir: String::new(),
                seconds: 10.0,
            },
            true,
        );
        save_settings_to(Some(&first), &user, &settings).unwrap();
        assert!(user.join("workflows/krea.json").is_file());
        assert!(user.join(PROVIDERS_FILE).is_file());
        fs::create_dir_all(&second).unwrap();
        let fresh = load_settings_from(Some(&second), &user).unwrap();
        assert_eq!(fresh, settings);
        assert!(second.join("workflows/krea.json").is_file());
        assert!(!second.join(PROVIDERS_FILE).exists());
        assert_eq!(load_settings_from(None, &user).unwrap(), settings);
        save_settings_to(None, &user, &ProviderSettings::default()).unwrap();
        assert_eq!(load_settings_from(Some(&first), &user).unwrap(), settings);
        assert_eq!(load_settings_from(Some(&second), &user).unwrap(), ProviderSettings::default());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn config_json_uses_kind_tag() {
        let reactor: ProviderConfig = serde_json::from_str(r#"{"kind":"reactor"}"#).unwrap();
        assert!(!reactor.supports_image());
        let pricing = json!({"models": [{"id": "reactor/fast-h3", "name": "fast-h3", "rate": {"amount_per_sec_usd": "0.0125"}}]});
        assert_eq!(reactor_price(&pricing, REACTOR_MODEL).as_deref(), Some("0.0125"));
        assert_eq!(clip_cost("0.0125", 8.0).as_deref(), Some("0.200"));
        assert!(reactor_price(&json!({}), REACTOR_MODEL).is_none());
        let status = reactor_check("http://127.0.0.1:9", None, 8.0);
        assert!(!status.valid && status.message == "No API key");
        let items = content_manifest(&channelhack(), None);
        let video = items.iter().find(|i| i.kind == ContentKind::LoopVideo).unwrap();
        let poster = items.iter().find(|i| i.kind == ContentKind::Poster).unwrap();
        let dir = temp_dir("video-only");
        assert!(generate_item(&dir, &channelhack(), &poster.id, &reactor).unwrap_err().to_string().contains("video only"));
        assert!(generate_item(&dir, &channelhack(), &video.id, &ProviderConfig::Placeholder).unwrap_err().to_string().contains("images only"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn secrets_store_and_resolve_outside_project() {
        let dir = temp_dir("secrets");
        let path = dir.join("secrets.json");
        assert_eq!(resolve_key_from(&path, "EBTS_TEST_KEY_THAT_IS_UNSET"), None);
        store_key_in(&path, "EBTS_TEST_KEY_THAT_IS_UNSET", " abc123 ").unwrap();
        assert_eq!(resolve_key_from(&path, "EBTS_TEST_KEY_THAT_IS_UNSET").as_deref(), Some("abc123"));
        store_key_in(&path, "EBTS_TEST_KEY_THAT_IS_UNSET", "").unwrap();
        assert_eq!(resolve_key_from(&path, "EBTS_TEST_KEY_THAT_IS_UNSET"), None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn openai_request_shapes() {
        assert_eq!(openai_size("gpt-image-1", 1920, 1080), "1536x1024");
        assert_eq!(openai_size("gpt-image-1", 1080, 1920), "1024x1536");
        assert_eq!(openai_size("dall-e-3", 1920, 1080), "1792x1024");
        assert_eq!(openai_size("dall-e-2", 1920, 1080), "1024x1024");
        assert_eq!(openai_size("flux-schnell", 1600, 1000), "1600x1000");
        let gpt = openai_request_body("gpt-image-1", "p", 1920, 1080, "high");
        assert!(gpt.get("response_format").is_none());
        assert_eq!(gpt["quality"], "high");
        let local = openai_request_body("sdxl", "p", 1920, 1080, "");
        assert_eq!(local["response_format"], "b64_json");
        assert!(local.get("quality").is_none());
        assert_eq!(join_url("http://x/v1/", "/images/generations"), "http://x/v1/images/generations");
    }

    #[test]
    fn response_parsers() {
        let b64 = json!({"data": [{"b64_json": "aGk="}]});
        assert_eq!(parse_openai_response(&b64).unwrap(), ImagePayload::Base64("aGk=".into()));
        let url = json!({"data": [{"url": "https://cdn/x.png"}]});
        assert_eq!(parse_openai_response(&url).unwrap(), ImagePayload::Url("https://cdn/x.png".into()));
        assert!(parse_openai_response(&json!({"error": {"message": "nope"}})).is_err());
        let sd = json!({"images": ["data:image/png;base64,aGk="]});
        assert_eq!(parse_sd_response(&sd).unwrap(), "aGk=");
        assert!(parse_sd_response(&json!({})).is_err());
        assert_eq!(decode_base64("aGVsbG8gd29ybGQ=").unwrap(), b"hello world");
        assert_eq!(decode_base64("aGk").unwrap(), b"hi");
        assert!(decode_base64("a!b").is_err());
    }

    #[test]
    fn sd_request_shape() {
        let body = sd_request_body("p", "ugly", 1024, 768, 0, "DPM++ 2M");
        assert_eq!(body["steps"], 1);
        assert_eq!(body["sampler_name"], "DPM++ 2M");
        assert_eq!(body["negative_prompt"], "ugly");
    }

    #[test]
    fn accent_prefers_bright_palette_colors() {
        let mut event = channelhack();
        event.style.palette = vec!["#000000".into(), "neon".into(), "#7fc4ff".into()];
        assert_eq!(accent_for(&event), [127, 196, 255]);
        event.style.palette.clear();
        assert_eq!(accent_for(&event), pixel::YELLOW);
    }
}
