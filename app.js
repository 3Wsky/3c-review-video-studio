const initialState = {
  layout: "center",
  currentScene: 0,
  assets: [],
  timeline: [],
  generated: false,
  categoryTouched: false
};

// 按产品名关键词推断品类（更具体的规则排在前面，避免 matebook/matepad 误判为手机）
const CATEGORY_RULES = [
  { cat: "笔记本", kw: ["笔记本", "笔电", "macbook", "matebook", "redmibook", "magicbook", "thinkpad", "thinkbook", "拯救者", "游戏本", "轻薄本", "灵越", "幻", "暗影精灵", "星"] },
  { cat: "平板", kw: ["平板", "ipad", "matepad", "小米平板", "tablet"] },
  { cat: "显卡", kw: ["显卡", "rtx", "gtx", "geforce", "radeon", "4090", "4080", "4070", "4060", "5090", "5080", "5070", "9070", "7900", "7800"] },
  { cat: "显示器", kw: ["显示器", "显示屏", "monitor", "带鱼屏", "电竞屏"] },
  { cat: "智能穿戴", kw: ["手表", "watch", "手环", "穿戴", "smart band"] },
  { cat: "耳机", kw: ["耳机", "airpods", "earbuds", "freebuds", "freebud", "声阔", "soundcore", "漫步者", "edifier", "森海", "sennheiser", "降噪豆", "开放式", "入耳", "buds"] },
  { cat: "手机", kw: ["手机", "nova", "mate", "iphone", "苹果", "小米", "redmi", "红米", "oppo", "vivo", "荣耀", "honor", "三星", "galaxy", "pixel", "realme", "真我", "一加", "oneplus", "魅族", "reno", "find x"] }
];

function inferCategory(name) {
  const lower = (name || "").toLowerCase();
  if (!lower) return "";
  for (const rule of CATEGORY_RULES) {
    if (rule.kw.some((k) => lower.includes(k.toLowerCase()))) return rule.cat;
  }
  return "";
}

const modules = [
  {
    name: "MoneyPrinterTurbo",
    value: "借鉴脚本入口、TTS 选择、Edge/Whisper 字幕链路、任务式合成流程"
  },
  {
    name: "Pixelle-Video",
    value: "借鉴 content narration、asset based pipeline、storyboard frame、素材到分镜映射"
  },
  {
    name: "HyperFrames",
    value: "作为最终画面和时间轴核心，用 data-start/data-duration 驱动字幕、动画、音频层"
  },
  {
    name: "自定义 3C Prompt",
    value: "约束事实来源、提炼知乎观点、生成原创技术博主口播和可核查结论"
  }
];

