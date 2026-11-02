import { useEffect, useRef, useState } from "react";
import type { SelectProps } from "@/types/ui";

export default function Select({ value, options, onChange, className = "", compact = false, placeholder = "", searchable = false }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrap = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const current = options.find((o) => o.value === value);
  const needle = query.trim().toLowerCase();
  const shown = searchable && needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (searchable) search.current?.focus();
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
  }, [open, searchable]);

  const step = (delta: number) => {
    const enabled = options.filter((o) => !o.disabled);
    const index = enabled.findIndex((o) => o.value === value);
    const next = enabled[Math.min(enabled.length - 1, Math.max(0, index + delta))];
    if (next && next.value !== value) onChange(next.value);
  };

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const size = compact ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-[12px]";

  return (
    <div ref={wrap} data-ui className={`flex relative flex-col ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            step(1);
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(-1);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex relative flex-row w-full items-center justify-between gap-3 rounded-sm border bg-black font-tanker uppercase leading-none tracking-[0.2em] text-[#daf822] transition ${size} ${open ? "border-[#daf822]" : "border-[#daf822]/50 hover:border-[#daf822]"}`}
      >
        <span className="flex relative truncate">{current ? current.label : placeholder}</span>
        <svg viewBox="0 0 24 24" className={`flex relative h-3 w-3 shrink-0 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="flex absolute left-0 top-full z-30 mt-1 w-full min-w-[160px] flex-col rounded-sm border border-[#daf822] bg-black">
          {searchable ? (
            <input
              ref={search}
              type="text"
              value={query}
              placeholder="Type to filter"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = shown.find((o) => !o.disabled);
                  if (first) pick(first.value);
                }
              }}
              className={`flex relative w-full border-b border-[#daf822]/40 bg-black font-mono text-white outline-none placeholder:text-white/35 ${compact ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-[12px]"}`}
            />
          ) : null}
          <ul role="listbox" className="flex relative max-h-[260px] w-full flex-col overflow-y-auto py-1 scroll-thin">
            {shown.length === 0 ? (
              <li className={`flex relative px-3 py-2 font-mono text-white/45 ${compact ? "text-[10px]" : "text-[11px]"}`}>No match</li>
            ) : null}
            {shown.map((option) => {
              const selected = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={selected} className="flex relative">
                  <button
                    type="button"
                    disabled={option.disabled}
                    onClick={() => pick(option.value)}
                    className={`flex relative w-full flex-row items-center px-3 py-2 text-left font-tanker uppercase leading-none tracking-[0.2em] transition ${compact ? "text-[10px]" : "text-[12px]"} ${
                      selected ? "bg-[#daf822] text-black" : "text-[#daf822] hover:bg-[#daf822]/15"
                    } disabled:opacity-30 disabled:hover:bg-transparent`}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
