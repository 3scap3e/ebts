import type { LiveZone } from "@/types/sim";
import type { SiteBoardProps } from "@/types/simulate";
import { panelClass, statusColor, statusLabel, zoneStateColor } from "@/hooks/theme";
import { pretty } from "@/hooks/time";
import SimTimeline from "@/modules/SimTimeline";

const fallback = (site: string, zone: string): LiveZone => ({
  site,
  zone,
  state: "closed",
  live: [],
  next: null,
  minutes_to_next: null,
});

export default function SiteBoard({ site, snap }: SiteBoardProps) {
  const open = snap?.open ?? false;

  return (
    <div className={`${panelClass} gap-3 p-4`}>
      <div className="flex relative flex-row flex-wrap items-baseline justify-between gap-3">
        <div className="flex relative flex-row items-baseline gap-3">
          <span className="flex relative font-display text-[22px] uppercase leading-none tracking-[0.05em] text-[#daf822]">{site.label}</span>
          <span className="flex relative text-[11px] uppercase tracking-[0.25em] text-white/50">
            {site.city} · {site.timezone}
          </span>
        </div>
        <div className="flex relative flex-row items-center gap-3">
          <span className="flex relative font-mono text-[18px] text-white">{snap?.local_time ?? "--:--"}</span>
          <span
            className="flex relative rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.25em]"
            style={{ borderColor: open ? "#7cff6b" : "#555", color: open ? "#7cff6b" : "#888" }}
          >
            {open ? "Open" : "Closed"}
          </span>
        </div>
      </div>
      <div className="flex relative flex-row flex-wrap gap-3">
        {site.zones.map((zone) => {
          const live = snap?.zones.find((z) => z.zone === zone.id) ?? fallback(site.id, zone.id);
          const color = zoneStateColor[live.state];
          return (
            <div
              key={zone.id}
              className="flex relative flex-col w-[260px] gap-2 rounded-sm border bg-black p-3"
              style={{ borderColor: color }}
            >
              <div className="flex relative flex-row items-center justify-between gap-2">
                <span className="flex relative truncate text-[12px] uppercase tracking-[0.15em] text-white/90">{zone.label}</span>
                <span className="flex relative shrink-0 text-[9px] uppercase tracking-[0.25em]" style={{ color }}>
                  {live.state}
                </span>
              </div>
              <SimTimeline site={site} zone={zone} localTime={snap?.local_time ?? null} />
              {live.live.length === 0 ? (
                <span className="flex relative text-[11px] text-white/40">Nothing live.</span>
              ) : (
                <ul className="flex relative flex-col gap-1.5">
                  {live.live.map((item) => (
                    <li key={item.id} className="flex relative flex-col gap-0.5 border-l-2 pl-2" style={{ borderColor: statusColor[item.status] }}>
                      <span className="flex relative text-[12px] leading-snug text-white">{item.title}</span>
                      <div className="flex relative flex-row flex-wrap items-center gap-2">
                        <span className="flex relative font-mono text-[10px] text-[#009fdf]">
                          {pretty(item.start)} – {pretty(item.end)}
                        </span>
                        <span
                          className="flex relative rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em]"
                          style={{ borderColor: statusColor[item.status], color: statusColor[item.status] }}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {live.next ? (
                <span className="flex relative text-[11px] text-white/55">
                  next in {live.minutes_to_next ?? "?"} min: <span className="flex relative text-white/85">{live.next.title}</span>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