const els = {
  productName: document.querySelector("#productName"),
  category: document.querySelector("#category"),
  targetDuration: document.querySelector("#targetDuration"),
  platform: document.querySelector("#platform"),
  factsInput: document.querySelector("#factsInput"),
  reviewInput: document.querySelector("#reviewInput"),
  zhihuQuery: document.querySelector("#zhihuQuery"),
  zhihuSearchBtn: document.querySelector("#zhihuSearchBtn"),
  zhihuResults: document.querySelector("#zhihuResults"),
  assetInput: document.querySelector("#assetInput"),
  assetStrip: document.querySelector("#assetStrip"),
  oneClickBtn: document.querySelector("#oneClickBtn"),
  regenerateBtn: document.querySelector("#regenerateBtn"),
  addSceneBtn: document.querySelector("#addSceneBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  advToggle: document.querySelector("#advToggle"),
  advPanel: document.querySelector("#advPanel"),
  cueHint: document.querySelector("#cueHint"),
  copyPromptBtn: document.querySelector("#copyPromptBtn"),
  downloadJsonBtn: document.querySelector("#downloadJsonBtn"),
  downloadBriefBtn: document.querySelector("#downloadBriefBtn"),
  exportMenu: document.querySelector("#exportMenu"),
  exportToggle: document.querySelector("#exportToggle"),
  exportScriptBtn: document.querySelector("#exportScriptBtn"),
  exportSrtBtn: document.querySelector("#exportSrtBtn"),
  exportShotlistBtn: document.querySelector("#exportShotlistBtn"),
  track: document.querySelector("#track"),
  trackRuler: document.querySelector("#trackRuler"),
  clipEditor: document.querySelector("#clipEditor"),
  jsonOutput: document.querySelector("#jsonOutput"),
  apiStatus: document.querySelector("#apiStatus"),
  apiBase: document.querySelector("#apiBase"),
  ttsVoice: document.querySelector("#ttsVoice"),
  sceneCount: document.querySelector("#sceneCount"),
  durationCount: document.querySelector("#durationCount"),
  sourceCount: document.querySelector("#sourceCount"),
  prevSceneBtn: document.querySelector("#prevSceneBtn"),
  nextSceneBtn: document.querySelector("#nextSceneBtn"),
  sceneIndicator: document.querySelector("#sceneIndicator"),
  stageProduct: document.querySelector("#stageProduct"),
  stageTime: document.querySelector("#stageTime"),
  productVisual: document.querySelector("#productVisual"),
  hostSlot: document.querySelector("#hostSlot"),
  visualType: document.querySelector("#visualType"),
  visualHeadline: document.querySelector("#visualHeadline"),
  visualDetail: document.querySelector("#visualDetail"),
  subtitleBar: document.querySelector("#subtitleBar")
};

function splitLines(text) {
  return text
    .replace(/\r/g, "\n")
    .split(/[\n。！？!?；;]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pickByKeywords(lines, keywords, fallbackIndex) {
  const found = lines.find((line) => keywords.some((keyword) => line.includes(keyword)));
  return found || lines[fallbackIndex % Math.max(lines.length, 1)] || "";
}

function compressPoint(line) {
  return line
    .replace(/不少用户提到/g, "用户反馈")
    .replace(/也有人反馈/g, "另一类反馈是")
    .replace(/综合来看/g, "整体判断")
    .replace(/比较/g, "")
    .replace(/明显/g, "")
    .replace(/这款/g, "这类")
    .slice(0, 72);
}

function extractInsights(reviewText, factsText) {
  const reviewLines = splitLines(reviewText);
  const factLines = splitLines(factsText);
  const lines = [...reviewLines, ...factLines];
  const comfort = compressPoint(pickByKeywords(lines, ["舒服", "轻", "压迫", "佩戴", "不堵"], 0));
  const weakness = compressPoint(pickByKeywords(lines, ["缺点", "但是", "不过", "一般", "噪音", "低频", "限制"], 1));
  const stability = compressPoint(pickByKeywords(lines, ["稳定", "不容易掉", "晃", "运动"], 2));
  const audience = compressPoint(pickByKeywords(lines, ["适合", "人群", "通勤", "办公", "目标"], 3));

  return {
    reviewLines,
    factLines,
    sourceCount: reviewLines.length,
    comfort,
    weakness,
    stability,
    audience
  };
}

function buildScenes() {
  const product = els.productName.value.trim() || "这款产品";
  const category = els.category.value;
  const insights = extractInsights(els.reviewInput.value, els.factsInput.value);

  const scenes = [
    {
      title: "前5秒·钩子",
      visualType: "真人口播 + 大字幕",
      headline: "别急着划走",
      detail: "一句话钩住，5 秒内留住人",
      voiceover: `先别划走——${product}到底值不值得买，看完这条不踩坑。`,
      source: "钩子·留人"
    },
    {
      title: "痛点共鸣",
      visualType: "痛点字幕卡",
      headline: "这说的就是你",
      detail: insights.weakness || "参数好看，到手才发现不好用",
      voiceover: `买${category}最怕什么？参数吹上天，到手才发现日常根本不顺手。${product}是不是也这样，我替你扒清楚了。`,
      source: "情绪曲线·共鸣"
    },
    {
      title: "悬念展开",
      visualType: "知乎观点摘要",
      headline: "关键不在宣传页",
      detail: insights.comfort || "真正决定体验的是日常细节",
      voiceover: `先抛个问题：${product}最该看的，不是写在宣传页上的卖点，而是${insights.comfort || "长期用下来的真实体验"}。往下看你就懂了。`,
      source: "情绪曲线·悬念"
    },
    {
      title: "高潮·揭晓",
      visualType: "价值高光卡",
      headline: "最大价值在这",
      detail: insights.comfort || "真实好评最集中的点",
      voiceover: `真正打动人的，是${insights.comfort || "它在日常场景里的省心"}。从真实评测看，用户夸得最多的就是这一点——这才是它的最大价值。但先别急着下单。`,
      source: "情绪曲线·高潮"
    },
    {
      title: "反转·短板",
      visualType: "优缺点对照",
      headline: "短板提前说",
      detail: insights.weakness || "不适合追求极致的那部分人",
      voiceover: `话说回来，它也有短板：${insights.weakness || "不适合追求极致性能或隔音的人"}。这点不提前讲清楚，买了容易后悔。`,
      source: "情绪曲线·反转"
    },
    {
      title: "结尾·结论+互动",
      visualType: "结论卡 + 引导关注",
      headline: "买不买看这句",
      detail: "给结论 + 引导互动",
      voiceover: `所以结论很简单：要的是${insights.audience || "日常稳定好用"}，它值得入手；另有所求就再等等。觉得有用点个关注，评论区告诉我下一个想看谁。`,
      source: "情绪曲线·收尾"
    }
  ];

  return { scenes, insights };
}

function estimateDuration(text) {
  const clean = text.replace(/\s/g, "");
  return Math.max(6, clean.length / 5.4);
}

function buildTimeline() {
  const { scenes, insights } = buildScenes();
  const target = Number(els.targetDuration.value) || 90;
  // 第 1 镜是「前5秒钩子」，固定一个 ≤6s 的短时长留人；其余按文案长度分配剩余时间
  const hookDuration = scenes.length > 1 ? Math.min(5, Math.max(3, target * 0.06)) : target;
  const restTarget = Math.max(0, target - hookDuration);
  const restRaw = scenes.slice(1).map((scene) => estimateDuration(scene.voiceover));
  const totalRestRaw = restRaw.reduce((sum, item) => sum + item, 0) || 1;
  let cursor = 0;

  const timeline = scenes.map((scene, index) => {
    const duration =
      index === 0 ? hookDuration : Math.max(5, (restRaw[index - 1] / totalRestRaw) * restTarget);
    const start = cursor;
    const end = index === scenes.length - 1 ? target : start + duration;
    cursor = end;
    return {
      id: `scene_${String(index + 1).padStart(2, "0")}`,
      index: index + 1,
      title: scene.title,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2)),
      voiceover: scene.voiceover,
      subtitle: scene.voiceover.replace(productPrefix(), "这款产品"),
      visual: {
        type: scene.visualType,
        layout: initialState.layout,
        headline: scene.headline,
        detail: scene.detail,
        asset: initialState.assets[index % Math.max(initialState.assets.length, 1)]?.name || "uploaded_product_asset"
      },
      checks: ["事实来自输入材料", "避免长句照搬", "保留人工复核位"],
      source: scene.source
    };
  });

  return {
    project: {
      product: els.productName.value.trim(),
      category: els.category.value,
      platform: els.platform.value,
      targetDuration: target,
      layout: initialState.layout
    },
    insights,
    timeline
  };
}

function buildApiPayload() {
  return {
    productName: els.productName.value.trim(),
    category: els.category.value,
    targetDuration: Number(els.targetDuration.value) || 90,
    platform: els.platform.value,
    layout: initialState.layout,
    facts: els.factsInput.value,
    reviews: els.reviewInput.value,
    assets: initialState.assets.map((asset) => ({
      name: asset.name,
      type: asset.type
    }))
  };
}

function setApiStatus(text) {
  if (els.apiStatus) els.apiStatus.textContent = text;
}

function setCueHint(text) {
  if (els.cueHint) els.cueHint.textContent = text;
}

const API_BASE_KEY = "apiBase";

function getApiBase() {
  let base = "";
  if (els.apiBase && els.apiBase.value.trim()) {
    base = els.apiBase.value.trim();
  } else {
    try {
      base = localStorage.getItem(API_BASE_KEY) || "";
    } catch (error) {
      base = "";
    }
  }
  const params = new URLSearchParams(location.search);
  if (!base && params.get("api")) base = params.get("api");
  return base.trim().replace(/\/$/, "");
}

const ttsCache = new Map();
let ttsAudio = null;

function ttsKey(text, voice) {
  return `${voice}::${text}`;
}

async function synthesizeVoiceover(text, voice) {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("这一镜还没有口播文案");
  const key = ttsKey(clean, voice);
  if (ttsCache.has(key)) return ttsCache.get(key);

  const apiBase = getApiBase();
  if (!apiBase && location.protocol === "file:") {
    throw new Error("试听需要部署后端（本地 file:// 无法调用 TTS）");
  }
  const response = await fetch(`${apiBase}/api/tts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: clean, voice, format: "mp3" })
  });
  const data = await response.json();
  if (!response.ok || !data.audio) {
    throw new Error(data.error || "TTS 合成失败");
  }
  const src = `data:audio/${data.format || "mp3"};base64,${data.audio}`;
  ttsCache.set(key, src);
  return src;
}

function getSelectedVoice() {
  return (els.ttsVoice && els.ttsVoice.value) || "mimo_default";
}

function normalizeTimelineData(data) {
  const local = buildTimeline();
  const project = {
    ...local.project,
    ...(data.project || {}),
    product: data.project?.product || data.product || els.productName.value.trim(),
    category: data.project?.category || els.category.value,
    platform: data.project?.platform || els.platform.value,
    targetDuration: Number(data.project?.targetDuration || els.targetDuration.value || 90),
    layout: data.project?.layout || initialState.layout
  };

  const sourceTimeline = Array.isArray(data.timeline) ? data.timeline : [];
  const fallbackTimeline = local.timeline;
  const timeline = (sourceTimeline.length ? sourceTimeline : fallbackTimeline).map((scene, index) => {
    const fallback = fallbackTimeline[index] || fallbackTimeline[fallbackTimeline.length - 1];
    const start = Number.isFinite(Number(scene.start)) ? Number(scene.start) : fallback.start;
    const end = Number.isFinite(Number(scene.end)) ? Number(scene.end) : fallback.end;
    const voiceover = scene.voiceover || fallback.voiceover;
    return {
      id: scene.id || `scene_${String(index + 1).padStart(2, "0")}`,
      index: scene.index || index + 1,
      title: scene.title || fallback.title,
      start,
      end,
      duration: Number.isFinite(Number(scene.duration)) ? Number(scene.duration) : Number((end - start).toFixed(2)),
      voiceover,
      subtitle: scene.subtitle || voiceover,
      visual: {
        type: scene.visual?.type || fallback.visual.type,
        layout: scene.visual?.layout || project.layout,
        headline: scene.visual?.headline || fallback.visual.headline,
        detail: scene.visual?.detail || fallback.visual.detail,
        asset: scene.visual?.asset || fallback.visual.asset
      },
      checks: Array.isArray(scene.checks) ? scene.checks : fallback.checks,
      source: scene.source || "Cloudflare LLM"
    };
  });

  return {
    project,
    insights: {
      ...local.insights,
      ...(data.insights || {}),
      sourceCount: data.insights?.sourceCount || local.insights.sourceCount
    },
    timeline
  };
}

function setBusy(busy) {
  [els.oneClickBtn, els.regenerateBtn, els.zhihuSearchBtn].forEach((button) => {
    if (button) button.disabled = busy;
  });
}

async function generateTimelineFromApi() {
  const apiBase = getApiBase();

  if (!apiBase && location.protocol === "file:") {
    initialState.timeline = buildTimeline();
    initialState.currentScene = 0;
    initialState.generated = true;
    setApiStatus("本地模拟");
    renderAll(false);
    return;
  }

  setApiStatus("生成中");
  setBusy(true);

  try {
    const response = await fetch(`${apiBase}/api/generate-timeline`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(buildApiPayload())
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "生成失败");
    }
    initialState.timeline = normalizeTimelineData(data);
    initialState.currentScene = 0;
    initialState.generated = true;
    setApiStatus(apiBase ? "Codespaces 后端" : "Cloudflare API");
    renderAll(false);
  } catch (error) {
    console.warn(error);
    initialState.timeline = buildTimeline();
    initialState.currentScene = 0;
    initialState.generated = true;
    setApiStatus("本地兜底");
    renderAll(false);
  } finally {
    setBusy(false);
  }
}

async function oneClickGenerate() {
  const product = els.productName.value.trim();
  if (!product) {
    setCueHint("请先输入产品名，例如：华为Nova16");
    els.productName.focus();
    return;
  }

  // 用户没手动改过品类时，按产品名自动推断（避免默认「耳机」跑偏）
  if (!initialState.categoryTouched) {
    const inferred = inferCategory(product);
    if (inferred) els.category.value = inferred;
  }

  setBusy(true);
  setGenerating(true);
  try {
    setCueHint(`已识别品类「${els.category.value}」，正在搜索知乎抓取真实素材…`);
    try {
      await searchZhihu({ silent: true });
    } catch (error) {
      console.warn(error);
    }
    setCueHint("正在用 MiMo 生成分镜，请稍候…");
    await generateTimelineFromApi();
    setCueHint(
      initialState.generated
        ? "生成完成 ✓ 拖动卡片调整顺序，点击卡片在下方编辑文案与时长。"
        : "已生成示例分镜。"
    );
  } finally {
    setGenerating(false);
    setBusy(false);
  }
}

function renderTrackSkeleton(count = 6) {
  if (!els.track) return;
  els.track.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const sk = document.createElement("div");
    sk.className = "clip clip-skeleton";
    sk.style.flexGrow = String(3 + (i % 3));
    sk.innerHTML =
      '<div class="sk-line sk-sm"></div><div class="sk-line sk-md"></div><div class="sk-line"></div><div class="sk-line"></div>';
    els.track.appendChild(sk);
  }
}

function setGenerating(on) {
  if (els.oneClickBtn) els.oneClickBtn.classList.toggle("is-loading", on);
  document.body.classList.toggle("is-generating", on);
  if (on) renderTrackSkeleton();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderZhihuResults(items) {
  if (!els.zhihuResults) return;
  if (!items || !items.length) {
    els.zhihuResults.innerHTML = "";
    return;
  }
  els.zhihuResults.innerHTML = items
    .map((item) => {
      const title = escapeHtml(item.title || "无标题");
      const meta = `赞同 ${item.voteUp} · 评论 ${item.commentCount}`;
      const link = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${title}</a>`
        : title;
      return `<div class="zhihu-item"><div class="zhihu-item-title">${link}</div><div class="zhihu-item-meta">${escapeHtml(item.type)} · ${meta}</div></div>`;
    })
    .join("");
}

