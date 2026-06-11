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

// ---------- 游戏化扩展（fullspec v1）----------

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
