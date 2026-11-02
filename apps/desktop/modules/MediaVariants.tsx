import type { MediaVariantsProps, VariantSlotOption } from "@/types/map";
import { labelClass } from "@/hooks/theme";
import { smallButtonClass, tinyButtonClass, tinyLabelClass } from "@/hooks/classes";
import { sortByStart } from "@/hooks/timeWindows";
import WindowInputs from "@/modules/WindowInputs";
import DeleteButton from "@/modules/DeleteButton";

const slots: VariantSlotOption[] = [
  { slot: "poster", label: "Poster", action: "Import poster" },
  { slot: "loop_video", label: "Loop", action: "Import loop" },
  { slot: "widget", label: "Minimap", action: "Import minimap image" },
];

export default function MediaVariants({ variants, allowWidget, utc, busy, onAdd, onWindow, onImport, onClear, onRemove }: MediaVariantsProps) {
  const rows = sortByStart(variants.map((variant, index) => ({ variant, index, window: variant.window })));
  const visible = allowWidget ? slots : slots.filter((s) => s.slot !== "widget");

  return (
    <div className="flex relative flex-col gap-2 rounded-sm border border-[#daf822]/25 p-3">
      <div className="flex relative flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex relative flex-row items-baseline gap-2">
          <span className={labelClass}>Variants</span>
          <span className="flex relative font-mono text-[11px] text-white/50">{variants.length}</span>
        </div>
        <button type="button" onClick={onAdd} disabled={busy} className={smallButtonClass}>
          + Add variant
        </button>
      </div>
      {rows.map(({ variant, index }) => (
        <div key={index} className="flex relative flex-col gap-2 border-t border-white/10 pt-2">
          <div className="flex relative flex-row flex-wrap items-end justify-between gap-3">
            <WindowInputs window={variant.window} utc={utc} onChange={(w) => onWindow(index, w)} />
            <DeleteButton compact disabled={busy} label="Remove" confirmLabel="Confirm" onConfirm={() => onRemove(index)} />
          </div>
          <div className="flex relative flex-col gap-1.5">
            {visible.map((s) => {
              const current = variant[s.slot];
              return (
                <div key={s.slot} className="flex relative flex-row flex-wrap items-center gap-2">
                  <span className={`${tinyLabelClass} w-[64px] shrink-0`}>{s.label}</span>
                  <button type="button" onClick={() => onImport(index, s.slot)} disabled={busy} className={tinyButtonClass}>
                    {s.action}
                  </button>
                  <span className="flex relative min-w-0 flex-1 truncate font-mono text-[11px] text-white/45">{current ?? "none"}</span>
                  {current ? (
                    <button type="button" onClick={() => onClear(index, s.slot)} disabled={busy} className={`${tinyButtonClass} border-white/30 text-white/70`}>
                      Clear
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
