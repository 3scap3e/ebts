import { useCallback, useEffect, useRef, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { api } from "@/hooks/api";
import { describeError } from "@/hooks/errors";
import { findSite, findZone, updateZone } from "@/hooks/eventEdit";
import { humanize, zoneHours } from "@/hooks/zoneEdit";
import { buttonClass, labelClass, panelClass } from "@/hooks/theme";
import { hintClass } from "@/hooks/classes";
import StepFrame from "@/modules/StepFrame";
import TabBar from "@/modules/TabBar";
import ScheduleEditor from "@/modules/ScheduleEditor";
import ConflictList from "@/modules/ConflictList";
import DeleteButton from "@/modules/DeleteButton";
import type { Conflict } from "@/types/sim";

export default function ProgramStep() {
  const { event, update, setStep } = useProject();
  const [siteId, setSiteId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const eventRef = useRef(event);
  const ran = useRef(false);
  eventRef.current = event;

  const checkConflicts = useCallback(async () => {
    const current = eventRef.current;
    if (!current) return;
    setChecking(true);
    try {
      setConflicts(await api.conflicts(current));
      setConflictError(null);
    } catch (e) {
      setConflictError(describeError(e));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const delay = ran.current ? 700 : 0;
    ran.current = true;
    const timer = window.setTimeout(() => {
      void checkConflicts();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [event, checkConflicts]);

  if (!event) return null;

  const site = findSite(event, siteId) ?? event.sites[0] ?? null;
  const zone = findZone(site, zoneId) ?? site?.zones[0] ?? null;

  const clearZone = () => {
    if (!site || !zone) return;
    update((prev) => updateZone(prev, site.id, zone.id, (z) => ({ ...z, schedule: [] })));
  };

  const aside = <ConflictList conflicts={conflicts} loading={checking} error={conflictError} onRun={() => void checkConflicts()} />;

  return (
    <StepFrame step="program" aside={aside}>
      {event.sites.length === 0 ? (
        <div className={`${panelClass} items-start gap-3 p-6`}>
          <span className="flex relative font-display text-[22px] uppercase tracking-[0.05em] text-white/60">
            Nothing to program yet
          </span>
          <button type="button" onClick={() => setStep("sites")} className={buttonClass}>
            Go to locations
          </button>
        </div>
      ) : (
        <>
          <div className={`${panelClass} gap-4 p-4`}>
            <div className="flex relative flex-col gap-2">
              <span className={labelClass}>Site</span>
              <TabBar
                tabs={event.sites.map((s) => ({ id: s.id, label: s.label, count: s.zones.length }))}
                active={site?.id ?? null}
                onSelect={(id) => {
                  setSiteId(id);
                  setZoneId(null);
                }}
              />
            </div>
            <div className="flex relative flex-col gap-2">
              <span className={labelClass}>Zone</span>
              <TabBar
                tabs={(site?.zones ?? []).map((z) => ({ id: z.id, label: z.label, count: z.schedule.length }))}
                active={zone?.id ?? null}
                onSelect={setZoneId}
                emptyLabel="This site has no zones yet"
              />
            </div>
          </div>

          {site && zone ? (
            <div className={`${panelClass} gap-4 p-4`}>
              <div className="flex relative flex-row flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="flex relative font-display text-[24px] uppercase leading-none tracking-[0.05em] text-[#daf822]">
                  {zone.label}
                </span>
                <span className="flex relative font-mono text-[11px] uppercase tracking-[0.15em] text-[#009fdf]">
                  {humanize(zone.format)} · {humanize(zone.rhythm)}
                </span>
                <span className="flex relative font-mono text-[11px] text-white/50">
                  {zoneHours(zone, site.open, site.close)} {site.timezone}
                </span>
                {zone.schedule.length > 0 ? (
                  <div className="flex relative flex-row ml-auto">
                    <DeleteButton label="Clear" confirmLabel="Clear this zone" onConfirm={clearZone} />
                  </div>
                ) : null}
              </div>
              <ScheduleEditor
                event={event}
                site={site}
                zone={zone}
                onChange={(items) => update((prev) => updateZone(prev, site.id, zone.id, (z) => ({ ...z, schedule: items })))}
                onBrief={(brief) => update((prev) => updateZone(prev, site.id, zone.id, (z) => ({ ...z, brief })))}
              />
            </div>
          ) : (
            <span className={hintClass}>Pick a site with zones to start programming.</span>
          )}
        </>
      )}
    </StepFrame>
  );
}
