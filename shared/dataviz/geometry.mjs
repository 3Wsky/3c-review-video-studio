// 数据可视化参数卡（visual.dataviz）共享几何与归一化。
//
// 纯函数、确定性（无 Date.now/Math.random），前端 Preact 预览与渲染端模板共用，
// 设计与 video-render/remotion/src/scene-model.mjs 的 normalizeMetric/normalizeCompare 一致。
//
// 数据形：visual.dataviz = {
//   kind: "bar" | "radar" | "ring",
//   title?: "实测续航",
//   unit?: "小时",
//   better?: "high" | "low",        // 仅强调色语义（low 用青绿，如降噪/重量）
//   max?: 16,                        // 共用上限（可选；item.max 优先）
//   items: [{ label, value, max? }]  // bar/ring 至少 2 条、radar 至少 3 条，最多 6 条
// }

const NUM_RE = /-?\d+(?:\.\d+)?/;

export const DATAVIZ_KINDS = ["bar", "radar", "ring"];

function toNumber(value) {
  const m = NUM_RE.exec(String(value == null ? "" : value));
  return m ? Number(m[0]) : NaN;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// 数值显示：去浮点尾巴（12.50 → "12.5"，12 → "12"）
function formatValue(n) {
  return String(round2(n));
}

// 校验并裁剪成可写回 Timeline JSON 的最小形；不合法返回 null。
// LLM 输出与编辑器手填都先过这一层，保证存储形状统一。
export function sanitizeDataviz(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const kind = DATAVIZ_KINDS.includes(raw.kind) ? raw.kind : null;
  if (!kind) return null;
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((item) => {
      const label = String(item?.label || "").trim();
      const value = toNumber(item?.value);
      if (!label || !Number.isFinite(value)) return null;
      const max = toNumber(item?.max);
      return { label, value, ...(Number.isFinite(max) && max > 0 ? { max } : {}) };
    })
    .filter(Boolean)
    .slice(0, 6);
  if (items.length < (kind === "radar" ? 3 : 2)) return null;
  const max = toNumber(raw.max);
  return {
    kind,
    title: String(raw.title || "").trim(),
    unit: String(raw.unit || "").trim(),
    better: raw.better === "low" ? "low" : "high",
    ...(Number.isFinite(max) && max > 0 ? { max } : {}),
    items
  };
}

// 渲染态：每项算出 frac ∈ [0,1]（条长 / 环占比 / 雷达半径占比）。
// 占比分母取 item.max → viz.max → items 内最大值（兜底 1，避免除零）。
export function normalizeDataviz(raw) {
  const viz = sanitizeDataviz(raw);
  if (!viz) return null;
  const peak = viz.items.reduce((m, item) => Math.max(m, Math.abs(item.value)), 0) || 1;
  const items = viz.items.map((item) => {
    const denom = item.max || viz.max || peak;
    return {
      ...item,
      valueText: formatValue(item.value),
      frac: clamp01(denom > 0 ? item.value / denom : 0)
    };
  });
  return { ...viz, items };
}

// 数字滚动：入场进度 p ∈ [0,1] → 显示值文本（保留目标值的小数位）。
export function countUpText(value, p) {
  const text = formatValue(value);
  if (p >= 1) return text;
  const decimals = (text.split(".")[1] || "").length;
  return (value * clamp01(p)).toFixed(decimals);
}

// ---------- 雷达图几何 ----------

// N 维顶点（从正上方起顺时针）。fracs 缺省 = 1（外圈轴线）；传入则按占比缩半径。
export function radarPoints(count, cx, cy, r, fracs) {
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const k = fracs ? clamp01(fracs[i] == null ? 0 : fracs[i]) : 1;
    pts.push({
      x: round2(cx + Math.cos(angle) * r * k),
      y: round2(cy + Math.sin(angle) * r * k)
    });
  }
  return pts;
}

// SVG polygon points 属性串
export function pointsToString(points) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

// ---------- 进度环几何 ----------

// frac ∈ [0,1] → SVG stroke-dasharray 参数（配 rotate(-90) 从顶部起画）
export function ringDash(frac, radius) {
  const circumference = round2(2 * Math.PI * radius);
  return {
    circumference,
    dash: round2(clamp01(frac) * circumference)
  };
}
