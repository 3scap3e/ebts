import { labelClass, panelClass } from "@/hooks/theme";
import { smallButtonClass } from "@/hooks/classes";
import { sortByStart } from "@/hooks/timeWindows";
import WindowInputs from "@/modules/WindowInputs";
import DeleteButton from "@/modules/DeleteButton";
import type { WindowsPanelProps } from "@/types/ui";

export default function WindowsPanel({ variants, utc, onAdd, onWindow, onRemove }: WindowsPanelProps) {
  const rows = sortByStart(variants.map((variant, index) => ({ variant, index, window: variant.window })));

  return (
    <div className={`${panelClass} gap-3 p-5`}>
      <div className="flex relative flex-row flex-wrap items-center justify-between gap-2">
        <span className={labelClass}>Time windows</span>
        <button type="button" onClick={onAdd} className={smallButtonClass}>
          Add time window
        </button>
      </div>
      {rows.map(({ variant, index }) => (
        <div key={index} className="flex relative flex-row flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-3">
          <WindowInputs window={variant.window} utc={utc} onChange={(w) => onWindow(index, w)} />
          <DeleteButton compact label="Remove" confirmLabel="Confirm" onConfirm={() => onRemove(index)} />
        </div>
      ))}
    </div>
  );
}
