import { useMemo } from "preact/hooks";
import { useDirectorStore } from "../../store/useDirectorStore.js";
import { formatSceneTime } from "./preview-utils.js";
import DataVizCard from "./DataVizCard.jsx";

export default function PreviewStage() {
  const timeline = useDirectorStore((s) => s.timeline);
  const currentScene = useDirectorStore((s) => s.currentScene);
  const assets = useDirectorStore((s) => s.assets);
  const layout = useDirectorStore((s) => s.layout);

  const scenes = timeline?.timeline || [];
  const scene = scenes[currentScene] || scenes[0] || null;
  const product = timeline?.project?.product || "3C 产品";

  const asset = useMemo(() => {
    if (!assets.length) return null;
    return assets[currentScene % assets.length];
  }, [assets, currentScene]);

  const visual = scene?.visual || {};
  const sceneLabel = scene ? `${scene.index} / ${scenes.length}` : `1 / ${Math.max(scenes.length, 1)}`;

  return (
    <aside class="preview-col">
      <div class="scene-nav">
        <button class="square-button" id="prevSceneBtn" type="button" title="上一镜">
          <i data-lucide="chevron-left" />
        </button>
        <span id="sceneIndicator">{sceneLabel}</span>
        <button class="square-button" id="nextSceneBtn" type="button" title="下一镜">
          <i data-lucide="chevron-right" />
        </button>
      </div>

      <div class="phone-frame">
        <div class="video-stage" id="videoStage" data-preact-preview>
          <div class="stage-topline">
            <span id="stageProduct">{product}</span>
            <span id="stageTime">{scene ? formatSceneTime(scene.start) : "00:00"}</span>
          </div>

          <div
            class={`product-visual${asset?.cutout ? " is-cutout" : ""}`}
            id="productVisual"
          >
            {asset?.type?.startsWith("image/") ? (
              <img src={asset.url} alt={asset.name || "产品素材"} />
            ) : (
              <div class="device-placeholder">
                <span />
              </div>
            )}
          </div>

          <div class={`host-slot ${layout}`} id="hostSlot">
            <div class="host-head" />
            <div class="host-body" />
          </div>

          {visual.dataviz ? (
            <DataVizCard dataviz={visual.dataviz} sceneKey={scene?.id || currentScene} />
          ) : (
            <div class="info-card" id="infoCard">
              <small id="visualType">{visual.type || "结论"}</small>
              <strong id="visualHeadline">{visual.headline || "先看结论"}</strong>
              <span id="visualDetail">{visual.detail || "最大优点与最大限制"}</span>
            </div>
          )}

          <div class="subtitle-bar" id="subtitleBar">
            {scene?.subtitle || ""}
          </div>
        </div>
      </div>
    </aside>
  );
}
