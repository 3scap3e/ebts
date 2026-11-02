use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use ebts_core::catalog::{zone_catalog as catalog, ZoneTemplate};
use ebts_core::generate::{self, ProviderConfig, ProviderInfo};
use ebts_core::manifest::{content_manifest as manifest, sync_media as sync, ContentItem};
use ebts_core::sim::{
    conflicts as find_conflicts, sim_window as window, simulate as simulate_at, Conflict, SimWindow, Snapshot,
};
use ebts_core::steps::{steps_report as report, StepReport};
use ebts_core::{example, export, project, EventSpec};
use tauri::{Emitter, Manager};

type CmdResult<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn root_path(root: &Option<String>) -> Option<PathBuf> {
    root.as_ref().filter(|r| !r.is_empty()).map(PathBuf::from)
}

#[tauri::command]
fn example_event() -> EventSpec {
    example::channelhack()
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let target = dst.join(entry.file_name());
        if path.is_dir() {
            copy_dir_all(&path, &target)?;
        } else if !target.exists() {
            std::fs::copy(&path, &target)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn example_root(app: tauri::AppHandle) -> Option<String> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("examples").join("channelhack"));
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../examples/channelhack"));
    let source = candidates.into_iter().find(|p| p.join("event.json").is_file())?;
    let home = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .ok()?
        .join("ebts")
        .join("channelhack");
    if !home.join("event.json").is_file() {
        copy_dir_all(&source, &home).ok()?;
    }
    Some(home.canonicalize().unwrap_or(home).to_string_lossy().to_string())
}

#[tauri::command]
fn project_switch_provider(root: String, event: EventSpec, from: String, to: String) -> CmdResult<EventSpec> {
    project::switch_provider(Path::new(&root), &event, &from, &to).map_err(err)
}

#[tauri::command]
fn project_create(root: String, name: String) -> CmdResult<EventSpec> {
    project::create(Path::new(&root), &name).map_err(err)
}

#[tauri::command]
fn project_open(root: String) -> CmdResult<EventSpec> {
    project::open(Path::new(&root)).map_err(err)
}

#[tauri::command]
fn project_save(root: String, event: EventSpec) -> CmdResult<()> {
    project::save(Path::new(&root), &event).map_err(err)
}

#[tauri::command]
fn project_import_asset(root: String, src: String, dest_rel: String) -> CmdResult<String> {
    project::import_asset(Path::new(&root), Path::new(&src), &dest_rel).map_err(err)
}

#[tauri::command]
fn steps_report(event: EventSpec, root: Option<String>) -> Vec<StepReport> {
    let root = root_path(&root);
    report(&event, root.as_deref())
}

#[tauri::command]
fn zone_catalog() -> Vec<ZoneTemplate> {
    catalog()
}

#[tauri::command]
fn content_manifest(event: EventSpec, root: Option<String>) -> Vec<ContentItem> {
    let root = root_path(&root);
    manifest(&event, root.as_deref())
}

#[tauri::command]
fn sync_media(event: EventSpec, root: String) -> EventSpec {
    sync(&event, Path::new(&root))
}

#[tauri::command]
fn sim_window(event: EventSpec) -> CmdResult<SimWindow> {
    window(&event).map_err(err)
}

#[tauri::command]
fn simulate(event: EventSpec, utc: String) -> CmdResult<Snapshot> {
    let at: DateTime<Utc> = utc.parse::<DateTime<Utc>>().map_err(err)?;
    simulate_at(&event, at).map_err(err)
}

#[tauri::command]
fn conflicts(event: EventSpec) -> Vec<Conflict> {
    find_conflicts(&event)
}

#[tauri::command]
fn export_mitv(event: EventSpec) -> serde_json::Value {
    export::export_mitv(&event)
}

#[tauri::command]
fn export_write(root: String, event: EventSpec, dest: String) -> CmdResult<String> {
    let value = export::export_mitv(&event);
    project::write_json(Path::new(&root), Path::new(&dest), &value).map_err(err)
}

#[tauri::command]
fn providers_list(root: Option<String>) -> CmdResult<Vec<ProviderInfo>> {
    let root = root_path(&root);
    let settings = generate::load_settings(root.as_deref()).map_err(err)?;
    Ok(generate::providers(root.as_deref(), &settings))
}

