import type { Site } from "@/types/event";
import type { PlayLocalClock, PlayTimeState } from "@/types/play";
import { hmIn } from "@/hooks/tz";

export const localClock = (time: PlayTimeState, site: Site): PlayLocalClock => ({
  now: time.localMinutes(site),
  hm: hmIn(time.utc, site.timezone),
});
