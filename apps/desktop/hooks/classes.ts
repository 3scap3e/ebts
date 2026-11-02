import { inputClass } from "@/hooks/theme";

export const sectionTitleClass =
  "flex relative font-tanker text-[22px] uppercase leading-none tracking-[0.1em] text-[#daf822] [text-shadow:0.07em_0.07em_0_#0937A5]";

export const textareaClass = `${inputClass} min-h-[96px] resize-y leading-relaxed`;

export const selectClass = `${inputClass} cursor-pointer [color-scheme:dark] [&>option]:bg-[#06060a] [&>option]:text-white`;

export const timeInputClass = `${inputClass} font-mono [color-scheme:dark]`;

export const dateInputClass = `${inputClass} font-mono [color-scheme:dark]`;

export const smallInputClass =
  "flex relative w-full rounded-sm border border-white/15 bg-black px-2 py-1.5 font-grotesk text-[13px] text-white outline-none focus:border-[#daf822] placeholder:text-white/30";

export const smallSelectClass = `${smallInputClass} cursor-pointer [color-scheme:dark] [&>option]:bg-[#06060a] [&>option]:text-white`;

export const smallTimeClass = `${smallInputClass} font-mono [color-scheme:dark]`;

export const smallMonoClass = `${smallInputClass} font-mono text-[12px]`;

export const smallButtonClass =
  "flex relative flex-row items-center justify-center gap-1 rounded-full border border-white/30 px-3 py-1 font-ocr text-[10px] uppercase leading-none tracking-[0.2em] text-white/70 transition hover:border-[#daf822] hover:text-[#daf822] disabled:opacity-30 disabled:hover:border-white/30 disabled:hover:text-white/70";

export const dangerButtonClass =
  "flex relative flex-row items-center justify-center gap-2 rounded-full border border-[#ff6b6b]/70 bg-black px-4 py-2 font-ocr text-[11px] uppercase leading-none tracking-[0.2em] text-[#ff6b6b] transition hover:bg-[#ff6b6b] hover:text-black";

export const smallDangerButtonClass =
  "flex relative flex-row items-center justify-center gap-1 rounded-full border border-[#ff6b6b]/70 px-3 py-1 font-ocr text-[10px] uppercase leading-none tracking-[0.2em] text-[#ff6b6b] transition hover:bg-[#ff6b6b] hover:text-black";

export const noticeClass =
  "flex relative flex-col gap-1 rounded-sm border border-[#ffb347]/50 bg-[#ffb347]/10 px-4 py-3 text-[13px] leading-relaxed text-[#ffb347]";

export const errorTextClass = "min-w-0 max-w-full whitespace-pre-wrap leading-snug [overflow-wrap:anywhere]";

export const errorClass = `flex relative rounded-sm border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 px-4 py-2 font-mono text-[12px] text-[#ff6b6b] ${errorTextClass}`;

export const hintClass = "flex relative text-[12px] leading-relaxed text-white/50";

export const monoClass = "flex relative font-mono text-[11px] text-white/50";

export const tinyLabelClass = "flex relative font-ocr text-[9px] uppercase tracking-[0.25em] text-[#009fdf]";

export const tinyButtonClass =
  "flex relative flex-row items-center rounded-sm border border-[#daf822]/50 px-1.5 py-0.5 font-ocr text-[9px] uppercase leading-none tracking-[0.15em] text-[#daf822] transition hover:bg-[#daf822] hover:text-black disabled:opacity-40 disabled:pointer-events-none";

export const tinyTimeClass =
  "flex relative rounded-sm border border-white/15 bg-black/60 px-1.5 py-0.5 font-mono text-[12px] text-white outline-none [color-scheme:dark] focus:border-[#daf822]";

export const cardClass ="flex relative flex-col gap-4 rounded-sm border border-[#daf822]/25 bg-black p-4";

export const monoBadgeClass =
  "flex relative rounded-sm border border-white/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-white/60";

export const kindBadgeClass =
  "flex relative w-[92px] shrink-0 rounded-sm border border-white/15 px-1.5 py-0.5 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-[#009fdf]";
