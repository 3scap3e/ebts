import { useState } from "react";
import { labelClass, panelClass } from "@/hooks/theme";
import { errorClass, hintClass, smallButtonClass, smallInputClass } from "@/hooks/classes";
import { customTemplate, humanize } from "@/hooks/zoneEdit";
import type { ZoneCatalogProps } from "@/types/ui";

export default function ZoneCatalog({ templates, loading, error, onAdd }: ZoneCatalogProps) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const addCustom = () => {
    const label = custom.trim();
    if (!label) return;
    onAdd(customTemplate(label));
    setCustom("");
  };

  return (
    <div className={`${panelClass} gap-3 p-4`}>
      <div className="flex relative flex-row items-center justify-between gap-3">
        <span className={labelClass}>Zone catalog</span>
        <button type="button" onClick={() => setOpen((v) => !v)} className={smallButtonClass}>
          {open ? "Collapse" : `Show ${templates.length}`}
        </button>
      </div>
      {open ? (
        <div className="flex relative flex-col gap-3">
          {loading ? <span className={hintClass}>Loading catalog…</span> : null}
          {error ? <span className={errorClass}>{error}</span> : null}
          <div className="flex relative flex-row flex-wrap gap-2">
            {templates.map((template) => (
              <div
                key={`${template.format}-${template.label}`}
                className="flex relative flex-col w-[228px] gap-2 rounded-sm border border-white/10 bg-black/40 p-3"
              >
                <div className="flex relative flex-row items-start justify-between gap-2">
                  <span className="flex relative text-[14px] uppercase leading-tight tracking-[0.08em] text-[#daf822]">
                    {template.label}
                  </span>
                  <span className="flex relative shrink-0 font-mono text-[10px] text-white/40">{template.id_prefix}</span>
                </div>
                <span className="flex relative text-[12px] leading-snug text-white/70">{template.description}</span>
                <div className="flex relative flex-row flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex relative font-mono text-[10px] uppercase tracking-[0.15em] text-[#009fdf]">
                    {humanize(template.format)}
                  </span>
                  <span className="flex relative text-[10px] text-white/30">·</span>
                  <span className="flex relative font-mono text-[10px] uppercase tracking-[0.15em] text-white/50">
                    {humanize(template.rhythm)}
                  </span>
                </div>
                <button type="button" onClick={() => onAdd(template)} className={`${smallButtonClass} mt-auto self-start`}>
                  Add
                </button>
              </div>
            ))}
          </div>
          <div className="flex relative flex-row items-center gap-2 border-t border-white/10 pt-3">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="Or name a custom zone"
              className={smallInputClass}
            />
            <button type="button" onClick={addCustom} disabled={!custom.trim()} className={smallButtonClass}>
              Add custom
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
