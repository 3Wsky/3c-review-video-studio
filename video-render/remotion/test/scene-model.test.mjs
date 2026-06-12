// 共享分镜模型单测：node --test test/scene-model.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeScenes,
  normalizeCompare,
  normalizeCaptions,
  karaokeFraction,
  highlightTokens,
  formatCountUp,
  normalizeMetric,
  metricRingFraction,
  normalizeTransition,
  normalizeRadar,
  normalizeDataviz,
  buildComposition,
  resolveFormat,
  FPS,
} from "../src/scene-model.mjs";

test("normalizeTransition 只接受转场库枚举，两者皆无 → null", () => {
  assert.deepEqual(normalizeTransition({ in: "speed-line", out: "scan-wipe" }), {
    in: "speed-line",
    out: "scan-wipe",
  });
  assert.deepEqual(normalizeTransition({ in: "不存在", out: "scan-wipe" }), {
    in: null,
    out: "scan-wipe",
  });
  assert.equal(normalizeTransition({ in: "不存在" }), null);
  assert.equal(normalizeTransition(null), null);
});

test("normalizeRadar 至少 3 维有效，frac 按 max（缺省取峰值）", () => {
  const r = normalizeRadar({
    dims: [
      { label: "性能", value: 8, max: 10 },
      { label: "续航", value: 9, max: 10 },
      { label: "屏幕", value: 7 }, // 无 max → 分母取峰值 10
    ],
  });
  assert.equal(r.dims.length, 3);
  assert.equal(r.dims[0].frac, 0.8);
  assert.equal(r.dims[2].frac, 0.7);
  assert.equal(normalizeRadar({ dims: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }), null);
  assert.equal(normalizeRadar(null), null);
});

test("normalizeScenes 透传 transition 与 radar（无效 → null）", () => {
  const s = normalizeScenes({
    timeline: [
      {
        duration: 5,
        visual: {
          headline: "x",
          transition: { in: "speed-line" },
          radar: { dims: [{ label: "a", value: 1 }, { label: "b", value: 2 }, { label: "c", value: 3 }] },
        },
      },
      { duration: 5, visual: { headline: "y" } },
    ],
  });
  assert.equal(s[0].transition.in, "speed-line");
  assert.equal(s[0].radar.dims.length, 3);
  assert.equal(s[1].transition, null);
  assert.equal(s[1].radar, null);
});

test("normalizeScenes 累加起始时间、兜底时长", () => {
  const tl = {
    timeline: [
      { title: "A", duration: 5, voiceover: "v1", visual: { headline: "h1" } },
      { title: "B", start: 5, end: 18, voiceover: "v2", visual: { headline: "h2" } },
      { title: "C", voiceover: "v3", visual: {} }, // 无时长 → 默认 4
    ],
  };
  const s = normalizeScenes(tl);
  assert.equal(s.length, 3);
  assert.equal(s[0].start, 0);
  assert.equal(s[0].duration, 5);
  assert.equal(s[1].start, 5);
  assert.equal(s[1].duration, 13); // end-start
  assert.equal(s[2].start, 18);
  assert.equal(s[2].duration, 4); // 兜底
  assert.equal(s[2].subtitle, "v3"); // subtitle 缺省回退到 voiceover
});

test("normalizeCompare 按 better 判每行胜者，并列记 -1", () => {
  const c = normalizeCompare({
    products: ["A", "B", "C"],
    rows: [
      { label: "续航", unit: "小时", better: "high", values: ["8", "6", "7"] }, // A 胜(0)
      { label: "价格", unit: "元", better: "low", values: ["999", "699", "1299"] }, // B 胜(1)
      { label: "重量", better: "low", values: ["200", "200", "180"] }, // C 胜(2)
    ],
  });
  assert.equal(c.rows[0].winner, 0);
  assert.equal(c.rows[1].winner, 1);
  assert.equal(c.rows[2].winner, 2);
  // 每家各 1 行胜 → 综合并列 → verdict -1
  assert.equal(c.verdict, -1);
});

test("normalizeCompare 行附带解析数值 nums（非数字 → null）", () => {
  const c = normalizeCompare({
    products: ["A", "B"],
    rows: [
      { label: "续航", unit: "小时", better: "high", values: ["12 小时", "14"] },
      { label: "备注", better: "high", values: ["无", "—"] },
    ],
  });
  assert.deepEqual(c.rows[0].nums, [12, 14]); // 从 "12 小时" 抽出 12
  assert.deepEqual(c.rows[1].nums, [null, null]); // 非数字 → null
});

