const DEFAULT_MODEL = "gpt-4o-mini";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function clampText(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}

function stripJsonFence(content) {
  return String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function buildRewritePrompt(input) {
  const scene = input.scene || {};
  const product = input.productName || "本产品";
  const role = scene.title || "这一镜";
  const duration = Number(scene.duration || (scene.end - scene.start) || 10);
  const note = String(input.note || "").trim();

  return `你是数码 3C 短视频编导。现在只需要重写一条竖屏短视频里的【单个分镜】，其它分镜保持不动。

【这一镜在留人结构中的角色】${role}
【这一镜目标时长】约 ${duration} 秒（中文短句，适合 TTS 朗读，不要超过这个时长能念完的字数）
【整条视频的产品】只能评测「${product}」，绝不能写进其它型号/品牌/系列/芯片/价格/参数。

【上下文（不要改写它们，只用来衔接）】
- 上一镜口播：${clampText(input.prevVoiceover, 300) || "（无，这是第一镜）"}
- 下一镜标题：${input.nextTitle || "（无，这是最后一镜）"}

【重写要求】
1. 保持这一镜原本的留人角色与情绪定位（钩子就要抓人，高潮就要情绪最高，反转就要诚实讲短板，结尾就要给结论+互动）。
2. 用自己的话写，口语化、多短句、有张力；结尾留一个自然引向下一镜的开放回路钩子（最后一镜则给明确购买结论 + 一句互动引导）。
3. 不得编造参数、价格、跑分、续航、芯片、降噪等级等事实；资料不足就降低确定性或说“资料未提供”，但仍要保持钩子和节奏。
4. 必须给出一个和原来不同的新版本（换个角度/说法/钩子），不要原样返回。${note ? `\n5. 额外要求：${note}` : ""}

【输出】严格 JSON，不要 markdown、不要代码块、不要解释：
{
  "title": "${role}",
  "voiceover": "重写后的口播文案",
  "subtitle": "用于字幕的精简版（可与口播相同）",
  "visual": {
    "type": "${scene.visual?.type || "真人口播 + 产品图"}",
    "headline": "画面大字标题（短）",
    "detail": "画面说明（短）"
  }
}

产品名：${product}
品类：${input.category || "未提供"}
平台：${input.platform || "未提供"}

产品事实：
${clampText(input.facts, 1800)}

真实评测素材（可能混有多款产品，仅供了解品类共性，不要照搬其中型号/品牌/参数）：
${clampText(input.reviews, 2500)}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.OPENAI_API_KEY || env.LLM_API_KEY;
  const baseUrl = (env.OPENAI_BASE_URL || env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = env.OPENAI_MODEL || env.LLM_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    return jsonResponse({ error: "Cloudflare Pages secret OPENAI_API_KEY is not configured" }, 501);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!input.scene) {
    return jsonResponse({ error: "缺少要重写的镜头 (scene)" }, 400);
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
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你只输出严格 JSON。不要输出 markdown、代码块或解释。" },
          { role: "user", content: buildRewritePrompt(input) }
        ]
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      return jsonResponse(
        { error: payload.error?.message || "LLM provider request failed", providerStatus: response.status },
        502
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    const parsed = JSON.parse(stripJsonFence(content));
    const voiceover = String(parsed.voiceover || parsed.subtitle || "").trim();
    if (!voiceover) {
      return jsonResponse({ error: "重写返回为空" }, 502);
    }

    return jsonResponse({
      title: String(parsed.title || input.scene.title || "").trim(),
      voiceover,
      subtitle: String(parsed.subtitle || voiceover).trim(),
      visual: {
        type: String(parsed.visual?.type || input.scene.visual?.type || "真人口播 + 产品图").trim(),
        headline: String(parsed.visual?.headline || "").trim(),
        detail: String(parsed.visual?.detail || "").trim()
      }
    });
  } catch (error) {
    return jsonResponse({ error: error.message || "Scene rewrite failed" }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: { allow: "POST, OPTIONS" } });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}
