import type { Hotspot, MapMedia, Site, Zone } from "@/types/event";
import type { ListEntry, MapScene, MinimapSource } from "@/types/play";
import { assetUrl } from "@/hooks/api";
import { isArea, isDrawn } from "@/hooks/geometry";
import { activeVariant, inWindow, resolveLoop, resolvePoster, resolveWidget, windowFolder } from "@/hooks/timeWindows";

export const resolveHotspots = (hotspots: Hotspot[], targets: ListEntry[]): Hotspot[] => [
  ...targets.flatMap((t) => {
    const hs = hotspots.find((h) => h.target === t.id);
    return hs ? [{ ...hs, id: t.id, label: t.label }] : [];
  }),
  ...hotspots.filter((h) => isArea(h.target) && isDrawn(h.polygon)).map((h) => ({ ...h, id: h.target })),
];

export const playHotspots = (map: MapMedia, playsLoop: boolean): Hotspot[] =>
  playsLoop ? (map.video_hotspots ?? map.hotspots) : map.hotspots;

export const visibleHotspots = (hotspots: Hotspot[], hm: string): Hotspot[] =>
  hotspots.filter((h) => !h.window || inWindow(hm, h.window));

export const hiddenTargets = (map: MapMedia, hm: string): string[] =>
  [...map.hotspots, ...(map.video_hotspots ?? [])]
    .filter((h) => h.window && !inWindow(hm, h.window))
    .map((h) => h.target);

export const minimapFor = (root: string | null, map: MapMedia, hotspots: Hotspot[], hm: string): MinimapSource => {
  const widget = map.widget;
  const image = widget ? resolveWidget(widget.image, map.variants, hm) : null;
  if (widget && image) {
    const hidden = hiddenTargets(map, hm);
    const shown = visibleHotspots(widget.hotspots, hm).filter((h) => !hidden.includes(h.target));
    return { image: assetUrl(root, image), width: widget.width, height: widget.height, hotspots: shown, isWidget: true };
  }
  return { image: null, width: map.width, height: map.height, hotspots, isWidget: false };
};

export const siteEntries = (sites: Site[]): ListEntry[] =>
  sites.map((s) => ({ id: s.id, label: s.label, sub: `${s.city} · ${s.open}–${s.close}` }));

export const zoneEntries = (zones: Zone[]): ListEntry[] =>
  zones.map((z) => ({ id: z.id, label: z.label, sub: z.format.replace(/-/g, " ") }));

export const needsList = (poster: string | null, hotspots: Hotspot[], targets: ListEntry[]): boolean =>
  !poster || targets.some((t) => !hotspots.some((h) => h.target === t.id && isDrawn(h.polygon)));

export const sceneKey = (map: MapMedia, hm: string): string => {
  const variant = activeVariant(map.variants, hm);
  const shown = [...map.hotspots, ...(map.video_hotspots ?? []), ...(map.widget?.hotspots ?? [])]
    .map((h) => (!h.window || inWindow(hm, h.window) ? "1" : "0"))
    .join("");
  return `${variant ? windowFolder(variant.window) : "base"}|${shown}`;
};

export const buildScene = (root: string | null, map: MapMedia, entries: ListEntry[], hm: string): MapScene => {
  const poster = resolvePoster(map.poster, map.variants, hm);
  const image = assetUrl(root, poster);
  const loop = assetUrl(root, resolveLoop(map.loop_video, map.variants, hm));
  const hotspots = resolveHotspots(visibleHotspots(playHotspots(map, loop !== null), hm), entries);
  return { image, loop, poster, hotspots, minimap: minimapFor(root, map, hotspots, hm) };
};
