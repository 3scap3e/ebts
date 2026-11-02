import { useEffect, useRef } from "react";
import type { ZoneScreenProps } from "@/types/simulate";
import { useProject } from "@/hooks/useProject";
import { assetUrl } from "@/hooks/api";
import { zoneStateColor } from "@/hooks/theme";
import { resolveLoop, resolvePoster } from "@/hooks/timeWindows";

export default function ZoneScreen({ site, zone, hm, live, playing, width }: ZoneScreenProps) {
  const { root } = useProject();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const poster = assetUrl(root, resolvePoster(zone.media.poster, zone.media.variants, hm));
  const loop = assetUrl(root, resolveLoop(zone.media.loop_video, zone.media.variants, hm));
  const state = live?.state ?? "closed";
  const color = zoneStateColor[state];
  const running = playing && state !== "closed";
  const empty = !loop && !poster;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (running) el.play().catch(() => undefined);
    else el.pause();
  }, [running, loop]);

  return (
    <div className="flex relative flex-col gap-[4px]" style={{ width }}>
      <div
        className={`flex relative w-full overflow-hidden border border-[#6e83c3] ${empty ? "bg-[#d40f7d]" : "bg-black"}`}
        style={{ aspectRatio: "156 / 93" }}
      >
        {loop ? (
          <video
            key={loop}
            ref={videoRef}
            src={loop}
            poster={poster ?? undefined}
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            draggable={false}
            className="flex absolute inset-0 w-full h-full object-cover select-none"
          />
        ) : poster ? (
          <img key={poster} src={poster} alt="" draggable={false} className="flex absolute inset-0 w-full h-full object-cover select-none" />
        ) : null}
        <span className="flex absolute left-[4px] top-[4px] h-[4px] w-[4px] rounded-full" style={{ background: color }} />
      </div>
      <div className="flex relative flex-row items-baseline justify-between gap-1">
        <span className="flex relative min-w-0 truncate font-tanker text-[9px] uppercase leading-none text-[#daf822]">{zone.label}</span>
        <span className="flex relative shrink-0 font-stardom text-[9px] leading-none text-[#6e83c3]">
          {site.label} {hm}
        </span>
      </div>
    </div>
  );
}
