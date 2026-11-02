import type { ContentItem } from "./content";

export type ProviderId = "comfyui" | "reactor";

export type ComfyValue = string | number | boolean;

export interface ComfyNodes {
  prompt: string[];
  negative: string[];
  images: string[];
  output: string | null;
  loras: string[];
  values: Record<string, Record<string, ComfyValue>>;
}

export interface ComfyField {
  key: string;
  value: ComfyValue | null;
  kind: "combo" | "number" | "bool" | "text";
  options: string[];
}

export interface ComfyuiConfig {
  kind: "comfyui";
  base_url: string;
  image_workflow: string;
  image_nodes: ComfyNodes;
  video_workflow: string;
  video_nodes: ComfyNodes;
  timeout_seconds: number;
  models_dir: string;
  seconds: number;
}

export interface ExampleModel {
  file: string;
  folder: string;
  bytes: number;
  url: string;
}

export interface ExampleNodePack {
  name: string;
  url: string;
  classes: string[];
}

export interface ComfyExample {
  id: string;
  title: string;
  kind: "image" | "video";
  file: string;
  summary: string;
  nodes: ExampleNodePack[];
  models: ExampleModel[];
}

export interface ModelStatus {
  file: string;
  folder: string;
  bytes: number;
  url: string;
  present: boolean | null;
}

export interface ModelScript {
  path: string;
  script: string;
}

export interface ModelProgress {
  id: string;
  file: string;
  done: number;
  total: number | null;
}

export type ReactorImageRole = "" | "first" | "last" | "both";

export interface ReactorConfig {
  kind: "reactor";
  api_url: string;
  api_key_env: string;
  seconds: number;
  image_role: string;
}

export type ProviderConfig = ComfyuiConfig | ReactorConfig;

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  config: ProviderConfig;
  active: boolean;
  needs_key: boolean;
  key_env: string | null;
  key_present: boolean;
  supports_image: boolean;
  supports_video: boolean;
  image_init_slots: number;
  video_init_slots: number;
  offline: boolean;
  image_sampler: SamplerDefaults | null;
  video_sampler: SamplerDefaults | null;
}

export interface SamplerDefaults {
  steps: number | null;
  cfg: number | null;
  denoise: number | null;
}

export interface ComfyNodeInfo {
  id: string;
  class_type: string;
  title: string;
  text_keys: string[];
  image_keys: string[];
  has_size: boolean;
  has_seed: boolean;
  saves: boolean;
  lora: boolean;
  sampler: boolean;
  fields: ComfyField[];
  suggested: string | null;
}

export interface Generated {
  item: ContentItem;
  candidate: string;
}

export interface ProgressEvent {
  item_id: string;
  step: number;
  total: number;
  detail: string;
}

export interface ComfyImport {
  path: string;
  converted: boolean;
  nodes: ComfyNodeInfo[];
}

export interface ReactorStatus {
  valid: boolean;
  message: string;
  model: string;
  price_per_second_usd: string | null;
  price_per_clip_usd: string | null;
}

export type GenerateStatus = "queued" | "working" | "done" | "failed";

export interface GenerateJob {
  status: GenerateStatus;
  error: string | null;
  step: number | null;
  total: number | null;
  detail: string | null;
  candidate: string | null;
  accepted: number;
}

export type GenerateJobs = Record<string, GenerateJob>;

export interface GenerateProgress {
  total: number;
  done: number;
  failed: number;
  working: string | null;
  running: boolean;
}

export interface GenerationState {
  jobs: GenerateJobs;
  progress: GenerateProgress;
  start: (items: ContentItem[]) => void;
  accept: (item: ContentItem, candidate: string) => Promise<void>;
  discard: (item: ContentItem, candidate: string) => Promise<void>;
  abort: (item: ContentItem) => Promise<void>;
  cancel: () => void;
  clear: () => void;
}

export interface ProvidersState {
  providers: ProviderInfo[];
  active: ProviderInfo | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => Promise<void>;
  configure: (config: ProviderConfig, activate: boolean, apiKey: string | null) => Promise<void>;
}
