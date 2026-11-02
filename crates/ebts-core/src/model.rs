use std::fmt;

use chrono::NaiveDate;
use serde::{de, Deserialize, Deserializer, Serialize, Serializer};

use crate::error::CoreError;

pub const EVENT_VERSION: u32 = 1;
pub const DAY_MINUTES: u16 = 1440;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Hm(pub u16);

impl Hm {
    pub fn new(hours: u16, minutes: u16) -> Self {
        Hm(hours * 60 + minutes)
    }

    pub fn parse(value: &str) -> Result<Self, CoreError> {
        let mut parts = value.trim().split(':');
        let h = parts.next().and_then(|p| p.parse::<u16>().ok());
        let m = parts.next().and_then(|p| p.parse::<u16>().ok());
        match (h, m, parts.next()) {
            (Some(h), Some(m), None) if m < 60 && h < 48 => Ok(Hm(h * 60 + m)),
            _ => Err(CoreError::InvalidTime(value.to_string())),
        }
    }

    pub fn hours(self) -> u16 {
        self.0 / 60
    }

    pub fn minutes(self) -> u16 {
        self.0 % 60
    }

    pub fn plus(self, minutes: i32) -> Self {
        let value = (self.0 as i32 + minutes).max(0);
        Hm(value as u16)
    }

    pub fn minutes_until(self, other: Hm) -> i32 {
        other.0 as i32 - self.0 as i32
    }

    pub fn pretty(self) -> String {
        let h = self.hours() % 24;
        let suffix = if h >= 12 { "PM" } else { "AM" };
        let hour = if h % 12 == 0 { 12 } else { h % 12 };
        format!("{}:{:02} {}", hour, self.minutes(), suffix)
    }
}

impl fmt::Display for Hm {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:02}:{:02}", self.hours(), self.minutes())
    }
}

impl Serialize for Hm {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for Hm {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = String::deserialize(deserializer)?;
        Hm::parse(&raw).map_err(de::Error::custom)
    }
}

