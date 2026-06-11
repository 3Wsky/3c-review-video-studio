/** @param {number} value */
export function formatSceneTime(value) {
  const seconds = Math.max(0, Math.round(value));
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
