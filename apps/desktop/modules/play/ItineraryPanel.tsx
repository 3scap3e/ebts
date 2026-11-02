import { useEffect, useRef, useState } from "react";
import type { ItineraryPanelProps } from "@/types/play";
import { statusColor, statusLabel } from "@/hooks/theme";
import { pretty, toMinutes } from "@/hooks/time";
import { minutesInSpan, siteSpan } from "@/hooks/simView";

export default function ItineraryPanel({ site, zone, now, defaultOpen = true }: ItineraryPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const liveRef = useRef<HTMLLIElement | null>(null);
  const span = siteSpan(site);
  const hours = `${pretty(zone.open ?? site.open)} – ${pretty(zone.close ?? site.close)}`;
  const meta: [string, string][] = [
    ["Zone", zone.label],
    ["Format", zone.format.replace(/-/g, " ")],
    ["Who", zone.who],
    ["What", zone.what],
    ["Hours", hours],
    ["Rhythm", zone.rhythm.replace(/-/g, " ")],
  ];
  const items = [...zone.schedule]
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    .map((item) => {
      const start = minutesInSpan(item.start, span);
      let end = minutesInSpan(item.end, span);
      if (end <= start) end += 1440;
      const live = start <= now && now < end;
      const past = end <= now;
      return { item, live, past };
    });
  const liveId = items.find((i) => i.live)?.item.id ?? null;

  useEffect(() => {
    liveRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [liveId]);

  return (
    <div data-ui className="flex absolute right-4 top-4 z-20 flex-col items-end gap-2 md:right-6 md:top-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex relative flex-row items-center gap-3 rounded-sm border border-[#daf822]/60 bg-black px-3 py-2 text-[11px] uppercase leading-none tracking-[0.3em] text-[#daf822] transition hover:bg-[#daf822] hover:text-black"
      >
        <span className="flex relative items-center">{open ? "Hide itinerary" : "Itinerary"}</span>
      </button>
      {open ? (
        <div className="flex relative flex-col w-[min(92vw,360px)] max-h-[calc(100vh-220px)] rounded-md border border-[#daf822]/40 bg-black p-3">
          <div className="flex relative flex-col flex-1 min-h-0 gap-2 text-[#daf822]">
            <div className="flex relative flex-col gap-1 border-b border-[#daf822]/25 pb-2">
              {meta.map(([label, value]) => (
                <div key={label} className="flex relative flex-row items-baseline gap-3">
                  <span className="flex relative w-16 shrink-0 text-[10px] uppercase tracking-[0.25em] text-[#009fdf]">{label}</span>
                  <span className="flex relative text-[12px] uppercase leading-snug tracking-[0.1em]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex relative flex-row items-center justify-between text-[11px] uppercase tracking-[0.3em] text-[#009fdf]">
              <span className="flex relative">Schedule</span>
              <span className="flex relative">{zone.schedule.length} slots</span>
            </div>
            <ol className="flex relative flex-col flex-1 min-h-0 gap-1.5 overflow-y-auto pr-1.5 pb-2 scroll-thin">
              {items.length === 0 ? <li className="flex relative text-[12px] text-white/50">No itinerary yet.</li> : null}
              {items.map(({ item, live, past }) => (
                <li
                  key={item.id}
                  ref={live ? liveRef : null}
                  className={`flex relative flex-col gap-0.5 border-l-2 pl-2 transition ${
                    live ? "border-[#7cff6b] pulse-live" : past ? "border-white/15 opacity-40" : "border-[#daf822]/50"
                  }`}
                >
                  <div className="flex relative flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="flex relative font-mono text-[12px] tracking-[0.1em] text-[#009fdf]">
                      {pretty(item.start)} – {pretty(item.end)}
                    </span>
                    <div className="flex relative flex-row items-center gap-1.5">
                      {live ? <span className="flex relative rounded-sm bg-[#7cff6b] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.25em] text-black">now</span> : null}
                      <span
                        className="flex relative rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.25em]"
                        style={{ borderColor: statusColor[item.status], color: statusColor[item.status] }}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>
                  </div>
                  <span className="flex relative font-display text-[17px] uppercase leading-snug tracking-[0.06em]">{item.title}</span>
                  <span className="flex relative text-[11px] uppercase tracking-[0.2em] text-[#daf822]/70">{item.kind}</span>
                  {item.description ? <span className="flex relative font-sans text-[13px] leading-snug text-white/80">{item.description}</span> : null}
                  {item.who ? <span className="flex relative text-[11px] uppercase tracking-[0.2em] text-[#009fdf]/90">{item.who}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
