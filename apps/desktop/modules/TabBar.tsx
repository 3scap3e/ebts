import type { TabBarProps } from "@/types/ui";

export default function TabBar({ tabs, active, onSelect, vertical = false, emptyLabel = "Nothing here yet" }: TabBarProps) {
  if (tabs.length === 0) {
    return <span className="flex relative text-[12px] text-white/40">{emptyLabel}</span>;
  }
  return (
    <div className={`flex relative ${vertical ? "flex-col gap-1" : "flex-row flex-wrap gap-2"}`}>
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`flex relative flex-row items-center gap-3 rounded-sm border px-3 py-1.5 text-[11px] uppercase tracking-[0.25em] transition ${
              vertical ? "justify-between" : ""
            } ${
              on
                ? "border-[#daf822] bg-[#daf822] text-black"
                : "border-white/15 text-white/70 hover:border-[#daf822]/60 hover:text-[#daf822]"
            }`}
          >
            <span className="flex relative truncate">{tab.label}</span>
            {tab.count !== undefined ? (
              <span className={`flex relative font-mono text-[10px] tracking-normal ${on ? "text-black/60" : "text-white/40"}`}>
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
