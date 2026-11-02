import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import type { PanDirection, PanOffset, PanSize, PanState } from "@/types/pan";

const STEP = 0.3;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.3;
const DRAG_THRESHOLD = 5;

const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
};

export const usePan = (aspect: number, heightScale = 1.25): PanState => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<PanSize>({ width: 0, height: 0 });
  const viewportSizeRef = useRef<PanSize>({ width: 0, height: 0 });
  const zoomRef = useRef(1);
  const offsetRef = useRef<PanOffset>({ x: 0, y: 0 });
  const centered = useRef(false);
  const pointers = useRef<Map<number, PanOffset>>(new Map());
  const dragStart = useRef<{ pointer: PanOffset; offset: PanOffset } | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const moved = useRef(0);
  const suppressClick = useRef(false);

  const [size, setSize] = useState<PanSize>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<PanSize>({ width: 0, height: 0 });
  const [offset, setOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);

  const limitFor = useCallback((z: number): PanOffset => {
    const base = baseRef.current;
    const vp = viewportSizeRef.current;
    return { x: Math.max(0, base.width * z - vp.width), y: Math.max(0, base.height * z - vp.height) };
  }, []);

  const clampOffset = useCallback((o: PanOffset, z: number): PanOffset => {
    const base = baseRef.current;
    const vp = viewportSizeRef.current;
    const w = base.width * z;
    const h = base.height * z;
    return {
      x: w <= vp.width ? (vp.width - w) / 2 : Math.min(0, Math.max(vp.width - w, o.x)),
      y: h <= vp.height ? (vp.height - h) / 2 : Math.min(0, Math.max(vp.height - h, o.y)),
    };
  }, []);

  const commit = useCallback(
    (o: PanOffset, z: number) => {
      zoomRef.current = z;
      offsetRef.current = clampOffset(o, z);
      setZoom(z);
      setOffset(offsetRef.current);
      setSize({ width: baseRef.current.width * z, height: baseRef.current.height * z });
    },
    [clampOffset],
  );

  const center = useCallback(
    (z: number) => {
      const lim = limitFor(z);
      commit({ x: -lim.x / 2, y: -lim.y / 2 }, z);
    },
    [commit, limitFor],
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      viewportSizeRef.current = { width: vw, height: vh };
      setViewport({ width: vw, height: vh });
      const height = Math.max(vh * heightScale, vw / aspect);
      baseRef.current = { width: height * aspect, height };
      if (!centered.current) {
        centered.current = true;
        center(zoomRef.current);
      } else {
        commit(offsetRef.current, zoomRef.current);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspect, heightScale, center, commit]);

  const zoomTo = useCallback(
    (next: number, focal?: PanOffset) => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      const vp = viewportSizeRef.current;
      const f = focal ?? { x: vp.width / 2, y: vp.height / 2 };
      const ratio = z / zoomRef.current;
      const o = offsetRef.current;
      commit({ x: f.x - (f.x - o.x) * ratio, y: f.y - (f.y - o.y) * ratio }, z);
    },
    [commit],
  );

  const zoomIn = useCallback(() => zoomTo(zoomRef.current * ZOOM_STEP), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(zoomRef.current / ZOOM_STEP), [zoomTo]);
  const reset = useCallback(() => center(1), [center]);

  const pan = useCallback(
    (direction: PanDirection) => {
      const vp = viewportSizeRef.current;
      const dx = vp.width * STEP;
      const dy = vp.height * STEP;
      const o = { ...offsetRef.current };
      if (direction === "left") o.x += dx;
      if (direction === "right") o.x -= dx;
      if (direction === "up") o.y += dy;
      if (direction === "down") o.y -= dy;
      commit(o, zoomRef.current);
    },
    [commit],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const map: Record<string, PanDirection> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      const direction = map[event.key];
      if (direction) {
        event.preventDefault();
        pan(direction);
        return;
      }
      if (event.key === "+" || event.key === "=") zoomIn();
      if (event.key === "-" || event.key === "_") zoomOut();
      if (event.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pan, zoomIn, zoomOut, reset]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-ui]")) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomTo(zoomRef.current * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  const localPoint = useCallback((event: PointerEvent): PanOffset => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }, []);

  const onWindowMove = useCallback(
    (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      const p = localPoint(event);
      pointers.current.set(event.pointerId, p);
      if (pointers.current.size >= 2 && pinchStart.current) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        moved.current = DRAG_THRESHOLD + 1;
        zoomTo((pinchStart.current.zoom * distance) / pinchStart.current.distance, mid);
        return;
      }
      if (dragStart.current) {
        const dx = p.x - dragStart.current.pointer.x;
        const dy = p.y - dragStart.current.pointer.y;
        moved.current = Math.max(moved.current, Math.hypot(dx, dy));
        commit({ x: dragStart.current.offset.x + dx, y: dragStart.current.offset.y + dy }, zoomRef.current);
      }
    },
    [commit, localPoint, zoomTo],
  );

  const onWindowUp = useCallback(
    (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 1) {
        const [p] = [...pointers.current.values()];
        dragStart.current = { pointer: p, offset: offsetRef.current };
        pinchStart.current = null;
        return;
      }
      if (pointers.current.size === 0) {
        dragStart.current = null;
        pinchStart.current = null;
        if (moved.current > DRAG_THRESHOLD) suppressClick.current = true;
        setDragging(false);
        window.removeEventListener("pointermove", onWindowMove);
        window.removeEventListener("pointerup", onWindowUp);
        window.removeEventListener("pointercancel", onWindowUp);
      }
    },
    [onWindowMove],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-ui]")) return;
    if (target.closest("button, a") && !target.closest("[data-hotspot]")) return;
    const p = localPoint(event.nativeEvent);
    const first = pointers.current.size === 0;
    pointers.current.set(event.pointerId, p);
    moved.current = 0;
    if (pointers.current.size === 1) {
      dragStart.current = { pointer: p, offset: offsetRef.current };
      pinchStart.current = null;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomRef.current };
      dragStart.current = null;
    }
    if (first) {
      window.addEventListener("pointermove", onWindowMove);
      window.addEventListener("pointerup", onWindowUp);
      window.addEventListener("pointercancel", onWindowUp);
    }
    setDragging(true);
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const eps = 0.5;
  const lim = limitFor(zoom);
  return {
    viewportRef,
    size,
    viewport,
    offset,
    zoom,
    dragging,
    overflowX: lim.x > eps,
    overflowY: lim.y > eps,
    can: {
      left: offset.x < -eps,
      right: offset.x > -lim.x + eps,
      up: offset.y < -eps,
      down: offset.y > -lim.y + eps,
    },
    canZoomIn: zoom < MAX_ZOOM - 0.001,
    canZoomOut: zoom > MIN_ZOOM + 0.001,
    pan,
    zoomIn,
    zoomOut,
    reset,
    handlers: { onPointerDown, onClickCapture },
  };
};
