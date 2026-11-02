import { useState } from "react";
import { useProject } from "@/hooks/useProject";
import { api } from "@/hooks/api";
import { describeError } from "@/hooks/errors";
import { copyText } from "@/hooks/clipboard";
import { buttonClass, ghostButtonClass, labelClass, panelClass } from "@/hooks/theme";
import { errorClass } from "@/hooks/classes";
import StepFrame from "@/modules/StepFrame";

export default function ExportStep() {
  const { event, root } = useProject();
  const [preview, setPreview] = useState<string | null>(null);
  const [written, setWritten] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  if (!event) return null;

  const run = async (label: string, task: () => Promise<void>) => {
    setWorking(label);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setWorking(null);
    }
  };

  const previewConfig = () => {
    if (preview) {
      setPreview(null);
      return;
    }
    void run("preview", async () => {
      const data = await api.exportMitv(event);
      setPreview(JSON.stringify(data, null, 2));
    });
  };

  const writeExport = () => {
    if (!root) return;
    void run("write", async () => {
      const dest = `${root.replace(/\/$/, "")}/export/mitv-config.json`;
      setWritten(await api.exportWrite(root, event, dest));
    });
  };

  const copyPreview = async () => {
    if (!preview) return;
    const ok = await copyText(preview);
    setCopied(ok ? "ok" : "fail");
    window.setTimeout(() => setCopied(null), 1600);
  };

  const zoneTotal = event.sites.reduce((sum, s) => sum + s.zones.length, 0);
  const slotTotal = event.sites.reduce((sum, s) => sum + s.zones.reduce((z, zone) => z + zone.schedule.length, 0), 0);
  const hotspotTotal =
    event.map.hotspots.length + event.sites.reduce((sum, s) => sum + s.map.hotspots.length, 0);

  const outgoing = [
    { label: "locations", count: event.sites.length },
    { label: "stages", count: zoneTotal },
    { label: "channel schedule", count: slotTotal },
    { label: "hotspots", count: hotspotTotal },
  ];

  return (
    <StepFrame
      step="export"
      title="EXPORT"
      titleSize="large"
      accent="pink"
      intro="Ship the event as the config the original mitv sim site reads, so the whole thing runs in a browser with the same maps, hotspots and itineraries."
    >
      <div className="flex relative flex-col w-[480px] max-w-full font-ocr text-[11.5px] leading-none">
        <span className="flex relative flex-row h-[23px] items-center uppercase text-[#009fdf]">Outgoing:</span>
        {outgoing.map((row) => (
          <div key={row.label} className="flex relative flex-row h-[23px] w-[460px] max-w-full items-center justify-between">
            <span className="flex relative text-[#e4e6e5]">{row.label}</span>
            <span className="flex relative text-right text-[#daf822]">{row.count}</span>
          </div>
        ))}
      </div>

      <div className={`${panelClass} gap-4 p-5`}>
        <div className="flex relative flex-row flex-wrap items-center gap-2">
          <button type="button" onClick={previewConfig} disabled={working !== null} className={ghostButtonClass}>
            {working === "preview" ? "Building…" : preview ? "Hide preview" : "Preview mitv config"}
          </button>
          <button type="button" onClick={writeExport} disabled={!root || working !== null} className={buttonClass}>
            {working === "write" ? "Writing…" : "Write export"}
          </button>
          {preview ? (
            <button type="button" onClick={() => void copyPreview()} className={ghostButtonClass}>
              {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed" : "Copy JSON"}
            </button>
          ) : null}
        </div>
        {root ? (
          <span className="flex relative font-mono text-[11px] text-white/45">
            {root.replace(/\/$/, "")}/export/mitv-config.json
          </span>
        ) : null}
        {written ? (
          <div className="flex relative flex-col gap-1 rounded-sm border border-[#7cff6b]/40 bg-[#7cff6b]/10 px-4 py-3">
            <span className="flex relative text-[11px] uppercase tracking-[0.25em] text-[#7cff6b]">Written</span>
            <span className="flex relative font-mono text-[12px] text-white/85 break-all">{written}</span>
          </div>
        ) : null}
        {error ? <span className={errorClass}>{error}</span> : null}
      </div>

      {preview ? (
        <div className={`${panelClass} gap-3 p-5`}>
          <div className="flex relative flex-row items-center justify-between gap-3">
            <span className={labelClass}>Preview</span>
            <div className="flex relative flex-row items-center gap-3">
              <span className="flex relative font-mono text-[11px] text-white/50">{(preview.length / 1024).toFixed(1)} KB</span>
              <button type="button" onClick={() => setPreview(null)} className={ghostButtonClass}>
                Hide
              </button>
            </div>
          </div>
          <pre className="flex relative max-h-[520px] overflow-auto scroll-thin rounded-sm border border-white/10 bg-black/70 p-4 font-mono text-[11px] leading-relaxed text-white/80 whitespace-pre">
            {preview}
          </pre>
        </div>
      ) : null}
    </StepFrame>
  );
}
