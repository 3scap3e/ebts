import { useMemo } from "react";
import type { ZoneViewProps } from "@/types/play";
import { assetUrl } from "@/hooks/api";
import { localClock } from "@/hooks/usePlayClock";
import { activeVariant, resolveLoop, resolvePoster, windowFolder } from "@/hooks/timeWindows";
import MapViewer from "@/modules/play/MapViewer";
import ItineraryPanel from "@/modules/play/ItineraryPanel";
import PlayClock from "@/modules/play/PlayClock";

const noop = () => undefined;

export default function ZoneView({ site, zone, root, time, onBack }: ZoneViewProps) {
  const { now, hm } = localClock(time, site);
  const variant = activeVariant(zone.media.variants, hm);
  const key = variant ? windowFolder(variant.window) : "base";
  const media = useMemo(
    () => ({
      image: assetUrl(root, resolvePoster(zone.media.poster, zone.media.variants, hm)),
      loop: assetUrl(root, resolveLoop(zone.media.loop_video, zone.media.variants, hm)),
    }),
    [root, zone.media, key],
  );

  return (
    <>
      <MapViewer
        key={`${media.image ?? ""}|${media.loop ?? ""}`}
        image={media.image}
        loop={media.loop}
        width={zone.media.width}
        height={zone.media.height}
        label={zone.label}
        hotspots={EMPTY}
        minimap={null}
        onSelect={noop}
        onBack={onBack}
      />
      <ItineraryPanel site={site} zone={zone} now={now} />
      <PlayClock time={time} site={site} />
    </>
  );
}

const EMPTY: never[] = [];
