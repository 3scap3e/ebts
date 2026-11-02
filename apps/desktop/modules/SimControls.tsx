import type { SimControlsProps } from "@/types/simulate";
import type { SimSpeed } from "@/types/simulate";
import { buttonClass, labelClass } from "@/hooks/theme";
import { addMinutesIso, utcLabel } from "@/hooks/time";
import { localAt, utcMinutesOf } from "@/hooks/simView";

const speeds: SimSpeed[] = [1, 2, 4];

const stepButtonClass =
  "flex relative flex-row items-center justify-center rounded-full border border-[#6e83c3] bg-black px-3 py-[6px] font-ocr text-[10px] uppercase leading-none tracking-[0.2em] text-[#6e83c3] transition hover:border-[#daf822] hover:text-[#daf822] disabled:opacity-50 disabled:pointer-events-none";

export default function SimControls({ clock, offsets }: SimControlsProps) {
  const { window: win, cursor, position, total, setPosition, playing, toggle, speed, setSpeed, step } = clock;
  if (!win || !cursor) {
    return (
      <div className="flex relative flex-col gap-2 px-4 py-2">
        <span className={labelClass}>Timeline</span>
        <span className="flex relative font-ocr text-[11px] uppercase tracking-[0.2em] text-[#6e83c3]">Computing window…</span>
      </div>
    );
  }
  const startMinute = utcMinutesOf(win.start_utc);
  const firstTick = (60 - (startMinute % 60)) % 60;
  const every = total / 60 > 14 ? 120 : 60;
  const ticks: number[] = [];
  for (let m = firstTick; m <= total; m += every) ticks.push(m);

  return (
    <div className="flex relative flex-col gap-2 px-4 pt-1 pb-2">
      <div className="flex relative flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex relative flex-row items-center gap-2">
          <button type="button" onClick={() => step(-1)} disabled={position <= 0} className={stepButtonClass} aria-label="Step back">
            −5m
          </button>
          <button type="button" onClick={toggle} className={`${buttonClass} min-w-[84px] py-[6px] text-[10px]`}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={() => step(1)} disabled={position >= total} className={stepButtonClass} aria-label="Step forward">
            +5m
          </button>
          <div className="flex relative flex-row rounded-sm border border-[#6e83c3]">
            {speeds.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`flex relative px-2 py-[5px] font-ocr text-[10px] uppercase tracking-[0.2em] ${speed === s ? "bg-[#daf822] text-black" : "text-[#6e83c3]"}`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
        <div className="flex relative flex-row flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="flex relative font-ocr text-[22px] uppercase leading-none tracking-[0.05em] text-[#daf822]">{utcLabel(cursor)}</span>
          {offsets.map((o) => (
            <span key={o.site} className="flex relative font-ocr text-[11px] text-[#009fdf]">
              {o.label} {localAt(cursor, o.offset)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex relative flex-col">
        <input
          type="range"
          min={0}
          max={total}
          step={5}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="flex relative w-full accent-[#daf822]"
          aria-label="Simulation cursor"
        />
        <div className="flex relative w-full" style={{ height: `${14 + offsets.length * 12}px` }}>
          {ticks.map((m) => {
            const iso = addMinutesIso(win.start_utc, m);
            return (
              <div
                key={m}
                className="flex absolute top-0 flex-col items-center -translate-x-1/2 font-ocr text-[9px] leading-[12px]"
                style={{ left: `${total > 0 ? (m / total) * 100 : 0}%` }}
              >
                <span className="flex relative h-1.5 w-px bg-[#6e83c3]" />
                <span className="flex relative text-[#6e83c3]">{utcLabel(iso).replace(" UTC", "")}</span>
                {offsets.map((o) => (
                  <span key={o.site} className="flex relative text-[#009fdf]">
                    {localAt(iso, o.offset)}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
