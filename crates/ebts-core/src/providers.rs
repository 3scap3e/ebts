use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::comfy::{ComfyNodes, SamplerDefaults};

pub const PROVIDERS_FILE: &str = "providers.json";
pub const DEFAULT_OPENAI_BASE: &str = "https://api.openai.com/v1";
pub const DEFAULT_OPENAI_MODEL: &str = "gpt-image-1";
pub const DEFAULT_OPENAI_KEY_ENV: &str = "OPENAI_API_KEY";
pub const DEFAULT_SD_BASE: &str = "http://127.0.0.1:7860";
pub const DEFAULT_SD_STEPS: u32 = 28;
pub const DEFAULT_COMFY_IMAGE_WORKFLOW: &str = "workflows/comfy-txt2img.json";
pub const DEFAULT_REACTOR_API: &str = "https://api.reactor.inc";
pub const DEFAULT_REACTOR_KEY_ENV: &str = "REACTOR_API_KEY";
pub const DEFAULT_REACTOR_SECONDS: f64 = 10.0;
pub const DEFAULT_COMFY_SECONDS: f64 = 10.0;

fn default_comfy_seconds() -> f64 {
    DEFAULT_COMFY_SECONDS
}
pub const REACTOR_MODEL: &str = "reactor/fast-h3";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum ProviderConfig {
    Placeholder,
    OpenaiImages {
        #[serde(default = "default_openai_base")]
        base_url: String,
        #[serde(default = "default_openai_model")]
        model: String,
        #[serde(default = "default_openai_key_env")]
        api_key_env: String,
        #[serde(default)]
        quality: String,
    },
    SdWebui {
        #[serde(default = "default_sd_base")]
        base_url: String,
        #[serde(default = "default_sd_steps")]
        steps: u32,
        #[serde(default)]
        sampler: String,
        #[serde(default)]
        negative_prompt: String,
    },
    Comfyui {
        #[serde(default = "default_comfy_base")]
        base_url: String,
        #[serde(default = "default_comfy_image_workflow")]
        image_workflow: String,
        #[serde(default)]
        image_nodes: ComfyNodes,
        #[serde(default)]
        video_workflow: String,
        #[serde(default)]
        video_nodes: ComfyNodes,
        #[serde(default = "default_comfy_timeout")]
        timeout_seconds: u64,
        #[serde(default)]
        models_dir: String,
        #[serde(default = "default_comfy_seconds")]
        seconds: f64,
    },
    Reactor {
        #[serde(default = "default_reactor_api")]
        api_url: String,
        #[serde(default = "default_reactor_key_env")]
        api_key_env: String,
        #[serde(default = "default_reactor_seconds")]
        seconds: f64,
        #[serde(default)]
        image_role: String,
    },
}

fn default_comfy_base() -> String {
    crate::comfy::DEFAULT_BASE.to_string()
}

fn default_comfy_image_workflow() -> String {
    DEFAULT_COMFY_IMAGE_WORKFLOW.to_string()
}

fn default_comfy_timeout() -> u64 {
    crate::comfy::DEFAULT_TIMEOUT_SECONDS
}

fn default_reactor_api() -> String {
    DEFAULT_REACTOR_API.to_string()
}

fn default_reactor_key_env() -> String {
    DEFAULT_REACTOR_KEY_ENV.to_string()
}

fn default_reactor_seconds() -> f64 {
    DEFAULT_REACTOR_SECONDS
}

fn default_openai_base() -> String {
    DEFAULT_OPENAI_BASE.to_string()
}

fn default_openai_model() -> String {
    DEFAULT_OPENAI_MODEL.to_string()
}

fn default_openai_key_env() -> String {
    DEFAULT_OPENAI_KEY_ENV.to_string()
}

fn default_sd_base() -> String {
    DEFAULT_SD_BASE.to_string()
}

fn default_sd_steps() -> u32 {
    DEFAULT_SD_STEPS
}

pub fn is_openai_host(base_url: &str) -> bool {
    base_url.to_ascii_lowercase().contains("openai.com")
}

impl ProviderConfig {
    pub fn defaults() -> Vec<ProviderConfig> {
        vec![
            ProviderConfig::Comfyui {
                base_url: default_comfy_base(),
                image_workflow: default_comfy_image_workflow(),
                image_nodes: ComfyNodes::default(),
                video_workflow: String::new(),
                video_nodes: ComfyNodes::default(),
                timeout_seconds: default_comfy_timeout(),
                models_dir: String::new(),
                seconds: default_comfy_seconds(),
            },
            ProviderConfig::Reactor {
                api_url: default_reactor_api(),
                api_key_env: default_reactor_key_env(),
                seconds: default_reactor_seconds(),
                image_role: String::new(),
            },
        ]
    }

