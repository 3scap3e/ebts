use std::collections::BTreeMap;
#[cfg(not(target_arch = "wasm32"))]
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(not(target_arch = "wasm32"))]
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::error::{CoreError, CoreResult};
use crate::model::SamplerOverride;

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct SamplerDefaults {
    pub steps: Option<f64>,
    pub cfg: Option<f64>,
    pub denoise: Option<f64>,
}

const OVERRIDE_KEYS: [&str; 3] = ["steps", "cfg", "denoise"];

pub fn sampler_defaults(workflow: &Value, values: &BTreeMap<String, Map<String, Value>>) -> Option<SamplerDefaults> {
    let map = nodes(workflow).ok()?;
    let mut found = SamplerDefaults::default();
    for id in sorted_ids(map) {
        let Some(i) = inputs(&map[&id]) else { continue };
        for key in OVERRIDE_KEYS {
            let value = values.get(&id).and_then(|v| v.get(key)).or_else(|| i.get(key)).and_then(|v| v.as_f64());
            let slot = match key {
                "steps" => &mut found.steps,
                "cfg" => &mut found.cfg,
                _ => &mut found.denoise,
            };
            if slot.is_none() && i.get(key).map(|v| v.is_number()).unwrap_or(false) {
                *slot = value;
            }
        }
    }
    (found.steps.is_some() || found.cfg.is_some() || found.denoise.is_some()).then_some(found)
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Progress {
    pub step: u32,
    pub total: u32,
    pub detail: String,
}

pub const DEFAULT_BASE: &str = "http://127.0.0.1:8188";
pub const DEFAULT_TIMEOUT_SECONDS: u64 = 1800;
pub const DEFAULT_FPS: f64 = 16.0;
const MEDIA_KEYS: [&str; 6] = ["images", "gifs", "videos", "video", "files", "audio"];
const IMAGE_EXTS: [&str; 4] = ["png", "jpg", "jpeg", "webp"];
const VIDEO_EXTS: [&str; 4] = ["mp4", "webm", "mov", "gif"];
const SAVE_CLASSES: [&str; 8] = [
    "SaveImage",
    "SaveAnimatedWEBP",
    "SaveAnimatedPNG",
    "SaveVideo",
    "VHS_VideoCombine",
    "SaveWEBM",
    "SaveAudio",
    "PreviewImage",
];

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComfyNodes {
    #[serde(default)]
    pub prompt: Vec<String>,
    #[serde(default)]
    pub negative: Vec<String>,
    #[serde(default)]
    pub images: Vec<String>,
    #[serde(default)]
    pub output: Option<String>,
    #[serde(default)]
    pub loras: Vec<String>,
    #[serde(default)]
    pub values: BTreeMap<String, Map<String, Value>>,
}

impl ComfyNodes {
    pub fn is_empty(&self) -> bool {
        self.prompt.is_empty() && self.negative.is_empty() && self.images.is_empty() && self.output.is_none() && self.values.is_empty()
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FieldInfo {
    pub key: String,
    pub value: Value,
    pub kind: String,
    pub options: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct NodeInfo {
    pub id: String,
    pub class_type: String,
    pub title: String,
    pub text_keys: Vec<String>,
    pub image_keys: Vec<String>,
    pub has_size: bool,
    pub has_seed: bool,
    pub saves: bool,
    pub lora: bool,
    pub sampler: bool,
    pub fields: Vec<FieldInfo>,
    pub suggested: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ComfyJob<'a> {
    pub prompt: &'a str,
    pub negative_prompt: &'a str,
    pub width: u32,
    pub height: u32,
    pub seconds: Option<f64>,
    pub seed: Option<u64>,
    pub sampler: SamplerOverride,
}

#[derive(Clone, Debug, PartialEq, Default)]
pub struct Prepared {
    pub workflow: Value,
    pub nodes: ComfyNodes,
    pub sized: Vec<String>,
    pub seeded: Vec<String>,
    pub frames: Vec<String>,
}

pub fn parse_workflow(raw: &str) -> CoreResult<Value> {
    let value: Value = serde_json::from_str(raw).map_err(|e| CoreError::Other(format!("The workflow is not valid JSON: {e}")))?;
    nodes(&value)?;
    Ok(value)
}

fn nodes(workflow: &Value) -> CoreResult<&Map<String, Value>> {
    let map = workflow
        .as_object()
        .ok_or_else(|| CoreError::Other("The ComfyUI workflow is not a JSON object".to_string()))?;
    if map.contains_key("nodes") && map.contains_key("links") {
        return Err(CoreError::Other(
            "This is a ComfyUI canvas file. Export the workflow with Save (API Format) and use that file.".to_string(),
        ));
    }
    if !map.values().any(|n| n.get("class_type").is_some()) {
        return Err(CoreError::Other("The ComfyUI workflow has no nodes with class_type".to_string()));
    }
    Ok(map)
}

fn inputs(node: &Value) -> Option<&Map<String, Value>> {
    node.get("inputs").and_then(|i| i.as_object())
}

fn title(node: &Value) -> String {
    node.get("_meta")
        .and_then(|m| m.get("title"))
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string()
}

fn class(node: &Value) -> String {
    node.get("class_type").and_then(|c| c.as_str()).unwrap_or("").to_string()
}

fn link_target(value: &Value) -> Option<String> {
    let arr = value.as_array()?;
    match arr.first()? {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn sorted_ids(map: &Map<String, Value>) -> Vec<String> {
    let mut ids: Vec<String> = map.keys().cloned().collect();
    ids.sort_by_key(|id| (id.parse::<u64>().unwrap_or(u64::MAX), id.clone()));
    ids
}

fn text_keys(node: &Value) -> Vec<String> {
    let c = class(node).to_ascii_lowercase();
    let primitive_text = c.contains("string") || c.contains("text") || c.contains("primitive");
    inputs(node)
        .map(|i| {
            i.iter()
                .filter(|(k, v)| {
                    v.is_string()
                        && (k.as_str() == "text" || k.contains("prompt") || k.as_str() == "string" || (primitive_text && k.as_str() == "value"))
                })
                .map(|(k, _)| k.clone())
                .collect()
        })
        .unwrap_or_default()
}

fn image_keys(node: &Value) -> Vec<String> {
    if class(node) == "LoadImage" || class(node) == "LoadImageMask" {
        return vec!["image".to_string()];
    }
    inputs(node)
        .map(|i| {
            i.iter()
                .filter(|(k, v)| v.is_string() && (k.as_str() == "image" || k.as_str() == "video" || k.ends_with("_image")))
                .map(|(k, _)| k.clone())
                .collect()
        })
        .unwrap_or_default()
}

const ENDING_WORDS: [&str; 3] = ["end", "last", "final"];

fn is_frame_key(key: &str) -> bool {
    let k = key.to_ascii_lowercase();
    k.contains("start") || k.contains("first") || ENDING_WORDS.iter().any(|w| k.contains(w))
}

fn is_ending_frame(node: &Value) -> bool {
    let t = title(node).to_ascii_lowercase();
    ENDING_WORDS.iter().any(|w| t.split(|c: char| !c.is_alphanumeric()).any(|word| word == *w))
        || image_keys(node).iter().any(|k| {
            let k = k.to_ascii_lowercase();
            ENDING_WORDS.iter().any(|w| k.contains(w))
        })
}

fn has_size(node: &Value) -> bool {
    inputs(node)
        .map(|i| i.get("width").map(|v| v.is_number()).unwrap_or(false) && i.get("height").map(|v| v.is_number()).unwrap_or(false))
        .unwrap_or(false)
}

fn has_seed(node: &Value) -> bool {
    inputs(node)
        .map(|i| i.get("seed").map(|v| v.is_number()).unwrap_or(false) || i.get("noise_seed").map(|v| v.is_number()).unwrap_or(false))
        .unwrap_or(false)
}

fn saves(node: &Value) -> bool {
    let c = class(node);
    SAVE_CLASSES.contains(&c.as_str()) || c.starts_with("Save") || c.contains("VideoCombine")
}

fn is_lora(node: &Value) -> bool {
    class(node).to_ascii_lowercase().contains("lora")
}

const SAMPLER_KEYS: [&str; 10] = ["steps", "cfg", "denoise", "sampler_name", "scheduler", "guidance", "shift", "max_shift", "base_shift", "cfg_scale"];

fn is_sampler(node: &Value) -> bool {
    inputs(node)
        .map(|i| i.iter().any(|(k, v)| SAMPLER_KEYS.contains(&k.as_str()) && !v.is_array() && !v.is_object()))
        .unwrap_or(false)
}

fn combo_options(info: Option<&Value>, class_type: &str, key: &str) -> Vec<String> {
    let Some(info) = info else { return Vec::new() };
    for group in ["required", "optional"] {
        if let Some(spec) = info.get(class_type).and_then(|c| c.get("input")).and_then(|i| i.get(group)).and_then(|g| g.get(key)) {
            if let Some(list) = spec.as_array().and_then(|a| a.first()).and_then(|k| k.as_array()) {
                return list.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect();
            }
            if let Some(list) = spec.as_array().and_then(|a| a.get(1)).and_then(|o| o.get("options")).and_then(|o| o.as_array()) {
                return list
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.get("key").and_then(|k| k.as_str()).map(|s| s.to_string())))
                    .collect();
            }
        }
    }
    Vec::new()
}

fn fields(node: &Value, info: Option<&Value>) -> Vec<FieldInfo> {
    let lora = is_lora(node);
    if !lora && !is_sampler(node) {
        return Vec::new();
    }
    let class_type = class(node);
    inputs(node)
        .map(|i| {
            i.iter()
                .filter(|(k, v)| !v.is_array() && !v.is_object() && (lora || SAMPLER_KEYS.contains(&k.as_str())))
                .map(|(k, v)| {
                    let options = combo_options(info, &class_type, k);
                    let kind = if !options.is_empty() || k.ends_with("_name") {
                        "combo"
                    } else if v.is_number() {
                        "number"
                    } else if v.is_boolean() {
                        "bool"
                    } else {
                        "text"
                    };
                    FieldInfo { key: k.clone(), value: v.clone(), kind: kind.to_string(), options }
                })
                .collect()
        })
        .unwrap_or_default()
}

fn linked_text_nodes(map: &Map<String, Value>, names: &[&str]) -> Vec<String> {
    let mut out = Vec::new();
    for id in sorted_ids(map) {
        let Some(i) = inputs(&map[&id]) else { continue };
        for input in names {
            if let Some(target) = i.get(*input).and_then(link_target) {
                if map.get(&target).map(|n| !text_keys(n).is_empty()).unwrap_or(false) && !out.contains(&target) {
                    out.push(target);
                }
            }
        }
    }
    out
}

pub fn suggest(workflow: &Value) -> CoreResult<ComfyNodes> {
    let map = nodes(workflow)?;
    let ids = sorted_ids(map);
    let texts: Vec<String> = ids.iter().filter(|id| !text_keys(&map[*id]).is_empty()).cloned().collect();
    let mut prompt = linked_text_nodes(map, &["positive", "prompt", "positive_prompt", "text"]);
    let mut negative = linked_text_nodes(map, &["negative", "negative_prompt"]);
    if prompt.is_empty() {
        prompt = texts
            .iter()
            .filter(|id| {
                let t = title(&map[*id]).to_ascii_lowercase();
                t.contains("positive") || (t.contains("prompt") && !t.contains("negative"))
            })
            .cloned()
            .collect();
    }
    if negative.is_empty() {
        negative = texts.iter().filter(|id| title(&map[*id]).to_ascii_lowercase().contains("negative")).cloned().collect();
    }
    if prompt.is_empty() {
        prompt = texts.iter().filter(|id| !negative.contains(id)).take(1).cloned().collect();
    }
    let images: Vec<String> = ids.iter().filter(|id| class(&map[*id]) == "LoadImage").cloned().collect();
    let output = ids
        .iter()
        .find(|id| saves(&map[*id]) && class(&map[*id]) != "PreviewImage")
        .or_else(|| ids.iter().find(|id| saves(&map[*id])))
        .cloned();
    let loras: Vec<String> = ids.iter().filter(|id| is_lora(&map[*id])).cloned().collect();
    Ok(ComfyNodes { prompt, negative, images, output, loras, values: BTreeMap::new() })
}

pub fn inspect(workflow: &Value) -> CoreResult<Vec<NodeInfo>> {
    inspect_with(workflow, None)
}

pub fn inspect_with(workflow: &Value, info: Option<&Value>) -> CoreResult<Vec<NodeInfo>> {
    let map = nodes(workflow)?;
    let suggested = suggest(workflow)?;
    Ok(sorted_ids(map)
        .into_iter()
        .map(|id| {
            let node = &map[&id];
            let role = if suggested.prompt.contains(&id) {
                Some("prompt")
            } else if suggested.negative.contains(&id) {
                Some("negative")
            } else if suggested.images.contains(&id) {
                Some("image")
            } else if suggested.output.as_deref() == Some(id.as_str()) {
                Some("output")
            } else if suggested.loras.contains(&id) {
                Some("lora")
            } else if is_sampler(node) {
                Some("sampler")
            } else {
                None
            };
            NodeInfo {
                id: id.clone(),
                class_type: class(node),
                title: title(node),
                text_keys: text_keys(node),
                image_keys: image_keys(node),
                has_size: has_size(node),
                has_seed: has_seed(node),
                saves: saves(node),
                lora: is_lora(node),
                sampler: is_sampler(node),
                fields: fields(node, info),
                suggested: role.map(|r| r.to_string()),
            }
        })
        .collect())
}

fn referenced_ids(map: &Map<String, Value>) -> Vec<String> {
    let mut out = Vec::new();
    for node in map.values() {
        let Some(i) = inputs(node) else { continue };
        for value in i.values() {
            if let Some(target) = link_target(value) {
                if !out.contains(&target) {
                    out.push(target);
                }
            }
        }
    }
    out
}

fn is_primitive_number(node: &Value) -> bool {
    inputs(node).and_then(|i| i.get("value")).map(|v| v.is_number()).unwrap_or(false)
}

fn primitive_behind(map: &Map<String, Value>, i: &Map<String, Value>, key: &str) -> Option<String> {
    let target = i.get(key).and_then(link_target)?;
    map.get(&target).filter(|n| is_primitive_number(n)).map(|_| target)
}

fn is_duration_primitive(node: &Value) -> bool {
    let t = title(node).to_ascii_lowercase();
    is_primitive_number(node) && (t.contains("duration") || t.contains("seconds"))
}

pub fn latent_size(value: u32) -> u32 {
    value.max(16).div_ceil(16) * 16
}

fn set_input(workflow: &mut Value, id: &str, key: &str, value: Value) {
    if let Some(inputs) = workflow.get_mut(id).and_then(|n| n.get_mut("inputs")).and_then(|i| i.as_object_mut()) {
        inputs.insert(key.to_string(), value);
    }
}

pub fn random_seed() -> u64 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let mixed = (nanos as u64) ^ ((std::process::id() as u64) << 32) ^ 0x9E37_79B9_7F4A_7C15;
    mixed % 2_147_483_647
}

fn fps_of(map: &Map<String, Value>) -> f64 {
    map.values()
        .filter_map(inputs)
        .find_map(|i| i.get("fps").or_else(|| i.get("frame_rate")).and_then(|v| v.as_f64()))
        .filter(|f| *f > 0.0)
        .unwrap_or(DEFAULT_FPS)
}

fn resolved(workflow: &Value, chosen: &ComfyNodes) -> CoreResult<ComfyNodes> {
    let auto = suggest(workflow)?;
    let prompt = if chosen.prompt.is_empty() { auto.prompt } else { chosen.prompt.clone() };
    let negative: Vec<String> = if chosen.negative.is_empty() { auto.negative } else { chosen.negative.clone() }
        .into_iter()
        .filter(|id| !prompt.contains(id))
        .collect();
    Ok(ComfyNodes {
        prompt,
        negative,
        images: if chosen.images.is_empty() { auto.images } else { chosen.images.clone() },
        output: chosen.output.clone().or(auto.output),
        loras: if chosen.loras.is_empty() { auto.loras } else { chosen.loras.clone() },
        values: chosen.values.clone(),
    })
}

fn set_text(workflow: &mut Value, map: &Map<String, Value>, id: &str, text: &str) {
    let keys = map.get(id).map(text_keys).unwrap_or_default();
    let key = keys.iter().find(|k| k.as_str() == "text").or_else(|| keys.first()).cloned().unwrap_or_else(|| "text".to_string());
    set_input(workflow, id, &key, json!(text));
}

pub fn prepare(workflow: &Value, job: &ComfyJob, chosen: &ComfyNodes, uploaded: &[String]) -> CoreResult<Prepared> {
    let map = nodes(workflow)?;
    let nodes = resolved(workflow, chosen)?;
    if nodes.prompt.is_empty() {
        return Err(CoreError::Other("Pick the prompt node of the workflow (a CLIPTextEncode or any node with a text input).".to_string()));
    }
    let mut out = workflow.clone();
    for (id, values) in &nodes.values {
        for (key, value) in values {
            if map.get(id).and_then(inputs).map(|i| i.contains_key(key)).unwrap_or(false) {
                set_input(&mut out, id, key, value.clone());
            }
        }
    }
    let overrides = [
        ("steps", job.sampler.steps.map(|s| json!(s))),
        ("cfg", job.sampler.cfg.map(|c| json!(c))),
        ("denoise", job.sampler.denoise.map(|d| json!(d))),
    ];
    for id in sorted_ids(map) {
        let Some(i) = inputs(&map[&id]) else { continue };
        for (key, value) in &overrides {
            if let Some(value) = value {
                if i.get(*key).map(|v| v.is_number()).unwrap_or(false) {
                    set_input(&mut out, &id, key, value.clone());
                }
            }
        }
    }
    for id in &nodes.prompt {
        set_text(&mut out, map, id, job.prompt);
    }
    if !job.negative_prompt.trim().is_empty() {
        for id in &nodes.negative {
            set_text(&mut out, map, id, job.negative_prompt.trim());
        }
    }
    let mut sized = Vec::new();
    let mut seeded = Vec::new();
    let mut frames = Vec::new();
    let seed = job.seed.unwrap_or_else(random_seed);
    let fps = fps_of(map);
    for id in sorted_ids(map) {
        let node = &map[&id];
        let Some(i) = inputs(node) else { continue };
        if has_size(node) {
            set_input(&mut out, &id, "width", json!(latent_size(job.width)));
            set_input(&mut out, &id, "height", json!(latent_size(job.height)));
            sized.push(id.clone());
        }
        for (key, dim) in [("width", job.width), ("height", job.height)] {
            if let Some(primitive) = primitive_behind(map, i, key) {
                set_input(&mut out, &primitive, "value", json!(latent_size(dim)));
                if !sized.contains(&primitive) {
                    sized.push(primitive);
                }
            }
        }
        if let Some(seconds) = job.seconds {
            if is_duration_primitive(node) {
                set_input(&mut out, &id, "value", json!(seconds));
                if !frames.contains(&id) {
                    frames.push(id.clone());
                }
            }
        }
        for key in ["seed", "noise_seed"] {
            if i.get(key).map(|v| v.is_number()).unwrap_or(false) {
                set_input(&mut out, &id, key, json!(seed));
                if !seeded.contains(&id) {
                    seeded.push(id.clone());
                }
            }
        }
        if let Some(seconds) = job.seconds {
            for key in ["length", "num_frames", "video_frames", "frames", "frame_count"] {
                if i.get(key).map(|v| v.is_number()).unwrap_or(false) {
                    set_input(&mut out, &id, key, json!((seconds * fps).round().max(1.0) as u64));
                    if !frames.contains(&id) {
                        frames.push(id.clone());
                    }
                }
            }
        }
    }
    if !uploaded.is_empty() && nodes.images.is_empty() {
        return Err(CoreError::Other(
            "The workflow has no image input node, so init images cannot be used. Pick one in the provider settings or clear the init images.".to_string(),
        ));
    }
    if job.seconds.is_some() && uploaded.len() == 1 {
        let name = &uploaded[0];
        for (index, id) in nodes.images.iter().enumerate() {
            let Some(node) = map.get(id) else { continue };
            let keys = image_keys(node);
            let ending = is_ending_frame(node);
            if index == 0 {
                let frame_keys: Vec<String> = keys.iter().filter(|k| is_frame_key(k)).cloned().collect();
                for key in if frame_keys.is_empty() { keys.first().cloned().into_iter().collect() } else { frame_keys } {
                    set_input(&mut out, id, &key, json!(name));
                }
            } else if ending {
                for key in keys.iter().filter(|k| is_frame_key(k) || keys.len() == 1) {
                    set_input(&mut out, id, key, json!(name));
                }
            }
        }
    } else {
        for (id, name) in nodes.images.iter().zip(uploaded.iter()) {
            let keys = map.get(id).map(image_keys).unwrap_or_default();
            let key = keys.first().cloned().unwrap_or_else(|| "image".to_string());
            set_input(&mut out, id, &key, json!(name));
        }
    }
    let referenced = referenced_ids(map);
    for id in nodes.images.iter().filter(|id| referenced.contains(*id)) {
        let Some(node) = map.get(id) else { continue };
        let blank = image_keys(node)
            .iter()
            .any(|key| out.get(id).and_then(|n| n.get("inputs")).and_then(|i| i.get(key)).and_then(|v| v.as_str()).map(|s| s.trim().is_empty()).unwrap_or(false));
        if blank {
            return Err(CoreError::Other(format!(
                "The workflow needs an init image for #{id} · {}. Add one to the slot before generating.",
                title(node)
            )));
        }
    }
    Ok(Prepared { workflow: out, nodes, sized, seeded, frames })
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OutputFile {
    pub filename: String,
    pub subfolder: String,
    pub kind: String,
}

fn ext_of(name: &str) -> String {
    name.rsplit('.').next().unwrap_or("").to_ascii_lowercase()
}

pub fn pick_output(history: &Value, prompt_id: &str, video: bool, output_node: Option<&str>) -> CoreResult<OutputFile> {
    let entry = history
        .get(prompt_id)
        .ok_or_else(|| CoreError::Other("ComfyUI history has no entry for this prompt yet".to_string()))?;
    if let Some(status) = entry.get("status") {
        if status.get("status_str").and_then(|s| s.as_str()) == Some("error") {
            let messages = status
                .get("messages")
                .and_then(|m| m.as_array())
                .map(|list| {
                    list.iter()
                        .filter_map(|m| m.get(1))
                        .filter_map(|d| d.get("exception_message").and_then(|e| e.as_str()))
                        .collect::<Vec<_>>()
                        .join("; ")
                })
                .unwrap_or_default();
            return Err(CoreError::Other(format!("ComfyUI failed: {}", if messages.is_empty() { "see the server log".to_string() } else { messages })));
        }
    }
    let outputs = entry
        .get("outputs")
        .and_then(|o| o.as_object())
        .ok_or_else(|| CoreError::Other("ComfyUI returned no outputs".to_string()))?;
    let wanted: &[&str] = if video { &VIDEO_EXTS } else { &IMAGE_EXTS };
    let mut candidates = Vec::new();
    let mut ordered: Vec<(&String, &Value)> = outputs.iter().collect();
    ordered.sort_by_key(|(id, _)| (if output_node == Some(id.as_str()) { 0 } else { 1 }, id.parse::<u64>().unwrap_or(u64::MAX), (*id).clone()));
    for (_, node) in ordered {
        for key in MEDIA_KEYS {
            if let Some(list) = node.get(key).and_then(|v| v.as_array()) {
                for file in list {
                    let Some(name) = file.get("filename").and_then(|f| f.as_str()) else { continue };
                    let kind = file.get("type").and_then(|t| t.as_str()).unwrap_or("output").to_string();
                    if kind == "temp" {
                        continue;
                    }
                    candidates.push(OutputFile {
                        filename: name.to_string(),
                        subfolder: file.get("subfolder").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                        kind,
                    });
                }
            }
        }
    }
    candidates
        .iter()
        .find(|c| wanted.contains(&ext_of(&c.filename).as_str()))
        .or_else(|| candidates.first())
        .cloned()
        .ok_or_else(|| CoreError::Other("ComfyUI finished without saving a file. Add a SaveImage or video save node.".to_string()))
}

pub fn view_url(base: &str, file: &OutputFile) -> String {
    format!(
        "{}/view?filename={}&subfolder={}&type={}",
        base.trim_end_matches('/'),
        encode(&file.filename),
        encode(&file.subfolder),
        encode(&file.kind)
    )
}

fn encode(value: &str) -> String {
    let mut out = String::new();
    for b in value.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

pub fn multipart(boundary: &str, field: &str, filename: &str, mime: &str, bytes: &[u8], extra: &[(&str, &str)]) -> Vec<u8> {
    let mut body = Vec::with_capacity(bytes.len() + 512);
    for (key, value) in extra {
        body.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n").as_bytes());
    }
    body.extend_from_slice(
        format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{filename}\"\r\nContent-Type: {mime}\r\n\r\n")
            .as_bytes(),
    );
    body.extend_from_slice(bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

pub fn mime_for(name: &str) -> &'static str {
    match ext_of(name).as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    }
}

pub fn upload_response_name(value: &Value, fallback: &str) -> String {
    let uploaded = value.get("name").and_then(|n| n.as_str()).unwrap_or(fallback).to_string();
    let subfolder = value.get("subfolder").and_then(|s| s.as_str()).unwrap_or("");
    if subfolder.is_empty() { uploaded } else { format!("{subfolder}/{uploaded}") }
}

pub fn node_errors(submitted: &Value) -> Option<String> {
    let errors = submitted.get("node_errors").and_then(|e| e.as_object()).filter(|e| !e.is_empty())?;
    let details: Vec<String> = errors
        .iter()
        .map(|(id, err)| {
            let msg = err
                .get("errors")
                .and_then(|l| l.as_array())
                .and_then(|l| l.first())
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("invalid");
            format!("node {id}: {msg}")
        })
        .collect();
    Some(details.join("; "))
}

pub type NodeMap = BTreeMap<String, Value>;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ComfyImport {
    pub path: String,
    pub converted: bool,
    pub nodes: Vec<NodeInfo>,
}

const VIRTUAL_CLASSES: [&str; 6] = ["Reroute", "PrimitiveNode", "Note", "MarkdownNote", "GroupNode", "Comment"];
const CONTROL_VALUES: [&str; 4] = ["fixed", "increment", "decrement", "randomize"];
const SEED_CONTROL_NAMES: [&str; 3] = ["seed", "noise_seed", "rand_seed"];

pub fn is_canvas(workflow: &Value) -> bool {
    workflow
        .as_object()
        .map(|m| m.contains_key("nodes") && m.contains_key("links"))
        .unwrap_or(false)
}

fn id_text(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

struct Graph<'a> {
    nodes: BTreeMap<String, &'a Value>,
    links: BTreeMap<String, (String, u64)>,
}

impl<'a> Graph<'a> {
    fn parse(graph: &'a Value) -> CoreResult<Self> {
        let node_list = graph
            .get("nodes")
            .and_then(|n| n.as_array())
            .ok_or_else(|| CoreError::Other("The ComfyUI canvas has no nodes".to_string()))?;
        let mut nodes = BTreeMap::new();
        for node in node_list {
            if let Some(id) = node.get("id").and_then(id_text) {
                nodes.insert(id, node);
            }
        }
        let mut links = BTreeMap::new();
        for link in graph.get("links").and_then(|l| l.as_array()).into_iter().flatten() {
            if let Some(arr) = link.as_array() {
                if arr.len() >= 3 {
                    if let (Some(id), Some(from), Some(slot)) = (id_text(&arr[0]), id_text(&arr[1]), arr[2].as_u64()) {
                        links.insert(id, (from, slot));
                    }
                }
            } else if let Some(obj) = link.as_object() {
                let id = obj.get("id").and_then(id_text);
                let from = obj.get("origin_id").and_then(id_text);
                let slot = obj.get("origin_slot").and_then(|s| s.as_u64());
                if let (Some(id), Some(from), Some(slot)) = (id, from, slot) {
                    links.insert(id, (from, slot));
                }
            }
        }
        Ok(Graph { nodes, links })
    }

    fn class_of(&self, id: &str) -> String {
        self.nodes.get(id).and_then(|n| n.get("type")).and_then(|t| t.as_str()).unwrap_or("").to_string()
    }

    fn mode_of(&self, id: &str) -> u64 {
        self.nodes.get(id).and_then(|n| n.get("mode")).and_then(|m| m.as_u64()).unwrap_or(0)
    }

    fn input_link(&self, id: &str, pick: &dyn Fn(&Value) -> bool) -> Option<String> {
        self.nodes
            .get(id)?
            .get("inputs")?
            .as_array()?
            .iter()
            .find(|i| pick(i) && i.get("link").map(|l| !l.is_null()).unwrap_or(false))
            .and_then(|i| i.get("link"))
            .and_then(id_text)
    }

    fn output_type(&self, id: &str, slot: u64) -> String {
        self.nodes
            .get(id)
            .and_then(|n| n.get("outputs"))
            .and_then(|o| o.as_array())
            .and_then(|o| o.get(slot as usize))
            .and_then(|o| o.get("type"))
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string()
    }

    fn resolve(&self, link_id: &str, depth: usize) -> Option<(String, u64)> {
        if depth > 64 {
            return None;
        }
        let (from, slot) = self.links.get(link_id)?.clone();
        let class = self.class_of(&from);
        let mode = self.mode_of(&from);
        if mode == 2 {
            return None;
        }
        if class == "Reroute" || mode == 4 {
            let wanted = self.output_type(&from, slot);
            let upstream = self
                .input_link(&from, &|i| i.get("type").and_then(|t| t.as_str()) == Some(wanted.as_str()))
                .or_else(|| self.input_link(&from, &|_| true))?;
            return self.resolve(&upstream, depth + 1);
        }
        Some((from, slot))
    }
}

fn is_widget_spec(spec: &Value) -> bool {
    let Some(arr) = spec.as_array() else { return false };
    let Some(kind) = arr.first() else { return false };
    let opts = arr.get(1).and_then(|o| o.as_object());
    if opts.and_then(|o| o.get("forceInput")).and_then(|f| f.as_bool()).unwrap_or(false) {
        return false;
    }
    match kind {
        Value::Array(_) => true,
        Value::String(s) => matches!(s.as_str(), "INT" | "FLOAT" | "STRING" | "BOOLEAN" | "COMBO" | DYNAMIC_COMBO),
        _ => false,
    }
}

const DYNAMIC_COMBO: &str = "COMFY_DYNAMICCOMBO_V3";

fn dynamic_option(spec: &Value, key: &str) -> Option<Value> {
    spec.as_array()?
        .get(1)?
        .get("options")?
        .as_array()?
        .iter()
        .find(|o| o.get("key").and_then(|k| k.as_str()) == Some(key))
        .cloned()
}

#[allow(clippy::too_many_arguments)]
fn take_inputs(
    specs: Vec<(String, Value)>,
    prefix: &str,
    widgets: &[Value],
    cursor: &mut usize,
    linked: &dyn Fn(&str) -> Option<(String, u64)>,
    inputs: &mut Map<String, Value>,
    known: &mut Vec<String>,
) {
    for (short, spec) in specs {
        let name = if prefix.is_empty() { short } else { format!("{prefix}.{short}") };
        known.push(name.clone());
        if is_widget_spec(&spec) {
            let value = widgets.get(*cursor).cloned();
            *cursor += 1;
            let next_is_control = widgets.get(*cursor).and_then(|v| v.as_str()).map(|s| CONTROL_VALUES.contains(&s)).unwrap_or(false);
            if next_is_control && (spec_flag(&spec, "control_after_generate") || (spec_kind(&spec) == "INT" && SEED_CONTROL_NAMES.contains(&name.as_str()))) {
                *cursor += 1;
            }
            if spec_flag(&spec, "image_upload") || spec_flag(&spec, "video_upload") || spec_flag(&spec, "audio_upload") {
                let next_is_upload = widgets.get(*cursor).and_then(|v| v.as_str()).map(|s| matches!(s, "image" | "video" | "audio")).unwrap_or(false);
                if next_is_upload {
                    *cursor += 1;
                }
            }
            if let Some((from, slot)) = linked(&name) {
                inputs.insert(name.clone(), json!([from, slot]));
            } else if let Some(v) = value {
                inputs.insert(name.clone(), v);
            }
            if spec_kind(&spec) == DYNAMIC_COMBO {
                let key = inputs.get(&name).and_then(|v| v.as_str()).map(|s| s.to_string());
                if let Some(option) = key.and_then(|k| dynamic_option(&spec, &k)) {
                    take_inputs(ordered_inputs(&option), &name, widgets, cursor, linked, inputs, known);
                }
            }
        } else if let Some((from, slot)) = linked(&name) {
            inputs.insert(name, json!([from, slot]));
        }
    }
}

fn spec_flag(spec: &Value, flag: &str) -> bool {
    spec.as_array()
        .and_then(|a| a.get(1))
        .and_then(|o| o.get(flag))
        .and_then(|f| f.as_bool())
        .unwrap_or(false)
}

fn spec_kind(spec: &Value) -> String {
    spec.as_array()
        .and_then(|a| a.first())
        .and_then(|k| k.as_str())
        .unwrap_or("")
        .to_string()
}

fn ordered_inputs(info: &Value) -> Vec<(String, Value)> {
    let mut out = Vec::new();
    let holder = info.get("input").or_else(|| info.get("inputs"));
    for group in ["required", "optional"] {
        if let Some(map) = holder.and_then(|i| i.get(group)).and_then(|g| g.as_object()) {
            for (name, spec) in map {
                out.push((name.clone(), spec.clone()));
            }
        }
    }
    out
}

pub fn graph_to_prompt(graph: &Value, object_info: &Value) -> CoreResult<Value> {
    let g = Graph::parse(graph)?;
    let mut prompt = Map::new();
    let mut skipped: Vec<String> = Vec::new();
    for (id, node) in &g.nodes {
        let class = g.class_of(id);
        let mode = g.mode_of(id);
        if mode == 2 || mode == 4 || VIRTUAL_CLASSES.contains(&class.as_str()) {
            continue;
        }
        let Some(info) = object_info.get(&class) else {
            skipped.push(format!("{class} (#{id})"));
            continue;
        };
        let widgets: Vec<Value> = node.get("widgets_values").and_then(|w| w.as_array()).cloned().unwrap_or_default();
        let declared: Vec<&Value> = node.get("inputs").and_then(|i| i.as_array()).map(|a| a.iter().collect()).unwrap_or_default();
        let linked = |name: &str| -> Option<(String, u64)> {
            declared
                .iter()
                .find(|i| i.get("name").and_then(|n| n.as_str()) == Some(name))
                .and_then(|i| i.get("link"))
                .and_then(id_text)
                .and_then(|l| g.resolve(&l, 0))
        };
        let mut inputs = Map::new();
        let mut cursor = 0usize;
        let mut known: Vec<String> = Vec::new();
        take_inputs(ordered_inputs(info), "", &widgets, &mut cursor, &linked, &mut inputs, &mut known);
        for extra in &declared {
            let Some(name) = extra.get("name").and_then(|n| n.as_str()) else { continue };
            if known.iter().any(|k| k == name) {
                continue;
            }
            if let Some((from, slot)) = extra.get("link").and_then(id_text).and_then(|l| g.resolve(&l, 0)) {
                inputs.insert(name.to_string(), json!([from, slot]));
            }
        }
        let title = node
            .get("title")
            .and_then(|t| t.as_str())
            .filter(|t| !t.trim().is_empty())
            .map(|t| t.to_string())
            .or_else(|| info.get("display_name").and_then(|d| d.as_str()).map(|d| d.to_string()))
            .unwrap_or_else(|| class.clone());
        prompt.insert(id.clone(), json!({ "class_type": class, "inputs": Value::Object(inputs), "_meta": { "title": title } }));
    }
    if prompt.is_empty() {
        return Err(CoreError::Other("The ComfyUI canvas has no runnable nodes".to_string()));
    }
    if !skipped.is_empty() {
        return Err(CoreError::Other(format!(
            "The server does not know these nodes, so the workflow cannot run there: {}",
            skipped.join(", ")
        )));
    }
    Ok(Value::Object(prompt))
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ExampleModel {
    pub file: String,
    pub folder: String,
    pub bytes: u64,
    pub url: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ExampleNodePack {
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub classes: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ComfyExample {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub file: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub nodes: Vec<ExampleNodePack>,
    #[serde(default)]
    pub models: Vec<ExampleModel>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ModelStatus {
    pub file: String,
    pub folder: String,
    pub bytes: u64,
    pub url: String,
    pub present: Option<bool>,
}

const EXAMPLES_JSON: &str = include_str!("../assets/comfy/examples.json");

pub fn examples() -> Vec<ComfyExample> {
    serde_json::from_str(EXAMPLES_JSON).unwrap_or_default()
}

pub fn example(id: &str) -> Option<ComfyExample> {
    examples().into_iter().find(|e| e.id == id)
}

pub fn example_workflow(id: &str) -> Option<Value> {
    let raw = match id {
        "krea2-image" => include_str!("../assets/comfy/examples/krea2-image.json"),
        "fasth3-loop" => include_str!("../assets/comfy/examples/fasth3-loop.json"),
        _ => return None,
    };
    serde_json::from_str(raw).ok()
}

pub fn example_path(id: &str) -> String {
    format!("workflows/{id}.json")
}

pub fn example_for_path(path: &str) -> Option<ComfyExample> {
    let trimmed = path.trim().replace('\\', "/");
    examples().into_iter().find(|e| trimmed == example_path(&e.id) || trimmed.ends_with(&format!("/{}", example_path(&e.id))))
}

pub fn models_status(example: &ComfyExample, present: &dyn Fn(&str, &str) -> Option<bool>) -> Vec<ModelStatus> {
    example
        .models
        .iter()
        .map(|m| ModelStatus {
            file: m.file.clone(),
            folder: m.folder.clone(),
            bytes: m.bytes,
            url: m.url.clone(),
            present: present(&m.folder, &m.file),
        })
        .collect()
}

pub fn download_script(example: &ComfyExample) -> String {
    let mut out = String::new();
    out.push_str("#!/bin/sh\n");
    out.push_str(&format!("# ebts · models for \"{}\"\n", example.title));
    out.push_str("# Run this on the machine that hosts ComfyUI. COMFYUI is its folder.\n");
    out.push_str("set -e\n");
    out.push_str("COMFYUI=\"${COMFYUI:-$HOME/ComfyUI}\"\n");
    out.push_str("get() {\n  mkdir -p \"$COMFYUI/models/$1\"\n  if [ -f \"$COMFYUI/models/$1/$2\" ]; then echo \"have $1/$2\"; return; fi\n  echo \"get  $1/$2\"\n  curl -L --fail --retry 3 -C - -o \"$COMFYUI/models/$1/$2\" \"$3\"\n}\n");
    for pack in &example.nodes {
        out.push_str(&format!(
            "[ -d \"$COMFYUI/custom_nodes/{name}\" ] || git clone \"{url}\" \"$COMFYUI/custom_nodes/{name}\"\n",
            name = pack.name,
            url = pack.url
        ));
    }
    for m in &example.models {
        out.push_str(&format!("get {} {} \"{}\"\n", m.folder, m.file, m.url));
    }
    out.push_str("echo done\n");
    out
}

pub fn encode_path(value: &str) -> String {
    let mut out = String::new();
    for b in value.bytes() {
        let keep = b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~');
        if keep {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

pub fn workflow_file_name(name: &str) -> String {
    let stem = name.trim_end_matches(".json");
    let slug = crate::model::slugify(stem);
    format!("workflows/{slug}.json")
}

#[cfg(not(target_arch = "wasm32"))]
pub struct ComfyClient {
    pub base_url: String,
    pub timeout: std::time::Duration,
}

pub type ProgressFn<'a> = &'a (dyn Fn(Progress) + Sync);

pub fn ws_url(base: &str, client_id: &str) -> String {
    let trimmed = base.trim().trim_end_matches('/');
    let (scheme, host) = if let Some(rest) = trimmed.strip_prefix("https://") {
        ("wss", rest)
    } else if let Some(rest) = trimmed.strip_prefix("http://") {
        ("ws", rest)
    } else {
        ("ws", trimmed)
    };
    format!("{scheme}://{host}/ws?clientId={client_id}")
}

pub fn node_titles(workflow: &Value) -> BTreeMap<String, String> {
    nodes(workflow)
        .map(|map| map.iter().map(|(id, node)| (id.clone(), title(node))).collect())
        .unwrap_or_default()
}

pub fn progress_of(message: &str, prompt_id: &str) -> Option<Result<Progress, String>> {
    let value: Value = serde_json::from_str(message).ok()?;
    let data = value.get("data")?;
    if data.get("prompt_id").and_then(|p| p.as_str()).map(|p| p != prompt_id).unwrap_or(false) {
        return None;
    }
    match value.get("type").and_then(|t| t.as_str())? {
        "progress" => Some(Ok(Progress {
            step: data.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0) as u32,
            total: data.get("max").and_then(|v| v.as_f64()).unwrap_or(0.0) as u32,
            detail: data.get("node").and_then(|n| n.as_str()).unwrap_or("").to_string(),
        })),
        "execution_error" => {
            let message = data.get("exception_message").and_then(|m| m.as_str()).unwrap_or("execution error");
            let node = data.get("node_type").and_then(|n| n.as_str()).unwrap_or("");
            Some(Err(if node.is_empty() { message.to_string() } else { format!("{node}: {message}") }))
        }
        _ => None,
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn watch_socket(
    socket: &mut tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>,
    prompt_id: &str,
    titles: &BTreeMap<String, String>,
    report: ProgressFn,
    done: &AtomicBool,
    failure: &Mutex<Option<String>>,
) {
    let pause = Some(std::time::Duration::from_millis(500));
    let _ = match socket.get_ref() {
        tungstenite::stream::MaybeTlsStream::Plain(stream) => stream.set_read_timeout(pause),
        tungstenite::stream::MaybeTlsStream::Rustls(stream) => stream.get_ref().set_read_timeout(pause),
        _ => Ok(()),
    };
    while !done.load(Ordering::Relaxed) {
        match socket.read() {
            Ok(tungstenite::Message::Text(text)) => match progress_of(text.as_str(), prompt_id) {
                Some(Ok(mut progress)) => {
                    if let Some(name) = titles.get(&progress.detail) {
                        progress.detail = name.clone();
                    }
                    report(progress);
                }
                Some(Err(message)) => *failure.lock().unwrap_or_else(|p| p.into_inner()) = Some(message),
                None => {}
            },
            Ok(tungstenite::Message::Close(_)) => break,
            Ok(_) => {}
            Err(tungstenite::Error::Io(e)) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => {}
            Err(_) => break,
        }
    }
    let _ = socket.close(None);
}

#[cfg(not(target_arch = "wasm32"))]
impl ComfyClient {
    fn url(&self, path: &str) -> String {
        format!("{}/{}", self.base_url.trim().trim_end_matches('/'), path.trim_start_matches('/'))
    }

    pub fn upload_image(&self, path: &std::path::Path) -> CoreResult<String> {
        let bytes = std::fs::read(path).map_err(|e| CoreError::Other(format!("{}: {e}", path.display())))?;
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("init.png").to_string();
        let boundary = format!("ebts{}", random_seed());
        let body = multipart(&boundary, "image", &name, mime_for(&name), &bytes, &[("overwrite", "true"), ("type", "input")]);
        let response = crate::generate::post_bytes(
            &self.url("upload/image"),
            &format!("multipart/form-data; boundary={boundary}"),
            &body,
        )?;
        let value: Value = serde_json::from_slice(&response)
            .map_err(|e| CoreError::Other(format!("ComfyUI upload returned invalid JSON: {e}")))?;
        Ok(upload_response_name(&value, &name))
    }

    pub fn run(
        &self,
        workflow: Value,
        video: bool,
        output_node: Option<&str>,
        progress: Option<ProgressFn>,
        cancel: Option<&AtomicBool>,
    ) -> CoreResult<Vec<u8>> {
        let client_id = format!("ebts-{}", random_seed());
        let socket = progress.and_then(|_| tungstenite::connect(ws_url(&self.base_url, &client_id)).ok()).map(|(socket, _)| socket);
        let titles = node_titles(&workflow);
        let submitted = crate::generate::post_json(&self.url("prompt"), None, &json!({ "prompt": workflow, "client_id": client_id }))?;
        if let Some(details) = node_errors(&submitted) {
            return Err(CoreError::Other(format!("ComfyUI rejected the workflow: {details}")));
        }
        let prompt_id = submitted
            .get("prompt_id")
            .and_then(|p| p.as_str())
            .ok_or_else(|| CoreError::Other(format!("ComfyUI did not return a prompt_id: {}", submitted)))?
            .to_string();
        let done = AtomicBool::new(false);
        let failure: Mutex<Option<String>> = Mutex::new(None);
        let waited = std::thread::scope(|scope| {
            if let (Some(mut socket), Some(report)) = (socket, progress) {
                let (prompt_ref, titles_ref, done_ref, failure_ref) = (prompt_id.as_str(), &titles, &done, &failure);
                scope.spawn(move || watch_socket(&mut socket, prompt_ref, titles_ref, report, done_ref, failure_ref));
            }
            let outcome = self.wait_for(&prompt_id, video, output_node, cancel);
            done.store(true, Ordering::Relaxed);
            outcome
        });
        let file = match waited {
            Ok(file) => file,
            Err(e) => {
                return Err(match failure.into_inner().unwrap_or_default() {
                    Some(message) => CoreError::Other(format!("ComfyUI: {message}")),
                    None => e,
                })
            }
        };
        crate::generate::get_bytes(&view_url(&self.base_url, &file))
    }

    fn wait_for(&self, prompt_id: &str, video: bool, output_node: Option<&str>, cancel: Option<&AtomicBool>) -> CoreResult<OutputFile> {
        let deadline = std::time::Instant::now() + self.timeout;
        loop {
            for _ in 0..4 {
                std::thread::sleep(std::time::Duration::from_millis(250));
                if cancel.map(|c| c.load(Ordering::Relaxed)).unwrap_or(false) {
                    let _ = crate::generate::post_json(&self.url("interrupt"), None, &json!({}));
                    return Err(CoreError::Other("Cancelled".to_string()));
                }
            }
            let history = crate::generate::get_json(&self.url(&format!("history/{prompt_id}")))?;
            if history.get(prompt_id).is_some() {
                return pick_output(&history, prompt_id, video, output_node);
            }
            if std::time::Instant::now() > deadline {
                return Err(CoreError::Other(format!("ComfyUI did not finish within {} seconds", self.timeout.as_secs())));
            }
        }
    }

    pub fn ping(&self) -> CoreResult<Value> {
        crate::generate::get_json(&self.url("system_stats"))
    }

    pub fn list_workflows(&self) -> CoreResult<Vec<String>> {
        let value = crate::generate::get_json(&self.url("api/userdata?dir=workflows&recurse=true"))?;
        let mut names: Vec<String> = value
            .as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str()).filter(|s| s.ends_with(".json")).map(|s| s.to_string()).collect())
            .unwrap_or_default();
        names.sort_by_key(|n| n.to_lowercase());
        Ok(names)
    }

    pub fn fetch_workflow(&self, name: &str) -> CoreResult<Value> {
        crate::generate::get_json(&self.url(&format!("api/userdata/{}", encode_path(&format!("workflows/{name}")))))
    }

    pub fn object_info(&self) -> CoreResult<Value> {
        crate::generate::get_json(&self.url("object_info"))
    }

    pub fn model_files(&self, folder: &str) -> CoreResult<Vec<String>> {
        let value = crate::generate::get_json(&self.url(&format!("models/{}", encode_path(folder))))
            .or_else(|_| crate::generate::get_json(&self.url(&format!("api/experiment/models/{}", encode_path(folder)))))?;
        Ok(value
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())))
                    .collect()
            })
            .unwrap_or_default())
    }

    pub fn models_status(&self, example: &ComfyExample) -> Vec<ModelStatus> {
        let mut listings: BTreeMap<String, Option<Vec<String>>> = BTreeMap::new();
        for m in &example.models {
            listings.entry(m.folder.clone()).or_insert_with(|| self.model_files(&m.folder).ok());
        }
        models_status(example, &|folder, file| {
            listings.get(folder).and_then(|list| list.as_ref()).map(|list| list.iter().any(|f| f == file || f.ends_with(&format!("/{file}"))))
        })
    }

    pub fn import_workflow(&self, name: &str) -> CoreResult<(Value, bool, Value)> {
        let raw = self.fetch_workflow(name)?;
        let info = self.object_info()?;
        if is_canvas(&raw) {
            Ok((graph_to_prompt(&raw, &info)?, true, info))
        } else {
            nodes(&raw)?;
            Ok((raw, false, info))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Value {
        serde_json::from_str(include_str!("../assets/comfy/txt2img.json")).unwrap()
    }

    fn canvas() -> Value {
        json!({
            "nodes": [
                { "id": 4, "type": "CheckpointLoaderSimple", "mode": 0, "inputs": [], "outputs": [{"type": "MODEL", "links": [1]}, {"type": "CLIP", "links": [2, 3]}, {"type": "VAE", "links": [5]}], "widgets_values": ["model.safetensors"] },
                { "id": 6, "type": "CLIPTextEncode", "title": "Positive", "mode": 0, "inputs": [{"name": "clip", "type": "CLIP", "link": 2}, {"name": "text", "type": "STRING", "widget": {"name": "text"}, "link": null}], "outputs": [{"type": "CONDITIONING", "links": [6]}], "widgets_values": ["a cat"] },
                { "id": 7, "type": "CLIPTextEncode", "title": "Negative", "mode": 0, "inputs": [{"name": "clip", "type": "CLIP", "link": 3}], "outputs": [{"type": "CONDITIONING", "links": [7]}], "widgets_values": ["ugly"] },
                { "id": 5, "type": "EmptyLatentImage", "mode": 0, "inputs": [], "outputs": [{"type": "LATENT", "links": [4]}], "widgets_values": [512, 768, 1] },
                { "id": 3, "type": "KSampler", "mode": 0, "inputs": [{"name": "model", "type": "MODEL", "link": 1}, {"name": "positive", "type": "CONDITIONING", "link": 6}, {"name": "negative", "type": "CONDITIONING", "link": 7}, {"name": "latent_image", "type": "LATENT", "link": 4}], "outputs": [{"type": "LATENT", "links": [8]}], "widgets_values": [42, "randomize", 20, 7.0, "euler", "normal", 1.0] },
                { "id": 10, "type": "Reroute", "mode": 0, "inputs": [{"name": "", "type": "*", "link": 8}], "outputs": [{"type": "LATENT", "links": [9]}], "widgets_values": [] },
                { "id": 8, "type": "VAEDecode", "mode": 0, "inputs": [{"name": "samples", "type": "LATENT", "link": 9}, {"name": "vae", "type": "VAE", "link": 5}], "outputs": [{"type": "IMAGE", "links": [10]}] },
                { "id": 11, "type": "LoadImage", "mode": 0, "inputs": [], "outputs": [{"type": "IMAGE", "links": []}], "widgets_values": ["ref.png", "image"] },
                { "id": 12, "type": "Note", "mode": 0, "widgets_values": ["hello"] },
                { "id": 9, "type": "SaveImage", "mode": 0, "inputs": [{"name": "images", "type": "IMAGE", "link": 10}], "widgets_values": ["out"] }
            ],
            "links": [
                [1, 4, 0, 3, 0, "MODEL"], [2, 4, 1, 6, 0, "CLIP"], [3, 4, 1, 7, 0, "CLIP"], [4, 5, 0, 3, 3, "LATENT"],
                [5, 4, 2, 8, 1, "VAE"], [6, 6, 0, 3, 1, "CONDITIONING"], [7, 7, 0, 3, 2, "CONDITIONING"],
                [8, 3, 0, 10, 0, "LATENT"], [9, 10, 0, 8, 0, "LATENT"], [10, 8, 0, 9, 0, "IMAGE"]
            ]
        })
    }

    fn info() -> Value {
        json!({
            "CheckpointLoaderSimple": { "input": { "required": { "ckpt_name": [["model.safetensors"]] } } },
            "CLIPTextEncode": { "input": { "required": { "text": ["STRING", {"multiline": true}], "clip": ["CLIP"] } } },
            "EmptyLatentImage": { "input": { "required": { "width": ["INT", {"default": 512}], "height": ["INT", {"default": 512}], "batch_size": ["INT", {"default": 1}] } } },
            "KSampler": { "input": { "required": { "model": ["MODEL"], "seed": ["INT", {"control_after_generate": true}], "steps": ["INT"], "cfg": ["FLOAT"], "sampler_name": [["euler"]], "scheduler": [["normal"]], "positive": ["CONDITIONING"], "negative": ["CONDITIONING"], "latent_image": ["LATENT"], "denoise": ["FLOAT"] } } },
            "VAEDecode": { "input": { "required": { "samples": ["LATENT"], "vae": ["VAE"] } } },
            "LoadImage": { "input": { "required": { "image": [["ref.png"], {"image_upload": true}] } } },
            "SaveImage": { "input": { "required": { "images": ["IMAGE"], "filename_prefix": ["STRING", {"default": "ComfyUI"}] } } }
        })
    }

    #[test]
    fn canvas_converts_to_api_prompt() {
        let prompt = graph_to_prompt(&canvas(), &info()).unwrap();
        let map = prompt.as_object().unwrap();
        assert!(!map.contains_key("10"), "reroute must disappear");
        assert!(!map.contains_key("12"), "notes must disappear");
        assert_eq!(map["8"]["inputs"]["samples"], json!(["3", 0]), "reroute resolved to the sampler");
        assert_eq!(map["3"]["inputs"]["seed"], json!(42));
        assert_eq!(map["3"]["inputs"]["steps"], json!(20));
        assert_eq!(map["3"]["inputs"]["denoise"], json!(1.0));
        assert_eq!(map["3"]["inputs"]["positive"], json!(["6", 0]));
        assert_eq!(map["6"]["inputs"]["text"], json!("a cat"));
        assert_eq!(map["6"]["_meta"]["title"], json!("Positive"));
        assert_eq!(map["11"]["inputs"]["image"], json!("ref.png"));
        assert_eq!(map["9"]["inputs"]["filename_prefix"], json!("out"));
        assert_eq!(map["5"]["inputs"]["height"], json!(768));
        let nodes = inspect(&prompt).unwrap();
        assert!(nodes.iter().any(|n| n.id == "6" && n.suggested.as_deref() == Some("prompt")));
        assert!(nodes.iter().any(|n| n.id == "9" && n.suggested.as_deref() == Some("output")));
    }

    #[test]
    fn lora_nodes_expose_fields_and_values_apply() {
        let mut workflow = sample();
        workflow["20"] = json!({
            "class_type": "LoraLoader",
            "_meta": { "title": "Style LoRA" },
            "inputs": { "lora_name": "old.safetensors", "strength_model": 0.8, "strength_clip": 0.8, "model": ["4", 0], "clip": ["4", 1] }
        });
        let info = json!({ "LoraLoader": { "input": { "required": { "lora_name": [["old.safetensors", "new.safetensors"]], "strength_model": ["FLOAT"], "strength_clip": ["FLOAT"] } } } });
        let list = inspect_with(&workflow, Some(&info)).unwrap();
        let lora = list.iter().find(|n| n.id == "20").unwrap();
        assert!(lora.lora);
        assert_eq!(lora.suggested.as_deref(), Some("lora"));
        let name = lora.fields.iter().find(|f| f.key == "lora_name").unwrap();
        assert_eq!(name.kind, "combo");
        assert_eq!(name.options, vec!["old.safetensors".to_string(), "new.safetensors".to_string()]);
        assert!(lora.fields.iter().any(|f| f.key == "strength_model" && f.kind == "number"));
        assert!(lora.fields.iter().all(|f| f.key != "model"));
        let mut values = BTreeMap::new();
        let mut picks = Map::new();
        picks.insert("lora_name".to_string(), json!("new.safetensors"));
        picks.insert("strength_model".to_string(), json!(0.5));
        picks.insert("bogus".to_string(), json!(1));
        values.insert("20".to_string(), picks);
        let chosen = ComfyNodes { values, ..Default::default() };
        let job = ComfyJob { prompt: "x", negative_prompt: "", width: 64, height: 64, seconds: None, seed: Some(1), sampler: SamplerOverride::default() };
        let prepared = prepare(&workflow, &job, &chosen, &[]).unwrap();
        assert_eq!(prepared.workflow["20"]["inputs"]["lora_name"], json!("new.safetensors"));
        assert_eq!(prepared.workflow["20"]["inputs"]["strength_model"], json!(0.5));
        assert!(prepared.workflow["20"]["inputs"].get("bogus").is_none());
        assert_eq!(prepared.nodes.loras, vec!["20".to_string()]);
    }

    #[test]
    fn sampler_nodes_expose_steps_cfg_denoise() {
        let workflow = sample();
        let list = inspect_with(&workflow, Some(&info())).unwrap();
        let sampler = list.iter().find(|n| n.class_type == "KSampler").unwrap();
        assert!(sampler.sampler && !sampler.lora);
        assert_eq!(sampler.suggested.as_deref(), Some("sampler"));
        let keys: Vec<&str> = sampler.fields.iter().map(|f| f.key.as_str()).collect();
        assert_eq!(keys, vec!["steps", "cfg", "sampler_name", "scheduler", "denoise"]);
        assert!(sampler.fields.iter().any(|f| f.key == "steps" && f.kind == "number" && f.value == json!(28)));
        assert!(sampler.fields.iter().any(|f| f.key == "sampler_name" && f.kind == "combo" && f.options == vec!["euler".to_string()]));
        assert!(list.iter().filter(|n| n.class_type != "KSampler").all(|n| !n.sampler && n.fields.is_empty()));
        let mut values = BTreeMap::new();
        let mut picks = Map::new();
        picks.insert("steps".to_string(), json!(12));
        picks.insert("cfg".to_string(), json!(3.5));
        values.insert(sampler.id.clone(), picks);
        let chosen = ComfyNodes { values, ..Default::default() };
        let job = ComfyJob { prompt: "x", negative_prompt: "", width: 64, height: 64, seconds: None, seed: Some(7), sampler: SamplerOverride::default() };
        let prepared = prepare(&workflow, &job, &chosen, &[]).unwrap();
        assert_eq!(prepared.workflow[&sampler.id]["inputs"]["steps"], json!(12));
        assert_eq!(prepared.workflow[&sampler.id]["inputs"]["cfg"], json!(3.5));
        assert_eq!(prepared.workflow[&sampler.id]["inputs"]["seed"], json!(7));
        let defaults = sampler_defaults(&workflow, &chosen.values).unwrap();
        assert_eq!(defaults, SamplerDefaults { steps: Some(12.0), cfg: Some(3.5), denoise: Some(1.0) });
        assert_eq!(sampler_defaults(&workflow, &BTreeMap::new()).unwrap().steps, Some(28.0));
        let per_slot = ComfyJob {
            sampler: SamplerOverride { steps: Some(4), cfg: None, denoise: Some(0.55) },
            ..job.clone()
        };
        let prepared = prepare(&workflow, &per_slot, &chosen, &[]).unwrap();
        assert_eq!(prepared.workflow[&sampler.id]["inputs"]["steps"], json!(4));
        assert_eq!(prepared.workflow[&sampler.id]["inputs"]["cfg"], json!(3.5));
        assert_eq!(prepared.workflow[&sampler.id]["inputs"]["denoise"], json!(0.55));
        assert!(sampler_defaults(&json!({"1": {"class_type": "SaveImage", "inputs": {"images": ["2", 0]}}}), &BTreeMap::new()).is_none());
    }

    #[test]
    fn primitive_string_feeding_a_prompt_input_is_the_prompt_node() {
        let workflow = json!({
            "12": {"class_type": "PrimitiveStringMultiline", "inputs": {"value": "old words"}, "_meta": {"title": "PROMPT — use <Picture N>"}},
            "13": {"class_type": "LoadImage", "inputs": {"image": "ref.jpg"}, "_meta": {"title": "REFERENCE IMAGE 1"}},
            "14": {"class_type": "MiniMaxH3ReferenceToVideo", "inputs": {"prompt": ["12", 0], "ref_image_size": "match", "ref_images.ref_image_0": ["13", 0]}},
            "23": {"class_type": "SaveVideo", "inputs": {"video": ["14", 0]}}
        });
        let suggested = suggest(&workflow).unwrap();
        assert_eq!(suggested.prompt, vec!["12".to_string()]);
        assert!(suggested.negative.is_empty());
        assert_eq!(suggested.images, vec!["13".to_string()]);
        let list = inspect(&workflow).unwrap();
        assert_eq!(list.iter().find(|n| n.id == "12").unwrap().text_keys, vec!["value".to_string()]);
        assert!(list.iter().find(|n| n.id == "14").unwrap().text_keys.is_empty(), "a combo string is not a prompt");
        let job = ComfyJob { prompt: "new words", negative_prompt: "", width: 608, height: 352, seconds: Some(4.0), seed: None, sampler: SamplerOverride::default() };
        let prepared = prepare(&workflow, &job, &ComfyNodes::default(), &["poster.png".into()]).unwrap();
        assert_eq!(prepared.workflow["12"]["inputs"]["value"], "new words");
        assert_eq!(prepared.workflow["13"]["inputs"]["image"], "poster.png");
    }

    #[test]
    fn bundled_examples_parse_and_describe_their_models() {
        let list = examples();
        assert_eq!(list.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(), vec!["krea2-image", "fasth3-loop"]);
        for e in &list {
            let workflow = example_workflow(&e.id).unwrap();
            let nodes = inspect(&workflow).unwrap();
            assert!(nodes.iter().any(|n| n.suggested.as_deref() == Some("prompt")), "{} has a prompt node", e.id);
            assert!(nodes.iter().any(|n| n.suggested.as_deref() == Some("output")), "{} has an output node", e.id);
            assert!(nodes.iter().any(|n| n.suggested.as_deref() == Some("image")), "{} takes an init image", e.id);
            assert!(!e.models.is_empty() && e.models.iter().all(|m| m.url.starts_with("https://") && m.bytes > 0));
            let raw = serde_json::to_string(&workflow).unwrap();
            assert!(!raw.contains(".jpg\"") && !raw.contains("Caminho"), "{} carries no personal files", e.id);
            assert_eq!(example_for_path(&example_path(&e.id)).map(|x| x.id), Some(e.id.clone()));
        }
        let video = example("fasth3-loop").unwrap();
        let workflow = example_workflow("fasth3-loop").unwrap();
        let job = ComfyJob { prompt: "loop", negative_prompt: "", width: 608, height: 352, seconds: Some(4.0), seed: Some(3), sampler: SamplerOverride::default() };
        let prepared = prepare(&workflow, &job, &ComfyNodes::default(), &["poster.png".into()]).unwrap();
        assert_eq!(prepared.workflow["12"]["inputs"]["value"], "loop");
        assert_eq!(prepared.workflow["13"]["inputs"]["image"], "poster.png");
        assert_eq!(prepared.workflow["8"]["inputs"]["value"], 608, "width primitive follows the slot");
        assert_eq!(prepared.workflow["9"]["inputs"]["value"], 352, "height primitive follows the slot");
        assert_eq!(prepared.workflow["10"]["inputs"]["value"], 4.0, "duration primitive follows the slot");
        assert_eq!(prepared.workflow["15"]["inputs"]["noise_seed"], 3);
        let missing = prepare(&example_workflow("krea2-image").unwrap(), &job, &ComfyNodes::default(), &[]).unwrap_err().to_string();
        assert!(missing.contains("needs an init image"), "{missing}");
        let mut dangling = workflow.clone();
        dangling["28"] = json!({"class_type": "LoadImage", "inputs": {"image": ""}, "_meta": {"title": "OPTIONAL REFERENCE IMAGE 2"}});
        assert!(prepare(&dangling, &job, &ComfyNodes::default(), &["poster.png".into()]).is_ok(), "unconnected optional inputs are ignored");
        let status = models_status(&video, &|folder, file| if folder == "vae" { Some(file.contains("video")) } else { None });
        assert_eq!(status.iter().filter(|s| s.present == Some(true)).count(), 1);
        assert_eq!(status.iter().filter(|s| s.present.is_none()).count(), 2);
        let script = download_script(&example("krea2-image").unwrap());
        assert!(script.contains("get diffusion_models krea2_turbo_int8_convrot.safetensors"));
        assert!(script.contains("git clone \"https://github.com/Gourieff/ComfyUI-ReActor\""));
    }

    #[test]
    fn progress_messages_and_socket_url() {
        assert_eq!(ws_url("https://comfy.example/", "abc"), "wss://comfy.example/ws?clientId=abc");
        assert_eq!(ws_url("http://127.0.0.1:8188", "abc"), "ws://127.0.0.1:8188/ws?clientId=abc");
        let step = progress_of(r#"{"type":"progress","data":{"value":3,"max":20,"prompt_id":"p1","node":"3"}}"#, "p1").unwrap().unwrap();
        assert_eq!(step, Progress { step: 3, total: 20, detail: "3".into() });
        assert_eq!(node_titles(&sample()).get("3").map(|s| s.as_str()), Some("KSampler"));
        assert!(progress_of(r#"{"type":"progress","data":{"value":3,"max":20,"prompt_id":"other"}}"#, "p1").is_none());
        assert!(progress_of(r#"{"type":"status","data":{"status":{}}}"#, "p1").is_none());
        let failed = progress_of(r#"{"type":"execution_error","data":{"prompt_id":"p1","node_type":"KSampler","exception_message":"out of memory"}}"#, "p1").unwrap();
        assert_eq!(failed.unwrap_err(), "KSampler: out of memory");
    }

    #[test]
    fn dynamic_combo_widgets_follow_the_selected_option() {
        let graph = json!({
            "nodes": [
                { "id": 3, "type": "UNETLoader", "mode": 0, "inputs": [], "outputs": [{"type": "MODEL", "links": [1]}], "widgets_values": ["fasth3.safetensors", "default"] },
                { "id": 4, "type": "BlockSparseAttention", "title": "Model Sparse Attention", "mode": 0,
                  "inputs": [{"name": "model", "type": "MODEL", "link": 1}],
                  "outputs": [{"type": "MODEL", "links": []}],
                  "widgets_values": ["vsa", 10, 0, 1, "", 12288, 256, "exact_kv", false] }
            ],
            "links": [[1, 3, 0, 4, 0, "MODEL"]]
        });
        let info = json!({
            "UNETLoader": { "input": { "required": { "unet_name": [["fasth3.safetensors"]], "weight_dtype": [["default", "fp8"]] } } },
            "BlockSparseAttention": { "input": { "required": {
                "model": ["MODEL"],
                "selection": ["COMFY_DYNAMICCOMBO_V3", { "options": [
                    { "key": "sol-attn", "inputs": { "required": { "tau": ["FLOAT", {"default": 1.3}] } } },
                    { "key": "vsa", "inputs": { "required": { "keep_percent": ["FLOAT", {"default": 10.0}] } } }
                ] }],
                "start_percent": ["FLOAT", {"default": 0.2}],
                "end_percent": ["FLOAT", {"default": 1.0}],
                "dense_blocks": ["STRING", {"default": ""}],
                "min_tokens": ["INT", {"default": 12288}],
                "extra_tokens": ["INT", {"default": 256}],
                "sink_conditioning": [["exact_kv", "exact_kv_and_sinks"]],
                "verbose": ["BOOLEAN", {"default": false}]
            } } }
        });
        let prompt = graph_to_prompt(&graph, &info).unwrap();
        let node = &prompt["4"]["inputs"];
        assert_eq!(node["model"], json!(["3", 0]));
        assert_eq!(node["selection"], "vsa");
        assert_eq!(node["selection.keep_percent"], 10);
        assert_eq!(node["start_percent"], 0);
        assert_eq!(node["end_percent"], 1);
        assert_eq!(node["dense_blocks"], "");
        assert_eq!(node["min_tokens"], 12288);
        assert_eq!(node["extra_tokens"], 256);
        assert_eq!(node["sink_conditioning"], "exact_kv");
        assert_eq!(node["verbose"], false);
        assert!(node.get("selection.tau").is_none(), "only the chosen option's inputs are taken");
        assert_eq!(combo_options(Some(&info), "BlockSparseAttention", "selection"), vec!["sol-attn".to_string(), "vsa".to_string()]);
    }

    #[test]
    fn canvas_with_unknown_node_is_refused() {
        let mut graph = canvas();
        graph["nodes"].as_array_mut().unwrap().push(json!({ "id": 99, "type": "SomeCustomNode", "mode": 0, "widgets_values": [] }));
        let err = graph_to_prompt(&graph, &info()).unwrap_err().to_string();
        assert!(err.contains("SomeCustomNode"));
    }

    #[test]
    fn workflow_names_become_project_paths() {
        assert_eq!(workflow_file_name("gfx1151-image/Flux 3 Klein - Text to Image.json"), "workflows/gfx1151-image-flux-3-klein-text-to-image.json");
        assert_eq!(encode_path("workflows/a b/c.json"), "workflows%2Fa%20b%2Fc.json");
    }

    #[test]
    fn inspect_suggests_roles() {
        let info = inspect(&sample()).unwrap();
        let by = |id: &str| info.iter().find(|n| n.id == id).unwrap().clone();
        assert_eq!(by("6").suggested.as_deref(), Some("prompt"));
        assert_eq!(by("7").suggested.as_deref(), Some("negative"));
        assert_eq!(by("9").suggested.as_deref(), Some("output"));
        assert!(by("5").has_size && by("3").has_seed && by("9").saves);
        assert_eq!(by("6").text_keys, vec!["text".to_string()]);
        let auto = suggest(&sample()).unwrap();
        assert_eq!(auto.output.as_deref(), Some("9"));
        assert!(auto.images.is_empty());
        assert!(parse_workflow("{\"nodes\": [], \"links\": []}").is_err());
        assert!(parse_workflow("nope").is_err());
    }

    #[test]
    fn prepare_fills_prompt_size_and_seed() {
        let job = ComfyJob { prompt: "a salon", negative_prompt: "ugly", width: 1920, height: 1080, seconds: None, seed: Some(42), sampler: SamplerOverride::default() };
        let prepared = prepare(&sample(), &job, &ComfyNodes::default(), &[]).unwrap();
        assert_eq!(prepared.nodes.prompt, vec!["6".to_string()]);
        assert_eq!(prepared.workflow["6"]["inputs"]["text"], "a salon");
        assert_eq!(prepared.workflow["7"]["inputs"]["text"], "ugly");
        assert_eq!(prepared.workflow["5"]["inputs"]["width"], 1920);
        assert_eq!(prepared.workflow["5"]["inputs"]["height"], 1088);
        assert_eq!(latent_size(800), 800);
        assert_eq!(latent_size(1000), 1008);
        assert_eq!(latent_size(3), 16);
        assert_eq!(prepared.workflow["3"]["inputs"]["seed"], 42);
        assert!(prepare(&sample(), &job, &ComfyNodes::default(), &["x.png".into()]).is_err());
        let chosen = ComfyNodes { prompt: vec!["7".into()], ..Default::default() };
        let swapped = prepare(&sample(), &job, &chosen, &[]).unwrap();
        assert_eq!(swapped.workflow["7"]["inputs"]["text"], "a salon");
        assert_eq!(swapped.nodes.output.as_deref(), Some("9"));
    }

    #[test]
    fn prepare_maps_images_and_frames_for_video() {
        let workflow = json!({
            "1": {"class_type": "LoadImage", "inputs": {"image": "old.png"}},
            "2": {"class_type": "CLIPTextEncode", "_meta": {"title": "Prompt"}, "inputs": {"text": "", "clip": ["9", 0]}},
            "3": {"class_type": "WanImageToVideo", "inputs": {"width": 832, "height": 480, "length": 33, "start_image": ["1", 0], "positive": ["2", 0]}},
            "4": {"class_type": "KSampler", "inputs": {"noise_seed": 1, "positive": ["2", 0]}},
            "5": {"class_type": "VHS_VideoCombine", "inputs": {"frame_rate": 24, "images": ["4", 0]}},
            "6": {"class_type": "LoadImage", "_meta": {"title": "End frame"}, "inputs": {"image": "end.png"}}
        });
        let job = ComfyJob { prompt: "loop", negative_prompt: "", width: 1920, height: 1080, seconds: Some(2.0), seed: None, sampler: SamplerOverride::default() };
        let prepared = prepare(&workflow, &job, &ComfyNodes::default(), &["a.png".into(), "b.png".into()]).unwrap();
        assert_eq!(prepared.workflow["1"]["inputs"]["image"], "a.png");
        assert_eq!(prepared.workflow["6"]["inputs"]["image"], "b.png");
        assert_eq!(prepared.workflow["3"]["inputs"]["length"], 48);
        assert_eq!(prepared.workflow["3"]["inputs"]["width"], 1920);
        assert!(prepared.workflow["4"]["inputs"]["noise_seed"].as_u64().unwrap() > 0);
        assert_eq!(prepared.nodes.output.as_deref(), Some("5"));
        let info = inspect(&workflow).unwrap();
        assert_eq!(info.iter().filter(|n| n.suggested.as_deref() == Some("image")).count(), 2);
        let looped = prepare(&workflow, &job, &ComfyNodes::default(), &["poster.png".into()]).unwrap();
        assert_eq!(looped.workflow["1"]["inputs"]["image"], "poster.png", "the poster is the start frame");
        assert_eq!(looped.workflow["6"]["inputs"]["image"], "poster.png", "and the end frame");
        let mut refs = workflow.clone();
        refs["6"]["_meta"]["title"] = json!("OPTIONAL REFERENCE IMAGE 2");
        let only_first = prepare(&refs, &job, &ComfyNodes::default(), &["poster.png".into()]).unwrap();
        assert_eq!(only_first.workflow["1"]["inputs"]["image"], "poster.png");
        assert_eq!(only_first.workflow["6"]["inputs"]["image"], "end.png", "plain references keep the workflow's file");
        let two_keys = json!({
            "1": {"class_type": "WanFirstLastFrameToVideo", "inputs": {"start_image": "a.png", "end_image": "b.png", "clip_vision_output": ["2", 0]}},
            "2": {"class_type": "CLIPTextEncode", "inputs": {"text": ""}},
            "3": {"class_type": "SaveVideo", "inputs": {"video": ["1", 0]}}
        });
        let chosen = ComfyNodes { images: vec!["1".into()], ..Default::default() };
        let both = prepare(&two_keys, &job, &chosen, &["poster.png".into()]).unwrap();
        assert_eq!(both.workflow["1"]["inputs"]["start_image"], "poster.png");
        assert_eq!(both.workflow["1"]["inputs"]["end_image"], "poster.png");
    }

    #[test]
    fn output_picking_and_urls() {
        let history = json!({
            "abc": {
                "status": {"status_str": "success"},
                "outputs": {
                    "9": {"images": [{"filename": "ebts_00001_.png", "subfolder": "", "type": "output"}]},
                    "12": {"gifs": [{"filename": "loop.mp4", "subfolder": "video", "type": "output"}]},
                    "13": {"images": [{"filename": "other.png", "subfolder": "", "type": "output"}]}
                }
            }
        });
        assert_eq!(pick_output(&history, "abc", false, None).unwrap().filename, "ebts_00001_.png");
        assert_eq!(pick_output(&history, "abc", false, Some("13")).unwrap().filename, "other.png");
        let video = pick_output(&history, "abc", true, None).unwrap();
        assert_eq!(view_url("http://127.0.0.1:8188/", &video), "http://127.0.0.1:8188/view?filename=loop.mp4&subfolder=video&type=output");
        assert!(pick_output(&history, "nope", false, None).is_err());
        let failed = json!({"abc": {"status": {"status_str": "error", "messages": [["execution_error", {"exception_message": "out of memory"}]]}, "outputs": {}}});
        assert!(pick_output(&failed, "abc", false, None).unwrap_err().to_string().contains("out of memory"));
        let body = multipart("b", "image", "a.png", "image/png", b"xy", &[("type", "input")]);
        let text = String::from_utf8_lossy(&body);
        assert!(text.starts_with("--b\r\nContent-Disposition: form-data; name=\"type\"\r\n\r\ninput\r\n--b\r\n"));
        assert!(text.ends_with("xy\r\n--b--\r\n"));
        assert_eq!(upload_response_name(&json!({"name": "a.png", "subfolder": "refs"}), "x"), "refs/a.png");
        assert_eq!(node_errors(&json!({"node_errors": {"3": {"errors": [{"message": "bad ckpt"}]}}})).unwrap(), "node 3: bad ckpt");
        assert!(node_errors(&json!({"node_errors": {}})).is_none());
    }
}
