import { useMemo, useState } from "preact/hooks";
import {
  TimelineTrack,
  Inspector,
  Button,
  Field,
  Input,
  Textarea,
  SegmentGroup,
  FieldGrid,
  Collapsible
} from "../../components/ui/index.js";
import { sanitizeDataviz } from "../../../shared/dataviz/geometry.mjs";
import { useDirectorStore } from "../../store/useDirectorStore.js";
import { toTrackScenes, toInspectorScene } from "./timeline-utils.js";
import {
  selectScene,
  patchScene,
  rewriteScene,
  listenScene,
  deleteScene,
  moveScene
} from "./editor-bridge.js";
import PreviewStage from "../preview/PreviewStage.jsx";

const NUM_RE = /-?\d+(?:\.\d+)?/;

// 数据图表 items DSL：每行「标签=值」或「标签=值/上限」，如「轻度使用=14」「重度=8/16」
function parseDatavizItems(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => {
      const m = /^\s*(.+?)\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?\s*$/.exec(line);
      if (!m) return null;
      const item = { label: m[1], value: Number(m[2]) };
      if (m[3]) item.max = Number(m[3]);
      return item;
    })
    .filter(Boolean);
}

function datavizItemsToText(items) {
  return (items || [])
    .map((item) => `${item.label}=${item.value}${item.max ? `/${item.max}` : ""}`)
    .join("\n");
}

// 数据图表编辑器：草稿态本地保存（允许中间态不合法），合法时 sanitize 后写回，
// 不合法（条目不足/没选类型）写 null 删除 dataviz 回退普通分镜——与 metric 开关语义一致。
function DatavizEditor({ dataviz, onPatch }) {
  const [draft, setDraft] = useState(() => ({
    kind: dataviz?.kind || "bar",
    title: dataviz?.title || "",
    unit: dataviz?.unit || "",
    betterLow: dataviz?.better === "low",
    itemsText: datavizItemsToText(dataviz?.items)
  }));

  const commit = (next) => {
    setDraft(next);
    onPatch(
      sanitizeDataviz({
        kind: next.kind,
        title: next.title,
        unit: next.unit,
        better: next.betterLow ? "low" : "high",
        items: parseDatavizItems(next.itemsText)
      })
    );
  };

  return (
    <>
      <p class="ce-metric-hint">
        把产品事实里的真实数字（续航/重量/价格/跑分）渲成动画图表。每行一条「标签=值」或「标签=值/上限」；
        条形/进度环至少 2 行、雷达至少 3 行，不足则自动关闭图表回退普通分镜。
      </p>
      <Field label="图表类型">
        <SegmentGroup
          columns={3}
          options={[
            { value: "bar", label: "条形对比" },
            { value: "ring", label: "进度环" },
            { value: "radar", label: "雷达图" }
          ]}
          value={draft.kind}
          onChange={(kind) => commit({ ...draft, kind })}
        />
      </Field>
      <FieldGrid>
        <Field label="标题">
          <Input
            placeholder="如 实测续航"
            value={draft.title}
            onInput={(e) => commit({ ...draft, title: e.currentTarget.value })}
          />
        </Field>
        <Field label="单位">
          <Input
            placeholder="如 小时 / g / 元"
            value={draft.unit}
            onInput={(e) => commit({ ...draft, unit: e.currentTarget.value })}
          />
        </Field>
      </FieldGrid>
      <Field label="数据项（每行一条）">
        <Textarea
          rows={4}
          placeholder={"轻度使用=14\n重度使用=8/16"}
          value={draft.itemsText}
          onInput={(e) => setDraft({ ...draft, itemsText: e.currentTarget.value })}
          onChange={(e) => commit({ ...draft, itemsText: e.currentTarget.value })}
        />
      </Field>
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={draft.betterLow}
          onChange={(e) => commit({ ...draft, betterLow: e.currentTarget.checked })}
        />
        <span>越低越好（如重量/噪音，用青绿强调）</span>
      </label>
    </>
  );
}