    pub fn id(&self) -> &'static str {
        match self {
            ProviderConfig::Placeholder => "placeholder",
            ProviderConfig::OpenaiImages { .. } => "openai-images",
            ProviderConfig::SdWebui { .. } => "sd-webui",
            ProviderConfig::Comfyui { .. } => "comfyui",
            ProviderConfig::Reactor { .. } => "reactor",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            ProviderConfig::Placeholder => "Placeholder",
            ProviderConfig::OpenaiImages { .. } => "OpenAI-compatible images API",
            ProviderConfig::SdWebui { .. } => "Stable Diffusion WebUI",
            ProviderConfig::Comfyui { .. } => "ComfyUI",
            ProviderConfig::Reactor { .. } => "Reactor FastH3",
        }
    }

    pub fn key_env(&self) -> Option<&str> {
        match self {
            ProviderConfig::OpenaiImages { api_key_env, .. } if !api_key_env.trim().is_empty() => Some(api_key_env.trim()),
            ProviderConfig::Reactor { api_key_env, .. } if !api_key_env.trim().is_empty() => Some(api_key_env.trim()),
            _ => None,
        }
    }

    pub fn needs_key(&self) -> bool {
        match self {
            ProviderConfig::OpenaiImages { base_url, .. } => is_openai_host(base_url),
            ProviderConfig::Reactor { .. } => true,
            _ => false,
        }
    }

    pub fn offline(&self) -> bool {
        matches!(self, ProviderConfig::Placeholder)
    }

    pub fn supports_video(&self) -> bool {
        match self {
            ProviderConfig::Comfyui { video_workflow, .. } => !video_workflow.trim().is_empty(),
            ProviderConfig::Reactor { .. } => true,
            _ => false,
        }
    }

    pub fn supports_image(&self) -> bool {
        match self {
            ProviderConfig::Comfyui { image_workflow, .. } => !image_workflow.trim().is_empty(),
            ProviderConfig::Reactor { .. } => false,
            _ => true,
        }
    }

    pub fn init_image_slots(&self, video: bool) -> usize {
        match self {
            ProviderConfig::Comfyui { image_nodes, video_nodes, .. } => {
                let nodes = if video { video_nodes } else { image_nodes };
                nodes.images.len().max(1)
            }
            ProviderConfig::Reactor { .. } => usize::from(video),
            _ => 0,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ProviderSettings {
    #[serde(default = "default_active")]
    pub active: String,
    #[serde(default)]
    pub configs: BTreeMap<String, ProviderConfig>,
}

fn default_active() -> String {
    "comfyui".to_string()
}

impl Default for ProviderSettings {
    fn default() -> Self {
        ProviderSettings { active: default_active(), configs: BTreeMap::new() }
    }
}

impl ProviderSettings {
    pub fn config_for(&self, id: &str) -> ProviderConfig {
        if let Some(stored) = self.configs.get(id) {
            return stored.clone();
        }
        ProviderConfig::defaults()
            .into_iter()
            .find(|c| c.id() == id)
            .unwrap_or_else(|| ProviderConfig::defaults().remove(0))
    }

    pub fn active_config(&self) -> ProviderConfig {
        self.config_for(&self.active)
    }

    pub fn set(&mut self, config: ProviderConfig, activate: bool) {
        let id = config.id().to_string();
        if activate {
            self.active = id.clone();
        }
        self.configs.insert(id, config);
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub label: String,
    pub config: ProviderConfig,
    pub active: bool,
    pub needs_key: bool,
    pub key_env: Option<String>,
    pub key_present: bool,
    pub supports_video: bool,
    pub supports_image: bool,
    pub image_init_slots: usize,
    pub video_init_slots: usize,
    pub offline: bool,
    pub image_sampler: Option<SamplerDefaults>,
    pub video_sampler: Option<SamplerDefaults>,
}

pub type SamplerLookup<'a> = &'a dyn Fn(&ProviderConfig, bool) -> Option<SamplerDefaults>;

pub fn list_providers(settings: &ProviderSettings, key_present: &dyn Fn(&str) -> bool, sampler: SamplerLookup) -> Vec<ProviderInfo> {
    ProviderConfig::defaults()
        .into_iter()
        .map(|default| {
            let config = settings.config_for(default.id());
            let key_env = config.key_env().map(|s| s.to_string());
            ProviderInfo {
                image_sampler: sampler(&config, false),
                video_sampler: sampler(&config, true),
                id: config.id().to_string(),
                label: config.label().to_string(),
                active: settings.active == config.id(),
                needs_key: config.needs_key(),
                key_present: key_env.as_deref().map(key_present).unwrap_or(false),
                key_env,
                supports_video: config.supports_video(),
                supports_image: config.supports_image(),
                image_init_slots: config.init_image_slots(false),
                video_init_slots: config.init_image_slots(true),
                offline: config.offline(),
                config,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_comfy_and_reactor_are_offered() {
        let infos = list_providers(&ProviderSettings::default(), &|_| false, &|_, _| None);
        assert_eq!(infos.iter().map(|i| i.id.as_str()).collect::<Vec<_>>(), vec!["comfyui", "reactor"]);
        assert!(infos[0].active);
        assert_eq!(infos[1].video_init_slots, 1);
        assert_eq!(infos[1].image_init_slots, 0);
        assert_eq!(infos[0].image_init_slots, 1);
        let raw = serde_json::to_value(ProviderConfig::defaults()).unwrap();
        assert_eq!(raw[0]["kind"], "comfyui");
        assert_eq!(raw[1]["kind"], "reactor");
        let comfy: ProviderConfig =
            serde_json::from_str(r#"{"kind":"comfyui","video_workflow":"workflows/wan.json","video_nodes":{"images":["1","6"]}}"#).unwrap();
        assert!(comfy.supports_video());
        assert_eq!(comfy.init_image_slots(true), 2);
        let reactor: ProviderConfig = serde_json::from_str(r#"{"kind":"reactor"}"#).unwrap();
        assert!(!reactor.supports_image() && reactor.needs_key());
        assert_eq!(reactor.key_env(), Some(DEFAULT_REACTOR_KEY_ENV));
        let legacy: ProviderConfig = serde_json::from_str(r#"{"kind":"openai-images"}"#).unwrap();
        assert_eq!(legacy.key_env(), Some(DEFAULT_OPENAI_KEY_ENV));
        let mut settings = ProviderSettings::default();
        settings.set(legacy, true);
        assert_eq!(settings.active_config().id(), "openai-images");
        assert_eq!(settings.config_for("nope").id(), "comfyui");
    }
}
