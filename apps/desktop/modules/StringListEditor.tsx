import { useState } from "react";
import { labelClass } from "@/hooks/theme";
import { smallButtonClass, smallInputClass } from "@/hooks/classes";
import { removeAt, replaceAt } from "@/hooks/listEdit";
import type { StringListEditorProps } from "@/types/ui";

export default function StringListEditor({ label, items, placeholder, onChange }: StringListEditorProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  };

  return (
    <div className="flex relative flex-col gap-2">
      <span className={labelClass}>{label}</span>
      <div className="flex relative flex-col gap-1.5">
        {items.map((item, index) => (
          <div key={index} className="flex relative flex-row items-center gap-2">
            <input
              value={item}
              onChange={(e) => onChange(replaceAt(items, index, e.target.value))}
              className={smallInputClass}
            />
            <button type="button" onClick={() => onChange(removeAt(items, index))} className={smallButtonClass}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="flex relative flex-row items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={smallInputClass}
        />
        <button type="button" onClick={add} disabled={!draft.trim()} className={smallButtonClass}>
          Add
        </button>
      </div>
    </div>
  );
}
