// 共享分镜模型单测：node --test test/scene-model.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeScenes,
  normalizeCompare,
  highlightTokens,
  buildComposition,
  resolveFormat,
  FPS,
} from "../src/scene-model.mjs";

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
