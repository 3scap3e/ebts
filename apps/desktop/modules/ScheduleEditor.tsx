import { labelClass } from "@/hooks/theme";
import { hintClass, smallButtonClass, textareaClass } from "@/hooks/classes";
import { insertAfter, moveItem, removeAt, replaceAt } from "@/hooks/listEdit";
import { duplicateScheduleItem, newScheduleItem, sortByStart } from "@/hooks/scheduleEdit";
import Field from "@/modules/Field";
import ScheduleRow from "@/modules/ScheduleRow";
import type { ScheduleEditorProps } from "@/types/ui";

export default function ScheduleEditor({ event, site, zone, onChange, onBrief }: ScheduleEditorProps) {
  const items = zone.schedule;

  return (
    <div className="flex relative flex-col gap-3">
      <Field label="Description">
        <textarea
          value={zone.brief}
          onChange={(e) => onBrief(e.target.value)}
          placeholder="What this room is about for the day"
          className={`${textareaClass} min-h-[64px]`}
        />
      </Field>
      <div className="flex relative flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex relative flex-row items-baseline gap-3">
          <span className={labelClass}>Schedule</span>
          <span className="flex relative font-mono text-[11px] text-white/50">
            {items.length} {items.length === 1 ? "slot" : "slots"}
          </span>
        </div>
        <div className="flex relative flex-row items-center gap-2">
          <button type="button" onClick={() => onChange(sortByStart(items))} disabled={items.length < 2} className={smallButtonClass}>
            Sort by start
          </button>
          <button
            type="button"
            onClick={() => onChange([...items, newScheduleItem(zone, site.open, site.close)])}
            className={smallButtonClass}
          >
            Add row
          </button>
        </div>
      </div>
      <div className="flex relative flex-col gap-2">
        {items.map((item, index) => (
          <ScheduleRow
            key={index}
            event={event}
            site={site}
            zone={zone}
            item={item}
            index={index}
            total={items.length}
            onChange={(patch) => onChange(replaceAt(items, index, { ...item, ...patch }))}
            onDuplicate={() => onChange(insertAfter(items, index, duplicateScheduleItem(zone, item)))}
            onDelete={() => onChange(removeAt(items, index))}
            onMove={(delta) => onChange(moveItem(items, index, index + delta))}
          />
        ))}
        {items.length === 0 ? <span className={hintClass}>No rows yet.</span> : null}
      </div>
    </div>
  );
}
