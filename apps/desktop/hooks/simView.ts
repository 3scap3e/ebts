import type { EventSpec, Site } from "@/types/event";
import type { Snapshot } from "@/types/sim";
import type { SiteOffset } from "@/types/simulate";
import { toHm, toMinutes } from "@/hooks/time";

export const utcMinutesOf = (iso: string): number => {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

const normalizeOffset = (offset: number): number => {
  if (offset > 840) return offset - 1440;
  if (offset < -720) return offset + 1440;
  return offset;
};

export const shortLabel = (label: string): string =>
  label.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "SIT";

export const siteOffsets = (event: EventSpec | null, snapshot: Snapshot | null, cursor: string | null): SiteOffset[] => {
  if (!event || !snapshot || !cursor) return [];
  const utc = utcMinutesOf(cursor);
  return event.sites.map((site) => {
    const snap = snapshot.sites.find((s) => s.site === site.id);
    const offset = snap ? normalizeOffset(toMinutes(snap.local_time) - utc) : 0;
    return { site: site.id, label: shortLabel(site.label), offset };
  });
};

export const localAt = (iso: string, offset: number): string => toHm(utcMinutesOf(iso) + offset);

export const siteSpan = (site: Site): { open: number; close: number } => {
  const open = toMinutes(site.open);
  let close = toMinutes(site.close);
  if (close <= open) close += 1440;
  return { open, close };
};

export const minutesInSpan = (hm: string, span: { open: number; close: number }): number => {
  let m = toMinutes(hm);
  if (m < span.open && span.close > 1440) m += 1440;
  return m;
};

export const pctInSpan = (minutes: number, span: { open: number; close: number }): number => {
  const width = Math.max(1, span.close - span.open);
  const clamped = Math.min(Math.max(minutes, span.open), span.close);
  return ((clamped - span.open) / width) * 100;
};

export const siteLabel = (event: EventSpec, siteId: string): string =>
  event.sites.find((s) => s.id === siteId)?.label ?? siteId;

export const zoneLabel = (event: EventSpec, siteId: string, zoneId: string): string =>
  event.sites.find((s) => s.id === siteId)?.zones.find((z) => z.id === zoneId)?.label ?? zoneId;
