"""3C Review Video Studio · FastAPI 后端

把原本的 Cloudflare Pages Function (`functions/api/generate-timeline.js`) 逻辑
移植到 FastAPI，方便在 GitHub Codespaces 上运行。

调用 OpenAI 兼容的 LLM（DeepSeek / 小米 MiMo 等），根据产品事实 + 真实评测素材
生成结构化 Timeline JSON。

环境变量（在 Codespaces Secrets 或 .env 里配置）：
  LLM_API_KEY / OPENAI_API_KEY   必填，LLM API Key
  LLM_BASE_URL / OPENAI_BASE_URL OpenAI 兼容 base url，默认 https://api.deepseek.com
  LLM_MODEL / OPENAI_MODEL       模型名，默认 deepseek-chat
  ALLOWED_ORIGINS                允许的前端来源，逗号分隔，默认 *
"""

import json
import os
import re
import time

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

DEFAULT_MODEL = "deepseek-chat"
DEFAULT_BASE_URL = "https://api.deepseek.com"

app = FastAPI(title="3C Review Video Studio API")

_allowed = os.environ.get("ALLOWED_ORIGINS", "*").strip()
_origins = ["*"] if _allowed in ("", "*") else [o.strip() for o in _allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AssetIn(BaseModel):
    name: str | None = None
    type: str | None = None


class GenerateInput(BaseModel):
    productName: str | None = None
    category: str | None = None
    targetDuration: float | None = 90
    platform: str | None = None
    layout: str | None = "center"
    facts: str | None = None
    reviews: str | None = None
    assets: list[AssetIn] = []


class TtsInput(BaseModel):
    text: str | None = None
    voice: str | None = None
    style: str | None = None
    format: str | None = "mp3"


DEFAULT_TTS_MODEL = "mimo-v2.5-tts"
DEFAULT_TTS_VOICE = "mimo_default"
TTS_ALLOWED_FORMATS = {"mp3", "wav", "opus", "flac"}
MAX_TTS_TEXT = 1200


def clamp_text(value, max_length):
    return str(value or "")[:max_length]


def build_prompt(data: GenerateInput) -> str:
    target_duration = int(data.targetDuration or 90)
    scene_count = max(4, min(8, round(target_duration / 15)))
    asset_desc = (
        ", ".join(f"{a.name}({a.type})" for a in data.assets if a.name) or "未提供"
    )

    return f"""你是数码 3C 短视频编导，负责把产品事实、真实评测素材和产品实拍素材描述，生成一条"能让人看完"的竖屏短视频口播 Timeline JSON。

【短视频留人逻辑 · 最重要】
- 这是抖音/快手/视频号竖屏短视频，观众随时会划走，目标是让人完整看完整条 {target_duration} 秒。
- 前 5 秒定生死：第 1 个分镜必须是最强钩子，用痛点、反常识结论或直接利益点开场，第一句话就抓住人，绝不能客套、自我介绍或慢热铺垫。
- 全片按情绪曲线推进：钩子(留人) → 痛点共鸣(这说的就是我) → 悬念展开(到底行不行) → 高潮(揭晓最大价值，情绪最高点) → 反转(诚实讲短板，建立信任) → 结尾(给明确购买结论 + 一句互动引导)。
- 每个分镜结尾都要留一个"钩子/开放回路"自然引向下一镜（例如"但真正关键的在后面""先别急着下结论""这点很多人都忽略了"），不断制造继续看下去的理由。
- 节奏紧凑、口语化、多用短句，制造张力；高潮放在价值揭晓处；结尾必须有明确的"买不买/适合谁"结论，并用一句话引导关注、评论或点赞。

硬性要求：
1. 评测素材可能来自多款不同产品/品牌的网络文章，只能用来了解该品类的共性优缺点、使用场景和用户关注点。
2. 脚本必须自始至终只评测「{data.productName or "本产品"}」这一款产品，绝不能把素材里出现的其它型号名、品牌名、系列名、芯片名、价格或参数写进脚本（除非它正好就是「{data.productName or "本产品"}」本身）。
3. 必须用自己的话转述提炼，禁止照搬或粘贴素材里的原句、段落；先在 insights 里归纳该品类的优缺点与场景，再据此写口播。
4. 不得编造参数、价格、跑分、续航、芯片、降噪等级、发布日期等事实；产品名以外的具体卖点若无法确认属于本产品，一律不写。
5. 如果资料不足，必须用“资料未提供”或降低表述确定性，但仍要保持钩子和节奏，不能因此变干。
6. 口播风格：真实、有判断、有钩子、有购买建议，像一个会讲故事的数码博主，不是念说明书。
7. 第 1 个分镜（钩子）时长 3-6 秒（必须 ≤6 秒）；其余每个分镜 8-18 秒，中文短句，适合 TTS。
8. 每个分镜的 title 用节奏标签标出它在留人结构里的角色：第 1 个固定为"前5秒·钩子"，后续依次用"痛点共鸣""悬念展开""高潮·揭晓""反转·短板""结尾·结论+互动"之类（按实际镜数取舍）。
9. 输出必须是严格 JSON，不要 markdown，不要代码块，不要解释。

输出结构：
{{
  "project": {{
    "product": "...",
    "category": "...",
    "platform": "...",
    "targetDuration": 90,
    "layout": "center"
  }},
  "insights": {{
    "sourceCount": 4,
    "summary": "...",
    "pros": ["..."],
    "cons": ["..."],
    "audience": ["..."],
    "risks": ["..."]
  }},
  "timeline": [
    {{
      "id": "scene_01",
      "index": 1,
      "title": "前5秒·钩子",
      "start": 0,
      "end": 5,
      "duration": 5,
      "voiceover": "...",
      "subtitle": "...",
      "visual": {{
        "type": "真人口播 + 产品图",
        "layout": "center",
        "headline": "...",
        "detail": "...",
        "asset": "uploaded_product_asset"
      }},
      "checks": ["事实来自输入材料", "避免长句照搬", "保留人工复核位"],
      "source": "LLM 原创结构"
    }}
  ]
}}

生成 {scene_count} 个分镜，第 1 个是 3-6 秒的钩子，其余按情绪曲线展开并在每镜结尾留钩子，总时长尽量接近 {target_duration} 秒。start/end 必须连续递增，最后一个 end 等于 targetDuration。

产品名：{data.productName or "未提供"}
品类：{data.category or "未提供"}
平台：{data.platform or "未提供"}
真人布局：{data.layout or "center"}
目标时长：{target_duration}
上传素材文件名：{asset_desc}

产品事实：
{clamp_text(data.facts, 2500)}

真实评测素材（可能混有多款不同产品，仅供了解品类共性，不要照搬其中的具体型号/品牌/参数）：
{clamp_text(data.reviews, 4500)}"""


def strip_json_fence(content: str) -> str:
    text = str(content or "").strip()
    text = re.sub(r"^```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _num(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_timeline(data: dict, src: GenerateInput) -> dict:
    project = data.get("project") or {}
    target_duration = _num(src.targetDuration, None) or _num(project.get("targetDuration"), 90) or 90

    timeline = data.get("timeline")
    if not isinstance(timeline, list) or not timeline:
        raise ValueError("LLM response missing timeline")

    scene_duration = target_duration / len(timeline)
    cursor = 0.0
    normalized = []
    for index, scene in enumerate(timeline):
        is_last = index == len(timeline) - 1
        start = _num(scene.get("start"), cursor)
        if is_last:
            end = target_duration
        else:
            end = _num(scene.get("end"), start + scene_duration)
        cursor = end

        voiceover = str(scene.get("voiceover") or scene.get("subtitle") or "").strip()
        visual = scene.get("visual") or {}
        checks = scene.get("checks")
        normalized.append(
            {
                "id": scene.get("id") or f"scene_{str(index + 1).zfill(2)}",
                "index": index + 1,
                "title": scene.get("title") or f"分镜 {index + 1}",
                "start": round(start, 2),
                "end": round(end, 2),
                "duration": round(end - start, 2),
                "voiceover": voiceover,
                "subtitle": scene.get("subtitle") or voiceover,
                "visual": {
                    "type": visual.get("type") or "产品图 + 字幕卡",
                    "layout": visual.get("layout") or src.layout or "center",
                    "headline": visual.get("headline") or scene.get("title") or "核心观点",
                    "detail": visual.get("detail") or "根据输入素材生成",
                    "asset": visual.get("asset") or "uploaded_product_asset",
                },
                "checks": checks
                if isinstance(checks, list)
                else ["事实来自输入材料", "避免长句照搬", "保留人工复核位"],
                "source": scene.get("source") or "Codespaces LLM",
            }
        )

    insights = data.get("insights") or {}
    review_lines = [ln for ln in re.split(r"\n+", str(src.reviews or "")) if ln.strip()]
    return {
        "project": {
            "product": project.get("product") or src.productName or "",
            "category": project.get("category") or src.category or "",
            "platform": project.get("platform") or src.platform or "",
            "targetDuration": target_duration,
            "layout": project.get("layout") or src.layout or "center",
        },
        "insights": {
            "sourceCount": insights.get("sourceCount") or len(review_lines),
            "summary": insights.get("summary") or "",
            "pros": insights.get("pros") if isinstance(insights.get("pros"), list) else [],
            "cons": insights.get("cons") if isinstance(insights.get("cons"), list) else [],
            "audience": insights.get("audience") if isinstance(insights.get("audience"), list) else [],
            "risks": insights.get("risks") if isinstance(insights.get("risks"), list) else [],
        },
        "timeline": normalized,
    }


ZHIHU_SEARCH_URL = "https://developer.zhihu.com/api/v1/content/zhihu_search"


def _strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", str(value or ""))
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
    )
    return re.sub(r"\s+", " ", text).strip()


def _clamp_count(value) -> int:
    n = _num(value, 10) or 10
    n = int(n)
    if n <= 0:
        return 10
    return min(10, n)


def _normalize_zhihu_items(items) -> list[dict]:
    out = []
    for item in items or []:
        comments = [
            _strip_html(c.get("Content"))
            for c in (item.get("CommentInfoList") or [])
            if _strip_html(c.get("Content"))
        ]
        out.append(
            {
                "title": _strip_html(item.get("Title")),
                "type": item.get("ContentType") or "",
                "contentId": item.get("ContentID") or "",
                "summary": _strip_html(item.get("ContentText")),
                "url": item.get("Url") or "",
                "voteUp": int(_num(item.get("VoteUpCount"), 0) or 0),
                "commentCount": int(_num(item.get("CommentCount"), 0) or 0),
                "author": _strip_html(item.get("AuthorName")),
                "authorBadge": _strip_html(item.get("AuthorBadgeText")),
                "editTime": int(_num(item.get("EditTime"), 0) or 0),
                "comments": comments,
            }
        )
    return out


def _build_zhihu_material(query: str, items: list[dict]) -> str:
    if not items:
        return ""
    blocks = []
    for index, item in enumerate(items):
        lines = [
            f"【{index + 1}. {item['title'] or '无标题'}】(赞同 {item['voteUp']} · 评论 {item['commentCount']})",
            item["summary"],
        ]
        if item["comments"]:
            lines.append("精选评论：" + " / ".join(item["comments"][:3]))
        if item["url"]:
            lines.append(f"来源：{item['url']}")
        blocks.append("\n".join(ln for ln in lines if ln))
    return f"知乎搜索「{query}」相关内容（共 {len(items)} 条）：\n\n" + "\n\n".join(blocks)


@app.get("/api/health")
async def health():
    has_key = bool(os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY"))
    model = os.environ.get("LLM_MODEL") or os.environ.get("OPENAI_MODEL") or DEFAULT_MODEL
    has_zhihu = bool(os.environ.get("ZHIHU_ACCESS_SECRET") or os.environ.get("ZHIHU_ACCESS_TOKEN"))
    return {"ok": True, "hasApiKey": has_key, "model": model, "hasZhihu": has_zhihu}


@app.get("/api/zhihu-search")
async def zhihu_search(q: str = "", query: str = "", count: int = 10):
    access_secret = os.environ.get("ZHIHU_ACCESS_SECRET") or os.environ.get("ZHIHU_ACCESS_TOKEN")
    if not access_secret:
        return JSONResponse(
            {
                "error": "知乎 Access Secret 未配置。请设置环境变量 ZHIHU_ACCESS_SECRET"
                "（在 https://developer.zhihu.com/profile 获取）。"
            },
            status_code=501,
        )

    keyword = (q or query or "").strip()
    if not keyword:
        return JSONResponse({"error": "缺少搜索关键词 q"}, status_code=400)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                ZHIHU_SEARCH_URL,
                params={"Query": keyword, "Count": _clamp_count(count)},
                headers={
                    "authorization": f"Bearer {access_secret}",
                    "x-request-timestamp": str(int(time.time())),
                    "content-type": "application/json",
                },
            )
    except httpx.HTTPError as error:
        return JSONResponse({"error": f"无法连接知乎服务: {error}"}, status_code=502)

    try:
        payload = response.json()
    except ValueError:
        return JSONResponse(
            {"error": "知乎返回非 JSON", "providerStatus": response.status_code},
            status_code=502,
        )

    if response.status_code >= 400 or payload.get("Code") != 0:
        return JSONResponse(
            {
                "error": payload.get("Message") or "知乎搜索接口返回错误",
                "code": payload.get("Code"),
                "providerStatus": response.status_code,
            },
            status_code=502,
        )

    data = payload.get("Data") or {}
    items = _normalize_zhihu_items(data.get("Items"))
    return {
        "query": keyword,
        "count": len(items),
        "searchHashId": data.get("SearchHashId") or "",
        "emptyReason": data.get("EmptyReason") or "",
        "items": items,
        "material": _build_zhihu_material(keyword, items),
    }


@app.post("/api/generate-timeline")
async def generate_timeline(data: GenerateInput):
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    base_url = (
        os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or DEFAULT_BASE_URL
    ).rstrip("/")
    model = os.environ.get("LLM_MODEL") or os.environ.get("OPENAI_MODEL") or DEFAULT_MODEL

    if not api_key:
        return JSONResponse(
            {"error": "LLM_API_KEY (或 OPENAI_API_KEY) 未配置"}, status_code=501
        )

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "authorization": f"Bearer {api_key}",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0.55,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {
                            "role": "system",
                            "content": "你只输出严格 JSON。不要输出 markdown、代码块或解释。",
                        },
                        {"role": "user", "content": build_prompt(data)},
                    ],
                },
            )
    except httpx.HTTPError as error:
        return JSONResponse({"error": f"无法连接 LLM 服务: {error}"}, status_code=502)

    try:
        payload = response.json()
    except ValueError:
        return JSONResponse(
            {"error": "LLM 返回非 JSON", "providerStatus": response.status_code},
            status_code=502,
        )

    if response.status_code >= 400:
        message = (payload.get("error") or {})
        message = message.get("message") if isinstance(message, dict) else None
        return JSONResponse(
            {"error": message or "LLM provider request failed", "providerStatus": response.status_code},
            status_code=502,
        )

    try:
        content = payload["choices"][0]["message"]["content"]
        parsed = json.loads(strip_json_fence(content))
        return normalize_timeline(parsed, data)
    except (KeyError, IndexError, ValueError) as error:
        return JSONResponse({"error": f"Timeline 生成失败: {error}"}, status_code=500)


