import { useState } from "react";
import type { MinimapProps } from "@/types/map";
import { centroid, clamp, isArea, isDrawn, pointsAttr, wrapLabel } from "@/hooks/geometry";

export default function Minimap({
  image,
  width,
  height,
  hotspots,
  view,
  defaultOpen = true,
  activeId = null,
  onActiveChange,
  onSelect,
}: MinimapProps) {
  const [open, setOpen] = useState(defaultOpen);
  const w = width;
  const h = height;
  const drawn = hotspots.filter((hs) => isDrawn(hs.polygon));
  const fontSize = Math.round(w * 0.028);
  const lineHeight = fontSize * 1.05;
  const charWidth = fontSize * 0.62;
  const stroke = w * 0.0035;
  const tick = w * 0.025;
  const labels = drawn
    .map((hotspot) => {
      const lines = wrapLabel(hotspot.label, 12);
      const labelWidth = Math.max(...lines.map((l) => l.length)) * charWidth;
      const labelHeight = lines.length * lineHeight;
      const c = centroid(hotspot.polygon);
      const pad = stroke * 2;
      return {
        id: hotspot.id,
        lines,
        width: labelWidth,
        height: labelHeight,
        x: clamp(c.x, labelWidth / 2 + pad, w - labelWidth / 2 - pad),
        y: clamp(c.y, labelHeight / 2 + pad, h - labelHeight / 2 - pad),
        active: activeId === hotspot.id,
      };
    })
    .sort((a, b) => Number(a.active) - Number(b.active));

  return (
    <div data-ui className="flex absolute right-4 top-4 z-20 flex-col items-end gap-2 md:right-6 md:top-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex relative flex-row items-center gap-3 rounded-sm border border-[#daf822]/60 bg-black px-3 py-2 text-[11px] uppercase leading-none tracking-[0.3em] text-[#daf822] transition hover:bg-[#daf822] hover:text-black"
      >
        <span className="flex relative items-center">{open ? "Hide map" : "Map"}</span>
      </button>
      {open ? (
        <div className="flex relative flex-col rounded-md border border-[#daf822]/40 bg-black p-[3px]">
          <div className="flex relative flex-col overflow-hidden rounded-[4px] border border-[#daf822]/25 bg-black">
            <div className="flex relative">
              <svg viewBox={`0 0 ${w} ${h}`} className="flex relative w-[46vw] max-w-[280px] md:w-[300px] md:max-w-none" role="img" aria-label="map">
                <defs>
                  <pattern id="minimap-grid" width={w / 16} height={w / 16} patternUnits="userSpaceOnUse">
                    <path d={`M ${w / 16} 0 L 0 0 0 ${w / 16}`} fill="none" stroke="#009fdf" strokeOpacity="0.14" strokeWidth={stroke * 0.6} />
                  </pattern>
                </defs>
                {image ? (
                  <image href={image} x="0" y="0" width={w} height={h} preserveAspectRatio="none" />
                ) : (
                  <rect x="0" y="0" width={w} height={h} fill="url(#minimap-grid)" />
                )}
                {drawn.map((hotspot) => {
                  const points = pointsAttr(hotspot.polygon);
                  const active = activeId === hotspot.id;
                  const area = isArea(hotspot.target);
                  return (
                    <g
                      key={hotspot.id}
                      role={area ? "img" : "link"}
                      aria-label={hotspot.label}
                      className={area ? "cursor-default" : "cursor-pointer"}
                      onMouseEnter={() => onActiveChange?.(hotspot.id)}
                      onMouseLeave={() => onActiveChange?.(null)}
                      onClick={() => {
                        if (!area) onSelect(hotspot.target);
                      }}
                    >
                      <polygon points={points} fill="#daf822" fillOpacity={active ? 0.35 : 0.06} className="transition" />
                      <polygon
                        points={points}
                        fill="none"
                        stroke={active ? "#ffffff" : "#daf822"}
                        strokeWidth={active ? stroke * 1.6 : stroke}
                        strokeLinejoin="round"
                        className="transition"
                      />
                    </g>
                  );
                })}
                {labels.map((label) => (
                  <g key={label.id} className="pointer-events-none">
                    {label.active ? (
                      <rect
                        x={label.x - label.width / 2 - stroke * 2}
                        y={label.y - label.height / 2 - stroke}
                        width={label.width + stroke * 4}
                        height={label.height + stroke * 2}
                        fill="#05060c"
                        fillOpacity="0.85"
                        stroke="#ffffff"
                        strokeWidth={stroke * 0.6}
                      />
                    ) : null}
                    <text
                      x={label.x}
                      y={label.y - label.height / 2 + lineHeight / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fontSize}
                      fill={label.active ? "#ffffff" : "#daf822"}
                      stroke="#05060c"
                      strokeWidth={label.active ? 0 : fontSize * 0.18}
                      paintOrder="stroke"
                      className="font-display uppercase"
                    >
                      {label.lines.map((line, i) => (
                        <tspan key={`${label.id}-${i}`} x={label.x} dy={i === 0 ? 0 : lineHeight}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                ))}
                {view ? (
                  <g className="pointer-events-none" stroke="#ffffff" strokeWidth={stroke * 1.2} fill="none">
                    <rect x={view.x} y={view.y} width={view.width} height={view.height} stroke="#ffffff" strokeOpacity="0.35" />
                    <path d={`M ${view.x} ${view.y + tick} V ${view.y} H ${view.x + tick}`} />
                    <path d={`M ${view.x + view.width - tick} ${view.y} H ${view.x + view.width} V ${view.y + tick}`} />
                    <path d={`M ${view.x + view.width} ${view.y + view.height - tick} V ${view.y + view.height} H ${view.x + view.width - tick}`} />
                    <path d={`M ${view.x + tick} ${view.y + view.height} H ${view.x} V ${view.y + view.height - tick}`} />
                  </g>
                ) : null}
              </svg>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
