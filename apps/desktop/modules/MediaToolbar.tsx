import type { MediaToolbarProps } from "@/types/map";
import { buttonClass, ghostButtonClass, inputClass, labelClass } from "@/hooks/theme";

export default function MediaToolbar({
  view,
  natural,
  allowLoop,
  busy,
  notice,
  onImportImage,
  onImportLoop,
  onClearLoop,
  onUseImageSize,
  onSize,
}: MediaToolbarProps) {
  const mismatch = natural !== null && (natural.width !== view.width || natural.height !== view.height);

  return (
    <div className="flex relative flex-col gap-2">
      <div className="flex relative flex-row flex-wrap items-end gap-3">
        <button type="button" onClick={onImportImage} disabled={busy} className={buttonClass}>
          {view.image ? "Replace poster" : "Import poster"}
        </button>
        {allowLoop ? (
          <button type="button" onClick={onImportLoop} disabled={busy} className={ghostButtonClass}>
            {view.loop ? "Replace loop" : "Import loop video"}
          </button>
        ) : null}
        {allowLoop && view.loop ? (
          <button type="button" onClick={onClearLoop} disabled={busy} className={ghostButtonClass}>
            Drop loop
          </button>
        ) : null}
        <div className="flex relative flex-col gap-1 w-[96px]">
          <span className={labelClass}>Width</span>
          <input
            type="number"
            min={1}
            value={view.width}
            onChange={(e) => onSize(Number(e.target.value) || view.width, view.height)}
            className={`${inputClass} px-2 py-1.5 font-mono text-[13px]`}
          />
        </div>
        <div className="flex relative flex-col gap-1 w-[96px]">
          <span className={labelClass}>Height</span>
          <input
            type="number"
            min={1}
            value={view.height}
            onChange={(e) => onSize(view.width, Number(e.target.value) || view.height)}
            className={`${inputClass} px-2 py-1.5 font-mono text-[13px]`}
          />
        </div>
        {mismatch && natural ? (
          <button type="button" onClick={onUseImageSize} className={`${buttonClass} border-[#ffb347]/70 text-[#ffb347] hover:bg-[#ffb347]`}>
            Use image size {natural.width}×{natural.height}
          </button>
        ) : null}
      </div>
      <div className="flex relative flex-row flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-white/45">
        <span className="flex relative truncate">poster: {view.image ?? "none"}</span>
        {allowLoop ? <span className="flex relative truncate">loop: {view.loop ?? "none"}</span> : null}
      </div>
      {notice ? (
        <span className="flex relative rounded-sm border border-[#ffb347]/50 bg-[#ffb347]/10 px-3 py-1.5 text-[12px] text-[#ffb347]">{notice}</span>
      ) : null}
    </div>
  );
}
