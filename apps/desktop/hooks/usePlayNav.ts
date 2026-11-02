import { useCallback, useEffect, useState } from "react";
import type { EventSpec } from "@/types/event";
import type { PlayNav, PlayNavState } from "@/types/play";
import { findSite, findZone } from "@/hooks/eventEdit";

const eventNav: PlayNav = { level: "event", site: null, zone: null };

export const usePlayNav = (event: EventSpec | null): PlayNavState => {
  const [nav, setNav] = useState<PlayNav>(eventNav);

  useEffect(() => {
    if (!event || nav.level === "event") return;
    const site = findSite(event, nav.site);
    if (!site) {
      setNav(eventNav);
      return;
    }
    if (nav.level === "zone" && !findZone(site, nav.zone)) {
      setNav({ level: "site", site: site.id, zone: null });
    }
  }, [event, nav]);

  const goEvent = useCallback(() => setNav(eventNav), []);
  const goSite = useCallback((site: string) => setNav({ level: "site", site, zone: null }), []);
  const goZone = useCallback((site: string, zone: string) => setNav({ level: "zone", site, zone }), []);
  const back = useCallback(
    () =>
      setNav((prev) => {
        if (prev.level === "zone") return { level: "site", site: prev.site, zone: null };
        return eventNav;
      }),
    [],
  );

  return { nav, goEvent, goSite, goZone, back };
};
