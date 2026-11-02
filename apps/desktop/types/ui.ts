import type { ReactNode } from "react";
import type { ContentItem } from "@/types/content";
import type { Contact, ContentOverride, EventSpec, MediaVariant, Person, PersonStatus, Production, ScheduleItem, Site, TimeWindow, Zone, ZoneTemplate } from "@/types/event";
import type { Conflict } from "@/types/sim";
import type { StepId, StepReport } from "@/types/steps";
import type { ComfyExample, ComfyuiConfig, GenerateJob, ProviderInfo, ProvidersState, ReactorConfig } from "@/types/generate";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
  compact?: boolean;
  placeholder?: string;
  searchable?: boolean;
}

export interface TabOption {
  id: string;
  label: string;
  count?: number;
}

export interface TabBarProps {
  tabs: TabOption[];
  active: string | null;
  onSelect: (id: string) => void;
  vertical?: boolean;
  emptyLabel?: string;
}

export type StepTitleSize = "normal" | "large";

export type StepAccent = "yellow" | "pink" | "none";

export interface StepFrameProps {
  step: StepId;
  intro?: string;
  title?: string;
  titleRight?: ReactNode;
  titleSize?: StepTitleSize;
  accent?: StepAccent;
  children: ReactNode;
  aside?: ReactNode;
}

export interface SectionToggleProps {
  open: boolean;
  onToggle: () => void;
  title: string;
  titleClass: string;
  meta?: string;
}

export interface StepperProps {
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (value: string) => void;
}

export interface ChecklistProps {
  report: StepReport | undefined;
}

export interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
  hint?: string;
  compact?: boolean;
}

export interface DeleteButtonProps {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  compact?: boolean;
  disabled?: boolean;
}

export interface PaletteEditorProps {
  palette: string[];
  onChange: (palette: string[]) => void;
}

export interface StringListEditorProps {
  label: string;
  items: string[];
  placeholder?: string;
  onChange: (items: string[]) => void;
}

export interface SiteCardProps {
  site: Site;
  index: number;
  total: number;
  onChange: (patch: (site: Site) => Site) => void;
  onRename: (id: string) => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
}

export interface ZoneCardProps {
  zone: Zone;
  site: Site;
  templates: ZoneTemplate[];
  index: number;
  total: number;
  onChange: (patch: (zone: Zone) => Zone) => void;
  onRename: (id: string) => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
}

export interface ZoneCatalogProps {
  templates: ZoneTemplate[];
  loading: boolean;
  error: string | null;
  onAdd: (template: ZoneTemplate) => void;
}

export interface ScheduleEditorProps {
  event: EventSpec;
  site: Site;
  zone: Zone;
  onChange: (items: ScheduleItem[]) => void;
  onBrief: (brief: string) => void;
}

export interface ScheduleRowProps {
  event: EventSpec;
  site: Site;
  zone: Zone;
  item: ScheduleItem;
  index: number;
  total: number;
  onChange: (patch: Partial<ScheduleItem>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
}

export interface ConflictListProps {
  conflicts: Conflict[] | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
}

export type ContentPart =
  | { kind: "event" }
  | { kind: "site"; site: string }
  | { kind: "zone"; site: string; zone: string };

export interface ContentGroup {
  key: string;
  title: string | null;
  items: ContentItem[];
}

export interface ProviderBarProps {
  state: ProvidersState;
  root: string | null;
  open: boolean;
}

export interface ComfySettingsProps {
  config: ComfyuiConfig;
  root: string | null;
  saving: boolean;
  onSave: (config: ComfyuiConfig) => Promise<void>;
}

export interface ModelsPanelProps {
  example: ComfyExample;
  root: string | null;
  baseUrl: string;
  modelsDir: string;
  onModelsDir: (dir: string) => void;
}

export interface ReactorSettingsProps {
  config: ReactorConfig;
  provider: ProviderInfo;
  root: string | null;
  saving: boolean;
  onSave: (config: ReactorConfig, apiKey: string | null) => Promise<void>;
}

export interface SlotCardProps {
  item: ContentItem;
  override: ContentOverride;
  poster: ContentItem | null;
  root: string | null;
  provider: ProviderInfo | null;
  job: GenerateJob | null;
  busy: boolean;
  onOverride: (patch: Partial<ContentOverride>) => void;
  onInitImage: (index: number, rel: string | null) => void;
  onGenerate: () => void;
  onAccept: (candidate: string) => void;
  onDiscard: (candidate: string) => void;
  onAbort: () => void;
}

export interface WindowsPanelProps {
  variants: MediaVariant[];
  utc: boolean;
  onAdd: () => void;
  onWindow: (index: number, window: TimeWindow) => void;
  onRemove: (index: number) => void;
}

export type WhoFilter = "all" | PersonStatus;

export interface PersonSlot {
  site: string;
  zone: string;
  item: string;
  label: string;
  time: string;
  where: string;
  production: Production;
}

export interface WhoEntry {
  key: string;
  name: string;
  person: Person | null;
  status: PersonStatus;
  slots: PersonSlot[];
}

export interface WhoCardProps {
  entry: WhoEntry;
  open: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<Person>) => void;
  onContact: (contact: Contact) => void;
  onRemoveContact: (index: number) => void;
  onSlotProduction: (slot: PersonSlot, state: Production) => void;
}
