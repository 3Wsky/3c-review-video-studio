const DEFAULT_TTS_MODEL = "mimo-v2.5-tts";
const DEFAULT_VOICE = "mimo_default";
const DEFAULT_FORMAT = "mp3";
const ALLOWED_FORMATS = ["mp3", "wav", "opus", "flac"];
const MAX_TEXT = 1200;

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
  const apiKey = env.OPENAI_API_KEY || env.LLM_API_KEY;
  const baseUrl = (env.OPENAI_BASE_URL || env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL;

  if (!apiKey) {
    return jsonResponse(
      { error: "Cloudflare Pages secret OPENAI_API_KEY is not configured" },
      501
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const text = String(input.text || "").trim().slice(0, MAX_TEXT);
  if (!text) {
    return jsonResponse({ error: "缺少要合成的口播文案 (text)" }, 400);
  }
  const voice = String(input.voice || env.OPENAI_TTS_VOICE || DEFAULT_VOICE).trim();
  const style = String(input.style || "").trim();
  let format = String(input.format || DEFAULT_FORMAT).toLowerCase();
  if (!ALLOWED_FORMATS.includes(format)) format = DEFAULT_FORMAT;

  // MiMo-TTS rule: text to synthesize goes in an `assistant` message.
  // Optional `user` message carries a natural-language style instruction.
  const messages = [];
  if (style) messages.push({ role: "user", content: style });
  messages.push({ role: "assistant", content: text });

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        audio: { format, voice }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      return jsonResponse(
        {
          error: payload.error?.message || "TTS provider request failed",
          providerStatus: response.status
        },
        502
      );
    }

    const audioData = payload.choices?.[0]?.message?.audio?.data;
    if (!audioData) {
      return jsonResponse({ error: "TTS 返回为空，未拿到音频数据" }, 502);
    }

    return jsonResponse({ audio: audioData, format, voice });
  } catch (error) {
    return jsonResponse({ error: error.message || "TTS synthesis failed" }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: { allow: "POST, OPTIONS" } });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}
