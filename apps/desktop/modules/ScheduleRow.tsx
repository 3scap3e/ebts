import { smallButtonClass, smallInputClass, smallMonoClass, smallTimeClass } from "@/hooks/classes";
import Select from "@/modules/Select";
import { statusColor, statusLabel } from "@/hooks/theme";
import { SCHEDULE_STATUSES } from "@/hooks/scheduleEdit";
import { PRODUCTION_STATES, productionColor, productionLabel } from "@/hooks/production";
import { findSite } from "@/hooks/eventEdit";
import DeleteButton from "@/modules/DeleteButton";
import Field from "@/modules/Field";
import type { Production, ScheduleStatus } from "@/types/event";
import type { ScheduleRowProps } from "@/types/ui";

export default function ScheduleRow({
  event,
  site,
  zone,
  item,
  index,
  total,
  onChange,
  onDuplicate,
  onDelete,
  onMove,
}: ScheduleRowProps) {
  const linkSite = findSite(event, item.link?.site ?? null);

  return (
    <div
      className={`flex relative flex-col gap-2.5 rounded-sm border border-white/10 border-l-2 bg-black/40 p-3 ${item.production === "cancelled" ? "opacity-50" : ""}`}
      style={{ borderLeftColor: statusColor[item.status] }}
    >
      <div className="flex relative flex-row flex-wrap items-end gap-2">
        <Field label="Id" compact className="w-[110px]">
          <input value={item.id} onChange={(e) => onChange({ id: e.target.value })} spellCheck={false} className={smallMonoClass} />
        </Field>
        <Field label="Title" compact className="flex-1 min-w-[200px]">
          <input value={item.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="What is on" className={smallInputClass} />
        </Field>
        <Field label="Kind" compact className="w-[150px]">
          <input value={item.kind} onChange={(e) => onChange({ kind: e.target.value })} placeholder="Conversation" className={smallInputClass} />
        </Field>
        <Field label="Status" compact className="w-[170px]">
          <div className="flex relative flex-row items-center gap-2">
            <span className="flex relative h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: statusColor[item.status] }} />
            <Select
              compact
              className="flex-1"
              value={item.status}
              options={SCHEDULE_STATUSES.map((status) => ({ value: status, label: statusLabel(status) }))}
              onChange={(value) => onChange({ status: value as ScheduleStatus })}
            />
          </div>
        </Field>
        <Field label="Confirmed" compact className="w-[170px]">
          <div className="flex relative flex-row items-center gap-2">
            <span className="flex relative h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: productionColor(item.production) }} />
            <Select
              compact
              className="flex-1"
              value={item.production}
              options={PRODUCTION_STATES.map((state) => ({ value: state, label: productionLabel(state) }))}
              onChange={(value) => onChange({ production: value as Production })}
            />
          </div>
        </Field>
      </div>

      <div className="flex relative flex-row flex-wrap items-end gap-2">
        <Field label="Start" compact className="w-[118px]">
          <input type="time" value={item.start} onChange={(e) => { if (/^\d{2}:\d{2}$/.test(e.target.value)) onChange({ start: e.target.value }); }} className={smallTimeClass} />
        </Field>
        <Field label="End" compact className="w-[118px]">
          <input type="time" value={item.end} onChange={(e) => { if (/^\d{2}:\d{2}$/.test(e.target.value)) onChange({ end: e.target.value }); }} className={smallTimeClass} />
        </Field>
        <Field label="Who" compact className="flex-1 min-w-[180px]">
          <input value={item.who} onChange={(e) => onChange({ who: e.target.value })} placeholder="People in the slot" className={smallInputClass} />
        </Field>
        <Field label="Channel" compact className="flex-1 min-w-[180px]">
          <input
            value={item.channel}
            onChange={(e) => onChange({ channel: e.target.value })}
            placeholder="Robots / live code / social"
            className={smallInputClass}
          />
        </Field>
      </div>

      <Field label="Description" compact>
        <input
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="One line for the itinerary card"
          className={smallInputClass}
        />
      </Field>

      <div className="flex relative flex-row flex-wrap items-end gap-2">
        <Field label="Simulcast with site" compact className="w-[190px]">
          <Select
            compact
            value={item.link?.site ?? ""}
            options={[{ value: "", label: "This site only" }, ...event.sites.filter((s) => s.id !== site.id).map((s) => ({ value: s.id, label: s.label }))]}
            onChange={(siteId) => {
              if (!siteId) {
                onChange({ link: null });
                return;
              }
              const target = findSite(event, siteId);
              const counterpart = target?.zones.find((z) => z.format === zone.format) ?? target?.zones[0];
              onChange({ link: { site: siteId, zone: counterpart?.id ?? "" } });
            }}
          />
        </Field>
        {item.link ? (
          <Field label="Simulcast zone there" compact className="w-[190px]">
            <Select
              compact
              value={item.link.zone}
              placeholder="No zones"
              options={(linkSite?.zones ?? []).map((zone) => ({ value: zone.id, label: zone.label }))}
              onChange={(zoneId) => onChange({ link: { site: item.link?.site ?? "", zone: zoneId } })}
            />
          </Field>
        ) : null}
        <div className="flex relative flex-row items-center gap-1 ml-auto">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={smallButtonClass}>
            ↑
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className={smallButtonClass}>
            ↓
          </button>
          <button type="button" onClick={onDuplicate} className={smallButtonClass}>
            Duplicate
          </button>
          <DeleteButton compact label="Delete" confirmLabel="Sure?" onConfirm={onDelete} />
        </div>
      </div>
    </div>
  );
}
