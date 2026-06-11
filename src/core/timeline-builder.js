import { compressPoint, estimateDuration, pickByKeywords, splitLines } from "./text-utils.js";

/**
 * @typedef {Object} FormInput
 * @property {string} productName
 * @property {string} category
 * @property {string} platform
 * @property {number} targetDuration
 * @property {string} layout
 * @property {string} reviewText
 * @property {string} factsText
 * @property {{ name: string, type: string }[]} assets
 */

/**
 * @param {string} reviewText
 * @param {string} factsText
 */
export function extractInsights(reviewText, factsText) {
  const reviewLines = splitLines(reviewText);
  const factLines = splitLines(factsText);
  const lines = [...reviewLines, ...factLines];
  const comfort = compressPoint(pickByKeywords(lines, ["舒服", "轻", "压迫", "佩戴", "不堵"], 0));
  const weakness = compressPoint(pickByKeywords(lines, ["缺点", "但是", "不过", "一般", "噪音", "低频", "限制"], 1));
  const stability = compressPoint(pickByKeywords(lines, ["稳定", "不容易掉", "晃", "运动"], 2));
  const audience = compressPoint(pickByKeywords(lines, ["适合", "人群", "通勤", "办公", "目标"], 3));

  return {
    reviewLines,
    factLines,
    sourceCount: reviewLines.length,
    comfort,
    weakness,
    stability,
    audience
  };
}

/**
 * @param {FormInput} input
 */
export function buildScenes(input) {
  const product = input.productName.trim() || "这款产品";
  const category = input.category;
  const insights = extractInsights(input.reviewText, input.factsText);

  const scenes = [
    {
      title: "前5秒·钩子",
      visualType: "真人口播 + 大字幕",
      headline: "别急着划走",
      detail: "一句话钩住，5 秒内留住人",
      voiceover: `先别划走——${product}到底值不值得买，看完这条不踩坑。`,
      source: "钩子·留人"
    },
    {
      title: "痛点共鸣",
      visualType: "痛点字幕卡",
      headline: "这说的就是你",
      detail: insights.weakness || "参数好看，到手才发现不好用",
      voiceover: `买${category}最怕什么？参数吹上天，到手才发现日常根本不顺手。${product}是不是也这样，我替你扒清楚了。`,
      source: "情绪曲线·共鸣"
    },
    {
      title: "悬念展开",
      visualType: "知乎观点摘要",
      headline: "关键不在宣传页",
      detail: insights.comfort || "真正决定体验的是日常细节",
      voiceover: `先抛个问题：${product}最该看的，不是写在宣传页上的卖点，而是${insights.comfort || "长期用下来的真实体验"}。往下看你就懂了。`,
      source: "情绪曲线·悬念"
    },
    {
      title: "高潮·揭晓",
      visualType: "价值高光卡",
      headline: "最大价值在这",
      detail: insights.comfort || "真实好评最集中的点",
      voiceover: `真正打动人的，是${insights.comfort || "它在日常场景里的省心"}。从真实评测看，用户夸得最多的就是这一点——这才是它的最大价值。但先别急着下单。`,
      source: "情绪曲线·高潮"
    },
    {
      title: "反转·短板",
      visualType: "优缺点对照",
      headline: "短板提前说",
      detail: insights.weakness || "不适合追求极致的那部分人",
      voiceover: `话说回来，它也有短板：${insights.weakness || "不适合追求极致性能或隔音的人"}。这点不提前讲清楚，买了容易后悔。`,
      source: "情绪曲线·反转"
    },
    {
      title: "结尾·结论+互动",
      visualType: "结论卡 + 引导关注",
      headline: "买不买看这句",
      detail: "给结论 + 引导互动",
      voiceover: `所以结论很简单：要的是${insights.audience || "日常稳定好用"}，它值得入手；另有所求就再等等。觉得有用点个关注，评论区告诉我下一个想看谁。`,
      source: "情绪曲线·收尾"
    }
  ];

  return { scenes, insights };
}

/**
 * @param {FormInput} input
 */
export function buildTimeline(input) {
  const { scenes, insights } = buildScenes(input);
  const target = Number(input.targetDuration) || 90;
  const hookDuration = scenes.length > 1 ? Math.min(5, Math.max(3, target * 0.06)) : target;
  const restTarget = Math.max(0, target - hookDuration);
  const restRaw = scenes.slice(1).map((scene) => estimateDuration(scene.voiceover));
  const totalRestRaw = restRaw.reduce((sum, item) => sum + item, 0) || 1;
  let cursor = 0;

  const timeline = scenes.map((scene, index) => {
    const duration =
      index === 0 ? hookDuration : Math.max(5, (restRaw[index - 1] / totalRestRaw) * restTarget);
    const start = cursor;
    const end = index === scenes.length - 1 ? target : start + duration;
    cursor = end;
    return {
      id: `scene_${String(index + 1).padStart(2, "0")}`,
      index: index + 1,
      title: scene.title,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2)),
      voiceover: scene.voiceover,
      subtitle: scene.voiceover,
      visual: {
        type: scene.visualType,
        layout: input.layout,
        headline: scene.headline,
        detail: scene.detail,
        asset: input.assets[index % Math.max(input.assets.length, 1)]?.name || "uploaded_product_asset"
      },
      checks: ["事实来自输入材料", "避免长句照搬", "保留人工复核位"],
      source: scene.source
    };
  });

  return {
    project: {
      product: input.productName.trim(),
      category: input.category,
      platform: input.platform,
      targetDuration: target,
      layout: input.layout
    },
    insights,
    timeline
  };
}

/**
 * @param {FormInput} input
 */
export function buildApiPayload(input) {
  return {
    productName: input.productName.trim(),
    category: input.category,
    targetDuration: Number(input.targetDuration) || 90,
    platform: input.platform,
    layout: input.layout,
    facts: input.factsText,
    reviews: input.reviewText,
    assets: input.assets.map((asset) => ({
      name: asset.name,
      type: asset.type
    }))
  };
}
