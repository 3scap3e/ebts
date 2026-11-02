import type { LevelEntry, LevelSection, LevelSectionKind } from "@/types/map";

export const EVENT_SECTION = "event";

export const siteSection = (site: string): string => `site:${site}`;

export const sectionKeyOf = (entry: LevelEntry): string => {
  if (entry.level.site) return siteSection(entry.level.site);
  return EVENT_SECTION;
};

const section = (key: string, kind: LevelSectionKind, title: string, items: LevelEntry[]): LevelSection => ({
  key,
  kind,
  title,
  items,
  drawn: items.reduce((sum, e) => sum + e.drawn, 0),
  total: items.reduce((sum, e) => sum + e.total, 0),
  allImages: items.length > 0 && items.every((e) => e.hasImage),
});

export const levelSections = (entries: LevelEntry[]): LevelSection[] => {
  const event = entries.filter((e) => e.level.kind === "event" || e.level.kind === "event-widget");
  const sites: LevelSection[] = [];
  for (const entry of entries) {
    const id = entry.level.site;
    if (!id) continue;
    const key = siteSection(id);
    const existing = sites.find((s) => s.key === key);
    if (existing) {
      existing.items.push(entry);
    } else {
      sites.push(section(key, "site", entry.level.kind === "site" ? entry.label : id, [entry]));
    }
  }
  return [section(EVENT_SECTION, "event", "Event", event), ...sites.map((s) => section(s.key, s.kind, s.title, s.items))];
};
