import { useState } from "react";
import type { ZoneWallProps } from "@/types/simulate";
import { hmIn } from "@/hooks/tz";
import ZoneScreen from "@/modules/ZoneScreen";

const GAP = 9;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 6;
const DEFAULT_COLUMNS = 3;

export default function ZoneWall({ event, cursor, snapshot, playing }: ZoneWallProps) {
  const ms = cursor ? new Date(cursor).getTime() : null;
  const total = event.sites.reduce((n, s) => n + s.zones.length, 0);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  if (total === 0) return null;
  const width = `calc((100% - ${GAP * (columns - 1)}px) / ${columns})`;

  return (
    <div className="flex relative flex-col gap-[9px]">
      <div className="flex relative flex-row items-center justify-end">
        <input
          type="range"
          min={MIN_COLUMNS}
          max={MAX_COLUMNS}
          step={1}
          value={columns}
          onChange={(e) => setColumns(Number(e.target.value))}
          className="flex relative w-[120px]"
          aria-label="Screens per row"
        />
      </div>
      <div className="flex relative flex-row flex-wrap" style={{ gap: `${GAP}px` }}>
        {event.sites.map((site) => {
          const snap = snapshot?.sites.find((s) => s.site === site.id) ?? null;
          const hm = ms !== null ? hmIn(ms, site.timezone) : site.open;
          return site.zones.map((zone) => (
            <ZoneScreen
              key={`${site.id}/${zone.id}`}
              site={site}
              zone={zone}
              hm={hm}
              live={snap?.zones.find((z) => z.zone === zone.id) ?? null}
              playing={playing}
              width={width}
            />
          ));
        })}
      </div>
    </div>
  );
}
