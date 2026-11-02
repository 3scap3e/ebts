import { useEffect, useState } from "react";
import { api, isTauri } from "@/hooks/api";
import { describeError } from "@/hooks/errors";
import { patchConfig, priceText } from "@/hooks/generate";
import { buttonClass, green, red } from "@/hooks/theme";
import { errorClass, smallButtonClass, smallInputClass, smallMonoClass } from "@/hooks/classes";
import Field from "@/modules/Field";
import type { ReactorConfig, ReactorStatus } from "@/types/generate";
import type { ReactorSettingsProps } from "@/types/ui";

export default function ReactorSettings({ config, provider, root, saving, onSave }: ReactorSettingsProps) {
  const [draft, setDraft] = useState<ReactorConfig>(config);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<ReactorStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = isTauri() && Boolean(root);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    if (!isTauri() || !provider.key_env) return;
    void api
      .secretRead(provider.key_env)
      .then((stored) => setApiKey((current) => current || stored || ""))
      .catch(() => undefined);
  }, [provider.key_env, provider.key_present]);

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setStatus(await api.reactorCheck(root));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setChecking(false);
    }
  };

  const saveKey = async () => {
    const key = apiKey.trim();
    if (!key) return;
    await onSave(draft, key);
    await check();
  };

  const prices = status ? priceText(status.price_per_second_usd, status.price_per_clip_usd) : "";

  return (
    <div className="flex relative flex-col gap-3">
      <div className="flex relative flex-row flex-wrap items-end gap-2">
        <Field label="API key" compact className="flex-1 min-w-[220px]">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider.key_env ?? ""}
            autoComplete="off"
            className={smallInputClass}
          />
        </Field>
        <button type="button" onClick={() => void saveKey()} disabled={!desktop || saving || apiKey.trim() === ""} className={smallButtonClass}>
          Save key
        </button>
        <button type="button" onClick={() => void check()} disabled={!desktop || checking} className={smallButtonClass}>
          {checking ? "Checking…" : "Check"}
        </button>
      </div>
      <div className="flex relative flex-row flex-wrap items-center gap-3 font-mono text-[11px]">
        {status ? (
          <span className="flex relative" style={{ color: status.valid ? green : red }}>
            {status.valid ? "Key accepted" : status.message}
          </span>
        ) : (
          <span className="flex relative" style={{ color: provider.key_present ? green : red }}>
            {provider.key_present ? "Key found" : "No key"}
          </span>
        )}
        {prices ? <span className="flex relative text-white/60">{prices}</span> : null}
      </div>
      <div className="flex relative flex-row flex-wrap items-end gap-3">
        <Field label="Seconds" compact className="w-[120px]">
          <input
            type="number"
            min={5.167}
            max={14.375}
            step={0.5}
            value={draft.seconds}
            onChange={(e) => setDraft(patchConfig(draft, "seconds", e.target.value) as ReactorConfig)}
            className={smallMonoClass}
          />
        </Field>
        <button type="button" onClick={() => void onSave(draft, null)} disabled={!desktop || saving} className={buttonClass}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error ? <span className={errorClass}>{error}</span> : null}
    </div>
  );
}