pub fn span_end(open: Hm, close: Hm) -> Hm {
    if close <= open {
        close.plus(DAY_MINUTES as i32)
    } else {
        close
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeWindow {
    pub start: Hm,
    pub end: Hm,
}

impl TimeWindow {
    pub fn contains(&self, at: Hm) -> bool {
        let at = Hm(at.0 % DAY_MINUTES);
        let start = Hm(self.start.0 % DAY_MINUTES);
        let end = Hm(self.end.0 % DAY_MINUTES);
        if end <= start {
            at >= start || at <= end
        } else {
            at >= start && at <= end
        }
    }

    pub fn slug(&self) -> String {
        format!("{:02}{:02}-{:02}{:02}", self.start.hours(), self.start.minutes(), self.end.hours(), self.end.minutes())
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MediaVariant {
    pub window: TimeWindow,
    #[serde(default)]
    pub poster: Option<String>,
    #[serde(default)]
    pub loop_video: Option<String>,
    #[serde(default)]
    pub widget: Option<String>,
}

pub fn active_variant(variants: &[MediaVariant], at: Hm) -> Option<&MediaVariant> {
    variants
        .iter()
        .filter(|v| v.window.contains(at))
        .max_by_key(|v| v.window.start)
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Hotspot {
    pub id: String,
    pub label: String,
    pub target: String,
    #[serde(default)]
    pub polygon: Vec<Point>,
    #[serde(default)]
    pub window: Option<TimeWindow>,
}

impl Hotspot {
    pub fn is_drawn(&self) -> bool {
        self.polygon.len() >= 3
    }

    pub fn visible_at(&self, at: Hm) -> bool {
        self.window.map_or(true, |w| w.contains(at))
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct WidgetMedia {
    #[serde(default)]
    pub image: Option<String>,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub hotspots: Vec<Hotspot>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MapMedia {
    #[serde(default)]
    pub poster: Option<String>,
    #[serde(default)]
    pub loop_video: Option<String>,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub hotspots: Vec<Hotspot>,
    #[serde(default)]
    pub video_hotspots: Option<Vec<Hotspot>>,
    #[serde(default)]
    pub widget: Option<WidgetMedia>,
    #[serde(default)]
    pub variants: Vec<MediaVariant>,
}

impl MapMedia {
    pub fn hotspots_for_video(&self) -> &Vec<Hotspot> {
        self.video_hotspots.as_ref().unwrap_or(&self.hotspots)
    }

    pub fn poster_at(&self, at: Hm) -> Option<&str> {
        active_variant(&self.variants, at)
            .and_then(|v| v.poster.as_deref())
            .or(self.poster.as_deref())
    }

    pub fn loop_at(&self, at: Hm) -> Option<&str> {
        active_variant(&self.variants, at)
            .and_then(|v| v.loop_video.as_deref())
            .or(self.loop_video.as_deref())
    }
}

impl Default for MapMedia {
    fn default() -> Self {
        MapMedia {
            poster: None,
            loop_video: None,
            width: 1920.0,
            height: 1080.0,
            hotspots: Vec::new(),
            video_hotspots: None,
            widget: None,
            variants: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ZoneMedia {
    #[serde(default)]
    pub poster: Option<String>,
    #[serde(default)]
    pub loop_video: Option<String>,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub variants: Vec<MediaVariant>,
}

impl ZoneMedia {
    pub fn poster_at(&self, at: Hm) -> Option<&str> {
        active_variant(&self.variants, at)
            .and_then(|v| v.poster.as_deref())
            .or(self.poster.as_deref())
    }

    pub fn loop_at(&self, at: Hm) -> Option<&str> {
        active_variant(&self.variants, at)
            .and_then(|v| v.loop_video.as_deref())
            .or(self.loop_video.as_deref())
    }
}

impl Default for ZoneMedia {
    fn default() -> Self {
        ZoneMedia {
            poster: None,
            loop_video: None,
            width: 1920.0,
            height: 1080.0,
            variants: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct StyleGuide {
    #[serde(default)]
    pub art_direction: String,
    #[serde(default)]
    pub palette: Vec<String>,
    #[serde(default)]
    pub mood: String,
    #[serde(default)]
    pub references: Vec<String>,
    #[serde(default)]
    pub avoid: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ZoneFormat {
    Salon,
    DemoStation,
    PerformanceZone,
    ScreeningRoom,
    MingleSpace,
    TinkerSpace,
    VideoWall,
    SpatialInstallation,
    TelepresenceZone,
    Refractory,
    BackOfHouse,
    Custom,
}

impl ZoneFormat {
    pub fn all() -> [ZoneFormat; 12] {
        [
            ZoneFormat::Salon,
            ZoneFormat::DemoStation,
            ZoneFormat::PerformanceZone,
            ZoneFormat::ScreeningRoom,
            ZoneFormat::MingleSpace,
            ZoneFormat::TinkerSpace,
            ZoneFormat::VideoWall,
            ZoneFormat::SpatialInstallation,
            ZoneFormat::TelepresenceZone,
            ZoneFormat::Refractory,
            ZoneFormat::BackOfHouse,
            ZoneFormat::Custom,
        ]
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Rhythm {
    Continuous,
    Scheduled,
    OpenPlusScheduled,
    Loops,
    CrewOnly,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScheduleStatus {
    FeedUp,
    Linked,
    Scheduled,
    Open,
    FoodService,
    Installed,
    OnFloor,
    Interstitial,
    LoadIn,
    Crew,
    Strike,
    Screening,
    Workshop,
    RoomChange,
}

impl ScheduleStatus {
    pub fn label(self) -> &'static str {
        match self {
            ScheduleStatus::FeedUp => "Feed up",
            ScheduleStatus::Linked => "Linked",
            ScheduleStatus::Scheduled => "Scheduled",
            ScheduleStatus::Open => "Open",
            ScheduleStatus::FoodService => "Food service",
            ScheduleStatus::Installed => "Installed",
            ScheduleStatus::OnFloor => "On floor",
            ScheduleStatus::Interstitial => "Interstitial",
            ScheduleStatus::LoadIn => "Load-in",
            ScheduleStatus::Crew => "Crew",
            ScheduleStatus::Strike => "Strike",
            ScheduleStatus::Screening => "Screening",
            ScheduleStatus::Workshop => "Workshop",
            ScheduleStatus::RoomChange => "Room change",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScheduleLink {
    pub site: String,
    pub zone: String,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Production {
    #[default]
    Idea,
    InProgress,
    Confirmed,
    Cancelled,
}

impl Production {
    pub fn all() -> [Production; 4] {
        [Production::Idea, Production::InProgress, Production::Confirmed, Production::Cancelled]
    }

    pub fn label(self) -> &'static str {
        match self {
            Production::Idea => "Idea",
            Production::InProgress => "In progress",
            Production::Confirmed => "Confirmed",
            Production::Cancelled => "Cancelled",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub done: bool,
    #[serde(default)]
    pub owner: String,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PersonStatus {
    #[default]
    NotContacted,
    Contacted,
    Confirmed,
    Declined,
}

impl PersonStatus {
    pub fn all() -> [PersonStatus; 4] {
        [PersonStatus::NotContacted, PersonStatus::Contacted, PersonStatus::Confirmed, PersonStatus::Declined]
    }

    pub fn label(self) -> &'static str {
        match self {
            PersonStatus::NotContacted => "Not contacted",
            PersonStatus::Contacted => "Contacted",
            PersonStatus::Confirmed => "Confirmed",
            PersonStatus::Declined => "Declined",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Contact {
    pub date: String,
    #[serde(default)]
    pub channel: String,
    #[serde(default)]
    pub note: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Person {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub contact: String,
    #[serde(default)]
    pub status: PersonStatus,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub log: Vec<Contact>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct SamplerOverride {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steps: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cfg: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub denoise: Option<f64>,
}

impl SamplerOverride {
    pub fn is_empty(&self) -> bool {
        self.steps.is_none() && self.cfg.is_none() && self.denoise.is_none()
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct ContentOverride {
    #[serde(default)]
    pub prompt: Option<String>,
    #[serde(default)]
    pub negative_prompt: String,
    #[serde(default)]
    pub init_images: Vec<String>,
    #[serde(default)]
    pub seed: Option<u64>,
    #[serde(default, skip_serializing_if = "SamplerOverride::is_empty")]
    pub sampler: SamplerOverride,
}

impl ContentOverride {
    pub fn is_empty(&self) -> bool {
        self.prompt.as_deref().map_or(true, |p| p.trim().is_empty())
            && self.negative_prompt.trim().is_empty()
            && self.init_images.is_empty()
            && self.seed.is_none()
            && self.sampler.is_empty()
    }
}

pub fn open_tasks(tasks: &[Task]) -> usize {
    tasks.iter().filter(|t| !t.done).count()
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ScheduleItem {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub description: String,
    pub start: Hm,
    pub end: Hm,
    #[serde(default)]
    pub who: String,
    #[serde(default, alias = "theme")]
    pub channel: String,
    pub status: ScheduleStatus,
    #[serde(default)]
    pub link: Option<ScheduleLink>,
    #[serde(default)]
    pub production: Production,
    #[serde(default)]
    pub tasks: Vec<Task>,
}

impl ScheduleItem {
    pub fn is_live(&self, now: Hm) -> bool {
        self.start <= now && now < self.end && self.production != Production::Cancelled
    }

    pub fn duration(&self) -> i32 {
        self.start.minutes_until(self.end)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Zone {
    pub id: String,
    pub label: String,
    pub format: ZoneFormat,
    #[serde(default)]
    pub who: String,
    #[serde(default)]
    pub what: String,
    #[serde(default)]
    pub brief: String,
    pub rhythm: Rhythm,
    #[serde(default)]
    pub open: Option<Hm>,
    #[serde(default)]
    pub close: Option<Hm>,
    #[serde(default = "default_capacity")]
    pub capacity: u32,
    #[serde(default)]
    pub media: ZoneMedia,
    #[serde(default)]
    pub schedule: Vec<ScheduleItem>,
    #[serde(default)]
    pub tasks: Vec<Task>,
}

fn default_capacity() -> u32 {
    60
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Site {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub city: String,
    #[serde(default)]
    pub venue: String,
    pub timezone: String,
    pub open: Hm,
    pub close: Hm,
    pub crew_open: Hm,
    pub crew_close: Hm,
    #[serde(default)]
    pub zones: Vec<Zone>,
    #[serde(default)]
    pub map: MapMedia,
    #[serde(default)]
    pub tasks: Vec<Task>,
}

impl Site {
    pub fn zone(&self, zone_id: &str) -> Option<&Zone> {
        self.zones.iter().find(|z| z.id == zone_id)
    }

    pub fn public_close(&self) -> Hm {
        span_end(self.open, self.close)
    }

    pub fn crew_close_abs(&self) -> Hm {
        span_end(self.crew_open, self.crew_close)
    }

    pub fn zone_hours(&self, zone: &Zone) -> (Hm, Hm) {
        if zone.format == ZoneFormat::BackOfHouse {
            return (self.crew_open, self.crew_close_abs());
        }
        let open = zone.open.unwrap_or(self.open);
        let close = zone.close.map(|c| span_end(open, c)).unwrap_or(self.public_close());
        (open, close)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EventSpec {
    #[serde(default = "default_version")]
    pub version: u32,
    pub id: String,
    pub name: String,
    pub date: NaiveDate,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub style: StyleGuide,
    #[serde(default)]
    pub sites: Vec<Site>,
    #[serde(default)]
    pub map: MapMedia,
    #[serde(default)]
    pub people: Vec<Person>,
    #[serde(default)]
    pub tasks: Vec<Task>,
    #[serde(default)]
    pub content: std::collections::BTreeMap<String, ContentOverride>,
}

fn default_version() -> u32 {
    EVENT_VERSION
}

impl EventSpec {
    pub fn blank(id: &str, name: &str, date: NaiveDate) -> Self {
        EventSpec {
            version: EVENT_VERSION,
            id: id.to_string(),
            name: name.to_string(),
            date,
            description: String::new(),
            style: StyleGuide::default(),
            sites: Vec::new(),
            map: MapMedia::default(),
            people: Vec::new(),
            tasks: Vec::new(),
            content: std::collections::BTreeMap::new(),
        }
    }

    pub fn site(&self, site_id: &str) -> Option<&Site> {
        self.sites.iter().find(|s| s.id == site_id)
    }

    pub fn site_mut(&mut self, site_id: &str) -> Option<&mut Site> {
        self.sites.iter_mut().find(|s| s.id == site_id)
    }
}

pub fn who_names(who: &str) -> Vec<String> {
    who.split(|c| c == ',' || c == '+' || c == '&')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

pub fn person_key(name: &str) -> String {
    name.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase()
}

impl EventSpec {
    pub fn person_for(&self, name: &str) -> Option<&Person> {
        let key = person_key(name);
        self.people.iter().find(|p| person_key(&p.name) == key)
    }
}

pub fn slugify(value: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for ch in value.chars() {
        let lower = ch.to_ascii_lowercase();
        if lower.is_ascii_alphanumeric() {
            out.push(lower);
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    let trimmed = out.trim_end_matches('-').to_string();
    if trimmed.is_empty() {
        "item".to_string()
    } else {
        trimmed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_prints_hm() {
        let t = Hm::parse("13:05").unwrap();
        assert_eq!(t.to_string(), "13:05");
        assert_eq!(t.pretty(), "1:05 PM");
        assert!(Hm::parse("25:61").is_err());
        assert!(Hm::parse("abc").is_err());
    }

    #[test]
    fn hm_roundtrips_json() {
        let json = serde_json::to_string(&Hm::new(9, 30)).unwrap();
        assert_eq!(json, "\"09:30\"");
        let back: Hm = serde_json::from_str(&json).unwrap();
        assert_eq!(back, Hm::new(9, 30));
    }

    #[test]
    fn span_end_wraps_past_midnight() {
        assert_eq!(span_end(Hm::new(22, 0), Hm::new(1, 0)), Hm::new(25, 0));
        assert_eq!(span_end(Hm::new(10, 0), Hm::new(17, 30)), Hm::new(17, 30));
    }

    #[test]
    fn slugs() {
        assert_eq!(slugify("Demo Station 1"), "demo-station-1");
        assert_eq!(slugify("  Refractory / Analog "), "refractory-analog");
        assert_eq!(slugify("***"), "item");
    }

    #[test]
    fn old_files_with_unknown_keys_still_load() {
        let raw = r#"{"id":"x","name":"X","date":"2026-01-01","opening":{"poster":null,"artworks":[{"breakpoint":"desktop"}]},"hero":{}}"#;
        let event: EventSpec = serde_json::from_str(raw).unwrap();
        assert_eq!(event.id, "x");
        assert!(!serde_json::to_string(&event).unwrap().contains("opening"));
    }

    #[test]
    fn windows_contain_and_wrap() {
        let day = TimeWindow { start: Hm::new(14, 30), end: Hm::new(16, 0) };
        assert!(day.contains(Hm::new(15, 0)));
        assert!(day.contains(Hm::new(16, 0)));
        assert!(!day.contains(Hm::new(16, 1)));
        let night = TimeWindow { start: Hm::new(22, 0), end: Hm::new(2, 0) };
        assert!(night.contains(Hm::new(23, 30)));
        assert!(night.contains(Hm::new(1, 0)));
        assert!(!night.contains(Hm::new(12, 0)));
        assert_eq!(day.slug(), "1430-1600");
        let variants = vec![
            MediaVariant { window: TimeWindow { start: Hm::new(10, 0), end: Hm::new(18, 0) }, poster: Some("a".into()), loop_video: None, widget: None },
            MediaVariant { window: TimeWindow { start: Hm::new(14, 0), end: Hm::new(15, 0) }, poster: Some("b".into()), loop_video: None, widget: None },
        ];
        assert_eq!(active_variant(&variants, Hm::new(14, 30)).and_then(|v| v.poster.as_deref()), Some("b"));
        assert_eq!(active_variant(&variants, Hm::new(16, 0)).and_then(|v| v.poster.as_deref()), Some("a"));
        assert!(active_variant(&variants, Hm::new(9, 0)).is_none());
    }

    #[test]
    fn enums_use_kebab_case() {
        assert_eq!(serde_json::to_string(&ZoneFormat::DemoStation).unwrap(), "\"demo-station\"");
        assert_eq!(serde_json::to_string(&ScheduleStatus::FeedUp).unwrap(), "\"feed-up\"");
        assert_eq!(serde_json::to_string(&Rhythm::OpenPlusScheduled).unwrap(), "\"open-plus-scheduled\"");
    }
}
