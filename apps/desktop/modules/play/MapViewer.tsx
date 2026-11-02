import { memo, useState } from "react";
import type { MapViewerProps } from "@/types/play";
import { usePan } from "@/hooks/usePan";
import { clipPathFor, isArea, isDrawn } from "@/hooks/geometry";
import HotspotOutline from "@/modules/HotspotOutline";
import Minimap from "@/modules/Minimap";
import PanArrows from "@/modules/PanArrows";
import ZoomControls from "@/modules/ZoomControls";
import PlayPlaceholder from "@/modules/play/PlayPlaceholder";

function MapViewer({ image, loop, width, height, label, hotspots, minimap, onSelect, onBack, children }: MapViewerProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { viewportRef, size, viewport, offset, zoom, dragging, can, overflowX, overflowY, canZoomIn, canZoomOut, pan, zoomIn, zoomOut, reset, handlers } =
    usePan(width / height, 1.25);
  const scale = size.width ? width / size.width : 0;
  const view = size.width
    ? {
        x: Math.max(0, -offset.x * scale),
        y: Math.max(0, -offset.y * scale),
        width: Math.min(width, viewport.width * scale),
        height: Math.min(height, viewport.height * scale),
      }
    : undefined;
  const drawn = hotspots.filter((hs) => isDrawn(hs.polygon));

  return (
    <div
      ref={viewportRef}
      {...handlers}
      className={`flex absolute inset-0 overflow-hidden bg-black select-none touch-none ${dragging ? "cursor-grabbing [&_button[data-hotspot]]:cursor-grabbing" : "cursor-grab"}`}
    >
      <div
        className={`flex absolute left-0 top-0 shrink-0 will-change-transform ${dragging ? "" : "transition-[transform,width,height] duration-500 ease-out"}`}
        style={{
          width: size.width ? `${size.width}px` : "100%",
          height: size.height ? `${size.height}px` : "100%",
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        }}
      >
        {loop ? (
          <video
            key={loop}
            src={loop}
            poster={image ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            draggable={false}
            className="flex relative w-full h-full object-cover pointer-events-none"
          />
        ) : image ? (
          <img src={image} alt={label} draggable={false} className="flex absolute inset-0 w-full h-full object-cover select-none pointer-events-none" />
        ) : (
          <PlayPlaceholder label={label} />
        )}
        {drawn.map((hotspot) => {
          const area = isArea(hotspot.target);
          return (
            <div key={hotspot.id} className="group flex absolute inset-0 pointer-events-none">
              <button
                type="button"
                aria-label={hotspot.label}
                data-hotspot
                draggable={false}
                onMouseEnter={() => setActiveId(hotspot.id)}
                onMouseLeave={() => setActiveId(null)}
                onClick={() => {
                  if (!area) onSelect(hotspot.target);
                }}
                className={`flex absolute inset-0 z-10 pointer-events-auto border-0 bg-transparent p-0 ${area ? "cursor-grab" : "cursor-pointer"}`}
                style={{ clipPath: clipPathFor(hotspot.polygon, width, height) }}
              />
              <HotspotOutline polygon={hotspot.polygon} width={width} height={height} active={activeId === hotspot.id} />
            </div>
          );
        })}
      </div>
      {onBack ? (
        <button
          type="button"
          data-ui
          onClick={onBack}
          className="flex absolute left-4 top-4 z-20 flex-row items-center gap-2 rounded-full border border-[#daf822]/70 bg-black px-4 py-2 text-[12px] uppercase leading-none tracking-[0.2em] text-[#daf822] transition hover:bg-[#daf822] hover:text-black md:left-6 md:top-6"
        >
          <svg viewBox="0 0 24 24" className="flex relative w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5" />
            <path d="M12 5l-7 7 7 7" />
          </svg>
          <span className="flex relative items-center">Back</span>
        </button>
      ) : null}
      {minimap ? (
        <Minimap
          image={minimap.image}
          width={minimap.width}
          height={minimap.height}
          hotspots={minimap.hotspots}
          view={minimap.isWidget ? undefined : view}
          activeId={activeId}
          onActiveChange={setActiveId}
          onSelect={onSelect}
        />
      ) : null}
      <ZoomControls zoom={zoom} canZoomIn={canZoomIn} canZoomOut={canZoomOut} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} />
      <PanArrows can={can} overflowX={overflowX} overflowY={overflowY} onPan={pan} />
      {children}
    </div>
  );
}

export default memo(MapViewer);
