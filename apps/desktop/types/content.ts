import type { SamplerOverride } from "./event";

export type ContentKind = "poster" | "loop-video" | "widget";

export type ContentLevel = "event" | "site" | "zone";

export interface ContentItem {
  id: string;
  kind: ContentKind;
  level: ContentLevel;
  site: string | null;
  zone: string | null;
  window: string | null;
  label: string;
  path: string;
  exists: boolean;
  width: number;
  height: number;
  duration_seconds: number | null;
  prompt: string;
  hint: string;
  negative_prompt: string;
  init_images: string[];
  seed: number | null;
  sampler: SamplerOverride;
}
