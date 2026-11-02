use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::manifest::{content_manifest, ContentKind};
use crate::model::{open_tasks, person_key, who_names, EventSpec, PersonStatus, Production, Task, ZoneFormat};
use crate::sim::{conflicts, sim_window, site_tz, ConflictSeverity};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum StepId {
    Concept,
    Sites,
    Zones,
    Program,
    Production,
    Content,
    Bait,
    Maps,
    Simulate,
    Export,
}

impl StepId {
    pub fn all() -> [StepId; 10] {
        [
            StepId::Concept,
            StepId::Sites,
            StepId::Zones,
            StepId::Program,
            StepId::Production,
            StepId::Content,
            StepId::Bait,
            StepId::Maps,
            StepId::Simulate,
            StepId::Export,
        ]
    }

    pub fn title(self) -> &'static str {
        match self {
            StepId::Concept => "Intent",
            StepId::Sites => "Locations",
            StepId::Zones => "Stages",
            StepId::Program => "Channels",
            StepId::Production => "Production",
            StepId::Maps => "Maps",
            StepId::Content => "Narrative",
            StepId::Bait => "Bait",
            StepId::Simulate => "Simulation",
            StepId::Export => "Distro",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CheckStatus {
    Ok,
    Warn,
    Missing,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CheckTarget {
    pub site: Option<String>,
    pub zone: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CheckItem {
    pub status: CheckStatus,
    pub label: String,
    pub hint: String,
    pub target: Option<CheckTarget>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct StepReport {
    pub step: StepId,
    pub title: String,
    pub summary: String,
    pub progress: f64,
    pub items: Vec<CheckItem>,
}

struct Report {
    items: Vec<CheckItem>,
}

impl Report {
    fn new() -> Self {
        Report { items: Vec::new() }
    }

    fn check(&mut self, ok: bool, label: &str, hint: &str, fail: CheckStatus) {
        self.items.push(CheckItem {
            status: if ok { CheckStatus::Ok } else { fail },
            label: label.to_string(),
            hint: if ok { String::new() } else { hint.to_string() },
            target: None,
        });
    }

    fn check_at(&mut self, ok: bool, label: &str, hint: &str, fail: CheckStatus, site: &str, zone: Option<&str>) {
        self.items.push(CheckItem {
            status: if ok { CheckStatus::Ok } else { fail },
            label: label.to_string(),
            hint: if ok { String::new() } else { hint.to_string() },
            target: Some(CheckTarget {
                site: Some(site.to_string()),
                zone: zone.map(|z| z.to_string()),
            }),
        });
    }

    fn finish(self, step: StepId, summary: impl Into<String>) -> StepReport {
        let total = self.items.len().max(1) as f64;
        let score: f64 = self
            .items
            .iter()
            .map(|i| match i.status {
                CheckStatus::Ok => 1.0,
                CheckStatus::Warn => 0.5,
                CheckStatus::Missing => 0.0,
            })
            .sum();
        StepReport {
            step,
            title: step.title().to_string(),
            summary: summary.into(),
            progress: if self.items.is_empty() { 0.0 } else { score / total },
            items: self.items,
        }
    }
}

fn concept(event: &EventSpec) -> StepReport {
    let mut r = Report::new();
    r.check(!event.name.trim().is_empty(), "Event title", "Give the event a title", CheckStatus::Missing);
    r.check(true, "Event date", "", CheckStatus::Missing);
    r.finish(StepId::Concept, "")
}

fn sites(event: &EventSpec) -> StepReport {
    let mut r = Report::new();
    if event.sites.is_empty() {
        r.check(false, "Locations", "Add a city or venue", CheckStatus::Missing);
    }
    for site in &event.sites {
        r.check_at(site_tz(site).is_ok(), "Timezone", "Use an IANA name like America/New_York", CheckStatus::Missing, &site.id, None);
        r.check_at(site.public_close() > site.open, "Public hours", "Close must be after open", CheckStatus::Missing, &site.id, None);
        r.check_at(
            site.crew_open <= site.open && site.crew_close_abs() >= site.public_close(),
            "Crew hours",
            "Crew hours must wrap the public hours",
            CheckStatus::Warn,
            &site.id,
            None,
        );
        r.check_at(!site.venue.trim().is_empty(), "Venue", "Name the venue", CheckStatus::Warn, &site.id, None);
    }
    r.finish(StepId::Sites, "")
}

fn zones(event: &EventSpec) -> StepReport {
    let mut r = Report::new();
    if event.sites.is_empty() {
        r.check(false, "Locations", "Add a location before laying out stages", CheckStatus::Missing);
    }
    for site in &event.sites {
        r.check_at(!site.zones.is_empty(), "Stages", "Add stages from the catalog", CheckStatus::Missing, &site.id, None);
        r.check_at(site.zones.len() >= 3, "Three or more stages", "", CheckStatus::Warn, &site.id, None);
        r.check_at(
            site.zones.iter().any(|z| z.format == ZoneFormat::BackOfHouse),
            "Back of house",
            "Load-in and strike live here",
            CheckStatus::Warn,
            &site.id,
            None,
        );
        r.check_at(
            site.zones.iter().any(|z| z.format == ZoneFormat::MingleSpace),
            "Mingle space",
            "Somewhere to eat and mingle",
            CheckStatus::Warn,
            &site.id,
            None,
        );
        for zone in &site.zones {
            r.check_at(
                !zone.who.trim().is_empty() && !zone.what.trim().is_empty(),
                "Who and what",
                "",
                CheckStatus::Warn,
                &site.id,
                Some(&zone.id),
            );
        }
    }
    r.finish(StepId::Zones, "")
}

fn program(event: &EventSpec) -> StepReport {
    let mut r = Report::new();
    for site in &event.sites {
        for zone in &site.zones {
            r.check_at(
                !zone.schedule.is_empty(),
                "Channels",
                "Write the rows",
                CheckStatus::Missing,
                &site.id,
                Some(&zone.id),
            );
        }
    }
    let found = conflicts(event);
    let errors = found.iter().filter(|c| c.severity == ConflictSeverity::Error).count();
    let warns = found.iter().filter(|c| c.severity == ConflictSeverity::Warn).count();
    r.check(
        errors == 0 && warns == 0,
        "Channel conflicts",
        &format!("{} to fix", errors + warns),
        if errors > 0 { CheckStatus::Missing } else { CheckStatus::Warn },
    );
    r.finish(StepId::Program, "")
}

fn tasks_check(r: &mut Report, tasks: &[Task], site: Option<&str>, zone: Option<&str>) {
    if tasks.is_empty() {
        return;
    }
    let open = open_tasks(tasks);
    let hint = format!("{open} open");
    match site {
        Some(site) => r.check_at(open == 0, "Tasks", &hint, CheckStatus::Warn, site, zone),
        None => r.check(open == 0, "Tasks", &hint, CheckStatus::Warn),
    }
}

fn production(event: &EventSpec) -> StepReport {
    let mut r = Report::new();
    if event.sites.is_empty() {
        r.check(false, "Locations", "Add locations and stages first", CheckStatus::Missing);
    }
    let mut names: Vec<String> = Vec::new();
    for site in &event.sites {
        for zone in &site.zones {
            for row in zone.schedule.iter().filter(|r| r.production != Production::Cancelled) {
                for name in who_names(&row.who) {
                    if !names.iter().any(|n| person_key(n) == person_key(&name)) {
                        names.push(name);
                    }
                }
            }
        }
    }
    if !names.is_empty() {
        let status = |name: &str| event.person_for(name).map(|p| p.status).unwrap_or_default();
        let confirmed = names.iter().filter(|n| status(n) == PersonStatus::Confirmed).count();
        let pending = names.iter().filter(|n| status(n) == PersonStatus::NotContacted).count();
        let fail = if confirmed == 0 { CheckStatus::Missing } else { CheckStatus::Warn };
        r.check(
            confirmed == names.len(),
            "Who",
            &format!("{confirmed} of {} confirmed, {pending} not contacted", names.len()),
            fail,
        );
    }
    tasks_check(&mut r, &event.tasks, None, None);
    for site in &event.sites {
        tasks_check(&mut r, &site.tasks, Some(&site.id), None);
        for zone in &site.zones {
            let items: Vec<_> = zone.schedule.iter().filter(|i| i.production != Production::Cancelled).collect();
            if !items.is_empty() {
                let confirmed = items.iter().filter(|i| i.production == Production::Confirmed).count();
                let fail = if confirmed == 0 { CheckStatus::Missing } else { CheckStatus::Warn };
                r.check_at(
                    confirmed == items.len(),
                    "Confirmed",
                    &format!("{confirmed} of {}", items.len()),
                    fail,
                    &site.id,
                    Some(&zone.id),
                );
            }
            let mut tasks: Vec<Task> = zone.tasks.clone();
            for item in &zone.schedule {
                tasks.extend(item.tasks.iter().cloned());
            }
            tasks_check(&mut r, &tasks, Some(&site.id), Some(&zone.id));
        }
    }
    if r.items.is_empty() {
        r.check(false, "Channels", "Program the stages first", CheckStatus::Missing);
    }
    r.finish(StepId::Production, "")
}

fn bait() -> StepReport {
    StepReport { step: StepId::Bait, title: StepId::Bait.title().to_string(), summary: String::new(), progress: 1.0, items: Vec::new() }
}

fn maps(event: &EventSpec) -> StepReport {
    let mut r = Report::new();
    let multi = event.sites.len() > 1;
    if multi {
        r.check(event.map.poster.is_some(), "Event map art", "Import the event map", CheckStatus::Missing);
        for site in &event.sites {
            r.check_at(
                event.map.hotspots.iter().any(|h| h.target == site.id && h.is_drawn()),
                "Event map hotspot",
                "Draw the polygon that opens this site",
                CheckStatus::Missing,
                &site.id,
                None,
            );
        }
        r.check(
            event.map.widget.as_ref().and_then(|w| w.image.as_ref()).is_some(),
            "Event minimap",
            "",
            CheckStatus::Warn,
        );
    }
    for site in &event.sites {
        r.check_at(site.map.poster.is_some(), "Map art", "Import the site map", CheckStatus::Missing, &site.id, None);
        for zone in &site.zones {
            r.check_at(
                site.map.hotspots.iter().any(|h| h.target == zone.id && h.is_drawn()),
                "Hotspot",
                "Draw the polygon that opens this zone",
                CheckStatus::Missing,
                &site.id,
                Some(&zone.id),
            );
        }
        r.check_at(
            site.map.widget.as_ref().and_then(|w| w.image.as_ref()).is_some(),
            "Minimap",
            "",
            CheckStatus::Warn,
            &site.id,
            None,
        );
    }
    if event.sites.is_empty() {
        r.check(false, "Locations", "Add locations and stages first", CheckStatus::Missing);
    }
    r.finish(StepId::Maps, "")
}

fn content(event: &EventSpec, root: Option<&Path>) -> StepReport {
    let mut r = Report::new();
    let manifest = content_manifest(event, root);
    for entry in &manifest {
        let fail = match entry.kind {
            ContentKind::Poster => CheckStatus::Missing,
            _ => CheckStatus::Warn,
        };
        let hint = if root.is_none() {
            "Save the project to a folder so files can be checked".to_string()
        } else {
            format!("Produce {}", entry.path)
        };
        match (&entry.site, &entry.zone) {
            (Some(site), zone) => r.check_at(entry.exists, &entry.label, &hint, fail, site, zone.as_deref()),
            _ => r.check(entry.exists, &entry.label, &hint, fail),
        }
    }
    if r.items.is_empty() {
        r.check(false, "Locations", "Add locations and stages first", CheckStatus::Missing);
    }
    r.finish(StepId::Content, "")
}

fn simulate(event: &EventSpec) -> StepReport {
    let mut r = Report::new();
    r.check(sim_window(event).is_ok() && !event.sites.is_empty(), "Simulation window", "Sites need valid timezones", CheckStatus::Missing);
    let found = conflicts(event);
    let link_issues = found.iter().filter(|c| c.message.contains("links to")).count();
    r.check(link_issues == 0, "Cross-site links", &format!("{link_issues} links have no counterpart"), CheckStatus::Warn);
    let clashes = found.iter().filter(|c| c.message.contains("at the same time")).count();
    r.check(clashes == 0, "Double bookings", &format!("{clashes} people are in two rooms at once"), CheckStatus::Warn);
    let programmed = event.sites.iter().all(|s| s.zones.iter().all(|z| !z.schedule.is_empty())) && !event.sites.is_empty();
    r.check(programmed, "Channels", "Empty stages simulate as idle", CheckStatus::Warn);
    r.finish(StepId::Simulate, "")
}

fn export(previous: &[StepReport]) -> StepReport {
    let mut r = Report::new();
    let get = |id: StepId| previous.iter().find(|p| p.step == id).map(|p| p.progress).unwrap_or(0.0);
    let core = [StepId::Concept, StepId::Sites, StepId::Zones, StepId::Program]
        .iter()
        .map(|s| get(*s))
        .fold(1.0_f64, f64::min);
    r.check(core >= 0.75, "Intent, locations, stages, channels", "Finish the earlier steps", CheckStatus::Missing);
    r.check(get(StepId::Maps) >= 0.99, "Maps", "Every destination needs a hotspot", CheckStatus::Warn);
    r.check(get(StepId::Content) >= 0.99, "Narrative", "Missing art shows as placeholders", CheckStatus::Warn);
    r.finish(StepId::Export, "")
}

pub fn steps_report(event: &EventSpec, root: Option<&Path>) -> Vec<StepReport> {
    let mut out = vec![
        concept(event),
        sites(event),
        zones(event),
        program(event),
        production(event),
        content(event, root),
        bait(),
        maps(event),
        simulate(event),
    ];
    let last = export(&out);
    out.push(last);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::example::channelhack;
    use chrono::NaiveDate;

    #[test]
    fn blank_event_is_mostly_missing() {
        let event = EventSpec::blank("x", "", NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());
        let reports = steps_report(&event, None);
        assert_eq!(reports.len(), 10);
        assert!(reports[0].progress <= 0.5);
        assert!(reports[1].items.iter().any(|i| i.status == CheckStatus::Missing));
    }

    #[test]
    fn example_concept_sites_zones_program_complete() {
        let event = channelhack();
        let reports = steps_report(&event, None);
        for id in [StepId::Concept, StepId::Sites, StepId::Zones] {
            let report = reports.iter().find(|r| r.step == id).unwrap();
            assert!(report.progress >= 0.75, "{:?} {:#?}", id, report.items);
        }
        let program = reports.iter().find(|r| r.step == StepId::Program).unwrap();
        assert!(program.items.iter().all(|i| i.status != CheckStatus::Missing), "{:#?}", program.items);
    }

    #[test]
    fn production_counts_confirmed_items_and_open_tasks() {
        let mut event = channelhack();
        let zone = &mut event.sites[0].zones[0];
        let n = zone.schedule.len();
        zone.schedule[0].production = Production::Confirmed;
        zone.tasks.push(Task { id: "t1".into(), label: "Book the room".into(), done: false, owner: String::new() });
        let reports = steps_report(&event, None);
        let report = reports.iter().find(|r| r.step == StepId::Production).unwrap();
        let confirmed = report
            .items
            .iter()
            .find(|i| i.label == "Confirmed" && i.target.as_ref().and_then(|t| t.zone.as_deref()) == Some("salon"))
            .unwrap();
        assert_eq!(confirmed.status, CheckStatus::Warn);
        assert_eq!(confirmed.hint, format!("1 of {n}"));
        let tasks = report
            .items
            .iter()
            .find(|i| i.label == "Tasks" && i.target.as_ref().and_then(|t| t.zone.as_deref()) == Some("salon"))
            .unwrap();
        assert_eq!(tasks.hint, "1 open");
    }

    #[test]
    fn blank_program_reports_missing_zones() {
        let mut event = channelhack();
        for site in &mut event.sites {
            for zone in &mut site.zones {
                zone.schedule.clear();
            }
        }
        let reports = steps_report(&event, None);
        let program = reports.iter().find(|r| r.step == StepId::Program).unwrap();
        assert!(program.items.iter().any(|i| i.status == CheckStatus::Missing));
    }
}
