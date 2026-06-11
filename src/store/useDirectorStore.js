import { create } from "zustand";
import { inferCategory } from "../core/category.js";
import { buildTimeline } from "../core/timeline-builder.js";
import { generateTimeline, getApiBase } from "../core/api-client.js";
import { API_BASE_KEY, DRAFT_KEY } from "../core/constants.js";

const DEFAULT_CATEGORIES = ["耳机", "手机", "平板", "笔记本", "显示器", "显卡", "智能穿戴"];

/** @returns {import('../core/timeline-builder.js').FormInput} */
function formFromState(state) {
  return {
    productName: state.productName,
    category: state.category,
    platform: state.platform,
    targetDuration: state.targetDuration,
    layout: state.layout,
    reviewText: state.reviewText,
    factsText: state.factsText,
    assets: state.assets
  };
}

export const useDirectorStore = create((set, get) => ({
  phase: "generate",
  productName: "",
  category: DEFAULT_CATEGORIES[0],
  targetDuration: 90,
  platform: "抖音 / 快手 9:16",
  layout: "center",
  factsText: "",
  reviewText: "",
  zhihuQuery: "",
  apiBase: "",
  apiStatus: "本地预览",
  cueHint: "输入产品名点「一键生成」：自动知乎搜索 → 抓取真实素材 → MiMo 生成分镜。",
  assets: [],
  timeline: null,
  currentScene: 0,
  generated: false,
  categoryTouched: false,
  busy: false,
  cloneSpkId: "",

  checkupOpen: false,
  checkupReport: null,
  gateOpen: false,
  gateReport: null,
  gateAllowProceed: false,

  openCheckup: (report) => set({ checkupOpen: true, checkupReport: report }),
  closeCheckup: () => set({ checkupOpen: false, checkupReport: null }),
  openGate: (report, allowProceed = false) =>
    set({ gateOpen: true, gateReport: report, gateAllowProceed: allowProceed }),
  closeGate: () => set({ gateOpen: false, gateReport: null, gateAllowProceed: false }),

  setPhase: (phase) => set({ phase }),
  setField: (key, value) => set({ [key]: value }),

  loadDraft: () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      set({
        productName: draft.productName || "",
        category: draft.category || DEFAULT_CATEGORIES[0],
        targetDuration: draft.targetDuration || 90,
        platform: draft.platform || "抖音 / 快手 9:16",
        layout: draft.layout || "center",
        factsText: draft.factsText || "",
        reviewText: draft.reviewText || "",
        apiBase: draft.apiBase || "",
        timeline: draft.timeline || null,
        currentScene: draft.currentScene || 0,
        generated: Boolean(draft.generated),
        categoryTouched: Boolean(draft.categoryTouched)
      });
      return true;
    } catch {
      return false;
    }
  },

  saveDraft: () => {
    const state = get();
    if (!state.generated && !state.productName) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          productName: state.productName,
          category: state.category,
          targetDuration: state.targetDuration,
          platform: state.platform,
          layout: state.layout,
          factsText: state.factsText,
          reviewText: state.reviewText,
          apiBase: state.apiBase,
          timeline: state.timeline,
          currentScene: state.currentScene,
          generated: state.generated,
          categoryTouched: state.categoryTouched
        })
      );
    } catch {
      /* ignore */
    }
  },

  resetAll: () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    set({
      productName: "",
      category: DEFAULT_CATEGORIES[0],
      factsText: "",
      reviewText: "",
      zhihuQuery: "",
      timeline: null,
      currentScene: 0,
      generated: false,
      categoryTouched: false,
      apiStatus: "本地预览",
      cueHint: "已重置。输入产品名点「一键生成」开始。"
    });
  },

  oneClickGenerate: async () => {
    const state = get();
    const product = state.productName.trim();
    if (!product) {
      set({ cueHint: "请先输入产品名，例如：华为Nova16" });
      return;
    }

    let category = state.category;
    if (!state.categoryTouched) {
      const inferred = inferCategory(product);
      if (inferred) category = inferred;
    }

    set({ busy: true, category });
    try {
      const apiBase = getApiBase(state.apiBase);
      const input = { ...formFromState({ ...state, category }), productName: product };
      const result = await generateTimeline(input, apiBase);
      set({
        timeline: result.data,
        currentScene: 0,
        generated: true,
        apiStatus: result.status === "local-sim" ? "本地模拟" : apiBase ? "Codespaces 后端" : "Cloudflare API",
        cueHint: "分镜已生成，可在「编导」区编辑时间线。",
        phase: "editor"
      });
      get().saveDraft();
    } catch (error) {
      console.warn(error);
      const input = formFromState({ ...state, category, productName: product });
      set({
        timeline: buildTimeline(input),
        currentScene: 0,
        generated: true,
        apiStatus: "本地兜底",
        cueHint: "后端不可用，已用本地模拟分镜。",
        phase: "editor"
      });
    } finally {
      set({ busy: false });
    }
  },

  initApiBase: () => {
    try {
      const stored = localStorage.getItem(API_BASE_KEY) || "";
      if (stored) set({ apiBase: stored, apiStatus: "后端已配置" });
    } catch {
      /* ignore */
    }
  },

  persistApiBase: (base) => {
    const trimmed = base.trim().replace(/\/$/, "");
    try {
      localStorage.setItem(API_BASE_KEY, trimmed);
    } catch {
      /* ignore */
    }
    set({ apiBase: trimmed, apiStatus: trimmed ? "后端已配置" : "本地预览" });
  }
}));
