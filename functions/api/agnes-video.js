// Agnes Video V2.0 代理（POC）：文生视频 / 图生视频，Key 仅存服务端 AGNES_API_KEY。
// 文档：https://agnes-ai.com/doc/agnes-video-v20
//
// POST { prompt, imageUrl?, format?, durationSec?, poll? }
//   → 创建任务；poll=true 时服务端轮询至完成（默认 poll=false，客户端自行轮询避免 CF 120s 超时）
// GET ?taskId=xxx
//   → 查询任务状态

const BASE_URL = "https://apihub.agnes-ai.com/v1";
const MODEL = "agnes-video-v2.0";
const ALLOWED_FRAMES = [81, 121, 161, 241, 441];

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS }
  });
}

function pickFrames(durationSec, frameRate) {
  const target = Math.round(Number(durationSec) * frameRate) || 121;
  let best = ALLOWED_FRAMES[0];
  for (const n of ALLOWED_FRAMES) {
    if (n <= target) best = n;
  }
  return best;
}

function formatSize(format) {
  if (format === "16:9") return { width: 1152, height: 768 };
  if (format === "1:1") return { width: 768, height: 768 };
  return { width: 768, height: 1152 }; // 9:16 竖屏
}

function extractVideoUrl(payload) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.video_url,
    payload.url,
    payload.output?.video_url,
    payload.output?.url,
    Array.isArray(payload.data) ? payload.data[0]?.url : null,
    // Agnes 实测：完成时下载 URL 放在 remixed_from_video_id 字段（非 video_url）
    payload.remixed_from_video_id
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//.test(c)) return c;
  }
  return null;
}

function extractTaskId(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.id || payload.task_id || payload.video_id || null;
}

function normalizeStatus(payload) {
  const raw = String(payload?.status || payload?.state || "").toLowerCase();
  if (["completed", "succeeded", "success", "done"].includes(raw)) return "completed";
  if (["failed", "error", "cancelled", "canceled"].includes(raw)) return "failed";
  if (["running", "processing", "in_progress"].includes(raw)) return "running";
  return "queued";
}

async function agnesFetch(path, { method = "GET", apiKey, body } = {}) {
  const resp = await fetch(`${BASE_URL}${path}`, {
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
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

async function createTask(input, apiKey) {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) throw new Error("缺少 prompt");

  const frameRate = Number(input.frameRate) > 0 ? Math.round(Number(input.frameRate)) : 24;
  const numFrames = input.numFrames
    ? Number(input.numFrames)
    : pickFrames(input.durationSec ?? 5, frameRate);
  const { width, height } = formatSize(input.format || "9:16");

  const body = {
    model: MODEL,
    prompt,
    width: Number(input.width) || width,
    height: Number(input.height) || height,
    num_frames: ALLOWED_FRAMES.includes(numFrames) ? numFrames : pickFrames(5, frameRate),
    frame_rate: frameRate
  };

  const imageUrl = String(input.imageUrl || input.image || "").trim();
  if (imageUrl) body.image = imageUrl;

  const created = await agnesFetch("/videos", { method: "POST", apiKey, body });
  const taskId = extractTaskId(created);
  const videoUrl = extractVideoUrl(created);
  return {
    taskId,
    status: normalizeStatus(created),
    videoUrl,
    raw: created
  };
}

async function getTask(taskId, apiKey) {
  const data = await agnesFetch(`/videos/${encodeURIComponent(taskId)}`, { apiKey });
  return {
    taskId: extractTaskId(data) || taskId,
    status: normalizeStatus(data),
    videoUrl: extractVideoUrl(data),
    raw: data
  };
}

async function pollUntilDone(taskId, apiKey, maxWaitMs = 120000, intervalMs = 3000) {
  const deadline = Date.now() + maxWaitMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await getTask(taskId, apiKey);
    if (last.status === "completed" && last.videoUrl) return last;
    if (last.status === "failed") {
      throw new Error(last.raw?.error?.message || last.raw?.message || "视频生成失败");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ...last, status: "timeout", error: `轮询超时（${maxWaitMs / 1000}s）` };
}

function requireKey(env) {
  const apiKey = String(env.AGNES_API_KEY || "").trim();
  if (!apiKey) {
    return { error: jsonResponse({ error: "AGNES_API_KEY 未配置（请在 Cloudflare Pages 环境变量添加）" }, 501) };
  }
  return { apiKey };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = requireKey(env);
  if (auth.error) return auth.error;

  const taskId = new URL(request.url).searchParams.get("taskId") || new URL(request.url).searchParams.get("id");
  if (!taskId) return jsonResponse({ error: "缺少 taskId" }, 400);

  try {
    const result = await getTask(taskId, auth.apiKey);
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error.message || String(error) }, 502);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = requireKey(env);
  if (auth.error) return auth.error;

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  try {
    const created = await createTask(input, auth.apiKey);
    if (!created.taskId) {
      return jsonResponse({ error: "Agnes 未返回 taskId", raw: created.raw }, 502);
    }

    if (input.poll === true) {
      const maxWait = Number(input.maxWaitMs) > 0 ? Number(input.maxWaitMs) : 120000;
      const polled = await pollUntilDone(created.taskId, auth.apiKey, maxWait);
      return jsonResponse({ ...polled, polled: true });
    }

    return jsonResponse({ ...created, polled: false });
  } catch (error) {
    return jsonResponse({ error: error.message || String(error) }, 502);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}