#[tauri::command]
async fn comfy_inspect(root: Option<String>, path: String, base_url: Option<String>) -> CmdResult<Vec<ebts_core::comfy::NodeInfo>> {
    tauri::async_runtime::spawn_blocking(move || {
        let file = Path::new(&path);
        let abs = if file.is_absolute() {
            file.to_path_buf()
        } else {
            root_path(&root).map(|r| r.join(file)).unwrap_or_else(|| file.to_path_buf())
        };
        let raw = std::fs::read_to_string(&abs).map_err(|e| ebts_core::CoreError::Other(format!("{}: {e}", abs.display())))?;
        let workflow = ebts_core::comfy::parse_workflow(&raw)?;
        let info = base_url
            .as_deref()
            .filter(|u| !u.trim().is_empty())
            .and_then(|u| comfy_client(u).object_info().ok());
        ebts_core::comfy::inspect_with(&workflow, info.as_ref())
    })
    .await
    .map_err(err)?
    .map_err(err)
}

fn comfy_client(base_url: &str) -> ebts_core::comfy::ComfyClient {
    ebts_core::comfy::ComfyClient { base_url: base_url.to_string(), timeout: std::time::Duration::from_secs(60) }
}

#[tauri::command]
async fn comfy_workflows(base_url: String) -> CmdResult<Vec<String>> {
    tauri::async_runtime::spawn_blocking(move || comfy_client(&base_url).list_workflows())
        .await
        .map_err(err)?
        .map_err(err)
}

#[tauri::command]
async fn comfy_workflow_import(root: String, base_url: String, name: String) -> CmdResult<ebts_core::comfy::ComfyImport> {
    tauri::async_runtime::spawn_blocking(move || {
        let (workflow, converted, info) = comfy_client(&base_url).import_workflow(&name)?;
        let rel = ebts_core::comfy::workflow_file_name(&name);
        project::write_json(Path::new(&root), Path::new(&rel), &workflow)?;
        let nodes = ebts_core::comfy::inspect_with(&workflow, Some(&info))?;
        Ok::<_, ebts_core::CoreError>(ebts_core::comfy::ComfyImport { path: rel, converted, nodes })
    })
    .await
    .map_err(err)?
    .map_err(err)
}

#[tauri::command]
fn comfy_examples() -> Vec<ebts_core::comfy::ComfyExample> {
    ebts_core::comfy::examples()
}

#[tauri::command]
async fn comfy_example_install(root: String, id: String, base_url: Option<String>) -> CmdResult<ebts_core::comfy::ComfyImport> {
    tauri::async_runtime::spawn_blocking(move || {
        let workflow = ebts_core::comfy::example_workflow(&id).ok_or_else(|| ebts_core::CoreError::Other(format!("unknown example {id}")))?;
        let rel = ebts_core::comfy::example_path(&id);
        project::write_json(Path::new(&root), Path::new(&rel), &workflow)?;
        let info = base_url.as_deref().filter(|u| !u.trim().is_empty()).and_then(|u| comfy_client(u).object_info().ok());
        let nodes = ebts_core::comfy::inspect_with(&workflow, info.as_ref())?;
        Ok::<_, ebts_core::CoreError>(ebts_core::comfy::ComfyImport { path: rel, converted: false, nodes })
    })
    .await
    .map_err(err)?
    .map_err(err)
}

#[tauri::command]
async fn comfy_models_status(base_url: String, id: String) -> CmdResult<Vec<ebts_core::comfy::ModelStatus>> {
    tauri::async_runtime::spawn_blocking(move || {
        let example = ebts_core::comfy::example(&id).ok_or_else(|| ebts_core::CoreError::Other(format!("unknown example {id}")))?;
        Ok::<_, ebts_core::CoreError>(comfy_client(&base_url).models_status(&example))
    })
    .await
    .map_err(err)?
    .map_err(err)
}

#[derive(Clone, serde::Serialize)]
struct ModelScript {
    path: String,
    script: String,
}

#[tauri::command]
fn comfy_models_script(root: String, id: String) -> CmdResult<ModelScript> {
    let example = ebts_core::comfy::example(&id).ok_or_else(|| format!("unknown example {id}"))?;
    let script = ebts_core::comfy::download_script(&example);
    let rel = format!("workflows/{id}-models.sh");
    let abs = Path::new(&root).join(&rel);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent).map_err(err)?;
    }
    std::fs::write(&abs, &script).map_err(err)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&abs, std::fs::Permissions::from_mode(0o755));
    }
    Ok(ModelScript { path: rel, script })
}

