import type { HotspotOutlineProps } from "@/types/map";
import { pointsAttr } from "@/hooks/geometry";

export default function HotspotOutline({
  polygon,
  width,
  height,
  color = "#daf822",
  active = false,
}: HotspotOutlineProps) {
  if (!active) return null;
  const points = pointsAttr(polygon);
  const stroke = Math.max(3, width * 0.007);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="flex absolute inset-0 w-full h-full pointer-events-none hotspot-outline" aria-hidden>
      <g fill="none" stroke={color} strokeLinejoin="round" strokeLinecap="round">
        <polygon points={points} strokeWidth={stroke * 1.15} strokeOpacity="0.45" strokeDasharray={`${stroke * 6} ${stroke * 2.5}`} />
        <polygon points={points} strokeWidth={stroke * 0.7} strokeOpacity="0.95" />
      </g>
    </svg>
  );
}
