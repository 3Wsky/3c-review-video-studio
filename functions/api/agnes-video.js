// Agnes Video V2.0 代理 — 官方流程：Flash 扩写英文 prompt → ti2vid/t2v 异步任务
// 文档：https://agnes-ai.com/doc/agnes-video-v20
//
// POST { prompt, imageUrl?, imageDataUrl?, format?, durationSec?, expandPrompt?, poll? }
// GET ?taskId=xxx

import {
  createVideoTask,
  getVideoTask,
  pollVideoUntilDone
} from "../../shared/agnes/client.mjs";

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
    const result = await getVideoTask(taskId, auth.apiKey);
    return jsonResponse(result);
  } catch (error) {
    const status = error.status === 503 ? 503 : 502;
    return jsonResponse({ error: error.message || String(error) }, status);
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
    const created = await createVideoTask(input, auth.apiKey);
    if (!created.taskId) {
      return jsonResponse({ error: "Agnes 未返回 taskId", raw: created.raw }, 502);
    }

    if (input.poll === true) {
      const maxWait = Number(input.maxWaitMs) > 0 ? Number(input.maxWaitMs) : 600000;
      const interval = Number(input.pollIntervalMs) > 0 ? Number(input.pollIntervalMs) : 8000;
      const polled = await pollVideoUntilDone(created.taskId, auth.apiKey, maxWait, interval);
      return jsonResponse({ ...created, ...polled, polled: true });
    }

    return jsonResponse({ ...created, polled: false });
  } catch (error) {
    const status = error.status === 503 ? 503 : 502;
    return jsonResponse({ error: error.message || String(error) }, status);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}
