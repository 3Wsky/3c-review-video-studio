import { useDirectorStore } from "../../store/useDirectorStore.js";

/** @type {import('../../legacy/director.js').DirectorApi | null} */
let directorApi = null;

function syncFromDirector() {
  if (!directorApi) return;
  const { timeline, currentScene, assets, generated, layout } = directorApi.getState();
  useDirectorStore.setState({
    timeline: timeline?.timeline ? structuredClone(timeline) : null,
    currentScene,
    assets: assets.map((a) => ({ ...a })),
    generated,
    layout: layout || useDirectorStore.getState().layout
  });
}

/** legacy director 启动后调用：注册 API 并监听 renderAll 派发的更新事件 */
export function initEditorBridge(api) {
  directorApi = api;
  window.addEventListener("director:update", syncFromDirector);
  syncFromDirector();
}

export function selectScene(index) {
  directorApi?.selectScene(index);
}

export function patchScene(index, patch) {
  directorApi?.patchScene(index, patch);
}

export function rewriteScene(index) {
  return directorApi?.rewriteScene(index);
}

export function listenScene(index) {
  return directorApi?.listenScene(index);
}

export function deleteScene(index) {
  directorApi?.removeScene(index);
}

export function moveScene(from, to) {
  directorApi?.moveScene(from, to);
}
