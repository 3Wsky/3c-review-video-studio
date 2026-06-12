// 共享分镜模型（纯 JS，无 React、无 Node 专属 API）。
//
// 这一份是 Remotion 渲染内核 + 网页 <Player> 预览「共用」的真理来源：
// 把导演台的 Timeline JSON（{ project, insights, timeline[] }）归一化成一组分镜，
// 每镜带绝对起始时间、时长、文案、画面字段、横评对比矩阵等。
//
// 设计与 video-render/build.mjs（HyperFrames 那套）保持字段一致，这样两套渲染引擎
// 出来的画面语义对齐；区别只是 build.mjs 产出 HTML 字符串，这里产出可被 React 直接用的
// 普通对象（字幕高亮也改成 token 数组而非 HTML 字符串）。
//
// 确定性：不使用 Date.now()/Math.random()，相同输入产出相同结果。

import {
  normalizeDataviz,
  normalizeBattle,
  radarPoints,
  pointsToString,
  ringDash,
  countUpText,
} from "../../../shared/dataviz/geometry.mjs";

// 复用前端同一份数据可视化几何，供渲染端组件 import（单一来源，避免双份实现漂移）。
export { normalizeDataviz, normalizeBattle, radarPoints, pointsToString, ringDash, countUpText };

export const FPS = 30;

// 多端裁剪：同一 Timeline 渲不同画幅，与 build.mjs 的 FORMATS 对齐。
export const FORMATS = {
  "9:16": { w: 1080, h: 1920, cls: "fmt-9x16", resolution: "portrait" },
  "16:9": { w: 1920, h: 1080, cls: "fmt-16x9", resolution: "landscape" },
  "1:1": { w: 1080, h: 1080, cls: "fmt-1x1", resolution: "square" },
};

export const SUPPORTED_FORMATS = Object.keys(FORMATS);

export function resolveFormat(format) {
  return FORMATS[String(format || "9:16").trim()] || FORMATS["9:16"];
}

// 数值兜底：取正数，否则用默认值
function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// 解析数值（支持 "12 小时"/"3999元"/"210g" 抽出数字），失败返回 NaN。
function toNumber(value) {
  const m = /-?\d+(?:\.\d+)?/.exec(String(value == null ? "" : value));
  return m ? Number(m[0]) : NaN;
}

// 字幕里的「数字 + 单位」高亮：和 build.mjs 的 highlightNumbers 用同一套正则，
// 但这里返回 token 数组 [{ text, hl }]，交给 React 渲染受控的高亮 span（更安全，免 dangerouslySetInnerHTML）。
const HL_RE =
  /(\d+(?:\.\d+)?\s*(?:[%‰]|小时|分钟|天|年|倍|档位|档|元|块|千克|公斤|克|kg|g|mm|cm|英寸|寸|mAh|W|GB|TB|MP|Hz|fps|nit|尼特)?)/g;

export function highlightTokens(text) {
  const str = String(text == null ? "" : text);
  if (!str) return [];
  const tokens = [];
  let last = 0;
  let m;
  HL_RE.lastIndex = 0;
  while ((m = HL_RE.exec(str)) !== null) {
    // 跳过空匹配，避免死循环
    if (m.index === HL_RE.lastIndex) {
      HL_RE.lastIndex++;
      continue;
    }
    if (m.index > last) tokens.push({ text: str.slice(last, m.index), hl: false });
    tokens.push({ text: m[0], hl: true });
    last = m.index + m[0].length;
  }
  if (last < str.length) tokens.push({ text: str.slice(last), hl: false });
  return tokens;
}

