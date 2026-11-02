export type StepId =
  | "concept"
  | "sites"
  | "zones"
  | "program"
  | "production"
  | "content"
  | "bait"
  | "maps"
  | "simulate"
  | "export";

export type CheckStatus = "ok" | "warn" | "missing";

export interface CheckTarget {
  site: string | null;
  zone: string | null;
}

export interface CheckItem {
  status: CheckStatus;
  label: string;
  hint: string;
  target: CheckTarget | null;
}

export interface StepReport {
  step: StepId;
  title: string;
  summary: string;
  progress: number;
  items: CheckItem[];
}

export interface StepMeta {
  id: StepId;
  title: string;
}

export interface StepPosterProps {
  step: StepId;
}

export interface StepPhotoProps {
  src: string;
}

export const STEP_ORDER: StepMeta[] = [
  { id: "concept", title: "Intent" },
  { id: "sites", title: "Locations" },
  { id: "zones", title: "Stages" },
  { id: "program", title: "Channels" },
  { id: "production", title: "Production" },
  { id: "content", title: "Narrative" },
  { id: "bait", title: "Bait" },
  { id: "maps", title: "Maps" },
  { id: "simulate", title: "Simulation" },
  { id: "export", title: "Distro" },
];
