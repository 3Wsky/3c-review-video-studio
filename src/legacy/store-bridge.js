import { useDirectorStore } from "../store/useDirectorStore.js";

const DOM_FIELDS = [
  ["productName", "#productName"],
  ["category", "#category"],
  ["targetDuration", "#targetDuration"],
  ["platform", "#platform"],
  ["factsText", "#factsInput"],
  ["apiBase", "#apiBase"]
];

/** 将 Zustand 状态写入 legacy DOM（director.js 仍读取这些节点） */
export function syncStoreToDom(state) {
  for (const [key, selector] of DOM_FIELDS) {
    const el = document.querySelector(selector);
    if (!el || state[key] === undefined) continue;
    const val = key === "targetDuration" ? String(state[key]) : state[key];
    if (el.value !== val) el.value = val;
  }

  document.querySelectorAll(".segment[data-layout]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.layout === state.layout);
  });

  const cueHint = document.querySelector("#cueHint");
  if (cueHint && state.cueHint) cueHint.textContent = state.cueHint;

  const apiStatus = document.querySelector("#apiStatus");
  if (apiStatus && state.apiStatus) apiStatus.textContent = state.apiStatus;

  const advPanel = document.querySelector("#advPanel");
  if (advPanel) {
    if (state.advancedOpen) advPanel.removeAttribute("hidden");
    else advPanel.setAttribute("hidden", "");
  }
}

/** 从 DOM 回写 Zustand（legacy 事件触发后保持 store 同步） */
function syncDomToStore() {
  const { setField } = useDirectorStore.getState();
  for (const [key, selector] of DOM_FIELDS) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const val = key === "targetDuration" ? Number(el.value) || 90 : el.value;
    setField(key, val);
  }
}

function observeLegacyHints() {
  const cueHint = document.querySelector("#cueHint");
  const apiStatus = document.querySelector("#apiStatus");
  if (!cueHint && !apiStatus) return;

  const observer = new MutationObserver(() => {
    const { setField } = useDirectorStore.getState();
    if (cueHint?.textContent) setField("cueHint", cueHint.textContent);
    if (apiStatus?.textContent) setField("apiStatus", apiStatus.textContent);
  });

  if (cueHint) observer.observe(cueHint, { childList: true, characterData: true, subtree: true });
  if (apiStatus) observer.observe(apiStatus, { childList: true, characterData: true, subtree: true });
}

/** Preact 挂载且 director 启动后调用，建立双向绑定（legacy 为初始数据源） */
export function initStoreBridge() {
  const store = useDirectorStore;
  store.getState().initApiBase();
  syncDomToStore();

  store.subscribe((state, prev) => {
    const keys = ["productName", "category", "targetDuration", "platform", "layout", "factsText", "apiBase", "cueHint", "apiStatus", "advancedOpen"];
    if (keys.some((k) => state[k] !== prev[k])) syncStoreToDom(state);
  });

  for (const [, selector] of DOM_FIELDS) {
    const el = document.querySelector(selector);
    if (!el) continue;
    el.addEventListener("change", syncDomToStore);
    el.addEventListener("input", syncDomToStore);
  }

  document.querySelectorAll(".segment[data-layout]").forEach((btn) => {
    btn.addEventListener("click", () => {
      useDirectorStore.getState().setField("layout", btn.dataset.layout);
    });
  });

  observeLegacyHints();

  const bodyObserver = new MutationObserver(() => {
    const busy = document.body.classList.contains("is-generating");
    useDirectorStore.getState().setField("busy", busy);
  });
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // 刷新后若 is-generating 残留，解除 Preact 侧 busy 锁
  if (document.body.classList.contains("is-generating")) {
    document.body.classList.remove("is-generating");
    useDirectorStore.getState().setField("busy", false);
  }
}

/** 触发 legacy 完整一键生成流程（含知乎搜索 + 道法动画） */
export function triggerLegacyGenerate() {
  syncStoreToDom(useDirectorStore.getState());
  document.getElementById("oneClickBtn")?.click();
}
