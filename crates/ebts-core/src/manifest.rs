use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::catalog::template_for;
use crate::model::{EventSpec, MediaVariant, SamplerOverride, Site, TimeWindow, Zone};

pub const IMAGE_EXTENSIONS: [&str; 4] = ["png", "jpg", "jpeg", "webp"];
pub const VIDEO_EXTENSIONS: [&str; 3] = ["mp4", "webm", "mov"];
pub const LOOP_SECONDS: f64 = 10.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ContentKind {
    Poster,
    LoopVideo,
    Widget,
}

impl ContentKind {
    pub fn is_video(self) -> bool {
        matches!(self, ContentKind::LoopVideo)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ContentLevel {
    Event,
    Site,
    Zone,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ContentItem {
    pub id: String,
    pub kind: ContentKind,
    pub level: ContentLevel,
    pub site: Option<String>,
    pub zone: Option<String>,
    #[serde(default)]
    pub window: Option<String>,
    pub label: String,
    pub path: String,
    pub exists: bool,
    pub width: f64,
    pub height: f64,
    pub duration_seconds: Option<f64>,
    pub prompt: String,
    #[serde(default)]
    pub hint: String,
    #[serde(default)]
    pub negative_prompt: String,
    #[serde(default)]
    pub init_images: Vec<String>,
    #[serde(default)]
    pub seed: Option<u64>,
    #[serde(default)]
    pub sampler: SamplerOverride,
}

impl ContentItem {

    pub fn canonical(&self) -> String {
        match self.window.as_deref() {
            Some(slug) => variant_path(self.level, self.kind, self.site.as_deref(), self.zone.as_deref(), slug),
            None => canonical_path(self.level, self.kind, self.site.as_deref(), self.zone.as_deref()),
        }
    }
}

fn level_folder(level: ContentLevel, site: Option<&str>, zone: Option<&str>) -> String {
    match (level, site, zone) {
        (ContentLevel::Event, _, _) => "assets/event".to_string(),
        (ContentLevel::Site, Some(s), _) => format!("assets/sites/{s}"),
        (ContentLevel::Zone, Some(s), Some(z)) => format!("assets/sites/{s}/zones/{z}"),
        _ => "assets/misc".to_string(),
    }
}

pub fn variant_path(level: ContentLevel, kind: ContentKind, site: Option<&str>, zone: Option<&str>, slug: &str) -> String {
    let file = match kind {
        ContentKind::LoopVideo => "loop.mp4",
        ContentKind::Widget => "widget.png",
        ContentKind::Poster => "poster.png",
    };
    format!("{}/variants/{slug}/{file}", level_folder(level, site, zone))
}

pub fn canonical_path(level: ContentLevel, kind: ContentKind, site: Option<&str>, zone: Option<&str>) -> String {
    let folder = level_folder(level, site, zone);
    let file = match kind {
        ContentKind::Poster => {
            if level == ContentLevel::Zone {
                "poster.png"
            } else {
                "map.png"
            }
        }
        ContentKind::LoopVideo => "loop.mp4",
        ContentKind::Widget => "widget.png",
    };
    format!("{folder}/{file}")
}

fn resolve_existing(root: Option<&Path>, declared: Option<&str>, canonical: &str, video: bool) -> (String, bool) {
    let Some(root) = root else {
        return (declared.unwrap_or(canonical).to_string(), false);
    };
    if let Some(rel) = declared {
        if root.join(rel).is_file() {
            return (rel.to_string(), true);
        }
    }
    let stem: PathBuf = PathBuf::from(canonical).with_extension("");
    let exts: &[&str] = if video { &VIDEO_EXTENSIONS } else { &IMAGE_EXTENSIONS };
    for ext in exts {
        let candidate = stem.with_extension(ext);
        if root.join(&candidate).is_file() {
            return (candidate.to_string_lossy().replace('\\', "/"), true);
        }
    }
    (declared.unwrap_or(canonical).to_string(), false)
}

fn style_prefix(event: &EventSpec) -> String {
    let mut parts = Vec::new();
    if !event.style.art_direction.trim().is_empty() {
        parts.push(event.style.art_direction.trim().to_string());
    }
    if !event.style.mood.trim().is_empty() {
        parts.push(format!("mood: {}", event.style.mood.trim()));
    }
    if !event.style.palette.is_empty() {
        parts.push(format!("palette: {}", event.style.palette.join(", ")));
    }
    if !event.style.references.is_empty() {
        parts.push(format!("in the spirit of: {}", event.style.references.join(", ")));
    }
    if parts.is_empty() {
        parts.push("Illustrated event concept art, wide shot, rich detail".to_string());
    }
    parts.join(". ")
}

fn style_suffix(event: &EventSpec) -> String {
    if event.style.avoid.trim().is_empty() {
        String::new()
    } else {
        format!(" Avoid: {}.", event.style.avoid.trim())
    }
}

fn themes_line(_event: &EventSpec) -> String {
    String::new()
}

fn loop_wrap(subject: &str) -> String {
    format!(
        "Seamless {LOOP_SECONDS:.0}-second looping animation of this exact scene, camera locked, subtle motion only (screens flicker, lights pulse, people shift, cables sway): {subject}"
    )
}

#[allow(clippy::too_many_arguments)]
fn build(
    root: Option<&Path>,
    event: &EventSpec,
    kind: ContentKind,
    level: ContentLevel,
    site: Option<&Site>,
    zone: Option<&Zone>,
    label: &str,
    declared: Option<&str>,
    width: f64,
    height: f64,
    subject: String,
) -> ContentItem {
    build_timed(root, event, kind, level, site, zone, None, label, declared, width, height, subject)
}

#[allow(clippy::too_many_arguments)]
fn build_timed(
    root: Option<&Path>,
    event: &EventSpec,
    kind: ContentKind,
    level: ContentLevel,
    site: Option<&Site>,
    zone: Option<&Zone>,
    window: Option<TimeWindow>,
    label: &str,
    declared: Option<&str>,
    width: f64,
    height: f64,
    subject: String,
) -> ContentItem {
    let slug = window.map(|w| w.slug());
    let site_id = site.map(|s| s.id.as_str());
    let zone_id = zone.map(|z| z.id.as_str());
    let canonical = match slug.as_deref() {
        Some(slug) => variant_path(level, kind, site_id, zone_id, slug),
        None => canonical_path(level, kind, site_id, zone_id),
    };
    let (path, exists) = resolve_existing(root, declared, &canonical, kind.is_video());
    let timed = match window {
        Some(w) => format!("{} Live only between {} and {}.", subject, w.start, w.end),
        None => subject,
    };
    let body = if kind.is_video() { loop_wrap(&timed) } else { timed };
    let prompt = format!(
        "{}. {}{} Aspect ratio {}:{}.",
        style_prefix(event),
        body,
        style_suffix(event),
        width.round() as i64,
        height.round() as i64
    );
    let level_tag = match level {
        ContentLevel::Event => "event",
        ContentLevel::Site => "site",
        ContentLevel::Zone => "zone",
    };
    let kind_tag = serde_json::to_value(kind)
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    let mut id = format!(
        "{}:{}:{}:{}",
        level_tag,
        site.map(|s| s.id.as_str()).unwrap_or("-"),
        zone.map(|z| z.id.as_str()).unwrap_or("-"),
        kind_tag
    );
    let mut label = label.to_string();
    if let Some(w) = window {
        id.push(':');
        id.push_str(&w.slug());
        label.push_str(&format!(" {}–{}", w.start, w.end));
    }
    let custom = event.content.get(&id);
    let final_prompt = custom
        .and_then(|c| c.prompt.as_deref())
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .map(|p| p.to_string())
        .unwrap_or_default();
    ContentItem {
        id,
        kind,
        level,
        site: site.map(|s| s.id.clone()),
        zone: zone.map(|z| z.id.clone()),
        window: slug,
        label,
        path,
        exists,
        width,
        height,
        duration_seconds: if kind.is_video() { Some(LOOP_SECONDS) } else { None },
        prompt: final_prompt,
        hint: prompt,
        negative_prompt: custom.map(|c| c.negative_prompt.clone()).unwrap_or_default(),
        init_images: custom.map(|c| c.init_images.clone()).unwrap_or_default(),
        seed: custom.and_then(|c| c.seed),
        sampler: custom.map(|c| c.sampler.clone()).unwrap_or_default(),
    }
}

fn event_map_subject(event: &EventSpec) -> String {
    let sites: Vec<String> = event
        .sites
        .iter()
        .map(|s| {
            if s.city.is_empty() {
                s.label.clone()
            } else {
                format!("{} ({})", s.label, s.city)
            }
        })
        .collect();
    format!(
        "Wide establishing illustration of the whole event '{}' spanning {}; each site reads as its own distinct area in one continuous composition, so the viewer can point at a site.{}",
        event.name,
        if sites.is_empty() { "one venue".to_string() } else { sites.join(", ") },
        themes_line(event)
    )
}

fn event_widget_subject(event: &EventSpec) -> String {
    let sites: Vec<&str> = event.sites.iter().map(|s| s.label.as_str()).collect();
    format!(
        "Top-down hand-drawn blueprint map of '{}' on a dark grid, the sites {} outlined as clearly separated labeled regions with neon outlines, tape and handwritten notes at the margins, no people.",
        event.name,
        sites.join(", ")
    )
}

fn site_map_subject(event: &EventSpec, site: &Site) -> String {
    let zones: Vec<&str> = site.zones.iter().map(|z| z.label.as_str()).collect();
    format!(
        "Wide interior illustration of {} in {} during '{}', one continuous view where these zones are each visible as a distinct area: {}.{}",
        if site.venue.is_empty() { site.label.clone() } else { site.venue.clone() },
        if site.city.is_empty() { site.label.clone() } else { site.city.clone() },
        event.name,
        if zones.is_empty() { "the main floor".to_string() } else { zones.join(", ") },
        themes_line(event)
    )
}

fn site_widget_subject(event: &EventSpec, site: &Site) -> String {
    let zones: Vec<&str> = site.zones.iter().map(|z| z.label.as_str()).collect();
    format!(
        "Top-down hand-drawn blueprint floor plan of {} for '{}' on a dark grid, zones {} outlined as labeled rooms with neon outlines and tiny sketches of what happens inside, no people.",
        if site.venue.is_empty() { site.label.clone() } else { site.venue.clone() },
        event.name,
        zones.join(", ")
    )
}

fn zone_subject(_event: &EventSpec, site: &Site, zone: &Zone) -> String {
    let template = template_for(zone.format);
    let featured: Vec<String> = zone
        .schedule
        .iter()
        .filter(|i| !i.channel.is_empty() && i.channel != "mixed")
        .map(|i| i.channel.clone())
        .take(4)
        .collect();
    let mut seen = Vec::new();
    for f in featured {
        if !seen.contains(&f) {
            seen.push(f);
        }
    }
    format!(
        "{} at {} ({}). {} {}People present: {}.{}",
        template.prompt_subject,
        site.label,
        zone.label,
        if zone.what.is_empty() { template.what.clone() } else { zone.what.clone() },
        if zone.brief.trim().is_empty() { String::new() } else { format!("{} ", zone.brief.trim()) },
        if zone.who.is_empty() { template.who.clone() } else { zone.who.clone() },
        if seen.is_empty() { String::new() } else { format!(" On show: {}.", seen.join(", ")) }
    )
}

pub fn content_manifest(event: &EventSpec, root: Option<&Path>) -> Vec<ContentItem> {
    let mut out = Vec::new();
    if event.sites.len() > 1 {
        out.push(build(
            root,
            event,
            ContentKind::Poster,
            ContentLevel::Event,
            None,
            None,
            "Event map",
            event.map.poster.as_deref(),
            event.map.width,
            event.map.height,
            event_map_subject(event),
        ));
        out.push(build(
            root,
            event,
            ContentKind::LoopVideo,
            ContentLevel::Event,
            None,
            None,
            "Event map loop",
            event.map.loop_video.as_deref(),
            event.map.width,
            event.map.height,
            event_map_subject(event),
        ));
        let widget = event.map.widget.as_ref();
        out.push(build(
            root,
            event,
            ContentKind::Widget,
            ContentLevel::Event,
            None,
            None,
            "Event minimap blueprint",
            widget.and_then(|w| w.image.as_deref()),
            widget.map(|w| w.width).unwrap_or(1600.0),
            widget.map(|w| w.height).unwrap_or(1000.0),
            event_widget_subject(event),
        ));
        variant_items(
            root,
            event,
            ContentLevel::Event,
            None,
            None,
            "Event map",
            &event.map.variants,
            (event.map.width, event.map.height),
            (widget.map(|w| w.width).unwrap_or(1600.0), widget.map(|w| w.height).unwrap_or(1000.0)),
            event_map_subject(event),
            Some(event_widget_subject(event)),
            &mut out,
        );
    }
    for site in &event.sites {
        out.push(build(
            root,
            event,
            ContentKind::Poster,
            ContentLevel::Site,
            Some(site),
            None,
            &format!("{} map", site.label),
            site.map.poster.as_deref(),
            site.map.width,
            site.map.height,
            site_map_subject(event, site),
        ));
        out.push(build(
            root,
            event,
            ContentKind::LoopVideo,
            ContentLevel::Site,
            Some(site),
            None,
            &format!("{} map loop", site.label),
            site.map.loop_video.as_deref(),
            site.map.width,
            site.map.height,
            site_map_subject(event, site),
        ));
        let widget = site.map.widget.as_ref();
        out.push(build(
            root,
            event,
            ContentKind::Widget,
            ContentLevel::Site,
            Some(site),
            None,
            &format!("{} minimap blueprint", site.label),
            widget.and_then(|w| w.image.as_deref()),
            widget.map(|w| w.width).unwrap_or(1600.0),
            widget.map(|w| w.height).unwrap_or(1000.0),
            site_widget_subject(event, site),
        ));
        variant_items(
            root,
            event,
            ContentLevel::Site,
            Some(site),
            None,
            &format!("{} map", site.label),
            &site.map.variants,
            (site.map.width, site.map.height),
            (widget.map(|w| w.width).unwrap_or(1600.0), widget.map(|w| w.height).unwrap_or(1000.0)),
            site_map_subject(event, site),
            Some(site_widget_subject(event, site)),
            &mut out,
        );
        for zone in &site.zones {
            out.push(build(
                root,
                event,
                ContentKind::Poster,
                ContentLevel::Zone,
                Some(site),
                Some(zone),
                &format!("{} / {} poster", site.label, zone.label),
                zone.media.poster.as_deref(),
                zone.media.width,
                zone.media.height,
                zone_subject(event, site, zone),
            ));
            out.push(build(
                root,
                event,
                ContentKind::LoopVideo,
                ContentLevel::Zone,
                Some(site),
                Some(zone),
                &format!("{} / {} loop", site.label, zone.label),
                zone.media.loop_video.as_deref(),
                zone.media.width,
                zone.media.height,
                zone_subject(event, site, zone),
            ));
            variant_items(
                root,
                event,
                ContentLevel::Zone,
                Some(site),
                Some(zone),
                &format!("{} / {}", site.label, zone.label),
                &zone.media.variants,
                (zone.media.width, zone.media.height),
                (0.0, 0.0),
                zone_subject(event, site, zone),
                None,
                &mut out,
            );
        }
    }
    out
}

#[allow(clippy::too_many_arguments)]
fn variant_items(
    root: Option<&Path>,
    event: &EventSpec,
    level: ContentLevel,
    site: Option<&Site>,
    zone: Option<&Zone>,
    label: &str,
    variants: &[MediaVariant],
    size: (f64, f64),
    widget_size: (f64, f64),
    subject: String,
    widget_subject: Option<String>,
    out: &mut Vec<ContentItem>,
) {
    let poster_label = if level == ContentLevel::Zone { "poster" } else { "map" };
    for variant in variants {
        let window = Some(variant.window);
        out.push(build_timed(
            root,
            event,
            ContentKind::Poster,
            level,
            site,
            zone,
            window,
            &format!("{label} {poster_label}"),
            variant.poster.as_deref(),
            size.0,
            size.1,
            subject.clone(),
        ));
        out.push(build_timed(
            root,
            event,
            ContentKind::LoopVideo,
            level,
            site,
            zone,
            window,
            &format!("{label} loop"),
            variant.loop_video.as_deref(),
            size.0,
            size.1,
            subject.clone(),
        ));
        if let Some(widget_subject) = &widget_subject {
            out.push(build_timed(
                root,
                event,
                ContentKind::Widget,
                level,
                site,
                zone,
                window,
                &format!("{label} minimap"),
                variant.widget.as_deref(),
                widget_size.0,
                widget_size.1,
                widget_subject.clone(),
            ));
        }
    }
}

fn variant_slot<'a>(variants: &'a mut [MediaVariant], slug: &str) -> Option<&'a mut MediaVariant> {
    variants.iter_mut().find(|v| v.window.slug() == slug)
}

fn fill_variant(variant: &mut MediaVariant, kind: ContentKind, path: Option<String>) {
    match kind {
        ContentKind::Poster => variant.poster = path,
        ContentKind::LoopVideo => variant.loop_video = path,
        ContentKind::Widget => variant.widget = path,
    }
}

fn new_widget(width: f64, height: f64) -> crate::model::WidgetMedia {
    crate::model::WidgetMedia {
        image: None,
        width,
        height,
        hotspots: Vec::new(),
    }
}

pub fn sync_media(event: &EventSpec, root: &Path) -> EventSpec {
    let manifest = content_manifest(event, Some(root));
    let mut next = event.clone();
    for entry in manifest.into_iter().filter(|m| m.exists) {
        let path = Some(entry.path.clone());
        if let Some(slug) = entry.window.as_deref() {
            let variants = match entry.level {
                ContentLevel::Event => Some(&mut next.map.variants),
                ContentLevel::Site => entry.site.as_deref().and_then(|id| next.site_mut(id)).map(|s| &mut s.map.variants),
                ContentLevel::Zone => entry
                    .site
                    .as_deref()
                    .and_then(|id| next.site_mut(id))
                    .and_then(|site| {
                        let zid = entry.zone.as_deref()?;
                        site.zones.iter_mut().find(|z| z.id == zid)
                    })
                    .map(|z| &mut z.media.variants),
            };
            if let Some(variant) = variants.and_then(|list| variant_slot(list, slug)) {
                fill_variant(variant, entry.kind, path);
            }
            continue;
        }
        match (entry.level, entry.kind) {
            (ContentLevel::Event, ContentKind::Poster) => next.map.poster = path,
            (ContentLevel::Event, ContentKind::LoopVideo) => next.map.loop_video = path,
            (ContentLevel::Event, ContentKind::Widget) => {
                let widget = next.map.widget.get_or_insert_with(|| new_widget(entry.width, entry.height));
                widget.image = path;
            }
            (ContentLevel::Site, kind) => {
                if let Some(site) = entry.site.as_deref().and_then(|id| next.site_mut(id)) {
                    match kind {
                        ContentKind::Poster => site.map.poster = path,
                        ContentKind::LoopVideo => site.map.loop_video = path,
                        ContentKind::Widget => {
                            let widget = site.map.widget.get_or_insert_with(|| new_widget(entry.width, entry.height));
                            widget.image = path;
                        }
                    }
                }
            }
            (ContentLevel::Zone, kind) => {
                let zone = entry
                    .site
                    .as_deref()
                    .and_then(|id| next.site_mut(id))
                    .and_then(|site| {
                        let zid = entry.zone.as_deref()?;
                        site.zones.iter_mut().find(|z| z.id == zid)
                    });
                if let Some(zone) = zone {
                    match kind {
                        ContentKind::Poster => zone.media.poster = path,
                        ContentKind::LoopVideo => zone.media.loop_video = path,
                        ContentKind::Widget => {}
                    }
                }
            }
        }
    }
    next
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::example::channelhack;

    #[test]
    fn manifest_lists_every_level() {
        let event = channelhack();
        let items = content_manifest(&event, None);
        let zones: usize = event.sites.iter().map(|s| s.zones.len()).sum();
        let expected = 3 + event.sites.len() * 3 + zones * 2;
        assert_eq!(items.len(), expected);
        assert!(items.iter().all(|i| !i.exists));
        assert!(items.iter().all(|i| i.hint.contains("Aspect ratio") && i.prompt.is_empty()));
        let ids: std::collections::HashSet<_> = items.iter().map(|i| i.id.clone()).collect();
        assert_eq!(ids.len(), items.len());
        assert!(items.iter().all(|i| !i.path.starts_with("assets/opening")));
        assert!(items.iter().any(|i| i.level == ContentLevel::Event && i.path == "assets/event/map.png"));
    }

    #[test]
    fn variants_are_listed_and_synced() {
        use crate::model::Hm;
        let dir = std::env::temp_dir().join(format!("ebts-variants-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("assets/sites/sf/zones/salon/variants/1430-1600")).unwrap();
        std::fs::write(dir.join("assets/sites/sf/zones/salon/variants/1430-1600/loop.webm"), b"x").unwrap();
        let mut event = channelhack();
        let base = content_manifest(&event, None).len();
        let site = event.sites.iter_mut().find(|s| s.id == "sf").unwrap();
        let zone = site.zones.iter_mut().find(|z| z.id == "salon").unwrap();
        zone.media.variants.push(MediaVariant {
            window: TimeWindow { start: Hm::new(14, 30), end: Hm::new(16, 0) },
            poster: None,
            loop_video: None,
            widget: None,
        });
        let items = content_manifest(&event, None);
        assert_eq!(items.len(), base + 2);
        let timed = items.iter().find(|i| i.window.as_deref() == Some("1430-1600") && i.kind == ContentKind::LoopVideo).unwrap();
        assert_eq!(timed.path, "assets/sites/sf/zones/salon/variants/1430-1600/loop.mp4");
        assert!(timed.hint.contains("14:30"));
        assert!(timed.id.ends_with(":1430-1600"));
        let synced = sync_media(&event, &dir);
        let salon = synced.site("sf").unwrap().zone("salon").unwrap();
        assert_eq!(
            salon.media.variants[0].loop_video.as_deref(),
            Some("assets/sites/sf/zones/salon/variants/1430-1600/loop.webm")
        );
        assert_eq!(salon.media.loop_at(Hm::new(15, 0)), Some("assets/sites/sf/zones/salon/variants/1430-1600/loop.webm"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn overrides_replace_the_prompt_and_carry_init_images() {
        use crate::model::ContentOverride;
        let mut event = channelhack();
        let base = content_manifest(&event, None);
        let target = base.iter().find(|i| i.zone.is_some() && i.kind == ContentKind::Poster).unwrap();
        assert!(target.prompt.is_empty());
        assert!(target.hint.contains("Aspect ratio"));
        event.content.insert(
            target.id.clone(),
            ContentOverride {
                prompt: Some("  A hand-painted salon  ".into()),
                negative_prompt: "text".into(),
                init_images: vec!["assets/refs/salon.png".into()],
                seed: Some(7),
                sampler: SamplerOverride { steps: Some(6), cfg: None, denoise: Some(0.5) },
            },
        );
        let items = content_manifest(&event, None);
        let item = items.iter().find(|i| i.id == target.id).unwrap();
        assert_eq!(item.prompt, "A hand-painted salon");
        assert_eq!(item.sampler.steps, Some(6));
        assert_eq!(item.sampler.denoise, Some(0.5));
        assert_eq!(item.hint, target.hint);
        assert_eq!(item.negative_prompt, "text");
        assert_eq!(item.init_images, vec!["assets/refs/salon.png".to_string()]);
        assert_eq!(item.seed, Some(7));
        event.content.insert(target.id.clone(), ContentOverride { prompt: Some("   ".into()), ..Default::default() });
        let items = content_manifest(&event, None);
        assert!(items.iter().find(|i| i.id == target.id).unwrap().prompt.is_empty());
    }

    #[test]
    fn canonical_paths() {
        assert_eq!(
            canonical_path(ContentLevel::Zone, ContentKind::Poster, Some("sf"), Some("salon")),
            "assets/sites/sf/zones/salon/poster.png"
        );
        assert_eq!(canonical_path(ContentLevel::Event, ContentKind::Widget, None, None), "assets/event/widget.png");
        assert_eq!(canonical_path(ContentLevel::Site, ContentKind::LoopVideo, Some("sf"), None), "assets/sites/sf/loop.mp4");
        assert_eq!(canonical_path(ContentLevel::Event, ContentKind::Poster, None, None), "assets/event/map.png");
        assert_eq!(
            variant_path(ContentLevel::Zone, ContentKind::LoopVideo, Some("sf"), Some("salon"), "1430-1600"),
            "assets/sites/sf/zones/salon/variants/1430-1600/loop.mp4"
        );
    }

    #[test]
    fn sync_media_picks_up_files_with_any_extension() {
        let dir = std::env::temp_dir().join(format!("ebts-manifest-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("assets/sites/sf/zones/salon")).unwrap();
        std::fs::write(dir.join("assets/sites/sf/zones/salon/poster.jpg"), b"x").unwrap();
        std::fs::create_dir_all(dir.join("assets/sites/sf")).unwrap();
        std::fs::write(dir.join("assets/sites/sf/widget.png"), b"x").unwrap();
        std::fs::write(dir.join("assets/sites/sf/loop.webm"), b"x").unwrap();
        let mut event = channelhack();
        if let Some(sf) = event.site_mut("sf") {
            sf.map.loop_video = None;
        }
        let synced = sync_media(&event, &dir);
        let sf = synced.site("sf").unwrap();
        assert_eq!(sf.zone("salon").unwrap().media.poster.as_deref(), Some("assets/sites/sf/zones/salon/poster.jpg"));
        assert_eq!(sf.map.widget.as_ref().unwrap().image.as_deref(), Some("assets/sites/sf/widget.png"));
        assert_eq!(sf.map.loop_video.as_deref(), Some("assets/sites/sf/loop.webm"));
        let manifest = content_manifest(&synced, Some(&dir));
        assert_eq!(manifest.iter().filter(|m| m.exists).count(), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
