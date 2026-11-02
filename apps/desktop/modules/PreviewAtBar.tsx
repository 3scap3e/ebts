import type { PreviewAtBarProps } from "@/types/map";
import { labelClass } from "@/hooks/theme";
import { timeInputClass } from "@/hooks/classes";
import { isHm, windowLabel } from "@/hooks/timeWindows";

export default function PreviewAtBar({ value, utc, active, onChange }: PreviewAtBarProps) {
  return (
    <div className="flex relative flex-row flex-wrap items-end gap-3">
      <div className="flex relative flex-col gap-1 w-[128px]">
        <span className={labelClass}>Preview at{utc ? " UTC" : ""}</span>
        <input
          type="time"
          value={value}
          onChange={(e) => {
            if (isHm(e.target.value)) onChange(e.target.value);
          }}
          className={`${timeInputClass} px-2 py-1.5 text-[13px]`}
        />
      </div>
      <div className="flex relative flex-col gap-1">
        <span className={labelClass}>Showing</span>
        <span className="flex relative py-1.5 font-mono text-[12px] text-white/60">{active ? `variant ${windowLabel(active)}` : "base"}</span>
      </div>
    </div>
  );
}
