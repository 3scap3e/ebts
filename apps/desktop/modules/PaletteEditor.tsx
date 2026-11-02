import { labelClass } from "@/hooks/theme";
import { smallButtonClass } from "@/hooks/classes";
import { removeAt, replaceAt } from "@/hooks/listEdit";
import type { PaletteEditorProps } from "@/types/ui";

const safeHex = (value: string): string => (/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000");

export default function PaletteEditor({ palette, onChange }: PaletteEditorProps) {
  const setAt = (index: number, value: string) => onChange(replaceAt(palette, index, value));

  return (
    <div className="flex relative flex-col gap-2">
      <div className="flex relative flex-row items-center justify-between gap-3">
        <span className={labelClass}>Palette</span>
        <button type="button" onClick={() => onChange([...palette, "#daf822"])} className={smallButtonClass}>
          Add color
        </button>
      </div>
      <div className="flex relative flex-row flex-wrap gap-2">
        {palette.map((hex, index) => (
          <div
            key={index}
            className="flex relative flex-row items-center gap-2 rounded-sm border border-white/15 bg-black/40 py-1 pl-1 pr-2"
          >
            <input
              type="color"
              value={safeHex(hex)}
              onChange={(e) => setAt(index, e.target.value)}
              className="flex relative h-7 w-7 cursor-pointer rounded-sm border-0 bg-transparent p-0"
            />
            <input
              value={hex}
              onChange={(e) => setAt(index, e.target.value)}
              spellCheck={false}
              className="flex relative w-[84px] bg-transparent font-mono text-[12px] uppercase text-white outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(removeAt(palette, index))}
              className="flex relative px-1 text-[14px] leading-none text-white/40 transition hover:text-[#ff6b6b]"
            >
              ×
            </button>
          </div>
        ))}
        {palette.length === 0 ? <span className="flex relative text-[12px] text-white/40">No colors yet</span> : null}
      </div>
    </div>
  );
}
