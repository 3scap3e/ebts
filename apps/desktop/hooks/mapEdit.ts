import type { EventSpec, Hotspot, MapMedia, MediaVariant, Point, TimeWindow, WidgetMedia } from "@/types/event";
import type { HotspotSource, LevelEntry, MapLevel, MediaSlot, MediaView, TargetEntry, VariantSlot } from "@/types/map";
import { findSite, findZone, updateSite, updateZone } from "@/hooks/eventEdit";
import { AREA_PREFIX, isArea, isDrawn, scalePolygon } from "@/hooks/geometry";
import { isHm, windowFolder } from "@/hooks/timeWindows";

export const eventLevel: MapLevel = { kind: "event", site: null, zone: null };

export const MAPS_GROUP = "Maps";

export const levelKey = (level: MapLevel): string =>
  `${level.kind}:${level.site ?? ""}:${level.zone ?? ""}`;

export const resolveLevel = (event: EventSpec, level: MapLevel): MapLevel => {
  if (level.kind === "event" || level.kind === "event-widget") return level;
  const site = findSite(event, level.site);
  if (!site) return eventLevel;
  if (level.kind === "zone" && !findZone(site, level.zone)) return eventLevel;
  return level;
};

const emptyWidget = (width: number, height: number): WidgetMedia => ({
  image: null,
  width,
  height,
  hotspots: [],
});

const usesVideoSet = (map: MapMedia, source: HotspotSource): boolean =>
  source === "video" && map.video_hotspots !== null;

const mapView = (map: MapMedia, source: HotspotSource = "image"): MediaView => ({
  image: map.poster,
  loop: map.loop_video,
  width: map.width,
  height: map.height,
  hotspots: source === "video" && map.video_hotspots ? map.video_hotspots : map.hotspots,
});

const widgetView = (map: MapMedia): MediaView => {
  const widget = map.widget ?? emptyWidget(map.width, map.height);
  return { image: widget.image, loop: null, width: widget.width, height: widget.height, hotspots: widget.hotspots };
};

export const allowsVideoSet = (level: MapLevel): boolean => level.kind === "event" || level.kind === "site";

export const mapMediaAt = (event: EventSpec, level: MapLevel): MapMedia | null => {
  if (level.kind === "event") return event.map;
  if (level.kind === "site") return findSite(event, level.site)?.map ?? null;
  return null;
};

const patchMapMedia = (event: EventSpec, level: MapLevel, patch: (map: MapMedia) => MapMedia): EventSpec => {
  if (level.kind === "event") return { ...event, map: patch(event.map) };
  if (level.kind === "site" && level.site) return updateSite(event, level.site, (s) => ({ ...s, map: patch(s.map) }));
  return event;
};

export const isLinked = (event: EventSpec, level: MapLevel): boolean => {
  const map = mapMediaAt(event, level);
  return map ? map.video_hotspots === null : true;
};

export const unlinkHotspots = (event: EventSpec, level: MapLevel): EventSpec =>
  patchMapMedia(event, level, (m) =>
    m.video_hotspots === null ? { ...m, video_hotspots: m.hotspots.map((hs) => ({ ...hs, polygon: hs.polygon.map((p) => ({ ...p })) })) } : m,
  );

export const linkHotspots = (event: EventSpec, level: MapLevel): EventSpec =>
  patchMapMedia(event, level, (m) => ({ ...m, video_hotspots: null }));

export const readMedia = (event: EventSpec, level: MapLevel, source: HotspotSource = "image"): MediaView => {
  if (level.kind === "event") return mapView(event.map, source);
  if (level.kind === "event-widget") return widgetView(event.map);
  const site = findSite(event, level.site);
  if (!site) return mapView(event.map, source);
  if (level.kind === "site") return mapView(site.map, source);
  if (level.kind === "site-widget") return widgetView(site.map);
  const zone = findZone(site, level.zone);
  if (!zone) return mapView(site.map, source);
  return { image: zone.media.poster, loop: zone.media.loop_video, width: zone.media.width, height: zone.media.height, hotspots: [] };
};

const patchMap = (map: MapMedia, patch: (view: MediaView) => MediaView, source: HotspotSource): MapMedia => {
  const next = patch(mapView(map, source));
  const video = usesVideoSet(map, source);
  return {
    ...map,
    poster: next.image,
    loop_video: next.loop,
    width: next.width,
    height: next.height,
    hotspots: video ? map.hotspots : next.hotspots,
    video_hotspots: video ? next.hotspots : map.video_hotspots,
  };
};