test("normalizeCompare 综合胜者 = 行胜最多", () => {
  const c = normalizeCompare({
    products: ["A", "B"],
    rows: [
      { label: "续航", better: "high", values: ["8", "6"] }, // A
      { label: "降噪", better: "high", values: ["45", "40"] }, // A
      { label: "价格", better: "low", values: ["999", "699"] }, // B
    ],
  });
  assert.equal(c.verdict, 0); // A 拿下 2 行
});

test("normalizeCompare 少于两个产品或无有效行 → null", () => {
  assert.equal(normalizeCompare({ products: ["A"], rows: [] }), null);
  assert.equal(normalizeCompare(null), null);
  assert.equal(normalizeCompare({ products: ["A", "B"], rows: [{ label: "", values: [] }] }), null);
});

test("highlightTokens 抽出数字+单位为高亮 token", () => {
  const tokens = highlightTokens("重度实测 12 小时，到家还剩 20%");
  const hl = tokens.filter((t) => t.hl).map((t) => t.text.trim());
  assert.ok(hl.some((t) => t.includes("12")));
  assert.ok(hl.some((t) => t.includes("20%")));
  // 还原原文
  assert.equal(tokens.map((t) => t.text).join(""), "重度实测 12 小时，到家还剩 20%");
});

test("highlightTokens 空文本不炸", () => {
  assert.deepEqual(highlightTokens(""), []);
  assert.deepEqual(highlightTokens(null), []);
});

test("normalizeCaptions 过滤无效项并按 fromMs 排序", () => {
  const caps = normalizeCaptions([
    { fromMs: 500, toMs: 700 },
    { fromMs: 100, toMs: 300 }, // 乱序 → 应排前
    { fromMs: 800, toMs: 600 }, // toMs<fromMs → 丢弃
    { fromMs: "x", toMs: 900 }, // 非数 → 丢弃
  ]);
  assert.deepEqual(caps, [
    { fromMs: 100, toMs: 300 },
    { fromMs: 500, toMs: 700 },
  ]);
  assert.equal(normalizeCaptions([]), null);
  assert.equal(normalizeCaptions("nope"), null);
});

test("karaokeFraction 跟随 token 时间戳：等权、区间内插值、停顿不前进", () => {
  const caps = [
    { fromMs: 0, toMs: 100 },
    { fromMs: 100, toMs: 200 },
    { fromMs: 400, toMs: 500 }, // 200~400 是停顿
    { fromMs: 500, toMs: 600 },
  ];
  assert.equal(karaokeFraction(caps, -10), 0); // 开头前
  assert.equal(karaokeFraction(caps, 100), 0.25); // 第1个念完(1/4)
  assert.equal(karaokeFraction(caps, 150), (1 + 0.5) / 4); // 第2个念到一半
  assert.equal(karaokeFraction(caps, 300), 0.5); // 停顿期：停在 2/4，不前进
  assert.equal(karaokeFraction(caps, 600), 1); // 全念完
  assert.equal(karaokeFraction(caps, 99999), 1); // 超出 → 封顶 1
  assert.equal(karaokeFraction(null, 100), null); // 无 captions → null（上层回退线性）
  assert.equal(karaokeFraction([], 100), null);
});

test("normalizeScenes 透传逐词时间戳 captions（无效 → null）", () => {
  const s = normalizeScenes({
    timeline: [
      { duration: 5, subtitle: "x", captions: [{ fromMs: 0, toMs: 120 }] },
      { duration: 5, subtitle: "y" }, // 无 captions
    ],
  });
  assert.deepEqual(s[0].captions, [{ fromMs: 0, toMs: 120 }]);
  assert.equal(s[1].captions, null);
});

test("formatCountUp 数字滚动：自动取目标、保留前后缀小数位、到位还原", () => {
  // target=null → 自动取串里的数为目标
  assert.equal(formatCountUp("12 小时", null, 0), "0 小时"); // 起点 0
  assert.equal(formatCountUp("12 小时", null, 0.5), "6 小时"); // 半程
  assert.equal(formatCountUp("12 小时", null, 1), "12 小时"); // 到位还原原串
  // 显式 target（横评格用）：原串无小数位 → 整数显示
  assert.equal(formatCountUp("3999元", 3999, 0.5), "2000元"); // (3999*0.5).toFixed(0)
  // 小数位跟随原串
  assert.equal(formatCountUp("4.5kg", null, 0), "0.0kg");
  assert.equal(formatCountUp("4.5kg", null, 1), "4.5kg");
  // 无数字/非数目标 → 原样
  assert.equal(formatCountUp("买它就对了", null, 0.3), "买它就对了");
  assert.equal(formatCountUp("12", "x", 0.3), "12");
});

