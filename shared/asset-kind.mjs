/** @param {string | undefined | null} type */
export function isVideoMime(type) {
  return String(type || "").toLowerCase().startsWith("video/");
}

/** @param {string | undefined | null} url */
export function isVideoUrl(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ""));
}

/** @param {{ type?: string; url?: string }} entry */
export function entryIsVideo(entry) {
  if (!entry) return false;
  if (isVideoMime(entry.type)) return true;
  return isVideoUrl(entry.url);
}