#[derive(Clone, serde::Serialize)]
struct ModelProgress {
    id: String,
    file: String,
    done: u64,
    total: Option<u64>,
}

#[tauri::command]
async fn comfy_models_download(
    app: tauri::AppHandle,
    id: String,
    models_dir: String,
    base_url: Option<String>,
) -> CmdResult<Vec<ebts_core::comfy::ModelStatus>> {
    tauri::async_runtime::spawn_blocking(move || {
        let example = ebts_core::comfy::example(&id).ok_or_else(|| ebts_core::CoreError::Other(format!("unknown example {id}")))?;
        let root = Path::new(&models_dir);
        if !root.is_dir() {
            return Err(ebts_core::CoreError::Other(format!("{} is not a folder", root.display())));
        }
        let on_server = base_url
            .as_deref()
            .filter(|u| !u.trim().is_empty())
            .map(|u| comfy_client(u).models_status(&example))
            .unwrap_or_default();
        for model in &example.models {
            let dest = root.join(&model.folder).join(&model.file);
            let local_ok = dest.metadata().map(|m| m.len() == model.bytes).unwrap_or(false);
            let server_ok = on_server.iter().any(|s| s.file == model.file && s.present == Some(true));
            if local_ok || server_ok {
                continue;
            }
            let (app, id, file) = (app.clone(), id.clone(), model.file.clone());
            generate::download_file(&model.url, &dest, &|done, total| {
                let _ = app.emit("model-progress", ModelProgress { id: id.clone(), file: file.clone(), done, total });
            })?;
        }
        Ok::<_, ebts_core::CoreError>(ebts_core::comfy::models_status(&example, &|folder, file| {
            let local = root.join(folder).join(file).is_file();
            let server = on_server.iter().find(|s| s.file == file && s.folder == folder).and_then(|s| s.present);
            Some(local || server == Some(true))
        }))
    })
    .await
    .map_err(err)?
    .map_err(err)
}

#[tauri::command]
async fn reactor_check(root: Option<String>) -> CmdResult<generate::ReactorStatus> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = root_path(&root);
        let settings = generate::load_settings(root.as_deref())?;
        let config = settings.config_for("reactor");
        let key = config.key_env().and_then(generate::resolve_key);
        let (api_url, seconds) = match &config {
            ProviderConfig::Reactor { api_url, seconds, .. } => (api_url.clone(), *seconds),
            _ => (generate::DEFAULT_REACTOR_API.to_string(), generate::DEFAULT_REACTOR_SECONDS),
        };
        Ok::<_, ebts_core::CoreError>(generate::reactor_check(&api_url, key.as_deref(), seconds))
    })
    .await
    .map_err(err)?
    .map_err(err)
}

#[tauri::command]
fn secret_store(name: String, value: String) -> CmdResult<bool> {
    generate::store_key(&name, &value).map_err(err)?;
    Ok(generate::resolve_key(&name).is_some())
}

#[tauri::command]
fn provider_configure(
    root: Option<String>,
    config: ProviderConfig,
    activate: bool,
    api_key: Option<String>,
) -> CmdResult<Vec<ProviderInfo>> {
    let root = root_path(&root);
    let mut settings = generate::load_settings(root.as_deref()).map_err(err)?;
    if let (Some(key), Some(env)) = (api_key.as_deref(), config.key_env()) {
        generate::store_key(env, key).map_err(err)?;
    }
    settings.set(config, activate);
    generate::save_settings(root.as_deref(), &settings).map_err(err)?;
    Ok(generate::providers(root.as_deref(), &settings))
}

#[tauri::command]
fn secret_read(name: String) -> Option<String> {
    generate::resolve_key(&name)
}

#[derive(Clone, serde::Serialize)]
struct ProgressEvent {
    item_id: String,
    step: u32,
    total: u32,
    detail: String,
}

type CancelFlags = std::sync::Mutex<std::collections::HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>>;

fn cancel_flags() -> &'static CancelFlags {
    static FLAGS: std::sync::OnceLock<CancelFlags> = std::sync::OnceLock::new();
    FLAGS.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

const GENERATION_LIMIT_SECONDS: u64 = 15 * 60;
const GENERATION_LOG: &str = "generation.log";

