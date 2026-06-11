import {
  buildGenerateTimelinePrompt,
  normalizeTimelineResponse,
  stripJsonFence
} from "../../shared/prompts/generate-timeline.mjs";

const DEFAULT_MODEL = "gpt-4o-mini";

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
  const model = env.OPENAI_MODEL || env.LLM_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    return jsonResponse(
      {
        error: "Cloudflare Pages secret OPENAI_API_KEY is not configured"
      },
      501
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你只输出严格 JSON。不要输出 markdown、代码块或解释。"
          },
          {
            role: "user",
            content: buildGenerateTimelinePrompt(input)
          }
        ]
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      return jsonResponse(
        {
          error: payload.error?.message || "LLM provider request failed",
          providerStatus: response.status
        },
        502
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    const parsed = JSON.parse(stripJsonFence(content));
    return jsonResponse(normalizeTimelineResponse(parsed, input));
  } catch (error) {
    return jsonResponse(
      {
        error: error.message || "Timeline generation failed"
      },
      500
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        allow: "POST, OPTIONS"
      }
    });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}
