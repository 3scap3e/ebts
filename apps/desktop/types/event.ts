export interface Point {
  x: number;
  y: number;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface MediaVariant {
  window: TimeWindow;
  poster: string | null;
  loop_video: string | null;
  widget: string | null;
}

export interface Hotspot {
  id: string;
  label: string;
  target: string;
  polygon: Point[];
  window: TimeWindow | null;
}

export interface WidgetMedia {
  image: string | null;
  width: number;
  height: number;
  hotspots: Hotspot[];
}

export interface MapMedia {
  poster: string | null;
  loop_video: string | null;
  width: number;
  height: number;
  hotspots: Hotspot[];
  video_hotspots: Hotspot[] | null;
  widget: WidgetMedia | null;
  variants: MediaVariant[];
}

export interface ZoneMedia {
  poster: string | null;
  loop_video: string | null;
  width: number;
  height: number;
  variants: MediaVariant[];
}

export interface StyleGuide {
  art_direction: string;
  palette: string[];
  mood: string;
  references: string[];
  avoid: string;
}

export type ZoneFormat =
  | "salon"
  | "demo-station"
  | "performance-zone"
  | "screening-room"
  | "mingle-space"
  | "tinker-space"
  | "video-wall"
  | "spatial-installation"
  | "telepresence-zone"
  | "refractory"
  | "back-of-house"
  | "custom";

export type Rhythm =
  | "continuous"
  | "scheduled"
  | "open-plus-scheduled"
  | "loops"
  | "crew-only";

export type ScheduleStatus =
  | "feed-up"
  | "linked"
  | "scheduled"
  | "open"
  | "food-service"
  | "installed"
  | "on-floor"
  | "interstitial"
  | "load-in"
  | "crew"
  | "strike"
  | "screening"
  | "workshop"
  | "room-change";

export type Production = "idea" | "in-progress" | "confirmed" | "cancelled";

export interface Task {
  id: string;
  label: string;
  done: boolean;
  owner: string;
}

export type PersonStatus = "not-contacted" | "contacted" | "confirmed" | "declined";

export interface Contact {
  date: string;
  channel: string;
  note: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  contact: string;
  status: PersonStatus;
  notes: string;
  log: Contact[];
}

export interface TaskScope {
  site: string | null;
  zone: string | null;
  item: string | null;
}

export interface ScheduleLink {
  site: string;
  zone: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  kind: string;
  description: string;
  start: string;
  end: string;
  who: string;
  channel: string;
  status: ScheduleStatus;
  link: ScheduleLink | null;
  production: Production;
  tasks: Task[];
}

export interface Zone {
  id: string;
  label: string;
  format: ZoneFormat;
  who: string;
  what: string;
  brief: string;
  rhythm: Rhythm;
  open: string | null;
  close: string | null;
  capacity: number;
  media: ZoneMedia;
  schedule: ScheduleItem[];
  tasks: Task[];
}

export interface Site {
  id: string;
  label: string;
  city: string;
  venue: string;
  timezone: string;
  open: string;
  close: string;
  crew_open: string;
  crew_close: string;
  zones: Zone[];
  map: MapMedia;
  tasks: Task[];
}

export interface SamplerOverride {
  steps: number | null;
  cfg: number | null;
  denoise: number | null;
}

export interface ContentOverride {
  prompt: string | null;
  negative_prompt: string;
  init_images: string[];
  seed: number | null;
  sampler: SamplerOverride;
}

export interface EventSpec {
  version: number;
  id: string;
  name: string;
  date: string;
  description: string;
  style: StyleGuide;
  sites: Site[];
  map: MapMedia;
  people: Person[];
  tasks: Task[];
  content: Record<string, ContentOverride>;
}

export interface ZoneTemplate {
  format: ZoneFormat;
  label: string;
  id_prefix: string;
  who: string;
  what: string;
  rhythm: Rhythm;
  description: string;
  prompt_subject: string;
}
