import { useState } from "react";
import { useProject } from "@/hooks/useProject";
import { labelClass, panelClass } from "@/hooks/theme";
import { hintClass } from "@/hooks/classes";
import {
  PERSON_STATES,
  addContactTo,
  patchWho,
  peopleFromWho,
  personStatusColor,
  personStatusLabel,
  productionCounts,
  removeContactFrom,
  setProduction,
  whoCounts,
} from "@/hooks/production";
import StepFrame from "@/modules/StepFrame";
import Select from "@/modules/Select";
import WhoCard from "@/modules/WhoCard";
import type { PersonStatus } from "@/types/event";
import type { WhoFilter } from "@/types/ui";

function Chip({ label, value, color, active, onClick }: { label: string; value: number; color: string; active: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex relative flex-row items-center gap-1.5 rounded-sm border px-2 py-1 font-ocr text-[10px] uppercase leading-none tracking-[0.15em] transition ${active ? "border-white/25 text-white/80" : "border-white/10 text-white/35"} ${onClick ? "hover:border-[#daf822] hover:text-white" : ""}`}
    >
      <span className="flex relative font-tanker text-[13px] leading-none" style={{ color }}>
        {value}
      </span>
      {label}
    </button>
  );
}

const filterOptions = [{ value: "all", label: "All" }, ...PERSON_STATES.map((state) => ({ value: state, label: personStatusLabel(state) }))];

export default function ProductionStep() {
  const { event, update } = useProject();
  const [filter, setFilter] = useState<WhoFilter>("all");
  const [stage, setStage] = useState("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (!event) return null;

  const stageOptions = [
    { value: "all", label: "All stages" },
    ...event.sites.flatMap((site) => site.zones.map((zone) => ({ value: `${site.id}/${zone.id}`, label: `${site.label} / ${zone.label}` }))),
  ];
  const inStage = (siteId: string, zoneId: string) => stage === "all" || stage === `${siteId}/${zoneId}`;
  const entries = peopleFromWho(event)
    .map((entry) => ({ ...entry, slots: entry.slots.filter((slot) => inStage(slot.site, slot.zone)) }))
    .filter((entry) => entry.slots.length > 0);
  const counts = whoCounts(entries);
  const slots = productionCounts(event);
  const slotTotal = slots.idea + slots["in-progress"] + slots.confirmed + slots.cancelled;
  const all = filter === "all";
  const shown = all ? entries : entries.filter((entry) => entry.status === filter);
  const pick = (state: PersonStatus) => setFilter(filter === state ? "all" : state);
  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));

  return (
    <StepFrame step="production">
      <div className="flex relative flex-row flex-wrap items-end gap-4">
        <div className="flex relative flex-col gap-1.5 w-[180px]">
          <span className={labelClass}>Show</span>
          <Select value={filter} options={filterOptions} onChange={(value) => setFilter(value as WhoFilter)} />
        </div>
        <div className="flex relative flex-col gap-1.5 w-[260px]">
          <span className={labelClass}>Stage</span>
          <Select value={stage} options={stageOptions} onChange={setStage} />
        </div>
        <div className="flex relative flex-row flex-wrap items-center gap-1.5 pb-[3px]">
          <Chip label="who" value={entries.length} color="#daf822" active={all} onClick={() => setFilter("all")} />
          {PERSON_STATES.map((state) => (
            <Chip key={state} label={personStatusLabel(state)} value={counts[state]} color={personStatusColor(state)} active={all || filter === state} onClick={() => pick(state)} />
          ))}
          <Chip label={`of ${slotTotal} slots confirmed`} value={slots.confirmed} color="#7cff6b" active={all} />
        </div>
      </div>

      <div className={`${panelClass} gap-2 p-4`}>
        {shown.map((entry) => (
          <WhoCard
            key={entry.key}
            entry={entry}
            open={open[entry.key] ?? false}
            onToggle={() => toggle(entry.key)}
            onPatch={(patch) => update((prev) => patchWho(prev, entry.name, patch))}
            onContact={(contact) => update((prev) => addContactTo(prev, entry.name, contact))}
            onRemoveContact={(index) => update((prev) => removeContactFrom(prev, entry.name, index))}
            onSlotProduction={(slot, state) => update((prev) => setProduction(prev, slot.site, slot.zone, slot.item, state))}
          />
        ))}
        {entries.length === 0 ? <span className={hintClass}>No names in Channels yet.</span> : null}
        {entries.length > 0 && shown.length === 0 ? <span className={hintClass}>Nobody {personStatusLabel(filter as PersonStatus).toLowerCase()}.</span> : null}
      </div>
    </StepFrame>
  );
}
