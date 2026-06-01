const initialState = {
  layout: "center",
  currentScene: 0,
  assets: [],
  timeline: []
};

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
  analyzeBtn: document.querySelector("#analyzeBtn"),
  generateBtn: document.querySelector("#generateBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  copyPromptBtn: document.querySelector("#copyPromptBtn"),
  downloadJsonBtn: document.querySelector("#downloadJsonBtn"),
  downloadBriefBtn: document.querySelector("#downloadBriefBtn"),
  scriptList: document.querySelector("#scriptList"),
  timelineList: document.querySelector("#timelineList"),
  timelineRuler: document.querySelector("#timelineRuler"),
  jsonOutput: document.querySelector("#jsonOutput"),
  moduleList: document.querySelector("#moduleList"),
  apiStatus: document.querySelector("#apiStatus"),
  apiBase: document.querySelector("#apiBase"),
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
      title: "开场结论",
      visualType: "真人口播 + 产品图",
      headline: `${product}先看结论`,
      detail: "把最大优点和最大限制先讲清楚",
      voiceover: `${product}我不建议只看参数。它真正要解决的问题，是${insights.comfort || "日常使用的舒适度"}。如果你想找一副${category}日常通勤用，这个方向值得看，但它也不是所有人都适合。`,
      source: "LLM 原创结构"
    },
    {
      title: "真实反馈",
      visualType: "知乎观点摘要",
      headline: "高频好评集中在体验",
      detail: insights.comfort || "佩戴和通勤体验是主要关注点",
      voiceover: `从真实评测里能看到，用户夸得最多的不是玄学音质，而是${insights.comfort || "长时间使用更轻松"}。这类反馈对数码产品很关键，因为它决定你会不会每天都愿意用。`,
      source: "Pixelle 内容提炼"
    },
    {
      title: "场景验证",
      visualType: "使用场景卡",
      headline: "适合谁",
      detail: insights.audience || "通勤、办公、轻运动用户",
      voiceover: `它更适合${insights.audience || "通勤和办公场景"}。如果你的需求是边走边听、开会间隙戴着、不想耳道被堵住，那它的价值会比纸面参数更明显。`,
      source: "3C Prompt 约束"
    },
    {
      title: "短板说明",
      visualType: "优缺点对照",
      headline: "限制要提前说",
      detail: insights.weakness || "低频和隔音不是主场",
      voiceover: `但短板也很清楚，${insights.weakness || "它不适合追求强隔音和重低频的人"}。如果你经常在地铁、马路边使用，环境噪音会直接影响体验，这点不能被营销话术盖过去。`,
      source: "事实检查"
    },
    {
      title: "稳定性判断",
      visualType: "参数/反馈卡",
      headline: "稳定性是加分项",
      detail: insights.stability || "轻运动不容易掉，剧烈运动仍需谨慎",
      voiceover: `${insights.stability || "稳定性评价整体偏正面"}。所以它不是专业运动耳机，但日常走路、办公室移动、轻量运动场景，大概率能给到一个比较省心的体验。`,
      source: "评测归纳"
    },
    {
      title: "购买建议",
      visualType: "结论卡",
      headline: "买不买看场景",
      detail: "舒适优先可以买，音质/隔音优先慎选",
      voiceover: `最后我的建议很简单：如果你要的是舒服、稳定、日常高频使用，它值得加入候选；如果你要的是强降噪、重低频、沉浸听歌，同价位入耳式可能更合适。`,
      source: "原创结论"
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
  const rawDurations = scenes.map((scene) => estimateDuration(scene.voiceover));
  const totalRaw = rawDurations.reduce((sum, item) => sum + item, 0);
  let cursor = 0;

  const timeline = scenes.map((scene, index) => {
    const duration = Math.max(5, (rawDurations[index] / totalRaw) * target);
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

async function generateTimelineFromApi() {
  const apiBase = getApiBase();

  if (!apiBase && location.protocol === "file:") {
    initialState.timeline = buildTimeline();
    initialState.currentScene = 0;
    setApiStatus("本地模拟");
    renderAll(false);
    return;
  }

  setApiStatus("生成中");
  [els.analyzeBtn, els.generateBtn].forEach((button) => {
    button.disabled = true;
  });

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
    setApiStatus(apiBase ? "Codespaces 后端" : "Cloudflare API");
    renderAll(false);
  } catch (error) {
    console.warn(error);
    initialState.timeline = buildTimeline();
    initialState.currentScene = 0;
    setApiStatus("本地兜底");
    renderAll(false);
  } finally {
    [els.analyzeBtn, els.generateBtn].forEach((button) => {
      button.disabled = false;
    });
  }
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

async function searchZhihu() {
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
      renderAll(true);
    }
    setApiStatus(items.length ? `知乎素材已载入 ${items.length} 条` : "知乎无结果");
  } catch (error) {
    console.warn(error);
    setApiStatus("知乎搜索失败");
    if (els.zhihuResults) {
      els.zhihuResults.innerHTML = `<div class="zhihu-hint">${escapeHtml(error.message || "知乎搜索失败")}</div>`;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function productPrefix() {
  return els.productName.value.trim() || "这款产品";
}

function renderAssets() {
  els.assetStrip.innerHTML = "";
  if (!initialState.assets.length) {
    const empty = document.createElement("div");
    empty.className = "asset-thumb";
    empty.textContent = "暂无";
    els.assetStrip.appendChild(empty);
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

function renderModuleList() {
  els.moduleList.innerHTML = "";
  modules.forEach((module) => {
    const row = document.createElement("div");
    row.className = "module-row";
    row.innerHTML = `<strong>${module.name}</strong><span>${module.value}</span>`;
    els.moduleList.appendChild(row);
  });
}

function renderScript(timelineData) {
  const timeline = timelineData.timeline;
  els.scriptList.innerHTML = "";
  timeline.forEach((scene, index) => {
    const card = document.createElement("article");
    card.className = `scene-card ${index === initialState.currentScene ? "active" : ""}`;
    card.addEventListener("click", () => {
      initialState.currentScene = index;
      renderAll(false);
    });
    card.innerHTML = `
      <header>
        <h3>${scene.index}. ${scene.title}</h3>
        <span class="tagline">${scene.source}</span>
      </header>
      <p>${scene.voiceover}</p>
    `;
    els.scriptList.appendChild(card);
  });

  els.sceneCount.textContent = timeline.length;
  els.durationCount.textContent = `${Math.round(timelineData.project.targetDuration)}s`;
  els.sourceCount.textContent = timelineData.insights.sourceCount;
}

function renderTimeline(timelineData) {
  const timeline = timelineData.timeline;
  const total = timelineData.project.targetDuration;
  els.timelineRuler.innerHTML = "";
  for (let i = 0; i < 6; i += 1) {
    const tick = document.createElement("span");
    tick.textContent = `${Math.round((total / 5) * i)}s`;
    els.timelineRuler.appendChild(tick);
  }

  els.timelineList.innerHTML = "";
  timeline.forEach((scene) => {
    const row = document.createElement("div");
    row.className = "timeline-item";
    const width = Math.max(8, (scene.duration / total) * 100);
    row.innerHTML = `
      <div class="timeline-label">${scene.id}</div>
      <div class="timeline-track">
        <div class="timeline-bar" style="width:${width}%">${scene.visual.type}</div>
      </div>
      <div class="timeline-time">${scene.start.toFixed(1)}-${scene.end.toFixed(1)}s</div>
    `;
    els.timelineList.appendChild(row);
  });
}

function renderJson(timelineData) {
  const hyperframesPlan = {
    ...timelineData,
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

function renderPreview(timelineData) {
  const timeline = timelineData.timeline;
  const scene = timeline[initialState.currentScene] || timeline[0];
  if (!scene) return;

  els.stageProduct.textContent = timelineData.project.product || "3C 产品";
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
  return `00:${String(seconds).padStart(2, "0")}`;
}

function renderAll(rebuild = true) {
  if (rebuild || !initialState.timeline.length) {
    initialState.timeline = buildTimeline();
  }
  renderScript(initialState.timeline);
  renderTimeline(initialState.timeline);
  renderJson(initialState.timeline);
  renderPreview(initialState.timeline);
  renderModuleList();
  if (window.lucide) window.lucide.createIcons();
}

function setTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.remove("active");
  });
  document.querySelector(`#${name}Tab`).classList.add("active");
}

function setLayout(layout) {
  initialState.layout = layout;
  document.querySelectorAll(".segment").forEach((segment) => {
    segment.classList.toggle("active", segment.dataset.layout === layout);
  });
  renderAll(true);
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
  return `你是数码 3C 技术博主编导。请基于我提供的产品事实、产品实拍素材描述、知乎真实评测摘要，生成原创口播稿和 Timeline JSON。

硬性要求：
1. 不能照搬知乎原句，只能提炼观点、使用场景、优缺点和争议点。
2. 不得编造参数、价格、跑分、续航、降噪等级等事实。
3. 输出适合 ${els.platform.value} 的 ${els.targetDuration.value} 秒口播视频。
4. 每个分镜需要包含 start、end、voiceover、subtitle、visual.type、visual.layout、source。
5. 风格是技术博主口播：直接、克制、可信、有购买建议。

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

function bindEvents() {
  els.analyzeBtn.addEventListener("click", generateTimelineFromApi);
  els.generateBtn.addEventListener("click", generateTimelineFromApi);
  if (els.zhihuSearchBtn) els.zhihuSearchBtn.addEventListener("click", searchZhihu);
  els.resetBtn.addEventListener("click", () => {
    initialState.assets.forEach((asset) => URL.revokeObjectURL(asset.url));
    initialState.assets = [];
    initialState.currentScene = 0;
    els.assetInput.value = "";
    renderAssets();
    renderAll(true);
  });

  els.assetInput.addEventListener("change", (event) => {
    initialState.assets.forEach((asset) => URL.revokeObjectURL(asset.url));
    initialState.assets = [...event.target.files].map((file) => ({
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file)
    }));
    renderAssets();
    renderAll(true);
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => setLayout(button.dataset.layout));
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
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

  [els.productName, els.category, els.targetDuration, els.platform, els.factsInput, els.reviewInput].forEach((input) => {
    input.addEventListener("change", () => renderAll(true));
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
renderAll(true);
