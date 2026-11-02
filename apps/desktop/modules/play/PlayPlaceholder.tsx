import type { PlayPlaceholderProps } from "@/types/play";

export default function PlayPlaceholder({ label }: PlayPlaceholderProps) {
  return (
    <div className="flex absolute inset-0 flex-col items-center justify-center overflow-hidden bg-black pointer-events-none">
      <span className="flex relative max-w-[60%] px-8 text-center font-tanker text-[clamp(28px,5vw,84px)] uppercase leading-none tracking-[0.06em] screen-text">
        {label}
      </span>
      <span className="flex relative mt-4 font-tanker text-[11px] uppercase tracking-[0.4em] text-[#009fdf]">No map art yet</span>
    </div>
  );
}