test("normalizeMetric 解析数卡数据：value 必需、max>min 才有占比 frac", () => {
  const m = normalizeMetric({ value: "12", unit: "小时", label: "实测续航", max: 16, caption: "混合使用" });
  assert.equal(m.value, 12);
  assert.equal(m.valueText, "12");
  assert.equal(m.unit, "小时");
  assert.equal(m.label, "实测续航");
  assert.equal(m.max, 16);
  assert.equal(m.frac, 12 / 16); // (12-0)/(16-0)
  // 无 max → frac=null（环装饰性扫满）
  const m2 = normalizeMetric({ value: "45", unit: "dB" });
  assert.equal(m2.max, null);
  assert.equal(m2.frac, null);
  // min/max 都给 → 区间归一化
  const m3 = normalizeMetric({ value: 8, min: 4, max: 12 });
  assert.equal(m3.frac, (8 - 4) / (12 - 4));
  // value 非数 → null
  assert.equal(normalizeMetric({ value: "无" }), null);
  assert.equal(normalizeMetric(null), null);
  assert.equal(normalizeMetric([1, 2]), null);
});

test("metricRingFraction 环占比随入场 p 增长，到位封顶目标占比", () => {
  const m = normalizeMetric({ value: 12, max: 16 }); // 目标 0.75
  assert.equal(metricRingFraction(m, 0), 0);
  assert.equal(metricRingFraction(m, 0.5), 0.375); // 0.75*0.5
  assert.equal(metricRingFraction(m, 1), 0.75);
  assert.equal(metricRingFraction(m, 2), 0.75); // p 钳制到 1
  // 无 max → 目标占比 1（装饰满环）
  const m2 = normalizeMetric({ value: 45 });
  assert.equal(metricRingFraction(m2, 1), 1);
  assert.equal(metricRingFraction(null, 1), 0);
});

test("normalizeDataviz 从 scene-model 再导出，且 frac 归一化正确", () => {
  // bar：denom 取全体峰值（无 item.max / viz.max 时）
  const bar = normalizeDataviz({
    kind: "bar",
    title: "实测续航",
    unit: "小时",
    items: [{ label: "本品", value: 12 }, { label: "对手", value: 6 }],
  });
  assert.equal(bar.kind, "bar");
  assert.equal(bar.items[0].frac, 1); // 12/12
  assert.equal(bar.items[1].frac, 0.5); // 6/12
  // radar 至少 3 项，否则 null
  assert.equal(normalizeDataviz({ kind: "radar", items: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }), null);
  // 非法 kind → null
  assert.equal(normalizeDataviz({ kind: "pie", items: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }), null);
});

test("normalizeScenes 透传 dataviz（visual.dataviz → null 当无效）", () => {
  const s = normalizeScenes({
    timeline: [
      { duration: 5, visual: { headline: "续航", dataviz: { kind: "ring", unit: "h", items: [{ label: "本品", value: 12, max: 16 }, { label: "对手", value: 8, max: 16 }] } } },
      { duration: 5, visual: { headline: "x" } }, // 无 dataviz
      { duration: 5, visual: { dataviz: { kind: "bar", items: [{ label: "仅一项", value: 1 }] } } }, // bar 不足 2 项 → null
    ],
  });
  assert.equal(s[0].dataviz.kind, "ring");
  assert.equal(s[0].dataviz.items[0].frac, 0.75); // 12/16
  assert.equal(s[1].dataviz, null);
  assert.equal(s[2].dataviz, null);
});

test("normalizeScenes 透传数卡 metric（visual.metric → null 当无效）", () => {
  const s = normalizeScenes({
    timeline: [
      { duration: 5, visual: { headline: "续航", metric: { value: "12", unit: "小时", max: 16 } } },
      { duration: 5, visual: { headline: "x" } }, // 无 metric
    ],
  });
  assert.equal(s[0].metric.value, 12);
  assert.equal(s[0].metric.frac, 0.75);
  assert.equal(s[1].metric, null);
});

test("buildComposition 推导画幅与总帧数", () => {
  const tl = { timeline: [{ duration: 5 }, { duration: 3 }] };
  const comp = buildComposition(tl, "16:9");
  assert.equal(comp.width, 1920);
  assert.equal(comp.height, 1080);
  assert.equal(comp.fps, FPS);
  assert.equal(comp.totalSeconds, 8);
  assert.equal(comp.durationInFrames, 8 * FPS);
});

test("resolveFormat 兜底到 9:16", () => {
  assert.equal(resolveFormat("乱填").cls, "fmt-9x16");
  assert.equal(resolveFormat("1:1").cls, "fmt-1x1");
});
