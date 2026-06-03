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
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
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
    cloneSpkId: str | None = None


class RenderInput(BaseModel):
    timeline: dict | None = None
    voice: str | None = "mimo_default"
    cloneSpkId: str | None = None
    gpu: bool | None = True
    assets: dict | None = None
    autoStock: bool | None = False


class RewriteSceneInput(BaseModel):
    productName: str | None = None
    category: str | None = None
    platform: str | None = None
    facts: str | None = None
    reviews: str | None = None
    scene: dict | None = None
    prevVoiceover: str | None = None
    nextTitle: str | None = None
    note: str | None = None


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
    return {
        "ok": True,
        "hasApiKey": has_key,
        "model": model,
        "hasZhihu": has_zhihu,
        "hasVoiceClone": bool(_voice_clone_url()),
        "hasRender": bool(_render_url()),
        "hasStock": bool(_stock_keys("PEXELS_API_KEY") or _stock_keys("PIXABAY_API_KEY")),
    }


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


def _voice_clone_url() -> str:
    return (os.environ.get("VOICE_CLONE_URL") or "").strip().rstrip("/")


@app.post("/api/tts")
async def tts(data: TtsInput):
    text = (data.text or "").strip()[:MAX_TTS_TEXT]
    if not text:
        return JSONResponse({"error": "缺少要合成的口播文案 (text)"}, status_code=400)

    # 克隆音色分支：转发到自部署的 CosyVoice 服务（VOICE_CLONE_URL）
    if (data.voice or "").strip().startswith("clone") or data.cloneSpkId:
        clone_url = _voice_clone_url()
        if not clone_url:
            return JSONResponse(
                {"error": "克隆音色服务未配置（请设置环境变量 VOICE_CLONE_URL 指向 CosyVoice 服务）"},
                status_code=501,
            )
        spk_id = (data.cloneSpkId or "").strip()
        if not spk_id:
            return JSONResponse({"error": "缺少克隆音色 cloneSpkId（请先上传录音克隆音色）"}, status_code=400)
        fmt = (data.format or "wav").lower()
        if fmt not in TTS_ALLOWED_FORMATS:
            fmt = "wav"
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                response = await client.post(
                    f"{clone_url}/tts",
                    json={"text": text, "spk_id": spk_id, "format": fmt},
                )
        except httpx.HTTPError as error:
            return JSONResponse({"error": f"无法连接克隆语音服务: {error}"}, status_code=502)
        try:
            payload = response.json()
        except ValueError:
            return JSONResponse(
                {"error": "克隆语音服务返回非 JSON", "providerStatus": response.status_code},
                status_code=502,
            )
        if response.status_code >= 400 or not payload.get("audio"):
            return JSONResponse(
                {"error": payload.get("error") or "克隆语音合成失败", "providerStatus": response.status_code},
                status_code=502,
            )
        return {"audio": payload["audio"], "format": payload.get("format") or fmt, "voice": "clone"}

    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    base_url = (
        os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or DEFAULT_BASE_URL
    ).rstrip("/")
    model = os.environ.get("OPENAI_TTS_MODEL") or DEFAULT_TTS_MODEL

    if not api_key:
        return JSONResponse(
            {"error": "LLM_API_KEY (或 OPENAI_API_KEY) 未配置"}, status_code=501
        )

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


