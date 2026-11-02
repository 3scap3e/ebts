use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;

use std::collections::BTreeMap;

use crate::error::{CoreError, CoreResult};
use crate::model::{slugify, ContentOverride, EventSpec};

pub const EVENT_FILE: &str = "event.json";
pub const LOCAL_CONTENT_FILE: &str = "local/content.json";
pub const PROJECT_IGNORE_FILE: &str = ".gitignore";
pub const PROJECT_IGNORE: &str = "local/\nproviders.json\ngeneration.log\nworkflows/*-models.sh\nassets/**/pending/\nassets/refs/\nexport/\n.DS_Store\n*.part\n";

pub type ContentMap = BTreeMap<String, ContentOverride>;
pub type LocalContent = BTreeMap<String, ContentMap>;

pub fn read_local_content(root: &Path) -> LocalContent {
    fs::read_to_string(root.join(LOCAL_CONTENT_FILE))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn write_local_content(root: &Path, content: &LocalContent) -> CoreResult<()> {
    let path = root.join(LOCAL_CONTENT_FILE);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_string_pretty(content)?)?;
    Ok(())
}

pub fn active_provider(root: &Path) -> String {
    crate::generate::load_settings(Some(root)).map(|s| s.active).unwrap_or_else(|_| "comfyui".to_string())
}

pub fn content_for(root: &Path, provider: &str) -> ContentMap {
    read_local_content(root).remove(provider).unwrap_or_default()
}

pub fn remember_content(root: &Path, provider: &str, content: &ContentMap) -> CoreResult<()> {
    let mut local = read_local_content(root);
    let kept: ContentMap = content.iter().filter(|(_, o)| !o.is_empty()).map(|(k, o)| (k.clone(), o.clone())).collect();
    if kept.is_empty() {
        local.remove(provider);
    } else {
        local.insert(provider.to_string(), kept);
    }
    write_local_content(root, &local)
}

pub fn switch_provider(root: &Path, event: &EventSpec, from: &str, to: &str) -> CoreResult<EventSpec> {
    remember_content(root, from, &event.content)?;
    let mut next = event.clone();
    next.content = content_for(root, to);
    Ok(next)
}

pub fn write_project_ignore(root: &Path) -> CoreResult<()> {
    let path = root.join(PROJECT_IGNORE_FILE);
    if !path.is_file() {
        fs::write(path, PROJECT_IGNORE)?;
    }
    Ok(())
}
pub const ASSET_DIRS: [&str; 2] = ["assets/event", "assets/sites"];
pub const AGENTS_MD: &str = include_str!("../assets/AGENTS.md");
pub const COMFY_TXT2IMG: &str = include_str!("../assets/comfy/txt2img.json");
pub const COMFY_TXT2IMG_PATH: &str = "workflows/comfy-txt2img.json";

pub fn event_path(root: &Path) -> PathBuf {
    root.join(EVENT_FILE)
}

pub fn create(root: &Path, name: &str) -> CoreResult<EventSpec> {
    fs::create_dir_all(root)?;
    for dir in ASSET_DIRS {
        fs::create_dir_all(root.join(dir))?;
    }
    let event = EventSpec::blank(&slugify(name), name, Local::now().date_naive());
    write_agent_guide(root)?;
    write_sample_workflows(root)?;
    save(root, &event)?;
    Ok(event)
}

pub fn write_agent_guide(root: &Path) -> CoreResult<()> {
    for name in ["AGENTS.md", "CLAUDE.md"] {
        let path = root.join(name);
        if !path.is_file() {
            fs::write(path, AGENTS_MD)?;
        }
    }
    Ok(())
}

pub fn write_sample_workflows(root: &Path) -> CoreResult<()> {
    let path = root.join(COMFY_TXT2IMG_PATH);
    if !path.is_file() {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, COMFY_TXT2IMG)?;
    }
    Ok(())
}

pub fn open(root: &Path) -> CoreResult<EventSpec> {
    let path = event_path(root);
    if !path.is_file() {
        return Err(CoreError::MissingProject(root.display().to_string()));
    }
    let raw = fs::read_to_string(path)?;
    let mut event: EventSpec = serde_json::from_str(&raw)?;
    if let Some(mine) = read_local_content(root).remove(&active_provider(root)) {
        event.content = mine;
    }
    Ok(event)
}

