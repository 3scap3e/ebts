import type { ContentItem } from "@/types/content";
import type { ComfyNodeInfo, ComfyNodes, ComfyValue, GenerateJob, GenerateJobs, GenerateProgress, GenerateStatus, ProviderConfig, ProviderInfo, SamplerDefaults } from "@/types/generate";
import { isVideoItem } from "@/hooks/contentEdit";

export const canProviderProduce = (provider: ProviderInfo | null, item: ContentItem): boolean =>
  provider !== null && (isVideoItem(item) ? provider.supports_video : provider.supports_image);

export const blockedReason = (provider: ProviderInfo | null, item: ContentItem): string | undefined => {
  if (provider === null) return "No active provider";
  if (canProviderProduce(provider, item)) return undefined;
  if (provider.id === "comfyui") return isVideoItem(item) ? "ComfyUI has no video workflow" : "ComfyUI has no image workflow";
  if (provider.id === "reactor") return "Reactor renders video only";
  return isVideoItem(item) ? "The active provider renders images only" : "The active provider renders video only";
};

export const initSlots = (provider: ProviderInfo | null, item: ContentItem): number =>
  provider === null ? 0 : isVideoItem(item) ? provider.video_init_slots : provider.image_init_slots;

export const samplerDefaults = (provider: ProviderInfo | null, item: ContentItem): SamplerDefaults | null =>
  provider === null || provider.id !== "comfyui" ? null : isVideoItem(item) ? provider.video_sampler : provider.image_sampler;

export const jobWith = (status: GenerateStatus, patch: Partial<GenerateJob> = {}): GenerateJob => ({
  status,
  error: null,
  step: null,
  total: null,
  detail: null,
  candidate: null,
  accepted: 0,
  ...patch,
});

export const workingLabel = (job: GenerateJob | null): string => {
  if (!job || job.status !== "working") return "Working…";
  const parts = [job.total ? `${job.step ?? 0}/${job.total}` : null, job.detail || null].filter(Boolean);
  return parts.length ? `Working… ${parts.join(" · ")}` : "Working…";
};

export const emptyProgress = (): GenerateProgress => ({
  total: 0,
  done: 0,
  failed: 0,
  working: null,
  running: false,
});

export const summarizeJobs = (jobs: GenerateJobs, running: boolean): GenerateProgress => {
  const all = Object.entries(jobs);
  const working = all.find(([, job]) => job.status === "working");
  return {
    total: all.length,
    done: all.filter(([, job]) => job.status === "done").length,
    failed: all.filter(([, job]) => job.status === "failed").length,
    working: working ? working[0] : null,
    running,
  };
};

export const replaceItem = (items: ContentItem[], next: ContentItem): ContentItem[] =>
  items.map((item) => (item.id === next.id ? next : item));

const finiteOr = (value: string, fallback: number): number => {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) ? n : fallback;
};

export const patchConfig = (config: ProviderConfig, field: string, value: string): ProviderConfig => {
  switch (config.kind) {
    case "comfyui":
      if (field === "timeout_seconds") return { ...config, timeout_seconds: Math.max(1, Math.round(finiteOr(value, config.timeout_seconds))) };
      if (field === "seconds") return { ...config, seconds: Math.max(1, finiteOr(value, config.seconds)) };
      return { ...config, [field]: value };
    case "reactor":
      return field === "seconds" ? { ...config, seconds: finiteOr(value, config.seconds) } : { ...config, [field]: value };
  }
};

export const emptyNodes = (): ComfyNodes => ({ prompt: [], negative: [], images: [], output: null, loras: [], values: {} });

export const nodesEmpty = (nodes: ComfyNodes): boolean =>
  nodes.prompt.length === 0 &&
  nodes.negative.length === 0 &&
  nodes.images.length === 0 &&
  nodes.output === null &&
  Object.keys(nodes.values ?? {}).length === 0;

export const suggestedNodes = (list: ComfyNodeInfo[]): ComfyNodes => ({
  prompt: list.filter((n) => n.suggested === "prompt").map((n) => n.id),
  negative: list.filter((n) => n.suggested === "negative").map((n) => n.id),
  images: list.filter((n) => n.suggested === "image").map((n) => n.id),
  output: list.find((n) => n.suggested === "output")?.id ?? null,
  loras: list.filter((n) => n.lora).map((n) => n.id),
  values: {},
});

export const nodeValue = (nodes: ComfyNodes, id: string, key: string, fallback: ComfyValue | null): ComfyValue | null => {
  const v = nodes.values?.[id]?.[key];
  return v === undefined ? fallback : v;
};

export const setNodeValue = (nodes: ComfyNodes, id: string, key: string, value: ComfyValue): ComfyNodes => ({
  ...nodes,
  values: { ...(nodes.values ?? {}), [id]: { ...(nodes.values?.[id] ?? {}), [key]: value } },
});

export const clearNodeValues = (nodes: ComfyNodes, id: string): ComfyNodes => {
  const values = { ...(nodes.values ?? {}) };
  delete values[id];
  return { ...nodes, values };
};

export const nodeLabel = (node: ComfyNodeInfo): string => `#${node.id} · ${node.title || node.class_type}`;

const compareIds = (a: string, b: string): number => {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.localeCompare(b);
};

export const sortNodes = (list: ComfyNodeInfo[]): ComfyNodeInfo[] => [...list].sort((a, b) => compareIds(a.id, b.id));

export const toggleImageNode = (nodes: ComfyNodes, id: string, on: boolean): ComfyNodes => ({
  ...nodes,
  images: (on ? [...nodes.images.filter((n) => n !== id), id] : nodes.images.filter((n) => n !== id)).sort(compareIds),
});

export const comfyMissing = (config: ProviderConfig): boolean =>
  config.kind === "comfyui" && config.image_workflow.trim() === "" && config.video_workflow.trim() === "";

export const essentialMissing = (provider: ProviderInfo): boolean =>
  provider.id === "reactor" ? !provider.key_present : comfyMissing(provider.config);

export const priceText = (perSecond: string | null, perClip: string | null): string =>
  [perSecond ? `$${perSecond}/s` : null, perClip ? `≈ $${perClip} per clip` : null].filter(Boolean).join(" · ");
