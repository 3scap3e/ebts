import type { ReactNode } from "react";
import type { EventSpec, Site, Zone } from "@/types/event";
import type { ActiveLink, LiveZone, SimWindow, SiteSnapshot, Snapshot } from "@/types/sim";

export type SimSpeed = 1 | 2 | 4;

export interface SimClock {
  window: SimWindow | null;
  cursor: string | null;
  position: number;
  total: number;
  setPosition: (minutes: number) => void;
  playing: boolean;
  toggle: () => void;
  speed: SimSpeed;
  setSpeed: (speed: SimSpeed) => void;
  step: (direction: -1 | 1) => void;
}

export interface SnapshotState {
  snapshot: Snapshot | null;
  loading: boolean;
  error: string | null;
}

export interface SiteOffset {
  site: string;
  label: string;
  offset: number;
}

export interface SimControlsProps {
  clock: SimClock;
  offsets: SiteOffset[];
}

export interface SharedSimClock extends SnapshotState {
  clock: SimClock;
  offsets: SiteOffset[];
}

export interface SimClockProviderProps {
  children: ReactNode;
}

export interface SiteBoardProps {
  site: Site;
  snap: SiteSnapshot | null;
}

export interface SimTimelineProps {
  site: Site;
  zone: Zone;
  localTime: string | null;
}

export interface ZoneWallProps {
  event: EventSpec;
  cursor: string | null;
  snapshot: Snapshot | null;
  playing: boolean;
}

export interface ZoneScreenProps {
  site: Site;
  zone: Zone;
  hm: string;
  live: LiveZone | null;
  playing: boolean;
  width: string;
}

export interface LinksStripProps {
  event: EventSpec;
  links: ActiveLink[];
}
