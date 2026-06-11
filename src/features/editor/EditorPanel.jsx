import { useMemo } from "preact/hooks";
import {
  TimelineTrack,
  Inspector,
  Button,
  Field,
  Input,
  FieldGrid,
  Collapsible
} from "../../components/ui/index.js";
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

const NUM_RE = /-?\d+(?:\.\d+)?/;

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
        <aside class="preview-col">
          {/* 预览舞台由 legacy renderPreview 驱动（静态壳，勿加动态内容） */}
          <div class="scene-nav">
            <button class="square-button" id="prevSceneBtn" type="button" title="上一镜">
              <i data-lucide="chevron-left" />
            </button>
            <span id="sceneIndicator">1 / 6</span>
            <button class="square-button" id="nextSceneBtn" type="button" title="下一镜">
              <i data-lucide="chevron-right" />
            </button>
          </div>
          <div class="phone-frame">
            <div class="video-stage" id="videoStage">
              <div class="stage-topline">
                <span id="stageProduct">3C 产品</span>
                <span id="stageTime">00:00</span>
              </div>
              <div class="product-visual" id="productVisual">
                <div class="device-placeholder">
                  <span />
                </div>
              </div>
              <div class="host-slot center" id="hostSlot">
                <div class="host-head" />
                <div class="host-body" />
              </div>
              <div class="info-card" id="infoCard">
                <small id="visualType">结论</small>
                <strong id="visualHeadline">先看结论</strong>
                <span id="visualDetail">最大优点与最大限制</span>
              </div>
              <div class="subtitle-bar" id="subtitleBar" />
            </div>
          </div>
        </aside>

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
