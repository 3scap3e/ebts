import type { EventSpec } from "./event";
import type { StepId, StepReport } from "./steps";

export type AppMode = "build" | "play";

export interface ProjectState {
  root: string | null;
  event: EventSpec | null;
  dirty: boolean;
  reports: StepReport[];
  step: StepId;
  mode: AppMode;
  busy: boolean;
  error: string | null;
}

export interface ProjectActions {
  createProject: (root: string, name: string) => Promise<void>;
  openProject: (root: string) => Promise<void>;
  loadExample: () => Promise<void>;
  startBlank: (name: string) => void;
  save: () => Promise<void>;
  update: (next: EventSpec | ((prev: EventSpec) => EventSpec)) => void;
  setStep: (step: StepId) => void;
  setMode: (mode: AppMode) => void;
  refreshReports: () => Promise<void>;
  clearError: () => void;
}

export type ProjectContextValue = ProjectState & ProjectActions;
