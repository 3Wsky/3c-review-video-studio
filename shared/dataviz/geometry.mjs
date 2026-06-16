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

// ---------- 雷达 HUD 五维扫描几何（P2）----------
//
// 360° 扫描线掠过 → 顶点被「扫到」即锁定（lock-on），值多边形随锁定的顶点逐个展开。
// 纯函数：给定入场进度 p ∈ [0,1] 与顶点数，算出扫描角与每个顶点的锁定进度。
// 渲染端（Remotion 帧插值）与前端预览（rAF）共用，保证扫描节奏一致。
//
// 约定：顶点 i 的「应被扫到」角度 = i / count（0=正上方，顺时针）。扫描进度 sweep ∈ [0,1]
// 表示扫描线已转过的整圈比例（>1 表示多扫了一些，便于最后一个顶点也锁定）。
// 顶点锁定进度 = clamp01((sweep - i/count) / lockSpan)，lockSpan 控制单点点亮快慢。

export function radarSweepAngle(p) {
  // 入场 0→1 内扫 ~1.15 圈（多一点确保末顶点锁定），缓出。
  return clamp01(p) * 1.15;
}

// 每个顶点的锁定进度数组（0=未锁定，1=完全点亮）。
export function radarLockFractions(count, p, lockSpan = 0.14) {
  const sweep = radarSweepAngle(p);
  const span = lockSpan > 0 ? lockSpan : 0.14;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(clamp01((sweep - i / count) / span));
  }
  return out;
}

// 值多边形顶点：半径 = 数据占比 frac × 该顶点锁定进度（未锁定的顶点缩回圆心，逐个弹出）。
export function radarValuePoints(count, cx, cy, r, fracs, locks) {
  const scaled = [];
  for (let i = 0; i < count; i += 1) {
    const f = fracs && fracs[i] != null ? fracs[i] : 0;
    const lk = locks && locks[i] != null ? locks[i] : 1;
    scaled.push(f * lk);
  }
  return radarPoints(count, cx, cy, r, scaled);
}

// 扫描线端点（从圆心指向当前扫描角，超过 1 圈后停在最后一个顶点方向收尾）。
export function radarSweepEndpoint(cx, cy, r, p) {
  const sweep = radarSweepAngle(p);
  // 扫描角折算成弧度（-90° 起，顺时针），sweep>1 时停在末端不再回绕。
  const turns = Math.min(sweep, 1);
  const angle = -Math.PI / 2 + turns * 2 * Math.PI;
  return {
    x: round2(cx + Math.cos(angle) * r),
    y: round2(cy + Math.sin(angle) * r),
    angleDeg: round2(turns * 360),
    done: sweep >= 1,
  };
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

// ---------- 游戏化扩展（fullspec v1）----------

// 单指标数据卡 visual.metric → 渲染态（与 remotion/scene-model.mjs 的 normalizeMetric 语义对齐）。
// value 解析不出数 → null；给了 max(>min) 时 frac=(value-min)/(max-min)，否则 frac=null（装饰性满环）。
export function normalizeMetric(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = toNumber(raw.value);
  if (!Number.isFinite(value)) return null;
  const valueText = String(raw.value == null ? value : raw.value).trim() || String(value);
  const minRaw = toNumber(raw.min);
  const min = Number.isFinite(minRaw) ? minRaw : 0;
  const maxRaw = toNumber(raw.max);
  const hasMax = Number.isFinite(maxRaw) && maxRaw > min;
  return {
    value,
    valueText,
    unit: String(raw.unit || "").trim(),
    label: String(raw.label || "").trim(),
    caption: String(raw.caption || "").trim(),
    min,
    max: hasMax ? maxRaw : null,
    better: raw.better === "low" ? "low" : "high",
    frac: hasMax ? clamp01((value - min) / (maxRaw - min)) : null
  };
}

// 雷达扫描 HUD 的 spec 形 visual.radar = { dims: [{label,value,max}] }
// → 适配成 dataviz 渲染态（kind:'radar'），复用同一套雷达几何与组件。
export function radarFromSpec(raw) {
  if (!raw || !Array.isArray(raw.dims)) return null;
  return normalizeDataviz({ kind: "radar", items: raw.dims });
}

// Stat Ring 属性节点：N 等分圆周顶点，默认从 -45°（右上角）起顺时针，
// 四节点时正好落在四角。返回 [{x,y,angle(deg)}]。
export function ringNodePoints(count, cx, cy, r, startDeg = -45) {
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    const deg = startDeg + (i * 360) / count;
    const rad = ((deg - 90) * Math.PI) / 180;
    pts.push({
      x: round2(cx + Math.cos(rad) * r),
      y: round2(cy + Math.sin(rad) * r),
      angle: round2(deg)
    });
  }
  return pts;
}