fn log_line(root: &Path, line: &str) {
    use std::io::Write;
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(root.join(GENERATION_LOG)) {
        let _ = writeln!(file, "{} {line}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"));
    }
}

#[tauri::command]
async fn generate_item(app: tauri::AppHandle, root: String, event: EventSpec, item_id: String) -> CmdResult<generate::Generated> {
    let flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    cancel_flags().lock().map_err(|e| e.to_string())?.insert(item_id.clone(), flag.clone());
    let worker_flag = flag.clone();
    let worker_id = item_id.clone();
    let log_root = PathBuf::from(&root);
    let started = std::time::Instant::now();
    let work = tauri::async_runtime::spawn_blocking(move || {
        let root = Path::new(&root);
        let settings = generate::load_settings(Some(root))?;
        let config = settings.active_config();
        log_line(root, &format!("{worker_id} · {} · start", config.label()));
        let id = worker_id.clone();
        let phase_root = root.to_path_buf();
        let last_phase = std::sync::Mutex::new(String::new());
        let report = move |p: generate::Progress| {
            let phase = p.detail.split(" · ").next().unwrap_or("").to_string();
            if let Ok(mut last) = last_phase.lock() {
                if !phase.is_empty() && *last != phase {
                    log_line(&phase_root, &format!("{id} · {phase}"));
                    *last = phase;
                }
            }
            let _ = app.emit("generate-progress", ProgressEvent { item_id: id.clone(), step: p.step, total: p.total, detail: p.detail });
        };
        let outcome = generate::generate_candidate(root, &event, &worker_id, &config, Some(&report), Some(&worker_flag));
        match &outcome {
            Ok(made) => log_line(root, &format!("{worker_id} · saved {}", made.candidate)),
            Err(e) => log_line(root, &format!("{worker_id} · failed: {e}")),
        }
        outcome
    });
    let outcome = match tokio::time::timeout(std::time::Duration::from_secs(GENERATION_LIMIT_SECONDS), work).await {
        Ok(joined) => joined.map_err(err).and_then(|r| r.map_err(err)),
        Err(_) => {
            flag.store(true, std::sync::atomic::Ordering::Relaxed);
            log_line(&log_root, &format!("{item_id} · stopped by the app after {} minutes", GENERATION_LIMIT_SECONDS / 60));
            Err(format!("Stopped after {} minutes without a result; the provider was asked to cancel.", GENERATION_LIMIT_SECONDS / 60))
        }
    };
    log_line(&log_root, &format!("{item_id} · {} s elapsed", started.elapsed().as_secs()));
    if let Ok(mut flags) = cancel_flags().lock() {
        flags.remove(&item_id);
    }
    outcome
}

#[tauri::command]
fn generate_cancel(item_id: String) -> bool {
    match cancel_flags().lock() {
        Ok(flags) => flags.get(&item_id).map(|f| f.store(true, std::sync::atomic::Ordering::Relaxed)).is_some(),
        Err(_) => false,
    }
}

#[tauri::command]
fn generate_accept(root: String, candidate: String) -> CmdResult<String> {
    generate::accept_candidate(Path::new(&root), &candidate).map_err(err)
}

#[tauri::command]
fn generate_discard(root: String, candidate: String) -> CmdResult<()> {
    generate::discard_candidate(Path::new(&root), &candidate).map_err(err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let _ = &app;
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.with_webview(|webview| unsafe {
                    let view = webview.inner() as *mut objc2::runtime::AnyObject;
                    if let Some(view) = view.as_ref() {
                        let _: () = objc2::msg_send![view, setAllowsMagnification: true];
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            example_event,
            example_root,
            project_create,
            project_open,
            project_save,
            project_switch_provider,
            project_import_asset,
            steps_report,
            zone_catalog,
            content_manifest,
            sync_media,
            sim_window,
            simulate,
            conflicts,
            export_mitv,
            export_write,
            providers_list,
            provider_configure,
            generate_item,
            generate_cancel,
            generate_accept,
            generate_discard,
            comfy_inspect,
            comfy_workflows,
            comfy_workflow_import,
            comfy_examples,
            comfy_example_install,
            comfy_models_status,
            comfy_models_script,
            comfy_models_download,
            reactor_check,
            secret_store,
            secret_read,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ebts");
}
