use std::path::{Path, PathBuf};
use std::process::ExitCode;

use chrono::{DateTime, NaiveTime, Utc};
use ebts_core::{export, manifest, project, sim, steps, EventSpec, Hm};

const USAGE: &str = "ebts <command> <project-folder> [options]

commands:
  check <folder>              checklist of every step (JSON)
  manifest <folder>           every asset to produce: path, exists, size, prompt (JSON)
  conflicts <folder>          gaps, double bookings, broken links (JSON)
  simulate <folder> <HH:MM>   what is live at that UTC time on the event date (JSON)
  export <folder>             mitv-shaped config (JSON)
  agents <folder>             write AGENTS.md and CLAUDE.md into the folder";

fn load(folder: &str) -> Result<(PathBuf, EventSpec), String> {
    let root = PathBuf::from(folder);
    let event = project::open(&root).map_err(|e| e.to_string())?;
    Ok((root, event))
}

fn print_json<T: serde::Serialize>(value: &T) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    println!("{text}");
    Ok(())
}

fn utc_at(event: &EventSpec, hm: &str) -> Result<DateTime<Utc>, String> {
    if let Ok(parsed) = hm.parse::<DateTime<Utc>>() {
        return Ok(parsed);
    }
    let time = Hm::parse(hm).map_err(|e| e.to_string())?;
    let naive = NaiveTime::from_hms_opt(u32::from(time.hours() % 24), u32::from(time.minutes()), 0)
        .ok_or_else(|| format!("invalid time {hm}"))?;
    let days = i64::from(time.hours() / 24);
    let date = event.date + chrono::Duration::days(days);
    Ok(DateTime::<Utc>::from_naive_utc_and_offset(date.and_time(naive), Utc))
}

fn run(args: &[String]) -> Result<(), String> {
    let command = args.first().map(String::as_str).unwrap_or("");
    let folder = args.get(1).ok_or_else(|| USAGE.to_string())?;
    match command {
        "check" => {
            let (root, event) = load(folder)?;
            print_json(&steps::steps_report(&event, Some(root.as_path())))
        }
        "manifest" => {
            let (root, event) = load(folder)?;
            print_json(&manifest::content_manifest(&event, Some(root.as_path())))
        }
        "conflicts" => {
            let (_, event) = load(folder)?;
            print_json(&sim::conflicts(&event))
        }
        "simulate" => {
            let (_, event) = load(folder)?;
            let at = args.get(2).ok_or_else(|| "simulate needs a UTC time like 18:30".to_string())?;
            let snapshot = sim::simulate(&event, utc_at(&event, at)?).map_err(|e| e.to_string())?;
            print_json(&snapshot)
        }
        "export" => {
            let (_, event) = load(folder)?;
            print_json(&export::export_mitv(&event))
        }
        "agents" => {
            project::write_agent_guide(Path::new(folder)).map_err(|e| e.to_string())?;
            println!("wrote AGENTS.md and CLAUDE.md in {folder}");
            Ok(())
        }
        _ => Err(USAGE.to_string()),
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}
