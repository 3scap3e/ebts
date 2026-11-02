import type { ZonePreviewProps } from "@/types/map";

export default function ZonePreview({ view, imageUrl, loopUrl, label }: ZonePreviewProps) {
  return (
    <div className="flex relative flex-col w-full max-h-[72vh] overflow-auto rounded-md border border-[#daf822]/25 bg-black scroll-thin">
      <div
        className="flex relative w-full items-center justify-center overflow-hidden bg-black"
        style={{ aspectRatio: `${view.width} / ${view.height}` }}
      >
        {loopUrl ? (
          <video
            key={loopUrl}
            src={loopUrl}
            poster={imageUrl ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            draggable={false}
            className="flex absolute inset-0 w-full h-full object-cover select-none"
          />
        ) : imageUrl ? (
          <img src={imageUrl} alt="" draggable={false} className="flex absolute inset-0 w-full h-full object-cover select-none" />
        ) : (
          <div className="flex absolute inset-0 flex-col items-center justify-center bg-black">
            <span className="flex relative font-tanker text-[clamp(24px,5vw,64px)] uppercase tracking-[0.08em] text-[#daf822]">{label}</span>
            <span className="flex relative font-tanker text-[11px] uppercase tracking-[0.3em] text-[#009fdf]">
              {view.width}×{view.height} · no media yet
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