export default function EditorPanel() {
  const timeline = useDirectorStore((s) => s.timeline);
  const currentScene = useDirectorStore((s) => s.currentScene);
  const assets = useDirectorStore((s) => s.assets);
  const busy = useDirectorStore((s) => s.busy);

  const trackScenes = useMemo(() => toTrackScenes(timeline), [timeline]);
  const scenes = timeline?.timeline || [];
  const scene = scenes[currentScene] || null;
  const inspectorScene = useMemo(() => toInspectorScene(scene), [scene]);
  const metric = scene?.visual?.metric || {};

  // 「指标值」是开关：能解析出数才挂 visual.metric，否则清掉回退普通分镜（与 legacy 一致）
  const patchMetric = (key, raw) => {
    const next = { ...metric };
    if (raw === "" || raw === false || raw == null) delete next[key];
    else next[key] = raw;
    const valueText = String(next.value ?? "").trim();
    patchScene(currentScene, {
      metric: valueText && NUM_RE.test(valueText) ? next : null
    });
  };

  return (
    <>
      <div class="track-wrap">
        <TimelineTrack
          scenes={trackScenes}
          currentSceneIndex={currentScene}
          onSelectScene={selectScene}
          onMoveScene={moveScene}
        />
        <p class="track-tip">点击色块切换镜头 · 拖拽色块可调整顺序 · 在右侧编辑口播与画面</p>
        {/* legacy renderTrack/renderTrackRuler 仍写入隐藏节点 */}
        <div class="track-ruler" id="trackRuler" hidden aria-hidden="true" />
        <div class="track" id="track" hidden aria-hidden="true" />
      </div>

      <div class="editor-row">
        <PreviewStage />

        <section class="clip-editor">
          <div class="ce-head">
            <span class="ce-badge">
              {scene ? `镜头 ${scene.index} / ${scenes.length}` : "未选择镜头"}
            </span>
            <span class="tagline">{scene?.source || ""}</span>
          </div>

          {scene ? (
            <FieldGrid>
              <Field label="标题">
                <Input
                  value={scene.title || ""}
                  onInput={(e) => patchScene(currentScene, { title: e.currentTarget.value })}
                />
              </Field>
              <Field label="时长 (秒)">
                <Input
                  type="number"
                  min={2}
                  step={1}
                  value={String(Math.round(scene.duration))}
                  onChange={(e) =>
                    patchScene(currentScene, { duration: Number(e.currentTarget.value) })
                  }
                />
              </Field>
            </FieldGrid>
          ) : null}

          <Inspector
            scene={inspectorScene}
            assets={assets}
            onChange={(updated) => patchScene(currentScene, updated)}
          />

          {scene ? (
            <Collapsible
              key={scene.id}
              summary="数据卡（可选）· 数字滚动 + 进度环"
              open={Boolean(scene.visual?.metric)}
            >
              <p class="ce-metric-hint">
                填「指标值」即给这一镜渲数据卡（大数字从 0 滚到目标 + 进度环）；留空则保持普通分镜。
              </p>
              <FieldGrid>
                <Field label="指标值">
                  <Input
                    placeholder="如 12"
                    value={metric.value != null ? String(metric.value) : ""}
                    onInput={(e) => patchMetric("value", e.currentTarget.value.trim())}
                  />
                </Field>
                <Field label="单位">
                  <Input
                    placeholder="如 小时 / % / dB"
                    value={metric.unit || ""}
                    onInput={(e) => patchMetric("unit", e.currentTarget.value.trim())}
                  />
                </Field>
              </FieldGrid>
              <FieldGrid>
                <Field label="上限 max（可选）">
                  <Input
                    type="number"
                    step="any"
                    placeholder="如 16"
                    value={metric.max != null ? String(metric.max) : ""}
                    onChange={(e) => {
                      const text = e.currentTarget.value.trim();
                      patchMetric("max", text && NUM_RE.test(text) ? Number(text) : "");
                    }}
                  />
                </Field>
                <Field label="标签">
                  <Input
                    placeholder="如 实测续航"
                    value={metric.label || ""}
                    onInput={(e) => patchMetric("label", e.currentTarget.value.trim())}
                  />
                </Field>
              </FieldGrid>
              <Field label="说明 caption（可选）">
                <Input
                  placeholder="如 重度使用一天还有富余"
                  value={metric.caption || ""}
                  onInput={(e) => patchMetric("caption", e.currentTarget.value.trim())}
                />
              </Field>
              <label class="checkbox-row">
                <input
                  type="checkbox"
                  checked={metric.better === "low"}
                  onChange={(e) => patchMetric("better", e.currentTarget.checked ? "low" : false)}
                />
                <span>越低越好（如降噪 -45dB，用青绿强调）</span>
              </label>
            </Collapsible>
          ) : null}

          {scene ? (
            <Collapsible
              key={`${scene.id}-dataviz`}
              summary="数据图表（可选）· 条形对比 / 雷达 / 进度环"
              open={Boolean(scene.visual?.dataviz)}
            >
              <DatavizEditor
                key={scene.id}
                dataviz={scene.visual?.dataviz || null}
                onPatch={(viz) => patchScene(currentScene, { dataviz: viz })}
              />
            </Collapsible>
          ) : null}

          <div class="ce-actions">
            <Button size="sm" busy={busy} onClick={() => rewriteScene(currentScene)}>
              重写本镜
            </Button>
            <Button size="sm" onClick={() => listenScene(currentScene)}>
              试听配音
            </Button>
            <Button size="sm" variant="danger" onClick={() => deleteScene(currentScene)}>
              删除此镜头
            </Button>
          </div>

          {/* legacy renderClipEditor 仍写入隐藏节点 */}
          <div id="clipEditor" hidden aria-hidden="true" />
        </section>
      </div>
    </>
  );
}
