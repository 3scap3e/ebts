import { cardClass, smallButtonClass, timeInputClass } from "@/hooks/classes";
import Select from "@/modules/Select";
import { inputClass } from "@/hooks/theme";
import { RHYTHMS, ZONE_FORMATS, humanize } from "@/hooks/zoneEdit";
import DeleteButton from "@/modules/DeleteButton";
import Field from "@/modules/Field";
import type { Rhythm, Zone, ZoneFormat } from "@/types/event";
import type { ZoneCardProps } from "@/types/ui";

export default function ZoneCard({ zone, site, templates, index, total, onChange, onRename, onDelete, onMove }: ZoneCardProps) {
  const set = (patch: Partial<Zone>) => onChange((prev) => ({ ...prev, ...patch }));
  const customHours = zone.open !== null || zone.close !== null;
  const crewOnly = zone.format === "back-of-house";
  const setTime = (key: "open" | "close", value: string) => {
    if (/^\d{2}:\d{2}$/.test(value)) set({ [key]: value });
  };
  const setFormat = (format: ZoneFormat) => {
    const current = templates.find((t) => t.format === zone.format);
    const next = templates.find((t) => t.format === format);
    const patch: Partial<Zone> = { format };
    if (next) {
      patch.rhythm = next.rhythm;
      if (!zone.who.trim() || zone.who === current?.who) patch.who = next.who;
      if (!zone.what.trim() || zone.what === current?.what) patch.what = next.what;
    }
    set(patch);
  };

  return (
    <div className={cardClass}>
      <div className="flex relative flex-row flex-wrap items-center gap-3">
        <span className="flex relative font-mono text-[11px] text-[#009fdf]">{String(index + 1).padStart(2, "0")}</span>
        <span className="flex relative font-display text-[20px] uppercase leading-none tracking-[0.05em] text-[#daf822]">
          {zone.label || "Untitled zone"}
        </span>
        <input
          defaultValue={zone.id}
          key={zone.id}
          onBlur={(e) => onRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          spellCheck={false}
          className="flex relative w-[160px] rounded-sm border border-[#daf822]/25 bg-black px-2 py-0.5 font-mono text-[11px] text-white/60 outline-none focus:border-[#daf822] focus:text-white"
        />
        <span className="flex relative rounded-sm border border-white/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
          {zone.schedule.length} {zone.schedule.length === 1 ? "slot" : "slots"}
        </span>
        <div className="flex relative flex-row items-center gap-1 ml-auto">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={smallButtonClass}>
            ↑
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className={smallButtonClass}>
            ↓
          </button>
          <DeleteButton compact label="Delete zone" confirmLabel="Delete for real" onConfirm={onDelete} />
        </div>
      </div>

      <div className="flex relative flex-row flex-wrap gap-4">
        <Field label="Label" className="flex-1 min-w-[200px]">
          <input value={zone.label} onChange={(e) => set({ label: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Format" className="w-[200px]">
          <Select
            value={zone.format}
            options={ZONE_FORMATS.map((format) => ({ value: format, label: humanize(format) }))}
            onChange={(value) => setFormat(value as ZoneFormat)}
          />
        </Field>
        <Field label="Rhythm" className="w-[200px]">
          <Select
            value={zone.rhythm}
            options={RHYTHMS.map((rhythm) => ({ value: rhythm, label: humanize(rhythm) }))}
            onChange={(value) => set({ rhythm: value as Rhythm })}
          />
        </Field>
        <Field label="Capacity" className="w-[120px]">
          <input
            type="number"
            min={0}
            value={zone.capacity}
            onChange={(e) => set({ capacity: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
            className={`${inputClass} font-mono`}
          />
        </Field>
      </div>

      <div className="flex relative flex-row flex-wrap gap-4">
        <Field label="Who" className="flex-1 min-w-[220px]">
          <input
            value={zone.who}
            onChange={(e) => set({ who: e.target.value })}
            placeholder="Who is in the room"
            className={inputClass}
          />
        </Field>
        <Field label="What" className="flex-1 min-w-[220px]">
          <input
            value={zone.what}
            onChange={(e) => set({ what: e.target.value })}
            placeholder="What happens there"
            className={inputClass}
          />
        </Field>
      </div>

      {crewOnly ? (
        <span className="flex relative pb-2 font-mono text-[12px] text-white/40">
          Follows crew hours {site.crew_open} – {site.crew_close} (load-in, staging, strike)
        </span>
      ) : (
      <div className="flex relative flex-row flex-wrap items-end gap-4">
        <label className="flex relative flex-row items-center gap-2 pb-2 text-[12px] uppercase tracking-[0.2em] text-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={customHours}
            onChange={(e) =>
              set(e.target.checked ? { open: site.open, close: site.close } : { open: null, close: null })
            }
            className="flex relative h-4 w-4 accent-[#daf822]"
          />
          <span className="flex relative">Custom hours</span>
        </label>
        {customHours ? (
          <>
            <Field label="Opens" className="w-[150px]">
              <input
                type="time"
                value={zone.open ?? site.open}
                onChange={(e) => setTime("open", e.target.value)}
                className={timeInputClass}
              />
            </Field>
            <Field label="Closes" className="w-[150px]">
              <input
                type="time"
                value={zone.close ?? site.close}
                onChange={(e) => setTime("close", e.target.value)}
                className={timeInputClass}
              />
            </Field>
          </>
        ) : (
          <span className="flex relative pb-2 font-mono text-[12px] text-white/40">
            Follows site hours {site.open} – {site.close}
          </span>
        )}
      </div>
      )}
    </div>
  );
}
