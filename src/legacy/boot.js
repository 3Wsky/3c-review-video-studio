import { bootDirector } from "./director.js";

let started = false;

/** 在 Preact 挂载 DOM 后启动 legacy 导演台逻辑（单次） */
export function bootDirectorApp() {
  if (started) return;
  started = true;
  requestAnimationFrame(() => bootDirector());
}
