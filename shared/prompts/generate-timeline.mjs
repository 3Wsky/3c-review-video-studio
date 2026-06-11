import { sanitizeDataviz, sanitizeTransition, sanitizeRadar } from "../dataviz/geometry.mjs";

/** @param {string} value @param {number} maxLength */
export function clampText(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}

/** @param {Record<string, unknown>} input */
export function buildGenerateTimelinePrompt(input) {
  const targetDuration = Number(input.targetDuration || 90);
  const sceneCount = Math.max(4, Math.min(8, Math.round(targetDuration / 15)));

  return `你是数码 3C 短视频编导，负责把产品事实、真实评测素材和产品实拍素材描述，生成一条"能让人看完"的竖屏短视频口播 Timeline JSON。

【短视频留人逻辑 · 最重要】
- 这是抖音/快手/视频号竖屏短视频，观众随时会划走，目标是让人完整看完整条 ${targetDuration} 秒。
- 前 5 秒定生死：第 1 个分镜必须是最强钩子，用痛点、反常识结论或直接利益点开场，第一句话就抓住人，绝不能客套、自我介绍或慢热铺垫。
- 全片按情绪曲线推进：钩子(留人) → 痛点共鸣(这说的就是我) → 悬念展开(到底行不行) → 高潮(揭晓最大价值，情绪最高点) → 反转(诚实讲短板，建立信任) → 结尾(给明确购买结论 + 一句互动引导)。
- 每个分镜结尾都要留一个"钩子/开放回路"自然引向下一镜（例如"但真正关键的在后面""先别急着下结论""这点很多人都忽略了"），不断制造继续看下去的理由。
- 节奏紧凑、口语化、多用短句，制造张力；高潮放在价值揭晓处；结尾必须有明确的"买不买/适合谁"结论，并用一句话引导关注、评论或点赞。

硬性要求：
1. 评测素材可能来自多款不同产品/品牌的网络文章，只能用来了解该品类的共性优缺点、使用场景和用户关注点。
2. 脚本必须自始至终只评测「${input.productName || "本产品"}」这一款产品，绝不能把素材里出现的其它型号名、品牌名、系列名、芯片名、价格或参数写进脚本（除非它正好就是「${input.productName || "本产品"}」本身）。
3. 必须用自己的话转述提炼，禁止照搬或粘贴素材里的原句、段落；先在 insights 里归纳该品类的优缺点与场景，再据此写口播。
4. 不得编造参数、价格、跑分、续航、芯片、降噪等级、发布日期等事实；产品名以外的具体卖点若无法确认属于本产品，一律不写。
5. 如果资料不足，必须用“资料未提供”或降低表述确定性，但仍要保持钩子和节奏，不能因此变干。
6. 口播风格：真实、有判断、有钩子、有购买建议，像一个会讲故事的数码博主，不是念说明书。
7. 第 1 个分镜（钩子）时长 3-6 秒（必须 ≤6 秒）；其余每个分镜 8-18 秒，中文短句，适合 TTS。
8. 每个分镜的 title 用节奏标签标出它在留人结构里的角色：第 1 个固定为"前5秒·钩子"，后续依次用"痛点共鸣""悬念展开""高潮·揭晓""反转·短板""结尾·结论+互动"之类（按实际镜数取舍）。
9. 输出必须是严格 JSON，不要 markdown，不要代码块，不要解释。
10. 数据图表（可选，仅在有真实数字时）：若「产品事实」里有 2 个以上可对比的真实数值参数（如多场景续航小时数、不同模式重量/价格/跑分），可给最适合的 1-2 个分镜的 visual 追加 "dataviz" 字段，渲成动画图表：{"kind":"bar","title":"实测续航","unit":"小时","items":[{"label":"轻度使用","value":14},{"label":"重度使用","value":8}]}。kind 选择：同单位多项对比用 "bar"；单项对上限的占比用 "ring"（item 可带 "max"）；3-6 个维度的综合表现用 "radar"（每项必须带 "max" 作满分）。数字必须逐字来自「产品事实」，绝不允许编造、推算或从评测素材里抄其它产品的数；「产品事实」没有足够数字就完全不输出 dataviz 字段。
11. 镜头转场（可选）：每镜 visual 可带 "transition": {"in": "speed-line"} 标注入场动效，可选 "speed-line"（疾速白线，适合钩子/高潮/节奏加速处）或 "scan-wipe"（科技扫描线，适合悬念展开/参数揭晓处）。按情绪曲线制造感官切换，高潮与反转处优先，不必每镜都加。

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
      "title": "前5秒·钩子",
      "start": 0,
      "end": 5,
      "duration": 5,
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

生成 ${sceneCount} 个分镜，第 1 个是 3-6 秒的钩子，其余按情绪曲线展开并在每镜结尾留钩子，总时长尽量接近 ${targetDuration} 秒。start/end 必须连续递增，最后一个 end 等于 targetDuration。

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

/** @param {string} content */
export function stripJsonFence(content) {
  return String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** @param {Record<string, unknown>} data @param {Record<string, unknown>} input */
export function normalizeTimelineResponse(data, input) {
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
    const dataviz = sanitizeDataviz(scene.visual?.dataviz);
    const transition = sanitizeTransition(scene.visual?.transition);
    const radar = sanitizeRadar(scene.visual?.radar);
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
        asset: scene.visual?.asset || "uploaded_product_asset",
        ...(dataviz ? { dataviz } : {}),
        ...(transition ? { transition } : {}),
        ...(radar ? { radar } : {})
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
      sourceCount:
        data.insights?.sourceCount || String(input.reviews || "").split(/\n+/).filter(Boolean).length,
      summary: data.insights?.summary || "",
      pros: Array.isArray(data.insights?.pros) ? data.insights.pros : [],
      cons: Array.isArray(data.insights?.cons) ? data.insights.cons : [],
      audience: Array.isArray(data.insights?.audience) ? data.insights.audience : [],
      risks: Array.isArray(data.insights?.risks) ? data.insights.risks : []
    },
    timeline: normalized
  };
}
