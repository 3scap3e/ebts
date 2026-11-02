import { useProject } from "@/hooks/useProject";
import { STEP_ORDER } from "@/types/steps";

export default function Sidebar() {
  const { step, setStep, reports } = useProject();

  return (
    <div className="flex relative flex-col w-[175px] shrink-0 h-full min-h-0 overflow-y-auto overflow-x-hidden scroll-thin">
      <span className="flex relative w-[166px] whitespace-nowrap font-clash text-[11.5px] font-bold uppercase leading-none tracking-[0.02em] text-[#daf822]">
        Event Formation Timeline
      </span>
      <ol className="flex relative flex-col w-[166px] mt-[32px]">
        {STEP_ORDER.map((meta, index) => {
          const report = reports.find((r) => r.step === meta.id);
          const progress = report ? report.progress : 0;
          const active = step === meta.id;
          const missing = report ? report.items.filter((i) => i.status !== "ok").length : 0;
          const full = active || progress >= 1;
          return (
            <li key={meta.id} className="flex relative flex-col h-[53px] shrink-0">
              <button type="button" onClick={() => setStep(meta.id)} className="flex relative flex-col items-start text-left">
                <div className="flex relative flex-row items-center gap-[1ch]">
                  <span
                    className={`flex relative font-kalmansk text-[13.5px] uppercase leading-none text-white ${active ? "-ml-[4px] bg-[#3a9e68] px-[4px]" : ""}`}
                  >
                    {index + 1}. {meta.title}
                  </span>
                  <span
                    className={`flex relative font-kalmansk text-[11.5px] leading-none ${active ? "bg-[#daf822] px-[4px] text-black" : "text-[#009fdf]"}`}
                  >
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <div className="flex relative mt-[6px] h-[3px] w-[165px] box-border border border-[#6e83c3] bg-black">
                  <div
                    className="flex relative h-full"
                    style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, background: full ? "#3a9e68" : "#daf822" }}
                  />
                </div>
                {missing ? (
                  <span className="flex relative mt-[6px] font-kalmansk text-[10.5px] uppercase leading-none text-[#6e83c3]">
                    {missing} {missing === 1 ? "field" : "fields"} missing
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
