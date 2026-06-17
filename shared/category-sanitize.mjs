/**
 * 跨品类文案净化：避免手机测评分镜混入耳机/其他品类口播残留。
 */

/** @type {{ cat: string, kw: string[] }[]} */
export const CATEGORY_RULES = [
  { cat: "笔记本", kw: ["笔记本", "笔电", "macbook", "matebook", "redmibook", "magicbook", "thinkpad", "thinkbook", "拯救者", "游戏本", "轻薄本"] },
  { cat: "平板", kw: ["平板", "ipad", "matepad", "小米平板", "tablet"] },
  { cat: "显卡", kw: ["显卡", "rtx", "gtx", "geforce", "radeon", "4090", "4080", "4070", "4060"] },
  { cat: "显示器", kw: ["显示器", "显示屏", "monitor", "带鱼屏", "电竞屏"] },
  { cat: "智能穿戴", kw: ["手表", "watch", "手环", "穿戴", "smart band"] },
  { cat: "耳机", kw: ["耳机", "airpods", "earbuds", "freebuds", "freebud", "声阔", "soundcore", "漫步者", "edifier", "森海", "sennheiser", "降噪豆", "开放式", "入耳", "buds"] },
  { cat: "手机", kw: ["手机", "nova", "mate", "iphone", "苹果", "小米", "redmi", "红米", "oppo", "vivo", "荣耀", "honor", "三星", "galaxy", "pixel", "realme", "真我", "一加", "oneplus", "魅族", "reno", "find x"] }
];

const EARPHONE_COPY =
  /耳机|耳麦|降噪豆|入耳式|开放式耳机|airpods|freebuds|earbuds|buds|地铁杂音|开会混音|耳压|塞耳朵|佩戴感|隔音效果|听感|低频轰|漏音|通话降噪|豆状|头戴式/i;

const PHONE_COPY =
  /手机|屏幕|续航|快充|拍照|影像|信号|处理器|芯片|刷新率|直屏|曲屏|折叠|mate|nova|iphone|安卓/i;

/** @param {string} name */
export function inferCategory(name) {
  const lower = String(name || "").toLowerCase();
  if (!lower) return "";
  for (const rule of CATEGORY_RULES) {
    if (rule.kw.some((k) => lower.includes(k.toLowerCase()))) return rule.cat;
  }
  return "";
}

/**
 * 产品名推断品类与表单品类冲突（如 Nova16 + 耳机）。
 * @param {string} productName
 * @param {string} selectedCategory
 */
export function hasCategoryConflict(productName, selectedCategory) {
  const inferred = inferCategory(productName);
  if (!inferred || !selectedCategory) return false;
  return inferred !== selectedCategory;
}

/**
 * @param {string} text
 * @param {string} category
 */
export function isEarphoneCopy(text, category) {
  if (category === "耳机") return false;
  const s = String(text || "");
  if (!EARPHONE_COPY.test(s)) return false;
  if (category === "手机" && PHONE_COPY.test(s)) return false;
  return true;
}

/**
 * @param {string} role
 * @param {string} productName
 * @param {string} category
 */
function painVoiceover(productName, category) {
  const product = productName || "这款产品";
  const cat = category || "数码产品";
  if (cat === "手机") {
    return `很多人买手机都踩过坑：宣传页参数拉满，日常用起来却别扭。${product}是不是也这样？我替你扒清楚了。`;
  }
  return `买${cat}最怕什么？宣传吹上天，到手才发现不顺手。${product}到底行不行，往下看。`;
}

/**
 * @param {string} role
 * @param {string} productName
 * @param {string} category
 */
function twistVoiceover(productName, category) {
  const product = productName || "这款产品";
  if (category === "手机") {
    return `话说回来，${product}也有短板：不适合对影像或续航有极致要求、又不想妥协预算的人。不提前讲清楚，买了容易后悔。`;
  }
  if (category === "耳机") {
    return `话说回来，它也有短板：不适合追求极致降噪或听感调校的人。这点不提前讲清楚，买了容易后悔。`;
  }
  return `话说回来，${product}也有短板：别指望它在所有场景都完美。这点不提前讲清楚，买了容易后悔。`;
}

/**
 * @param {string} text
 */
function stripEarphonePhrases(text) {
  return String(text || "")
    .replace(/买耳机[^。！？?]*[。！？?]?/g, "")
    .replace(/耳机[^。！？?]{0,24}[。！？?]?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * @param {Record<string, unknown>} scene
 * @param {{ productName: string, category: string }} ctx
 */
function scrubScene(scene, ctx) {
  const { productName, category } = ctx;
  const title = String(scene.title || "");
  const role = /痛点/.test(title)
    ? "pain"
    : /反转|短板/.test(title)
      ? "twist"
      : /钩子/.test(title)
        ? "hook"
        : "other";

  const voiceover = String(scene.voiceover || scene.subtitle || "");
  const headline = String(scene.visual?.headline || "");
  const detail = String(scene.visual?.detail || "");
  const blob = `${voiceover}\n${headline}\n${detail}`;

  if (!isEarphoneCopy(blob, category)) return scene;

  const next = { ...scene, visual: { ...(scene.visual || {}) } };

  if (role === "pain") {
    const vo = painVoiceover(productName, category);
    next.voiceover = vo;
    next.subtitle = vo;
    next.visual.headline = headline && !isEarphoneCopy(headline, category) ? headline : "这说的就是你";
    next.visual.detail =
      detail && !isEarphoneCopy(detail, category) ? detail : "参数好看，到手才发现不顺手";
  } else if (role === "twist") {
    const vo = twistVoiceover(productName, category);
    next.voiceover = vo;
    next.subtitle = vo;
    if (isEarphoneCopy(detail, category)) {
      next.visual.detail = "短板提前说清楚";
    }
  } else {
    const cleaned = stripEarphonePhrases(voiceover);
    if (cleaned && cleaned.length >= 8) {
      next.voiceover = cleaned;
      next.subtitle = cleaned;
    }
    if (isEarphoneCopy(headline, category)) next.visual.headline = "核心观点";
    if (isEarphoneCopy(detail, category)) next.visual.detail = "根据产品事实生成";
  }

  const checks = Array.isArray(next.checks) ? [...next.checks] : [];
  if (!checks.includes("已净化跨品类残留文案")) checks.push("已净化跨品类残留文案");
  next.checks = checks;
  return next;
}

/**
 * @param {Record<string, unknown>[]} timeline
 * @param {{ productName?: string, category?: string }} input
 */
export function scrubTimelineCategoryMismatch(timeline, input) {
  const productName = String(input.productName || "").trim();
  let category = String(input.category || "").trim();
  if (!category) category = inferCategory(productName) || "数码产品";
  if (!Array.isArray(timeline)) return timeline;
  return timeline.map((scene) => scrubScene(scene, { productName, category }));
}

/**
 * 解析最终应使用的品类：产品名推断优先于冲突的表单值。
 * @param {string} productName
 * @param {string} selectedCategory
 * @param {boolean} categoryTouched
 */
export function resolveCategory(productName, selectedCategory, categoryTouched = false) {
  const inferred = inferCategory(productName);
  if (!inferred) return selectedCategory || "手机";
  if (!selectedCategory) return inferred;
  if (!categoryTouched && inferred !== selectedCategory) return inferred;
  if (categoryTouched && hasCategoryConflict(productName, selectedCategory)) return inferred;
  return selectedCategory;
}
