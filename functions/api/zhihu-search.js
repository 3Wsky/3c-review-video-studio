const ZHIHU_SEARCH_URL = "https://developer.zhihu.com/api/v1/content/zhihu_search";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}

function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(10, Math.round(n));
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const comments = Array.isArray(item.CommentInfoList)
      ? item.CommentInfoList.map((c) => stripHtml(c.Content)).filter(Boolean)
      : [];
    return {
      title: stripHtml(item.Title),
      type: item.ContentType || "",
      contentId: item.ContentID || "",
      summary: stripHtml(item.ContentText),
      url: item.Url || "",
      voteUp: Number(item.VoteUpCount || 0),
      commentCount: Number(item.CommentCount || 0),
      author: stripHtml(item.AuthorName),
      authorBadge: stripHtml(item.AuthorBadgeText),
      editTime: Number(item.EditTime || 0),
      comments
    };
  });
}

// Build a ready-to-paste material block for the LLM / reviews textarea.
function buildMaterial(query, items) {
  if (!items.length) return "";
  const blocks = items.map((item, index) => {
    const lines = [
      `【${index + 1}. ${item.title || "无标题"}】(赞同 ${item.voteUp} · 评论 ${item.commentCount})`,
      item.summary
    ];
    if (item.comments.length) {
      lines.push(`精选评论：${item.comments.slice(0, 3).join(" / ")}`);
    }
    if (item.url) lines.push(`来源：${item.url}`);
    return lines.filter(Boolean).join("\n");
  });
  return `知乎搜索「${query}」相关内容（共 ${items.length} 条）：\n\n${blocks.join("\n\n")}`;
}

async function handleSearch(query, count, env) {
  const accessSecret = env.ZHIHU_ACCESS_SECRET || env.ZHIHU_ACCESS_TOKEN;
  if (!accessSecret) {
    return jsonResponse(
      {
        error:
          "知乎 Access Secret 未配置。请在 Cloudflare Pages 环境变量添加 ZHIHU_ACCESS_SECRET（在 https://developer.zhihu.com/profile 获取）。"
      },
      501
    );
  }

  const q = String(query || "").trim();
  if (!q) return jsonResponse({ error: "缺少搜索关键词 query" }, 400);

  const url = new URL(ZHIHU_SEARCH_URL);
  url.searchParams.set("Query", q);
  url.searchParams.set("Count", String(clampCount(count)));

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessSecret}`,
        "x-request-timestamp": String(Math.floor(Date.now() / 1000)),
        "content-type": "application/json"
      }
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      return jsonResponse(
        {
          error: "知乎搜索接口请求失败",
          providerStatus: response.status
        },
        502
      );
    }

    if (payload.Code !== 0) {
      return jsonResponse(
        {
          error: payload.Message || "知乎搜索接口返回错误",
          code: payload.Code
        },
        502
      );
    }

    const items = normalizeItems(payload.Data?.Items);
    return jsonResponse({
      query: q,
      count: items.length,
      searchHashId: payload.Data?.SearchHashId || "",
      emptyReason: payload.Data?.EmptyReason || "",
      items,
      material: buildMaterial(q, items)
    });
  } catch (error) {
    return jsonResponse({ error: error.message || "知乎搜索失败" }, 500);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;
  const query = params.get("q") || params.get("query") || params.get("Query");
  const count = params.get("count") || params.get("Count");
  return handleSearch(query, count, env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  return handleSearch(body.query || body.q || body.Query, body.count || body.Count, env);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}
