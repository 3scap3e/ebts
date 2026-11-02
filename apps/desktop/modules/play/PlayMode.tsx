import { useCallback, useMemo } from "react";
import { useProject } from "@/hooks/useProject";
import { usePlayNav } from "@/hooks/usePlayNav";
import { usePlayTime } from "@/hooks/usePlayTime";
import { findSite, findZone } from "@/hooks/eventEdit";
import { hmIn, utcHm } from "@/hooks/tz";
import { buildScene, needsList, sceneKey, siteEntries, zoneEntries } from "@/hooks/playView";
import MapViewer from "@/modules/play/MapViewer";
import ZoneView from "@/modules/play/ZoneView";
import ListOverlay from "@/modules/play/ListOverlay";
import PlayClock from "@/modules/play/PlayClock";

export default function PlayMode() {
  const { root, event } = useProject();
  const { nav, goSite, goZone, back } = usePlayNav(event);
  const site = event ? findSite(event, nav.site) : null;
  const zone = findZone(site, nav.zone);
  const time = usePlayTime(event);
  const map = site ? site.map : event?.map ?? null;
  const hm = site ? hmIn(time.utc, site.timezone) : utcHm(time.utc);
  const key = map ? sceneKey(map, hm) : "";
  const entries = useMemo(() => (site ? zoneEntries(site.zones) : siteEntries(event?.sites ?? [])), [site, event?.sites]);
  const scene = useMemo(() => (map ? buildScene(root, map, entries, hm) : null), [root, map, entries, key]);
  const select = useCallback((target: string) => (site ? goZone(site.id, target) : goSite(target)), [site, goSite, goZone]);
  const list = useMemo(
    () =>
      scene ? (
        <ListOverlay
          title={site ? "Stages" : "Locations"}
          entries={entries}
          defaultOpen={needsList(scene.poster, scene.hotspots, entries)}
          onSelect={select}
        />
      ) : null,
    [scene, entries, site, select],
  );
  if (!event) return null;

  if (nav.level === "zone" && site && zone) {
    return <ZoneView key={`zone-${site.id}-${zone.id}`} site={site} zone={zone} root={root} time={time} onBack={back} />;
  }

  if (!map || !scene) return null;
  const label = site ? site.label : event.name.replace(/\s*\n+\s*/g, " ") || "Event";

  return (
    <>
      <MapViewer
        key={`${site ? `site-${site.id}` : "event"}|${scene.image ?? ""}|${scene.loop ?? ""}`}
        image={scene.image}
        loop={scene.loop}
        width={map.width}
        height={map.height}
        label={label}
        hotspots={scene.hotspots}
        minimap={scene.minimap}
        onSelect={select}
        onBack={site ? back : null}
      >
        {list}
      </MapViewer>
      <PlayClock time={time} site={site} />
    </>
  );
}
