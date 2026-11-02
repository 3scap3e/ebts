import type { ReactNode } from "react";
import type { Hotspot, Site, Zone } from "@/types/event";

export type PlayLevel = "event" | "site" | "zone";

export interface PlayNav {
  level: PlayLevel;
  site: string | null;
  zone: string | null;
}

export interface PlayNavState {
  nav: PlayNav;
  goEvent: () => void;
  goSite: (site: string) => void;
  goZone: (site: string, zone: string) => void;
  back: () => void;
}

export interface MinimapSource {
  image: string | null;
  width: number;
  height: number;
  hotspots: Hotspot[];
  isWidget: boolean;
}

export interface MapViewerProps {
  image: string | null;
  loop: string | null;
  width: number;
  height: number;
  label: string;
  hotspots: Hotspot[];
  minimap: MinimapSource | null;
  onSelect: (target: string) => void;
  onBack: (() => void) | null;
  children?: ReactNode;
}

export interface MapScene {
  image: string | null;
  loop: string | null;
  poster: string | null;
  hotspots: Hotspot[];
  minimap: MinimapSource;
}

export interface ListEntry {
  id: string;
  label: string;
  sub: string;
}

export interface ListOverlayProps {
  title: string;
  entries: ListEntry[];
  defaultOpen: boolean;
  onSelect: (id: string) => void;
}

export interface UtcRange {
  min: number;
  max: number;
}

export interface PlayTimeState {
  utc: number;
  min: number;
  max: number;
  playing: boolean;
  setUtc: (ms: number) => void;
  toggle: () => void;
  utcMinutes: number;
  localMinutes: (site: Site) => number;
}

export interface PlayLocalClock {
  now: number;
  hm: string;
}

export interface PlayClockProps {
  time: PlayTimeState;
  site: Site | null;
}

export interface ItineraryPanelProps {
  site: Site;
  zone: Zone;
  now: number;
  defaultOpen?: boolean;
}

export interface ZoneViewProps {
  site: Site;
  zone: Zone;
  root: string | null;
  time: PlayTimeState;
  onBack: () => void;
}

export interface PlayPlaceholderProps {
  label: string;
}