const patchWidget = (map: MapMedia, patch: (view: MediaView) => MediaView): MapMedia => {
  const next = patch(widgetView(map));
  return { ...map, widget: { image: next.image, width: next.width, height: next.height, hotspots: next.hotspots } };
};

export const writeMedia = (
  event: EventSpec,
  level: MapLevel,
  patch: (view: MediaView) => MediaView,
  source: HotspotSource = "image",
): EventSpec => {
  if (level.kind === "event") return { ...event, map: patchMap(event.map, patch, source) };
  if (level.kind === "event-widget") return { ...event, map: patchWidget(event.map, patch) };
  if (!level.site) return event;
  if (level.kind === "site") return updateSite(event, level.site, (s) => ({ ...s, map: patchMap(s.map, patch, source) }));
  if (level.kind === "site-widget") return updateSite(event, level.site, (s) => ({ ...s, map: patchWidget(s.map, patch) }));
  if (!level.zone) return event;
  return updateZone(event, level.site, level.zone, (z) => {
    const next = patch({ image: z.media.poster, loop: z.media.loop_video, width: z.media.width, height: z.media.height, hotspots: [] });
    return { ...z, media: { ...z.media, poster: next.image, loop_video: next.loop, width: next.width, height: next.height } };
  });
};

export const setSlot = (event: EventSpec, level: MapLevel, slot: MediaSlot, rel: string | null): EventSpec =>
  writeMedia(event, level, (v) => (slot === "image" ? { ...v, image: rel } : { ...v, loop: rel }));

export const setSize = (event: EventSpec, level: MapLevel, width: number, height: number): EventSpec => {
  const before = readMedia(event, level);
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const sx = before.width > 0 ? w / before.width : 1;
  const sy = before.height > 0 ? h / before.height : 1;
  const patch = (v: MediaView): MediaView => ({
    ...v,
    width: w,
    height: h,
    hotspots: v.hotspots.map((hs) => ({ ...hs, polygon: scalePolygon(hs.polygon, sx, sy) })),
  });
  const next = writeMedia(event, level, patch, "image");
  return isLinked(event, level) ? next : writeMedia(next, level, patch, "video");
};

export const setPolygon = (
  event: EventSpec,
  level: MapLevel,
  target: string,
  label: string,
  polygon: Point[],
  source: HotspotSource = "image",
): EventSpec =>
  writeMedia(
    event,
    level,
    (v) => {
      const exists = v.hotspots.some((hs) => hs.target === target);
      const entry: Hotspot = { id: target, label, target, polygon, window: null };
      return {
        ...v,
        hotspots: exists
          ? v.hotspots.map((hs) => (hs.target === target ? { ...hs, label, polygon } : hs))
          : [...v.hotspots, entry],
      };
    },
    source,
  );

export const clearPolygon = (event: EventSpec, level: MapLevel, target: string, source: HotspotSource = "image"): EventSpec =>
  writeMedia(event, level, (v) => ({ ...v, hotspots: v.hotspots.filter((hs) => hs.target !== target) }), source);

export const moveVertex = (
  event: EventSpec,
  level: MapLevel,
  target: string,
  index: number,
  point: Point,
  source: HotspotSource = "image",
): EventSpec =>
  writeMedia(
    event,
    level,
    (v) => ({
      ...v,
      hotspots: v.hotspots.map((hs) =>
        hs.target === target ? { ...hs, polygon: hs.polygon.map((p, i) => (i === index ? point : p)) } : hs,
      ),
    }),
    source,
  );

export const insertVertex = (
  event: EventSpec,
  level: MapLevel,
  target: string,
  index: number,
  point: Point,
  source: HotspotSource = "image",
): EventSpec =>
  writeMedia(
    event,
    level,
    (v) => ({
      ...v,
      hotspots: v.hotspots.map((hs) =>
        hs.target === target ? { ...hs, polygon: [...hs.polygon.slice(0, index), point, ...hs.polygon.slice(index)] } : hs,
      ),
    }),
    source,
  );

export const deleteVertex = (
  event: EventSpec,
  level: MapLevel,
  target: string,
  index: number,
  source: HotspotSource = "image",
): EventSpec =>
  writeMedia(
    event,
    level,
    (v) => ({
      ...v,
      hotspots: v.hotspots
        .map((hs) => (hs.target === target ? { ...hs, polygon: hs.polygon.filter((_, i) => i !== index) } : hs))
        .filter((hs) => hs.target !== target || isArea(target) || isDrawn(hs.polygon)),
    }),
    source,
  );