@app.post("/api/voice-enroll")
async def voice_enroll(
    audio: UploadFile = File(...),
    prompt_text: str = Form(...),
    spk_id: str | None = Form(None),
):
    """把上传的录音 + 文字转发到自部署的 CosyVoice 服务克隆音色，返回 spkId。"""
    clone_url = _voice_clone_url()
    if not clone_url:
        return JSONResponse(
            {"error": "克隆音色服务未配置（请设置环境变量 VOICE_CLONE_URL 指向 CosyVoice 服务）"},
            status_code=501,
        )
    if not (prompt_text or "").strip():
        return JSONResponse({"error": "缺少录音文字 prompt_text（这段录音里你说了什么）"}, status_code=400)

    raw = await audio.read()
    if not raw:
        return JSONResponse({"error": "音频为空"}, status_code=400)

    files = {"audio": (audio.filename or "voice.wav", raw, audio.content_type or "application/octet-stream")}
    form = {"prompt_text": prompt_text}
    if (spk_id or "").strip():
        form["spk_id"] = spk_id.strip()

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(f"{clone_url}/enroll", data=form, files=files)
    except httpx.HTTPError as error:
        return JSONResponse({"error": f"无法连接克隆语音服务: {error}"}, status_code=502)

    try:
        payload = response.json()
    except ValueError:
        return JSONResponse(
            {"error": "克隆语音服务返回非 JSON", "providerStatus": response.status_code},
            status_code=502,
        )
    if response.status_code >= 400 or not payload.get("spkId"):
        return JSONResponse(
            {"error": payload.get("error") or "音色克隆失败", "providerStatus": response.status_code},
            status_code=502,
        )
    return {"spkId": payload["spkId"], "promptText": payload.get("promptText") or prompt_text}


def _render_url() -> str:
    return (os.environ.get("RENDER_URL") or "").strip().rstrip("/")


def _stock_keys(name: str) -> list[str]:
    raw = os.environ.get(name) or ""
    return [k.strip() for k in re.split(r"[,\s]+", raw) if k.strip()]


_STOCK_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


def _pexels_orientation(o: str) -> str:
    return o if o in ("landscape", "square", "portrait") else "portrait"


async def _search_pexels_photos(client, query, orientation, per_page, key):
    resp = await client.get(
        "https://api.pexels.com/v1/search",
        params={"query": query, "per_page": per_page, "orientation": _pexels_orientation(orientation)},
        headers={"Authorization": key, "User-Agent": _STOCK_UA},
    )
    data = resp.json()
    out = []
    for p in data.get("photos", []) or []:
        src = p.get("src") or {}
        out.append({
            "provider": "pexels", "type": "photo", "id": str(p.get("id")),
            "thumb": src.get("medium") or src.get("small") or "",
            "url": src.get("large2x") or src.get("large") or src.get("original") or "",
            "width": p.get("width"), "height": p.get("height"),
            "author": p.get("photographer") or "", "sourceUrl": p.get("url") or "",
            "alt": p.get("alt") or "",
        })
    return out


async def _search_pexels_videos(client, query, orientation, per_page, key):
    resp = await client.get(
        "https://api.pexels.com/videos/search",
        params={"query": query, "per_page": per_page, "orientation": _pexels_orientation(orientation)},
        headers={"Authorization": key, "User-Agent": _STOCK_UA},
    )
    data = resp.json()
    out = []
    for v in data.get("videos", []) or []:
        files = [f for f in (v.get("video_files") or []) if "mp4" in (f.get("file_type") or "")]
        files.sort(key=lambda f: f.get("height") or 0, reverse=True)
        best = files[0] if files else {}
        out.append({
            "provider": "pexels", "type": "video", "id": str(v.get("id")),
            "thumb": v.get("image") or "", "url": best.get("link") or "",
            "width": best.get("width") or v.get("width"), "height": best.get("height") or v.get("height"),
            "duration": v.get("duration"), "author": (v.get("user") or {}).get("name") or "",
            "sourceUrl": v.get("url") or "",
        })
    return out


async def _search_pixabay_photos(client, query, orientation, per_page, key):
    resp = await client.get(
        "https://pixabay.com/api/",
        params={
            "key": key, "q": query, "image_type": "photo",
            "orientation": "horizontal" if orientation == "landscape" else "vertical",
            "per_page": max(3, per_page), "safesearch": "true",
        },
        headers={"User-Agent": _STOCK_UA},
    )
    data = resp.json()
    out = []
    for h in data.get("hits", []) or []:
        out.append({
            "provider": "pixabay", "type": "photo", "id": str(h.get("id")),
            "thumb": h.get("previewURL") or h.get("webformatURL") or "",
            "url": h.get("largeImageURL") or h.get("webformatURL") or "",
            "width": h.get("imageWidth"), "height": h.get("imageHeight"),
            "author": h.get("user") or "", "sourceUrl": h.get("pageURL") or "",
            "alt": h.get("tags") or "",
        })
    return out


