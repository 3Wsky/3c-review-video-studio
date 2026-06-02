// 把前端上传的录音 + 文字转发到自部署的 CosyVoice 服务 (VOICE_CLONE_URL) 克隆音色。
// 与 backend/main.py 的 /api/voice-enroll 行为保持一致。

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cloneUrl = String(env.VOICE_CLONE_URL || "").trim().replace(/\/$/, "");
  if (!cloneUrl) {
    return jsonResponse(
      { error: "克隆音色服务未配置（请设置环境变量 VOICE_CLONE_URL 指向 CosyVoice 服务）" },
      501
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: "请用 multipart/form-data 上传 audio + prompt_text" }, 400);
  }

  const audio = form.get("audio");
  const promptText = String(form.get("prompt_text") || "").trim();
  if (!audio || typeof audio === "string") {
    return jsonResponse({ error: "缺少音频文件 audio" }, 400);
  }
  if (!promptText) {
    return jsonResponse({ error: "缺少录音文字 prompt_text（这段录音里你说了什么）" }, 400);
  }

  const forward = new FormData();
  forward.append("audio", audio, audio.name || "voice.wav");
  forward.append("prompt_text", promptText);
  const spkId = String(form.get("spk_id") || "").trim();
  if (spkId) forward.append("spk_id", spkId);

  try {
    const resp = await fetch(`${cloneUrl}/enroll`, { method: "POST", body: forward });
    const payload = await resp.json();
    if (!resp.ok || !payload.spkId) {
      return jsonResponse(
        { error: payload.error || "音色克隆失败", providerStatus: resp.status },
        502
      );
    }
    return jsonResponse({ spkId: payload.spkId, promptText: payload.promptText || promptText });
  } catch (error) {
    return jsonResponse({ error: error.message || "无法连接克隆语音服务" }, 502);
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: { allow: "POST, OPTIONS" } });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}
