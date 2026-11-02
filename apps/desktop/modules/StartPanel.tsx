import { useState } from "react";
import { useProject } from "@/hooks/useProject";
import { isTauri, pickFolder } from "@/hooks/api";
import { inputClass, labelClass, pillIdleClass } from "@/hooks/theme";
import StepFrame from "@/modules/StepFrame";

export default function StartPanel() {
  const { createProject, openProject, loadExample, startBlank, busy, error, clearError } = useProject();
  const [name, setName] = useState("");
  const desktop = isTauri();

  const onCreate = async () => {
    const label = name.trim() || "New event";
    if (!desktop) {
      startBlank(label);
      return;
    }
    const folder = await pickFolder();
    if (!folder) return;
    await createProject(folder, label);
  };

  const onOpen = async () => {
    const folder = await pickFolder();
    if (!folder) return;
    await openProject(folder);
  };

  return (
    <StepFrame step="concept">
      <div className="flex relative flex-col w-full max-w-[560px] gap-4">
        <div className="flex relative flex-col gap-2">
          <span className={labelClass}>New event name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} font-kalmansk text-[16px] uppercase`}
          />
        </div>
        <div className="flex relative flex-row flex-wrap gap-2">
          <button type="button" onClick={() => void onCreate()} disabled={busy} className={pillIdleClass}>
            Create new event
          </button>
          {desktop ? (
            <button type="button" onClick={() => void onOpen()} disabled={busy} className={pillIdleClass}>
              Load saved event
            </button>
          ) : null}
          <button type="button" onClick={() => void loadExample()} disabled={busy} className={pillIdleClass}>
            Load example event
          </button>
        </div>
        {error ? (
          <button type="button" onClick={clearError} className="flex relative min-w-0 max-w-full text-left font-ocr text-[11px] leading-snug text-[#ff6b6b] whitespace-pre-wrap [overflow-wrap:anywhere]">
            {error}
          </button>
        ) : null}
      </div>
    </StepFrame>
  );
}
