import { useMemo, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { eventLevel, levelTitle, resolveLevel } from "@/hooks/mapEdit";
import StepFrame from "@/modules/StepFrame";
import MapEditor from "@/modules/MapEditor";
import type { MapLevel, MapLevelKind } from "@/types/map";

const kindTag: Record<MapLevelKind, string> = {
  event: "Event",
  "event-widget": "Event",
  site: "Site",
  "site-widget": "Site",
  zone: "Zone",
};

export default function MapsStep() {
  const { event } = useProject();
  const [rawLevel, setRawLevel] = useState<MapLevel>(eventLevel);
  const level = useMemo(() => (event ? resolveLevel(event, rawLevel) : eventLevel), [event, rawLevel]);
  if (!event) return null;

  return (
    <StepFrame
      step="maps"
      title={levelTitle(event, level).toUpperCase()}
      titleRight={<span className="flex relative font-ocr text-[9px] uppercase leading-none text-[#6e83c3]">{kindTag[level.kind]}</span>}
    >
      <MapEditor event={event} level={rawLevel} onLevel={setRawLevel} />
    </StepFrame>
  );
}
