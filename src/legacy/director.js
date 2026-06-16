const initialState = {
  layout: "center",
  currentScene: 0,
  assets: [],
  timeline: [],
  generated: false,
  categoryTouched: false,
  cloneSpkId: "",
  clonePromptText: ""
};

/** 上次一键生成使用的产品名；换品时清空旧素材/分镜，避免品类残留 */
let lastGeneratedProduct = "";

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

/** 换产品名后清空旧知乎素材、事实与分镜，并重新推断品类 */
function prepareForNewProduct(product) {
  const inferred = inferCategory(product);
  if (inferred) els.category.value = inferred;
  initialState.categoryTouched = false;

  els.factsInput.value = "";
  els.reviewInput.value = "";
  if (els.zhihuQuery) els.zhihuQuery.value = product;
  if (els.zhihuResults) els.zhihuResults.innerHTML = "";

  initialState.timeline = [];
  initialState.currentScene = 0;
  initialState.generated = false;
  renderAll(true);
  window.dispatchEvent(new CustomEvent("director:update"));
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

function queryEls() {
  return {
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
    checkupBtn: document.querySelector("#checkupBtn"),
    gateBtn: document.querySelector("#gateBtn"),
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
    renderVideoBtn: document.querySelector("#renderVideoBtn"),
    renderFormat: document.querySelector("#renderFormat"),
    remotionPreviewBtn: document.querySelector("#remotionPreviewBtn"),
    remotionModal: document.querySelector("#remotionModal"),
    remotionCloseBtn: document.querySelector("#remotionCloseBtn"),
    remotionPlayerHost: document.querySelector("#remotionPlayerHost"),
    remotionFormatNote: document.querySelector("#remotionFormatNote"),
    exportPosterBtn: document.querySelector("#exportPosterBtn"),
    stockQuery: document.querySelector("#stockQuery"),
    stockSearchBtn: document.querySelector("#stockSearchBtn"),
    stockGrid: document.querySelector("#stockGrid"),
    stockTip: document.querySelector("#stockTip"),
    autoStockToggle: document.querySelector("#autoStockToggle"),
    compareSpec: document.querySelector("#compareSpec"),
    compareInsertBtn: document.querySelector("#compareInsertBtn"),
    compareTip: document.querySelector("#compareTip"),
    track: document.querySelector("#track"),
    trackRuler: document.querySelector("#trackRuler"),
    clipEditor: document.querySelector("#clipEditor"),
    jsonOutput: document.querySelector("#jsonOutput"),
    apiStatus: document.querySelector("#apiStatus"),
    apiBase: document.querySelector("#apiBase"),
    ttsVoice: document.querySelector("#ttsVoice"),
    cloneVoiceOption: document.querySelector("#cloneVoiceOption"),
    voiceSampleInput: document.querySelector("#voiceSampleInput"),
    voiceSampleName: document.querySelector("#voiceSampleName"),
    voicePromptText: document.querySelector("#voicePromptText"),
    enrollVoiceBtn: document.querySelector("#enrollVoiceBtn"),
    voiceCloneTip: document.querySelector("#voiceCloneTip"),
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
}

let elsCache = null;
const els = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!elsCache) elsCache = queryEls();
      return elsCache[prop];
    }
  }
);

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

  const isClone = voice === "clone";
  const spkId = initialState.cloneSpkId || "";
  if (isClone && !spkId) {
    throw new Error("还没克隆你的音色，请先在「高级设置 → 克隆我的音色」上传录音");
  }
  const key = isClone ? ttsKey(clean, `clone:${spkId}`) : ttsKey(clean, voice);
  if (ttsCache.has(key)) return ttsCache.get(key);

  const apiBase = getApiBase();
  if (!apiBase && location.protocol === "file:") {
    throw new Error("试听需要部署后端（本地 file:// 无法调用 TTS）");
  }
  const body = isClone
    ? { text: clean, voice: "clone", cloneSpkId: spkId, format: "wav" }
    : { text: clean, voice, format: "mp3" };
  const response = await fetch(`${apiBase}/api/tts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || !data.audio) {
    throw new Error(data.error || "TTS 合成失败");
  }
  const src = `data:audio/${data.format || (isClone ? "wav" : "mp3")};base64,${data.audio}`;
  ttsCache.set(key, src);
  return src;
}

function getSelectedVoice() {
  return (els.ttsVoice && els.ttsVoice.value) || "mimo_default";
}

// 上传一段录音 + 文字，克隆音色（转发到自部署 CosyVoice 服务）
async function enrollVoice() {
  const file = els.voiceSampleInput && els.voiceSampleInput.files && els.voiceSampleInput.files[0];
  const promptText = (els.voicePromptText && els.voicePromptText.value.trim()) || "";
  if (!file) {
    setVoiceCloneTip("请先选择一段 5–10 秒的录音文件", true);
    return;
  }
  if (!promptText) {
    setVoiceCloneTip("请填写这段录音逐字说的内容（必填）", true);
    if (els.voicePromptText) els.voicePromptText.focus();
    return;
  }

  const apiBase = getApiBase();
  if (!apiBase && location.protocol === "file:") {
    setVoiceCloneTip("克隆需要部署后端（本地 file:// 无法调用）", true);
    return;
  }

  const btn = els.enrollVoiceBtn;
  const label = btn && btn.querySelector("span");
  const original = label ? label.textContent : "";
  if (btn) btn.disabled = true;
  if (label) label.textContent = "克隆中…";
  setVoiceCloneTip("正在上传录音并克隆音色，请稍候（首次会等模型加载）…");

  try {
    const form = new FormData();
    form.append("audio", file, file.name || "voice.wav");
    form.append("prompt_text", promptText);
    const response = await fetch(`${apiBase}/api/voice-enroll`, { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok || !data.spkId) {
      throw new Error(data.error || "音色克隆失败");
    }
    initialState.cloneSpkId = data.spkId;
    initialState.clonePromptText = data.promptText || promptText;
    enableCloneVoiceOption(true);
    if (els.ttsVoice) els.ttsVoice.value = "clone";
    ttsCache.clear();
    persistCloneState();
    saveDraft();
    setVoiceCloneTip(`克隆成功 ✓ 音色已选为「我的克隆音色」，每镜「试听配音」即用你的声音（spkId: ${data.spkId}）`);
  } catch (error) {
    setVoiceCloneTip(`克隆失败：${error.message}`, true);
  } finally {
    if (btn) btn.disabled = false;
    if (label) label.textContent = original;
  }
}

function setVoiceCloneTip(text, isError = false) {
  if (!els.voiceCloneTip) return;
  els.voiceCloneTip.textContent = text;
  els.voiceCloneTip.classList.toggle("is-error", Boolean(isError));
}

function enableCloneVoiceOption(enabled) {
  if (!els.cloneVoiceOption) return;
  els.cloneVoiceOption.disabled = !enabled;
  els.cloneVoiceOption.textContent = enabled ? "我的克隆音色" : "我的克隆音色（先在下方上传）";
}

// 克隆音色独立持久化（与草稿解耦：克隆可发生在生成分镜之前）
const CLONE_SPK_KEY = "cloneVoice_v1";

function persistCloneState() {
  try {
    if (initialState.cloneSpkId) {
      localStorage.setItem(
        CLONE_SPK_KEY,
        JSON.stringify({ spkId: initialState.cloneSpkId, promptText: initialState.clonePromptText || "" })
      );
    } else {
      localStorage.removeItem(CLONE_SPK_KEY);
    }
  } catch (error) {
    /* ignore storage errors */
  }
}

function restoreCloneState() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(CLONE_SPK_KEY) || "null");
  } catch (error) {
    saved = null;
  }
  if (saved && saved.spkId) {
    initialState.cloneSpkId = saved.spkId;
    initialState.clonePromptText = saved.promptText || "";
    enableCloneVoiceOption(true);
    if (els.voicePromptText && saved.promptText) els.voicePromptText.value = saved.promptText;
    setVoiceCloneTip(`已克隆音色（spkId: ${saved.spkId}）。在上方音色选「我的克隆音色」即可用你的声音试听。`);
  }
}

async function rewriteCurrentScene(scene) {
  const apiBase = getApiBase();
  if (!apiBase && location.protocol === "file:") {
    throw new Error("重写需要部署后端（本地 file:// 无法调用）");
  }
  const scenes = (initialState.timeline && initialState.timeline.timeline) || [];
  const pos = scenes.indexOf(scene);
  const prev = pos > 0 ? scenes[pos - 1] : null;
  const next = pos >= 0 && pos < scenes.length - 1 ? scenes[pos + 1] : null;

  const response = await fetch(`${apiBase}/api/rewrite-scene`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productName: els.productName.value.trim(),
      category: els.category.value,
      platform: els.platform.value,
      facts: els.factsInput.value,
      reviews: els.reviewInput.value,
      scene: {
        title: scene.title,
        duration: scene.duration,
        start: scene.start,
        end: scene.end,
        voiceover: scene.voiceover,
        visual: scene.visual
      },
      prevVoiceover: prev ? prev.voiceover : "",
      nextTitle: next ? next.title : ""
    })
  });
  const data = await response.json();
  if (!response.ok || !data.voiceover) {
    throw new Error(data.error || "重写失败");
  }

  if (data.title) scene.title = data.title;
  scene.voiceover = data.voiceover;
  scene.subtitle = data.subtitle || data.voiceover;
  scene.visual = scene.visual || {};
  if (data.visual) {
    if (data.visual.type) scene.visual.type = data.visual.type;
    if (data.visual.headline) scene.visual.headline = data.visual.headline;
    if (data.visual.detail) scene.visual.detail = data.visual.detail;
  }
  scene.source = "MiMo 单镜重写";
  setCueHint(`「${scene.title}」已重写 ✓`);
  saveDraft();
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
        asset: scene.visual?.asset || fallback.visual.asset,
        ...(scene.visual?.metric && typeof scene.visual.metric === "object" ? { metric: scene.visual.metric } : {}),
        ...(scene.visual?.compare && typeof scene.visual.compare === "object" ? { compare: scene.visual.compare } : {}),
        ...(scene.visual?.dataviz && typeof scene.visual.dataviz === "object" ? { dataviz: scene.visual.dataviz } : {}),
        ...(scene.visual?.transition && typeof scene.visual.transition === "object" ? { transition: scene.visual.transition } : {}),
        ...(scene.visual?.radar && typeof scene.visual.radar === "object" ? { radar: scene.visual.radar } : {}),
        ...(scene.visual?.shootGuide && typeof scene.visual.shootGuide === "object" ? { shootGuide: scene.visual.shootGuide } : {}),
        ...(scene.visual?.broll && typeof scene.visual.broll === "object" ? { broll: scene.visual.broll } : {})
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

function runTaoAnimation(product) {
  return new Promise((resolve) => {
    const overlay = document.querySelector("#taoOverlay");
    if (!overlay) {
      resolve();
      return;
    }

    const subtitle = document.querySelector("#taoSubtitle");
    const desc1 = document.querySelector("#taoNodeDesc1");
    const stageContainer = document.querySelector("#taoStageContainer");
    const iconLeft = document.querySelector("#taoIconLeft");
    const iconRight = document.querySelector("#taoIconRight");
    const titleLeft = document.querySelector("#taoTitleLeft");
    const titleRight = document.querySelector("#taoTitleRight");
    const skipBtn = document.querySelector("#taoSkipBtn");

    if (desc1) desc1.textContent = `制作 ${product} 深度评测视频`;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const PHASE_MS = reducedMotion
      ? { hold1: 500, hold2: 500, hold3: 500, hold4: 400 }
      : {
          hold1: 2600,
          hold2: 2800,
          hold3: 2800,
          hold4: 2000
        };

    const timers = [];
    let isSkipped = false;

    const setPhase = (phase) => {
      if (stageContainer) stageContainer.dataset.phase = String(phase);
    };

    const schedule = (fn, ms) => {
      const id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    };

    const cleanup = () => {
      if (isSkipped) return;
      isSkipped = true;
      timers.forEach(clearTimeout);
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.hidden = true;
        setPhase(0);
        resolve();
      }, 800);
    };

    if (skipBtn) {
      skipBtn.onclick = cleanup;
    }

    // Reset → 道生一
    overlay.hidden = false;
    overlay.style.opacity = "1";
    if (iconLeft) iconLeft.textContent = "阴";
    if (iconRight) iconRight.textContent = "阳";
    if (titleLeft) titleLeft.textContent = "知乎真实口碑";
    if (titleRight) titleRight.textContent = "产品核心事实";
    setPhase(1);
    if (subtitle) subtitle.textContent = "道生一：混沌初开，意念凝聚成形…";

    // 一生二：核心节点分裂，阴阳两仪渐现
    schedule(() => {
      if (isSkipped) return;
      setPhase(2);
      if (subtitle) subtitle.textContent = "一生二：两仪分明，口碑与事实交织…";
    }, PHASE_MS.hold1);

    // 二生三：第三极「人」自下方凝聚，天地人三才合一
    schedule(() => {
      if (isSkipped) return;
      setPhase(3);
      if (iconLeft) iconLeft.textContent = "天";
      if (iconRight) iconRight.textContent = "地";
      if (titleLeft) titleLeft.textContent = "知乎口碑";
      if (titleRight) titleRight.textContent = "核心事实";
      if (subtitle) subtitle.textContent = "二生三：天地人三才合一，万物将生…";
    }, PHASE_MS.hold1 + PHASE_MS.hold2);

    // 三生万物：全体共鸣后淡出
    schedule(() => {
      if (isSkipped) return;
      setPhase(4);
      if (subtitle) subtitle.textContent = "三生万物：万千分镜化生，导演台就绪！";
    }, PHASE_MS.hold1 + PHASE_MS.hold2 + PHASE_MS.hold3);

    schedule(() => {
      if (isSkipped) return;
      cleanup();
    }, PHASE_MS.hold1 + PHASE_MS.hold2 + PHASE_MS.hold3 + PHASE_MS.hold4);
  });
}

async function oneClickGenerate() {
  const product = els.productName.value.trim();
  if (!product) {
    setCueHint("请先输入产品名，例如：华为Nova16");
    els.productName.focus();
    return;
  }

  if (lastGeneratedProduct && lastGeneratedProduct !== product) {
    prepareForNewProduct(product);
  }
  lastGeneratedProduct = product;

  // 每次生成都按产品名刷新品类（用户未手动锁定时）
  if (!initialState.categoryTouched) {
    const inferred = inferCategory(product);
    if (inferred) els.category.value = inferred;
  }

  const taoToggle = document.querySelector("#taoAnimationToggle");
  const useAnimation = taoToggle ? taoToggle.checked : true;

  setBusy(true);
  setGenerating(true);

  let zhihuOk = false;
  // Start the API generation promise
  const apiPromise = (async () => {
    setCueHint(`已识别品类「${els.category.value}」，正在搜索知乎抓取真实素材…`);
    try {
      await searchZhihu({ silent: true, freshReviews: true });
      zhihuOk = Boolean(els.reviewInput.value.trim());
    } catch (error) {
      console.warn(error);
    }
    if (!zhihuOk) {
      setCueHint("知乎素材未更新，将仅基于产品名与品类生成（已忽略旧评测素材）…");
    }
    setCueHint("正在用 MiMo 生成分镜，请稍候…");
    await generateTimelineFromApi();
  })();

  try {
    if (useAnimation) {
      // Run the animation and wait for both the animation and the API generation to complete
      await Promise.all([runTaoAnimation(product), apiPromise]);

      // Automatically uncheck the toggle and set skip flag for subsequent runs
      if (taoToggle) {
        taoToggle.checked = false;
        localStorage.setItem("skipTaoAnimation", "true");
      }
    } else {
      // Directly wait for API generation
      await apiPromise;
    }

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
  const freshReviews = options.freshReviews === true;
  const query = (els.zhihuQuery && els.zhihuQuery.value.trim()) || els.productName.value.trim();
  if (!query) {
    setApiStatus("请先填关键词或产品名");
    return;
  }

  if (freshReviews && els.reviewInput) {
    els.reviewInput.value = "";
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
    if (freshReviews && els.reviewInput) {
      els.reviewInput.value = "";
    }
    if (!silent) throw error;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function productPrefix() {
  return els.productName.value.trim() || "这款产品";
}

/* ---- 抠图：浏览器本地、免费、开源（@imgly/background-removal，AGPL）---- */
let _bgRemovalPromise = null;
function loadBgRemoval() {
  if (!_bgRemovalPromise) {
    _bgRemovalPromise = import(
      "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm"
    ).then((m) => ({
      removeBackground: m.removeBackground || (m.default && m.default.removeBackground)
    }));
  }
  return _bgRemovalPromise;
}

async function runCutout(asset, btn) {
  if (asset.busy) return;
  asset.busy = true;
  btn.disabled = true;
  btn.textContent = "准备…";
  try {
    const { removeBackground } = await loadBgRemoval();
    if (typeof removeBackground !== "function") {
      throw new Error("抠图库加载失败");
    }
    const blob = await removeBackground(asset.originalUrl || asset.url, {
      output: { format: "image/png" },
      progress: (key, current, total) => {
        if (typeof key === "string" && key.indexOf("fetch") === 0) {
          const pct = total ? Math.round((current / total) * 100) : 0;
          btn.textContent = `下载模型 ${pct}%`;
        } else {
          btn.textContent = "抠图中…";
        }
      }
    });
    asset.originalUrl = asset.originalUrl || asset.url;
    if (asset.cutoutUrl) URL.revokeObjectURL(asset.cutoutUrl);
    asset.cutoutUrl = URL.createObjectURL(blob);
    asset.url = asset.cutoutUrl;
    asset.cutout = true;
    asset.busy = false;
    renderAssets();
    renderPreview(initialState.timeline);
    setCueHint(`「${asset.name}」已抠出主体 ✓ 透明背景可直接用作画面`);
  } catch (error) {
    asset.busy = false;
    btn.disabled = false;
    btn.textContent = "一键抠图";
    const msg = error && error.message ? error.message : String(error);
    setCueHint(`抠图失败：${msg}（首次需联网下载模型，请重试）`);
  }
}

function revertAsset(asset) {
  if (!asset.originalUrl) return;
  if (asset.cutoutUrl) {
    URL.revokeObjectURL(asset.cutoutUrl);
    asset.cutoutUrl = null;
  }
  asset.url = asset.originalUrl;
  asset.cutout = false;
  renderAssets();
  renderPreview(initialState.timeline);
  setCueHint(`「${asset.name}」已还原原图`);
}

function renderAssets() {
  if (!els.assetStrip) return;
  els.assetStrip.innerHTML = "";
  if (!initialState.assets.length) {
    return;
  }

  initialState.assets.forEach((asset) => {
    const card = document.createElement("div");
    card.className = "asset-card";

    const thumb = document.createElement("div");
    thumb.className = "asset-thumb";
    const isImage = asset.type.startsWith("image/");
    if (isImage) {
      if (asset.cutout) thumb.classList.add("is-cutout");
      const img = document.createElement("img");
      img.src = asset.url;
      img.alt = asset.name;
      thumb.appendChild(img);
    } else {
      thumb.textContent = "视频";
    }
    card.appendChild(thumb);

    if (isImage) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "asset-cut-btn" + (asset.cutout ? " done" : "");
      btn.textContent = asset.cutout ? "已抠图 · 还原" : "一键抠图";
      btn.title = asset.cutout
        ? "点击还原原图"
        : "浏览器本地抠出主体（手机/耳机/手表），免费、不上传";
      btn.addEventListener("click", () => {
        if (asset.cutout) revertAsset(asset);
        else runCutout(asset, btn);
      });
      card.appendChild(btn);
    }

    els.assetStrip.appendChild(card);
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

/** Preact EditorPanel 已接管时间线/剪辑器 DOM 时，跳过 legacy 重复渲染 */
function isPreactEditorActive() {
  const track = document.querySelector("#track");
  return Boolean(track?.hasAttribute("hidden"));
}

/** Preact PreviewStage 已接管预览舞台时，跳过 legacy renderPreview */
function isPreactPreviewActive() {
  return Boolean(document.querySelector("#videoStage[data-preact-preview]"));
}

function renderTrackRuler(data) {
  if (!els.trackRuler || isPreactEditorActive()) return;
  const total = data.project.targetDuration || 90;
  els.trackRuler.innerHTML = "";
  for (let i = 0; i <= 5; i += 1) {
    const tick = document.createElement("span");
    tick.textContent = `${Math.round((total / 5) * i)}s`;
    els.trackRuler.appendChild(tick);
  }
}

function renderTrack(data) {
  if (!els.track || isPreactEditorActive()) return;
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
  if (!els.clipEditor || isPreactEditorActive()) return;
  const timeline = data.timeline;
  const scene = timeline[initialState.currentScene] || timeline[0];
  if (!scene) {
    els.clipEditor.innerHTML = "";
    return;
  }
  const mv = scene.visual.metric || {};

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
    <details class="ce-metric"${scene.visual.metric ? " open" : ""}>
      <summary>数据卡（可选）· 数字滚动 + 进度环</summary>
      <p class="ce-metric-hint">填「指标值」即给这一镜渲数据卡（大数字从 0 滚到目标 + 进度环）；留空则保持普通分镜。给「上限」按占比填环，不给则环装饰性扫满一圈。</p>
      <div class="ce-grid">
        <label class="ce-field">
          <span>指标值</span>
          <input id="ceMetricValue" type="text" placeholder="如 12" value="${escapeHtml(mv.value != null ? String(mv.value) : "")}" />
        </label>
        <label class="ce-field">
          <span>单位</span>
          <input id="ceMetricUnit" type="text" placeholder="如 小时 / % / dB" value="${escapeHtml(mv.unit || "")}" />
        </label>
      </div>
      <div class="ce-grid">
        <label class="ce-field">
          <span>上限 max（可选）</span>
          <input id="ceMetricMax" type="number" step="any" placeholder="如 16" value="${escapeHtml(mv.max != null ? String(mv.max) : "")}" />
        </label>
        <label class="ce-field">
          <span>标签</span>
          <input id="ceMetricLabel" type="text" placeholder="如 实测续航" value="${escapeHtml(mv.label || "")}" />
        </label>
      </div>
      <label class="ce-field">
        <span>说明 caption（可选）</span>
        <input id="ceMetricCaption" type="text" placeholder="如 重度使用一天还有富余" value="${escapeHtml(mv.caption || "")}" />
      </label>
      <label class="ce-check">
        <input id="ceMetricBetter" type="checkbox"${mv.better === "low" ? " checked" : ""} />
        <span>越低越好（如降噪 -45dB，用青绿强调）</span>
      </label>
    </details>
    <label class="ce-field">
      <span>口播文案</span>
      <textarea id="ceVoiceover" rows="5">${escapeHtml(scene.voiceover)}</textarea>
    </label>
    <div class="ce-actions">
      <button class="icon-button" id="ceRewrite" type="button" title="只让 MiMo 重写这一镜（保留时长和节奏）">
        <i data-lucide="wand-sparkles"></i><span>重写本镜</span>
      </button>
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
    refreshRemotionPreviewIfOpen();
  };

  const ceTitle = els.clipEditor.querySelector("#ceTitle");
  const ceType = els.clipEditor.querySelector("#ceType");
  const ceHeadline = els.clipEditor.querySelector("#ceHeadline");
  const ceDetail = els.clipEditor.querySelector("#ceDetail");
  const ceVoiceover = els.clipEditor.querySelector("#ceVoiceover");
  const ceDuration = els.clipEditor.querySelector("#ceDuration");
  const ceDelete = els.clipEditor.querySelector("#ceDelete");
  const ceListen = els.clipEditor.querySelector("#ceListen");
  const ceRewrite = els.clipEditor.querySelector("#ceRewrite");

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

  const ceMetricValue = els.clipEditor.querySelector("#ceMetricValue");
  const ceMetricUnit = els.clipEditor.querySelector("#ceMetricUnit");
  const ceMetricMax = els.clipEditor.querySelector("#ceMetricMax");
  const ceMetricLabel = els.clipEditor.querySelector("#ceMetricLabel");
  const ceMetricCaption = els.clipEditor.querySelector("#ceMetricCaption");
  const ceMetricBetter = els.clipEditor.querySelector("#ceMetricBetter");
  // 「指标值」是开关：能解析出数才挂 visual.metric（出片/预览都据此渲数据卡），否则清掉回退普通分镜。
  const applyMetric = () => {
    const valueText = ceMetricValue.value.trim();
    const hasNumber = /-?\d+(?:\.\d+)?/.test(valueText);
    if (!valueText || !hasNumber) {
      delete scene.visual.metric;
    } else {
      const metric = { value: valueText };
      const unit = ceMetricUnit.value.trim();
      const label = ceMetricLabel.value.trim();
      const caption = ceMetricCaption.value.trim();
      const maxText = ceMetricMax.value.trim();
      if (unit) metric.unit = unit;
      if (label) metric.label = label;
      if (caption) metric.caption = caption;
      if (maxText && /-?\d+(?:\.\d+)?/.test(maxText)) metric.max = Number(maxText);
      if (ceMetricBetter.checked) metric.better = "low";
      scene.visual.metric = metric;
    }
    liveUpdate();
  };
  [ceMetricValue, ceMetricUnit, ceMetricMax, ceMetricLabel, ceMetricCaption].forEach((el) =>
    el.addEventListener("input", applyMetric)
  );
  ceMetricBetter.addEventListener("change", applyMetric);

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

  if (ceRewrite) {
    ceRewrite.addEventListener("click", async () => {
      const label = ceRewrite.querySelector("span");
      const original = label ? label.textContent : "";
      if (ceRewrite.classList.contains("is-loading")) return;
      ceRewrite.classList.add("is-loading");
      if (label) label.textContent = "重写中…";
      try {
        await rewriteCurrentScene(scene);
        renderAll(false);
      } catch (error) {
        setCueHint(`重写失败：${error.message}`);
        ceRewrite.classList.remove("is-loading");
        if (label) label.textContent = original;
      }
    });
  }

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
  if (isPreactPreviewActive()) return;
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
  els.productVisual.classList.toggle("is-cutout", Boolean(asset && asset.cutout));
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
  refreshRemotionPreviewIfOpen();
  notifyDirectorUpdate();
}

/** 通知 Preact 侧（features/editor）状态已变化 */
function notifyDirectorUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("director:update"));
  }
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

/* ---- 渲染视频：把当前 Timeline 发到渲染 worker（RENDER_URL），出片 MP4 ---- */

/** 浏览器直连 render.1go.im，避免 CF Pages Function 30s 超时截断长渲染 */
let cachedRenderDirectUrl = "";

async function resolveRenderEndpoint(apiBase) {
  if (cachedRenderDirectUrl) return `${cachedRenderDirectUrl}/render`;
  try {
    const res = await fetch(`${apiBase}/api/health`);
    const data = await res.json();
    const direct = String(data.renderDirectUrl || "").trim().replace(/\/$/, "");
    if (direct && /^https:\/\//i.test(direct)) {
      cachedRenderDirectUrl = direct;
      return `${direct}/render`;
    }
  } catch (e) {
    console.warn("resolveRenderEndpoint", e);
  }
  return `${apiBase}/api/render`;
}

async function postRenderRequest(apiBase, body) {
  const endpoint = await resolveRenderEndpoint(apiBase);
  const viaDirect = !endpoint.includes("/api/render");
  if (viaDirect) {
    setCueHint("正在直连渲染节点出片（约 2–3 分钟），请勿关闭页面…");
  }
  return fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
let lastRenderUrl = "";

function setRenderBtn(label, busy) {
  const btn = els.renderVideoBtn;
  if (!btn) return;
  const span = btn.querySelector("span");
  if (span) span.textContent = label;
  btn.disabled = Boolean(busy);
  btn.classList.toggle("is-busy", Boolean(busy));
}

async function renderVideo() {
  const data = currentTimeline();
  if (!data.timeline || !data.timeline.length) {
    setCueHint("还没有分镜可渲染，先生成脚本。");
    return;
  }
  const apiBase = getApiBase();
  if (!apiBase && location.protocol === "file:") {
    setCueHint("渲染需要部署后端（本地 file:// 无法调用渲染服务）。");
    return;
  }
  const voice = getSelectedVoice();
  if (voice === "clone" && !initialState.cloneSpkId) {
    setCueHint("选了「我的克隆音色」但还没克隆，请先在「高级设置」上传录音，或换预设音色。");
    return;
  }

  // 防垃圾质检闸门：留人分 + 事实溯源 + 反洗稿。不达标先拦下，可人工放行。
  const report = qualityGate(data);
  if (!report.pass) {
    openGate(report, () => performRender(data, apiBase, voice));
    return;
  }
  await performRender(data, apiBase, voice);
}

async function performRender(data, apiBase, voice) {
  if (lastRenderUrl) {
    URL.revokeObjectURL(lastRenderUrl);
    lastRenderUrl = "";
  }
  setRenderBtn("渲染中…", true);
  setCueHint("正在渲染视频：逐镜配音 → 按真实时长校准 → 出片，首次可能要 2-3 分钟，请稍候…");

  // 预览↔出片共用映射：上传了图就按镜号轮询分配（和 <Player> 预览同一份规则），并编码为 base64 发给 worker。
  const { timeline: alignedTimeline, assetEntries } = assignSceneAssets(data);
  const body = { timeline: alignedTimeline, voice };
  if (voice === "clone") body.cloneSpkId = initialState.cloneSpkId || "";
  if (els.autoStockToggle && els.autoStockToggle.checked) body.autoStock = true;
  if (els.renderFormat && els.renderFormat.value) body.format = els.renderFormat.value;
  // 游戏化 HUD / Agnes 空镜依赖 Remotion 合成（HyperFrames 模板不含擂台/雷达等组件）
  body.engine = "remotion";
  // 图片 base64 内联；远程 MP4（Agnes 等）由 worker 按 URL 下载，避免超大请求体
  const assetKeys = Object.keys(assetEntries);
  if (assetKeys.length) {
    const assets = {};
    const remoteAssets = {};
    await Promise.all(
      assetKeys.map(async (key) => {
        const entry = assetEntries[key];
        const isVideo =
          (entry.type && entry.type.startsWith("video/")) ||
          /\.(mp4|webm|mov)(\?|#|$)/i.test(String(entry.url || ""));
        if (isVideo) {
          remoteAssets[key] = { url: entry.url, type: entry.type || "video/mp4" };
          return;
        }
        try {
          assets[key] = await urlToBase64(entry.url);
        } catch (e) {
          /* skip */
        }
      })
    );
    if (Object.keys(assets).length) body.assets = assets;
    if (Object.keys(remoteAssets).length) body.remoteAssets = remoteAssets;
  }

  try {
    const response = await postRenderRequest(apiBase, body);
    const type = response.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const payload = await response.json().catch(() => ({}));
      // 配了 R2：成片已上传，返回可分享 URL（可播/下载/分享）。
      if (response.ok && payload.ok && payload.url) {
        lastRenderUrl = payload.url;
        showRenderPreview(payload.url, { shareUrl: payload.url, public: payload.public });
        const mb = payload.bytes ? `${(payload.bytes / 1024 / 1024).toFixed(1)}MB ` : "";
        setCueHint(
          payload.public
            ? `渲染完成 ✓ 成片已存云端（${mb}MP4），下方可播放/下载/复制分享链接。`
            : `渲染完成 ✓ 成片已存 R2（${mb}MP4）。链接为私有 bucket，需在 worker 配 R2_PUBLIC_BASE 才能公网播放。`
        );
        return;
      }
      // 否则是错误 JSON
      let message = payload.error || "渲染失败";
      if (response.status === 501) {
        message = "渲染服务未配置：请在后端设置 RENDER_URL 指向你的渲染 worker（见 video-render/README）。";
      } else if (response.status === 502 || response.status === 530) {
        message =
          "渲染隧道离线（5060/WSL 可能休眠或 cloudflared 已退出）。请唤醒 WSL，运行 scripts/cloudflared-watchdog.sh 或 systemctl restart 3c-cloudflared-tunnel 后重试。";
      } else if (response.status === 524 || (response.status === 502 && !cachedRenderDirectUrl)) {
        message =
          "渲染超时：分镜较多时出片需 2–3 分钟。请硬刷新页面后重试（将直连渲染节点）；或减少分镜数。";
      }
      setCueHint(message);
      setRenderBtn("渲染视频", false);
      return;
    }
    if (!response.ok) {
      setCueHint("渲染失败");
      setRenderBtn("渲染视频", false);
      return;
    }
    const blob = await response.blob();
    lastRenderUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = lastRenderUrl;
    link.download = `${safeName()}.mp4`;
    link.click();
    showRenderPreview(lastRenderUrl);
    const mb = (blob.size / 1024 / 1024).toFixed(1);
    setCueHint(`渲染完成 ✓ 已下载 ${mb}MB MP4，下方可直接预览。`);
  } catch (error) {
    setCueHint(`渲染请求出错：${error.message || error}`);
  } finally {
    setRenderBtn("渲染视频", false);
  }
}

function showRenderPreview(url, opts = {}) {
  let host = document.querySelector("#renderPreview");
  if (!host) {
    host = document.createElement("div");
    host.id = "renderPreview";
    host.className = "render-preview";
    const anchor = els.jsonOutput && els.jsonOutput.closest("section");
    (anchor || document.body).insertBefore(host, anchor || null);
  }
  host.innerHTML = "";
  const title = document.createElement("p");
  title.className = "render-preview-title";
  title.textContent = "成片预览";
  const video = document.createElement("video");
  video.src = url;
  video.controls = true;
  video.playsInline = true;
  host.appendChild(title);
  host.appendChild(video);

  // R2 托管成片：给「下载 / 复制分享链接」操作。
  if (opts.shareUrl) {
    const bar = document.createElement("div");
    bar.className = "render-share";
    const dl = document.createElement("a");
    dl.className = "icon-button";
    dl.href = opts.shareUrl;
    dl.download = `${safeName()}.mp4`;
    dl.textContent = "下载 MP4";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "icon-button";
    copy.textContent = "复制分享链接";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(opts.shareUrl);
        copy.textContent = "已复制 ✓";
        setTimeout(() => (copy.textContent = "复制分享链接"), 1600);
      } catch (e) {
        copy.textContent = opts.shareUrl;
      }
    });
    bar.appendChild(dl);
    bar.appendChild(copy);
    if (opts.public === false) {
      const note = document.createElement("span");
      note.className = "render-share-note";
      note.textContent = "（私有链接，配 R2_PUBLIC_BASE 后可公开播放）";
      bar.appendChild(note);
    }
    host.appendChild(bar);
  }
  host.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ---- Remotion <Player> 网页实时预览（和「渲染视频」同一套模板，无需后端）---- */
let remotionHandle = null;
let remotionScriptPromise = null;
let remotionRefreshTimer = null;

// 懒加载打包好的预览引擎（assets/remotion-player.js，仅首次打开预览时加载）
function loadRemotionPlayerScript() {
  if (window.Mount3CRemotionPlayer) return Promise.resolve();
  if (remotionScriptPromise) return remotionScriptPromise;
  remotionScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./assets/remotion-player.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      remotionScriptPromise = null;
      reject(new Error("加载预览引擎失败"));
    };
    document.head.appendChild(script);
  });
  return remotionScriptPromise;
}

// ---- 预览↔后端共用：按镜号把上传图轮询分配给各镜 ----
// 返回 { timeline(已重写 visual.asset), assetEntries: { key: {url,type} } }
// 分镜已绑定素材名（含 Agnes 远程 MP4）时保留原名；无图时返回原 timeline。
function assignSceneAssets(data) {
  const scenes = Array.isArray(data.timeline) ? data.timeline : [];
  const pool = initialState.assets.filter((a) => a.url && a.type);
  const imgs = pool.filter((a) => a.type.startsWith("image/"));
  const assetEntries = {};
  const findAsset = (name) => pool.find((a) => a.name === name);

  const rewritten = scenes.map((scene, i) => {
    const visual = { ...(scene.visual || {}) };
    const bound = visual.asset ? findAsset(visual.asset) : null;
    if (bound) {
      assetEntries[visual.asset] = { url: bound.url, type: bound.type };
      return { ...scene, visual };
    }
    if (visual.broll?.videoUrl) {
      const key = visual.asset || `agnes_scene_${i}.mp4`;
      assetEntries[key] = { url: visual.broll.videoUrl, type: "video/mp4" };
      return { ...scene, visual: { ...visual, asset: key } };
    }
    if (!imgs.length) return scene;
    const img = imgs[i % imgs.length];
    const ext = (img.type || "image/png").split("/")[1] || "png";
    const key = `scene-${i}.${ext === "jpeg" ? "jpg" : ext}`;
    assetEntries[key] = { url: img.url, type: img.type };
    return { ...scene, visual: { ...visual, asset: key } };
  });

  return { timeline: { ...data, timeline: rewritten }, assetEntries };
}

// blob:/data: URL → base64 字符串（不含前缀），用于渲染请求把图传给 worker。
async function urlToBase64(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 把当前 Timeline + 画幅 + 上传图整理成 <Player> 的 props。
// 上传了图就按镜号循环分配（和出片相同映射规则），没图则纯渐变背景。
function buildRemotionProps() {
  const data = currentTimeline();
  const format = (els.renderFormat && els.renderFormat.value) || "9:16";
  const { timeline, assetEntries } = assignSceneAssets(data);
  const assetMap = {};
  const assetKinds = {};
  for (const [key, entry] of Object.entries(assetEntries)) {
    assetMap[key] = entry.url;
    const isVideo =
      (entry.type && entry.type.startsWith("video/")) ||
      /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(entry.url || ""));
    assetKinds[key] = isVideo ? "video" : "image";
  }
  return { timeline, format, assetMap, assetKinds };
}

function updateRemotionFormatNote(format) {
  if (!els.remotionFormatNote) return;
  const map = { "9:16": "竖屏 1080×1920", "16:9": "横屏 1920×1080", "1:1": "方图 1080×1080" };
  els.remotionFormatNote.textContent = map[format] || "";
}

async function openRemotionPreview() {
  const data = currentTimeline();
  if (!data.timeline || !data.timeline.length) {
    setCueHint("还没有分镜可预览，先生成脚本。");
    return;
  }
  els.remotionModal.removeAttribute("hidden");
  document.body.classList.add("remotion-open");
  const loading = document.querySelector("#remotionLoading");
  try {
    await loadRemotionPlayerScript();
  } catch (e) {
    if (loading) loading.textContent = "加载预览引擎失败：请确认 assets/remotion-player.js 已部署。";
    return;
  }
  // 弹层可能在加载期间被关掉
  if (els.remotionModal.hasAttribute("hidden")) return;
  els.remotionPlayerHost.innerHTML = "";
  const props = buildRemotionProps();
  updateRemotionFormatNote(props.format);
  try {
    remotionHandle = window.Mount3CRemotionPlayer(els.remotionPlayerHost, props);
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    els.remotionPlayerHost.innerHTML = `<div class="remotion-loading">预览渲染出错：${e.message || e}</div>`;
  }
}

function closeRemotionPreview() {
  if (!els.remotionModal || els.remotionModal.hasAttribute("hidden")) return;
  els.remotionModal.setAttribute("hidden", "");
  document.body.classList.remove("remotion-open");
  if (remotionHandle) {
    try { remotionHandle.unmount(); } catch (e) { /* noop */ }
    remotionHandle = null;
  }
  els.remotionPlayerHost.innerHTML =
    '<div class="remotion-loading" id="remotionLoading">正在加载预览引擎…</div>';
}

// 编辑分镜后，若预览弹层开着则防抖刷新（改文案/时长/排序即时反映）
function refreshRemotionPreviewIfOpen() {
  if (!remotionHandle || !els.remotionModal || els.remotionModal.hasAttribute("hidden")) return;
  clearTimeout(remotionRefreshTimer);
  remotionRefreshTimer = setTimeout(() => {
    if (!remotionHandle) return;
    const props = buildRemotionProps();
    updateRemotionFormatNote(props.format);
    remotionHandle.update(props);
  }, 400);
}

/* ---- 多端裁剪：封面 + 小红书图文版（抽静帧 + 文案，不出视频）---- */

function setPosterBtn(label, busy) {
  const btn = els.exportPosterBtn;
  if (!btn) return;
  const span = btn.querySelector("span");
  if (span) span.textContent = label;
  btn.disabled = Boolean(busy);
  btn.classList.toggle("is-busy", Boolean(busy));
}

async function exportPoster() {
  const data = currentTimeline();
  if (!data.timeline || !data.timeline.length) {
    setCueHint("还没有分镜，先生成脚本。");
    return;
  }
  const apiBase = getApiBase();
  if (!apiBase && location.protocol === "file:") {
    setCueHint("图文导出需要部署后端（本地 file:// 无法调用渲染服务）。");
    return;
  }
  setPosterBtn("生成中…", true);
  setCueHint("正在抽帧出封面 + 小红书配图，并生成图文文案，请稍候…");

  const body = { timeline: data, format: "1:1" };
  if (els.autoStockToggle && els.autoStockToggle.checked) body.autoStock = true;

  try {
    const response = await fetch(`${apiBase}/api/poster`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      setCueHint(payload.error || "图文导出失败");
      return;
    }
    showPosterResult(payload);
    setCueHint(
      `图文导出完成 ✓ 共 ${payload.images.length} 张图（${payload.format}）+ 小红书文案，下方可下载/复制。` +
        (payload.hosted ? "" : "（未配 R2，图为内联，可右键另存）")
    );
  } catch (error) {
    setCueHint(`图文导出出错：${error.message || error}`);
  } finally {
    setPosterBtn("图文/封面", false);
  }
}

function posterImgSrc(img) {
  return img && (img.url || img.dataUrl) ? img.url || img.dataUrl : "";
}

function showPosterResult(payload) {
  let host = document.querySelector("#posterPreview");
  if (!host) {
    host = document.createElement("div");
    host.id = "posterPreview";
    host.className = "poster-preview";
    const anchor = els.jsonOutput && els.jsonOutput.closest("section");
    (anchor || document.body).insertBefore(host, anchor || null);
  }
  host.innerHTML = "";

  const title = document.createElement("p");
  title.className = "render-preview-title";
  title.textContent = `图文/封面（${payload.format}）`;
  host.appendChild(title);

  // 配图网格：第一张即封面，每张可下载
  const grid = document.createElement("div");
  grid.className = "poster-grid";
  (payload.images || []).forEach((img, i) => {
    const src = posterImgSrc(img);
    if (!src) return;
    const cell = document.createElement("div");
    cell.className = "poster-cell";
    const a = document.createElement("a");
    a.href = src;
    a.download = `${safeName()}-${i === 0 ? "cover" : "p" + i}.png`;
    a.target = "_blank";
    a.rel = "noopener";
    const im = document.createElement("img");
    im.src = src;
    im.loading = "lazy";
    a.appendChild(im);
    cell.appendChild(a);
    const tag = document.createElement("span");
    tag.className = "poster-cell-tag";
    tag.textContent = i === 0 ? "封面" : `图${i + 1}`;
    cell.appendChild(tag);
    grid.appendChild(cell);
  });
  host.appendChild(grid);

  // 小红书文案：可编辑文本框 + 复制
  const cap = payload.caption || {};
  const capBox = document.createElement("textarea");
  capBox.className = "poster-caption";
  capBox.rows = 8;
  capBox.value = cap.text || [cap.title, cap.body, (cap.tags || []).join(" ")].filter(Boolean).join("\n\n");
  host.appendChild(capBox);

  const bar = document.createElement("div");
  bar.className = "render-share";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "icon-button";
  copy.textContent = "复制小红书文案";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(capBox.value);
      copy.textContent = "已复制 ✓";
      setTimeout(() => (copy.textContent = "复制小红书文案"), 1600);
    } catch (e) {
      capBox.select();
    }
  });
  bar.appendChild(copy);
  const note = document.createElement("span");
  note.className = "render-share-note";
  note.textContent = "图右键/点击另存，文案可改后再复制";
  bar.appendChild(note);
  host.appendChild(bar);

  host.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ---- 素材库：搜免费可商用空镜（Pexels/Pixabay）---- */
function setStockTip(text) {
  if (els.stockTip) els.stockTip.textContent = text;
}

/* ---- 横评对比：解析简易 DSL → 插入对比矩阵镜 ---- */

// 解析一行 "维度(单位, 高/低): 值1, 值2, 值3"。返回 {label, unit, better, values}。
function parseCompareRow(line) {
  const m = /^(.+?)(?:[（(]([^)）]*)[)）])?\s*[:：]\s*(.+)$/.exec(line);
  if (!m) return null;
  const label = m[1].trim();
  const meta = (m[2] || "").split(/[,，]/).map((x) => x.trim()).filter(Boolean);
  const values = m[3].split(/[,，]/).map((x) => x.trim()).filter(Boolean);
  if (!label || values.length === 0) return null;
  let unit = "";
  let better = "high";
  meta.forEach((tok) => {
    if (/低|越小|越少|smaller|lower/i.test(tok)) better = "low";
    else if (/高|越大|越多|bigger|higher/i.test(tok)) better = "high";
    else if (!unit) unit = tok;
  });
  return { label, unit, better, values };
}

// 解析整段对比 DSL → { products, rows }。
function parseCompareSpec(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let products = [];
  const rows = [];
  lines.forEach((line) => {
    if (/^产品[\s]*[:：]/.test(line)) {
      products = line.replace(/^产品[\s]*[:：]/, "").split(/[,，]/).map((x) => x.trim()).filter(Boolean);
      return;
    }
    const row = parseCompareRow(line);
    if (row) rows.push(row);
  });
  // 没写「产品:」行时，用列数兜底命名
  if (products.length === 0 && rows.length) {
    products = rows[0].values.map((_, i) => `产品${i + 1}`);
  }
  // 对齐每行列数到 products 数量
  rows.forEach((r) => {
    r.values = r.values.slice(0, products.length);
    while (r.values.length < products.length) r.values.push("—");
  });
  return { products, rows: rows.filter((r) => r.values.length === products.length) };
}

function setCompareTip(text) {
  if (els.compareTip) els.compareTip.textContent = text;
}

function insertCompareScene() {
  if (!initialState.timeline || !Array.isArray(initialState.timeline.timeline) || !initialState.timeline.timeline.length) {
    setCompareTip("请先生成分镜脚本，再插入对比镜。");
    return;
  }
  const spec = parseCompareSpec(els.compareSpec ? els.compareSpec.value : "");
  if (spec.products.length < 2) {
    setCompareTip("至少要 2 个产品。第一行写「产品: A, B, C」，下面每行一个维度。");
    return;
  }
  if (spec.rows.length === 0) {
    setCompareTip("没解析到对比维度。每行格式：维度(单位, 高/低): 值1, 值2…");
    return;
  }
  const names = spec.products.join(" / ");
  const t = initialState.timeline.timeline;
  const at = initialState.currentScene + 1;
  const scene = {
    id: "",
    index: 0,
    title: "横评对比",
    start: 0,
    end: 0,
    duration: Math.max(8, 4 + spec.rows.length * 1.6),
    voiceover: `${names}，这几款到底选谁？直接上参数对比，逐项见分晓。`,
    subtitle: `${spec.products.length} 款横评 · 逐项对比`,
    visual: {
      type: "横评对比",
      layout: initialState.layout,
      headline: "这几款选谁？",
      detail: names,
      asset: "",
      compare: { products: spec.products, rows: spec.rows }
    },
    checks: ["参数以实测/官方为准", "对比项需可溯源"],
    source: "横评对比矩阵"
  };
  t.splice(at, 0, scene);
  recalcTimeline();
  initialState.currentScene = at;
  renderAll(false);
  setCompareTip(`已插入对比镜（${spec.products.length} 款 × ${spec.rows.length} 项）。可在导演台继续编辑口播/字幕。`);
}

async function searchStock() {
  const query = (els.stockQuery && els.stockQuery.value.trim()) || "";
  if (!query) {
    setStockTip("先输入搜索关键词（建议用英文，如 smartphone、headphone）。");
    return;
  }
  const apiBase = getApiBase();
  if (!apiBase && location.protocol === "file:") {
    setStockTip("素材搜索需要部署后端（本地 file:// 无法调用）。");
    return;
  }
  if (els.stockGrid) els.stockGrid.innerHTML = "";
  setStockTip("搜索中…");
  try {
    const url = `${apiBase}/api/stock?query=${encodeURIComponent(query)}&type=photo&orientation=portrait&perPage=15`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStockTip(data.error || "素材搜索失败，请稍后再试。");
      return;
    }
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      setStockTip(`「${query}」没搜到素材，换个关键词试试（英文命中率更高）。`);
      return;
    }
    renderStockGrid(items);
    setStockTip(`找到 ${items.length} 条（来源：${(data.providers || []).join(" / ") || "—"}）。点缩略图看出处；勾选下方「自动空镜」让渲染缺图时自动用。`);
  } catch (error) {
    setStockTip(`素材搜索失败：${error.message || error}`);
  }
}

function renderStockGrid(items) {
  if (!els.stockGrid) return;
  els.stockGrid.innerHTML = "";
  items.forEach((it) => {
    if (!it.thumb) return;
    const fig = document.createElement("a");
    fig.className = "stock-cell";
    fig.href = it.sourceUrl || it.url || "#";
    fig.target = "_blank";
    fig.rel = "noopener noreferrer";
    fig.title = `${it.provider} · ${it.author || ""}`.trim();
    const img = document.createElement("img");
    img.src = it.thumb;
    img.alt = it.alt || "";
    img.loading = "lazy";
    const tag = document.createElement("span");
    tag.className = "stock-cell-tag";
    tag.textContent = it.provider;
    fig.appendChild(img);
    fig.appendChild(tag);
    els.stockGrid.appendChild(fig);
  });
}

/* ---- 留人体检：纯前端启发式给脚本打"留人分" + 逐镜诊断 ---- */
const HOOK_WORDS = ["别急", "先别", "别划", "别走", "居然", "竟然", "没想到", "真相", "千万", "避坑", "踩坑", "后悔", "为什么", "凭什么", "到底", "一个字", "反常识", "真的假的", "谁懂", "震惊", "离谱", "劝你", "原来", "结果", "都说", "你以为"];
const LOOP_WORDS = ["往下看", "接着看", "别走", "别划", "关键", "重点", "到底", "一旦", "你猜", "接下来", "敲黑板", "注意看", "马上", "下一个", "继续看", "看完", "后面", "更"];
const CTA_WORDS = ["关注", "点赞", "评论", "收藏", "转发", "三连", "下一个", "留言", "扣", "抽", "主页", "蹲", "催更"];
const CONCLUSION_WORDS = ["结论", "建议", "值得", "入手", "推荐", "别买", "再等", "闭眼", "观望", "总结", "适合"];

function hasWord(text, words) {
  const t = String(text || "");
  return words.some((w) => t.includes(w));
}
function firstSentence(text) {
  return String(text || "").split(/[。！？!?，,；;]/).map((s) => s.trim()).filter(Boolean)[0] || "";
}
function charCount(text) {
  return String(text || "").replace(/\s/g, "").length;
}
function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function gradeOf(score) {
  if (score >= 85) return { label: "优秀", tone: "good" };
  if (score >= 70) return { label: "良好", tone: "ok" };
  if (score >= 55) return { label: "及格", tone: "warn" };
  return { label: "待优化", tone: "bad" };
}
// 镜头结尾是否留了承接钩子：开放回路词、强钩子词或疑问句都算
function sceneHasContinuation(text) {
  return hasWord(text, LOOP_WORDS) || hasWord(text, HOOK_WORDS) || /[？?]/.test(String(text || ""));
}

function scoreRetention(data) {
  const tl = (data && Array.isArray(data.timeline) ? data.timeline : []) || [];
  const total = tl.length;
  const target = (data.project && data.project.targetDuration) || tl.reduce((s, x) => s + (Number(x.duration) || 0), 0) || 90;

  const scenes = tl.map((scene, i) => {
    const isFirst = i === 0;
    const isLast = i === total - 1;
    const dur = Number(scene.duration) || (scene.end - scene.start) || 0;
    const chars = charCount(scene.voiceover);
    const rate = dur > 0 ? chars / dur : 0;
    const issues = [];
    if (isFirst) {
      if (dur > 6) issues.push(`开场 ${Math.round(dur)}s 偏长，钩子镜建议压到 3-6s`);
      if (!hasWord(scene.voiceover, HOOK_WORDS)) issues.push("开场缺少强钩子词（反常识/痛点/疑问），容易被划走");
      if (charCount(firstSentence(scene.voiceover)) > 24) issues.push("第一句太长，5 秒内抓不住人，建议拆成短句");
    }
    if (!isLast && total > 1) {
      if (!sceneHasContinuation(scene.voiceover)) {
        issues.push("结尾没有承接钩子/悬念，观众可能划走");
      }
    }
    if (!isFirst && dur > 28) issues.push(`时长 ${Math.round(dur)}s 偏长，注意力易流失，建议拆分或压缩`);
    if (rate > 7) issues.push(`文案偏多（约 ${rate.toFixed(1)} 字/秒），可能念不完，建议精简`);
    else if (dur >= 6 && rate > 0 && rate < 2.8) issues.push(`文案偏少（约 ${rate.toFixed(1)} 字/秒），画面会空，建议补充或缩短时长`);
    if (isLast) {
      if (!hasWord(scene.voiceover, CTA_WORDS)) issues.push("结尾缺少互动引导（关注/点赞/评论）");
      if (!hasWord(scene.voiceover, CONCLUSION_WORDS)) issues.push("结尾没有给出明确购买结论/建议");
    }
    const score = clampScore(100 - issues.length * 22);
    return { index: scene.index || i + 1, title: scene.title, score, issues, isWeak: score < 70, ref: scene, pos: i };
  });

  // 维度分
  const first = tl[0];
  let hook = 60;
  if (first) {
    const d = Number(first.duration) || 0;
    hook += d <= 6 ? 20 : d <= 8 ? 10 : 0;
    hook += hasWord(first.voiceover, HOOK_WORDS) ? 20 : 0;
    if (charCount(firstSentence(first.voiceover)) > 24) hook -= 10;
  }
  hook = clampScore(hook);

  const midScenes = tl.slice(0, Math.max(0, total - 1));
  const loopHit = midScenes.filter((s) => sceneHasContinuation(s.voiceover)).length;
  const curve = midScenes.length ? clampScore((loopHit / midScenes.length) * 100) : 100;

  const durs = tl.map((s) => Number(s.duration) || (s.end - s.start) || 0);
  let pacing = 100;
  const longCount = tl.filter((s, i) => i > 0 && (Number(s.duration) || 0) > 28).length;
  pacing -= longCount * 18;
  const positive = durs.filter((x) => x > 0);
  const maxD = positive.length ? Math.max(...positive) : 0;
  const minD = positive.length ? Math.min(...positive) : 0;
  const tooFlat = durs.length > 2 && minD > 0 && maxD / minD < 1.4;
  if (tooFlat) pacing -= 20;
  pacing = clampScore(pacing);

  const last = tl[total - 1];
  let ending = 40;
  if (last) {
    ending += hasWord(last.voiceover, CTA_WORDS) ? 35 : 0;
    ending += hasWord(last.voiceover, CONCLUSION_WORDS) ? 25 : 0;
  }
  ending = clampScore(ending);

  const rateBad = tl.filter((s) => {
    const d = Number(s.duration) || 0;
    const r = d > 0 ? charCount(s.voiceover) / d : 0;
    return r > 7 || (d >= 6 && r > 0 && r < 2.8);
  }).length;
  let length = total ? clampScore((1 - rateBad / total) * 100) : 100;
  const totalDur = durs.reduce((a, b) => a + b, 0);
  const offTarget = target && Math.abs(totalDur - target) / target > 0.15;
  if (offTarget) length = clampScore(length - 15);

  const dims = [
    { key: "hook", label: "开场 5 秒钩子", score: hook, weight: 0.3, note: hook >= 80 ? "开场强钩子，留人到位" : hook >= 60 ? "开场钩子一般，可更抓人" : "开场偏弱，前 5 秒易流失" },
    { key: "curve", label: "钩子连贯 · 不停留人", score: curve, weight: 0.25, note: `${loopHit}/${midScenes.length || 0} 个镜头结尾有承接钩子` },
    { key: "pacing", label: "节奏拉扯", score: pacing, weight: 0.2, note: longCount ? `${longCount} 个镜头偏长` : tooFlat ? "节奏太平，缺少长短拉扯" : "长短分布合理" },
    { key: "ending", label: "结尾结论 + 互动", score: ending, weight: 0.15, note: ending >= 80 ? "结论清晰且有互动引导" : "结尾可补结论或互动引导" },
    { key: "length", label: "语速 / 时长匹配", score: length, weight: 0.1, note: rateBad ? `${rateBad} 个镜头语速不合适` : offTarget ? "总时长偏离目标" : "语速与时长匹配" }
  ];
  const overall = clampScore(dims.reduce((s, d) => s + d.score * d.weight, 0));
  return { overall, grade: gradeOf(overall), dims, scenes };
}

function toneColor(tone) {
  return tone === "good" ? "var(--teal)" : tone === "ok" ? "var(--blue)" : tone === "warn" ? "var(--amber)" : "var(--red)";
}
function scoreTone(score) {
  return score >= 85 ? "good" : score >= 70 ? "ok" : score >= 55 ? "warn" : "bad";
}

function closeCheckup() {
  window.dispatchEvent(new CustomEvent("director:close-checkup"));
}

function openCheckup() {
  closeCheckup();
  const data = currentTimeline();
  const report = scoreRetention(data);
  window.dispatchEvent(new CustomEvent("director:open-checkup", { detail: { report } }));
}

/* ---- 防垃圾质检闸门：留人分 + 事实溯源 + 反洗稿相似度 ---- */

// 阈值（可按需要调）：留人分 < 60 视为不达标；其余 0 容忍。
const GATE_RETENTION_MIN = 60;
// 反洗稿：与原文连续重合 ≥ 这么多字，判「疑似照搬」。
const PLAGIARISM_RUN = 12;
// 事实溯源用的「数字+单位」单位表（与渲染端 highlightNumbers 对齐）。
const FACT_UNITS = "%|‰|小时|分钟|天|年|倍|档|元|块|克|千克|公斤|kg|g|mm|cm|英寸|寸|mAh|W|GB|TB|MP|Hz|fps|nit|尼特|核|nm|万|亿|分";
const FACT_TOKEN_RE = new RegExp(`\\d+(?:\\.\\d+)?\\s*(?:${FACT_UNITS})`, "g");

// 归一化：去空白与标点，便于做连续重合比对。
function normForMatch(text) {
  return String(text || "").replace(/[\s\p{P}\p{S}]/gu, "");
}

// 最长连续公共子串长度 + 命中片段（用于反洗稿）。a 短、b 长（原文）。
function longestCommonRun(a, b) {
  if (!a || !b) return { len: 0, text: "" };
  const n = a.length;
  const m = b.length;
  let prev = new Uint32Array(m + 1);
  let best = 0;
  let bestEnd = 0;
  for (let i = 1; i <= n; i++) {
    const cur = new Uint32Array(m + 1);
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      if (ai === b.charCodeAt(j - 1)) {
        const v = prev[j - 1] + 1;
        cur[j] = v;
        if (v > best) {
          best = v;
          bestEnd = i;
        }
      }
    }
    prev = cur;
  }
  return { len: best, text: a.slice(bestEnd - best, bestEnd) };
}

function gateStatus(ok, warn) {
  return ok ? "pass" : warn ? "warn" : "fail";
}

function qualityGate(data) {
  const tl = Array.isArray(data && data.timeline) ? data.timeline : [];

  // 1) 留人分（复用留人体检）
  const retention = scoreRetention(data);
  const retentionOk = retention.overall >= GATE_RETENTION_MIN;

  // 2) 事实溯源：脚本里的「数字+单位」参数能否在输入素材里找到
  const corpus = normForMatch(
    `${(els.factsInput && els.factsInput.value) || ""} ${(els.reviewInput && els.reviewInput.value) || ""}`,
  );
  const hasCorpus = corpus.length > 8;
  const unsourced = [];
  let factCount = 0;
  tl.forEach((scene, i) => {
    const text = `${scene.voiceover || ""} ${scene.subtitle || ""} ${(scene.visual && scene.visual.detail) || ""}`;
    const seen = new Set();
    (text.match(FACT_TOKEN_RE) || []).forEach((tok) => {
      const key = tok.replace(/\s+/g, "");
      if (seen.has(key)) return;
      seen.add(key);
      factCount += 1;
      const numStr = (key.match(/\d+(?:\.\d+)?/) || [""])[0];
      if (hasCorpus && numStr && !corpus.includes(numStr)) {
        unsourced.push({ index: scene.index || i + 1, title: scene.title || "", token: key, pos: i });
      }
    });
  });
  const sourcingOk = unsourced.length === 0;

  // 3) 反洗稿：口播稿与原文的最长连续重合
  const review = normForMatch((els.reviewInput && els.reviewInput.value) || "").slice(0, 6000);
  const hasReview = review.length >= PLAGIARISM_RUN;
  const flagged = [];
  if (hasReview) {
    tl.forEach((scene, i) => {
      const vo = normForMatch(scene.voiceover || "");
      if (vo.length < PLAGIARISM_RUN) return;
      const run = longestCommonRun(vo, review);
      if (run.len >= PLAGIARISM_RUN) {
        flagged.push({ index: scene.index || i + 1, title: scene.title || "", len: run.len, snippet: run.text, pos: i });
      }
    });
  }
  const plagiarismOk = flagged.length === 0;

  const checks = [
    {
      key: "retention",
      label: "留人体检",
      status: gateStatus(retentionOk, false),
      score: retention.overall,
      summary: retentionOk
        ? `留人分 ${retention.overall}（${retention.grade.label}），达标`
        : `留人分 ${retention.overall}（${retention.grade.label}），低于 ${GATE_RETENTION_MIN} 分，先优化钩子/节奏/结尾`,
      detail: retention.dims.filter((d) => d.score < 70).map((d) => `${d.label}：${d.note}`),
    },
    {
      key: "sourcing",
      label: "事实溯源",
      status: !hasCorpus ? "warn" : gateStatus(sourcingOk, false),
      summary: !hasCorpus
        ? "没填「真实参数/评测素材」，无法核查参数来源（建议补上以便溯源）"
        : sourcingOk
          ? `脚本里 ${factCount} 处参数都能在素材里找到来源`
          : `${unsourced.length} 处参数在输入素材里查不到，疑似编造，请核对`,
      detail: unsourced.map((u) => `镜 ${u.index}「${u.title}」：${u.token} 在素材中无出处`),
    },
    {
      key: "plagiarism",
      label: "原创度（反洗稿）",
      status: !hasReview ? "warn" : gateStatus(plagiarismOk, false),
      summary: !hasReview
        ? "没填「评测素材原文」，跳过反洗稿比对"
        : plagiarismOk
          ? "口播稿与原文无长段照搬，原创度 OK"
          : `${flagged.length} 镜与原文有 ≥${PLAGIARISM_RUN} 字连续重合，疑似洗稿，请改写`,
      detail: flagged.map((f) => `镜 ${f.index}「${f.title}」：连续 ${f.len} 字「${f.snippet}」`),
    },
  ];

  // 只有「硬性维度」（不含 warn 的 skip 情况）失败才拦截；warn 不拦。
  const pass = retentionOk && sourcingOk && plagiarismOk;
  return { pass, checks, retention, unsourced, flagged };
}

function closeGate() {
  window.dispatchEvent(new CustomEvent("director:close-gate"));
}

// onProceed 传入时（来自渲染流程）显示「仍要渲染」放行按钮；不传则是纯查看。
function openGate(report, onProceed) {
  closeGate();
  window.dispatchEvent(
    new CustomEvent("director:open-gate", { detail: { report, onProceed } })
  );
}

function openGateStandalone() {
  const data = currentTimeline();
  if (!data.timeline || !data.timeline.length) {
    setCueHint("还没有分镜可质检，先生成脚本。");
    return;
  }
  openGate(qualityGate(data), null);
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
  if (draft.ttsVoice && els.ttsVoice && (draft.ttsVoice !== "clone" || initialState.cloneSpkId)) {
    els.ttsVoice.value = draft.ttsVoice;
  }
  if (draft.layout) initialState.layout = draft.layout;
  els.factsInput.value = draft.facts || "";
  els.reviewInput.value = draft.reviews || "";
  if (els.zhihuQuery) els.zhihuQuery.value = draft.zhihuQuery || "";
  initialState.timeline = draft.timeline;
  initialState.currentScene = draft.currentScene || 0;
  initialState.generated = true;
  lastGeneratedProduct = draft.productName || els.productName.value.trim() || "";
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
  lastGeneratedProduct = "";
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
  const taoToggle = document.querySelector("#taoAnimationToggle");
  if (taoToggle) {
    if (localStorage.getItem("skipTaoAnimation") === "true") {
      taoToggle.checked = false;
    }
    taoToggle.addEventListener("change", () => {
      localStorage.setItem("skipTaoAnimation", taoToggle.checked ? "false" : "true");
    });
  }

  els.oneClickBtn.addEventListener("click", oneClickGenerate);
  els.regenerateBtn.addEventListener("click", generateTimelineFromApi);
  els.addSceneBtn.addEventListener("click", addScene);
  if (els.checkupBtn) els.checkupBtn.addEventListener("click", openCheckup);
  if (els.gateBtn) els.gateBtn.addEventListener("click", openGateStandalone);
  els.advToggle.addEventListener("click", toggleAdvanced);
  if (els.resetBtn) els.resetBtn.addEventListener("click", resetAll);
  if (els.zhihuSearchBtn) els.zhihuSearchBtn.addEventListener("click", () => searchZhihu());

  if (els.enrollVoiceBtn) els.enrollVoiceBtn.addEventListener("click", enrollVoice);
  if (els.voiceSampleInput) {
    els.voiceSampleInput.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (els.voiceSampleName) {
        els.voiceSampleName.textContent = file
          ? file.name
          : "选择一段 5–10 秒、安静清晰的录音（wav/mp3/m4a）";
      }
    });
  }

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
      refreshRemotionPreviewIfOpen();
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

  if (els.renderVideoBtn) els.renderVideoBtn.addEventListener("click", renderVideo);
  if (els.remotionPreviewBtn) els.remotionPreviewBtn.addEventListener("click", openRemotionPreview);
  if (els.remotionCloseBtn) els.remotionCloseBtn.addEventListener("click", closeRemotionPreview);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.remotionModal && !els.remotionModal.hasAttribute("hidden")) {
      closeRemotionPreview();
    }
  });
  // 切换输出画幅时，预览开着就同步刷新
  if (els.renderFormat) els.renderFormat.addEventListener("change", refreshRemotionPreviewIfOpen);
  if (els.exportPosterBtn) els.exportPosterBtn.addEventListener("click", exportPoster);
  if (els.stockSearchBtn) els.stockSearchBtn.addEventListener("click", searchStock);
  if (els.compareInsertBtn) els.compareInsertBtn.addEventListener("click", insertCompareScene);
  if (els.stockQuery)
    els.stockQuery.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchStock();
      }
    });

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

/** @param {boolean} [skipDraft] */
export function bootDirector(skipDraft = false) {
  bindEvents();
  renderAssets();
  restoreCloneState();
  const restoredDraft = skipDraft ? false : loadDraft();
  renderAll(!restoredDraft);
  if (restoredDraft) {
    setCueHint("已恢复上次草稿 ✓ 继续编辑，或点「重置」重新开始。");
  }
  if (typeof window !== "undefined" && window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/* ---- Preact 桥接 API（Phase C：EditorPanel 驱动时间线编辑） ---- */

/**
 * @typedef {ReturnType<typeof createDirectorApi>} DirectorApi
 */
function createDirectorApi() {
  const sceneAt = (index) => initialState.timeline?.timeline?.[index];

  return {
    getState() {
      return {
        timeline: initialState.timeline,
        currentScene: initialState.currentScene,
        assets: initialState.assets,
        generated: initialState.generated,
        layout: initialState.layout
      };
    },

    selectScene(index) {
      const t = initialState.timeline?.timeline || [];
      if (!t.length) return;
      initialState.currentScene = Math.max(0, Math.min(index, t.length - 1));
      renderAll(false);
    },

    /** @param {number} index @param {{ title?: string; duration?: number; voiceover?: string; subtitle?: string; visual?: object; metric?: object|null; dataviz?: object|null }} patch */
    patchScene(index, patch) {
      const scene = sceneAt(index);
      if (!scene) return;
      if (patch.title !== undefined) scene.title = patch.title;
      if (patch.voiceover !== undefined) {
        scene.voiceover = patch.voiceover;
        scene.subtitle = patch.subtitle || patch.voiceover;
      } else if (patch.subtitle !== undefined) {
        scene.subtitle = patch.subtitle || scene.voiceover;
      }
      if (patch.visual) {
        scene.visual = { ...scene.visual, ...patch.visual };
      }
      if (patch.metric !== undefined) {
        if (patch.metric) scene.visual.metric = patch.metric;
        else delete scene.visual.metric;
      }
      if (patch.dataviz !== undefined) {
        if (patch.dataviz) scene.visual.dataviz = patch.dataviz;
        else delete scene.visual.dataviz;
      }
      if (patch.duration !== undefined) {
        scene.duration = Math.max(2, Number(patch.duration) || scene.duration);
        recalcTimeline();
      }
      renderAll(false);
    },

    async rewriteScene(index) {
      const scene = sceneAt(index);
      if (!scene) return;
      try {
        await rewriteCurrentScene(scene);
        renderAll(false);
      } catch (error) {
        setCueHint(`重写失败：${error.message}`);
      }
    },

    async listenScene(index) {
      const scene = sceneAt(index);
      if (!scene) return;
      try {
        const src = await synthesizeVoiceover(scene.voiceover, getSelectedVoice());
        if (ttsAudio) ttsAudio.pause();
        ttsAudio = new Audio(src);
        await ttsAudio.play();
      } catch (error) {
        setCueHint(`试听失败：${error.message}`);
      }
    },

    removeScene(index) {
      deleteScene(index);
    },

    moveScene(from, to) {
      moveScene(from, to);
    },

    addScene() {
      addScene();
    },

    applyAgnesBroll(index, { assetName, videoUrl, broll }) {
      const scene = sceneAt(index);
      if (!scene) return;
      const name = assetName || `agnes_${Date.now()}`;
      let asset = initialState.assets.find((a) => a.name === name);
      if (asset) {
        asset.url = videoUrl;
        asset.type = "video/mp4";
      } else {
        initialState.assets.push({ name, url: videoUrl, type: "video/mp4" });
      }
      scene.visual = {
        ...scene.visual,
        asset: name,
        broll: { ...broll }
      };
      renderAll(false);
    }
  };
}

export const directorApi = createDirectorApi();
