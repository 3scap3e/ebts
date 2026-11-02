import { useEffect, useMemo, useState } from "react";
import type { LevelRowProps, LevelSectionHeaderProps, MapLevelListProps } from "@/types/map";
import { labelClass } from "@/hooks/theme";
import { levelSections, sectionKeyOf } from "@/hooks/levelSections";

const indentClass = ["pl-3", "pl-6", "pl-9"];

function LevelRow({ entry, active, onSelect }: LevelRowProps) {
  const complete = entry.total > 0 && entry.drawn === entry.total;
  return (
    <li className="flex relative flex-col">
      <button
        type="button"
        onClick={onSelect}
        className={`flex relative flex-col items-start gap-0.5 rounded-sm border py-1.5 pr-2 text-left transition ${indentClass[entry.indent] ?? "pl-3"} ${
          active ? "border-[#daf822] bg-[#daf822]/10" : "border-transparent hover:border-white/20"
        }`}
      >
        <span className={`flex relative w-full truncate text-[11px] uppercase tracking-[0.08em] ${active ? "text-[#daf822]" : "text-white/85"}`}>
          {entry.label}
        </span>
        <span className="flex relative flex-row w-full items-center gap-1.5 truncate text-[9px] uppercase tracking-[0.1em] text-[#6e83c3]">
          <span className="flex relative h-1.5 w-1.5 rounded-full" style={{ background: entry.hasImage ? "#7cff6b" : "#444" }} />
          <span className="flex relative truncate">{entry.sub}</span>
          {entry.total > 0 ? (
            <span className="flex relative font-mono" style={{ color: complete ? "#7cff6b" : "#ffb347" }}>
              {entry.drawn}/{entry.total}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function SectionHeader({ section, open, onToggle }: LevelSectionHeaderProps) {
  const complete = section.total > 0 && section.drawn === section.total;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex relative flex-row items-center justify-between gap-2 rounded-sm border border-transparent px-1 py-1 text-left transition hover:border-white/20"
    >
      <span className="flex relative flex-row items-center gap-2 min-w-0">
        <span className="flex relative font-tanker text-[11px] leading-none text-[#daf822]">{open ? "▾" : "▸"}</span>
        <span className={`${labelClass} truncate`}>{section.title}</span>
      </span>
      {!open ? (
        <span className="flex relative flex-row items-center gap-2 shrink-0">
          <span className="flex relative h-1.5 w-1.5 rounded-full" style={{ background: section.allImages ? "#7cff6b" : "#444" }} />
          {section.total > 0 ? (
            <span className="flex relative font-mono text-[10px]" style={{ color: complete ? "#7cff6b" : "#ffb347" }}>
              {section.drawn}/{section.total}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

export default function MapLevelList({ entries, activeKey, onSelect }: MapLevelListProps) {
  const sections = useMemo(() => levelSections(entries), [entries]);
  const activeSection = useMemo(() => {
    const entry = entries.find((e) => e.key === activeKey);
    return entry ? sectionKeyOf(entry) : null;
  }, [entries, activeKey]);
  const [open, setOpen] = useState<Record<string, boolean>>(() => (activeSection ? { [activeSection]: true } : {}));

  useEffect(() => {
    if (!activeSection) return;
    setOpen((prev) => (prev[activeSection] ? prev : { ...prev, [activeSection]: true }));
  }, [activeSection]);

  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex relative flex-col w-full max-h-[260px] shrink-0 gap-3 overflow-y-auto scroll-thin rounded-[6px] border border-[#6e83c3] bg-black p-2">
      {sections.map((section) => {
        if (section.kind === "event") {
          return (
            <div key={section.key} className="flex relative flex-col gap-1.5">
              <span className={`${labelClass} px-1`}>{section.title}</span>
              <ul className="flex relative flex-col gap-1">
                {section.items.map((entry) => (
                  <LevelRow key={entry.key} entry={entry} active={entry.key === activeKey} onSelect={() => onSelect(entry.level)} />
                ))}
              </ul>
            </div>
          );
        }
        const isOpen = Boolean(open[section.key]);
        return (
          <div key={section.key} className="flex relative flex-col gap-1.5">
            <SectionHeader section={section} open={isOpen} onToggle={() => toggle(section.key)} />
            {isOpen ? (
              <ul className="flex relative flex-col gap-1">
                {section.items.map((entry) => (
                  <LevelRow key={entry.key} entry={entry} active={entry.key === activeKey} onSelect={() => onSelect(entry.level)} />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