@app.post("/api/tts")
async def tts(data: TtsInput):
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    base_url = (
        os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or DEFAULT_BASE_URL
    ).rstrip("/")
    model = os.environ.get("OPENAI_TTS_MODEL") or DEFAULT_TTS_MODEL

    if not api_key:
        return JSONResponse(
            {"error": "LLM_API_KEY (或 OPENAI_API_KEY) 未配置"}, status_code=501
        )

    text = (data.text or "").strip()[:MAX_TTS_TEXT]
    if not text:
        return JSONResponse({"error": "缺少要合成的口播文案 (text)"}, status_code=400)

    voice = (data.voice or os.environ.get("OPENAI_TTS_VOICE") or DEFAULT_TTS_VOICE).strip()
    style = (data.style or "").strip()
    fmt = (data.format or "mp3").lower()
    if fmt not in TTS_ALLOWED_FORMATS:
        fmt = "mp3"

    # MiMo-TTS rule: text to synthesize goes in an `assistant` message.
    # Optional `user` message carries a natural-language style instruction.
    messages = []
    if style:
        messages.append({"role": "user", "content": style})
    messages.append({"role": "assistant", "content": text})

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "authorization": f"Bearer {api_key}",
                    "api-key": api_key,
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "audio": {"format": fmt, "voice": voice},
                },
            )
    except httpx.HTTPError as error:
        return JSONResponse({"error": f"无法连接 TTS 服务: {error}"}, status_code=502)

    try:
        payload = response.json()
    except ValueError:
        return JSONResponse(
            {"error": "TTS 返回非 JSON", "providerStatus": response.status_code},
            status_code=502,
        )

    if response.status_code >= 400:
        message = (payload.get("error") or {})
        message = message.get("message") if isinstance(message, dict) else None
        return JSONResponse(
            {"error": message or "TTS provider request failed", "providerStatus": response.status_code},
            status_code=502,
        )

    try:
        audio_data = payload["choices"][0]["message"]["audio"]["data"]
    except (KeyError, IndexError, TypeError):
        audio_data = None
    if not audio_data:
        return JSONResponse({"error": "TTS 返回为空，未拿到音频数据"}, status_code=502)

    return {"audio": audio_data, "format": fmt, "voice": voice}