@app.get("/api/stock")
async def stock(query: str = "", q: str = "", type: str = "photo", orientation: str = "portrait", perPage: int = 15):
    """免费素材源（Pexels/Pixabay）搜索：按关键词搜版权无忧、可商用的图/视频。未配置 key → 501。"""
    term = (query or q or "").strip()
    if not term:
        return JSONResponse({"error": "缺少搜索关键词 query"}, status_code=400)
    pexels_keys = _stock_keys("PEXELS_API_KEY")
    pixabay_keys = _stock_keys("PIXABAY_API_KEY")
    if not pexels_keys and not pixabay_keys:
        return JSONResponse(
            {"error": "素材源未配置：请设置环境变量 PEXELS_API_KEY（免费 https://www.pexels.com/api/）或 PIXABAY_API_KEY。"},
            status_code=501,
        )
    per_page = max(1, min(40, int(perPage or 15)))
    items: list[dict] = []
    providers: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            if pexels_keys:
                providers.append("pexels")
                fn = _search_pexels_videos if type == "video" else _search_pexels_photos
                try:
                    items += await fn(client, term, orientation, per_page, pexels_keys[0])
                except (httpx.HTTPError, ValueError):
                    pass
            if pixabay_keys and type != "video":
                providers.append("pixabay")
                try:
                    items += await _search_pixabay_photos(client, term, orientation, per_page, pixabay_keys[0])
                except (httpx.HTTPError, ValueError):
                    pass
    except httpx.HTTPError as error:
        return JSONResponse({"error": f"素材搜索失败：{error}"}, status_code=502)
    return {"query": term, "type": type, "orientation": orientation, "providers": providers, "count": len(items), "items": items}


@app.post("/api/render")
async def render(data: RenderInput):
    """把渲染请求转发到自部署的渲染 worker（RENDER_URL）。worker 一站式出片，返回 MP4。"""
    render_url = _render_url()
    if not render_url:
        return JSONResponse(
            {"error": "渲染服务未配置（请设置环境变量 RENDER_URL 指向你的渲染 worker）"},
            status_code=501,
        )
    timeline = data.timeline or {}
    scenes = timeline.get("timeline") if isinstance(timeline, dict) else None
    if not isinstance(scenes, list) or not scenes:
        return JSONResponse(
            {"error": "缺少 Timeline（timeline.timeline 至少要有一个分镜）"}, status_code=400
        )

    payload = {
        "timeline": timeline,
        "voice": data.voice or "mimo_default",
        "cloneSpkId": data.cloneSpkId or "",
        "gpu": data.gpu if data.gpu is not None else True,
        "autoStock": bool(data.autoStock),
    }
    if data.assets:
        payload["assets"] = data.assets

    try:
        async with httpx.AsyncClient(timeout=900) as client:
            response = await client.post(f"{render_url}/render", json=payload)
    except httpx.HTTPError as error:
        return JSONResponse(
            {"error": f"无法连接渲染服务（可能 GPU 机没开机）：{error}"}, status_code=502
        )

    content_type = response.headers.get("content-type", "")
    # worker 返回 JSON：配了 R2 时是 {ok,url}（透传给前端可播/下载/分享）；否则是出错。
    if "application/json" in content_type:
        try:
            body = response.json()
        except ValueError:
            body = {"error": "渲染服务返回异常", "providerStatus": response.status_code}
        if response.status_code < 400 and body.get("ok") and body.get("url"):
            return JSONResponse(body, status_code=200)
        return JSONResponse(
            {"error": body.get("error") or "渲染失败", "providerStatus": response.status_code},
            status_code=response.status_code if response.status_code >= 400 else 502,
        )
    if response.status_code >= 400:
        return JSONResponse(
            {"error": "渲染失败", "providerStatus": response.status_code},
            status_code=response.status_code,
        )

    return Response(
        content=response.content,
        media_type="video/mp4",
        headers={"content-disposition": 'attachment; filename="3c-review.mp4"'},
    )


