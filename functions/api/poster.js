// 多端裁剪：把「封面 + 小红书图文版」请求转发到渲染 worker (RENDER_URL) 的 /poster。
// worker 抽静帧（hyperframes snapshot）+ 生成小红书文案，不出视频，比渲染快、不吃 GPU。
// 始终返回 JSON：{ ok, format, cover, images:[{url|dataUrl,...}], caption:{title,body,tags,text}, hosted }。
// 与 backend/main.py 的 /api/poster 行为保持一致。

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
    format: input.format || "1:1", // 小红书图文默认方图，可传 9:16 出竖屏封面
    frames: input.frames || undefined,
    autoStock: Boolean(input.autoStock),
    assets: input.assets || undefined
  };

  let resp;
  try {
    resp = await fetch(`${renderUrl}/poster`, {
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

  let body;
  try {
    body = await resp.json();
  } catch {
    body = { error: "渲染服务返回异常", providerStatus: resp.status };
  }
  if (resp.ok && body && body.ok) {
    return jsonResponse(body, 200);
  }
  return jsonResponse(
    { error: (body && body.error) || "图文导出失败", providerStatus: resp.status },
    resp.ok ? 502 : resp.status
  );
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: { allow: "POST, OPTIONS" } });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}
