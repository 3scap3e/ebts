import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, isTauri, pickFolder } from "@/hooks/api";
import { copyText } from "@/hooks/clipboard";
import { describeError } from "@/hooks/errors";
import { formatBytes, missingBytes, statusLabel } from "@/hooks/models";
import { green, red } from "@/hooks/theme";
import { errorClass, smallButtonClass } from "@/hooks/classes";
import type { ModelProgress, ModelStatus } from "@/types/generate";
import type { ModelsPanelProps } from "@/types/ui";

const toneColor = (tone: "ok" | "missing" | "dim" | "busy"): string =>
  tone === "ok" ? green : tone === "missing" ? red : tone === "busy" ? "#daf822" : "rgba(255,255,255,0.4)";

export default function ModelsPanel({ example, root, baseUrl, modelsDir, onModelsDir }: ModelsPanelProps) {
  const [statuses, setStatuses] = useState<ModelStatus[] | null>(null);
  const [progress, setProgress] = useState<Record<string, ModelProgress>>({});
  const [busy, setBusy] = useState<"check" | "download" | "script" | null>(null);
  const [scriptPath, setScriptPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const desktop = isTauri() && Boolean(root);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    const stop = listen<ModelProgress>("model-progress", ({ payload }) => {
      if (!active || payload.id !== example.id) return;
      setProgress((prev) => ({ ...prev, [payload.file]: payload }));
    });
    return () => {
      active = false;
      void stop.then((unlisten) => unlisten());
    };
  }, [example.id]);

  const check = async () => {
    if (!baseUrl.trim()) return;
    setBusy("check");
    setError(null);
    try {
      setStatuses(await api.comfyModelsStatus(baseUrl, example.id));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    setStatuses(null);
    setProgress({});
    setScriptPath(null);
    if (desktop && baseUrl.trim()) void check();
  }, [example.id, baseUrl, desktop]);

  const download = async () => {
    let dir = modelsDir.trim();
    if (!dir) {
      const picked = await pickFolder();
      if (!picked) return;
      dir = picked;
      onModelsDir(dir);
    }
    setBusy("download");
    setError(null);
    setProgress({});
    try {
      setStatuses(await api.comfyModelsDownload(example.id, dir, baseUrl.trim() || null));
      setProgress({});
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const script = async () => {
    if (!root) return;
    setBusy("script");
    setError(null);
    try {
      const made = await api.comfyModelsScript(root, example.id);
      const copied = await copyText(made.script);
      setScriptPath(`${copied ? "Copied · " : ""}${made.path}`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const pending = missingBytes(example, statuses);

  return (
    <div className="flex relative flex-col gap-2 rounded-sm border border-white/10 p-2">
      <div className="flex relative flex-row flex-wrap items-center justify-between gap-2">
        <span className="flex relative font-ocr text-[9px] uppercase tracking-[0.2em] text-[#009fdf]">Models</span>
        <span className="flex relative font-mono text-[11px] text-white/50">{statuses ? `${formatBytes(pending)} to fetch` : formatBytes(pending)}</span>
      </div>
      <div className="flex relative flex-col gap-1">
        {example.models.map((model) => {
          const status = statuses?.find((s) => s.file === model.file && s.folder === model.folder);
          const label = statusLabel(status, progress[model.file]);
          const live = progress[model.file];
          const pct = live?.total ? Math.min(100, (live.done / live.total) * 100) : 0;
          return (
            <div key={`${model.folder}/${model.file}`} className="flex relative flex-col gap-0.5">
              <div className="flex relative flex-row items-center gap-3">
                <span className="flex relative min-w-0 flex-1 truncate font-mono text-[11px] text-white/80">{model.file}</span>
                <span className="flex relative shrink-0 font-mono text-[10px] text-white/40">
                  {model.folder} · {formatBytes(model.bytes)}
                </span>
                <span className="flex relative w-[76px] shrink-0 justify-end font-mono text-[10px]" style={{ color: toneColor(label.tone) }}>
                  {label.text}
                </span>
              </div>
              {live ? (
                <div className="flex relative h-[2px] w-full bg-white/10">
                  <div className="flex relative h-full bg-[#daf822]" style={{ width: `${pct}%` }} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {example.nodes.length > 0 ? (
        <div className="flex relative flex-col gap-0.5">
          {example.nodes.map((pack) => (
            <div key={pack.name} className="flex relative flex-row items-center gap-3">
              <span className="flex relative min-w-0 flex-1 truncate font-mono text-[11px] text-white/80">{pack.name}</span>
              <span className="flex relative min-w-0 truncate font-mono text-[10px] text-white/40">{pack.url}</span>
              <span className="flex relative w-[76px] shrink-0 justify-end font-mono text-[10px] text-white/40">custom node</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex relative flex-row flex-wrap items-center gap-2">
        <button type="button" onClick={() => void check()} disabled={!desktop || busy !== null || !baseUrl.trim()} className={smallButtonClass}>
          {busy === "check" ? "Checking…" : "Check server"}
        </button>
        <button type="button" onClick={() => void download()} disabled={!desktop || busy !== null} className={smallButtonClass}>
          {busy === "download" ? "Downloading…" : "Download models"}
        </button>
        <button type="button" onClick={() => void script()} disabled={!desktop || busy !== null} className={smallButtonClass}>
          {busy === "script" ? "Writing…" : "Download script"}
        </button>
        {modelsDir ? (
          <button type="button" onClick={() => void pickFolder().then((dir) => dir && onModelsDir(dir))} disabled={!desktop || busy !== null} className="flex relative min-w-0 truncate font-mono text-[11px] text-white/50 hover:text-white">
            {modelsDir}
          </button>
        ) : null}
        {scriptPath ? <span className="flex relative min-w-0 truncate font-mono text-[11px] text-white/50">{scriptPath}</span> : null}
      </div>
      {error ? <span className={errorClass}>{error}</span> : null}
    </div>
  );
}
