import { normalizeTimelineResponse } from "../shared/prompts/generate-timeline.mjs";

const data = {
  project: { product: "TestPhone", targetDuration: 60 },
  insights: { pros: ["battery", "camera"], cons: ["heavy"] },
  timeline: [
    { title: "前5秒·钩子", voiceover: "hook", visual: { headline: "h" } },
    { title: "痛点共鸣", voiceover: "pain", visual: { headline: "h" } },
    { title: "悬念展开", voiceover: "sus", visual: { headline: "h" } },
    { title: "高潮·揭晓", voiceover: "cli", visual: { headline: "h" } },
    { title: "反转·短板", voiceover: "tw", visual: { headline: "h" } },
    { title: "结尾·结论+互动", voiceover: "end", visual: { headline: "h" } }
  ]
};

const out = normalizeTimelineResponse(data, { productName: "TestPhone", targetDuration: 60 });
const kinds = out.timeline.map((s) => ({
  title: s.title,
  compare: Boolean(s.visual.compare),
  shootGuide: Boolean(s.visual.shootGuide),
  metric: Boolean(s.visual.metric),
  radar: Boolean(s.visual.radar),
  transition: s.visual.transition?.in
}));

const unique = new Set();
out.timeline.forEach((s) => {
  if (s.visual.compare) unique.add("compare");
  if (s.visual.shootGuide) unique.add("shootGuide");
  if (s.visual.metric) unique.add("metric");
  if (s.visual.radar) unique.add("radar");
  if (s.visual.dataviz) unique.add("dataviz");
});

const ok = unique.size >= 3 && kinds[0].transition === "speed-line" && kinds[1].shootGuide && kinds[3].compare;
console.log(JSON.stringify({ ok, kinds, unique: [...unique] }, null, 2));
process.exit(ok ? 0 : 1);