// 镜头转场（visual.transition）存储形校验：in/out 必须来自转场库，两者皆无 → null。
export const TRANSITION_KINDS = [
  "glitch-cut",
  "speed-line",
  "scan-wipe",
  "pixel-dissolve",
  "screen-crack",
  "iris-close"
];

export function sanitizeTransition(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const tin = TRANSITION_KINDS.includes(raw.in) ? raw.in : null;
  const tout = TRANSITION_KINDS.includes(raw.out) ? raw.out : null;
  if (!tin && !tout) return null;
  return { ...(tin ? { in: tin } : {}), ...(tout ? { out: tout } : {}) };
}

// 单指标卡（visual.metric）存储形校验：value 必须可解析为数值。
export function sanitizeMetric(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = toNumber(raw.value);
  if (!Number.isFinite(value)) return null;
  const min = toNumber(raw.min);
  const max = toNumber(raw.max);
  return {
    value,
    unit: String(raw.unit || "").trim(),
    label: String(raw.label || "").trim(),
    caption: String(raw.caption || "").trim(),
    ...(Number.isFinite(min) ? { min } : {}),
    ...(Number.isFinite(max) && max > (Number.isFinite(min) ? min : 0) ? { max } : {}),
    better: raw.better === "low" ? "low" : "high"
  };
}

// 横评/擂台（visual.compare）存储形校验：≥2 产品、≥1 有效对比行。
export function sanitizeCompare(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.rows)) return null;
  const products = (Array.isArray(raw.products) ? raw.products : [])
    .map((p) => String(p == null ? "" : p).trim())
    .filter(Boolean);
  const nameA = products[0] || "本品";
  const nameB = products[1] || "同价位参考";
  const rows = raw.rows
    .map((row) => {
      const label = String(row?.dim || row?.label || "").trim();
      if (!label) return null;
      const better = row?.better === "low" ? "low" : "high";
      const unit = String(row?.unit || "").trim();
      if (row?.a != null && row?.b != null) {
        const a = toNumber(row.a);
        const b = toNumber(row.b);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        return { dim: label, a, b, unit, better };
      }
      const values = (Array.isArray(row?.values) ? row.values : []).slice(0, 2);
      const a = toNumber(values[0]);
      const b = toNumber(values[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return { label, unit, better, values: [String(values[0]).trim(), String(values[1]).trim()] };
    })
    .filter(Boolean)
    .slice(0, 6);
  if (!rows.length) return null;
  const style = raw.style === "arena" ? "arena" : raw.style === "table" ? "table" : "arena";
  return {
    style,
    products: products.length >= 2 ? products.slice(0, 4) : [nameA, nameB],
    rows
  };
}

const SHOOT_VARIANTS = ["product_macro", "hand_hold", "comparison", "talking_head"];

// 拍摄引导 HUD（visual.shootGuide）存储形校验。
export function sanitizeShootGuide(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const title = String(raw.title || "").trim();
  const steps = (Array.isArray(raw.steps) ? raw.steps : Array.isArray(raw.tips) ? raw.tips : [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!title && steps.length === 0) return null;
  const variant = SHOOT_VARIANTS.includes(raw.variant) ? raw.variant : "product_macro";
  return {
    variant,
    title: title || "拍摄引导",
    steps,
    angle: String(raw.angle || "").trim(),
    safeArea: String(raw.safeArea || "").trim()
  };
}

// 属性维度（visual.radar = { dims: [{label,value,max?}] }）存储形校验：≥3 维有效才保留。
export function sanitizeRadar(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.dims)) return null;
  const dims = raw.dims
    .map((d) => {
      const label = String(d?.label || "").trim();
      const value = toNumber(d?.value);
      if (!label || !Number.isFinite(value)) return null;
      const max = toNumber(d?.max);
      return { label, value, ...(Number.isFinite(max) && max > 0 ? { max } : {}) };
    })
    .filter(Boolean)
    .slice(0, 6);
  return dims.length >= 3 ? { dims } : null;
}

