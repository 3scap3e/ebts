import { labelClass } from "@/hooks/theme";
import type { FieldProps } from "@/types/ui";

export default function Field({ label, children, className = "", hint, compact = false }: FieldProps) {
  return (
    <div className={`flex relative flex-col ${compact ? "gap-1" : "gap-1.5"} ${className}`}>
      <span className={compact ? "flex relative font-ocr text-[9px] uppercase tracking-[0.25em] text-[#009fdf]/80" : labelClass}>
        {label}
      </span>
      {children}
      {hint ? <span className="flex relative text-[11px] leading-snug text-white/40">{hint}</span> : null}
    </div>
  );
}
