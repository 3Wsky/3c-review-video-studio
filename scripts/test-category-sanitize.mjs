import assert from "node:assert/strict";
import {
  scrubTimelineCategoryMismatch,
  resolveCategory,
  hasCategoryConflict
} from "../shared/category-sanitize.mjs";

assert.equal(resolveCategory("华为Nova16", "耳机", true), "手机");
assert.equal(hasCategoryConflict("华为Nova16", "耳机"), true);

const timeline = [
  {
    title: "痛点共鸣",
    voiceover: "买耳机最怕降噪不行，地铁里全是杂音，这款入耳式也有同样问题。",
    subtitle: "买耳机最怕降噪不行",
    visual: { headline: "这说的就是你", detail: "入耳佩戴久了耳压难受" }
  }
];

const out = scrubTimelineCategoryMismatch(timeline, {
  productName: "华为Nova16",
  category: "手机"
});

assert.ok(!/耳机|入耳|降噪|地铁/.test(out[0].voiceover), "pain voiceover scrubbed");
assert.ok(out[0].voiceover.includes("华为Nova16"), "product name kept");
assert.ok(out[0].checks.includes("已净化跨品类残留文案"));

console.log(JSON.stringify({ ok: true, voiceover: out[0].voiceover }, null, 2));
