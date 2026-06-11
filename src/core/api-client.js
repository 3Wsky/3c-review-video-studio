import { API_BASE_KEY } from "./constants.js";
import { buildApiPayload, buildTimeline } from "./timeline-builder.js";
import { normalizeTimelineData } from "./timeline-normalize.js";

/**
 * @param {string} [storedBase]
 */
export function getApiBase(storedBase = "") {
  let base = storedBase.trim();
  if (!base) {
    try {
      base = localStorage.getItem(API_BASE_KEY) || "";
    } catch {
      base = "";
    }
  }
  const params = new URLSearchParams(location.search);
  if (!base && params.get("api")) base = params.get("api") || "";
  return base.trim().replace(/\/$/, "");
}

/**
 * @param {import('./timeline-builder.js').FormInput} input
 * @param {string} apiBase
 */
export async function generateTimeline(input, apiBase) {
  if (!apiBase && location.protocol === "file:") {
    return { data: buildTimeline(input), status: "local-sim" };
  }

  const response = await fetch(`${apiBase}/api/generate-timeline`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildApiPayload(input))
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "生成失败");
  }
  return {
    data: normalizeTimelineData(data, input),
    status: apiBase ? "remote" : "cloudflare"
  };
}

/**
 * @param {string} query
 * @param {string} apiBase
 * @param {number} [count]
 */
export async function searchZhihu(query, apiBase, count = 10) {
  const url = `${apiBase}/api/zhihu-search?q=${encodeURIComponent(query)}&count=${count}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "知乎搜索失败");
  return data;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} apiBase
 */
export async function renderVideo(payload, apiBase) {
  const response = await fetch(`${apiBase}/api/render`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "渲染失败");
  return data;
}

/**
 * @param {string} apiBase
 */
export async function fetchHealth(apiBase) {
  const response = await fetch(`${apiBase}/api/health`);
  if (!response.ok) throw new Error("health check failed");
  return response.json();
}
