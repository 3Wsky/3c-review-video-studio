// 把前端的渲染请求转发到自部署的渲染 worker (RENDER_URL)。
// worker 一站式：收 Timeline JSON + 音色 → 逐镜配音+按真实时长校准 → 渲染 → 混音 → 返回 MP4。
// 与 backend/main.py 的 /api/render 行为保持一致。GPU 机离线/未配置时给明确提示，不卡死。

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const renderUrl = String(env.RENDER_URL || "").trim().replace(/\/$/, "");
  if (!renderUrl) {
    return jsonResponse(
      { error: "渲染服务未配置（请设置环境变量 RENDER_URL 指向你的渲染 worker）" },
      501
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const timeline = input && input.timeline;
  if (!timeline || !Array.isArray(timeline.timeline) || timeline.timeline.length === 0) {
    return jsonResponse({ error: "缺少 Timeline（timeline.timeline 至少要有一个分镜）" }, 400);
  }

  const payload = {
    timeline,
    voice: input.voice || "mimo_default",
    cloneSpkId: input.cloneSpkId || "",
    gpu: input.gpu !== false, // 默认让 worker 用 GPU；worker 端不支持会自动软件渲染
    autoStock: Boolean(input.autoStock),
    format: input.format || "9:16", // 多端裁剪：9:16 / 16:9 / 1:1
    assets: input.assets || undefined
  };

  let resp;
  try {
    resp = await fetch(`${renderUrl}/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    return jsonResponse(
      { error: `无法连接渲染服务（可能 GPU 机没开机）：${error.message || error}` },
      502
    );
  }

  // worker 三种返回：
  //   - JSON 且 ok+url（配了 R2）：成片已传 R2，透传 { ok, url, ... } 给前端（可播/下载/分享）。
  //   - JSON 出错：转成 { error } 返回。
  //   - video/mp4 二进制（没配 R2）：直接透传下载。
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    let payloadJson;
    try {
      payloadJson = await resp.json();
    } catch {
      payloadJson = { error: "渲染服务返回异常", providerStatus: resp.status };
    }
    if (resp.ok && payloadJson && payloadJson.ok && payloadJson.url) {
      return jsonResponse(payloadJson, 200);
    }
    return jsonResponse(
      { error: payloadJson.error || "渲染失败", providerStatus: resp.status },
      resp.ok ? 502 : resp.status
    );
  }
  if (!resp.ok) {
    return jsonResponse({ error: "渲染失败", providerStatus: resp.status }, resp.status);
  }

  return new Response(resp.body, {
    status: 200,
    headers: {
      "content-type": "video/mp4",
      "content-disposition": 'attachment; filename="3c-review.mp4"'
    }
  });
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: { allow: "POST, OPTIONS" } });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}
