import { useState } from "react";
import type { ListOverlayProps } from "@/types/play";

export default function ListOverlay({ title, entries, defaultOpen, onSelect }: ListOverlayProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (entries.length === 0) return null;

  return (
    <div data-ui className="flex absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex-col items-center gap-2 md:bottom-6">
      {open ? (
        <div className="flex relative flex-col w-[min(92vw,520px)] max-h-[50vh] rounded-md border border-[#daf822]/40 bg-black p-3">
          <span className="flex relative mb-2 text-[11px] uppercase tracking-[0.3em] text-[#009fdf]">{title}</span>
          <ul className="flex relative flex-row flex-wrap gap-2 overflow-y-auto scroll-thin">
            {entries.map((entry) => (
              <li key={entry.id} className="flex relative">
                <button
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  className="flex relative flex-col items-start gap-0.5 rounded-sm border border-[#daf822]/50 bg-black px-3 py-2 text-left transition hover:bg-[#daf822] hover:text-black group"
                >
                  <span className="flex relative font-display text-[16px] uppercase leading-none tracking-[0.08em] text-[#daf822] group-hover:text-black">{entry.label}</span>
                  <span className="flex relative text-[10px] uppercase tracking-[0.2em] text-white/50 group-hover:text-black/70">{entry.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex relative flex-row items-center gap-3 rounded-sm border border-[#daf822]/60 bg-black px-3 py-2 text-[11px] uppercase leading-none tracking-[0.3em] text-[#daf822] transition hover:bg-[#daf822] hover:text-black"
      >
        {open ? `Hide ${title}` : title}
      </button>
    </div>
  );
}
