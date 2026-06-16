function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const llmOk = Boolean(env.OPENAI_API_KEY || env.LLM_API_KEY);
  const zhihuOk = Boolean(env.ZHIHU_ACCESS_SECRET);
  const renderUrl = (env.RENDER_URL || "").replace(/\/$/, "");
  const voiceUrl = (env.VOICE_CLONE_URL || "").replace(/\/$/, "");
  const agnesOk = Boolean(env.AGNES_API_KEY);

  const probes = {
    llm: llmOk ? "configured" : "missing",
    zhihu: zhihuOk ? "configured" : "missing",
    render: renderUrl ? "configured" : "missing",
    voiceClone: voiceUrl ? "configured" : "missing",
    agnes: agnesOk ? "configured" : "missing"
  };

  return jsonResponse({
    ok: true,
    service: "3c-review-video-studio",
    probes,
    renderDirectUrl: (env.RENDER_PUBLIC_URL || renderUrl || "").replace(/\/$/, ""),
    timestamp: new Date().toISOString()
  });
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: { allow: "GET, OPTIONS" } });
  }
  if (context.request.method === "GET") return onRequestGet(context);
  return jsonResponse({ error: "Method not allowed" }, 405);
}
