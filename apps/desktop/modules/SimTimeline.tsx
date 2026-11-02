import type { SimTimelineProps } from "@/types/simulate";
import { statusColor } from "@/hooks/theme";
import { minutesInSpan, pctInSpan, siteSpan } from "@/hooks/simView";

export default function SimTimeline({ site, zone, localTime }: SimTimelineProps) {
  const span = siteSpan(site);
  const head = localTime ? pctInSpan(minutesInSpan(localTime, span), span) : null;
  const inside = localTime !== null && (() => {
    const m = minutesInSpan(localTime, span);
    return m >= span.open && m <= span.close;
  })();

  return (
    <div className="flex relative flex-col gap-1">
      <div className="flex relative h-[14px] w-full overflow-hidden rounded-sm border border-[#daf822]/20 bg-black">
        {zone.schedule.map((item) => {
          const start = pctInSpan(minutesInSpan(item.start, span), span);
          const end = pctInSpan(minutesInSpan(item.end, span), span);
          const width = Math.max(0.4, end - start);
          return (
            <div
              key={item.id}
              title={`${item.start}–${item.end} ${item.title}`}
              className="flex absolute top-[2px] bottom-[2px] rounded-[1px]"
              style={{ left: `${start}%`, width: `${width}%`, background: statusColor[item.status], opacity: 0.75 }}
            />
          );
        })}
        {head !== null && inside ? (
          <div className="flex absolute top-0 bottom-0 w-[2px] bg-white" style={{ left: `calc(${head}% - 1px)` }} />
        ) : null}
      </div>
      <div className="flex relative flex-row justify-between font-mono text-[9px] text-white/35">
        <span className="flex relative">{site.open}</span>
        <span className="flex relative">{site.close}</span>
      </div>
    </div>
  );
}