def build_rewrite_prompt(data: RewriteSceneInput) -> str:
    scene = data.scene or {}
    product = data.productName or "本产品"
    role = scene.get("title") or "这一镜"
    try:
        duration = float(scene.get("duration") or (scene.get("end", 0) - scene.get("start", 0)) or 10)
    except (TypeError, ValueError):
        duration = 10
    note = (data.note or "").strip()
    visual = scene.get("visual") or {}
    visual_type = visual.get("type") or "真人口播 + 产品图"
    extra = f"\n5. 额外要求：{note}" if note else ""

    return f"""你是数码 3C 短视频编导。现在只需要重写一条竖屏短视频里的【单个分镜】，其它分镜保持不动。

【这一镜在留人结构中的角色】{role}
【这一镜目标时长】约 {duration:g} 秒（中文短句，适合 TTS 朗读，不要超过这个时长能念完的字数）
【整条视频的产品】只能评测「{product}」，绝不能写进其它型号/品牌/系列/芯片/价格/参数。

【上下文（不要改写它们，只用来衔接）】
- 上一镜口播：{clamp_text(data.prevVoiceover, 300) or "（无，这是第一镜）"}
- 下一镜标题：{data.nextTitle or "（无，这是最后一镜）"}

【重写要求】
1. 保持这一镜原本的留人角色与情绪定位（钩子就要抓人，高潮就要情绪最高，反转就要诚实讲短板，结尾就要给结论+互动）。
2. 用自己的话写，口语化、多短句、有张力；结尾留一个自然引向下一镜的开放回路钩子（最后一镜则给明确购买结论 + 一句互动引导）。
3. 不得编造参数、价格、跑分、续航、芯片、降噪等级等事实；资料不足就降低确定性或说“资料未提供”，但仍要保持钩子和节奏。
4. 必须给出一个和原来不同的新版本（换个角度/说法/钩子），不要原样返回。{extra}

【输出】严格 JSON，不要 markdown、不要代码块、不要解释：
{{
  "title": "{role}",
  "voiceover": "重写后的口播文案",
  "subtitle": "用于字幕的精简版（可与口播相同）",
  "visual": {{ "type": "{visual_type}", "headline": "画面大字标题（短）", "detail": "画面说明（短）" }}
}}

产品名：{product}
品类：{data.category or "未提供"}
平台：{data.platform or "未提供"}

产品事实：
{clamp_text(data.facts, 1800)}

真实评测素材（可能混有多款产品，仅供了解品类共性，不要照搬其中型号/品牌/参数）：
{clamp_text(data.reviews, 2500)}"""


@app.post("/api/rewrite-scene")
async def rewrite_scene(data: RewriteSceneInput):
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    base_url = (
        os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or DEFAULT_BASE_URL
    ).rstrip("/")
    model = os.environ.get("LLM_MODEL") or os.environ.get("OPENAI_MODEL") or DEFAULT_MODEL

    if not api_key:
        return JSONResponse(
            {"error": "LLM_API_KEY (或 OPENAI_API_KEY) 未配置"}, status_code=501
        )

    if not data.scene:
        return JSONResponse({"error": "缺少要重写的镜头 (scene)"}, status_code=400)

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
                    "temperature": 0.85,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {
                            "role": "system",
                            "content": "你只输出严格 JSON。不要输出 markdown、代码块或解释。",
                        },
                        {"role": "user", "content": build_rewrite_prompt(data)},
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
    except (KeyError, IndexError, ValueError) as error:
        return JSONResponse({"error": f"重写失败: {error}"}, status_code=500)

    voiceover = str(parsed.get("voiceover") or parsed.get("subtitle") or "").strip()
    if not voiceover:
        return JSONResponse({"error": "重写返回为空"}, status_code=502)

    src_scene = data.scene or {}
    src_visual = src_scene.get("visual") or {}
    parsed_visual = parsed.get("visual") or {}
    return {
        "title": str(parsed.get("title") or src_scene.get("title") or "").strip(),
        "voiceover": voiceover,
        "subtitle": str(parsed.get("subtitle") or voiceover).strip(),
        "visual": {
            "type": str(parsed_visual.get("type") or src_visual.get("type") or "真人口播 + 产品图").strip(),
            "headline": str(parsed_visual.get("headline") or "").strip(),
            "detail": str(parsed_visual.get("detail") or "").strip(),
        },
    }
