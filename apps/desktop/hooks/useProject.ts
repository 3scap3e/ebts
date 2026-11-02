import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { EventSpec } from "@/types/event";
import type { StepId, StepReport } from "@/types/steps";
import type { AppMode, ProjectContextValue } from "@/types/project";
import { api, exampleRoot } from "@/hooks/api";
import { blankEvent } from "@/hooks/eventEdit";

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export const useProject = (): ProjectContextValue => {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProject must be used inside ProjectProvider");
  return value;
};

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);

export const useProjectState = (): ProjectContextValue => {
  const [root, setRoot] = useState<string | null>(null);
  const [event, setEvent] = useState<EventSpec | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reports, setReports] = useState<StepReport[]>([]);
  const [step, setStep] = useState<StepId>("concept");
  const [mode, setMode] = useState<AppMode>("build");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportTimer = useRef<number | null>(null);

  const run = useCallback(async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshReports = useCallback(async () => {
    if (!event) {
      setReports([]);
      return;
    }
    try {
      setReports(await api.stepsReport(event, root));
    } catch (e) {
      setError(describe(e));
    }
  }, [event, root]);

  useEffect(() => {
    if (reportTimer.current) window.clearTimeout(reportTimer.current);
    reportTimer.current = window.setTimeout(() => {
      void refreshReports();
    }, 250);
    return () => {
      if (reportTimer.current) window.clearTimeout(reportTimer.current);
    };
  }, [refreshReports]);

  const createProject = useCallback(
    (nextRoot: string, name: string) =>
      run(async () => {
        const created = await api.projectCreate(nextRoot, name);
        setRoot(nextRoot);
        setEvent(created);
        setDirty(false);
        setStep("concept");
        setMode("build");
      }),
    [run],
  );

  const openProject = useCallback(
    (nextRoot: string) =>
      run(async () => {
        const loaded = await api.projectOpen(nextRoot);
        setRoot(nextRoot);
        setEvent(loaded);
        setDirty(false);
        setStep("concept");
        setMode("build");
      }),
    [run],
  );

  const loadExample = useCallback(
    () =>
      run(async () => {
        const example = await api.exampleEvent();
        setRoot(await exampleRoot());
        setEvent(example);
        setDirty(false);
        setStep("concept");
        setMode("build");
      }),
    [run],
  );

  const startBlank = useCallback((name: string) => {
    setRoot(null);
    setEvent(blankEvent(name));
    setDirty(true);
    setStep("concept");
    setMode("build");
    setError(null);
  }, []);

  const save = useCallback(
    () =>
      run(async () => {
        if (!root || !event) throw new Error("Open or create a project folder before saving");
        await api.projectSave(root, event);
        setDirty(false);
      }),
    [run, root, event],
  );

  const update = useCallback((next: EventSpec | ((prev: EventSpec) => EventSpec)) => {
    setEvent((prev) => {
      if (!prev) return prev;
      return typeof next === "function" ? next(prev) : next;
    });
    setDirty(true);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      root,
      event,
      dirty,
      reports,
      step,
      mode,
      busy,
      error,
      createProject,
      openProject,
      loadExample,
      startBlank,
      save,
      update,
      setStep,
      setMode,
      refreshReports,
      clearError,
    }),
    [root, event, dirty, reports, step, mode, busy, error, createProject, openProject, loadExample, startBlank, save, update, refreshReports, clearError],
  );
};