export const areaTargets = (hotspots: Hotspot[]): TargetEntry[] =>
  hotspots.filter((hs) => isArea(hs.target)).map((hs) => ({ target: hs.target, label: hs.label, polygon: hs.polygon }));

export const nextAreaTarget = (hotspots: Hotspot[]): string => {
  const used = new Set(hotspots.map((hs) => hs.target));
  let n = 1;
  while (used.has(`${AREA_PREFIX}${n}`)) n += 1;
  return `${AREA_PREFIX}${n}`;
};

export const areaLabel = (target: string): string => `Area ${target.slice(AREA_PREFIX.length)}`;

export const addArea = (event: EventSpec, level: MapLevel, target: string, source: HotspotSource = "image"): EventSpec =>
  writeMedia(
    event,
    level,
    (v) =>
      v.hotspots.some((hs) => hs.target === target)
        ? v
        : { ...v, hotspots: [...v.hotspots, { id: target, label: areaLabel(target), target, polygon: [], window: null }] },
    source,
  );

export const renameArea = (event: EventSpec, level: MapLevel, target: string, label: string, source: HotspotSource = "image"): EventSpec =>
  writeMedia(
    event,
    level,
    (v) => ({
      ...v,
      hotspots: v.hotspots.map((hs) => (hs.target === target ? { ...hs, label } : hs)),
    }),
    source,
  );

export const emptyPolygon = (event: EventSpec, level: MapLevel, target: string, source: HotspotSource = "image"): EventSpec =>
  writeMedia(
    event,
    level,
    (v) => ({
      ...v,
      hotspots: v.hotspots.map((hs) => (hs.target === target ? { ...hs, polygon: [] } : hs)),
    }),
    source,
  );

export const setHotspotWindow = (
  event: EventSpec,
  level: MapLevel,
  target: string,
  window: TimeWindow | null,
  source: HotspotSource = "image",
): EventSpec =>
  writeMedia(
    event,
    level,
    (v) => ({
      ...v,
      hotspots: v.hotspots.map((hs) => (hs.target === target ? { ...hs, window } : hs)),
    }),
    source,
  );

export const expectedTargets = (event: EventSpec, level: MapLevel, source: HotspotSource = "image"): TargetEntry[] => {
  const view = readMedia(event, level, source);
  const entryOf = (target: string, label: string): TargetEntry => {
    const found = view.hotspots.find((hs) => hs.target === target);
    return { target, label, polygon: found?.polygon ?? [], window: found?.window ?? null };
  };
  if (level.kind === "zone") return [];
  const areas = areaTargets(view.hotspots).map((a) => entryOf(a.target, a.label));
  if (level.kind === "event" || level.kind === "event-widget") {
    return [...event.sites.map((s) => entryOf(s.id, s.label)), ...areas];
  }
  const site = findSite(event, level.site);
  return [...(site?.zones ?? []).map((z) => entryOf(z.id, z.label)), ...areas];
};

export const ALL_DAY: TimeWindow = { start: "00:00", end: "23:59" };

export const levelUtc = (level: MapLevel): boolean => level.kind === "event" || level.kind === "event-widget";

export const defaultWindow = (event: EventSpec, level: MapLevel): TimeWindow => {
  const site = findSite(event, level.site);
  if (levelUtc(level) || !site || !isHm(site.open) || !isHm(site.close)) return { ...ALL_DAY };
  return { start: site.open, end: site.close };
};

export const defaultPreview = (event: EventSpec, level: MapLevel): string => {
  const site = findSite(event, level.site);
  return levelUtc(level) || !site || !isHm(site.open) ? "12:00" : site.open;
};

export const allowsVariants = (level: MapLevel): boolean =>
  level.kind === "event" || level.kind === "site" || level.kind === "zone";

export const isWidgetLevel = (level: MapLevel): boolean => level.kind === "event-widget" || level.kind === "site-widget";

export const variantsAt = (event: EventSpec, level: MapLevel): MediaVariant[] => {
  if (level.kind === "event" || level.kind === "event-widget") return event.map.variants ?? [];
  const site = findSite(event, level.site);
  if (!site) return [];
  if (level.kind === "site" || level.kind === "site-widget") return site.map.variants ?? [];
  return findZone(site, level.zone)?.media.variants ?? [];
};

