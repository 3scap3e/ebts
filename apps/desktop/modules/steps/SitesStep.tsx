import { useState } from "react";
import { useProject } from "@/hooks/useProject";
import { buttonClass, inputClass, labelClass, panelClass } from "@/hooks/theme";
import { newSite, renameSite, updateSite } from "@/hooks/eventEdit";
import { moveItem } from "@/hooks/listEdit";
import StepFrame from "@/modules/StepFrame";
import SiteCard from "@/modules/SiteCard";
import SitesClock from "@/modules/SitesClock";
import { browserTimezone } from "@/hooks/tz";

export default function SitesStep() {
  const { event, update } = useProject();
  const [draft, setDraft] = useState("");
  if (!event) return null;

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    update((prev) => ({ ...prev, sites: [...prev.sites, { ...newSite(prev, label), timezone: browserTimezone() }] }));
    setDraft("");
  };

  const aside = <SitesClock event={event} />;

  return (
    <StepFrame
      step="sites"
      intro=""
      aside={aside}
    >
      <div className={`${panelClass} gap-3 p-5`}>
        <span className={labelClass}>Add a site</span>
        <div className="flex relative flex-row items-center gap-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="San Francisco"
            className={inputClass}
          />
          <button type="button" onClick={add} disabled={!draft.trim()} className={buttonClass}>
            Add site
          </button>
        </div>
      </div>

      <div className="flex relative flex-col gap-4">
        {event.sites.map((site, index) => (
          <SiteCard
            key={site.id}
            site={site}
            index={index}
            total={event.sites.length}
            onChange={(patch) => update((prev) => updateSite(prev, site.id, patch))}
            onRename={(id) => update((prev) => renameSite(prev, site.id, id))}
            onDelete={() => update((prev) => ({ ...prev, sites: prev.sites.filter((s) => s.id !== site.id) }))}
            onMove={(delta) =>
              update((prev) => {
                const from = prev.sites.findIndex((s) => s.id === site.id);
                return { ...prev, sites: moveItem(prev.sites, from, from + delta) };
              })
            }
          />
        ))}
      </div>
    </StepFrame>
  );
}
