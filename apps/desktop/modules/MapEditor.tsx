import { useEffect, useMemo, useState } from "react";
import type { Point } from "@/types/event";
import type { DraftPolygon, HotspotSource, MapEditorProps, MapLevel, MediaSlot, NaturalSize, VariantSlot } from "@/types/map";
import { api, assetUrl, pickFile } from "@/hooks/api";
import { useProject } from "@/hooks/useProject";
import { panelClass } from "@/hooks/theme";
import { extOf, isArea, samePoint } from "@/hooks/geometry";
import {
  addArea,
  addVariant,
  allowsLoop,
  allowsVariants,
  allowsVideoSet,
  canonicalRel,
  clearPolygon,
  defaultPreview,
  defaultWindow,
  deleteVertex,
  emptyPolygon,
  expectedTargets,
  insertVertex,
  isLinked,
  isWidgetLevel,
  levelEntries,
  levelKey,
  levelTitle,
  levelUtc,
  linkHotspots,
  moveVertex,
  nextAreaTarget,
  readMedia,
  removeVariant,
  renameArea,
  resolveLevel,
  setHotspotWindow,
  setPolygon,
  setSize,
  setSlot,
  setVariantSlot,
  unlinkHotspots,
  updateVariant,
  variantRel,
  variantsAt,
} from "@/hooks/mapEdit";
import { activeVariant, resolveLoop, resolvePoster, resolveWidget } from "@/hooks/timeWindows";
import MapLevelList from "@/modules/MapLevelList";
import MediaToolbar from "@/modules/MediaToolbar";
import MediaVariants from "@/modules/MediaVariants";
import PreviewAtBar from "@/modules/PreviewAtBar";
import HotspotSourceBar from "@/modules/HotspotSourceBar";
import MapCanvas from "@/modules/MapCanvas";
import HotspotList from "@/modules/HotspotList";
import ZonePreview from "@/modules/ZonePreview";

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);

const withRev = (url: string | null, rev: number): string | null =>
  url ? `${url}${url.includes("?") ? "&" : "?"}v=${rev}` : null;

