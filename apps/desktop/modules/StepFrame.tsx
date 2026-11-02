import { useEffect, useRef, useState } from "react";
import type { StepAccent, StepFrameProps } from "@/types/ui";
import type { StepId } from "@/types/steps";
import { STEP_ORDER } from "@/types/steps";

const RAIL_TOP = 27;
const RAIL_STEP = 55;

const defaultAccent = (step: StepId): StepAccent =>
  step === "concept" || step === "content" ? "yellow" : step === "simulate" || step === "export" ? "pink" : "none";

const accentColor: Record<StepAccent, string> = {
  yellow: "bg-[#daf822]",
  pink: "bg-[#d40f7d]",
  none: "bg-black",
};

export default function StepFrame({ step, title, titleRight, titleSize = "normal", accent, children, aside }: StepFrameProps) {
  const meta = STEP_ORDER.find((s) => s.id === step);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [dots, setDots] = useState(1);
  const first = accentColor[accent ?? defaultAccent(step)];

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setDots(Math.max(1, Math.floor((el.clientHeight - RAIL_TOP - 20) / RAIL_STEP) + 1));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="flex relative flex-col flex-1 min-w-0 min-h-0 rounded-[12px] border border-[#009fdf] bg-black">
      {Array.from({ length: dots }, (_, i) => (
        <span
          key={i}
          className={`flex absolute right-[11px] h-[6px] w-[6px] rounded-full border border-[#009fdf] ${i === 0 ? first : "bg-black"}`}
          style={{ top: `${RAIL_TOP + i * RAIL_STEP}px` }}
        />
      ))}
      <div className="flex relative flex-row shrink-0 items-center justify-between gap-4 pl-[15px] pr-[26px] pt-[19px]">
        <span
          className={`flex relative min-w-0 truncate font-tanker uppercase leading-none text-[#daf822] title-shadow ${
            titleSize === "large" ? "text-[28px]" : "text-[18px]"
          }`}
        >
          {title ?? meta?.title ?? step}
        </span>
        {titleRight ? <div className="flex relative flex-row shrink-0 items-center">{titleRight}</div> : null}
      </div>
      <div className="flex relative flex-col flex-1 min-h-0 gap-6 overflow-y-auto scroll-thin py-[15px] pl-[15px] pr-[26px]">
        {aside}
        {children}
      </div>
    </div>
  );
}
