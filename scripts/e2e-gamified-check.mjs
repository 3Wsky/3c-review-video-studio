import { normalizeScenes, buildComposition } from "../video-render/remotion/src/scene-model.mjs";

const timeline = {
  project: { product: "E2E Test Phone" },
  timeline: [
    {
      id: "s1",
      duration: 4,
      visual: {
        type: "arena",
        compare: {
          style: "arena",
          products: ["Phone A", "Phone B"],
          rows: [{ label: "Battery", values: ["12h", "18h"], better: "high" }],
        },
        transition: { in: "speed-line" },
      },
    },
    {
      id: "s2",
      duration: 4,
      visual: {
        shootGuide: { title: "Front shot", steps: ["Hold steady 2s"] },
        transition: { in: "glitch-cut" },
      },
    },
    {
      id: "s3",
      duration: 4,
      visual: {
        metric: { label: "Score", value: 72, max: 100 },
        radar: {
          dims: [
            { label: "Perf", value: 90 },
            { label: "Batt", value: 70 },
            { label: "Cam", value: 85 },
          ],
        },
        transition: { in: "scan-wipe" },
      },
    },
    {
      id: "s4",
      duration: 4,
      visual: {
        radar: {
          dims: [
            { label: "Perf", value: 90 },
            { label: "Batt", value: 70 },
            { label: "Cam", value: 85 },
            { label: "Disp", value: 80 },
            { label: "Design", value: 75 },
          ],
        },
        transition: { in: "pixel-dissolve" },
      },
    },
    {
      id: "s5",
      duration: 4,
      visual: {
        dataviz: {
          kind: "bar",
          title: "Specs",
          items: [
            { label: "Weight", value: 210, unit: "g" },
            { label: "Thickness", value: 8.1, unit: "mm" },
          ],
        },
        transition: { in: "screen-crack" },
      },
    },
    {
      id: "s6",
      duration: 4,
      visual: {
        dataviz: {
          kind: "ring",
          title: "Score",
          items: [
            { label: "Overall", value: 85 },
            { label: "Value", value: 72 },
          ],
        },
        transition: { in: "iris-close" },
      },
    },
  ],
};

const scenes = normalizeScenes(timeline);
const comp = buildComposition(timeline, "9:16");

const checks = {
  scenes: scenes.length,
  battle: Boolean(scenes[0].battle),
  shootGuide: Boolean(scenes[1].shootGuide),
  metric: Boolean(scenes[2].metric),
  standaloneRadar: Boolean(scenes[3].radar && !scenes[3].metric),
  datavizBar: scenes[4].dataviz?.kind === "bar",
  datavizRing: scenes[5].dataviz?.kind === "ring",
  transitions: scenes.map((s) => s.transition?.in),
  totalFrames: comp.totalFrames,
};

const ok =
  checks.scenes === 6 &&
  checks.battle &&
  checks.shootGuide &&
  checks.metric &&
  checks.standaloneRadar &&
  checks.datavizBar &&
  checks.datavizRing &&
  checks.transitions.every(Boolean);

console.log(JSON.stringify({ ok, checks }, null, 2));
process.exit(ok ? 0 : 1);
