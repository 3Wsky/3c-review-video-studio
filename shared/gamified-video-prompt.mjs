/**
 * 将游戏化 visual 字段转为 videoPrompt / Agnes brief 可读的特效描述
 */

/**
 * @param {Record<string, unknown>} visual
 */
export function describeGamifiedEffects(visual) {
  if (!visual || typeof visual !== "object") return "";

  const parts = [];

  const type = String(visual.type || "");
  const compare = visual.compare;
  if (compare || /擂台|PK|对决/i.test(type)) {
    parts.push(
      "游戏风擂台PK HUD：双侧产品血条对撞、中央VS脉冲环、优势数字弹出、赛博霓虹边框"
    );
  }

  if (visual.shootGuide || /拍摄引导/i.test(type)) {
    parts.push(
      "游戏风拍摄引导HUD：四角瞄准框、中央取景虚线、左侧参数标签、右侧检查清单"
    );
  }

  if (visual.metric) {
    parts.push(
      "游戏风属性觉醒环：中心数值滚动、环形经验条充能、四角技能节点依次点亮"
    );
  }

  if (visual.radar && !visual.metric) {
    parts.push("五维雷达扫描HUD：霓虹网格、扫描线旋转、顶点锁定发光");
  }

  if (visual.dataviz) {
    const kind = visual.dataviz?.kind || "chart";
    if (kind === "bar") parts.push("动态条形数据图表从底部增长");
    else if (kind === "ring") parts.push("环形进度数据图表充能填充");
    else if (kind === "radar") parts.push("雷达图数据维度依次闭合");
    else parts.push("游戏风数据图表动画");
  }

  const tin = visual.transition?.in;
  const transitionMap = {
    "speed-line": "速度线疾速入场转场",
    "scan-wipe": "青色扫描光带划屏转场",
    "glitch-cut": "故障风RGB分离闪切",
    "pixel-dissolve": "像素方块溶解过渡",
    "screen-crack": "屏幕碎裂裂纹扩散",
    "iris-close": "光圈收束转场"
  };
  if (tin && transitionMap[tin]) {
    parts.push(transitionMap[tin]);
  }

  return parts.join("；");
}

/**
 * 合并基础画面描述与游戏化特效（用于 videoPrompt / Agnes brief）
 * @param {string} basePrompt
 * @param {Record<string, unknown>} visual
 */
export function mergeVideoPromptWithEffects(basePrompt, visual) {
  const base = String(basePrompt || "").trim();
  const fx = describeGamifiedEffects(visual);
  if (!fx) return base;
  if (base.includes("擂台") || base.includes("HUD") || base.includes("雷达")) return base;
  const merged = base ? `${base}。画面叠加游戏特效：${fx}` : `游戏化测评画面，${fx}`;
  return merged.slice(0, 500);
}

/**
 * @param {Record<string, unknown>} visual
 */
export function shouldHidePreactGameOverlays(visual) {
  const broll = visual?.broll;
  return (
    broll?.source === "agnes" &&
    broll?.status === "completed" &&
    typeof broll?.videoUrl === "string" &&
    broll.videoUrl.length > 8
  );
}
