import { useProject } from "@/hooks/useProject";
import { inputClass, panelClass } from "@/hooks/theme";
import { sectionTitleClass } from "@/hooks/classes";
import StepFrame from "@/modules/StepFrame";
import Field from "@/modules/Field";
import type { EventSpec } from "@/types/event";

const titleClass = `${inputClass} min-h-[72px] resize-y font-kalmansk text-[20px] uppercase leading-snug`;
const dateClass = `${inputClass} font-ocr [color-scheme:dark]`;
const descriptionClass = `${inputClass} min-h-[96px] resize-y font-grotesk text-[14px] leading-relaxed`;

export default function ConceptStep() {
  const { event, update } = useProject();
  if (!event) return null;

  const setEvent = (patch: Partial<EventSpec>) => update((prev) => ({ ...prev, ...patch }));

  return (
    <StepFrame step="concept">
      <div className={`${panelClass} gap-4 p-5`}>
        <span className={sectionTitleClass}>Event</span>
        <div className="flex relative flex-row flex-wrap gap-4">
          <Field label="Title" className="flex-1 min-w-[260px]">
            <textarea
              value={event.name}
              onChange={(e) => setEvent({ name: e.target.value })}
              placeholder={"Channelhack\n& the New Scene"}
              rows={2}
              className={titleClass}
            />
          </Field>
          <Field label="Date" className="w-[190px]">
            <input type="date" value={event.date} onChange={(e) => setEvent({ date: e.target.value })} className={dateClass} />
          </Field>
        </div>
        <Field label="Description (optional)">
          <textarea
            value={event.description}
            onChange={(e) => setEvent({ description: e.target.value })}
            placeholder="What happens, who comes, why it matters"
            className={descriptionClass}
          />
        </Field>
      </div>
    </StepFrame>
  );
}
