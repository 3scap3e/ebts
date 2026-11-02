import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Point } from "@/types/event";
import type { MapCanvasProps, VertexDrag } from "@/types/map";
import { centroid, clampPoint, edgeMidpoints, isDrawn, pointsAttr, svgPoint } from "@/hooks/geometry";
import { inWindow } from "@/hooks/timeWindows";

export default function MapCanvas({
  view,
  url,
  videoUrl = null,
  frame = 0,
  previewAt,
  onDuration,
  targets,
  draft,
  activeTarget,
  maxPoints,
  allowInsert = true,
  overlay,
  onCanvasPoint,
  onHover,
  onAddPoint,
  onFinish,
  onVertexMove,
  onVertexInsert,
  onVertexDelete,
  onNaturalSize,
}: MapCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [drag, setDrag] = useState<VertexDrag | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoUrl) return;
    el.pause();
    if (el.readyState >= 1 && Math.abs(el.currentTime - frame) > 0.01) el.currentTime = frame;
  }, [frame, videoUrl]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const w = view.width;
  const h = view.height;
  const stroke = Math.max(2, w * 0.003);
  const handle = Math.max(5, w * 0.008);
  const fontSize = Math.round(w * 0.022);
  const cell = w / 20;
  const canInsert = allowInsert && !draft && Boolean(onVertexInsert);

  const toMedia = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const p = svgPoint(svg, clientX, clientY);
    return p ? clampPoint(p, w, h) : null;
  };

  const onCanvasClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (e.detail > 1) return;
    const p = toMedia(e.clientX, e.clientY);
    if (!p) return;
    if (!draft) {
      if (onCanvasPoint) onCanvasPoint(p);
      return;
    }
    onAddPoint(p);
    const next = [...draft.points, p];
    if (maxPoints && next.length >= maxPoints) onFinish(next);
  };

  const onCanvasDouble = (e: ReactMouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (draft) onFinish();
  };

  const onCanvasMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft) return;
    setCursor(toMedia(e.clientX, e.clientY));
  };

  const startDrag = (e: ReactPointerEvent<SVGCircleElement>, target: string, index: number, polygon: Point[]) => {
    e.stopPropagation();
    if (draft) return;
    if (e.altKey) {
      onVertexDelete(target, index);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ target, index, polygon, moved: false, inserted: false });
  };

  const startInsert = (e: ReactPointerEvent<SVGCircleElement>, target: string, edge: number, polygon: Point[], point: Point) => {
    e.stopPropagation();
    if (!canInsert) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const index = edge + 1;
    setDrag({ target, index, polygon: [...polygon.slice(0, index), point, ...polygon.slice(index)], moved: false, inserted: true });
  };

  const moveDrag = (e: ReactPointerEvent<SVGCircleElement>) => {
    if (!drag) return;
    const p = toMedia(e.clientX, e.clientY);
    if (!p) return;
    setDrag({ ...drag, moved: true, polygon: drag.polygon.map((pt, i) => (i === drag.index ? p : pt)) });
  };

  const endDrag = (e: ReactPointerEvent<SVGCircleElement>) => {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag.inserted) onVertexInsert?.(drag.target, drag.index, drag.polygon[drag.index]);
    else if (drag.moved) onVertexMove(drag.target, drag.index, drag.polygon[drag.index]);
    setDrag(null);
  };

  const stop = (e: ReactMouseEvent<SVGElement>) => e.stopPropagation();
  const drawn = targets
    .filter((t) => isDrawn(t.polygon))
    .sort((a, b) => Number(a.target === activeTarget) - Number(b.target === activeTarget));
  const draftPoints = draft?.points ?? [];
  const last = draftPoints[draftPoints.length - 1];
  const canClose = draftPoints.length >= 3;

  const closeDraft = (e: ReactMouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    if (canClose) onFinish();
  };

  return (
    <div className="flex relative flex-col w-full items-start overflow-visible bg-black p-3">
      <div className="flex relative w-full overflow-visible" style={{ aspectRatio: `${w} / ${h}`, maxWidth: `calc(78vh * ${w} / ${h})` }}>
        {videoUrl ? (
          <video
            key={videoUrl}
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            draggable={false}
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              el.pause();
              el.currentTime = frame;
              onNaturalSize({ width: el.videoWidth, height: el.videoHeight });
              onDuration?.(Number.isFinite(el.duration) ? el.duration : 0);
            }}
            className="flex absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
          />
        ) : url ? (
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => onNaturalSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            className="flex absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
          />
        ) : null}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          onClick={onCanvasClick}
          onDoubleClick={onCanvasDouble}
          onPointerMove={onCanvasMove}
          onPointerLeave={() => setCursor(null)}
          overflow="visible"
          className={`flex absolute inset-0 w-full h-full select-none touch-none overflow-visible ${draft || onCanvasPoint ? "cursor-crosshair" : ""}`}
        >
          <defs>
            <pattern id="editor-grid" width={cell} height={cell} patternUnits="userSpaceOnUse">
              <path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke="#daf822" strokeOpacity="0.12" strokeWidth={stroke * 0.5} />
            </pattern>
          </defs>
          {!url && !videoUrl ? (
            <g>
              <rect x="0" y="0" width={w} height={h} fill="#000000" />
              <rect x="0" y="0" width={w} height={h} fill="url(#editor-grid)" />
              <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize * 1.4} fill="#daf822" className="font-display uppercase">
                No poster · {w}×{h}
              </text>
            </g>
          ) : null}
          {drawn.map((t) => {
            const polygon = drag?.target === t.target ? drag.polygon : t.polygon;
            const active = activeTarget === t.target;
            const dim = activeTarget !== null && !active;
            const off = previewAt !== undefined && t.window ? !inWindow(previewAt, t.window) : false;
            const c = centroid(polygon);
            return (
              <g key={t.target} onMouseEnter={() => onHover(t.target)} onMouseLeave={() => onHover(null)}>
                <polygon
                  points={pointsAttr(polygon)}
                  fill="#daf822"
                  fillOpacity={off ? 0.02 : active ? 0.25 : dim ? 0.04 : 0.08}
                  stroke="#daf822"
                  strokeOpacity={off ? 0.25 : active ? 1 : dim ? 0.4 : 0.7}
                  strokeWidth={active ? stroke * 1.6 : stroke}
                  strokeLinejoin="round"
                  strokeDasharray={off ? `${stroke * 3} ${stroke * 3}` : undefined}
                  className="transition"
                />
                <text
                  x={c.x}
                  y={c.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fill="#daf822"
                  fillOpacity={off ? 0.3 : dim ? 0.5 : 1}
                  stroke="#05060c"
                  strokeWidth={fontSize * 0.18}
                  paintOrder="stroke"
                  className="font-display uppercase pointer-events-none"
                >
                  {t.label}
                </text>
                {canInsert
                  ? edgeMidpoints(polygon).map((m, i) => (
                      <circle
                        key={`${t.target}-mid-${i}`}
                        cx={m.x}
                        cy={m.y}
                        r={handle * 0.75}
                        fill="#06060a"
                        fillOpacity={0.6}
                        stroke={active ? "#ffffff" : "#daf822"}
                        strokeOpacity={active ? 0.9 : 0.5}
                        strokeWidth={stroke * 0.7}
                        strokeDasharray={`${stroke} ${stroke}`}
                        className="cursor-copy"
                        onPointerDown={(e) => startInsert(e, t.target, i, polygon, m)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onClick={stop}
                        onDoubleClick={stop}
                      />
                    ))
                  : null}
                {polygon.map((p, i) => (
                  <circle
                    key={`${t.target}-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={handle}
                    fill="#06060a"
                    stroke={active ? "#ffffff" : "#daf822"}
                    strokeOpacity={dim ? 0.5 : 1}
                    strokeWidth={stroke}
                    className={draft ? "" : "cursor-move"}
                    onPointerDown={(e) => startDrag(e, t.target, i, polygon)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClick={stop}
                    onDoubleClick={stop}
                  />
                ))}
              </g>
            );
          })}
          {overlay}
          {draft ? (
            <g>
              <g className="pointer-events-none">
                {draftPoints.length >= 2 ? (
                  <polyline points={pointsAttr(draftPoints)} fill="none" stroke="#009fdf" strokeWidth={stroke * 1.2} strokeLinejoin="round" />
                ) : null}
                {last && cursor ? <line x1={last.x} y1={last.y} x2={cursor.x} y2={cursor.y} stroke="#009fdf" strokeOpacity="0.6" strokeWidth={stroke} strokeDasharray={`${stroke * 3} ${stroke * 3}`} /> : null}
                {canClose ? (
                  <line x1={last.x} y1={last.y} x2={draftPoints[0].x} y2={draftPoints[0].y} stroke="#009fdf" strokeOpacity="0.3" strokeWidth={stroke} strokeDasharray={`${stroke * 2} ${stroke * 4}`} />
                ) : null}
                {draftPoints.slice(1).map((p, i) => (
                  <circle key={`draft-${i + 1}`} cx={p.x} cy={p.y} r={handle} fill="#009fdf" stroke="#05060c" strokeWidth={stroke * 0.6} />
                ))}
              </g>
              {draftPoints[0] ? (
                <circle
                  cx={draftPoints[0].x}
                  cy={draftPoints[0].y}
                  r={handle * 1.3}
                  fill={canClose ? "#ffffff" : "#009fdf"}
                  stroke={canClose ? "#009fdf" : "#05060c"}
                  strokeWidth={canClose ? stroke : stroke * 0.6}
                  className={canClose ? "cursor-pointer" : "pointer-events-none"}
                  onClick={closeDraft}
                  onDoubleClick={stop}
                />
              ) : null}
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
