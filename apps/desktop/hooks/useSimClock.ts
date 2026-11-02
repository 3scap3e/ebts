import { useCallback, useEffect, useState } from "react";
import type { EventSpec } from "@/types/event";
import type { SimWindow } from "@/types/sim";
import type { SimClock, SimSpeed } from "@/types/simulate";
import { api } from "@/hooks/api";
import { addMinutesIso, minutesBetween } from "@/hooks/time";

const STEP_MINUTES = 5;
const TICK_MS = 400;

const snap = (minutes: number, total: number): number =>
  Math.min(Math.max(0, Math.round(minutes / STEP_MINUTES) * STEP_MINUTES), total);

export const useSimClock = (event: EventSpec | null): SimClock => {
  const [win, setWin] = useState<SimWindow | null>(null);
  const [position, setPositionState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<SimSpeed>(1);
  const total = win ? Math.max(0, minutesBetween(win.start_utc, win.end_utc)) : 0;

  useEffect(() => {
    if (!event) {
      setWin(null);
      return;
    }
    const timer = globalThis.setTimeout(() => {
      api
        .simWindow(event)
        .then(setWin)
        .catch(() => undefined);
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [event]);

  useEffect(() => {
    setPositionState((prev) => snap(prev, total));
  }, [total]);

  useEffect(() => {
    if (!playing) return;
    const id = globalThis.setInterval(() => {
      setPositionState((prev) => snap(prev + STEP_MINUTES * speed, total));
    }, TICK_MS);
    return () => globalThis.clearInterval(id);
  }, [playing, speed, total]);

  useEffect(() => {
    if (playing && total > 0 && position >= total) setPlaying(false);
  }, [playing, position, total]);

  const setPosition = useCallback((minutes: number) => setPositionState(snap(minutes, total)), [total]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && total > 0 && position >= total) {
        setPositionState(0);
      }
      return !p;
    });
  }, [position, total]);

  const step = useCallback(
    (direction: -1 | 1) => setPositionState((prev) => snap(prev + direction * STEP_MINUTES, total)),
    [total],
  );

  return {
    window: win,
    cursor: win ? addMinutesIso(win.start_utc, position) : null,
    position,
    total,
    setPosition,
    playing,
    toggle,
    speed,
    setSpeed,
    step,
  };
};
