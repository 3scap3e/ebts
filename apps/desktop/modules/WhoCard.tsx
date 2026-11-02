import { useState } from "react";
import { smallButtonClass, smallInputClass, tinyButtonClass, tinyLabelClass } from "@/hooks/classes";
import {
  CONTACT_CHANNELS,
  PERSON_STATES,
  PRODUCTION_STATES,
  contactChannelLabel,
  lastContact,
  personStatusColor,
  personStatusLabel,
  productionColor,
  productionLabel,
  today,
} from "@/hooks/production";
import Select from "@/modules/Select";
import type { PersonStatus, Production } from "@/types/event";
import type { WhoCardProps } from "@/types/ui";

const statusOptions = PERSON_STATES.map((state) => ({ value: state, label: personStatusLabel(state) }));

const productionOptions = PRODUCTION_STATES.map((state) => ({ value: state, label: productionLabel(state) }));

export default function WhoCard({ entry, open, onToggle, onPatch, onContact, onRemoveContact, onSlotProduction }: WhoCardProps) {
  const [date, setDate] = useState(today());
  const [channel, setChannel] = useState("email");
  const [note, setNote] = useState("");
  const person = entry.person;
  const latest = lastContact(person);
  const confirmedSlots = entry.slots.filter((s) => s.production === "confirmed").length;

  const addEntry = () => {
    if (!date) return;
    onContact({ date, channel, note: note.trim() });
    setNote("");
  };

  return (
    <div className={`flex relative flex-col gap-3 rounded-sm border border-white/10 bg-black/40 px-3 py-2 ${entry.status === "declined" ? "opacity-50" : ""}`}>
      <div className="flex relative flex-row flex-wrap items-center gap-3">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex relative flex-row flex-1 min-w-[180px] items-center gap-2 text-left">
          <span className="flex relative font-tanker text-[12px] leading-none text-[#daf822]">{open ? "▾" : "▸"}</span>
          <span className="flex relative h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: personStatusColor(entry.status) }} />
          <span className="flex relative truncate text-[13px] text-white">{entry.name}</span>
          {person?.role ? <span className="flex relative truncate font-ocr text-[10px] uppercase tracking-[0.15em] text-[#6e83c3]">{person.role}</span> : null}
        </button>
        <span className="flex relative font-ocr text-[10px] text-[#6e83c3] w-[110px]">
          {confirmedSlots}/{entry.slots.length} {entry.slots.length === 1 ? "slot" : "slots"}
        </span>
        <span className="flex relative font-mono text-[10px] text-white/50 w-[150px]">{latest ? `${latest.date} · ${contactChannelLabel(latest.channel)}` : "no contact yet"}</span>
        <Select
          compact
          className="w-[150px]"
          value={entry.status}
          options={statusOptions}
          onChange={(value) => onPatch({ status: value as PersonStatus })}
        />
      </div>
      {open ? (
        <div className="flex relative flex-col gap-3 border-t border-white/10 pt-3">
          <div className="flex relative flex-row flex-wrap gap-3">
            <div className="flex relative flex-col gap-1 flex-1 min-w-[140px]">
              <span className={tinyLabelClass}>Role</span>
              <input value={person?.role ?? ""} onChange={(e) => onPatch({ role: e.target.value })} className={smallInputClass} />
            </div>
            <div className="flex relative flex-col gap-1 flex-1 min-w-[180px]">
              <span className={tinyLabelClass}>Contact</span>
              <input value={person?.contact ?? ""} onChange={(e) => onPatch({ contact: e.target.value })} className={smallInputClass} />
            </div>
          </div>
          <div className="flex relative flex-col gap-1">
            <span className={tinyLabelClass}>Notes</span>
            <textarea value={person?.notes ?? ""} onChange={(e) => onPatch({ notes: e.target.value })} className={`${smallInputClass} min-h-[56px] resize-y`} />
          </div>
          <div className="flex relative flex-col gap-1.5">
            <span className={tinyLabelClass}>Slots</span>
            {entry.slots.map((slot) => (
              <div key={`${slot.site}/${slot.zone}/${slot.item}`} className="flex relative flex-row flex-wrap items-center gap-3">
                <span className="flex relative font-mono text-[11px] text-white/70 w-[100px] shrink-0">{slot.time}</span>
                <span className="flex relative flex-1 min-w-[160px] text-[12px] text-white">{slot.label}</span>
                <span className="flex relative font-ocr text-[10px] text-[#6e83c3] min-w-[140px]">{slot.where}</span>
                <div className="flex relative flex-row items-center gap-2 w-[160px] shrink-0">
                  <span className="flex relative h-2 w-2 shrink-0 rounded-full" style={{ background: productionColor(slot.production) }} />
                  <Select compact className="flex-1" value={slot.production} options={productionOptions} onChange={(value) => onSlotProduction(slot, value as Production)} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex relative flex-col gap-1.5">
            <span className={tinyLabelClass}>Messages</span>
            {(person?.log ?? []).map((item, index) => (
              <div key={`${item.date}-${index}`} className="flex relative flex-row flex-wrap items-center gap-2">
                <span className="flex relative font-mono text-[11px] text-white/70 w-[84px]">{item.date}</span>
                <span className="flex relative font-ocr text-[10px] uppercase tracking-[0.15em] text-[#009fdf] w-[70px]">{contactChannelLabel(item.channel)}</span>
                <span className="flex relative flex-1 min-w-[160px] text-[12px] text-white/85">{item.note}</span>
                <button type="button" onClick={() => onRemoveContact(index)} className={`${tinyButtonClass} border-white/30 text-white/70`}>
                  ×
                </button>
              </div>
            ))}
            <div className="flex relative flex-row items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex relative w-[136px] shrink-0 rounded-sm border border-white/15 bg-black px-2 py-1.5 font-mono text-[12px] text-white outline-none [color-scheme:dark] focus:border-[#daf822]"
              />
              <Select compact className="w-[110px] shrink-0" value={channel} options={CONTACT_CHANNELS} onChange={setChannel} />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEntry();
                  }
                }}
                placeholder="What was sent or agreed"
                className={`${smallInputClass} flex-1 min-w-0`}
              />
              <button type="button" onClick={addEntry} className={`${smallButtonClass} shrink-0`}>
                Log message
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
