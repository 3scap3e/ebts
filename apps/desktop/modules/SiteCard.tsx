import { useState } from "react";
import { cardClass, smallButtonClass, timeInputClass } from "@/hooks/classes";
import Select from "@/modules/Select";
import { inputClass } from "@/hooks/theme";
import { OTHER_TIMEZONE, TIMEZONES, isListedTimezone } from "@/hooks/timezones";
import DeleteButton from "@/modules/DeleteButton";
import Field from "@/modules/Field";
import type { Site } from "@/types/event";
import type { SiteCardProps } from "@/types/ui";

export default function SiteCard({ site, index, total, onChange, onRename, onDelete, onMove }: SiteCardProps) {
  const [other, setOther] = useState(!isListedTimezone(site.timezone));
  const set = (patch: Partial<Site>) => onChange((prev) => ({ ...prev, ...patch }));
  const setTime = (key: "open" | "close" | "crew_open" | "crew_close", value: string) => {
    if (/^\d{2}:\d{2}$/.test(value)) set({ [key]: value });
  };

  return (
    <div className={cardClass}>
      <div className="flex relative flex-row flex-wrap items-center gap-3">
        <span className="flex relative font-mono text-[11px] text-[#009fdf]">{String(index + 1).padStart(2, "0")}</span>
        <span className="flex relative font-display text-[22px] uppercase leading-none tracking-[0.05em] text-[#daf822]">
          {site.label || "Untitled site"}
        </span>
        <input
          defaultValue={site.id}
          key={site.id}
          onBlur={(e) => onRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          spellCheck={false}
          className="flex relative w-[140px] rounded-sm border border-[#daf822]/25 bg-black px-2 py-0.5 font-mono text-[11px] text-white/60 outline-none focus:border-[#daf822] focus:text-white"
        />
        <span className="flex relative rounded-sm border border-white/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
          {site.zones.length} {site.zones.length === 1 ? "zone" : "zones"}
        </span>
        <div className="flex relative flex-row items-center gap-1 ml-auto">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={smallButtonClass}>
            ↑
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className={smallButtonClass}>
            ↓
          </button>
          <DeleteButton compact label="Delete site" confirmLabel="Delete for real" onConfirm={onDelete} />
        </div>
      </div>

      <div className="flex relative flex-row flex-wrap gap-4">
        <Field label="Label" className="flex-1 min-w-[180px]">
          <input value={site.label} onChange={(e) => set({ label: e.target.value })} className={inputClass} />
        </Field>
        <Field label="City" className="flex-1 min-w-[180px]">
          <input value={site.city} onChange={(e) => set({ city: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Venue" className="flex-1 min-w-[220px]">
          <input
            value={site.venue}
            onChange={(e) => set({ venue: e.target.value })}
            placeholder="Building, street, neighborhood"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex relative flex-row flex-wrap gap-4">
        <Field label="Timezone" className="flex-1 min-w-[240px]">
          <div className="flex relative flex-row gap-2">
            <Select
              className="flex-1"
              value={other ? OTHER_TIMEZONE : site.timezone}
              options={[...TIMEZONES.map((tz) => ({ value: tz, label: tz })), { value: OTHER_TIMEZONE, label: "Other…" }]}
              onChange={(value) => {
                if (value === OTHER_TIMEZONE) {
                  setOther(true);
                } else {
                  setOther(false);
                  set({ timezone: value });
                }
              }}
            />
            {other ? (
              <input
                value={site.timezone}
                onChange={(e) => set({ timezone: e.target.value })}
                placeholder="Region/City"
                spellCheck={false}
                className={`${inputClass} font-mono`}
              />
            ) : null}
          </div>
        </Field>
      </div>

      <div className="flex relative flex-row flex-wrap gap-4">
        <Field label="Doors open" className="w-[150px]">
          <input type="time" value={site.open} onChange={(e) => setTime("open", e.target.value)} className={timeInputClass} />
        </Field>
        <Field label="Doors close" className="w-[150px]">
          <input type="time" value={site.close} onChange={(e) => setTime("close", e.target.value)} className={timeInputClass} />
        </Field>
        <Field label="Crew in" className="w-[150px]">
          <input
            type="time"
            value={site.crew_open}
            onChange={(e) => setTime("crew_open", e.target.value)}
            className={timeInputClass}
          />
        </Field>
        <Field label="Crew out" className="w-[150px]">
          <input
            type="time"
            value={site.crew_close}
            onChange={(e) => setTime("crew_close", e.target.value)}
            className={timeInputClass}
          />
        </Field>
      </div>
    </div>
  );
}
