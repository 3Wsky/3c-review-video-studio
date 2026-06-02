// 免费素材源（Pexels / Pixabay）搜索封装，移植自 MoneyPrinterTurbo 的 material.py 思路：
// 按关键词 + 横竖屏搜「版权无忧、可商用」的图/视频，多 API key 轮询，统一归一化结构。
// 既给渲染 worker 程序化调用（缺图自动拉空镜），也是 functions/api/stock.js 与 backend 的参考实现。
//
// key 从环境变量读，支持逗号分隔多 key：
//   PEXELS_API_KEY=key1,key2      （https://www.pexels.com/api/ 免费申请）
//   PIXABAY_API_KEY=key1,key2     （https://pixabay.com/api/docs/ 免费申请）

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// 逗号/空白分隔 → 去重的 key 数组
export function keysFromEnv(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

// 简单轮询计数（进程内），让多 key 摊开用，避免单 key 限流
let _rr = 0;
function pick(keys) {
  if (!keys || keys.length === 0) return null;
  if (keys.length === 1) return keys[0];
  _rr += 1;
  return keys[_rr % keys.length];
}

function clampPerPage(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 15;
  return Math.min(40, Math.round(v));
}

// orientation 归一化为各家接受的取值
function pexelsOrientation(o) {
  if (o === "landscape") return "landscape";
  if (o === "square") return "square";
  return "portrait";
}

async function getJson(url, headers, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: ctrl.signal });
    const data = await resp.json().catch(() => null);
    return { ok: resp.ok, status: resp.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Pexels 图片 ----
async function searchPexelsPhotos(query, { orientation, perPage, key }) {
  const params = new URLSearchParams({
    query,
    per_page: String(clampPerPage(perPage)),
    orientation: pexelsOrientation(orientation),
  });
  const { ok, data } = await getJson(`https://api.pexels.com/v1/search?${params}`, {
    Authorization: key,
  });
  if (!ok || !data || !Array.isArray(data.photos)) return [];
  return data.photos.map((p) => ({
    provider: "pexels",
    type: "photo",
    id: String(p.id),
    thumb: p.src?.medium || p.src?.small || p.src?.tiny || "",
    url: p.src?.large2x || p.src?.large || p.src?.original || "",
    width: p.width,
    height: p.height,
    author: p.photographer || "",
    sourceUrl: p.url || "",
    alt: p.alt || "",
  }));
}

// ---- Pexels 视频 ----
async function searchPexelsVideos(query, { orientation, perPage, key }) {
  const params = new URLSearchParams({
    query,
    per_page: String(clampPerPage(perPage)),
    orientation: pexelsOrientation(orientation),
  });
  const { ok, data } = await getJson(`https://api.pexels.com/videos/search?${params}`, {
    Authorization: key,
  });
  if (!ok || !data || !Array.isArray(data.videos)) return [];
  return data.videos.map((v) => {
    const files = Array.isArray(v.video_files) ? v.video_files : [];
    // 优先竖屏、较高分辨率的 mp4
    const sorted = files
      .filter((f) => (f.file_type || "").includes("mp4"))
      .sort((a, b) => (b.height || 0) - (a.height || 0));
    const best = sorted[0] || files[0] || {};
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
      sourceUrl: v.url || "",
    };
  });
}

// ---- Pixabay 图片 ----
async function searchPixabayPhotos(query, { orientation, perPage, key }) {
  const params = new URLSearchParams({
    key,
    q: query,
    image_type: "photo",
    orientation: orientation === "landscape" ? "horizontal" : "vertical",
    per_page: String(Math.max(3, clampPerPage(perPage))),
    safesearch: "true",
  });
  const { ok, data } = await getJson(`https://pixabay.com/api/?${params}`, {});
  if (!ok || !data || !Array.isArray(data.hits)) return [];
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
    alt: h.tags || "",
  }));
}

// 统一搜索：按 type 与可用 key 选 provider，多 key 轮询，单家失败不影响另一家。
// 返回 { items, providers, error? }；无任何可用 key 时 items=[] 并带 noKey=true。
export async function searchStock({
  query,
  type = "photo",
  orientation = "portrait",
  perPage = 15,
  pexelsKeys = [],
  pixabayKeys = [],
} = {}) {
  const q = String(query || "").trim();
  if (!q) return { items: [], providers: [], error: "缺少搜索关键词 query" };

  const hasPexels = pexelsKeys.length > 0;
  const hasPixabay = pixabayKeys.length > 0;
  if (!hasPexels && !hasPixabay) {
    return { items: [], providers: [], noKey: true };
  }

  const tasks = [];
  const providers = [];
  if (hasPexels) {
    providers.push("pexels");
    const key = pick(pexelsKeys);
    tasks.push(
      (type === "video" ? searchPexelsVideos : searchPexelsPhotos)(q, { orientation, perPage, key }).catch(
        () => []
      )
    );
  }
  if (hasPixabay && type !== "video") {
    // Pixabay 视频接口结构不同，这版只接图片，保持稳。
    providers.push("pixabay");
    const key = pick(pixabayKeys);
    tasks.push(searchPixabayPhotos(q, { orientation, perPage, key }).catch(() => []));
  }

  const results = (await Promise.all(tasks)).flat();
  return { items: results, providers, count: results.length };
}

// 渲染 worker 用：按关键词取一张可下载的图片直链（缺图自动空镜）。拿不到返回 null。
export async function pickStockPhotoUrl(query, { pexelsKeys = [], pixabayKeys = [], orientation = "portrait" } = {}) {
  const { items } = await searchStock({ query, type: "photo", orientation, perPage: 10, pexelsKeys, pixabayKeys });
  const withUrl = items.find((it) => it.url);
  return withUrl ? withUrl.url : null;
}
