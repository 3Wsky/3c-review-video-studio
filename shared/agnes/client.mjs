/**
 * Agnes Video V2.0 客户端（官方文档对齐）
 * @see https://agnes-ai.com/doc/agnes-video-v20
 */

export const AGNES_BASE = "https://apihub.agnes-ai.com/v1";
export const VIDEO_MODEL = "agnes-video-v2.0";
export const FLASH_MODEL = "agnes-2.0-flash";
export const IMAGE_MODEL = "agnes-image-2.1-flash";

/** 8n+1，最大 441 */
export const ALLOWED_FRAMES = [81, 121, 161, 241, 441];

export const DEFAULT_NEGATIVE_PROMPT =
  "blurry, low quality, watermark, text overlay, logo, distorted, jittery, ugly, deformed, oversaturated, shaky camera";

const FLASH_SYSTEM = `You write English cinematic B-roll prompts for 3C product review short videos (9:16 vertical).
Rules:
- Output ONE paragraph in English only, no quotes, no markdown, max 380 characters.
- Include: subject, environment, camera movement (slow push/pan/orbit), lighting, mood.
- Product review b-roll: clean tech aesthetic, no on-screen text, no logos, no subtitles.
- If the brief says no people, exclude humans. Otherwise hands-only macro shots are OK.
- Do not invent brand names or specs not in the brief.`;

/**
 * @param {number} durationSec
 * @param {number} frameRate
 */
export function pickFrames(durationSec, frameRate = 24) {
  const target = Math.round(Number(durationSec) * frameRate) || 121;
  let best = ALLOWED_FRAMES[0];
  for (const n of ALLOWED_FRAMES) {
    if (n <= target) best = n;
  }
  return best;
}

/**
 * @param {string} format
 */
export function formatSize(format) {
  if (format === "16:9") return { width: 1152, height: 768 };
  if (format === "1:1") return { width: 768, height: 768 };
  return { width: 768, height: 1152 };
}

/**
 * @param {unknown} payload
 */
export function extractVideoUrl(payload) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.video_url,
    payload.url,
    payload.output?.video_url,
    payload.output?.url,
    Array.isArray(payload.data) ? payload.data[0]?.url : null,
    payload.remixed_from_video_id
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//.test(c)) return c;
  }
  return null;
}

/**
 * @param {unknown} payload
 */
export function extractTaskId(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.id || payload.task_id || payload.video_id || null;
}

/**
 * @param {unknown} payload
 */
export function normalizeStatus(payload) {
  const raw = String(payload?.status || payload?.state || "").toLowerCase();
  if (["completed", "succeeded", "success", "done"].includes(raw)) return "completed";
  if (["failed", "error", "cancelled", "canceled"].includes(raw)) return "failed";
  if (["running", "processing", "in_progress"].includes(raw)) return "running";
  return "queued";
}

/**
 * @param {string} path
 * @param {{ method?: string, apiKey: string, body?: Record<string, unknown> }} opts
 */
