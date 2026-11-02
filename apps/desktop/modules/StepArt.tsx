import { useEffect, useMemo, useState } from "react";
import type { StepPhotoProps, StepPosterProps } from "@/types/steps";
import { STEP_ORDER } from "@/types/steps";
import { useProject } from "@/hooks/useProject";
import { stepArtSrc } from "@/hooks/stepArt";

const probe = (candidates: string[], onFound: (src: string | null) => void): (() => void) => {
  let cancelled = false;
  const tryAt = (index: number) => {
    if (cancelled) return;
    if (index >= candidates.length) {
      onFound(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (!cancelled) onFound(candidates[index]);
    };
    img.onerror = () => tryAt(index + 1);
    img.src = candidates[index];
  };
  tryAt(0);
  return () => {
    cancelled = true;
  };
};

function StepPoster({ step }: StepPosterProps) {
  const meta = STEP_ORDER.find((s) => s.id === step);
  const candidates = useMemo(
    () => [`/images/${step}.png`, `/images/${(meta?.title ?? step).toLowerCase().replace(/\s+/g, "-")}.png`, "/images/intent.png"],
    [step, meta],
  );
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => probe(candidates, (src) => setShown((prev) => src ?? prev)), [candidates]);

  if (!shown) return null;
  return <img src={shown} alt="" draggable={false} className="flex absolute inset-0 h-full w-full object-cover select-none" />;
}

function StepPhoto({ src }: StepPhotoProps) {
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => probe([src], setShown), [src]);

  if (!shown) return null;
  return <img src={shown} alt="" draggable={false} className="flex absolute left-[14.2%] top-[28.2%] h-[32.5%] w-[72.4%] object-cover select-none" />;
}

export default function StepArt() {
  const { step, event, root } = useProject();
  const photo = useMemo(() => stepArtSrc(event, root), [event, root]);

  return (
    <div className="flex relative flex-col w-[37%] shrink-0 h-full overflow-hidden bg-black">
      <div className="flex relative flex-col h-full w-full overflow-hidden">
        {photo ? <StepPhoto src={photo} /> : null}
        <StepPoster step={step} />
      </div>
    </div>
  );
}
