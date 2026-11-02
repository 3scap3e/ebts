use crate::model::EventSpec;

pub const CHANNELHACK_JSON: &str = include_str!("../../../examples/channelhack/event.json");

pub fn channelhack() -> EventSpec {
    serde_json::from_str(CHANNELHACK_JSON).expect("bundled example event is valid")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn example_parses_and_roundtrips() {
        let event = channelhack();
        assert_eq!(event.id, "channelhack");
        assert!(event.sites.len() >= 2);
        assert!(event.sites.iter().all(|s| s.zones.iter().all(|z| !z.schedule.is_empty())));
        let raw = serde_json::to_string(&event).unwrap();
        let back: EventSpec = serde_json::from_str(&raw).unwrap();
        assert_eq!(back, event);
    }

    #[test]
    fn example_hotspots_point_at_real_targets() {
        let event = channelhack();
        for hotspot in &event.map.hotspots {
            assert!(event.site(&hotspot.target).is_some(), "event map -> {}", hotspot.target);
        }
        for site in &event.sites {
            for hotspot in site.map.hotspots.iter().chain(site.map.widget.iter().flat_map(|w| w.hotspots.iter())) {
                assert!(site.zone(&hotspot.target).is_some(), "{} -> {}", site.id, hotspot.target);
            }
        }
    }
}
