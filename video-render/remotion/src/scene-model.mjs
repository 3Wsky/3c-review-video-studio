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
      compare: normalizeCompare(visual.compare || scene?.compare),
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
