import { useMemo } from "react";
import type { SimClockProviderProps } from "@/types/simulate";
import { useProject } from "@/hooks/useProject";
import { useSimClock } from "@/hooks/useSimClock";
import { useSnapshot } from "@/hooks/useSnapshot";
import { siteOffsets } from "@/hooks/simView";
import { SimClockContext } from "@/hooks/useSimClockShared";

export default function SimClockProvider({ children }: SimClockProviderProps) {
  const { event } = useProject();
  const clock = useSimClock(event);
  const { snapshot, loading, error } = useSnapshot(event, clock.cursor);
  const offsets = useMemo(() => siteOffsets(event, snapshot, clock.cursor), [event, snapshot, clock.cursor]);
  const value = useMemo(() => ({ clock, snapshot, loading, error, offsets }), [clock, snapshot, loading, error, offsets]);

  return <SimClockContext.Provider value={value}>{children}</SimClockContext.Provider>;
}
