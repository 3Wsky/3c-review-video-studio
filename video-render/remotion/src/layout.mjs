// 各元素的定位/字号，复刻 build.mjs 的 CSS（base = 9:16），按画幅覆盖。
// 取值与 build.mjs <style> 一一对应；compare 镜的标题用「紧凑版」，但在 16:9/1:1 下
// 画幅覆盖优先（对齐 CSS 里 `.fmt-16x9 .title` 比 `.title-compact` 特异性更高）。

const BASE = {
  badge: { top: 96, fontSize: 30 },
  title: { top: 196, left: 80, right: 80, fontSize: 86 },
  titleCompact: { top: 150, fontSize: 70 },
  detail: { top: 470, left: 110, right: 110, fontSize: 44 },
  subtitle: { bottom: 150, left: 80, right: 80, fontSize: 56 },
  cite: { left: 80, bottom: 96, fontSize: 26 },
  stock: { top: 40, right: 40, fontSize: 24 },
  compare: { top: 340, left: 56, right: 56 },
  // 数卡/单指标镜：进度环居中，环径/数字/文字字号随画幅覆盖。
  metric: { top: 540, ring: 360, valueSize: 132, unitSize: 48, labelSize: 38, captionSize: 38 },
  // 数据可视化参数卡（bar/radar/ring）：卡片定位 + 各元素字号（与 metric 共享 9:16 基准画面区）。
  dataviz: {
    top: 560,
    left: 70,
    right: 70,
    titleSize: 38,
    labelSize: 32,
    valueSize: 40,
    unitSize: 24,
    ringSize: 200,
    radarSize: 420,
    radarPad: 70,
  },
  arena: { top: 180, left: 56, right: 56, titleSize: 36, hpHeight: 28, vsSize: 64 },
  shootGuide: { headerH: 72, checklistW: 280 },
};

const OVERRIDES = {
  "9:16": {},
  "16:9": {
    badge: { top: 56 },
    title: { top: 118, fontSize: 78, left: 200, right: 200 },
    detail: { top: 340, left: 280, right: 280 },
    compare: { top: 250, left: 360, right: 360 },
    subtitle: { bottom: 84, left: 200, right: 200 },
    cite: { bottom: 56 },
    metric: { top: 300, ring: 300, valueSize: 116, unitSize: 44 },
    dataviz: { top: 300, left: 360, right: 360, ringSize: 200, radarSize: 380, radarPad: 64 },
    arena: { top: 140, left: 200, right: 200 },
  },
  "1:1": {
    badge: { top: 52 },
    title: { top: 116, fontSize: 74 },
    detail: { top: 340 },
    compare: { top: 250, left: 70, right: 70 },
    subtitle: { bottom: 90 },
    metric: { top: 360, ring: 320, valueSize: 120 },
    dataviz: { top: 380, left: 80, right: 80, ringSize: 200, radarSize: 400, radarPad: 66 },
    arena: { top: 160, left: 48, right: 48 },
  },
};

// 取某画幅下某元素的定位。compact=true（compare 镜标题）时叠加紧凑版，再被画幅覆盖。
export function layoutFor(formatKey, el, compact = false) {
  const key = OVERRIDES[formatKey] ? formatKey : "9:16";
  const base = BASE[el] || {};
  const ov = (OVERRIDES[key] && OVERRIDES[key][el]) || {};
  if (el === "title") {
    return { ...base, ...(compact ? BASE.titleCompact : {}), ...ov };
  }
  return { ...base, ...ov };
}
