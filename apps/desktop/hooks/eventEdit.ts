import type { EventSpec, Hotspot, MapMedia, Site, Zone, ZoneMedia, ZoneTemplate } from "@/types/event";

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

export const uniqueId = (base: string, taken: string[]): string => {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
};

export const emptyMap = (): MapMedia => ({
  poster: null,
  loop_video: null,
  width: 1920,
  height: 1080,
  hotspots: [],
  video_hotspots: null,
  widget: null,
  variants: [],
});

export const emptyZoneMedia = (): ZoneMedia => ({
  poster: null,
  loop_video: null,
  width: 1920,
  height: 1080,
  variants: [],
});

export const blankEvent = (name: string): EventSpec => {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return {
    version: 1,
    id: slugify(name || "new-event"),
    name,
    date,
    description: "",
    style: { art_direction: "", palette: [], mood: "", references: [], avoid: "" },
    sites: [],
    map: emptyMap(),
    people: [],
    tasks: [],
    content: {},
  };
};

export const newSite = (event: EventSpec, label: string): Site => ({
  id: uniqueId(slugify(label), event.sites.map((s) => s.id)),
  label,
  city: label,
  venue: "",
  timezone: "UTC",
  open: "13:00",
  close: "20:30",
  crew_open: "10:30",
  crew_close: "22:30",
  zones: [],
  map: emptyMap(),
  tasks: [],
});

export const newZone = (site: Site, template: ZoneTemplate, label?: string): Zone => {
  const name = label ?? template.label;
  return {
    id: uniqueId(slugify(name), site.zones.map((z) => z.id)),
    label: name,
    format: template.format,
    who: template.who,
    what: template.what,
    brief: "",
    rhythm: template.rhythm,
    open: null,
    close: null,
    capacity: 60,
    media: emptyZoneMedia(),
    schedule: [],
    tasks: [],
  };
};

export const updateSite = (event: EventSpec, siteId: string, patch: (site: Site) => Site): EventSpec => ({
  ...event,
  sites: event.sites.map((s) => (s.id === siteId ? patch(s) : s)),
});

export const updateZone = (
  event: EventSpec,
  siteId: string,
  zoneId: string,
  patch: (zone: Zone) => Zone,
): EventSpec =>
  updateSite(event, siteId, (site) => ({
    ...site,
    zones: site.zones.map((z) => (z.id === zoneId ? patch(z) : z)),
  }));

const retarget = (hotspots: Hotspot[], from: string, to: string): Hotspot[] =>
  hotspots.map((h) => (h.target === from ? { ...h, target: to, id: h.id === from ? to : h.id } : h));

export const renameSite = (event: EventSpec, from: string, to: string): EventSpec => {
  const next = slugify(to);
  if (!next || next === from || event.sites.some((s) => s.id === next)) return event;
  return {
    ...event,
    map: {
      ...event.map,
      hotspots: retarget(event.map.hotspots, from, next),
      video_hotspots: event.map.video_hotspots ? retarget(event.map.video_hotspots, from, next) : null,
      widget: event.map.widget ? { ...event.map.widget, hotspots: retarget(event.map.widget.hotspots, from, next) } : null,
    },
    sites: event.sites.map((s) => ({
      ...(s.id === from ? { ...s, id: next } : s),
      zones: s.zones.map((z) => ({
        ...z,
        schedule: z.schedule.map((item) =>
          item.link && item.link.site === from ? { ...item, link: { ...item.link, site: next } } : item,
        ),
      })),
    })),
  };
};

export const renameZone = (event: EventSpec, siteId: string, from: string, to: string): EventSpec => {
  const site = findSite(event, siteId);
  const next = slugify(to);
  if (!site || !next || next === from || site.zones.some((z) => z.id === next)) return event;
  return {
    ...event,
    sites: event.sites.map((s) => ({
      ...s,
      ...(s.id === siteId
        ? {
            map: {
              ...s.map,
              hotspots: retarget(s.map.hotspots, from, next),
              video_hotspots: s.map.video_hotspots ? retarget(s.map.video_hotspots, from, next) : null,
              widget: s.map.widget ? { ...s.map.widget, hotspots: retarget(s.map.widget.hotspots, from, next) } : null,
            },
          }
        : {}),
      zones: s.zones.map((z) => ({
        ...(s.id === siteId && z.id === from ? { ...z, id: next } : z),
        schedule: z.schedule.map((item) =>
          item.link && item.link.site === siteId && item.link.zone === from
            ? { ...item, link: { ...item.link, zone: next } }
            : item,
        ),
      })),
    })),
  };
};

export const findSite = (event: EventSpec, siteId: string | null): Site | null =>
  event.sites.find((s) => s.id === siteId) ?? null;

export const findZone = (site: Site | null, zoneId: string | null): Zone | null =>
  site?.zones.find((z) => z.id === zoneId) ?? null;

export const hotspotFor = (id: string, label: string, target: string): Hotspot => ({
  id,
  label,
  target,
  polygon: [],
  window: null,
});
