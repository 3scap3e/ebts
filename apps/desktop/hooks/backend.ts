import { invoke } from "@tauri-apps/api/core";

export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type WasmModule = typeof import("@/wasm-pkg/ebts_wasm");

let wasmModule: Promise<WasmModule> | null = null;

const loadWasm = (): Promise<WasmModule> => {
  if (!wasmModule) {
    wasmModule = import("@/wasm-pkg/ebts_wasm").then(async (mod) => {
      await mod.default();
      return mod;
    });
  }
  return wasmModule;
};

const desktopOnly = new Set([
  "example_root",
  "project_create",
  "project_open",
  "project_save",
  "project_switch_provider",
  "project_import_asset",
  "sync_media",
  "export_write",
  "provider_configure",
  "generate_item",
  "generate_cancel",
  "generate_accept",
  "generate_discard",
  "comfy_inspect",
  "comfy_workflows",
  "comfy_workflow_import",
  "comfy_examples",
  "comfy_example_install",
  "comfy_models_status",
  "comfy_models_script",
  "comfy_models_download",
  "reactor_check",
  "secret_store",
  "secret_read",
]);

export const call = async <T>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
  if (isTauri()) return invoke<T>(command, args);
  if (desktopOnly.has(command)) {
    throw new Error(`${command.replace(/_/g, " ")} needs the desktop app (files on disk)`);
  }
  const mod = await loadWasm();
  const event = args.event;
  switch (command) {
    case "example_event":
      return mod.example_event() as T;
    case "steps_report":
      return mod.steps_report(event) as T;
    case "zone_catalog":
      return mod.zone_catalog() as T;
    case "content_manifest":
      return mod.content_manifest(event) as T;
    case "sim_window":
      return mod.sim_window(event) as T;
    case "simulate":
      return mod.simulate(event, String(args.utc)) as T;
    case "conflicts":
      return mod.conflicts(event) as T;
    case "export_mitv":
      return mod.export_mitv(event) as T;
    case "providers_list":
      return mod.providers_default() as T;
    case "comfy_inspect_text":
      return mod.comfy_inspect_text(String(args.raw)) as T;
    default:
      throw new Error(`unknown command ${command}`);
  }
};
