import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";

export interface PanOffset {
  x: number;
  y: number;
}

export type PanDirection = "up" | "down" | "left" | "right";

export interface PanSize {
  width: number;
  height: number;
}

export interface PanHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

export interface PanState {
  viewportRef: RefObject<HTMLDivElement | null>;
  size: PanSize;
  viewport: PanSize;
  offset: PanOffset;
  zoom: number;
  dragging: boolean;
  can: Record<PanDirection, boolean>;
  overflowX: boolean;
  overflowY: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  pan: (direction: PanDirection) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  handlers: PanHandlers;
}

export interface ZoomControlsProps {
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export interface PanArrowsProps {
  can: Record<PanDirection, boolean>;
  overflowX: boolean;
  overflowY: boolean;
  onPan: (direction: PanDirection) => void;
}
