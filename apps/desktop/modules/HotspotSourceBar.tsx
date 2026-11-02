import type { HotspotSourceBarProps, HotspotSourceOption } from "@/types/map";
import { labelClass } from "@/hooks/theme";
import { secondsLabel } from "@/hooks/time";
import DeleteButton from "@/modules/DeleteButton";

const sources: HotspotSourceOption[] = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
];

export default function HotspotSourceBar({ source, linked, frame, duration, busy, onSource, onUnlink, onLink, onFrame }: HotspotSourceBarProps) {
  return (
    <div className="flex relative flex-row flex-wrap items-end gap-4">
      <div className="flex relative flex-col gap-1">
        <span className={labelClass}>Background</span>
        <div className="flex relative flex-row">
          {sources.map((s, i) => {
            const on = s.id === source;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSource(s.id)}
                className={`flex relative flex-row items-center border border-[#daf822]/60 px-3 py-1.5 font-tanker text-[11px] uppercase leading-none tracking-[0.25em] transition ${
                  i === 0 ? "rounded-l-sm" : "rounded-r-sm border-l-0"
                } ${on ? "bg-[#daf822] text-black" : "bg-black text-[#daf822] hover:bg-[#daf822]/15"}`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex relative flex-col gap-1">
        <span className={labelClass}>Hotspots</span>
        {linked ? (
          <button
            type="button"
            onClick={onUnlink}
            disabled={busy}
            className="flex relative flex-row items-center rounded-sm border border-[#daf822] bg-[#daf822] px-3 py-1.5 font-tanker text-[11px] uppercase leading-none tracking-[0.25em] text-black transition hover:bg-black hover:text-[#daf822] disabled:opacity-50 disabled:pointer-events-none"
          >
            Linked
          </button>
        ) : (
          <DeleteButton compact disabled={busy} label="Unlinked" confirmLabel="Relink" onConfirm={onLink} />
        )}
      </div>
      {source === "video" ? (
        <div className="flex relative flex-col gap-1 flex-1 min-w-[220px]">
          <div className="flex relative flex-row items-center justify-between">
            <span className={labelClass}>Frame</span>
            <span className="flex relative font-tanker text-[12px] tracking-[0.1em] text-[#daf822]">
              {secondsLabel(frame)} / {secondsLabel(duration)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 0}
            step={0.1}
            value={Math.min(frame, duration > 0 ? duration : 0)}
            disabled={duration <= 0}
            onChange={(e) => onFrame(Number(e.target.value))}
            className="flex relative w-full accent-[#daf822]"
          />
        </div>
      ) : null}
    </div>
  );
}
