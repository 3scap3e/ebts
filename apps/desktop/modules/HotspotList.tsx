import { useState } from "react";
import type { HotspotListProps } from "@/types/map";
import { labelClass } from "@/hooks/theme";
import { smallInputClass, tinyButtonClass, tinyLabelClass } from "@/hooks/classes";
import { isArea, isDrawn } from "@/hooks/geometry";
import { windowLabel } from "@/hooks/timeWindows";
import WindowInputs from "@/modules/WindowInputs";

export default function HotspotList({
  targets,
  draft,
  activeTarget,
  defaultWindow,
  utc,
  onWindow,
  onHover,
  onDraw,
  onFinish,
  onUndoPoint,
  onCancel,
  onClear,
  onAddArea,
  onRenameArea,
  onRemoveArea,
}: HotspotListProps) {
  const drafting = draft !== null;
  const count = draft?.points.length ?? 0;
  const [editingWindow, setEditingWindow] = useState<string | null>(null);

  return (
    <div className="flex relative flex-col w-full flex-1 min-h-0 gap-3 overflow-y-auto scroll-thin rounded-[6px] border border-[#6e83c3] bg-black p-2">
      <div className="flex relative flex-row items-center justify-between">
        <span className={labelClass}>Hotspots</span>
        <span className="flex relative font-mono text-[11px] text-white/50">
          {targets.filter((t) => isDrawn(t.polygon)).length}/{targets.length}
        </span>
      </div>
      {draft ? (
        <div className="flex relative flex-col gap-2 rounded-sm border border-[#daf822]/60 bg-[#daf822]/10 p-2">
          <div className="flex relative flex-row items-center justify-between gap-2">
            <span className="flex relative truncate text-[11px] uppercase tracking-[0.2em] text-[#daf822]">
              {targets.find((t) => t.target === draft.target)?.label ?? draft.target}
            </span>
            <span className="flex relative shrink-0 font-mono text-[11px] text-white/70">
              {count} pt{count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex relative flex-row flex-wrap gap-1.5">
            {count >= 3 ? (
              <button type="button" onClick={onFinish} className={tinyButtonClass}>
                Finish
              </button>
            ) : null}
            <button type="button" onClick={onUndoPoint} disabled={count === 0} className={`${tinyButtonClass} border-[#6e83c3] text-[#6e83c3] hover:bg-[#6e83c3]`}>
              Undo point
            </button>
            <button type="button" onClick={onCancel} className={`${tinyButtonClass} border-[#6e83c3] text-[#6e83c3] hover:bg-[#6e83c3]`}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <ul className="flex relative flex-col gap-1.5">
        {targets.map((t) => {
          const drawn = isDrawn(t.polygon);
          const active = activeTarget === t.target;
          const area = isArea(t.target);
          const window = t.window ?? null;
          const canWindow = drawn || area;
          const editing = editingWindow === t.target && window !== null;
          return (
            <li
              key={t.target}
              onMouseEnter={() => onHover(t.target)}
              onMouseLeave={() => onHover(null)}
              className={`flex relative flex-col gap-1.5 rounded-sm border p-2 transition ${active ? "border-[#daf822]/70 bg-white/5" : "border-white/10"}`}
            >
              <div className="flex relative flex-row items-center justify-between gap-2">
                {area ? (
                  <input
                    value={t.label}
                    onChange={(e) => onRenameArea(t.target, e.target.value)}
                    className={`${smallInputClass} min-w-0 flex-1 px-1.5 py-0.5 text-[12px] uppercase tracking-[0.12em]`}
                  />
                ) : (
                  <span className="flex relative truncate text-[12px] uppercase tracking-[0.12em] text-white/90">{t.label}</span>
                )}
                <span
                  className="flex relative shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em]"
                  style={{ borderColor: drawn ? "#7cff6b" : "#ff6b6b", color: drawn ? "#7cff6b" : "#ff6b6b" }}
                >
                  {drawn ? `${t.polygon.length} pts` : "not drawn"}
                </span>
              </div>
              {canWindow ? (
                <div className="flex relative flex-col gap-1.5">
                  <div className="flex relative flex-row items-center gap-2">
                    <span className={tinyLabelClass}>Window</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window) {
                          onWindow(t.target, { ...defaultWindow });
                          setEditingWindow(t.target);
                        } else {
                          setEditingWindow(editing ? null : t.target);
                        }
                      }}
                      className={tinyButtonClass}
                    >
                      {window ? windowLabel(window) : "All day"}
                    </button>
                  </div>
                  {editing && window ? (
                    <div className="flex relative flex-row flex-wrap items-end gap-2">
                      <WindowInputs window={window} utc={utc} onChange={(w) => onWindow(t.target, w)} />
                      <button
                        type="button"
                        onClick={() => {
                          onWindow(t.target, null);
                          setEditingWindow(null);
                        }}
                        className={`${tinyButtonClass} border-white/30 px-2 py-1 text-[12px] text-white/70`}
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex relative flex-row flex-wrap gap-1.5">
                <button type="button" onClick={() => onDraw(t.target)} disabled={drafting} className={tinyButtonClass}>
                  {drawn ? "Redraw" : "Draw"}
                </button>
                {drawn && area ? (
                  <button type="button" onClick={() => onClear(t.target)} disabled={drafting} className={`${tinyButtonClass} border-[#6e83c3] text-[#6e83c3] hover:bg-[#6e83c3]`}>
                    Clear
                  </button>
                ) : null}
                {drawn && !area ? (
                  <button type="button" onClick={() => onClear(t.target)} disabled={drafting} className={`${tinyButtonClass} border-[#ff6b6b]/70 text-[#ff6b6b] hover:bg-[#ff6b6b]`}>
                    Remove
                  </button>
                ) : null}
                {area ? (
                  <button type="button" onClick={() => onRemoveArea(t.target)} disabled={drafting} className={`${tinyButtonClass} border-[#ff6b6b]/70 text-[#ff6b6b] hover:bg-[#ff6b6b]`}>
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onAddArea} disabled={drafting} className={`${tinyButtonClass} self-start`}>
        + Add area
      </button>
    </div>
  );
}
