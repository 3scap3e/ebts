import { useProject } from "@/hooks/useProject";
import Sidebar from "@/modules/Sidebar";
import TopBar from "@/modules/TopBar";
import ModePills from "@/modules/ModePills";
import StepArt from "@/modules/StepArt";
import SimBar from "@/modules/SimBar";
import SimClockProvider from "@/modules/SimClockProvider";
import StartPanel from "@/modules/StartPanel";
import ConceptStep from "@/modules/steps/ConceptStep";
import SitesStep from "@/modules/steps/SitesStep";
import ZonesStep from "@/modules/steps/ZonesStep";
import ProgramStep from "@/modules/steps/ProgramStep";
import ProductionStep from "@/modules/steps/ProductionStep";
import MapsStep from "@/modules/steps/MapsStep";
import ContentStep from "@/modules/steps/ContentStep";
import BaitStep from "@/modules/steps/BaitStep";
import SimulateStep from "@/modules/steps/SimulateStep";
import ExportStep from "@/modules/steps/ExportStep";
import PlayMode from "@/modules/play/PlayMode";
import type { StepId } from "@/types/steps";
import type { ComponentType } from "react";

const stepViews: Record<StepId, ComponentType> = {
  concept: ConceptStep,
  sites: SitesStep,
  zones: ZonesStep,
  program: ProgramStep,
  production: ProductionStep,
  maps: MapsStep,
  content: ContentStep,
  bait: BaitStep,
  simulate: SimulateStep,
  export: ExportStep,
};

export default function Shell() {
  const { event, step, mode, error, clearError } = useProject();

  if (event && mode === "play") {
    return (
      <div className="flex relative flex-col w-full h-full bg-black font-tanker">
        <div className="flex relative flex-col gap-3 px-6 pt-4 pb-3">
          <TopBar />
          <ModePills />
        </div>
        <div className="flex relative flex-col flex-1 min-h-0">
          <PlayMode />
        </div>
      </div>
    );
  }

  const View = event ? stepViews[step] : StartPanel;

  return (
    <SimClockProvider>
      <div className="flex relative flex-row w-full h-full bg-black pr-[10px] gap-[14px]">
        <StepArt />
        <div className="flex relative flex-col flex-1 min-w-0 min-h-0 pt-[16px] pb-[18px]">
          <TopBar />
          <div className="flex relative flex-col mt-[6px] shrink-0">
            <SimBar />
          </div>
          <div className="flex relative flex-row flex-1 min-h-0 mt-[17px] pl-[9px] gap-[32px]">
            <Sidebar />
            <View />
          </div>
          {event && error ? (
            <button
              type="button"
              onClick={clearError}
              className="flex absolute bottom-[24px] right-[6px] z-30 max-w-[60%] flex-row items-center rounded-[6px] border border-[#ff6b6b] bg-black px-3 py-2 text-left font-ocr text-[11px] leading-snug text-[#ff6b6b]"
            >
              <span className="flex relative min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere]">{error}</span>
            </button>
          ) : null}
        </div>
      </div>
    </SimClockProvider>
  );
}