export async function agnesFetch(path, { method = "GET", apiKey, body } = {}) {
  const resp = await fetch(`${AGNES_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data?.error?.message || data?.message || data?.error || `Agnes API ${resp.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = resp.status;
    throw err;
  }
  return data;
}

/**
 * 用 agnes-2.0-flash 将中文/简短 brief 扩写为英文电影感视频 prompt（V2.0 推荐流程）
 * @param {string} brief
 * @param {string} apiKey
 */
export async function expandCinematicPrompt(brief, apiKey) {
  const text = String(brief || "").trim();
  if (!text) throw new Error("缺少 prompt brief");

  const data = await agnesFetch("/chat/completions", {
    method: "POST",
    apiKey,
    body: {
      model: FLASH_MODEL,
      temperature: 0.6,
      max_tokens: 220,
      messages: [
        { role: "system", content: FLASH_SYSTEM },
        {
          role: "user",
          content: `Brief for 5-second vertical product b-roll:\n${text}`
        }
      ]
    }
  });

  const expanded = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!expanded || expanded.length < 24) {
    return englishFallbackPrompt(text);
  }
  return expanded.replace(/^["']|["']$/g, "").slice(0, 480);
}

/**
 * 本地/blob 图 → Agnes 托管 URL（图生视频必须公网 URL）
 * @param {string} imageInput http(s) URL 或 data:image/... base64
 * @param {string} apiKey
 */
export async function hostImageForVideo(imageInput, apiKey) {
  const raw = String(imageInput || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  if (!raw.startsWith("data:image/")) {
    throw new Error("图片须为 https URL 或 data:image base64");
  }

  const data = await agnesFetch("/images/generations", {
    method: "POST",
    apiKey,
    body: {
      model: IMAGE_MODEL,
      prompt:
        "Keep this product photo exactly as-is. Same composition, colors, and subject. Clean studio product shot.",
      size: "768x1152",
      extra_body: {
        image: [raw],
        response_format: "url"
      }
    }
  });

  const url =
    data?.data?.[0]?.url ||
    data?.url ||
    (Array.isArray(data?.urls) ? data.urls[0] : null);

  if (typeof url === "string" && /^https?:\/\//.test(url)) return url;
  throw new Error("Agnes 图片托管未返回 URL");
}

/** @param {string} brief */
function englishFallbackPrompt(brief) {
  const clean = String(brief || "")
    .replace(/[\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base =
    clean.length > 12
      ? clean.slice(0, 200)
      : "3C consumer electronics product hero shot, slow cinematic orbit";
  return `${base}, soft tech lighting, shallow depth of field, 9:16 vertical b-roll, no text, no watermark, smooth camera motion`;
}

/**
 * @param {Record<string, unknown>} input
 * @param {string} apiKey
 */
export async function createVideoTask(input, apiKey) {
  let prompt = String(input.prompt || "").trim();
  if (!prompt) throw new Error("缺少 prompt");

  if (input.expandPrompt !== false) {
    try {
      prompt = await expandCinematicPrompt(prompt, apiKey);
    } catch (err) {
      console.warn("[agnes] expand prompt failed, using fallback:", err.message);
      prompt = englishFallbackPrompt(prompt);
    }
  }

  const frameRate = Number(input.frameRate) > 0 ? Math.round(Number(input.frameRate)) : 24;
  const numFramesRaw = input.numFrames
    ? Number(input.numFrames)
    : pickFrames(input.durationSec ?? 5, frameRate);
  const numFrames = ALLOWED_FRAMES.includes(numFramesRaw)
    ? numFramesRaw
    : pickFrames(input.durationSec ?? 5, frameRate);
  const { width, height } = formatSize(String(input.format || "9:16"));

  let imageUrl = String(input.imageUrl || input.image || "").trim();
  if (!imageUrl && input.imageDataUrl) {
    imageUrl = (await hostImageForVideo(String(input.imageDataUrl), apiKey)) || "";
  }

  /** @type {Record<string, unknown>} */
  const body = {
    model: VIDEO_MODEL,
    prompt,
    width: Number(input.width) || width,
    height: Number(input.height) || height,
    num_frames: numFrames,
    frame_rate: frameRate,
    negative_prompt: String(input.negativePrompt || DEFAULT_NEGATIVE_PROMPT)
  };

  if (input.seed !== undefined && input.seed !== null && input.seed !== "") {
    body.seed = Number(input.seed);
  }
  if (Number(input.numInferenceSteps) > 0) {
    body.num_inference_steps = Math.round(Number(input.numInferenceSteps));
  }

  if (imageUrl) {
    body.image = imageUrl;
    body.mode = String(input.mode || "ti2vid");
  }

  const created = await agnesFetch("/videos", { method: "POST", apiKey, body });
  return {
    taskId: extractTaskId(created),
    status: normalizeStatus(created),
    videoUrl: extractVideoUrl(created),
    promptUsed: prompt,
    imageUrl: imageUrl || null,
    mode: imageUrl ? body.mode : "t2v",
    raw: created
  };
}

/**
 * @param {string} taskId
 * @param {string} apiKey
 */
export async function getVideoTask(taskId, apiKey) {
  const data = await agnesFetch(`/videos/${encodeURIComponent(taskId)}`, { apiKey });
  return {
    taskId: extractTaskId(data) || taskId,
    status: normalizeStatus(data),
    videoUrl: extractVideoUrl(data),
    raw: data
  };
}

/**
 * @param {string} taskId
 * @param {string} apiKey
 * @param {number} maxWaitMs
 * @param {number} intervalMs
 */
export async function pollVideoUntilDone(taskId, apiKey, maxWaitMs = 600000, intervalMs = 8000) {
  const deadline = Date.now() + maxWaitMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await getVideoTask(taskId, apiKey);
    } catch (err) {
      if (err.status === 503) {
        await sleep(intervalMs);
        continue;
      }
      throw err;
    }
    if (last.status === "completed" && last.videoUrl) return last;
    if (last.status === "failed") {
      throw new Error(last.raw?.error?.message || last.raw?.message || "视频生成失败");
    }
    await sleep(intervalMs);
  }
  return { ...last, status: "timeout", error: `轮询超时（${maxWaitMs / 1000}s）` };
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
