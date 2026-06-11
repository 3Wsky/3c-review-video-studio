import { bootDirector, directorApi } from "./director.js";
import { initStoreBridge } from "./store-bridge.js";
import { initEditorBridge } from "../features/editor/editor-bridge.js";
import { initQualityBridge } from "../features/quality/quality-bridge.js";

let started = false;

/** 在 Preact 挂载 DOM 后启动 legacy 导演台逻辑（单次） */
export function bootDirectorApp() {
  if (started) return;
  started = true;
  requestAnimationFrame(() => {
    bootDirector(false);
    initStoreBridge();
    initEditorBridge(directorApi);
    initQualityBridge();
  });
}
