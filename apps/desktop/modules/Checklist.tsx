import { useState } from "react";
import type { CheckItem } from "@/types/steps";
import type { ChecklistProps } from "@/types/ui";
import { useProject } from "@/hooks/useProject";
import { checkColor } from "@/hooks/theme";

const counts = (items: CheckItem[]) => ({
  ok: items.filter((i) => i.status === "ok").length,
  warn: items.filter((i) => i.status === "warn").length,
  missing: items.filter((i) => i.status === "missing").length,
});

function Row({ item }: { item: CheckItem }) {
  return (
    <li className="flex relative flex-row items-start gap-3">
      <span className="flex relative mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: checkColor[item.status] }} />
      <div className="flex relative flex-col">
        <span className="flex relative font-grotesk text-[13px] text-white">{item.label}</span>
        {item.hint ? <span className="flex relative font-grotesk text-[12px] text-[#6e83c3]">{item.hint}</span> : null}
      </div>
    </li>
  );
}

function Counts({ items }: { items: CheckItem[] }) {
  const c = counts(items);
  return (
    <span className="flex relative flex-row items-center gap-2 font-ocr text-[10px]">
      {c.ok ? <span style={{ color: checkColor.ok }}>{c.ok}</span> : null}
      {c.warn ? <span style={{ color: checkColor.warn }}>{c.warn}</span> : null}
      {c.missing ? <span style={{ color: checkColor.missing }}>{c.missing}</span> : null}
    </span>
  );
}

function Group({
  id,
  label,
  items,
  children,
  open,
  onToggle,
  depth,
}: {
  id: string;
  label: string;
  items: CheckItem[];
  children?: React.ReactNode;
  open: boolean;
  onToggle: (id: string) => void;
  depth: number;
}) {
  return (
    <div className={`flex relative flex-col gap-2 ${depth === 0 ? "border-t border-[#6e83c3] pt-2" : "pl-3"}`}>
      <button type="button" onClick={() => onToggle(id)} className="flex relative flex-row items-center justify-between gap-3 text-left">
        <span className={`flex relative font-ocr uppercase tracking-[0.2em] ${depth === 0 ? "text-[12px] text-[#daf822]" : "text-[11px] text-[#009fdf]"}`}>
          {open ? "▾" : "▸"} {label}
        </span>
        <Counts items={items} />
      </button>
      {open ? children : null}
    </div>
  );
}

export default function Checklist({ report }: ChecklistProps) {
  const { event } = useProject();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(false);

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));
  const items = report?.items ?? [];
  const general = items.filter((i) => !i.target?.site);
  const siteIds = Array.from(new Set(items.flatMap((i) => (i.target?.site ? [i.target.site] : []))));
  const missing = items.filter((i) => i.status !== "ok").length;
  const percent = Math.round((report?.progress ?? 0) * 100);
  const showing = expanded && report !== undefined;

  return (
    <div className="flex relative flex-col items-end">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        disabled={!report}
        className="flex relative flex-row h-[35px] w-[238px] items-center gap-3 rounded-[6px] border border-[#6e83c3] bg-black px-3 text-left"
      >
        <span
          className={`flex relative h-0 w-0 shrink-0 border-y-[3px] border-l-[4px] border-y-transparent border-l-[#6e83c3] transition ${showing ? "rotate-90" : ""}`}
        />
        <span className="flex relative flex-1 font-ocr text-[9px] uppercase leading-none tracking-[0.1em] text-[#6e83c3]">Pre-sim checklist</span>
        <span className="flex relative font-tanker text-[12px] leading-none text-[#6e83c3]">{missing}</span>
        <span className="flex relative font-tanker text-[12px] leading-none text-[#daf822]">{percent}%</span>
      </button>
      {showing ? (
        <div className="flex absolute right-0 top-full z-30 mt-2 max-h-[60vh] w-[380px] max-w-[70vw] flex-col gap-3 overflow-y-auto scroll-thin rounded-[6px] border border-[#6e83c3] bg-black p-4">
          {general.length > 0 ? (
            <ul className="flex relative flex-col gap-2">
              {general.map((item, index) => (
                <Row key={`${item.label}-${index}`} item={item} />
              ))}
            </ul>
          ) : null}
          {siteIds.map((siteId) => {
            const site = event?.sites.find((s) => s.id === siteId);
            const siteItems = items.filter((i) => i.target?.site === siteId);
            const direct = siteItems.filter((i) => !i.target?.zone);
            const zoneIds = Array.from(new Set(siteItems.flatMap((i) => (i.target?.zone ? [i.target.zone] : []))));
            return (
              <Group key={siteId} id={siteId} label={site?.label ?? siteId} items={siteItems} open={open[siteId] ?? false} onToggle={toggle} depth={0}>
                {direct.length > 0 ? (
                  <ul className="flex relative flex-col gap-2 pl-3">
                    {direct.map((item, index) => (
                      <Row key={`${item.label}-${index}`} item={item} />
                    ))}
                  </ul>
                ) : null}
                {zoneIds.map((zoneId) => {
                  const zone = site?.zones.find((z) => z.id === zoneId);
                  const zoneItems = siteItems.filter((i) => i.target?.zone === zoneId);
                  const key = `${siteId}/${zoneId}`;
                  return (
                    <Group key={key} id={key} label={zone?.label ?? zoneId} items={zoneItems} open={open[key] ?? false} onToggle={toggle} depth={1}>
                      <ul className="flex relative flex-col gap-2 pl-3">
                        {zoneItems.map((item, index) => (
                          <Row key={`${item.label}-${index}`} item={item} />
                        ))}
                      </ul>
                    </Group>
                  );
                })}
              </Group>
            );
          })}
          {general.length === 0 && siteIds.length === 0 ? (
            <span className="flex relative font-ocr text-[11px] uppercase tracking-[0.2em] text-[#6e83c3]">Nothing to check</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
