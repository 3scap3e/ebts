import StepFrame from "@/modules/StepFrame";

export default function BaitStep() {
  return (
    <StepFrame step="bait">
      <div className="flex relative flex-col flex-1 items-center justify-center gap-5 py-2">
        <img src="/images/bait-reveal.webp" alt="" draggable={false} className="flex relative select-none max-h-[340px] max-w-full rounded-[4px] object-contain" />
        <span className="flex relative font-ocr text-[13px] uppercase tracking-[0.25em] text-[#daf822]">Curious? Check back for the reveal.</span>
      </div>
    </StepFrame>
  );
}
