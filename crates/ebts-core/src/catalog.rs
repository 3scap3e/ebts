use serde::{Deserialize, Serialize};

use crate::model::{Rhythm, ZoneFormat};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ZoneTemplate {
    pub format: ZoneFormat,
    pub label: String,
    pub id_prefix: String,
    pub who: String,
    pub what: String,
    pub rhythm: Rhythm,
    pub description: String,
    pub prompt_subject: String,
}

fn template(
    format: ZoneFormat,
    label: &str,
    id_prefix: &str,
    who: &str,
    what: &str,
    rhythm: Rhythm,
    description: &str,
    prompt_subject: &str,
) -> ZoneTemplate {
    ZoneTemplate {
        format,
        label: label.to_string(),
        id_prefix: id_prefix.to_string(),
        who: who.to_string(),
        what: what.to_string(),
        rhythm,
        description: description.to_string(),
        prompt_subject: prompt_subject.to_string(),
    }
}

pub fn zone_catalog() -> Vec<ZoneTemplate> {
    vec![
        template(
            ZoneFormat::Salon,
            "Salon",
            "SAL",
            "Mixed collaborators",
            "Informal intellectual exchange across a few tables",
            Rhythm::OpenPlusScheduled,
            "Open conversation blocks alternating with scheduled guest conversations on the event themes.",
            "A warm salon corner with low sofas, plants and small tables where small groups talk",
        ),
        template(
            ZoneFormat::DemoStation,
            "Demo Station",
            "DEM",
            "Mixed artists / collaborators",
            "Interactive demos and installations",
            Rhythm::Continuous,
            "A cluster of stations that run all day; attendees drop in any time.",
            "A dense cluster of demo tables with monitors, cables, small robots and people leaning in to try things",
        ),
        template(
            ZoneFormat::PerformanceZone,
            "Performance Zone",
            "PRF",
            "Mixed artists / performers",
            "Scheduled live performances and presentations",
            Rhythm::Scheduled,
            "Timed sets with short interstitials, opening presentation and a closing cross-site piece.",
            "A stage with a large video wall, stage lights and a standing crowd watching a live performance",
        ),
        template(
            ZoneFormat::ScreeningRoom,
            "Screening Room",
            "SCR",
            "Mixed artists",
            "Continuous moving-image screenings and timed showcases",
            Rhythm::Loops,
            "Loops between timed blocks so the room is never dark.",
            "A dark screening room with rows of chairs facing a bright projection screen",
        ),
        template(
            ZoneFormat::MingleSpace,
            "Mingle Space",
            "MNG",
            "All attendees",
            "Food, drink, informal gathering and spillover",
            Rhythm::Continuous,
            "Food service and social density all day with a few waves.",
            "A bright social area with a food counter, standing tables, drinks and people chatting",
        ),
        template(
            ZoneFormat::TinkerSpace,
            "Tinker Space",
            "TNK",
            "Mixed builders / creative technologists",
            "Open work tables, live coding and hardware",
            Rhythm::OpenPlusScheduled,
            "Open tables all day with timed workshops on the event themes.",
            "A workshop with long tables covered in laptops, soldering irons, parts bins and people building together",
        ),
        template(
            ZoneFormat::VideoWall,
            "Video Wall",
            "VW",
            "Mixed presenters / collaborators",
            "Presentations, screenings and remote feeds",
            Rhythm::Scheduled,
            "The big screen: opening, live windows into other sites, feeds and the shared finale.",
            "A huge LED video wall showing a live feed, with a small crowd in front and cables along the floor",
        ),
        template(
            ZoneFormat::SpatialInstallation,
            "Spatial Installation",
            "INS",
            "Mixed artists / collaborators",
            "Projection, optical, kinetic and refractory installations",
            Rhythm::Continuous,
            "An installation that runs all day with timed activations that change the room state.",
            "A large architectural installation with projection mapping on long surfaces and hanging kinetic elements",
        ),
        template(
            ZoneFormat::TelepresenceZone,
            "Telepresence Zone",
            "TEL",
            "Collaborators across sites",
            "Live portal to the other sites and distributed performance",
            Rhythm::Continuous,
            "An ambient portal all day plus scheduled shared windows with the other sites.",
            "A telepresence portal: a tall screen showing another venue live, a camera rig and people waving across",
        ),
        template(
            ZoneFormat::Refractory,
            "Refractory / Analog",
            "REF",
            "Mixed artists / builders",
            "Camera obscura, optical and low-connectivity work",
            Rhythm::Continuous,
            "A deliberately analog room with radio-dark and local-only intervals.",
            "A dim analog room with a camera obscura image on the wall, optical lenses and no screens",
        ),
        template(
            ZoneFormat::BackOfHouse,
            "Back of House",
            "BOH",
            "Production / artists / crew",
            "Artist staging, equipment holding and technical control",
            Rhythm::CrewOnly,
            "Load-in before doors, staging while open, strike after close.",
            "A backstage area with flight cases, charging stations, a tech desk and crew in work clothes",
        ),
        template(
            ZoneFormat::Custom,
            "Custom Zone",
            "ZON",
            "Mixed attendees",
            "Describe what happens here",
            Rhythm::OpenPlusScheduled,
            "A blank zone with sessions on the event themes and open blocks between them.",
            "An event room described by its own what and who",
        ),
    ]
}

pub fn template_for(format: ZoneFormat) -> ZoneTemplate {
    zone_catalog()
        .into_iter()
        .find(|t| t.format == format)
        .unwrap_or_else(|| zone_catalog().pop().expect("catalog has entries"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_covers_every_format() {
        let catalog = zone_catalog();
        for format in ZoneFormat::all() {
            assert!(catalog.iter().any(|t| t.format == format), "{format:?} missing");
        }
        let prefixes: std::collections::HashSet<_> = catalog.iter().map(|t| t.id_prefix.clone()).collect();
        assert_eq!(prefixes.len(), catalog.len());
    }
}
