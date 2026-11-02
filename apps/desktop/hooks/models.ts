import type { ComfyExample, ModelProgress, ModelStatus } from "@/types/generate";

export const formatBytes = (bytes: number): string => {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} kB`;
};

export const examplePath = (id: string): string => `workflows/${id}.json`;

export const exampleForPath = (examples: ComfyExample[], path: string): ComfyExample | null => {
  const clean = path.trim().replace(/\\/g, "/");
  return examples.find((e) => clean === examplePath(e.id) || clean.endsWith(`/${examplePath(e.id)}`)) ?? null;
};

export const statusLabel = (status: ModelStatus | undefined, progress: ModelProgress | undefined): { text: string; tone: "ok" | "missing" | "dim" | "busy" } => {
  if (progress) {
    const pct = progress.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : null;
    return { text: pct === null ? formatBytes(progress.done) : `${pct}%`, tone: "busy" };
  }
  if (!status || status.present === null) return { text: "Unknown", tone: "dim" };
  return status.present ? { text: "On server", tone: "ok" } : { text: "Missing", tone: "missing" };
};

export const totalBytes = (example: ComfyExample): number => example.models.reduce((sum, m) => sum + m.bytes, 0);

export const missingBytes = (example: ComfyExample, statuses: ModelStatus[] | null): number =>
  statuses === null ? totalBytes(example) : statuses.filter((s) => s.present !== true).reduce((sum, s) => sum + s.bytes, 0);
