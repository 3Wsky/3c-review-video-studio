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

function buildPrompt(input) {
  const targetDuration = Number(input.targetDuration || 90);
  const sceneCount = Math.max(4, Math.min(8, Math.round(targetDuration / 15)));

  return `你是数码 3C 技术博主编导，负责把产品事实、真实评测素材和产品实拍素材描述，生成原创口播视频的 Timeline JSON。

硬性要求：
1. 评测素材可能来自多款不同产品/品牌的网络文章，只能用来了解该品类的共性优缺点、使用场景和用户关注点。
2. 脚本必须自始至终只评测「${input.productName || "本产品"}」这一款产品，绝不能把素材里出现的其它型号名、品牌名、系列名、芯片名、价格或参数写进脚本（除非它正好就是「${input.productName || "本产品"}」本身）。
3. 必须用自己的话转述提炼，禁止照搬或粘贴素材里的原句、段落；先在 insights 里归纳该品类的优缺点与场景，再据此写口播。
4. 不得编造参数、价格、跑分、续航、芯片、降噪等级、发布日期等事实；产品名以外的具体卖点若无法确认属于本产品，一律不写。
5. 如果资料不足，必须用“资料未提供”或降低表述确定性。
6. 口播风格要像真实技术博主：直接、克制、有判断、有购买建议。
7. 每个分镜 8-18 秒，中文短句，适合 TTS。
8. 输出必须是严格 JSON，不要 markdown，不要代码块，不要解释。

输出结构：
{
  "project": {
    "product": "...",
    "category": "...",
    "platform": "...",
    "targetDuration": 90,
    "layout": "center"
  },
  "insights": {
    "sourceCount": 4,
    "summary": "...",
    "pros": ["..."],
    "cons": ["..."],
    "audience": ["..."],
    "risks": ["..."]
  },
  "timeline": [
    {
      "id": "scene_01",
      "index": 1,
      "title": "开场结论",
      "start": 0,
      "end": 12,
      "duration": 12,
      "voiceover": "...",
      "subtitle": "...",
      "visual": {
        "type": "真人口播 + 产品图",
        "layout": "center",
        "headline": "...",
        "detail": "...",
        "asset": "uploaded_product_asset"
      },
      "checks": ["事实来自输入材料", "避免长句照搬", "保留人工复核位"],
      "source": "LLM 原创结构"
    }
  ]
}

生成 ${sceneCount} 个分镜，总时长尽量接近 ${targetDuration} 秒。start/end 必须连续递增，最后一个 end 等于 targetDuration。

产品名：${input.productName || "未提供"}
品类：${input.category || "未提供"}
平台：${input.platform || "未提供"}
真人布局：${input.layout || "center"}
目标时长：${targetDuration}
上传素材文件名：${(input.assets || []).map((asset) => `${asset.name}(${asset.type})`).join(", ") || "未提供"}

产品事实：
${clampText(input.facts, 2500)}

真实评测素材（可能混有多款不同产品，仅供了解品类共性，不要照搬其中的具体型号/品牌/参数）：
${clampText(input.reviews, 4500)}`;
}

function stripJsonFence(content) {
  return String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeTimeline(data, input) {
  const targetDuration = Number(input.targetDuration || data.project?.targetDuration || 90);
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  if (!timeline.length) throw new Error("LLM response missing timeline");

  const sceneDuration = targetDuration / timeline.length;
  let cursor = 0;
  const normalized = timeline.map((scene, index) => {
    const isLast = index === timeline.length - 1;
    const start = Number.isFinite(Number(scene.start)) ? Number(scene.start) : cursor;
    const end = isLast
      ? targetDuration
      : Number.isFinite(Number(scene.end))
        ? Number(scene.end)
        : start + sceneDuration;
    cursor = end;

    const voiceover = String(scene.voiceover || scene.subtitle || "").trim();
    return {
      id: scene.id || `scene_${String(index + 1).padStart(2, "0")}`,
      index: index + 1,
      title: scene.title || `分镜 ${index + 1}`,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2)),
      voiceover,
      subtitle: scene.subtitle || voiceover,
      visual: {
        type: scene.visual?.type || "产品图 + 字幕卡",
        layout: scene.visual?.layout || input.layout || "center",
        headline: scene.visual?.headline || scene.title || "核心观点",
        detail: scene.visual?.detail || "根据输入素材生成",
        asset: scene.visual?.asset || "uploaded_product_asset"
      },
      checks: Array.isArray(scene.checks)
        ? scene.checks
        : ["事实来自输入材料", "避免长句照搬", "保留人工复核位"],
      source: scene.source || "Cloudflare LLM"
    };
  });

  return {
    project: {
      product: data.project?.product || input.productName || "",
      category: data.project?.category || input.category || "",
      platform: data.project?.platform || input.platform || "",
      targetDuration,
      layout: data.project?.layout || input.layout || "center"
    },
    insights: {
      sourceCount: data.insights?.sourceCount || String(input.reviews || "").split(/\n+/).filter(Boolean).length,
      summary: data.insights?.summary || "",
      pros: Array.isArray(data.insights?.pros) ? data.insights.pros : [],
      cons: Array.isArray(data.insights?.cons) ? data.insights.cons : [],
      audience: Array.isArray(data.insights?.audience) ? data.insights.audience : [],
      risks: Array.isArray(data.insights?.risks) ? data.insights.risks : []
    },
    timeline: normalized
  };
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
            content: buildPrompt(input)
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
    return jsonResponse(normalizeTimeline(parsed, input));
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
