use chrono::{DateTime, Utc};
use ebts_core::{catalog, comfy, example, export, manifest, providers, sim, steps, EventSpec};
use serde::Serialize;
use wasm_bindgen::prelude::*;

fn out<T: Serialize>(value: &T) -> Result<JsValue, JsError> {
    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    value.serialize(&serializer).map_err(|e| JsError::new(&e.to_string()))
}

fn event_in(value: JsValue) -> Result<EventSpec, JsError> {
    serde_wasm_bindgen::from_value(value).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen]
pub fn example_event() -> Result<JsValue, JsError> {
    out(&example::channelhack())
}

#[wasm_bindgen]
pub fn steps_report(event: JsValue) -> Result<JsValue, JsError> {
    out(&steps::steps_report(&event_in(event)?, None))
}

#[wasm_bindgen]
pub fn zone_catalog() -> Result<JsValue, JsError> {
    out(&catalog::zone_catalog())
}

#[wasm_bindgen]
pub fn content_manifest(event: JsValue) -> Result<JsValue, JsError> {
    out(&manifest::content_manifest(&event_in(event)?, None))
}

#[wasm_bindgen]
pub fn sim_window(event: JsValue) -> Result<JsValue, JsError> {
    let window = sim::sim_window(&event_in(event)?).map_err(|e| JsError::new(&e.to_string()))?;
    out(&window)
}

#[wasm_bindgen]
pub fn simulate(event: JsValue, utc: String) -> Result<JsValue, JsError> {
    let at: DateTime<Utc> = utc.parse().map_err(|e: chrono::ParseError| JsError::new(&e.to_string()))?;
    let snapshot = sim::simulate(&event_in(event)?, at).map_err(|e| JsError::new(&e.to_string()))?;
    out(&snapshot)
}

#[wasm_bindgen]
pub fn conflicts(event: JsValue) -> Result<JsValue, JsError> {
    out(&sim::conflicts(&event_in(event)?))
}

#[wasm_bindgen]
pub fn export_mitv(event: JsValue) -> Result<JsValue, JsError> {
    out(&export::export_mitv(&event_in(event)?))
}

#[wasm_bindgen]
pub fn providers_default() -> Result<JsValue, JsError> {
    out(&providers::list_providers(&providers::ProviderSettings::default(), &|_| false, &|_, _| None))
}

#[wasm_bindgen]
pub fn comfy_inspect_text(raw: String) -> Result<JsValue, JsError> {
    let workflow = comfy::parse_workflow(&raw).map_err(|e| JsError::new(&e.to_string()))?;
    out(&comfy::inspect(&workflow).map_err(|e| JsError::new(&e.to_string()))?)
}
