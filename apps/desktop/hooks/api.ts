import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { EventSpec, ZoneTemplate } from "@/types/event";
import type { StepReport } from "@/types/steps";
import type { ContentItem } from "@/types/content";
import type { Conflict, SimWindow, Snapshot } from "@/types/sim";
import type {
  ComfyExample,
  ComfyImport,
  ComfyNodeInfo,
  Generated,
  ModelScript,
  ModelStatus,
  ProviderConfig,
  ProviderInfo,
  ReactorStatus,
} from "@/types/generate";
import { call, isTauri } from "@/hooks/backend";

export { isTauri };

export const api = {
  exampleEvent: () => call<EventSpec>("example_event"),
  projectCreate: (root: string, name: string) =>
    call<EventSpec>("project_create", { root, name }),
  projectOpen: (root: string) => call<EventSpec>("project_open", { root }),
  projectSave: (root: string, event: EventSpec) =>
    call<void>("project_save", { root, event }),
  projectSwitchProvider: (root: string, event: EventSpec, from: string, to: string) =>
    call<EventSpec>("project_switch_provider", { root, event, from, to }),
  projectImportAsset: (root: string, src: string, destRel: string) =>
    call<string>("project_import_asset", { root, src, destRel }),
  stepsReport: (event: EventSpec, root: string | null) =>
    call<StepReport[]>("steps_report", { event, root }),
  zoneCatalog: () => call<ZoneTemplate[]>("zone_catalog"),
  contentManifest: (event: EventSpec, root: string | null) =>
    call<ContentItem[]>("content_manifest", { event, root }),
  syncMedia: (event: EventSpec, root: string) =>
    call<EventSpec>("sync_media", { event, root }),
  simWindow: (event: EventSpec) => call<SimWindow>("sim_window", { event }),
  simulate: (event: EventSpec, utc: string) =>
    call<Snapshot>("simulate", { event, utc }),
  conflicts: (event: EventSpec) => call<Conflict[]>("conflicts", { event }),
  exportMitv: (event: EventSpec) => call<unknown>("export_mitv", { event }),
  exportWrite: (root: string, event: EventSpec, dest: string) =>
    call<string>("export_write", { root, event, dest }),
  providersList: (root: string | null) =>
    call<ProviderInfo[]>("providers_list", { root }),
  comfyInspect: (root: string | null, path: string, baseUrl: string | null) =>
    call<ComfyNodeInfo[]>("comfy_inspect", { root, path, baseUrl }),
  comfyInspectText: (raw: string) =>
    call<ComfyNodeInfo[]>("comfy_inspect_text", { raw }),
  comfyWorkflows: (baseUrl: string) =>
    call<string[]>("comfy_workflows", { baseUrl }),
  comfyWorkflowImport: (root: string, baseUrl: string, name: string) =>
    call<ComfyImport>("comfy_workflow_import", { root, baseUrl, name }),
  comfyExamples: () => call<ComfyExample[]>("comfy_examples"),
  comfyExampleInstall: (root: string, id: string, baseUrl: string | null) =>
    call<ComfyImport>("comfy_example_install", { root, id, baseUrl }),
  comfyModelsStatus: (baseUrl: string, id: string) =>
    call<ModelStatus[]>("comfy_models_status", { baseUrl, id }),
  comfyModelsScript: (root: string, id: string) =>
    call<ModelScript>("comfy_models_script", { root, id }),
  comfyModelsDownload: (id: string, modelsDir: string, baseUrl: string | null) =>
    call<ModelStatus[]>("comfy_models_download", { id, modelsDir, baseUrl }),
  reactorCheck: (root: string | null) =>
    call<ReactorStatus>("reactor_check", { root }),
  secretStore: (name: string, value: string) =>
    call<boolean>("secret_store", { name, value }),
  secretRead: (name: string) => call<string | null>("secret_read", { name }),
  providerConfigure: (root: string | null, config: ProviderConfig, activate: boolean, apiKey: string | null) =>
    call<ProviderInfo[]>("provider_configure", { root, config, activate, apiKey }),
  generateItem: (root: string, event: EventSpec, itemId: string) =>
    call<Generated>("generate_item", { root, event, itemId }),
  generateCancel: (itemId: string) => call<boolean>("generate_cancel", { itemId }),
  generateAccept: (root: string, candidate: string) =>
    call<string>("generate_accept", { root, candidate }),
  generateDiscard: (root: string, candidate: string) =>
    call<void>("generate_discard", { root, candidate }),
};

export const exampleRoot = async (): Promise<string | null> => {
  if (!isTauri()) return "/examples/channelhack";
  return call<string | null>("example_root");
};

export const assetUrl = (root: string | null, rel: string | null): string | null => {
  if (!root || !rel) return null;
  const joined = rel.startsWith("/") ? rel : `${root.replace(/\/$/, "")}/${rel}`;
  return isTauri() ? convertFileSrc(joined) : joined;
};

export const pickFolder = async (): Promise<string | null> => {
  if (!isTauri()) throw new Error("Picking a folder needs the desktop app");
  const picked = await open({ directory: true, multiple: false });
  return typeof picked === "string" ? picked : null;
};

export const pickFile = async (
  extensions: string[],
  label = "Media",
): Promise<string | null> => {
  if (!isTauri()) throw new Error("Picking a file needs the desktop app");
  const picked = await open({
    directory: false,
    multiple: false,
    filters: [{ name: label, extensions }],
  });
  return typeof picked === "string" ? picked : null;
};
