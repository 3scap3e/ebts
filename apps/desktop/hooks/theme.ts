import type { ScheduleStatus } from "@/types/event";
import type { CheckStatus } from "@/types/steps";
import type { ZoneState } from "@/types/sim";

export const yellow = "#daf822";
export const blue = "#009fdf";
export const pink = "#ff4fd8";
export const green = "#7cff6b";
export const orange = "#ffb347";
export const violet = "#c4a3ff";
export const red = "#ff6b6b";
export const ink = "#06060a";
export const lavender = "#6e83c3";
export const shellGreen = "#3a9e68";

export const screenTextClass = "text-[#daf822] [text-shadow:0.07em_0.07em_0_#0937A5]";

export const panelClass =
  "flex relative flex-col rounded-md border border-[#daf822]/40 bg-black";

export const labelClass =
  "flex relative font-ocr text-[10px] uppercase tracking-[0.25em] text-[#009fdf]";

export const inputClass =
  "flex relative w-full rounded-sm border border-[#daf822]/30 bg-black px-3 py-2 font-grotesk text-[14px] text-white outline-none focus:border-[#daf822] placeholder:text-white/30";

export const buttonClass =
  "flex relative flex-row items-center justify-center gap-2 rounded-full border border-[#daf822]/70 bg-black px-4 py-2 font-ocr text-[11px] uppercase leading-none tracking-[0.2em] text-[#daf822] transition hover:bg-[#daf822] hover:text-black disabled:opacity-50 disabled:pointer-events-none";

export const ghostButtonClass =
  "flex relative flex-row items-center justify-center gap-2 rounded-full border border-white/30 bg-black px-4 py-2 font-ocr text-[11px] uppercase leading-none tracking-[0.2em] text-white/80 transition hover:border-[#daf822] hover:text-[#daf822] disabled:opacity-50 disabled:pointer-events-none";

export const pillClass =
  "flex relative flex-row items-center justify-center rounded-[999px] border border-[#daf822] px-3 py-[6px] font-ocr text-[10px] uppercase leading-none tracking-[0.2em] transition disabled:opacity-50 disabled:pointer-events-none";

export const pillActiveClass = `${pillClass} bg-[#daf822] text-black`;

export const pillIdleClass = `${pillClass} bg-black text-[#daf822] hover:bg-[#daf822] hover:text-black`;

export const toggleButtonClass =
  "flex relative flex-row items-center gap-3 rounded-sm border border-[#daf822]/60 bg-black px-3 py-2 font-ocr text-[11px] uppercase leading-none tracking-[0.3em] text-[#daf822] transition hover:bg-[#daf822] hover:text-black";

export const statusColor: Record<ScheduleStatus, string> = {
  "feed-up": blue,
  linked: yellow,
  scheduled: pink,
  open: green,
  "food-service": orange,
  installed: violet,
  "on-floor": green,
  interstitial: "#ffffff",
  "load-in": orange,
  crew: blue,
  strike: red,
  screening: violet,
  workshop: orange,
  "room-change": "#ffffff",
};

export const statusLabel = (status: ScheduleStatus): string =>
  status.replace(/-/g, " ");

export const checkColor: Record<CheckStatus, string> = {
  ok: green,
  warn: orange,
  missing: red,
};

export const zoneStateColor: Record<ZoneState, string> = {
  closed: "#444",
  crew: blue,
  idle: violet,
  live: green,
};