async function searchZhihu(options = {}) {
  const silent = options.silent === true;
  const query = (els.zhihuQuery && els.zhihuQuery.value.trim()) || els.productName.value.trim();
  if (!query) {
    setApiStatus("请先填关键词或产品名");
    return;
  }

  const apiBase = getApiBase();
  if (!apiBase && location.protocol === "file:") {
    setApiStatus("知乎搜索需部署后端");
    if (els.zhihuResults) {
      els.zhihuResults.innerHTML =
        '<div class="zhihu-hint">本地 file:// 无法调用知乎接口，请在已部署站点使用，或填写后端地址。</div>';
    }
    return;
  }

  const btn = els.zhihuSearchBtn;
  if (btn) btn.disabled = true;
  setApiStatus("知乎搜索中");
  if (els.zhihuResults) els.zhihuResults.innerHTML = '<div class="zhihu-hint">正在搜索知乎…</div>';

  try {
    const url = `${apiBase}/api/zhihu-search?q=${encodeURIComponent(query)}&count=10`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "知乎搜索失败");
    }
    const items = Array.isArray(data.items) ? data.items : [];
    renderZhihuResults(items);
    if (data.material) {
      els.reviewInput.value = data.material;
    }
    setApiStatus(items.length ? `知乎素材已载入 ${items.length} 条` : "知乎无结果");
  } catch (error) {
    console.warn(error);
    setApiStatus("知乎搜索失败");
    if (els.zhihuResults) {
      els.zhihuResults.innerHTML = `<div class="zhihu-hint">${escapeHtml(error.message || "知乎搜索失败")}</div>`;
    }
    if (!silent) throw error;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function productPrefix() {
  return els.productName.value.trim() || "这款产品";
}

function renderAssets() {
  if (!els.assetStrip) return;
  els.assetStrip.innerHTML = "";
  if (!initialState.assets.length) {
    return;
  }

  initialState.assets.forEach((asset) => {
    const item = document.createElement("div");
    item.className = "asset-thumb";
    if (asset.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = asset.url;
      img.alt = asset.name;
      item.appendChild(img);
    } else {
      item.textContent = "视频";
    }
    els.assetStrip.appendChild(item);
  });
}

/* ---- 时间线重算与编辑 ---- */

function recalcTimeline() {
  const data = initialState.timeline;
  if (!data || !Array.isArray(data.timeline)) return;
  let cursor = 0;
  data.timeline.forEach((scene, i) => {
    const dur = Math.max(2, Number(scene.duration) || 5);
    scene.duration = Number(dur.toFixed(2));
    scene.start = Number(cursor.toFixed(2));
    cursor += dur;
    scene.end = Number(cursor.toFixed(2));
    scene.index = i + 1;
    scene.id = `scene_${String(i + 1).padStart(2, "0")}`;
  });
  data.project.targetDuration = Number(cursor.toFixed(2));
}

function moveScene(from, to) {
  const t = initialState.timeline.timeline;
  if (from === to || from < 0 || to < 0 || from >= t.length || to >= t.length) return;
  const [moved] = t.splice(from, 1);
  t.splice(to, 0, moved);
  recalcTimeline();
  initialState.currentScene = to;
  renderAll(false);
}

function addScene() {
  const t = initialState.timeline.timeline;
  const at = initialState.currentScene + 1;
  const scene = {
    id: "",
    index: 0,
    title: "新镜头",
    start: 0,
    end: 0,
    duration: 8,
    voiceover: "在这里输入这一镜的口播文案。",
    subtitle: "在这里输入这一镜的口播文案。",
    visual: {
      type: "信息板",
      layout: initialState.layout,
      headline: "画面标题",
      detail: "画面说明",
      asset: "uploaded_product_asset"
    },
    checks: ["人工复核"],
    source: "手动添加"
  };
  t.splice(at, 0, scene);
  recalcTimeline();
  initialState.currentScene = at;
  renderAll(false);
}

function deleteScene(index) {
  const t = initialState.timeline.timeline;
  if (t.length <= 1) {
    setApiStatus("至少保留一个镜头");
    return;
  }
  t.splice(index, 1);
  recalcTimeline();
  initialState.currentScene = Math.min(index, t.length - 1);
  renderAll(false);
}

/* ---- 渲染 ---- */

function renderTrackRuler(data) {
  if (!els.trackRuler) return;
  const total = data.project.targetDuration || 90;
  els.trackRuler.innerHTML = "";
  for (let i = 0; i <= 5; i += 1) {
    const tick = document.createElement("span");
    tick.textContent = `${Math.round((total / 5) * i)}s`;
    els.trackRuler.appendChild(tick);
  }
}

function renderTrack(data) {
  const timeline = data.timeline;
  const total = data.project.targetDuration || timeline.reduce((sum, s) => sum + s.duration, 0) || 90;
  els.track.innerHTML = "";
  timeline.forEach((scene, index) => {
    const clip = document.createElement("div");
    clip.className = `clip ${index === initialState.currentScene ? "active" : ""}`;
    clip.style.flexGrow = String(Math.max(scene.duration, 2));
    clip.draggable = true;
    clip.dataset.index = String(index);
    clip.innerHTML = `
      <div class="clip-top">
        <span class="clip-no">${scene.index}</span>
        <span class="clip-dur">${Math.round(scene.duration)}s</span>
      </div>
      <div class="clip-title">${escapeHtml(scene.title)}</div>
      <div class="clip-vo">${escapeHtml(scene.voiceover)}</div>
    `;
    clip.addEventListener("click", () => {
      initialState.currentScene = index;
      renderAll(false);
    });
    clip.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
      clip.classList.add("dragging");
    });
    clip.addEventListener("dragend", () => clip.classList.remove("dragging"));
    clip.addEventListener("dragover", (event) => {
      event.preventDefault();
      clip.classList.add("drop-target");
    });
    clip.addEventListener("dragleave", () => clip.classList.remove("drop-target"));
    clip.addEventListener("drop", (event) => {
      event.preventDefault();
      clip.classList.remove("drop-target");
      const from = Number(event.dataTransfer.getData("text/plain"));
      moveScene(from, index);
    });
    els.track.appendChild(clip);
  });
}

