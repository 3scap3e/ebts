import type { Site } from "@/types/event";
import type { SiteUtcSpan, UtcOverlap } from "@/types/sites";
import { toMinutes } from "@/hooks/time";

const partsOf = (date: Date, tz: string): number => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute);
};

export const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const localToUtc = (date: string, hm: string, tz: string): number | null => {
  if (!isValidTimezone(tz)) return null;
  const [y, m, d] = date.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  const minutes = toMinutes(hm);
  const wall = Date.UTC(y, m - 1, d, 0, 0) + minutes * 60000;
  let guess = wall;
  for (let i = 0; i < 2; i += 1) {
    const seen = partsOf(new Date(guess), tz);
    guess += wall - seen;
  }
  return guess;
};

export const browserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const utcHm = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

export const hmIn = (ms: number, tz: string): string => {
  if (tz === "UTC" || !isValidTimezone(tz)) return utcHm(ms);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
  const parts = fmt.formatToParts(new Date(ms));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
};

export const shortZone = (tz: string, ms: number): string => {
  if (tz === "UTC") return "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(ms));
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
};

export const siteUtcSpan = (date: string, site: Site): SiteUtcSpan | null => {
  const open = localToUtc(date, site.open, site.timezone);
  let close = localToUtc(date, site.close, site.timezone);
  if (open === null || close === null) return null;
  if (close <= open) close += 86400000;
  return { site: site.id, label: site.label, openUtc: open, closeUtc: close };
};

export const utcOverlap = (spans: SiteUtcSpan[]): UtcOverlap | null => {
  if (spans.length < 2) return null;
  const start = Math.max(...spans.map((s) => s.openUtc));
  const end = Math.min(...spans.map((s) => s.closeUtc));
  return { start, end, minutes: Math.max(0, Math.round((end - start) / 60000)) };
};
