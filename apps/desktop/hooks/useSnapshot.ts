import { useCallback, useEffect, useRef, useState } from "react";
import type { EventSpec } from "@/types/event";
import type { Snapshot } from "@/types/sim";
import type { SnapshotState } from "@/types/simulate";
import { api } from "@/hooks/api";

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);

export const useSnapshot = (event: EventSpec | null, cursor: string | null): SnapshotState => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const pending = useRef<{ event: EventSpec; cursor: string } | null>(null);
  const alive = useRef(true);

  const run = useCallback(async (ev: EventSpec, utc: string): Promise<void> => {
    inFlight.current = true;
    setLoading(true);
    try {
      const snap = await api.simulate(ev, utc);
      if (alive.current) {
        setSnapshot(snap);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(describe(e));
    } finally {
      inFlight.current = false;
      const next = pending.current;
      pending.current = null;
      if (!alive.current) return;
      if (next) {
        void run(next.event, next.cursor);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!event || !cursor) return;
    if (inFlight.current) {
      pending.current = { event, cursor };
      return;
    }
    void run(event, cursor);
  }, [event, cursor, run]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  return { snapshot, loading, error };
};
