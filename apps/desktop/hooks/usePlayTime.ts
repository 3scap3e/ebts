import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventSpec, Site } from "@/types/event";
import type { PlayTimeState, UtcRange } from "@/types/play";
import { hmIn, isValidTimezone, siteUtcSpan } from "@/hooks/tz";
import { toMinutes } from "@/hooks/time";

const TICK_MS = 120;
const MINUTE = 60000;
const DAY = 86400000;

const dayStartUtc = (date: string): number => {
  const [y, m, d] = date.split("-").map((v) => Number(v));
  if (!y || !m || !d) return Math.floor(Date.now() / DAY) * DAY;
  return Date.UTC(y, m - 1, d);
};

const localDayStart = (ms: number, tz: string): number => {
  if (tz === "UTC" || !isValidTimezone(tz)) return Math.floor(ms / DAY) * DAY;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const map: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date(ms))) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return Date.UTC(map.year, map.month - 1, map.day);
};

export const playUtcRange = (event: EventSpec | null): UtcRange => {
  const spans = event ? event.sites.flatMap((site) => {
    const span = siteUtcSpan(event.date, site);
    return span ? [span] : [];
  }) : [];
  if (spans.length === 0) {
    const start = dayStartUtc(event?.date ?? "");
    return { min: start, max: start + DAY };
  }
  return { min: Math.min(...spans.map((s) => s.openUtc)), max: Math.max(...spans.map((s) => s.closeUtc)) };
};

const snap = (ms: number, range: UtcRange): number => Math.min(Math.max(Math.round(ms / MINUTE) * MINUTE, range.min), range.max);

export const usePlayTime = (event: EventSpec | null): PlayTimeState => {
  const range = useMemo(() => playUtcRange(event), [event]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const utc = snap(cursor ?? range.min, range);
  const utcRef = useRef(utc);
  utcRef.current = utc;
  const eventDay = dayStartUtc(event?.date ?? "");

  const setUtc = useCallback((ms: number) => setCursor(snap(ms, range)), [range]);

  useEffect(() => {
    if (!playing) return;
    const timer = globalThis.setInterval(() => {
      setCursor(snap(utcRef.current + MINUTE, range));
    }, TICK_MS);
    return () => globalThis.clearInterval(timer);
  }, [playing, range]);

  useEffect(() => {
    if (playing && utc >= range.max) setPlaying(false);
  }, [playing, utc, range.max]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && utcRef.current >= range.max) setCursor(range.min);
      return !p;
    });
  }, [range]);

  const localMinutes = useCallback(
    (site: Site): number => {
      const minutes = toMinutes(hmIn(utc, site.timezone));
      const dayShift = Math.round((localDayStart(utc, site.timezone) - eventDay) / DAY);
      return minutes + dayShift * 1440;
    },
    [utc, eventDay],
  );

  return {
    utc,
    min: range.min,
    max: range.max,
    playing,
    setUtc,
    toggle,
    utcMinutes: Math.round((utc - Math.floor(utc / DAY) * DAY) / MINUTE),
    localMinutes,
  };
};
