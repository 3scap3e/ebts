import { useProject } from "@/hooks/useProject";
import { useSharedSimClock } from "@/hooks/useSimClockShared";
import { labelClass, panelClass } from "@/hooks/theme";
import { errorClass } from "@/hooks/classes";
import StepFrame from "@/modules/StepFrame";
import SiteBoard from "@/modules/SiteBoard";
import LinksStrip from "@/modules/LinksStrip";
import ZoneWall from "@/modules/ZoneWall";

export default function SimulateStep() {
  const { event } = useProject();
  const { clock, snapshot, loading, error } = useSharedSimClock();
  if (!event) return null;

  return (
    <StepFrame step="simulate" title="FORMATIVE EVENTS IN FRONTIER ENVIROMENTS" titleSize="large" accent="pink">
      <ZoneWall event={event} cursor={clock.cursor} snapshot={snapshot} playing={clock.playing} />
      <div className={`${panelClass} gap-2 p-4`}>
        <div className="flex relative flex-row items-center justify-between gap-3">
          <span className={labelClass}>Headline</span>
          <span className={`flex relative h-2 w-2 rounded-full ${loading ? "bg-[#daf822] pulse-live" : "bg-[#7cff6b]"}`} />
        </div>
        <span className="flex relative font-display text-[28px] uppercase leading-tight tracking-[0.04em] text-white">
          {snapshot?.headline ?? (error ? "Simulation unavailable" : "Waiting for the first snapshot")}
        </span>
        {error ? <span className={errorClass}>{error}</span> : null}
      </div>
      <LinksStrip event={event} links={snapshot?.links ?? []} />
      {event.sites.map((site) => (
        <SiteBoard key={site.id} site={site} snap={snapshot?.sites.find((s) => s.site === site.id) ?? null} />
      ))}
    </StepFrame>
  );
}