export default function MapEditor({ event, level: rawLevel, onLevel }: MapEditorProps) {
  const { root, update, busy } = useProject();
  const [draft, setDraft] = useState<DraftPolygon | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [natural, setNatural] = useState<NaturalSize | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [rev, setRev] = useState(0);
  const [rawSource, setRawSource] = useState<HotspotSource>("image");
  const [frame, setFrame] = useState(0);
  const [duration, setDuration] = useState(0);
  const [previewAt, setPreviewAt] = useState(() => defaultPreview(event, resolveLevel(event, rawLevel)));

  const level = useMemo(() => resolveLevel(event, rawLevel), [event, rawLevel]);
  const key = levelKey(level);
  const entries = useMemo(() => levelEntries(event), [event]);
  const baseView = useMemo(() => readMedia(event, level), [event, level]);
  const hasVideoSet = allowsVideoSet(level) && Boolean(baseView.loop);
  const source: HotspotSource = hasVideoSet ? rawSource : "image";
  const linked = isLinked(event, level);
  const view = useMemo(() => readMedia(event, level, source), [event, level, source]);
  const targets = useMemo(() => expectedTargets(event, level, source), [event, level, source]);
  const variants = useMemo(() => variantsAt(event, level), [event, level]);
  const utc = levelUtc(level);
  const widgetLevel = isWidgetLevel(level);
  const active = activeVariant(variants, previewAt);
  const posterRel = widgetLevel ? resolveWidget(view.image, variants, previewAt) : resolvePoster(view.image, variants, previewAt);
  const loopRel = resolveLoop(view.loop, variants, previewAt);
  const showingBase = source === "video" ? loopRel === view.loop : posterRel === view.image;
  const imageUrl = withRev(assetUrl(root, posterRel), rev);
  const loopUrl = withRev(assetUrl(root, loopRel), rev);
  const labelFor = (target: string): string => targets.find((t) => t.target === target)?.label ?? target;

  const selectLevel = (next: MapLevel) => {
    onLevel(next);
    setDraft(null);
    setNatural(null);
    setNotice(null);
    setRawSource("image");
    setFrame(0);
    setDuration(0);
    setPreviewAt(defaultPreview(event, resolveLevel(event, next)));
  };

  const selectSource = (next: HotspotSource) => {
    setRawSource(next);
    setDraft(null);
    setNatural(null);
  };

  const finish = () => {
    if (!draft) return;
    const pts = draft.points.filter((p, i, arr) => i === 0 || !samePoint(p, arr[i - 1]));
    if (pts.length >= 3) update((prev) => setPolygon(prev, level, draft.target, labelFor(draft.target), pts, source));
    setDraft(null);
  };

  const undoPoint = () => setDraft((d) => (d ? { ...d, points: d.points.slice(0, -1) } : d));

  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape") setDraft(null);
      if (e.key === "Enter") finish();
      if (e.key === "Backspace") {
        e.preventDefault();
        undoPoint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const importSlot = async (slot: MediaSlot) => {
    if (!root) {
      setNotice("Save the project to a folder first, then import media so it can be copied into the project.");
      return;
    }
    const picked = await pickFile(slot === "image" ? ["png", "jpg", "jpeg", "webp"] : ["mp4", "webm", "mov"], slot === "image" ? "Image" : "Video");
    if (!picked) return;
    setImporting(true);
    try {
      const rel = await api.projectImportAsset(root, picked, canonicalRel(level, slot, extOf(picked, slot === "image" ? "png" : "mp4")));
      update((prev) => setSlot(prev, level, slot, rel));
      setNatural(null);
      setRev((r) => r + 1);
      setNotice(null);
    } catch (e) {
      setNotice(describe(e));
    } finally {
      setImporting(false);
    }
  };

  const importVariant = async (index: number, slot: VariantSlot) => {
    if (!root) {
      setNotice("Save the project to a folder first, then import media so it can be copied into the project.");
      return;
    }
    const variant = variants[index];
    if (!variant) return;
    const image = slot !== "loop_video";
    const picked = await pickFile(image ? ["png", "jpg", "jpeg", "webp"] : ["mp4", "webm", "mov"], image ? "Image" : "Video");
    if (!picked) return;
    setImporting(true);
    try {
      const rel = await api.projectImportAsset(root, picked, variantRel(level, variant.window, slot, extOf(picked, image ? "png" : "mp4")));
      update((prev) => setVariantSlot(prev, level, index, slot, rel));
      setRev((r) => r + 1);
      setNotice(null);
    } catch (e) {
      setNotice(describe(e));
    } finally {
      setImporting(false);
    }
  };

  const addPoint = (p: Point) => setDraft((d) => (d ? { ...d, points: [...d.points, p] } : d));

  const startArea = () => {
    const target = nextAreaTarget(view.hotspots);
    update((prev) => addArea(prev, level, target, source));
    setDraft({ target, points: [] });
  };

  const levelList = <MapLevelList entries={entries} activeKey={key} onSelect={selectLevel} />;

  return (
    <div className="flex relative flex-row items-start gap-[12px] min-h-[232px]">
      <div className={`${panelClass} flex-1 min-w-0 gap-3 p-4`}>
        <MediaToolbar
          view={view}
          natural={natural}
          allowLoop={allowsLoop(level)}
          busy={busy || importing}
          notice={notice}
          onImportImage={() => void importSlot("image")}
          onImportLoop={() => void importSlot("loop")}
          onClearLoop={() => update((prev) => setSlot(prev, level, "loop", null))}
          onUseImageSize={() => {
            if (natural) update((prev) => setSize(prev, level, natural.width, natural.height));
          }}
          onSize={(w, h) => update((prev) => setSize(prev, level, w, h))}
        />
        {allowsVariants(level) ? (
          <MediaVariants
            variants={variants}
            allowWidget={level.kind !== "zone"}
            utc={utc}
            busy={busy || importing}
            onAdd={() => update((prev) => addVariant(prev, level))}
            onWindow={(index, w) => update((prev) => updateVariant(prev, level, index, { window: w }))}
            onImport={(index, slot) => void importVariant(index, slot)}
            onClear={(index, slot) => update((prev) => setVariantSlot(prev, level, index, slot, null))}
            onRemove={(index) => update((prev) => removeVariant(prev, level, index))}
          />
        ) : null}
        <PreviewAtBar value={previewAt} utc={utc} active={active?.window ?? null} onChange={setPreviewAt} />
        {hasVideoSet ? (
          <HotspotSourceBar
            source={source}
            linked={linked}
            frame={frame}
            duration={duration}
            busy={busy || importing}
            onSource={selectSource}
            onUnlink={() => {
              setDraft(null);
              update((prev) => unlinkHotspots(prev, level));
            }}
            onLink={() => {
              setDraft(null);
              update((prev) => linkHotspots(prev, level));
            }}
            onFrame={setFrame}
          />
        ) : null}
        {level.kind === "zone" ? (
          <ZonePreview view={view} imageUrl={imageUrl} loopUrl={loopUrl} label={levelTitle(event, level)} />
        ) : (
          <MapCanvas
            key={key}
            view={view}
            url={imageUrl}
            videoUrl={source === "video" ? loopUrl : null}
            frame={frame}
            previewAt={previewAt}
            onDuration={setDuration}
            targets={targets}
            draft={draft}
            activeTarget={draft?.target ?? hover}
            onHover={setHover}
            onAddPoint={addPoint}
            onFinish={finish}
            onVertexMove={(target, index, p) => update((prev) => moveVertex(prev, level, target, index, p, source))}
            onVertexInsert={(target, index, p) => update((prev) => insertVertex(prev, level, target, index, p, source))}
            onVertexDelete={(target, index) => update((prev) => deleteVertex(prev, level, target, index, source))}
            onNaturalSize={(size) => setNatural(showingBase ? size : null)}
          />
        )}
      </div>
      <div className="flex relative flex-col w-[210px] shrink-0 self-stretch gap-[12px]">
        <div className="flex relative flex-col flex-1 min-h-0 gap-[12px]">
          {levelList}
          {level.kind !== "zone" ? (
            <HotspotList
              targets={targets}
              draft={draft}
              activeTarget={draft?.target ?? hover}
              defaultWindow={defaultWindow(event, level)}
              utc={utc}
              onWindow={(target, w) => update((prev) => setHotspotWindow(prev, level, target, w, source))}
              onHover={setHover}
              onDraw={(target) => setDraft({ target, points: [] })}
              onFinish={finish}
              onUndoPoint={undoPoint}
              onCancel={() => setDraft(null)}
              onClear={(target) =>
                update((prev) => (isArea(target) ? emptyPolygon(prev, level, target, source) : clearPolygon(prev, level, target, source)))
              }
              onAddArea={startArea}
              onRenameArea={(target, label) => update((prev) => renameArea(prev, level, target, label, source))}
              onRemoveArea={(target) => update((prev) => clearPolygon(prev, level, target, source))}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
