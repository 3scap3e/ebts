import type { WindowInputsProps } from "@/types/map";
import { tinyLabelClass, tinyTimeClass } from "@/hooks/classes";
import { isHm } from "@/hooks/timeWindows";

export default function WindowInputs({ window, utc, onChange }: WindowInputsProps) {
  const write = (key: "start" | "end", value: string) => {
    if (isHm(value)) onChange({ ...window, [key]: value });
  };

  return (
    <div className="flex relative flex-row flex-wrap items-end gap-2">
      <div className="flex relative flex-col gap-1">
        <span className={tinyLabelClass}>Start{utc ? " UTC" : ""}</span>
        <input type="time" value={window.start} onChange={(e) => write("start", e.target.value)} className={`${tinyTimeClass} w-[96px]`} />
      </div>
      <div className="flex relative flex-col gap-1">
        <span className={tinyLabelClass}>End{utc ? " UTC" : ""}</span>
        <input type="time" value={window.end} onChange={(e) => write("end", e.target.value)} className={`${tinyTimeClass} w-[96px]`} />
      </div>
    </div>
  );
}
