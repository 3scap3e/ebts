import type { PlayClockProps } from "@/types/play";
import { pretty } from "@/hooks/time";
import { hmIn, utcHm } from "@/hooks/tz";

export default function PlayClock({ time, site }: PlayClockProps) {
  const { utc, min, max, playing, setUtc, toggle } = time;
  const readout = pretty(site ? hmIn(utc, site.timezone) : utcHm(utc));
  const label = site ? site.label : "UTC";

  return (
    <div data-ui className="flex absolute bottom-0 left-0 right-0 z-20 flex-row items-center gap-4 border-t border-[#daf822]/30 bg-black px-4 py-3 md:px-6">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex relative w-10 h-10 shrink-0 items-center justify-center rounded-full border border-[#daf822]/70 bg-black text-[#daf822] transition hover:bg-[#daf822] hover:text-black"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="flex relative w-4 h-4" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" />
            <rect x="14" y="5" width="4" height="14" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="flex relative w-4 h-4" fill="currentColor" aria-hidden>
            <path d="M7 4l13 8-13 8z" />
          </svg>
        )}
      </button>
      <div className="flex relative flex-col shrink-0 min-w-[120px] max-w-[220px]">
        <span className="flex relative font-tanker text-[24px] uppercase leading-none tracking-[0.05em] text-[#daf822]">{readout}</span>
        <span className="flex relative truncate text-[9px] uppercase tracking-[0.3em] text-[#009fdf]">{label}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={60000}
        value={utc}
        onChange={(e) => setUtc(Number(e.target.value))}
        className="flex relative flex-1 accent-[#daf822]"
        aria-label="Event time"
      />
      <span className="flex relative shrink-0 font-mono text-[11px] text-white/50">
        {utcHm(min)} – {utcHm(max)} UTC
      </span>
    </div>
  );
}