// 对战擂台 Arena PK：把 visual.compare 归一化成「回合制血条对决」。
// 兼容两形输入：
//   现有形 { products:[A,B,...], rows:[{label,unit,better,values:[..]}] }（取前两列）
//   spec 形 { products?, rows:[{dim,a,b,unit,better?}] }
// 返回 null（数据不足）或：
//   {
//     products: [nameA, nameB],
//     rounds: [{ dim, unit, better, a:{text,value}, b:{text,value},
//                winner: 0|1|-1, relDiff, critical, damage }],
//     hp: [[100,100], ...每回合结算后[hpA,hpB]],
//     verdict: 0|1|-1
//   }
// 伤害规则（确定性）：败方扣 round(8 + 22*relDiff)，cap 30；
// relDiff = |a-b| / max(|a|,|b|)；relDiff > 0.15 触发 CRITICAL；HP 下限 5。
export function normalizeBattle(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.rows)) return null;
  const products = (Array.isArray(raw.products) ? raw.products : [])
    .map((p) => String(p == null ? "" : p).trim())
    .filter(Boolean);
  const nameA = products[0] || "本品";
  const nameB = products[1] || "对手";

  const rounds = raw.rows
    .map((row) => {
      const dim = String(row?.dim || row?.label || "").trim();
      if (!dim) return null;
      const rawA = row?.a != null ? row.a : Array.isArray(row?.values) ? row.values[0] : null;
      const rawB = row?.b != null ? row.b : Array.isArray(row?.values) ? row.values[1] : null;
      const a = toNumber(rawA);
      const b = toNumber(rawB);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      const better = row?.better === "low" ? "low" : "high";
      const winner = a === b ? -1 : (better === "low" ? a < b : a > b) ? 0 : 1;
      const peak = Math.max(Math.abs(a), Math.abs(b));
      const relDiff = peak > 0 ? Math.abs(a - b) / peak : 0;
      return {
        dim,
        unit: String(row?.unit || "").trim(),
        better,
        a: { text: String(rawA).trim(), value: a },
        b: { text: String(rawB).trim(), value: b },
        winner,
        relDiff: round2(relDiff),
        critical: relDiff > 0.15,
        damage: winner === -1 ? 0 : Math.min(30, Math.round(8 + 22 * relDiff))
      };
    })
    .filter(Boolean);
  if (!rounds.length) return null;

  const hp = [[100, 100]];
  let [hpA, hpB] = hp[0];
  for (const round of rounds) {
    if (round.winner === 0) hpB = Math.max(5, hpB - round.damage);
    else if (round.winner === 1) hpA = Math.max(5, hpA - round.damage);
    hp.push([hpA, hpB]);
  }

  const wins = [
    rounds.filter((r) => r.winner === 0).length,
    rounds.filter((r) => r.winner === 1).length
  ];
  const verdict = wins[0] === wins[1] ? -1 : wins[0] > wins[1] ? 0 : 1;

  return { products: [nameA, nameB], rounds, hp, verdict };
}
