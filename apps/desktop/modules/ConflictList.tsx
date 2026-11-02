import { green, orange, panelClass, red } from "@/hooks/theme";
import { errorClass, hintClass, smallButtonClass } from "@/hooks/classes";
import type { ConflictSeverity } from "@/types/sim";
import type { ConflictListProps } from "@/types/ui";

const severityColor: Record<ConflictSeverity, string> = {
  warn: orange,
  error: red,
};

export default function ConflictList({ conflicts, loading, error, onRun }: ConflictListProps) {

  return (
    <div className={`${panelClass} gap-3 p-4`}>
      <div className="flex relative flex-row items-center justify-between gap-3">
        <span className="flex relative text-[11px] uppercase tracking-[0.3em] text-[#009fdf]">Conflicts</span>
        <button type="button" onClick={onRun} disabled={loading} className={smallButtonClass}>
          {loading ? "Checking…" : "Check conflicts"}
        </button>
      </div>
      {error ? <span className={errorClass}>{error}</span> : null}
      {conflicts === null && !error ? <span className={hintClass}>Not checked yet.</span> : null}
      {conflicts !== null && conflicts.length === 0 ? (
        <div className="flex relative flex-row items-center gap-2">
          <span className="flex relative h-2 w-2 rounded-full" style={{ background: green }} />
          <span className="flex relative text-[13px] text-white/80">Clean.</span>
        </div>
      ) : null}
      {conflicts !== null && conflicts.length > 0 ? (
        <div className="flex relative flex-col gap-3">
          <span className="flex relative font-mono text-[11px] text-white/50">{conflicts.length} to fix</span>
          <ul className="flex relative flex-col gap-2.5">
            {conflicts.map((conflict, index) => (
              <li key={`${conflict.message}-${index}`} className="flex relative flex-row items-start gap-3">
                <span
                  className="flex relative mt-[5px] h-2 w-2 shrink-0 rounded-full"
                  style={{ background: severityColor[conflict.severity] }}
                />
                <div className="flex relative flex-col gap-0.5 min-w-0">
                  <span className="flex relative text-[13px] leading-snug text-white/90">{conflict.message}</span>
                  {conflict.site || conflict.zone || conflict.item ? (
                    <span className="flex relative font-mono text-[10px] text-white/40 truncate">
                      {[conflict.site, conflict.zone].filter(Boolean).join(" / ")}
                      {conflict.item ? ` · ${conflict.item}` : ""}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
