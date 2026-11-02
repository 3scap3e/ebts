import type { ScheduleItem } from "./event";

export type ZoneState = "closed" | "crew" | "idle" | "live";

export interface LiveZone {
  site: string;
  zone: string;
  state: ZoneState;
  live: ScheduleItem[];
  next: ScheduleItem | null;
  minutes_to_next: number | null;
}

export interface SiteSnapshot {
  site: string;
  local_time: string;
  open: boolean;
  zones: LiveZone[];
}

export interface LinkEnd {
  site: string;
  zone: string;
}

export interface ActiveLink {
  from: LinkEnd;
  to: LinkEnd;
  item: string;
  active: boolean;
}

export interface Snapshot {
  utc: string;
  sites: SiteSnapshot[];
  links: ActiveLink[];
  headline: string;
}

export interface SimWindow {
  start_utc: string;
  end_utc: string;
}

export type ConflictSeverity = "warn" | "error";

export interface Conflict {
  severity: ConflictSeverity;
  message: string;
  site: string | null;
  zone: string | null;
  item: string | null;
}
