import type { ReactNode } from "react";
import type { EventSpec, Hotspot, MediaVariant, Point, TimeWindow } from "@/types/event";

export type MapLevelKind = "event" | "event-widget" | "site" | "site-widget" | "zone";

export interface MapLevel {
  kind: MapLevelKind;
  site: string | null;
  zone: string | null;
}

export type MediaSlot = "image" | "loop";

export type HotspotSource = "image" | "video";

export type VariantSlot = "poster" | "loop_video" | "widget";

export interface VariantSlotOption {
  slot: VariantSlot;
  label: string;
  action: string;
}

export interface MediaView {
  image: string | null;
  loop: string | null;
  width: number;
  height: number;
  hotspots: Hotspot[];
}

export interface TargetEntry {
  target: string;
  label: string;
  polygon: Point[];
  window?: TimeWindow | null;
}

export interface LevelEntry {
  level: MapLevel;
  key: string;
  group: string;
  label: string;
  sub: string;
  drawn: number;
  total: number;
  hasImage: boolean;
  indent: number;
}

export type LevelSectionKind = "event" | "site";

export interface LevelSection {
  key: string;
  kind: LevelSectionKind;
  title: string;
  items: LevelEntry[];
  drawn: number;
  total: number;
  allImages: boolean;
}

export interface DraftPolygon {
  target: string;
  points: Point[];
}

export interface NaturalSize {
  width: number;
  height: number;
}

export interface VertexDrag {
  target: string;
  index: number;
  polygon: Point[];
  moved: boolean;
  inserted: boolean;
}

export interface MapEditorProps {
  event: EventSpec;
  level: MapLevel;
  onLevel: (level: MapLevel) => void;
}

export interface HotspotOutlineProps {
  polygon: Point[];
  width: number;
  height: number;
  color?: string;
  active?: boolean;
}

export interface MinimapView {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MinimapProps {
  image: string | null;
  width: number;
  height: number;
  hotspots: Hotspot[];
  view?: MinimapView;
  defaultOpen?: boolean;
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  onSelect: (target: string) => void;
}

export interface LevelRowProps {
  entry: LevelEntry;
  active: boolean;
  onSelect: () => void;
}

export interface LevelSectionHeaderProps {
  section: LevelSection;
  open: boolean;
  onToggle: () => void;
}

export interface HotspotSourceOption {
  id: HotspotSource;
  label: string;
}

export interface MapLevelListProps {
  entries: LevelEntry[];
  activeKey: string;
  onSelect: (level: MapLevel) => void;
}

export interface MediaToolbarProps {
  view: MediaView;
  natural: NaturalSize | null;
  allowLoop: boolean;
  busy: boolean;
  notice: string | null;
  onImportImage: () => void;
  onImportLoop: () => void;
  onClearLoop: () => void;
  onUseImageSize: () => void;
  onSize: (width: number, height: number) => void;
}

export interface HotspotSourceBarProps {
  source: HotspotSource;
  linked: boolean;
  frame: number;
  duration: number;
  busy: boolean;
  onSource: (source: HotspotSource) => void;
  onUnlink: () => void;
  onLink: () => void;
  onFrame: (seconds: number) => void;
}

export interface MapCanvasProps {
  view: MediaView;
  url: string | null;
  videoUrl?: string | null;
  frame?: number;
  previewAt?: string;
  onDuration?: (seconds: number) => void;
  targets: TargetEntry[];
  draft: DraftPolygon | null;
  activeTarget: string | null;
  maxPoints?: number;
  allowInsert?: boolean;
  overlay?: ReactNode;
  onCanvasPoint?: (point: Point) => void;
  onHover: (target: string | null) => void;
  onAddPoint: (point: Point) => void;
  onFinish: (points?: Point[]) => void;
  onVertexMove: (target: string, index: number, point: Point) => void;
  onVertexInsert?: (target: string, index: number, point: Point) => void;
  onVertexDelete: (target: string, index: number) => void;
  onNaturalSize: (size: NaturalSize) => void;
}

export interface HotspotListProps {
  targets: TargetEntry[];
  draft: DraftPolygon | null;
  activeTarget: string | null;
  defaultWindow: TimeWindow;
  utc: boolean;
  onWindow: (target: string, window: TimeWindow | null) => void;
  onHover: (target: string | null) => void;
  onDraw: (target: string) => void;
  onFinish: () => void;
  onUndoPoint: () => void;
  onCancel: () => void;
  onClear: (target: string) => void;
  onAddArea: () => void;
  onRenameArea: (target: string, label: string) => void;
  onRemoveArea: (target: string) => void;
}

export interface ZonePreviewProps {
  view: MediaView;
  imageUrl: string | null;
  loopUrl: string | null;
  label: string;
}

export interface WindowInputsProps {
  window: TimeWindow;
  utc: boolean;
  onChange: (window: TimeWindow) => void;
}

export interface MediaVariantsProps {
  variants: MediaVariant[];
  allowWidget: boolean;
  utc: boolean;
  busy: boolean;
  onAdd: () => void;
  onWindow: (index: number, window: TimeWindow) => void;
  onImport: (index: number, slot: VariantSlot) => void;
  onClear: (index: number, slot: VariantSlot) => void;
  onRemove: (index: number) => void;
}

export interface PreviewAtBarProps {
  value: string;
  utc: boolean;
  active: TimeWindow | null;
  onChange: (hm: string) => void;
}
