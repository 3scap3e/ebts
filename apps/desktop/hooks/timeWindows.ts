import type { MediaVariant, TimeWindow } from "@/types/event";
import { toMinutes } from "@/hooks/time";

export const HM_PATTERN = /^\d{2}:\d{2}$/;

export const isHm = (value: string): boolean => HM_PATTERN.test(value);

export const inWindow = (hm: string, window: TimeWindow): boolean => {
  const t = toMinutes(hm);
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  return end <= start ? t >= start || t <= end : t >= start && t <= end;
};

const sinceStart = (hm: string, window: TimeWindow): number =>
  (((toMinutes(hm) - toMinutes(window.start)) % 1440) + 1440) % 1440;

export const activeVariant = (variants: MediaVariant[], hm: string): MediaVariant | null => {
  let best: MediaVariant | null = null;
  for (const variant of variants) {
    if (!inWindow(hm, variant.window)) continue;
    if (!best || sinceStart(hm, variant.window) <= sinceStart(hm, best.window)) best = variant;
  }
  return best;
};

export const resolvePoster = (base: string | null, variants: MediaVariant[], hm: string): string | null =>
  activeVariant(variants, hm)?.poster ?? base;

export const resolveLoop = (base: string | null, variants: MediaVariant[], hm: string): string | null =>
  activeVariant(variants, hm)?.loop_video ?? base;

export const resolveWidget = (base: string | null, variants: MediaVariant[], hm: string): string | null =>
  activeVariant(variants, hm)?.widget ?? base;

export const windowLabel = (window: TimeWindow): string => `${window.start}–${window.end}`;

export const windowFolder = (window: TimeWindow): string =>
  `${window.start.replace(":", "")}-${window.end.replace(":", "")}`;

export const sortByStart = <T extends { window: TimeWindow }>(list: T[]): T[] =>
  [...list].sort((a, b) => toMinutes(a.window.start) - toMinutes(b.window.start));