const patchVariants = (event: EventSpec, level: MapLevel, patch: (list: MediaVariant[]) => MediaVariant[]): EventSpec => {
  if (level.kind === "event") return { ...event, map: { ...event.map, variants: patch(event.map.variants ?? []) } };
  if (!level.site) return event;
  if (level.kind === "site") {
    return updateSite(event, level.site, (s) => ({ ...s, map: { ...s.map, variants: patch(s.map.variants ?? []) } }));
  }
  if (level.kind === "zone" && level.zone) {
    return updateZone(event, level.site, level.zone, (z) => ({ ...z, media: { ...z.media, variants: patch(z.media.variants ?? []) } }));
  }
  return event;
};

export const newVariant = (window: TimeWindow): MediaVariant => ({ window, poster: null, loop_video: null, widget: null });

export const addVariant = (event: EventSpec, level: MapLevel): EventSpec =>
  patchVariants(event, level, (list) => [...list, newVariant(defaultWindow(event, level))]);

export const updateVariant = (event: EventSpec, level: MapLevel, index: number, patch: Partial<MediaVariant>): EventSpec =>
  patchVariants(event, level, (list) => list.map((v, i) => (i === index ? { ...v, ...patch } : v)));

export const removeVariant = (event: EventSpec, level: MapLevel, index: number): EventSpec =>
  patchVariants(event, level, (list) => list.filter((_, i) => i !== index));

export const setVariantSlot = (event: EventSpec, level: MapLevel, index: number, slot: VariantSlot, rel: string | null): EventSpec =>
  updateVariant(event, level, index, slot === "poster" ? { poster: rel } : slot === "loop_video" ? { loop_video: rel } : { widget: rel });

export const variantRel = (level: MapLevel, window: TimeWindow, slot: VariantSlot, ext: string): string =>
  `${mediaFolder(level)}/variants/${windowFolder(window)}/${slot === "loop_video" ? "loop" : slot}.${ext}`;

export const allowsLoop = (level: MapLevel): boolean =>
  level.kind === "event" || level.kind === "site" || level.kind === "zone";

const mediaFolder = (level: MapLevel): string =>
  level.kind === "event" || level.kind === "event-widget"
    ? "assets/event"
    : level.kind === "zone"
      ? `assets/sites/${level.site}/zones/${level.zone}`
      : `assets/sites/${level.site}`;

export const canonicalRel = (level: MapLevel, slot: MediaSlot, ext: string): string => {
  const folder = mediaFolder(level);
  if (slot === "loop") return `${folder}/loop.${ext}`;
  if (level.kind === "event-widget" || level.kind === "site-widget") return `${folder}/widget.${ext}`;
  if (level.kind === "zone") return `${folder}/poster.${ext}`;
  return `${folder}/map.${ext}`;
};

export const levelTitle = (event: EventSpec, level: MapLevel): string => {
  const site = findSite(event, level.site);
  const zone = findZone(site, level.zone);
  if (level.kind === "event") return `${event.name || "Event"} map`;
  if (level.kind === "event-widget") return `${event.name || "Event"} minimap`;
  if (level.kind === "site") return `${site?.label ?? "Site"} map`;
  if (level.kind === "site-widget") return `${site?.label ?? "Site"} minimap`;
  return `${site?.label ?? "Site"} / ${zone?.label ?? "Zone"}`;
};

const entryFor = (event: EventSpec, level: MapLevel, label: string, sub: string, indent: number): LevelEntry => {
  const view = readMedia(event, level);
  const targets = expectedTargets(event, level);
  return {
    level,
    key: levelKey(level),
    group: MAPS_GROUP,
    label,
    sub,
    drawn: targets.filter((t) => isDrawn(t.polygon)).length,
    total: targets.length,
    hasImage: Boolean(view.image || view.loop),
    indent,
  };
};

export const levelEntries = (event: EventSpec): LevelEntry[] => {
  const entries: LevelEntry[] = [
    entryFor(event, eventLevel, "Event map", "sites as hotspots", 0),
    entryFor(event, { kind: "event-widget", site: null, zone: null }, "Event minimap", "widget blueprint", 1),
  ];
  for (const site of event.sites) {
    entries.push(entryFor(event, { kind: "site", site: site.id, zone: null }, site.label, "site map", 0));
    entries.push(entryFor(event, { kind: "site-widget", site: site.id, zone: null }, `${site.label} minimap`, "widget blueprint", 1));
    for (const zone of site.zones) {
      entries.push(entryFor(event, { kind: "zone", site: site.id, zone: zone.id }, zone.label, "zone media", 2));
    }
  }
  return entries;
};
