import { useProject } from "@/hooks/useProject";
import { pillActiveClass, pillIdleClass } from "@/hooks/theme";

export default function ModePills() {
  const { event, root, busy, mode, setMode, save } = useProject();

  return (
    <div className="flex relative flex-row items-center gap-2">
      <button type="button" onClick={() => setMode("build")} className={mode === "build" ? pillActiveClass : pillIdleClass}>
        Build
      </button>
      <button type="button" onClick={() => setMode("play")} disabled={!event} className={mode === "play" ? pillActiveClass : pillIdleClass}>
        Play
      </button>
      <button type="button" onClick={() => void save()} disabled={busy || !root || !event} className={pillIdleClass}>
        {busy ? "Working" : "Save"}
      </button>
      <button type="button" onClick={() => window.location.reload()} disabled={!event} className={pillIdleClass}>
        Close
      </button>
    </div>
  );
}
