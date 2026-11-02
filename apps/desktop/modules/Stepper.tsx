import { useEffect, useRef, useState } from "react";
import type { StepperProps } from "@/types/ui";

const arrowClass =
  "flex relative flex-row h-full w-[22px] shrink-0 items-center justify-center font-tanker text-[13.5px] leading-none text-[#daf822] transition hover:bg-[#daf822]/15 disabled:opacity-30 disabled:pointer-events-none";

export default function Stepper({ label, value, options, disabled = false, onPrev, onNext, onSelect }: StepperProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const canOpen = !disabled && options.length > 0;

  return (
    <div ref={wrap} className="flex relative flex-col gap-[4px] min-w-[106px] max-w-[190px] shrink-0">
      <span className="flex relative font-grotesk text-[10.5px] leading-none text-[#daf822]">{label}</span>
      <div className={`flex relative flex-row h-[21px] w-full items-center border bg-black ${open ? "border-[#daf822]" : "border-[#6e83c3]"}`}>
        <button type="button" onClick={onPrev} disabled={disabled} aria-label={`Previous ${label}`} className={arrowClass}>
          {"<"}
        </button>
        <button
          type="button"
          onClick={() => canOpen && setOpen((v) => !v)}
          disabled={!canOpen}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex relative flex-1 min-w-0 flex-row items-center justify-center gap-1 px-[6px] text-center font-tanker text-[13.5px] uppercase leading-none text-[#daf822] transition hover:bg-[#daf822]/10 disabled:hover:bg-transparent"
        >
          <span className="flex relative min-w-0 truncate">{value}</span>
          {canOpen ? (
            <svg viewBox="0 0 24 24" className={`flex relative h-[9px] w-[9px] shrink-0 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          ) : null}
        </button>
        <button type="button" onClick={onNext} disabled={disabled} aria-label={`Next ${label}`} className={arrowClass}>
          {">"}
        </button>
      </div>
      {open ? (
        <ul role="listbox" className="flex absolute left-0 top-full z-30 mt-1 max-h-[240px] w-full min-w-[170px] flex-col overflow-y-auto border border-[#daf822] bg-black py-1 scroll-thin">
          {options.map((option) => {
            const selected = option.label === value;
            return (
              <li key={option.value} role="option" aria-selected={selected} className="flex relative">
                <button
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={`flex relative w-full flex-row items-center px-3 py-[6px] text-left font-tanker text-[12px] uppercase leading-none transition ${
                    selected ? "bg-[#daf822] text-black" : "text-[#daf822] hover:bg-[#daf822]/15"
                  } disabled:opacity-30`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
