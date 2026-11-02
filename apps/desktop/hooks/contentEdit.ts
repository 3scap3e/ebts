import type { ContentItem } from "@/types/content";
import type { ContentOverride, EventSpec, SamplerOverride } from "@/types/event";
import type { MapLevel } from "@/types/map";
import type { ContentPart } from "@/types/ui";

export const emptySampler = (): SamplerOverride => ({ steps: null, cfg: null, denoise: null });

export const samplerBlank = (sampler: SamplerOverride): boolean => sampler.steps === null && sampler.cfg === null && sampler.denoise === null;

export const emptyOverride = (): ContentOverride => ({
  prompt: null,
  negative_prompt: "",
  init_images: [],
  seed: null,
  sampler: emptySampler(),
});

export const overrideFor = (event: EventSpec, id: string): ContentOverride => {
  const found = (event.content ?? {})[id];
  return found
    ? { ...emptyOverride(), ...found, init_images: found.init_images ?? [], sampler: { ...emptySampler(), ...(found.sampler ?? {}) } }
    : emptyOverride();
};

const isBlank = (override: ContentOverride): boolean =>
  (override.prompt === null || override.prompt.trim() === "") &&
  override.negative_prompt.trim() === "" &&
  override.init_images.length === 0 &&
  override.seed === null &&
  samplerBlank(override.sampler);

export const parseSamplerValue = (raw: string): number | null => {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) ? n : null;
};

export const setOverride = (event: EventSpec, id: string, patch: Partial<ContentOverride>): EventSpec => {
  const merged: ContentOverride = { ...overrideFor(event, id), ...patch };
  const next: ContentOverride = {
    ...merged,
    prompt: merged.prompt !== null && merged.prompt.trim() === "" ? null : merged.prompt,
    init_images: merged.init_images.filter((p) => p.trim() !== ""),
  };
  const content: Record<string, ContentOverride> = { ...(event.content ?? {}) };
  if (isBlank(next)) {
    delete content[id];
  } else {
    content[id] = next;
  }
  return { ...event, content };
};

export const setInitImage = (event: EventSpec, id: string, index: number, rel: string | null): EventSpec => {
  const list = [...overrideFor(event, id).init_images];
  if (rel === null) {
    if (index < list.length) list.splice(index, 1);
  } else if (index < list.length) {
    list[index] = rel;
  } else {
    list.push(rel);
  }
  return setOverride(event, id, { init_images: list });
};

export const refRel = (item: ContentItem, index: number): string =>
  `assets/refs/${item.id.replace(/:/g, "-")}-${index + 1}.png`;

export const isVideoItem = (item: ContentItem): boolean => item.kind === "loop-video";

export const siblingPoster = (items: ContentItem[], item: ContentItem): ContentItem | null =>
  items.find(
    (other) =>
      other.id !== item.id &&
      other.kind === "poster" &&
      other.exists &&
      other.level === item.level &&
      other.site === item.site &&
      other.zone === item.zone &&
      other.window === item.window,
  ) ?? null;

export const partItems = (items: ContentItem[], part: ContentPart): ContentItem[] =>
  items.filter((item) => {
    switch (part.kind) {
      case "event":
        return item.level === "event";
      case "site":
        return item.level === "site" && item.site === part.site;
      case "zone":
        return item.level === "zone" && item.site === part.site && item.zone === part.zone;
    }
  });

export const partKey = (part: ContentPart): string =>
  part.kind === "event" ? "event" : part.kind === "site" ? `site:${part.site}` : `zone:${part.site}:${part.zone}`;

export const defaultPart = (event: EventSpec): ContentPart =>
  event.sites.length > 0 ? { kind: "site", site: event.sites[0].id } : { kind: "event" };

export const resolvePart = (event: EventSpec, part: ContentPart | null): ContentPart => {
  if (!part) return defaultPart(event);
  if (part.kind === "event") return event.sites.length !== 1 ? part : defaultPart(event);
  const site = event.sites.find((s) => s.id === part.site);
  if (!site) return defaultPart(event);
  if (part.kind === "zone" && !site.zones.some((z) => z.id === part.zone)) return { kind: "site", site: site.id };
  return part;
};

export const levelFor = (part: ContentPart): MapLevel => {
  switch (part.kind) {
    case "event":
      return { kind: "event", site: null, zone: null };
    case "site":
      return { kind: "site", site: part.site, zone: null };
    case "zone":
      return { kind: "zone", site: part.site, zone: part.zone };
  }
};

export const windowText = (slug: string): string => {
  const match = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(slug);
  return match ? `${match[1]}:${match[2]}–${match[3]}:${match[4]}` : slug;
};

export const slotTitle = (item: ContentItem): string => {
  const base = item.kind === "widget" ? "Minimap" : item.kind === "loop-video" ? "Loop" : "Poster";
  return item.window ? `${windowText(item.window)} · ${base}` : base;
};

export const parseSeed = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Math.floor(Number(trimmed));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const seedText = (seed: number | null): string => (seed === null ? "" : String(seed));

export const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;
