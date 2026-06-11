/**
 * @param {string} text
 * @returns {string[]}
 */
export function splitLines(text) {
  return text
    .replace(/\r/g, "\n")
    .split(/[\n。！？!?；;]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * @param {string[]} lines
 * @param {string[]} keywords
 * @param {number} fallbackIndex
 */
export function pickByKeywords(lines, keywords, fallbackIndex) {
  const found = lines.find((line) => keywords.some((keyword) => line.includes(keyword)));
  return found || lines[fallbackIndex % Math.max(lines.length, 1)] || "";
}

/** @param {string} line */
export function compressPoint(line) {
  return line
    .replace(/不少用户提到/g, "用户反馈")
    .replace(/也有人反馈/g, "另一类反馈是")
    .replace(/综合来看/g, "整体判断")
    .replace(/比较/g, "")
    .replace(/明显/g, "")
    .replace(/这款/g, "这类")
    .slice(0, 72);
}

/** @param {unknown} value */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @param {number} value */
export function formatTime(value) {
  const m = Math.floor(value / 60);
  const s = Math.floor(value % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** @param {number} seconds */
export function srtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/** @param {string} text */
export function estimateDuration(text) {
  const clean = text.replace(/\s/g, "");
  return Math.max(6, clean.length / 5.4);
}
