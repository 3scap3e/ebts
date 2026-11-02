import { useState } from "react";
import { api, isTauri } from "@/hooks/api";
import { useProject } from "@/hooks/useProject";
import { labelClass, panelClass } from "@/hooks/theme";
import { errorClass, monoClass } from "@/hooks/classes";
import Select from "@/modules/Select";
import ComfySettings from "@/modules/ComfySettings";
import ReactorSettings from "@/modules/ReactorSettings";
import type { ProviderId } from "@/types/generate";
import type { ProviderBarProps } from "@/types/ui";

export default function ProviderBar({ state, root, open }: ProviderBarProps) {
  const { providers, active, loading, saving, error, configure } = state;
  const { event, update } = useProject();
  const [selected, setSelected] = useState<ProviderId | null>(null);

  const current = providers.find((p) => p.id === (selected ?? active?.id)) ?? providers[0] ?? null;

  const choose = async (id: ProviderId) => {
    const next = providers.find((p) => p.id === id);
    if (!next) return;
    const before = active?.id ?? null;
    setSelected(id);
    await configure(next.config, true, null);
    if (isTauri() && root && event && before && before !== id) {
      try {
        update(await api.projectSwitchProvider(root, event, before, id));
      } catch {
        return;
      }
    }
  };

  if (!open) return null;

  return (
    <div className={`${panelClass} gap-3 p-5`}>
      <div className="flex relative flex-row flex-wrap items-end gap-3">
        <div className="flex relative flex-col gap-1 w-[240px]">
          <span className={labelClass}>Provider</span>
          {providers.length > 0 ? (
            <Select
              value={current?.id ?? ""}
              options={providers.map((p) => ({ value: p.id, label: p.label }))}
              onChange={(value) => void choose(value as ProviderId)}
            />
          ) : (
            <span className={monoClass}>{loading ? "loading…" : "none"}</span>
          )}
        </div>
        {saving ? <span className={monoClass}>saving…</span> : null}
      </div>
      {current && current.config.kind === "comfyui" ? (
        <ComfySettings
          key={current.id}
          config={current.config}
          root={root}
          saving={saving}
          onSave={(config) => configure(config, true, null)}
        />
      ) : null}
      {current && current.config.kind === "reactor" ? (
        <ReactorSettings
          key={current.id}
          config={current.config}
          provider={current}
          root={root}
          saving={saving}
          onSave={(config, apiKey) => configure(config, true, apiKey)}
        />
      ) : null}
      {error ? <span className={errorClass}>{error}</span> : null}
    </div>
  );
}