pub fn save(root: &Path, event: &EventSpec) -> CoreResult<()> {
    fs::create_dir_all(root)?;
    remember_content(root, &active_provider(root), &event.content)?;
    write_project_ignore(root)?;
    let mut shared = event.clone();
    shared.content.clear();
    let raw = serde_json::to_string_pretty(&shared)?;
    fs::write(event_path(root), raw)?;
    Ok(())
}

pub fn import_asset(root: &Path, src: &Path, dest_rel: &str) -> CoreResult<String> {
    if !src.is_file() {
        return Err(CoreError::Other(format!("{} is not a file", src.display())));
    }
    let mut dest = PathBuf::from(dest_rel);
    if let Some(ext) = src.extension() {
        dest.set_extension(ext);
    }
    let abs = root.join(&dest);
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(src, &abs)?;
    Ok(dest.to_string_lossy().replace('\\', "/"))
}

pub fn write_json(root: &Path, dest: &Path, value: &serde_json::Value) -> CoreResult<String> {
    let abs = if dest.is_absolute() { dest.to_path_buf() } else { root.join(dest) };
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&abs, serde_json::to_string_pretty(value)?)?;
    Ok(abs.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_save_open_roundtrip() {
        let dir = std::env::temp_dir().join(format!("ebts-project-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let event = create(&dir, "My Event").unwrap();
        assert_eq!(event.id, "my-event");
        assert!(dir.join("assets/sites").is_dir());
        assert!(dir.join("assets/event").is_dir());
        assert!(!dir.join("assets/opening").exists());
        assert!(dir.join("AGENTS.md").is_file());
        assert!(dir.join("CLAUDE.md").is_file());
        assert!(dir.join(COMFY_TXT2IMG_PATH).is_file());
        assert!(event.sites.is_empty());
        let loaded = open(&dir).unwrap();
        assert_eq!(loaded, event);
        let src = dir.join("pic.webp");
        fs::write(&src, b"img").unwrap();
        let rel = import_asset(&dir, &src, "assets/event/map.png").unwrap();
        assert_eq!(rel, "assets/event/map.webp");
        assert!(dir.join(&rel).is_file());
        assert!(open(&dir.join("nope")).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn prompts_stay_local_and_follow_the_provider() {
        let dir = std::env::temp_dir().join(format!("ebts-local-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let mut event = create(&dir, "Local").unwrap();
        fs::write(dir.join("providers.json"), r#"{"active":"comfyui","configs":{}}"#).unwrap();
        assert!(dir.join(PROJECT_IGNORE_FILE).is_file());
        event.content.insert("poster:a".into(), ContentOverride { prompt: Some("comfy words".into()), ..Default::default() });
        save(&dir, &event).unwrap();
        let shared = fs::read_to_string(event_path(&dir)).unwrap();
        assert!(!shared.contains("comfy words"), "event.json never carries prompts");
        assert!(fs::read_to_string(dir.join(LOCAL_CONTENT_FILE)).unwrap().contains("comfy words"));
        let reopened = open(&dir).unwrap();
        assert_eq!(reopened.content.get("poster:a").and_then(|o| o.prompt.clone()).as_deref(), Some("comfy words"));
        let on_reactor = switch_provider(&dir, &reopened, "comfyui", "reactor").unwrap();
        assert!(on_reactor.content.is_empty(), "each provider remembers its own prompts");
        let mut on_reactor = on_reactor;
        on_reactor.content.insert("poster:a".into(), ContentOverride { prompt: Some("reactor words".into()), ..Default::default() });
        let back = switch_provider(&dir, &on_reactor, "reactor", "comfyui").unwrap();
        assert_eq!(back.content.get("poster:a").and_then(|o| o.prompt.clone()).as_deref(), Some("comfy words"));
        assert_eq!(content_for(&dir, "reactor").get("poster:a").and_then(|o| o.prompt.clone()).as_deref(), Some("reactor words"));
        let _ = fs::remove_dir_all(&dir);
    }
}
