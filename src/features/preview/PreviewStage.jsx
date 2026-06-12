import { useMemo } from "preact/hooks";
import { useDirectorStore } from "../../store/useDirectorStore.js";
import { formatSceneTime } from "./preview-utils.js";
import DataVizCard from "./DataVizCard.jsx";
import StatRingCard from "./StatRingCard.jsx";
import ArenaPKCard from "./ArenaPKCard.jsx";
import ShootGuideHUDCard from "./ShootGuideHUDCard.jsx";
import { normalizeBattle } from "../../../shared/dataviz/geometry.mjs";
import { isArenaMode, normalizeShootGuide } from "../../../video-render/remotion/src/scene-model.mjs";
import "./transitions.css";

// P0 先支持两种转场；其余（glitch-cut 等）后续批次补
const PREVIEW_TRANSITIONS = new Set(["speed-line", "scan-wipe"]);

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
  const sceneKey = scene?.id || String(currentScene);
  const vtKind = PREVIEW_TRANSITIONS.has(visual.transition?.in) ? visual.transition.in : null;

  const platform = useDirectorStore((s) => s.platform);
  const formatKey = useMemo(() => {
    if (platform?.includes("16:9")) return "16:9";
    if (platform?.includes("1:1")) return "1:1";
    return "9:16";
  }, [platform]);

  // arena / 拍摄引导 与渲染端同一份判定与归一化（scene-model + geometry），保证预览=出片语义。
  const compareRaw = visual.compare || scene?.compare;
  const battle = useMemo(
    () => (isArenaMode(visual, compareRaw) ? normalizeBattle(compareRaw) : null),
    [visual, compareRaw]
  );
  const shootGuide = useMemo(
    () =>
      normalizeShootGuide(visual.shootGuide) ||
      (/拍摄引导/i.test(String(visual.type || ""))
        ? normalizeShootGuide({ title: visual.headline || "拍摄引导", tips: [visual.detail].filter(Boolean) })
        : null),
    [visual.shootGuide, visual.type, visual.headline, visual.detail]
  );

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

          {/* 渲染优先级与 Remotion ReviewVideo 对齐：擂台 → 拍摄引导 → StatRing → dataviz → 普通结论卡 */}
          {battle ? (
            <ArenaPKCard battle={battle} sceneKey={sceneKey} durationSec={scene?.duration || 4} formatKey={formatKey} />
          ) : shootGuide ? (
            <ShootGuideHUDCard guide={shootGuide} sceneKey={sceneKey} durationSec={scene?.duration || 4} formatKey={formatKey} />
          ) : visual.metric ? (
            <StatRingCard metric={visual.metric} radar={visual.radar} sceneKey={sceneKey} />
          ) : visual.dataviz ? (
            <DataVizCard dataviz={visual.dataviz} sceneKey={sceneKey} />
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

          {vtKind === "speed-line" ? (
            <div class="vt-layer vt-speed-line" key={`${sceneKey}-sl`} aria-hidden="true">
              <i /><i /><i /><i /><i /><i />
            </div>
          ) : null}
          {vtKind === "scan-wipe" ? (
            <div class="vt-layer vt-scan-wipe" key={`${sceneKey}-sw`} aria-hidden="true" />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
