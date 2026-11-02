import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { api } from "@/hooks/api";
import { describeError } from "@/hooks/errors";
import {
  isVideoItem,
  levelFor,
  overrideFor,
  partItems,
  partKey,
  resolvePart,
  setInitImage,
  setOverride,
  siblingPoster,
} from "@/hooks/contentEdit";
import { essentialMissing, replaceItem } from "@/hooks/generate";
import { addVariant, levelUtc, removeVariant, updateVariant, variantsAt } from "@/hooks/mapEdit";
import { useProviders } from "@/hooks/useProviders";
import { useGeneration } from "@/hooks/useGeneration";
import { errorClass, monoClass, sectionTitleClass } from "@/hooks/classes";
import StepFrame from "@/modules/StepFrame";
import Stepper from "@/modules/Stepper";
import ProviderBar from "@/modules/ProviderBar";
import SlotCard from "@/modules/SlotCard";
import WindowsPanel from "@/modules/WindowsPanel";
import type { ContentItem } from "@/types/content";
import type { ContentOverride, TimeWindow } from "@/types/event";
import type { ContentGroup, ContentPart } from "@/types/ui";

export default function ContentStep() {
  const { event, root, update, refreshReports } = useProject();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [part, setPart] = useState<ContentPart | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoOpened = useRef(false);
  const eventRef = useRef(event);
  const rootRef = useRef(root);
  const reloadTimer = useRef<number | null>(null);
  const pendingGenerate = useRef<ContentItem | null>(null);
  const syncedOnce = useRef(false);
  eventRef.current = event;
  rootRef.current = root;
  const providers = useProviders(root);

  useEffect(() => {
    if (autoOpened.current || !providers.active) return;
    autoOpened.current = true;
    if (essentialMissing(providers.active)) setSettingsOpen(true);
  }, [providers.active]);

  const load = useCallback(async () => {
    const current = eventRef.current;
    if (!current) return;
    setLoading(true);
    try {
      setItems(await api.contentManifest(current, rootRef.current));
      setError(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      reloadTimer.current = null;
      void load();
    }, 400);
  }, [load]);

  useEffect(() => {
    if (providers.active) scheduleReload();
  }, [providers.active?.id, scheduleReload]);

  const syncIntoEvent = useCallback(async () => {
    const current = eventRef.current;
    const currentRoot = rootRef.current;
    if (!current || !currentRoot) return;
    const synced = await api.syncMedia(current, currentRoot);
    update(synced);
    await refreshReports();
    setItems(await api.contentManifest(synced, currentRoot));
  }, [update, refreshReports]);

  useEffect(() => {
    if (syncedOnce.current) return;
    syncedOnce.current = true;
    if (!rootRef.current) {
      void load();
      return;
    }
    void syncIntoEvent().catch(() => load());
  }, [load, syncIntoEvent]);

  useEffect(
    () => () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    },
    [],
  );

  const generation = useGeneration({
    root,
    event,
    onItem: (item) => setItems((prev) => replaceItem(prev, item)),
    onFinished: async () => {
      try {
        await syncIntoEvent();
      } catch (e) {
        setError(describeError(e));
      }
    },
  });

  useEffect(() => {
    const pending = pendingGenerate.current;
    if (!pending || !event) return;
    if (!overrideFor(event, pending.id).init_images[0]) return;
    pendingGenerate.current = null;
    generation.start([pending]);
  }, [event, generation]);

  const editOverride = useCallback(
    (id: string, patch: Partial<ContentOverride>) => {
      update((prev) => setOverride(prev, id, patch));
      scheduleReload();
    },
    [update, scheduleReload],
  );

  const editInitImage = useCallback(
    (id: string, index: number, rel: string | null) => {
      update((prev) => setInitImage(prev, id, index, rel));
      scheduleReload();
    },
    [update, scheduleReload],
  );

  const resolved = useMemo(() => (event ? resolvePart(event, part) : null), [event, part]);
  const level = resolved ? levelFor(resolved) : null;
  const visible = useMemo(() => (resolved ? partItems(items, resolved) : []), [items, resolved]);
  const groups: ContentGroup[] = useMemo(() => [{ key: "all", title: null, items: visible }], [visible]);

  if (!event || !resolved) return null;

  const partValue = resolved.kind === "event" ? "event" : `site:${resolved.site}`;
  const segments = [
    ...(event.sites.length !== 1 ? [{ value: "event", label: "Event map" }] : []),
    ...event.sites.map((s) => ({ value: `site:${s.id}`, label: s.label })),
  ];
  const site = resolved.kind === "site" || resolved.kind === "zone" ? event.sites.find((s) => s.id === resolved.site) ?? null : null;
  const zoneValue = resolved.kind === "zone" ? resolved.zone : "";
  const stages = site ? [{ value: "", label: "Site Map" }, ...site.zones.map((z) => ({ value: z.id, label: z.label }))] : [];
  const segmentIndex = Math.max(0, segments.findIndex((s) => s.value === partValue));
  const stageIndex = Math.max(0, stages.findIndex((s) => s.value === zoneValue));

  const choosePart = (value: string) => {
    if (value === "event") setPart({ kind: "event" });
    else setPart({ kind: "site", site: value.slice(5) });
  };

  const chooseZone = (value: string) => {
    if (!site) return;
    setPart(value ? { kind: "zone", site: site.id, zone: value } : { kind: "site", site: site.id });
  };

  const stepSegment = (delta: number) => {
    const next = segments[(segmentIndex + delta + segments.length) % segments.length];
    if (next) choosePart(next.value);
  };

  const stepStage = (delta: number) => {
    if (stages.length === 0) return;
    const next = stages[(stageIndex + delta + stages.length) % stages.length];
    if (next) chooseZone(next.value);
  };

  const generate = (item: ContentItem, poster: ContentItem | null) => {
    const override = overrideFor(event, item.id);
    if (isVideoItem(item)) {
      if (!poster) return;
      if (override.init_images.length !== 1 || override.init_images[0] !== poster.path) {
        pendingGenerate.current = item;
        update((prev) => setOverride(prev, item.id, { init_images: [poster.path] }));
        scheduleReload();
        return;
      }
    }
    generation.start([item]);
  };

  const variants = level ? variantsAt(event, level) : [];

  return (
    <StepFrame step="content">
      <div className="flex relative flex-col gap-3 mt-[-2px] ml-[14px]">
        <div className="flex relative flex-row h-[68px] min-w-[480px] w-fit max-w-full shrink-0 items-end gap-[14px] rounded-[8px] border border-[#daf822] bg-black px-[12px] pb-[12px]">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            className={`flex relative flex-row h-[21px] w-[90px] shrink-0 items-center justify-between border px-[8px] font-ocr text-[10.5px] leading-none transition ${
              settingsOpen ? "border-[#daf822] text-[#daf822]" : "border-[#6e83c3] text-[#8c8c8c] hover:text-[#daf822]"
            }`}
          >
            <span className="flex relative">settings</span>
            <span className="flex relative">{">"}</span>
          </button>
          <Stepper
            label="Segment"
            value={segments[segmentIndex]?.label ?? "—"}
            options={segments}
            onPrev={() => stepSegment(-1)}
            onNext={() => stepSegment(1)}
            onSelect={choosePart}
          />
          <Stepper
            label="Stage"
            value={site ? (stages[stageIndex]?.label ?? "Site Map") : "—"}
            options={stages}
            disabled={!site}
            onPrev={() => stepStage(-1)}
            onNext={() => stepStage(1)}
            onSelect={chooseZone}
          />
          <Stepper label="Sponsor" value="—" options={[]} disabled onPrev={() => undefined} onNext={() => undefined} onSelect={() => undefined} />
        </div>
        {loading ? <span className={monoClass}>loading…</span> : null}
        {error ? <span className={errorClass}>{error}</span> : null}
      </div>

      <ProviderBar state={providers} root={root} open={settingsOpen} />

      <div key={partKey(resolved)} className="flex relative flex-col gap-6">
        {groups.map((group) => (
          <div key={group.key} className="flex relative flex-col gap-3">
            {group.title ? <span className={sectionTitleClass}>{group.title}</span> : null}
            <div className="flex relative flex-row flex-wrap gap-4">
              {group.items.map((item) => {
                const poster = siblingPoster(items, item);
                return (
                  <SlotCard
                    key={item.id}
                    item={item}
                    override={overrideFor(event, item.id)}
                    poster={poster}
                    root={root}
                    provider={providers.active}
                    job={generation.jobs[item.id] ?? null}
                    busy={generation.progress.running}
                    onOverride={(patch) => editOverride(item.id, patch)}
                    onInitImage={(index, rel) => editInitImage(item.id, index, rel)}
                    onGenerate={() => generate(item, poster)}
                    onAccept={(candidate) => void generation.accept(item, candidate)}
                    onDiscard={(candidate) => void generation.discard(item, candidate)}
                    onAbort={() => void generation.abort(item)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {level ? (
        <WindowsPanel
          variants={variants}
          utc={levelUtc(level)}
          onAdd={() => {
            update((prev) => addVariant(prev, level));
            scheduleReload();
          }}
          onWindow={(index: number, window: TimeWindow) => {
            update((prev) => updateVariant(prev, level, index, { window }));
            scheduleReload();
          }}
          onRemove={(index: number) => {
            update((prev) => removeVariant(prev, level, index));
            scheduleReload();
          }}
        />
      ) : null}
    </StepFrame>
  );
}
