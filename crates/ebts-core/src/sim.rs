use chrono::{DateTime, Duration, NaiveDateTime, TimeZone, Timelike, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};

use crate::error::{CoreError, CoreResult};
use crate::model::{EventSpec, Hm, Rhythm, ScheduleItem, Site, Zone, ZoneFormat, DAY_MINUTES};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ZoneState {
    Closed,
    Crew,
    Idle,
    Live,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LiveZone {
    pub site: String,
    pub zone: String,
    pub state: ZoneState,
    pub live: Vec<ScheduleItem>,
    pub next: Option<ScheduleItem>,
    pub minutes_to_next: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SiteSnapshot {
    pub site: String,
    pub local_time: Hm,
    pub open: bool,
    pub zones: Vec<LiveZone>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LinkEnd {
    pub site: String,
    pub zone: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ActiveLink {
    pub from: LinkEnd,
    pub to: LinkEnd,
    pub item: String,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Snapshot {
    pub utc: DateTime<Utc>,
    pub sites: Vec<SiteSnapshot>,
    pub links: Vec<ActiveLink>,
    pub headline: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SimWindow {
    pub start_utc: DateTime<Utc>,
    pub end_utc: DateTime<Utc>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConflictSeverity {
    Warn,
    Error,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Conflict {
    pub severity: ConflictSeverity,
    pub message: String,
    pub site: Option<String>,
    pub zone: Option<String>,
    pub item: Option<String>,
}

pub fn site_tz(site: &Site) -> CoreResult<Tz> {
    site.timezone
        .parse::<Tz>()
        .map_err(|_| CoreError::UnknownTimezone(site.timezone.clone()))
}

pub fn local_to_utc(event: &EventSpec, site: &Site, at: Hm) -> CoreResult<DateTime<Utc>> {
    let tz = site_tz(site)?;
    let days = (at.0 / DAY_MINUTES) as i64;
    let minutes = (at.0 % DAY_MINUTES) as u32;
    let date = event.date + Duration::days(days);
    let naive: NaiveDateTime = date
        .and_hms_opt(minutes / 60, minutes % 60, 0)
        .ok_or_else(|| CoreError::Other("invalid local time".into()))?;
    let local = tz
        .from_local_datetime(&naive)
        .earliest()
        .ok_or_else(|| CoreError::Other(format!("{} does not exist in {}", naive, site.timezone)))?;
    Ok(local.with_timezone(&Utc))
}

pub fn utc_to_local(event: &EventSpec, site: &Site, utc: DateTime<Utc>) -> CoreResult<Hm> {
    let tz = site_tz(site)?;
    let local = utc.with_timezone(&tz);
    let day_offset = (local.date_naive() - event.date).num_days();
    let minutes = local.hour() as i64 * 60 + local.minute() as i64 + day_offset * DAY_MINUTES as i64;
    Ok(Hm(minutes.clamp(0, u16::MAX as i64) as u16))
}

pub fn sim_window(event: &EventSpec) -> CoreResult<SimWindow> {
    let mut start: Option<DateTime<Utc>> = None;
    let mut end: Option<DateTime<Utc>> = None;
    for site in &event.sites {
        let s = local_to_utc(event, site, site.crew_open)?;
        let e = local_to_utc(event, site, site.crew_close_abs())?;
        start = Some(start.map_or(s, |v| v.min(s)));
        end = Some(end.map_or(e, |v| v.max(e)));
    }
    match (start, end) {
        (Some(start_utc), Some(end_utc)) => Ok(SimWindow { start_utc, end_utc }),
        _ => {
            let start_utc = Utc.from_utc_datetime(&event.date.and_hms_opt(0, 0, 0).unwrap_or_default());
            Ok(SimWindow {
                start_utc,
                end_utc: start_utc + Duration::days(1),
            })
        }
    }
}

fn zone_now(site: &Site, zone: &Zone, now: Hm) -> LiveZone {
    let crew_window = site.crew_open <= now && now < site.crew_close_abs();
    let (open, close) = site.zone_hours(zone);
    let in_hours = open <= now && now < close;
    let live: Vec<ScheduleItem> = zone.schedule.iter().filter(|i| i.is_live(now)).cloned().collect();
    let next = zone
        .schedule
        .iter()
        .filter(|i| i.start > now && i.production != crate::model::Production::Cancelled)
        .min_by_key(|i| i.start)
        .cloned();
    let minutes_to_next = next.as_ref().map(|n| now.minutes_until(n.start));
    let state = if !live.is_empty() {
        ZoneState::Live
    } else if in_hours {
        ZoneState::Idle
    } else if crew_window {
        ZoneState::Crew
    } else {
        ZoneState::Closed
    };
    LiveZone {
        site: site.id.clone(),
        zone: zone.id.clone(),
        state,
        live,
        next,
        minutes_to_next,
    }
}

pub fn simulate(event: &EventSpec, utc: DateTime<Utc>) -> CoreResult<Snapshot> {
    let mut sites = Vec::new();
    let mut links = Vec::new();
    for site in &event.sites {
        let now = utc_to_local(event, site, utc)?;
        let zones: Vec<LiveZone> = site.zones.iter().map(|z| zone_now(site, z, now)).collect();
        for zone in &site.zones {
            for item in &zone.schedule {
                if let Some(link) = &item.link {
                    links.push(ActiveLink {
                        from: LinkEnd {
                            site: site.id.clone(),
                            zone: zone.id.clone(),
                        },
                        to: LinkEnd {
                            site: link.site.clone(),
                            zone: link.zone.clone(),
                        },
                        item: item.id.clone(),
                        active: item.is_live(now),
                    });
                }
            }
        }
        sites.push(SiteSnapshot {
            site: site.id.clone(),
            local_time: now,
            open: site.open <= now && now < site.public_close(),
            zones,
        });
    }
    let live_count: usize = sites
        .iter()
        .flat_map(|s| s.zones.iter())
        .filter(|z| z.state == ZoneState::Live)
        .count();
    let open_sites = sites.iter().filter(|s| s.open).count();
    let top = sites
        .iter()
        .flat_map(|s| s.zones.iter())
        .flat_map(|z| z.live.iter())
        .find(|i| i.status != crate::model::ScheduleStatus::Open && i.status != crate::model::ScheduleStatus::FoodService)
        .map(|i| i.title.clone());
    let headline = match (open_sites, top) {
        (0, _) => "Doors closed everywhere".to_string(),
        (_, Some(title)) => format!("{} zones live across {} open sites, now: {}", live_count, open_sites, title),
        (_, None) => format!("{} zones live across {} open sites", live_count, open_sites),
    };
    Ok(Snapshot {
        utc,
        sites,
        links,
        headline,
    })
}

fn generic_who(who: &str) -> bool {
    let lower = who.to_lowercase();
    lower.is_empty()
        || lower.contains("all attendees")
        || lower.contains("unstructured")
        || lower.contains("mixed")
        || lower.contains("mingle")
        || lower.contains("production")
        || lower.contains("guests on")
        || lower.contains("attendees")
        || lower.contains("participants")
        || lower.contains("performers")
}

fn push(
    out: &mut Vec<Conflict>,
    severity: ConflictSeverity,
    message: String,
    site: Option<&str>,
    zone: Option<&str>,
    item: Option<&str>,
) {
    out.push(Conflict {
        severity,
        message,
        site: site.map(|s| s.to_string()),
        zone: zone.map(|s| s.to_string()),
        item: item.map(|s| s.to_string()),
    });
}

pub fn conflicts(event: &EventSpec) -> Vec<Conflict> {
    let mut out = Vec::new();
    let mut site_utc: Vec<(String, Option<(DateTime<Utc>, DateTime<Utc>)>)> = Vec::new();
    for site in &event.sites {
        let span = local_to_utc(event, site, site.open)
            .and_then(|s| local_to_utc(event, site, site.public_close()).map(|e| (s, e)))
            .ok();
        if span.is_none() {
            push(
                &mut out,
                ConflictSeverity::Error,
                format!("{}: timezone {:?} is not a valid IANA zone", site.label, site.timezone),
                Some(&site.id),
                None,
                None,
            );
        }
        site_utc.push((site.id.clone(), span));
        if site.crew_open > site.open || site.crew_close_abs() < site.public_close() {
            push(
                &mut out,
                ConflictSeverity::Warn,
                format!("{}: crew hours do not cover the public hours", site.label),
                Some(&site.id),
                None,
                None,
            );
        }
        for zone in &site.zones {
            let (open, close) = site.zone_hours(zone);
            if zone.schedule.is_empty() {
                push(
                    &mut out,
                    ConflictSeverity::Warn,
                    format!("{} / {}: no program yet", site.label, zone.label),
                    Some(&site.id),
                    Some(&zone.id),
                    None,
                );
                continue;
            }
            let mut sorted: Vec<&ScheduleItem> = zone.schedule.iter().collect();
            sorted.sort_by_key(|i| i.start);
            let mut covered_until = open;
            for item in &sorted {
                if item.end <= item.start {
                    push(
                        &mut out,
                        ConflictSeverity::Error,
                        format!("{} ends before it starts ({}–{})", item.title, item.start, item.end),
                        Some(&site.id),
                        Some(&zone.id),
                        Some(&item.id),
                    );
                }
                if item.start < open || item.end > close {
                    push(
                        &mut out,
                        ConflictSeverity::Warn,
                        format!("{} runs outside {} hours ({}–{})", item.title, zone.label, open, close),
                        Some(&site.id),
                        Some(&zone.id),
                        Some(&item.id),
                    );
                }
                if item.start > covered_until.plus(30) && zone.rhythm == Rhythm::Scheduled {
                    push(
                        &mut out,
                        ConflictSeverity::Warn,
                        format!(
                            "{}: {} minute gap before {}",
                            zone.label,
                            covered_until.minutes_until(item.start),
                            item.title
                        ),
                        Some(&site.id),
                        Some(&zone.id),
                        Some(&item.id),
                    );
                }
                covered_until = covered_until.max(item.end);
                if let Some(link) = &item.link {
                    match event.site(&link.site).and_then(|s| s.zone(&link.zone).map(|z| (s, z))) {
                        None => push(
                            &mut out,
                            ConflictSeverity::Error,
                            format!("{} links to unknown {}/{}", item.title, link.site, link.zone),
                            Some(&site.id),
                            Some(&zone.id),
                            Some(&item.id),
                        ),
                        Some((other_site, other_zone)) => {
                            let here = local_to_utc(event, site, item.start).ok().zip(local_to_utc(event, site, item.end).ok());
                            let overlap = here.map(|(s, e)| {
                                other_zone.schedule.iter().any(|o| {
                                    let os = local_to_utc(event, other_site, o.start).ok();
                                    let oe = local_to_utc(event, other_site, o.end).ok();
                                    matches!((os, oe), (Some(os), Some(oe)) if os < e && s < oe)
                                })
                            });
                            if overlap == Some(false) {
                                push(
                                    &mut out,
                                    ConflictSeverity::Warn,
                                    format!(
                                        "{} links to {} / {} but nothing is programmed there at that UTC time",
                                        item.title, other_site.label, other_zone.label
                                    ),
                                    Some(&site.id),
                                    Some(&zone.id),
                                    Some(&item.id),
                                );
                            }
                        }
                    }
                }
            }
        }
        let zones = &site.zones;
        for (ai, a_zone) in zones.iter().enumerate() {
            for b_zone in zones.iter().skip(ai + 1) {
                for a in &a_zone.schedule {
                    if generic_who(&a.who) {
                        continue;
                    }
                    for b in &b_zone.schedule {
                        if a.who == b.who && a.start < b.end && b.start < a.end {
                            push(
                                &mut out,
                                ConflictSeverity::Warn,
                                format!(
                                    "{} is in {} and {} at the same time ({} / {})",
                                    a.who, a_zone.label, b_zone.label, a.title, b.title
                                ),
                                Some(&site.id),
                                Some(&a_zone.id),
                                Some(&a.id),
                            );
                        }
                    }
                }
            }
        }
        if !zones.iter().any(|z| z.format == ZoneFormat::BackOfHouse) && !zones.is_empty() {
            push(
                &mut out,
                ConflictSeverity::Warn,
                format!("{}: no back-of-house zone, load-in and strike are not modeled", site.label),
                Some(&site.id),
                None,
                None,
            );
        }
    }
    let spans: Vec<(DateTime<Utc>, DateTime<Utc>)> = site_utc.iter().filter_map(|(_, s)| *s).collect();
    if spans.len() > 1 {
        let overlap_start = spans.iter().map(|s| s.0).max().unwrap_or_default();
        let overlap_end = spans.iter().map(|s| s.1).min().unwrap_or_default();
        if overlap_end <= overlap_start {
            push(
                &mut out,
                ConflictSeverity::Warn,
                "Sites are never open at the same time, cross-site links can never be live".to_string(),
                None,
                None,
                None,
            );
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::example::channelhack;

    #[test]
    fn sites_open_at_the_same_instant() {
        let event = channelhack();
        let sf = event.site("sf").unwrap();
        let nyc = event.site("nyc-1").unwrap();
        let a = local_to_utc(&event, sf, sf.open).unwrap();
        let b = local_to_utc(&event, nyc, nyc.open).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn window_spans_crew_hours() {
        let event = channelhack();
        let window = sim_window(&event).unwrap();
        assert!(window.end_utc > window.start_utc);
        let hours = (window.end_utc - window.start_utc).num_minutes() as f64 / 60.0;
        assert!(hours >= 11.0 && hours <= 14.0, "{hours}");
    }

    #[test]
    fn snapshot_reports_live_zones() {
        let event = channelhack();
        let nyc = event.site("nyc-1").unwrap();
        let at = local_to_utc(&event, nyc, Hm::new(15, 0)).unwrap();
        let snap = simulate(&event, at).unwrap();
        let nyc_snap = snap.sites.iter().find(|s| s.site == "nyc-1").unwrap();
        assert_eq!(nyc_snap.local_time, Hm::new(15, 0));
        assert!(nyc_snap.open);
        assert!(nyc_snap.zones.iter().any(|z| z.state == ZoneState::Live));
        let sf_snap = snap.sites.iter().find(|s| s.site == "sf").unwrap();
        assert_eq!(sf_snap.local_time, Hm::new(12, 0));
        assert!(snap.links.iter().any(|l| l.active));
    }

    #[test]
    fn before_doors_everything_is_crew_or_closed() {
        let event = channelhack();
        let nyc = event.site("nyc-1").unwrap();
        let at = local_to_utc(&event, nyc, Hm::new(11, 0)).unwrap();
        let snap = simulate(&event, at).unwrap();
        let nyc_snap = snap.sites.iter().find(|s| s.site == "nyc-1").unwrap();
        assert!(!nyc_snap.open);
        for zone in &nyc_snap.zones {
            assert!(matches!(zone.state, ZoneState::Crew | ZoneState::Live | ZoneState::Closed));
        }
    }

    #[test]
    fn generated_example_has_no_errors() {
        let event = channelhack();
        let found = conflicts(&event);
        let errors: Vec<_> = found.iter().filter(|c| c.severity == ConflictSeverity::Error).collect();
        assert!(errors.is_empty(), "{errors:?}");
    }

    #[test]
    fn bad_timezone_is_an_error() {
        let mut event = channelhack();
        event.sites[0].timezone = "Mars/Olympus".into();
        let found = conflicts(&event);
        assert!(found.iter().any(|c| c.severity == ConflictSeverity::Error));
        assert!(sim_window(&event).is_err());
    }
}
