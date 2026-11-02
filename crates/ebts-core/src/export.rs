use serde_json::{json, Value};

use crate::catalog::template_for;
use crate::model::{EventSpec, Hotspot, MapMedia, MediaVariant, Site, Zone};

fn window_json(window: Option<&crate::model::TimeWindow>) -> Value {
    match window {
        Some(w) => json!({ "start": w.start, "end": w.end }),
        None => Value::Null,
    }
}

fn variants_json(variants: &[MediaVariant]) -> Value {
    Value::Array(
        variants
            .iter()
            .map(|v| {
                json!({
                    "window": window_json(Some(&v.window)),
                    "poster": v.poster,
                    "src": v.loop_video,
                    "widget": v.widget,
                })
            })
            .collect(),
    )
}

fn hotspots_json(hotspots: &[Hotspot], href: impl Fn(&str) -> String) -> Value {
    Value::Array(
        hotspots
            .iter()
            .filter(|h| h.is_drawn())
            .map(|h| {
                json!({
                    "id": h.id,
                    "label": h.label,
                    "href": href(&h.target),
                    "polygon": h.polygon.iter().map(|p| json!({"x": p.x, "y": p.y})).collect::<Vec<_>>(),
                    "window": window_json(h.window.as_ref()),
                })
            })
            .collect(),
    )
}

fn map_json(map: &MapMedia, href: impl Fn(&str) -> String + Copy) -> Value {
    let widget = map.widget.as_ref().map(|w| {
        json!({
            "image": w.image,
            "width": w.width,
            "height": w.height,
            "zones": hotspots_json(&w.hotspots, href),
        })
    });
    json!({
        "poster": map.poster,
        "src": map.loop_video,
        "width": map.width,
        "height": map.height,
        "hotspots": hotspots_json(&map.hotspots, href),
        "videoHotspots": map.video_hotspots.as_ref().map(|list| hotspots_json(list, href)),
        "widget": widget,
        "variants": variants_json(&map.variants),
    })
}

fn itinerary_json(site: &Site, zone: &Zone) -> Value {
    let template = template_for(zone.format);
    let (open, close) = site.zone_hours(zone);
    let rhythm = match zone.rhythm {
        crate::model::Rhythm::Continuous => "Continuous, drop in anytime",
        crate::model::Rhythm::Scheduled => "Scheduled",
        crate::model::Rhythm::OpenPlusScheduled => "Open blocks + scheduled sessions",
        crate::model::Rhythm::Loops => "Continuous loops + timed blocks",
        crate::model::Rhythm::CrewOnly => "Crew only, before, during and after public hours",
    };
    json!({
        "zone": zone.label,
        "format": template.label,
        "who": if zone.who.is_empty() { template.who.clone() } else { zone.who.clone() },
        "what": if zone.what.is_empty() { template.what.clone() } else { zone.what.clone() },
        "hours": format!("{} – {} {}", open.pretty(), close.pretty(), site.timezone),
        "rhythm": rhythm,
        "schedule": zone.schedule.iter().map(|item| json!({
            "id": item.id,
            "title": item.title,
            "kind": item.kind,
            "description": item.description,
            "start": item.start.pretty(),
            "end": item.end.pretty(),
            "who": item.who,
            "channel": item.channel,
            "status": item.status.label(),
            "link": item.link.as_ref().map(|l| format!("/{}/{}", l.site, l.zone)),
            "production": item.production,
            "tasks": item.tasks,
        })).collect::<Vec<_>>(),
        "tasks": zone.tasks,
    })
}

pub fn export_mitv(event: &EventSpec) -> Value {
    let event_href = format!("/{}", event.id);
    json!({
        "event": {
            "id": event.id,
            "name": event.name,
            "date": event.date,
            "description": event.description,
            "style": event.style,
            "tasks": event.tasks,
        },
        "show": {
            "date": event.date.format("%-d %B %Y").to_string(),
            "title": event.name,
            "cta": "Enter the sim",
            "href": event_href,
            "slots": event.sites.iter().map(|s| json!({
                "location": s.label,
                "time": format!("{} – {}", s.open.pretty(), s.public_close().pretty()),
                "zone": s.timezone,
            })).collect::<Vec<_>>(),
        },
        "map": map_json(&event.map, |target| format!("/{target}")),
        "sites": event.sites.iter().map(|site| json!({
            "id": site.id,
            "label": site.label,
            "city": site.city,
            "venue": site.venue,
            "timezone": site.timezone,
            "tasks": site.tasks,
            "href": format!("/{}", site.id),
            "map": map_json(&site.map, |target| format!("/{}/{}", site.id, target)),
            "zones": site.zones.iter().map(|zone| json!({
                "id": zone.id,
                "label": zone.label,
                "href": format!("/{}/{}", site.id, zone.id),
                "media": {
                    "poster": zone.media.poster,
                    "src": zone.media.loop_video,
                    "width": zone.media.width,
                    "height": zone.media.height,
                    "hotspots": [],
                    "variants": variants_json(&zone.media.variants),
                },
                "itinerary": itinerary_json(site, zone),
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::example::channelhack;

    #[test]
    fn export_has_sites_zones_and_itineraries() {
        let event = channelhack();
        let out = export_mitv(&event);
        let sites = out["sites"].as_array().unwrap();
        assert_eq!(sites.len(), event.sites.len());
        let sf = sites.iter().find(|s| s["id"] == "sf").unwrap();
        let zones = sf["zones"].as_array().unwrap();
        assert!(!zones.is_empty());
        let itinerary = &zones[0]["itinerary"];
        assert!(itinerary["schedule"].as_array().unwrap().len() > 2);
        assert_eq!(itinerary["schedule"][0]["status"].as_str().map(|s| s.chars().next().unwrap().is_uppercase()), Some(true));
        assert!(sf["map"]["hotspots"].as_array().unwrap().len() >= 5);
        assert!(sf["map"]["hotspots"][0]["href"].as_str().unwrap().starts_with("/sf/"));
        let show = out["show"].as_object().unwrap();
        assert_eq!(show["href"], "/channelhack");
        assert_eq!(show["slots"].as_array().unwrap().len(), event.sites.len());
        for key in ["poster", "src", "artworks"] {
            assert!(!show.contains_key(key), "{key} should not be exported");
        }
    }
}
