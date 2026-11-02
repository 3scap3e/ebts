import { useProject } from "@/hooks/useProject";
import { useSharedSimClock } from "@/hooks/useSimClockShared";
import SimControls from "@/modules/SimControls";
import ModePills from "@/modules/ModePills";
import Checklist from "@/modules/Checklist";

export default function SimBar() {
  const { event, step, reports } = useProject();
  const { clock, offsets } = useSharedSimClock();
  const report = reports.find((r) => r.step === step);

  return (
    <div className="flex relative flex-col w-full h-[160px] shrink-0 rounded-[14px] border border-[#daf822] bg-black">
      <div className="flex absolute z-10 -top-px -left-px flex-row items-start gap-2 rounded-br-[14px] border-r border-b border-[#daf822] bg-black pl-[10px] pr-[10px] pt-0 pb-[8px]">
        <ModePills />
      </div>
      <div className="flex relative flex-row h-[41px] shrink-0 items-start justify-end pt-[6px] pr-[21px]">
        <Checklist report={report} />
      </div>
      <div className="flex relative flex-col flex-1 min-h-0 mb-[9px] overflow-hidden">
        {event ? <SimControls clock={clock} offsets={offsets} /> : null}
      </div>
    </div>
  );
}
