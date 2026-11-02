import { useEffect, useMemo, useState } from "react";
import { api, assetUrl, isTauri, pickFile } from "@/hooks/api";
import { describeError } from "@/hooks/errors";
import { isVideoItem, parseSamplerValue, parseSeed, refRel, seedText, slotTitle } from "@/hooks/contentEdit";
import { blockedReason, canProviderProduce, initSlots, samplerDefaults } from "@/hooks/generate";
import type { SamplerOverride } from "@/types/event";
import { buttonClass, labelClass } from "@/hooks/theme";
import { cardClass, errorTextClass, smallButtonClass, smallInputClass, smallMonoClass } from "@/hooks/classes";
import Field from "@/modules/Field";
import type { SlotCardProps } from "@/types/ui";

export default function SlotCard({ item, override, poster, root, provider, job, busy, onOverride, onInitImage, onGenerate, onAccept, onDiscard, onAbort }: SlotCardProps) {
  const [prompt, setPrompt] = useState(override.prompt ?? "");
  const [negative, setNegative] = useState(override.negative_prompt);
  const [seed, setSeed] = useState(seedText(override.seed));
  const [importing, setImporting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [broken, setBroken] = useState<string | null>(null);

  useEffect(() => {
    setPrompt(override.prompt ?? "");
  }, [override.prompt]);
  useEffect(() => {
    setNegative(override.negative_prompt);
  }, [override.negative_prompt]);
  useEffect(() => {
    setSeed(seedText(override.seed));
  }, [override.seed]);
  useEffect(() => {
    if (job?.accepted) setRev((r) => r + 1);
  }, [job?.accepted]);
  const [sampler, setSampler] = useState<Record<keyof SamplerOverride, string>>({ steps: "", cfg: "", denoise: "" });
  useEffect(() => {
    setSampler({
      steps: override.sampler.steps === null ? "" : String(override.sampler.steps),
      cfg: override.sampler.cfg === null ? "" : String(override.sampler.cfg),
      denoise: override.sampler.denoise === null ? "" : String(override.sampler.denoise),
    });
  }, [override.sampler.steps, override.sampler.cfg, override.sampler.denoise]);
  const defaults = samplerDefaults(provider, item);
  const samplerFields: { key: keyof SamplerOverride; label: string; step: number; min: number; max?: number }[] = [
    { key: "steps", label: "Steps", step: 1, min: 1 },
    { key: "cfg", label: "CFG", step: 0.5, min: 0 },
    { key: "denoise", label: "Denoise", step: 0.05, min: 0, max: 1 },
  ];
  const editSampler = (key: keyof SamplerOverride, raw: string) => {
    setSampler((prev) => ({ ...prev, [key]: raw }));
    const value = parseSamplerValue(raw);
    onOverride({ sampler: { ...override.sampler, [key]: key === "steps" && value !== null ? Math.max(1, Math.round(value)) : value } });
  };

  const video = isVideoItem(item);
  const desktop = isTauri() && Boolean(root);
  const slots = initSlots(provider, item);
  const hasInit = override.init_images.length > 0;
  const reason = video && poster === null ? "Generate the poster first" : blockedReason(provider, item);
  const canRun = desktop && canProviderProduce(provider, item) && (video ? poster !== null : prompt.trim() !== "" || hasInit) && !busy;
  const candidate = job?.candidate ?? null;
  const working = job !== null && (job.status === "working" || job.status === "queued");
  const stamp = useMemo(() => Date.now(), [candidate]);
  const candidateUrl = candidate ? assetUrl(root, candidate) : null;
  const url = item.exists || !isTauri() ? assetUrl(root, item.path) : null;
  const shown = candidateUrl ? `${candidateUrl}${candidateUrl.includes("?") ? "&" : "?"}c=${stamp}` : url;
  const src = shown && broken !== shown ? (candidateUrl ? shown : `${shown}${shown.includes("?") ? "&" : "?"}r=${rev}`) : null;

  const upload = async (index: number) => {
    if (!root) return;
    setImporting(index);
    setError(null);
    try {
      const picked = await pickFile(["png", "jpg", "jpeg", "webp"], "Init image");
      if (!picked) return;
      const rel = await api.projectImportAsset(root, picked, refRel(item, index));
      onInitImage(index, rel);
      setRev((r) => r + 1);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setImporting(null);
    }
  };

  const label = job?.status === "failed" ? "Retry" : item.exists || candidate ? "Regenerate" : "Generate";

  return (
    <div className={`${cardClass} gap-3 flex-1 min-w-[320px] max-w-full`}>
      <div className="flex relative flex-col w-full aspect-video overflow-hidden rounded-sm border border-white/10 bg-black">
        {src && video ? (
          <video key={src} src={src} muted loop autoPlay playsInline draggable={false} onError={() => setBroken(shown)} className="flex relative h-full w-full object-cover select-none" />
        ) : src ? (
          <img src={src} alt="" draggable={false} onError={() => setBroken(shown)} className="flex relative h-full w-full object-cover select-none" />
        ) : null}
        {candidate ? (
          <span className="flex absolute left-2 top-2 rounded-sm bg-black/80 px-2 py-1 font-ocr text-[10px] uppercase tracking-[0.2em] text-[#daf822]">New result</span>
        ) : null}
        {working ? (
          <div className="flex absolute inset-0 flex-col items-center justify-center gap-3 bg-black/65">
            <span className="flex relative h-10 w-10 rounded-full border-2 border-[#daf822]/30 border-t-[#daf822] animate-spin slot-working" />
            <span className="flex relative px-4 text-center font-ocr text-[11px] uppercase leading-relaxed tracking-[0.25em] text-[#daf822] slot-working">
              {job.total ? `${job.step ?? 0} / ${job.total}` : job.status === "queued" ? "Queued" : job.detail || "Starting"}
            </span>
            {job.total && job.detail ? <span className="flex relative font-mono text-[11px] text-white/70">{job.detail}</span> : null}
            <button type="button" onClick={onAbort} className="flex relative mt-1 rounded-full border border-white/30 px-3 py-1 font-ocr text-[10px] uppercase tracking-[0.25em] text-white/70 transition hover:border-[#ff6b6b] hover:text-[#ff6b6b]">
              Cancel
            </button>
          </div>
        ) : null}
      </div>
      {candidate ? (
        <div className="flex relative flex-row flex-wrap items-center gap-2">
          <button type="button" onClick={() => onAccept(candidate)} disabled={busy} className={buttonClass}>
            Use it
          </button>
          <button type="button" onClick={() => onDiscard(candidate)} disabled={busy} className={smallButtonClass}>
            Discard
          </button>
        </div>
      ) : null}
      <div className="flex relative flex-row flex-wrap items-baseline justify-between gap-2">
        <span className="flex relative font-tanker text-[16px] uppercase leading-none tracking-[0.1em] text-[#daf822]">{slotTitle(item)}</span>
        <span className="flex relative font-mono text-[11px] text-white/60">
          {item.width}×{item.height}
          {item.duration_seconds !== null ? ` · ${item.duration_seconds}s` : ""}
        </span>
      </div>
      <Field label="Prompt" compact>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            onOverride({ prompt: e.target.value });
          }}
          spellCheck={false}
          className={`${smallInputClass} min-h-[80px] resize-y leading-relaxed`}
        />
      </Field>
      <div className="flex relative flex-row flex-wrap gap-2">
        <Field label="Negative prompt" compact className="flex-1 min-w-[160px]">
          <input
            value={negative}
            onChange={(e) => {
              setNegative(e.target.value);
              onOverride({ negative_prompt: e.target.value });
            }}
            className={smallInputClass}
          />
        </Field>
        <Field label="Seed" compact className="w-[110px]">
          <input
            type="number"
            min={0}
            step={1}
            value={seed}
            onChange={(e) => {
              setSeed(e.target.value);
              onOverride({ seed: parseSeed(e.target.value) });
            }}
            placeholder="random"
            className={smallMonoClass}
          />
        </Field>
      </div>
      {defaults ? (
        <div className="flex relative flex-row flex-wrap gap-2">
          {samplerFields
            .filter((field) => defaults[field.key] !== null)
            .map((field) => (
              <Field key={field.key} label={field.label} compact className="w-[110px]">
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={sampler[field.key]}
                  onChange={(e) => editSampler(field.key, e.target.value)}
                  placeholder={String(defaults[field.key])}
                  className={smallMonoClass}
                />
              </Field>
            ))}
        </div>
      ) : null}
      {video ? (
        <div className="flex relative flex-col gap-1.5">
          <span className={labelClass}>Init image</span>
          <div className="flex relative flex-row items-center gap-2">
            <div className="flex relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-white/15 bg-black">
              {poster && poster.exists ? (
                <img src={`${assetUrl(root, poster.path)}?r=${rev}`} alt="" draggable={false} className="flex relative h-full w-full object-cover select-none" />
              ) : null}
            </div>
            <span className="flex relative min-w-0 flex-1 truncate font-mono text-[11px] text-white/50">{poster && poster.exists ? poster.path : "poster"}</span>
          </div>
        </div>
      ) : null}
      {slots > 0 && !video ? (
        <div className="flex relative flex-col gap-1.5">
          <span className={labelClass}>Init images</span>
          {Array.from({ length: slots }, (_, index) => {
            const rel = override.init_images[index] ?? null;
            const thumb = assetUrl(root, rel);
            return (
              <div key={index} className="flex relative flex-row items-center gap-2">
                <div className="flex relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-white/15 bg-black">
                  {thumb ? <img src={`${thumb}${thumb.includes("?") ? "&" : "?"}r=${rev}`} alt="" draggable={false} className="flex relative h-full w-full object-cover select-none" /> : null}
                </div>
                <span className="flex relative min-w-0 flex-1 truncate font-mono text-[11px] text-white/50">{rel ?? "none"}</span>
                <button type="button" onClick={() => void upload(index)} disabled={!desktop || importing !== null} className={smallButtonClass}>
                  {importing === index ? "Importing…" : "Upload"}
                </button>
                {rel ? (
                  <button type="button" onClick={() => onInitImage(index, null)} className={smallButtonClass}>
                    Clear
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {working ? null : (
        <div className="flex relative flex-row flex-wrap items-center gap-3">
          <button type="button" onClick={onGenerate} disabled={!canRun} title={reason} className={buttonClass}>
            {label}
          </button>
          {job?.status === "done" && !candidate ? <span className="flex relative font-mono text-[11px] text-[#7cff6b]">Saved</span> : null}
        </div>
      )}
      {job?.status === "failed" && job.error ? (
        <span className={`flex relative font-mono text-[11px] text-[#ff6b6b] ${errorTextClass}`}>{job.error}</span>
      ) : null}
      {error ? <span className={`flex relative font-mono text-[11px] text-[#ff6b6b] ${errorTextClass}`}>{error}</span> : null}
    </div>
  );
}
