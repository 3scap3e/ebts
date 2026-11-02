import type { LinksStripProps } from "@/types/simulate";
import { labelClass, panelClass } from "@/hooks/theme";
import { siteLabel, zoneLabel } from "@/hooks/simView";

export default function LinksStrip({ event, links }: LinksStripProps) {
  if (links.length === 0) return null;
  const active = links.filter((l) => l.active).length;

  return (
    <div className={`${panelClass} gap-3 p-4`}>
      <div className="flex relative flex-row items-center justify-between">
        <span className={labelClass}>Cross-site links</span>
        <span className="flex relative font-mono text-[11px] text-white/50">
          {active}/{links.length} active
        </span>
      </div>
      <div className="flex relative flex-row flex-wrap gap-2">
        {links.map((link) => {
          const key = `${link.from.site}/${link.from.zone}>${link.to.site}/${link.to.zone}:${link.item}`;
          return (
            <div
              key={key}
              className={`flex relative flex-row items-center gap-2 rounded-sm border px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] transition ${
                link.active ? "border-[#daf822] text-[#daf822]" : "border-white/10 text-white/40"
              }`}
            >
              <span className={`flex relative h-1.5 w-1.5 rounded-full ${link.active ? "bg-[#7cff6b] pulse-live" : "bg-white/20"}`} />
              <span className="flex relative">
                {siteLabel(event, link.from.site)} / {zoneLabel(event, link.from.site, link.from.zone)}
              </span>
              <span className="flex relative">→</span>
              <span className="flex relative">
                {siteLabel(event, link.to.site)} / {zoneLabel(event, link.to.site, link.to.zone)}
              </span>
              <span className="flex relative font-mono text-[10px] normal-case tracking-normal opacity-70">{link.item}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
