import { useEffect, useState } from "react";
import { api, isTauri, pickFile } from "@/hooks/api";
import { describeError } from "@/hooks/errors";
import { baseName } from "@/hooks/contentEdit";
import { clearNodeValues, nodeLabel, nodeValue, nodesEmpty, patchConfig, setNodeValue, sortNodes, suggestedNodes, toggleImageNode } from "@/hooks/generate";
import { buttonClass, labelClass } from "@/hooks/theme";
import { errorClass, monoClass, smallButtonClass, smallMonoClass } from "@/hooks/classes";
import { exampleForPath } from "@/hooks/models";
import Field from "@/modules/Field";
import ModelsPanel from "@/modules/ModelsPanel";
import Select from "@/modules/Select";
import type { ComfyExample, ComfyField, ComfyNodeInfo, ComfyNodes, ComfyuiConfig } from "@/types/generate";
import type { ComfySettingsProps } from "@/types/ui";

type Slot = "image" | "video";

const workflowKey = (slot: Slot): "image_workflow" | "video_workflow" => (slot === "image" ? "image_workflow" : "video_workflow");
const nodesKey = (slot: Slot): "image_nodes" | "video_nodes" => (slot === "image" ? "image_nodes" : "video_nodes");

export default function ComfySettings({ config, root, saving, onSave }: ComfySettingsProps) {
  const [draft, setDraft] = useState<ComfyuiConfig>(config);
  const [nodes, setNodes] = useState<Record<Slot, ComfyNodeInfo[] | null>>({ image: null, video: null });
  const [busy, setBusy] = useState<Slot | "list" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverWorkflows, setServerWorkflows] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<Record<Slot, string>>({ image: "", video: "" });
  const [examples, setExamples] = useState<ComfyExample[]>([]);
  const desktop = isTauri() && Boolean(root);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    if (!isTauri()) return;
    api
      .comfyExamples()
      .then(setExamples)
      .catch(() => setExamples([]));
  }, []);

  const installExample = async (slot: Slot, id: string) => {
    if (!root || !id) return;
    setBusy(slot);
    setError(null);
    try {
      const result = await api.comfyExampleInstall(root, id, draft.base_url || null);
      const list = sortNodes(result.nodes);
      setNodes((prev) => ({ ...prev, [slot]: list }));
      setPicked((prev) => ({ ...prev, [slot]: "" }));
      setDraft((prev) => ({ ...prev, [workflowKey(slot)]: result.path, [nodesKey(slot)]: suggestedNodes(list) }));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const inspect = async (slot: Slot, path: string, current: ComfyuiConfig): Promise<ComfyuiConfig> => {
    const list = sortNodes(await api.comfyInspect(root, path, current.base_url || null));
    setNodes((prev) => ({ ...prev, [slot]: list }));
    const key = nodesKey(slot);
    return nodesEmpty(current[key]) ? { ...current, [key]: suggestedNodes(list) } : current;
  };

  useEffect(() => {
    if (!desktop) return;
    for (const slot of ["image", "video"] as Slot[]) {
      const path = config[workflowKey(slot)];
      if (!path) continue;
      void inspect(slot, path, config)
        .then((next) => setDraft((prev) => ({ ...prev, [nodesKey(slot)]: next[nodesKey(slot)] })))
        .catch((e) => setError(describeError(e)));
    }
  }, [desktop, config.image_workflow, config.video_workflow]);

  const loadWorkflows = async () => {
    setBusy("list");
    setError(null);
    try {
      setServerWorkflows(await api.comfyWorkflows(draft.base_url));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const importFromServer = async (slot: Slot, name: string) => {
    if (!root || !name) return;
    setPicked((prev) => ({ ...prev, [slot]: name }));
    setBusy(slot);
    setError(null);
    try {
      const result = await api.comfyWorkflowImport(root, draft.base_url, name);
      const list = sortNodes(result.nodes);
      setNodes((prev) => ({ ...prev, [slot]: list }));
      setDraft((prev) => ({ ...prev, [workflowKey(slot)]: result.path, [nodesKey(slot)]: suggestedNodes(list) }));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const runInspect = async (slot: Slot) => {
    const path = draft[workflowKey(slot)];
    if (!path) return;
    setBusy(slot);
    setError(null);
    try {
      setDraft(await inspect(slot, path, draft));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const upload = async (slot: Slot) => {
    if (!root) return;
    setBusy(slot);
    setError(null);
    try {
      const file = await pickFile(["json"], "Workflow");
      if (!file) return;
      const rel = await api.projectImportAsset(root, file, `workflows/${baseName(file)}`);
      const withPath: ComfyuiConfig = { ...draft, [workflowKey(slot)]: rel };
      setDraft(await inspect(slot, rel, withPath));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const patchNodes = (slot: Slot, patch: (nodes: ComfyNodes) => ComfyNodes) =>
    setDraft((prev) => ({ ...prev, [nodesKey(slot)]: patch(prev[nodesKey(slot)]) }));

  const block = (slot: Slot, title: string) => {
    const path = draft[workflowKey(slot)];
    const list = nodes[slot];
    const mapping = draft[nodesKey(slot)];
    const textNodes = list ? list.filter((n) => n.text_keys.length > 0) : [];
    const imageNodes = list ? list.filter((n) => n.image_keys.length > 0) : [];
    const saveNodes = list ? list.filter((n) => n.saves) : [];
    const loraNodes = list ? list.filter((n) => n.lora && n.fields.length > 0) : [];
    const bundled = examples.filter((e) => e.kind === slot);
    const example = exampleForPath(examples, path);
    const fieldControl = (node: ComfyNodeInfo, field: ComfyField) => {
      const current = nodeValue(mapping, node.id, field.key, field.value);
      if (field.kind === "combo") {
        const options = field.options.length ? field.options : current !== null ? [String(current)] : [];
        return (
          <Select
            compact
            searchable
            className="min-w-[220px] flex-1"
            value={current === null ? "" : String(current)}
            placeholder="Pick"
            options={options.map((o) => ({ value: o, label: o }))}
            onChange={(value) => patchNodes(slot, (m) => setNodeValue(m, node.id, field.key, value))}
          />
        );
      }
      if (field.kind === "bool") {
        return (
          <input
            type="checkbox"
            checked={Boolean(current)}
            onChange={(e) => patchNodes(slot, (m) => setNodeValue(m, node.id, field.key, e.target.checked))}
          />
        );
      }
      return (
        <input
          type={field.kind === "number" ? "number" : "text"}
          step={field.kind === "number" ? 0.05 : undefined}
          value={current === null ? "" : String(current)}
          onChange={(e) => {
            const raw = e.target.value;
            const value = field.kind === "number" ? Number(raw) : raw;
            if (field.kind === "number" && !Number.isFinite(value as number)) return;
            patchNodes(slot, (m) => setNodeValue(m, node.id, field.key, value));
          }}
          className={`${smallMonoClass} w-[110px]`}
        />
      );
    };
    const fieldBlock = (label: string, group: ComfyNodeInfo[]) =>
      group.length > 0 ? (
        <Field label={label} compact>
          <div className="flex relative flex-col gap-2">
            {group.map((node) => (
              <div key={node.id} className="flex relative flex-col gap-1.5 rounded-sm border border-white/10 p-2">
                <div className="flex relative flex-row items-center justify-between gap-2">
                  <span className="flex relative font-mono text-[11px] text-white/80">{nodeLabel(node)}</span>
                  {mapping.values?.[node.id] ? (
                    <button type="button" onClick={() => patchNodes(slot, (m) => clearNodeValues(m, node.id))} className={smallButtonClass}>
                      Workflow values
                    </button>
                  ) : null}
                </div>
                <div className="flex relative flex-row flex-wrap items-center gap-x-4 gap-y-2">
                  {node.fields.map((field) => (
                    <label key={field.key} className="flex relative flex-row items-center gap-2">
                      <span className="flex relative font-ocr text-[9px] uppercase tracking-[0.2em] text-[#009fdf]">{field.key.replace(/_/g, " ")}</span>
                      {fieldControl(node, field)}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Field>
      ) : null;
    return (
      <div className="flex relative flex-col gap-2 rounded-sm border border-[#daf822]/25 p-3">
        <span className={labelClass}>{title}</span>
        <div className="flex relative flex-row flex-wrap gap-2">
          {bundled.length > 0 ? (
            <Select
              className="flex-1 min-w-[240px]"
              value={example?.id ?? ""}
              placeholder="Example workflows"
              options={bundled.map((e) => ({ value: e.id, label: e.title }))}
              onChange={(id) => void installExample(slot, id)}
            />
          ) : null}
          {serverWorkflows ? (
            <Select
              searchable
              className="flex-1 min-w-[240px]"
              value={picked[slot]}
              placeholder={serverWorkflows.length ? "Pick a workflow from the server" : "No workflows on the server"}
              options={serverWorkflows.map((name) => ({ value: name, label: name.replace(/\.json$/, "") }))}
              onChange={(name) => void importFromServer(slot, name)}
            />
          ) : null}
        </div>
        {example ? <span className="flex relative font-mono text-[11px] leading-snug text-white/50">{example.summary}</span> : null}
        <div className="flex relative flex-row flex-wrap items-center gap-2">
          <span className="flex relative min-w-0 flex-1 truncate font-mono text-[11px] text-white/60">{busy === slot ? "Working…" : path || "none"}</span>
          <button type="button" onClick={() => void upload(slot)} disabled={!desktop || busy !== null} className={smallButtonClass}>
            Upload file
          </button>
          {path ? (
            <button type="button" onClick={() => void runInspect(slot)} disabled={!desktop || busy !== null} className={smallButtonClass}>
              Inspect
            </button>
          ) : null}
        </div>
        {list ? (
          <div className="flex relative flex-col gap-2">
            <div className="flex relative flex-row flex-wrap gap-2">
              <Field label="Prompt node" compact className="flex-1 min-w-[200px]">
                <Select
                  compact
                  value={mapping.prompt[0] ?? ""}
                  placeholder="None"
                  options={textNodes.map((n) => ({ value: n.id, label: nodeLabel(n) }))}
                  onChange={(value) => patchNodes(slot, (m) => ({ ...m, prompt: value ? [value] : [] }))}
                />
              </Field>
              <Field label="Negative node" compact className="flex-1 min-w-[200px]">
                <Select
                  compact
                  value={mapping.negative[0] ?? ""}
                  options={[{ value: "", label: "None" }, ...textNodes.map((n) => ({ value: n.id, label: nodeLabel(n) }))]}
                  onChange={(value) => patchNodes(slot, (m) => ({ ...m, negative: value ? [value] : [] }))}
                />
              </Field>
              <Field label="Output node" compact className="flex-1 min-w-[200px]">
                <Select
                  compact
                  value={mapping.output ?? ""}
                  options={[{ value: "", label: "Auto" }, ...saveNodes.map((n) => ({ value: n.id, label: nodeLabel(n) }))]}
                  onChange={(value) => patchNodes(slot, (m) => ({ ...m, output: value || null }))}
                />
              </Field>
            </div>
            {fieldBlock("LoRA nodes", loraNodes)}
            {example ? (
              <ModelsPanel
                example={example}
                root={root}
                baseUrl={draft.base_url}
                modelsDir={draft.models_dir ?? ""}
                onModelsDir={(dir) => setDraft((prev) => ({ ...prev, models_dir: dir }))}
              />
            ) : null}
            {imageNodes.length > 0 ? (
              <Field label="Init image nodes" compact>
                <div className="flex relative flex-row flex-wrap gap-x-4 gap-y-1.5">
                  {imageNodes.map((n) => (
                    <label key={n.id} className="flex relative flex-row items-center gap-2 font-mono text-[11px] text-white/80">
                      <input
                        type="checkbox"
                        checked={mapping.images.includes(n.id)}
                        onChange={(e) => patchNodes(slot, (m) => toggleImageNode(m, n.id, e.target.checked))}
                      />
                      <span className="flex relative">{nodeLabel(n)}</span>
                    </label>
                  ))}
                </div>
              </Field>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex relative flex-col gap-3">
      <div className="flex relative flex-row flex-wrap items-end gap-2">
        <Field label="Server URL" compact className="flex-1 min-w-[280px]">
          <input
            value={draft.base_url}
            onChange={(e) => setDraft(patchConfig(draft, "base_url", e.target.value) as ComfyuiConfig)}
            placeholder="http://127.0.0.1:8188"
            spellCheck={false}
            className={smallMonoClass}
          />
        </Field>
        <button type="button" onClick={() => void loadWorkflows()} disabled={!desktop || busy !== null || !draft.base_url.trim()} className={`${buttonClass} shrink-0`}>
          {busy === "list" ? "Loading…" : "Load workflows"}
        </button>
        {serverWorkflows ? <span className={monoClass}>{serverWorkflows.length} on the server</span> : null}
      </div>
      {block("image", "Image workflow")}
      {block("video", "Video workflow")}
      <div className="flex relative flex-row flex-wrap items-end gap-3">
        <Field label="Loop seconds" compact className="w-[120px]">
          <input
            type="number"
            min={1}
            step={0.5}
            value={draft.seconds ?? 10}
            onChange={(e) => setDraft(patchConfig(draft, "seconds", e.target.value) as ComfyuiConfig)}
            className={smallMonoClass}
          />
        </Field>
        <Field label="Timeout seconds" compact className="w-[140px]">
          <input
            type="number"
            min={1}
            step={1}
            value={draft.timeout_seconds}
            onChange={(e) => setDraft(patchConfig(draft, "timeout_seconds", e.target.value) as ComfyuiConfig)}
            className={smallMonoClass}
          />
        </Field>
        <button type="button" onClick={() => void onSave(draft)} disabled={!desktop || saving} className={buttonClass}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error ? <span className={errorClass}>{error}</span> : null}
    </div>
  );
}
