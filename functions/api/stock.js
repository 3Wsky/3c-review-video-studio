// 免费素材源搜索（Pexels / Pixabay）。前端「素材库」用它按关键词搜版权无忧、可商用的图片，
// 供用户预览/选用绑到分镜。多 API key 轮询；未配置 key 时返回明确提示不卡死。
//
// Cloudflare Pages 环境变量（逗号分隔可多 key）：
//   PEXELS_API_KEY   https://www.pexels.com/api/
//   PIXABAY_API_KEY  https://pixabay.com/api/docs/

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS }
  });
}

function keysFromEnv(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

let rr = 0;
function pick(keys) {
  if (!keys.length) return null;
  if (keys.length === 1) return keys[0];
  rr += 1;
  return keys[rr % keys.length];
}

function clampPerPage(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 15;
  return Math.min(40, Math.round(v));
}

function pexelsOrientation(o) {
  if (o === "landscape") return "landscape";
  if (o === "square") return "square";
  return "portrait";
}

async function pexelsPhotos(query, orientation, perPage, key) {
  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    orientation: pexelsOrientation(orientation)
  });
  const resp = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: key, "User-Agent": UA }
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data || !Array.isArray(data.photos)) return [];
  return data.photos.map((p) => ({
    provider: "pexels",
    type: "photo",
    id: String(p.id),
    thumb: p.src?.medium || p.src?.small || "",
    url: p.src?.large2x || p.src?.large || p.src?.original || "",
    width: p.width,
    height: p.height,
    author: p.photographer || "",
    sourceUrl: p.url || "",
    alt: p.alt || ""
  }));
}

async function pexelsVideos(query, orientation, perPage, key) {
  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    orientation: pexelsOrientation(orientation)
  });
  const resp = await fetch(`https://api.pexels.com/videos/search?${params}`, {
    headers: { Authorization: key, "User-Agent": UA }
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data || !Array.isArray(data.videos)) return [];
  return data.videos.map((v) => {
    const files = (Array.isArray(v.video_files) ? v.video_files : [])
      .filter((f) => (f.file_type || "").includes("mp4"))
      .sort((a, b) => (b.height || 0) - (a.height || 0));
    const best = files[0] || {};
    return {
      provider: "pexels",
      type: "video",
      id: String(v.id),
      thumb: v.image || "",
      url: best.link || "",
      width: best.width || v.width,
      height: best.height || v.height,
      duration: v.duration,
      author: v.user?.name || "",
      sourceUrl: v.url || ""
    };
  });
}

async function pixabayPhotos(query, orientation, perPage, key) {
  const params = new URLSearchParams({
    key,
    q: query,
    image_type: "photo",
    orientation: orientation === "landscape" ? "horizontal" : "vertical",
    per_page: String(Math.max(3, perPage)),
    safesearch: "true"
  });
  const resp = await fetch(`https://pixabay.com/api/?${params}`, { headers: { "User-Agent": UA } });
  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data || !Array.isArray(data.hits)) return [];
  return data.hits.map((h) => ({
    provider: "pixabay",
    type: "photo",
    id: String(h.id),
    thumb: h.previewURL || h.webformatURL || "",
    url: h.largeImageURL || h.webformatURL || "",
    width: h.imageWidth,
    height: h.imageHeight,
    author: h.user || "",
    sourceUrl: h.pageURL || "",
    alt: h.tags || ""
  }));
}

async function handle(query, type, orientation, perPage, env) {
  const q = String(query || "").trim();
  if (!q) return jsonResponse({ error: "缺少搜索关键词 query" }, 400);

  const pexelsKeys = keysFromEnv(env.PEXELS_API_KEY);
  const pixabayKeys = keysFromEnv(env.PIXABAY_API_KEY);
  if (!pexelsKeys.length && !pixabayKeys.length) {
    return jsonResponse(
      {
        error:
          "素材源未配置：请在 Cloudflare Pages 环境变量添加 PEXELS_API_KEY（免费 https://www.pexels.com/api/）或 PIXABAY_API_KEY。"
      },
      501
    );
  }

  const pp = clampPerPage(perPage);
  const tasks = [];
  const providers = [];
  if (pexelsKeys.length) {
    providers.push("pexels");
    const fn = type === "video" ? pexelsVideos : pexelsPhotos;
    tasks.push(fn(q, orientation, pp, pick(pexelsKeys)).catch(() => []));
  }
  if (pixabayKeys.length && type !== "video") {
    providers.push("pixabay");
    tasks.push(pixabayPhotos(q, orientation, pp, pick(pixabayKeys)).catch(() => []));
  }
  const items = (await Promise.all(tasks)).flat();
  return jsonResponse({ query: q, type, orientation, providers, count: items.length, items });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  return handle(
    url.searchParams.get("query") || url.searchParams.get("q"),
    url.searchParams.get("type") || "photo",
    url.searchParams.get("orientation") || "portrait",
    url.searchParams.get("perPage"),
    env
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  return handle(input.query || input.q, input.type || "photo", input.orientation || "portrait", input.perPage, env);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}