function renderClipEditor(data) {
  const timeline = data.timeline;
  const scene = timeline[initialState.currentScene] || timeline[0];
  if (!scene) {
    els.clipEditor.innerHTML = "";
    return;
  }

  els.clipEditor.innerHTML = `
    <div class="ce-head">
      <span class="ce-badge">镜头 ${scene.index} / ${timeline.length}</span>
      <span class="tagline">${escapeHtml(scene.source || "")}</span>
    </div>
    <label class="ce-field">
      <span>标题</span>
      <input id="ceTitle" type="text" value="${escapeHtml(scene.title)}" />
    </label>
    <div class="ce-grid">
      <label class="ce-field">
        <span>时长 (秒)</span>
        <input id="ceDuration" type="number" min="2" step="1" value="${Math.round(scene.duration)}" />
      </label>
      <label class="ce-field">
        <span>画面类型</span>
        <input id="ceType" type="text" value="${escapeHtml(scene.visual.type)}" />
      </label>
    </div>
    <label class="ce-field">
      <span>画面标题</span>
      <input id="ceHeadline" type="text" value="${escapeHtml(scene.visual.headline)}" />
    </label>
    <label class="ce-field">
      <span>画面说明</span>
      <input id="ceDetail" type="text" value="${escapeHtml(scene.visual.detail)}" />
    </label>
    <label class="ce-field">
      <span>口播文案</span>
      <textarea id="ceVoiceover" rows="5">${escapeHtml(scene.voiceover)}</textarea>
    </label>
    <div class="ce-actions">
      <button class="icon-button" id="ceListen" type="button" title="用 MiMo-TTS 朗读这一镜口播">
        <i data-lucide="volume-2"></i><span>试听配音</span>
      </button>
      <button class="icon-button danger" id="ceDelete" type="button">
        <i data-lucide="trash-2"></i><span>删除此镜头</span>
      </button>
    </div>
  `;

  const liveUpdate = () => {
    renderTrack(initialState.timeline);
    renderPreview(initialState.timeline);
  };

  const ceTitle = els.clipEditor.querySelector("#ceTitle");
  const ceType = els.clipEditor.querySelector("#ceType");
  const ceHeadline = els.clipEditor.querySelector("#ceHeadline");
  const ceDetail = els.clipEditor.querySelector("#ceDetail");
  const ceVoiceover = els.clipEditor.querySelector("#ceVoiceover");
  const ceDuration = els.clipEditor.querySelector("#ceDuration");
  const ceDelete = els.clipEditor.querySelector("#ceDelete");
  const ceListen = els.clipEditor.querySelector("#ceListen");

  ceTitle.addEventListener("input", (event) => {
    scene.title = event.target.value;
    liveUpdate();
  });
  ceType.addEventListener("input", (event) => {
    scene.visual.type = event.target.value;
    liveUpdate();
  });
  ceHeadline.addEventListener("input", (event) => {
    scene.visual.headline = event.target.value;
    liveUpdate();
  });
  ceDetail.addEventListener("input", (event) => {
    scene.visual.detail = event.target.value;
    liveUpdate();
  });
  ceVoiceover.addEventListener("input", (event) => {
    scene.voiceover = event.target.value;
    scene.subtitle = event.target.value;
    liveUpdate();
  });
  ceDuration.addEventListener("change", (event) => {
    scene.duration = Math.max(2, Number(event.target.value) || scene.duration);
    recalcTimeline();
    renderAll(false);
  });
  ceDelete.addEventListener("click", () => deleteScene(initialState.currentScene));

  if (ceListen) {
    ceListen.addEventListener("click", async () => {
      const label = ceListen.querySelector("span");
      const original = label ? label.textContent : "";
      if (ceListen.classList.contains("is-loading")) return;
      ceListen.classList.add("is-loading");
      if (label) label.textContent = "合成中…";
      try {
        const src = await synthesizeVoiceover(ceVoiceover.value, getSelectedVoice());
        if (ttsAudio) {
          ttsAudio.pause();
        }
        ttsAudio = new Audio(src);
        if (label) label.textContent = "播放中…";
        ttsAudio.addEventListener("ended", () => {
          if (label) label.textContent = original;
        });
        await ttsAudio.play();
      } catch (error) {
        setCueHint(`试听失败：${error.message}`);
        if (label) label.textContent = original;
      } finally {
        ceListen.classList.remove("is-loading");
      }
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

function renderMetrics(data) {
  if (els.sceneCount) els.sceneCount.textContent = data.timeline.length;
  if (els.durationCount) els.durationCount.textContent = `${Math.round(data.project.targetDuration)}s`;
  if (els.sourceCount) els.sourceCount.textContent = data.insights.sourceCount;
}

function renderJson(data) {
  if (!els.jsonOutput) return;
  const hyperframesPlan = {
    ...data,
    hyperframes: {
      composition: "index.html",
      width: 1080,
      height: 1920,
      fps: 30,
      tracks: [
        "track 0: product media",
        "track 1: host slot",
        "track 2: info cards",
        "track 3: kinetic subtitles",
        "track 4: voiceover + bgm"
      ],
      exampleClip: '<div class="clip" data-start="0" data-duration="6" data-track-index="2">...</div>'
    }
  };
  els.jsonOutput.textContent = JSON.stringify(hyperframesPlan, null, 2);
}

function renderPreview(data) {
  const timeline = data.timeline;
  const scene = timeline[initialState.currentScene] || timeline[0];
  if (!scene) return;

  els.stageProduct.textContent = data.project.product || "3C 产品";
  els.stageTime.textContent = formatTime(scene.start);
  els.visualType.textContent = scene.visual.type;
  els.visualHeadline.textContent = scene.visual.headline;
  els.visualDetail.textContent = scene.visual.detail;
  els.subtitleBar.textContent = scene.subtitle;
  els.sceneIndicator.textContent = `${scene.index} / ${timeline.length}`;

  els.hostSlot.className = `host-slot ${initialState.layout}`;

  els.productVisual.innerHTML = "";
  const asset = initialState.assets[initialState.currentScene % Math.max(initialState.assets.length, 1)];
  if (asset?.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = asset.url;
    img.alt = asset.name;
    els.productVisual.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "device-placeholder";
    placeholder.innerHTML = "<span></span>";
    els.productVisual.appendChild(placeholder);
  }
}

function formatTime(value) {
  const seconds = Math.max(0, Math.round(value));
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function renderAll(rebuild = true) {
  const current = initialState.timeline;
  const hasScenes = current && Array.isArray(current.timeline) && current.timeline.length > 0;
  if (rebuild || !hasScenes) {
    initialState.timeline = buildTimeline();
  }
  const len = initialState.timeline.timeline.length;
  if (initialState.currentScene >= len) initialState.currentScene = Math.max(0, len - 1);
  if (initialState.currentScene < 0) initialState.currentScene = 0;

  renderTrackRuler(initialState.timeline);
  renderTrack(initialState.timeline);
  renderClipEditor(initialState.timeline);
  renderPreview(initialState.timeline);
  renderMetrics(initialState.timeline);
  renderJson(initialState.timeline);
  if (window.lucide) window.lucide.createIcons();
  saveDraft();
}

function setLayout(layout) {
  initialState.layout = layout;
  document.querySelectorAll(".segment").forEach((segment) => {
    segment.classList.toggle("active", segment.dataset.layout === layout);
  });
  if (initialState.timeline && Array.isArray(initialState.timeline.timeline)) {
    initialState.timeline.project.layout = layout;
  }
  renderPreview(initialState.timeline);
}

function toggleAdvanced() {
  const open = els.advPanel.hasAttribute("hidden");
  if (open) {
    els.advPanel.removeAttribute("hidden");
  } else {
    els.advPanel.setAttribute("hidden", "");
  }
  els.advToggle.setAttribute("aria-expanded", String(open));
  els.advToggle.classList.toggle("active", open);
}

function downloadFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildPrompt() {
  return `你是数码 3C 短视频编导。请基于我提供的产品事实、产品实拍素材描述、知乎真实评测摘要，生成一条"能让人看完"的竖屏短视频口播稿和 Timeline JSON。

短视频留人逻辑（最重要）：
1. 前 5 秒定生死：第 1 个分镜是 3-6 秒的最强钩子（痛点/反常识/利益点），第一句就抓住人，不要客套和慢热铺垫。
2. 按情绪曲线推进：钩子 → 痛点共鸣 → 悬念展开 → 高潮(揭晓最大价值) → 反转(诚实讲短板) → 结尾(给购买结论 + 引导关注/评论)。
3. 每个分镜结尾留一个"钩子/开放回路"引向下一镜，让人不划走；节奏紧凑、口语化、多短句。

硬性要求：
1. 不能照搬知乎原句，只能提炼观点、使用场景、优缺点和争议点。
2. 不得编造参数、价格、跑分、续航、降噪等级等事实。
3. 输出适合 ${els.platform.value} 的 ${els.targetDuration.value} 秒口播视频。
4. 每个分镜需要包含 start、end、voiceover、subtitle、visual.type、visual.layout、source。
5. 风格：真实、有判断、有钩子、有购买建议，像会讲故事的数码博主，不是念说明书。

产品：${els.productName.value}
品类：${els.category.value}
真人布局：${initialState.layout}

产品事实：
${els.factsInput.value}

真实评测素材：
${els.reviewInput.value}`;
}

function downloadBrief() {
  const data = initialState.timeline || buildTimeline();
  const lines = [
    "# 3C Review Video Studio 方案",
    "",
    "## 项目",
    `- 产品：${data.project.product}`,
    `- 品类：${data.project.category}`,
    `- 平台：${data.project.platform}`,
    `- 时长：${data.project.targetDuration}s`,
    "",
    "## 三项目可复用部分",
    ...modules.map((module) => `- ${module.name}：${module.value}`),
    "",
    "## 分镜脚本",
    ...data.timeline.map((scene) => `${scene.index}. ${scene.title} [${scene.start}-${scene.end}s]\n${scene.voiceover}`)
  ];
  downloadFile("3c-video-brief.md", lines.join("\n"), "text/markdown");
}

function currentTimeline() {
  return initialState.timeline || buildTimeline();
}

function srtTime(seconds) {
  const total = Math.max(0, Math.round(seconds * 1000));
  const ms = total % 1000;
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60000) % 60;
  const h = Math.floor(total / 3600000);
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function safeName() {
  const name = (currentTimeline().project?.product || "3c-video").trim();
  return name.replace(/[\\/:*?"<>|\s]+/g, "_") || "3c-video";
}

function exportScript() {
  const data = currentTimeline();
  const lines = [`【${data.project.product}】口播稿 · 共${data.timeline.length}镜 · ${data.project.targetDuration}s`, ""];
  data.timeline.forEach((scene) => {
    lines.push(`${scene.index}. ${scene.title}（${scene.duration || (scene.end - scene.start)}s）`);
    lines.push(scene.voiceover);
    lines.push("");
  });
  downloadFile(`${safeName()}_口播稿.txt`, lines.join("\n"), "text/plain;charset=utf-8");
}

function exportSrt() {
  const data = currentTimeline();
  let cursor = 0;
  const blocks = data.timeline.map((scene, i) => {
    const dur = Number(scene.duration) || Number(scene.end - scene.start) || 3;
    const start = cursor;
    const end = cursor + dur;
    cursor = end;
    const text = (scene.subtitle || scene.voiceover || "").trim();
    return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${text}\n`;
  });
  downloadFile(`${safeName()}_字幕.srt`, blocks.join("\n"), "text/plain;charset=utf-8");
}

function csvCell(value) {
  const text = String(value == null ? "" : value).replace(/"/g, '""');
  return `"${text}"`;
}

function exportShotlist() {
  const data = currentTimeline();
  const header = ["序号", "节奏标题", "开始(s)", "结束(s)", "时长(s)", "画面类型", "画面标题", "画面说明", "口播文案"];
  const rows = data.timeline.map((scene) =>
    [
      scene.index,
      scene.title,
      scene.start,
      scene.end,
      scene.duration || Number((scene.end - scene.start).toFixed(2)),
      scene.visual?.type || "",
      scene.visual?.headline || "",
      scene.visual?.detail || "",
      scene.voiceover || ""
    ]
      .map(csvCell)
      .join(",")
  );
  const csv = "\ufeff" + [header.map(csvCell).join(","), ...rows].join("\r\n");
  downloadFile(`${safeName()}_分镜表.csv`, csv, "text/csv;charset=utf-8");
}

const DRAFT_KEY = "directorDraft_v1";

function saveDraft() {
  if (!initialState.generated) return;
  try {
    const draft = {
      productName: els.productName.value,
      category: els.category.value,
      categoryTouched: initialState.categoryTouched,
      targetDuration: els.targetDuration.value,
      platform: els.platform.value,
      ttsVoice: els.ttsVoice ? els.ttsVoice.value : "",
      layout: initialState.layout,
      facts: els.factsInput.value,
      reviews: els.reviewInput.value,
      zhihuQuery: els.zhihuQuery ? els.zhihuQuery.value : "",
      timeline: initialState.timeline,
      currentScene: initialState.currentScene,
      apiStatus: els.apiStatus ? els.apiStatus.textContent : ""
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    /* ignore storage errors */
  }
}

function loadDraft() {
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
  } catch (error) {
    draft = null;
  }
  if (!draft || !draft.timeline || !Array.isArray(draft.timeline.timeline) || !draft.timeline.timeline.length) {
    return false;
  }
  els.productName.value = draft.productName || "";
  if (draft.category) els.category.value = draft.category;
  initialState.categoryTouched = Boolean(draft.categoryTouched);
  if (draft.targetDuration) els.targetDuration.value = draft.targetDuration;
  if (draft.platform) els.platform.value = draft.platform;
  if (draft.ttsVoice && els.ttsVoice) els.ttsVoice.value = draft.ttsVoice;
  if (draft.layout) initialState.layout = draft.layout;
  els.factsInput.value = draft.facts || "";
  els.reviewInput.value = draft.reviews || "";
  if (els.zhihuQuery) els.zhihuQuery.value = draft.zhihuQuery || "";
  initialState.timeline = draft.timeline;
  initialState.currentScene = draft.currentScene || 0;
  initialState.generated = true;
  document.querySelectorAll(".segment").forEach((seg) => {
    seg.classList.toggle("active", seg.dataset.layout === initialState.layout);
  });
  if (els.apiStatus && draft.apiStatus) setApiStatus(draft.apiStatus);
  return true;
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    /* ignore storage errors */
  }
}

function resetAll() {
  clearDraft();
  initialState.timeline = [];
  initialState.currentScene = 0;
  initialState.generated = false;
  initialState.categoryTouched = false;
  els.productName.value = "";
  els.category.selectedIndex = 0;
  els.factsInput.value = "";
  els.reviewInput.value = "";
  if (els.zhihuQuery) els.zhihuQuery.value = "";
  if (els.zhihuResults) els.zhihuResults.innerHTML = "";
  setApiStatus("本地预览");
  setCueHint("已重置。输入产品名点「一键生成」开始。");
  renderAll(true);
}

function bindEvents() {
  els.oneClickBtn.addEventListener("click", oneClickGenerate);
  els.regenerateBtn.addEventListener("click", generateTimelineFromApi);
  els.addSceneBtn.addEventListener("click", addScene);
  els.advToggle.addEventListener("click", toggleAdvanced);
  if (els.resetBtn) els.resetBtn.addEventListener("click", resetAll);
  if (els.zhihuSearchBtn) els.zhihuSearchBtn.addEventListener("click", () => searchZhihu());

  els.productName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      oneClickGenerate();
    }
  });

  // 用户手动改过品类后，不再自动推断
  els.category.addEventListener("change", () => {
    initialState.categoryTouched = true;
    saveDraft();
  });

  // 表单字段改动时持久化草稿（生成后才会真正写入）
  [els.productName, els.targetDuration, els.platform, els.ttsVoice, els.factsInput, els.reviewInput].forEach((field) => {
    if (field) field.addEventListener("change", saveDraft);
  });

  if (els.assetInput) {
    els.assetInput.addEventListener("change", (event) => {
      initialState.assets.forEach((asset) => URL.revokeObjectURL(asset.url));
      initialState.assets = [...event.target.files].map((file) => ({
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file)
      }));
      renderAssets();
      renderPreview(initialState.timeline);
    });
  }

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => setLayout(button.dataset.layout));
  });

  els.prevSceneBtn.addEventListener("click", () => {
    const total = initialState.timeline.timeline.length;
    initialState.currentScene = (initialState.currentScene - 1 + total) % total;
    renderAll(false);
  });

  els.nextSceneBtn.addEventListener("click", () => {
    const total = initialState.timeline.timeline.length;
    initialState.currentScene = (initialState.currentScene + 1) % total;
    renderAll(false);
  });

  els.downloadJsonBtn.addEventListener("click", () => {
    downloadFile("timeline.hyperframes.json", els.jsonOutput.textContent);
  });

  els.downloadBriefBtn.addEventListener("click", downloadBrief);

  function closeExportMenu() {
    if (!els.exportMenu) return;
    els.exportMenu.classList.remove("open");
    if (els.exportToggle) els.exportToggle.setAttribute("aria-expanded", "false");
  }

  if (els.exportToggle && els.exportMenu) {
    els.exportToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = els.exportMenu.classList.toggle("open");
      els.exportToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", (event) => {
      if (!els.exportMenu.contains(event.target)) closeExportMenu();
    });
  }

  if (els.exportScriptBtn) els.exportScriptBtn.addEventListener("click", () => { exportScript(); closeExportMenu(); });
  if (els.exportSrtBtn) els.exportSrtBtn.addEventListener("click", () => { exportSrt(); closeExportMenu(); });
  if (els.exportShotlistBtn) els.exportShotlistBtn.addEventListener("click", () => { exportShotlist(); closeExportMenu(); });

  els.copyPromptBtn.addEventListener("click", async () => {
    const prompt = buildPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      els.copyPromptBtn.querySelector("span").textContent = "已复制";
      setTimeout(() => {
        els.copyPromptBtn.querySelector("span").textContent = "Prompt";
      }, 1200);
    } catch {
      downloadFile("3c-prompt.txt", prompt, "text/plain");
    }
  });

  if (els.apiBase) {
    try {
      els.apiBase.value = localStorage.getItem(API_BASE_KEY) || "";
    } catch (error) {
      /* ignore storage errors */
    }
    els.apiBase.addEventListener("change", () => {
      const base = els.apiBase.value.trim().replace(/\/$/, "");
      els.apiBase.value = base;
      try {
        localStorage.setItem(API_BASE_KEY, base);
      } catch (error) {
        /* ignore storage errors */
      }
      setApiStatus(base ? "后端已配置" : "本地预览");
    });
  }
}

bindEvents();
renderAssets();
const restoredDraft = loadDraft();
renderAll(!restoredDraft);
if (restoredDraft) {
  setCueHint("已恢复上次草稿 ✓ 继续编辑，或点「重置」重新开始。");
}
