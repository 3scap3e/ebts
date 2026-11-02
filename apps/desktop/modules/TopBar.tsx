import { useProject } from "@/hooks/useProject";

export default function TopBar() {
  const { event, root, dirty } = useProject();
  const title = event ? event.name.replace(/\s*\n+\s*/g, " ").trim() || "Untitled event" : "New event";
  const path = event ? `${root ?? "unsaved"}${dirty ? " *" : ""}` : "";

  return (
    <div className="flex relative flex-row w-full shrink-0 items-start justify-between gap-6 pb-[14px]">
      <div className="flex relative flex-col min-w-0 gap-[8px] pt-[4px]">
        <span className="flex relative truncate font-ocr text-[16px] font-bold uppercase leading-none text-white">{title}</span>
        <span className="flex relative truncate font-ocr text-[11px] leading-none text-[#6e83c3]">{path}</span>
      </div>
      <span className="flex relative shrink-0 font-stardom text-[28px] leading-none text-[#daf822]">EBTS</span>
    </div>
  );
}
