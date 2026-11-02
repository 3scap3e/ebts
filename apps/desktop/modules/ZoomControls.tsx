import type { ZoomControlsProps } from "@/types/pan";

const button =
  "flex relative w-10 h-10 items-center justify-center rounded-full border border-[#daf822]/70 bg-black text-[#daf822] transition hover:bg-[#daf822] hover:text-black disabled:opacity-60 disabled:pointer-events-none";

const icon = "flex relative w-5 h-5";

export default function ZoomControls({ zoom, canZoomIn, canZoomOut, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  const atDefault = Math.abs(zoom - 1) < 0.001;

  return (
    <div data-ui className="flex absolute bottom-20 left-4 z-20 flex-col items-center gap-2 md:bottom-24 md:left-6">
      <button type="button" aria-label="Zoom in" onClick={onZoomIn} disabled={!canZoomIn} className={button}>
        <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button type="button" aria-label="Zoom out" onClick={onZoomOut} disabled={!canZoomOut} className={button}>
        <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M5 12h14" />
        </svg>
      </button>
      <button type="button" aria-label="Reset view" onClick={onReset} disabled={atDefault} className={button}>
        <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      </button>
      <span className="flex relative text-[10px] uppercase tracking-[0.2em] text-[#daf822]/80">{Math.round(zoom * 100)}%</span>
    </div>
  );
}
