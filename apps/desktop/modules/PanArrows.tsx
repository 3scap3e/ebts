import type { PanArrowsProps, PanDirection } from "@/types/pan";

const rotation: Record<PanDirection, string> = {
  up: "rotate-0",
  right: "rotate-90",
  down: "rotate-180",
  left: "-rotate-90",
};

const cell: Record<PanDirection, string> = {
  up: "col-start-2 row-start-1",
  left: "col-start-1 row-start-2",
  right: "col-start-3 row-start-2",
  down: "col-start-2 row-start-3",
};

export default function PanArrows({ can, overflowX, overflowY, onPan }: PanArrowsProps) {
  if (!overflowX && !overflowY) return null;
  const directions: PanDirection[] = [
    ...(overflowY ? (["up", "down"] as PanDirection[]) : []),
    ...(overflowX ? (["left", "right"] as PanDirection[]) : []),
  ];

  return (
    <div data-ui className="grid absolute bottom-20 right-4 grid-cols-3 grid-rows-3 gap-1 z-20 md:bottom-24 md:right-6">
      {directions.map((direction) => (
        <button
          key={direction}
          type="button"
          aria-label={`Move ${direction}`}
          onClick={() => onPan(direction)}
          disabled={!can[direction]}
          className={`flex relative w-10 h-10 items-center justify-center rounded-full border border-[#daf822]/70 bg-black text-[#daf822] transition hover:bg-[#daf822] hover:text-black disabled:opacity-0 disabled:pointer-events-none ${cell[direction]}`}
        >
          <svg viewBox="0 0 24 24" className={`flex relative w-5 h-5 ${rotation[direction]}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      ))}
    </div>
  );
}
