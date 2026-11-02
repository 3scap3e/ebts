import { useEffect, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { api } from "@/hooks/api";
import { describeError } from "@/hooks/errors";
import { findSite, newZone, renameZone, updateSite, updateZone } from "@/hooks/eventEdit";
import { moveItem } from "@/hooks/listEdit";
import { buttonClass, labelClass, panelClass } from "@/hooks/theme";
import { hintClass } from "@/hooks/classes";
import Select from "@/modules/Select";
import StepFrame from "@/modules/StepFrame";
import ZoneCatalog from "@/modules/ZoneCatalog";
import ZoneCard from "@/modules/ZoneCard";
import type { ZoneTemplate } from "@/types/event";

export default function ZonesStep() {
  const { event, update, setStep } = useProject();
  const [siteId, setSiteId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ZoneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .zoneCatalog()
      .then((list) => {
        if (alive) setTemplates(list);
      })
      .catch((e: unknown) => {
        if (alive) setCatalogError(describeError(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!event) return null;

  const site = findSite(event, siteId) ?? event.sites[0] ?? null;

  const siteControl =
    event.sites.length > 0 ? (
      <div className="flex relative flex-row items-center gap-[10px]">
        <span className="flex relative font-ocr text-[9px] uppercase leading-none text-[#6e83c3]">Site</span>
        <Select
          compact
          className="w-[204px]"
          value={site?.id ?? ""}
          options={event.sites.map((s) => ({ value: s.id, label: `${s.label} (${s.zones.length})` }))}
          onChange={setSiteId}
        />
      </div>
    ) : null;

  return (
    <StepFrame step="zones" intro="" titleRight={siteControl}>
      {event.sites.length === 0 ? (
        <div className={`${panelClass} items-start gap-3 p-6`}>
          <span className="flex relative font-display text-[22px] uppercase tracking-[0.05em] text-white/60">
            No locations yet
          </span>
          <span className={hintClass}>Stages live inside locations. Add at least one location first.</span>
          <button type="button" onClick={() => setStep("sites")} className={buttonClass}>
            Go to locations
          </button>
        </div>
      ) : (
        <div className="flex relative flex-col gap-5">
          <div className="flex relative flex-col flex-1 min-w-0 gap-5">
            {site ? (
              <>
                <ZoneCatalog
                  key={site.id}
                  templates={templates}
                  loading={loading}
                  error={catalogError}
                  onAdd={(template) =>
                    update((prev) =>
                      updateSite(prev, site.id, (s) => ({ ...s, zones: [...s.zones, newZone(s, template)] })),
                    )
                  }
                />
                <div className="flex relative flex-row items-center justify-between gap-3">
                  <span className={labelClass}>
                    Stages in {site.label}
                  </span>
                  <span className="flex relative font-mono text-[11px] text-white/50">{site.zones.length} zones</span>
                </div>
                <div className="flex relative flex-col gap-4">
                  {site.zones.map((zone, index) => (
                    <ZoneCard
                      key={zone.id}
                      zone={zone}
                      site={site}
                      templates={templates}
                      index={index}
                      total={site.zones.length}
                      onChange={(patch) => update((prev) => updateZone(prev, site.id, zone.id, patch))}
                      onRename={(id) => update((prev) => renameZone(prev, site.id, zone.id, id))}
                      onDelete={() =>
                        update((prev) =>
                          updateSite(prev, site.id, (s) => ({ ...s, zones: s.zones.filter((z) => z.id !== zone.id) })),
                        )
                      }
                      onMove={(delta) =>
                        update((prev) =>
                          updateSite(prev, site.id, (s) => {
                            const from = s.zones.findIndex((z) => z.id === zone.id);
                            return { ...s, zones: moveItem(s.zones, from, from + delta) };
                          }),
                        )
                      }
                    />
                  ))}
                  {site.zones.length === 0 ? (
                    <span className={hintClass}>No zones in this site yet. Pick a format from the catalog above.</span>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </StepFrame>
  );
}