// 归一化横评对比数据，并按 better(high/low) 算出每行胜者列下标（并列/无效 → -1）。
// 与 build.mjs 的 normalizeCompare 完全一致。
export function normalizeCompare(raw) {
  if (!raw || !Array.isArray(raw.products) || !Array.isArray(raw.rows)) return null;
  const products = raw.products.map((p) => String(p == null ? "" : p).trim()).filter(Boolean);
  if (products.length < 2) return null;
  const rows = raw.rows
    .map((row) => {
      const values = (Array.isArray(row?.values) ? row.values : []).slice(0, products.length);
      const better = row?.better === "low" ? "low" : "high";
      const nums = values.map(toNumber);
      let winner = -1;
      let bestVal = better === "low" ? Infinity : -Infinity;
      let tie = false;
      nums.forEach((n, idx) => {
        if (!Number.isFinite(n)) return;
        if ((better === "low" && n < bestVal) || (better === "high" && n > bestVal)) {
          bestVal = n;
          winner = idx;
          tie = false;
        } else if (n === bestVal) {
          tie = true;
        }
      });
      if (tie) winner = -1;
      return {
        label: String(row?.label || "").trim(),
        unit: String(row?.unit || "").trim(),
        better,
        values: values.map((v) => String(v == null ? "" : v).trim()),
        // 解析出的数值（非数字 → null），供渲染层做条形增长/数字滚动等数据可视化动效。
        nums: nums.map((n) => (Number.isFinite(n) ? n : null)),
        winner,
      };
    })
    .filter((r) => r.label && r.values.length === products.length);
  if (rows.length === 0) return null;
  const tally = new Array(products.length).fill(0);
  rows.forEach((r) => {
    if (r.winner >= 0) tally[r.winner] += 1;
  });
  let pick = 0;
  let pickTie = false;
  tally.forEach((c, idx) => {
    if (c > tally[pick]) {
      pick = idx;
      pickTie = false;
    } else if (idx !== pick && c === tally[pick]) {
      pickTie = true;
    }
  });
  return { products, rows, verdict: pickTie ? -1 : pick, tally };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// 数字滚动：把字符串里第一个数值从 0 缓动到目标（保留前后缀、单位与小数位）。
// target 为 null 时自动取字符串里的数为目标；p>=1 直接还原原串（避免浮点/单位误差）；
// 无数字或目标非数 → 原样返回。渲染内核与网页预览共用，CompareMatrix / 数卡 / 标题滚动都走这。
export function formatCountUp(rawStr, target, p) {
  const str = String(rawStr == null ? "" : rawStr);
  const m = /-?\d+(?:\.\d+)?/.exec(str);
  if (!m) return str;
  const tgt = target == null ? Number(m[0]) : Number(target);
  if (!Number.isFinite(tgt)) return str;
  if (p >= 1) return str;
  const decimals = (m[0].split(".")[1] || "").length;
  const shown = (tgt * Math.max(0, Math.min(1, p))).toFixed(decimals);
  return str.slice(0, m.index) + shown + str.slice(m.index + m[0].length);
}

// 数卡/单指标镜的结构化数据（visual.metric）→ 渲染层据此做「数字滚动 + 进度环」入场动效。
// 形如 { value, unit, label, caption, max, min, better }；value 必须可解析为数值，否则返回 null。
// 给了 max(>min) 时进度环按 (value-min)/(max-min) 占比填充（frac）；缺省则 frac=null，
// 环退化为「入场扫满一圈」的装饰（仍配数字滚动）。better 仅用于强调色语义，不改占比。
export function normalizeMetric(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = toNumber(raw.value);
  if (!Number.isFinite(value)) return null;
  const valueText = String(raw.value == null ? value : raw.value).trim() || String(value);
  const minRaw = toNumber(raw.min);
  const min = Number.isFinite(minRaw) ? minRaw : 0;
  const maxRaw = toNumber(raw.max);
  const hasMax = Number.isFinite(maxRaw) && maxRaw > min;
  const frac = hasMax ? Math.max(0, Math.min(1, (value - min) / (maxRaw - min))) : null;
  return {
    value,
    valueText,
    unit: String(raw.unit || "").trim(),
    label: String(raw.label || "").trim(),
    caption: String(raw.caption || "").trim(),
    min,
    max: hasMax ? maxRaw : null,
    better: raw.better === "low" ? "low" : "high",
    frac,
  };
}

// 进度环/条入场占比：随入场进度 p 从 0 长到目标占比；无 max（frac=null）时退化为装饰性满环。
export function metricRingFraction(metric, p) {
  if (!metric) return 0;
  const target = metric.frac == null ? 1 : metric.frac;
  return Math.max(0, Math.min(1, target * Math.max(0, Math.min(1, p))));
}

// 镜头转场（visual.transition）：in/out 必须来自转场库枚举，无效值丢弃；两者皆空 → null。
export const TRANSITION_KINDS = [
  "glitch-cut",
  "speed-line",
  "scan-wipe",
  "pixel-dissolve",
  "screen-crack",
  "iris-close",
];

export function normalizeTransition(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const tin = TRANSITION_KINDS.includes(raw.in) ? raw.in : null;
  const tout = TRANSITION_KINDS.includes(raw.out) ? raw.out : null;
  return tin || tout ? { in: tin, out: tout } : null;
}

// 雷达/属性维度（visual.radar = { dims: [{label,value,max}] }）：
// 至少 3 维有效才成立；frac 分母 = item.max → 全体峰值（兜底 1）。
// Stat Ring 四角节点与 P2 雷达 HUD 共用这一份。
export function normalizeRadar(raw) {
  if (!raw || !Array.isArray(raw.dims)) return null;
  const dims = raw.dims
    .map((d) => {
      const label = String(d?.label || "").trim();
      const value = toNumber(d?.value);
      if (!label || !Number.isFinite(value)) return null;
      const max = toNumber(d?.max);
      return { label, value, max: Number.isFinite(max) && max > 0 ? max : null };
    })
    .filter(Boolean)
    .slice(0, 6);
  if (dims.length < 3) return null;
  const peak = dims.reduce((m, d) => Math.max(m, d.max || Math.abs(d.value)), 0) || 1;
  return {
    dims: dims.map((d) => ({
      ...d,
      frac: Math.max(0, Math.min(1, d.value / (d.max || peak))),
    })),
  };
}

// 归一化「逐词对齐」时间戳：whisper 转写得到的 token 级 [{ fromMs, toMs }]（相对该镜起点）。
// 只保留有效区间并按 fromMs 排序；无有效项返回 null（上层回退到线性匀速点亮）。
export function normalizeCaptions(raw) {
  if (!Array.isArray(raw)) return null;
  const caps = raw
    .map((c) => ({ fromMs: Number(c?.fromMs), toMs: Number(c?.toMs) }))
    .filter((c) => Number.isFinite(c.fromMs) && Number.isFinite(c.toMs) && c.toMs >= c.fromMs)
    .sort((a, b) => a.fromMs - b.fromMs);
  return caps.length ? caps : null;
}

const SHOOT_VARIANTS = ["product_macro", "hand_hold", "comparison", "talking_head"];

function clamp01(n, fallback) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

// 拍摄引导 HUD（visual.shootGuide）：取景框 + checklist + 步骤进度。
export function normalizeShootGuide(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const title = String(raw.title || "").trim();
  const steps = (Array.isArray(raw.steps) ? raw.steps : Array.isArray(raw.tips) ? raw.tips : [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!title && steps.length === 0) return null;
  const variant = SHOOT_VARIANTS.includes(raw.variant) ? raw.variant : "product_macro";
  const frame =
    raw.frame && typeof raw.frame === "object"
      ? {
          x: clamp01(raw.frame.x, 0.12),
          y: clamp01(raw.frame.y, 0.18),
          w: clamp01(raw.frame.w, 0.76),
          h: clamp01(raw.frame.h, 0.52),
        }
      : { x: 0.12, y: 0.18, w: 0.76, h: 0.52 };
  return {
    variant,
    title: title || "拍摄引导",
    steps,
    angle: String(raw.angle || "").trim(),
    safeArea: String(raw.safeArea || "").trim(),
    demoAsset: String(raw.demoAsset || "").trim(),
    frame,
  };
}

// 擂台模式判定（visual.type 含「擂台/arena/pk」或 compare.style==='arena'）。
// 导出供前端预览 PreviewStage 复用，保证预览端与渲染端 arena/普通横评的分流一致。
export function isArenaMode(visual, compareRaw) {
  const type = String(visual?.type || "");
  if (/擂台|arena|pk/i.test(type)) return true;
  return compareRaw?.style === "arena";
}

// 卡拉OK进度：给定 token 时间戳与当前时刻 tMs，返回「已念完的比例」∈[0,1]。
// 每个 token 等权（只取节奏，不看文字——whisper 中文 token 常是字节碎片）：
// 已过 toMs 记 1，正处于 [fromMs,toMs) 按时间线性插值，停顿（gap）期间保持不前进。
export function karaokeFraction(captions, tMs) {
  if (!Array.isArray(captions) || captions.length === 0) return null;
  const total = captions.length;
  let done = 0;
  for (const c of captions) {
    if (tMs >= c.toMs) {
      done += 1;
    } else if (tMs > c.fromMs) {
      done += (tMs - c.fromMs) / Math.max(1, c.toMs - c.fromMs);
      break;
    } else {
      break; // tMs <= fromMs：还没念到这个 token，保持当前进度
    }
  }
  return Math.max(0, Math.min(1, done / total));
}

// ---------- 核心：把 Timeline 归一化成分镜数组 ----------
//
// 返回 { scenes, totalSeconds }，每镜：
//   { id, index, start, duration, badge, headline, detail, subtitle,
//     asset, cite, stock, compare }
// 与 build.mjs.normalizeScenes 字段一致；asset 这里保留「原始素材名」，
// 真正的图片 URL 由调用方（render.mjs / player）通过 assetMap 解析。
export function normalizeScenes(timeline) {
  const scenes = Array.isArray(timeline?.timeline) ? timeline.timeline : [];
  let cursor = 0;
  return scenes.map((scene, i) => {
    const duration = num(scene?.duration ?? num(scene?.end, 0) - num(scene?.start, 0), 4);
    const start = cursor;
    cursor += duration;
    const visual = scene?.visual || {};
    const compareRaw = visual.compare || scene?.compare;
    const arena = isArenaMode(visual, compareRaw);
    const battle = arena ? normalizeBattle(compareRaw) : null;
    const shootGuide =
      normalizeShootGuide(visual.shootGuide) ||
      (/拍摄引导/i.test(String(visual.type || ""))
        ? normalizeShootGuide({ title: visual.headline || "拍摄引导", tips: [visual.detail].filter(Boolean) })
        : null);
    return {
      id: `scene-${i + 1}`,
      index: i + 1,
      start: round(start),
      duration: round(duration),
      badge: String(scene?.title || "").trim(),
      headline: String(visual.headline || "").trim(),
      detail: String(visual.detail || "").trim(),
      subtitle: String(scene?.subtitle || scene?.voiceover || "").trim(),
      asset: String(visual.asset || "").trim() || null,
      cite: String(visual.cite || scene?.cite || "").trim(),
      stock: visual.assetSource === "stock",
      compare: battle ? null : normalizeCompare(compareRaw),
      battle,
      shootGuide,
      // 数卡/单指标镜的进度环数据（visual.metric）；无则不渲染数据卡。
      metric: normalizeMetric(visual.metric || scene?.metric),
      // 数据可视化参数卡（visual.dataviz：bar/radar/ring），与前端 DataVizCard 共用同一几何。
      dataviz: normalizeDataviz(visual.dataviz || scene?.dataviz),
      // 属性维度（Stat Ring 四角节点 / P2 雷达 HUD）。
      radar: normalizeRadar(visual.radar),
      // 镜头转场（P0：speed-line / scan-wipe）。
      transition: normalizeTransition(visual.transition),
      // 逐词对齐时间戳（worker 用 whisper 转写配音后写回）；无则字幕回退线性点亮。
      captions: normalizeCaptions(scene?.captions),
    };
  });
}

// 给定 Timeline + 画幅 → Remotion 合成所需的全部参数。
// fps 固定 30；总帧数 = 各镜时长之和 * fps（至少 1 帧）。
export function buildComposition(timeline, format) {
  const fmt = resolveFormat(format);
  const scenes = normalizeScenes(timeline);
  const totalSeconds = round(scenes.reduce((sum, s) => sum + s.duration, 0));
  const durationInFrames = Math.max(1, Math.round(totalSeconds * FPS));
  return {
    fps: FPS,
    width: fmt.w,
    height: fmt.h,
    format: fmt,
    scenes,
    totalSeconds,
    durationInFrames,
    product: String(timeline?.project?.product || "产品测评").trim() || "产品测评",
  };
}
