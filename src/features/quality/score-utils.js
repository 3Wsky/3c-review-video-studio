/** 留人分 / 质检色阶工具（与 legacy director.js 对齐） */

export function toneColor(tone) {
  return tone === "good"
    ? "var(--ds-success)"
    : tone === "ok"
      ? "var(--ds-info)"
      : tone === "warn"
        ? "var(--ds-warning)"
        : "var(--ds-danger)";
}

export function scoreTone(score) {
  return score >= 85 ? "good" : score >= 70 ? "ok" : score >= 55 ? "warn" : "bad";
}

export const GATE_TONE = {
  pass: "var(--ds-success)",
  warn: "var(--ds-warning)",
  fail: "var(--ds-danger)"
};

export const GATE_LABEL = {
  pass: "通过",
  warn: "提醒",
  fail: "未通过"
};
