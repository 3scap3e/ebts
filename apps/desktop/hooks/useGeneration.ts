import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, isTauri } from "@/hooks/api";
import { describeError } from "@/hooks/errors";
import { jobWith, summarizeJobs } from "@/hooks/generate";
import type { ContentItem } from "@/types/content";
import type { EventSpec } from "@/types/event";
import type { GenerateJobs, GenerationState, ProgressEvent } from "@/types/generate";

interface GenerationDeps {
  root: string | null;
  event: EventSpec | null;
  onItem: (item: ContentItem) => void;
  onFinished: () => Promise<void> | void;
}

export const useGeneration = ({ root, event, onItem, onFinished }: GenerationDeps): GenerationState => {
  const [jobs, setJobs] = useState<GenerateJobs>({});
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);
  const aborted = useRef(new Set<string>());
  const generation = useRef(0);
  const eventRef = useRef(event);
  eventRef.current = event;
  const rootRef = useRef(root);
  rootRef.current = root;
  const onItemRef = useRef(onItem);
  onItemRef.current = onItem;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    const stop = listen<ProgressEvent>("generate-progress", ({ payload }) => {
      if (!active) return;
      setJobs((prev) => {
        const job = prev[payload.item_id];
        if (!job || job.status !== "working") return prev;
        return { ...prev, [payload.item_id]: { ...job, step: payload.step, total: payload.total, detail: payload.detail || null } };
      });
    });
    return () => {
      active = false;
      void stop.then((unlisten) => unlisten());
    };
  }, []);

  const start = useCallback(
    (items: ContentItem[]) => {
      if (running || items.length === 0) return;
      const currentRoot = rootRef.current;
      const currentEvent = eventRef.current;
      if (!currentRoot || !currentEvent) return;
      cancelled.current = false;
      const run = ++generation.current;
      setRunning(true);
      setJobs((prev) => ({ ...prev, ...Object.fromEntries(items.map((item) => [item.id, jobWith("queued")])) }));
      void (async () => {
        for (const item of items) {
          if (cancelled.current || run !== generation.current) break;
          aborted.current.delete(item.id);
          setJobs((prev) => ({ ...prev, [item.id]: jobWith("working") }));
          try {
            const produced = await api.generateItem(currentRoot, currentEvent, item.id);
            if (aborted.current.has(item.id)) continue;
            setJobs((prev) => ({ ...prev, [item.id]: jobWith("done", { candidate: produced.candidate }) }));
          } catch (e) {
            if (aborted.current.has(item.id)) continue;
            setJobs((prev) => ({ ...prev, [item.id]: jobWith("failed", { error: describeError(e) }) }));
          }
        }
        if (run !== generation.current) return;
        setJobs((prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([id, job]) => (job.status === "queued" ? [id, jobWith("failed", { error: "Cancelled" })] : [id, job])),
          ),
        );
        setRunning(false);
      })();
    },
    [running],
  );

  const abort = useCallback(async (item: ContentItem) => {
    aborted.current.add(item.id);
    generation.current += 1;
    setJobs((prev) => ({ ...prev, [item.id]: jobWith("failed", { error: "Cancelled" }) }));
    setRunning(false);
    try {
      await api.generateCancel(item.id);
    } catch {
      return;
    }
  }, []);

  const accept = useCallback(async (item: ContentItem, candidate: string) => {
    const currentRoot = rootRef.current;
    if (!currentRoot) return;
    try {
      const path = await api.generateAccept(currentRoot, candidate);
      onItemRef.current({ ...item, path, exists: true });
      setJobs((prev) => ({ ...prev, [item.id]: jobWith("done", { accepted: Date.now() }) }));
      await onFinishedRef.current();
    } catch (e) {
      setJobs((prev) => ({ ...prev, [item.id]: jobWith("failed", { error: describeError(e), candidate }) }));
    }
  }, []);

  const discard = useCallback(async (item: ContentItem, candidate: string) => {
    const currentRoot = rootRef.current;
    if (!currentRoot) return;
    try {
      await api.generateDiscard(currentRoot, candidate);
      setJobs((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (e) {
      setJobs((prev) => ({ ...prev, [item.id]: jobWith("failed", { error: describeError(e), candidate }) }));
    }
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  const clear = useCallback(() => {
    if (!running) setJobs({});
  }, [running]);

  const progress = useMemo(() => summarizeJobs(jobs, running), [jobs, running]);

  return useMemo(
    () => ({ jobs, progress, start, accept, discard, abort, cancel, clear }),
    [jobs, progress, start, accept, discard, abort, cancel, clear],
  );
};
