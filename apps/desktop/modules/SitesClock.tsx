import { useState } from "react";
import type { EventSpec } from "@/types/event";
import { labelClass, panelClass } from "@/hooks/theme";
import Select from "@/modules/Select";
import { pretty } from "@/hooks/time";
import { TIMEZONES } from "@/hooks/timezones";
import { hmIn, shortZone, siteUtcSpan } from "@/hooks/tz";

export default function SitesClock({ event }: { event: EventSpec }) {
  const [reference, setReference] = useState("UTC");
  const spans = event.sites.map((site) => ({ site, span: siteUtcSpan(event.date, site) }));
  const valid = spans.flatMap((s) => (s.span ? [s.span] : []));
  const hours = (openUtc: number, closeUtc: number): string => {
    const h = (closeUtc - openUtc) / 3600000;
    return `${Number.isInteger(h) ? h : h.toFixed(1)} hrs`;
  };
  const zones = Array.from(new Set([...TIMEZONES, ...event.sites.map((s) => s.timezone)]));
  const sample = valid[0]?.openUtc ?? Date.now();
  const tag = shortZone(reference, sample);

  return (
    <div className={`${panelClass} gap-3 p-4`}>
      <div className="flex relative flex-row items-center justify-between gap-3">
        <span className={labelClass}>Clock</span>
        <Select compact className="w-[190px]" value={reference} options={zones.map((tz) => ({ value: tz, label: tz }))} onChange={setReference} />
      </div>
      <div className="flex relative flex-col gap-2">
        {spans.map(({ site, span }) => (
          <div key={site.id} className="flex relative flex-col gap-0.5 border-l-2 border-[#daf822]/40 pl-2">
            <span className="flex relative font-tanker text-[13px] uppercase tracking-[0.15em] text-[#daf822]">
              {site.label}
              {span ? <span className="flex relative ml-2 text-white/60">({hours(span.openUtc, span.closeUtc)})</span> : null}
            </span>
            <span className="flex relative font-mono text-[11px] text-white/70">
              {pretty(site.open)} – {pretty(site.close)} local
            </span>
            <span className="flex relative font-mono text-[11px] text-[#009fdf]">
              {span ? `${hmIn(span.openUtc, reference)} – ${hmIn(span.closeUtc, reference)} ${tag}` : "timezone not recognised"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
