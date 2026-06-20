/** @typedef {{ message: string; tone?: 'default'|'success'|'warning'|'danger'; duration?: number }} ToastPayload */

const listeners = new Set();

/** @param {ToastPayload} payload */
export function showAppToast(payload) {
  const item = {
    message: String(payload.message || ""),
    tone: payload.tone || "default",
    duration: payload.duration ?? 6000
  };
  listeners.forEach((fn) => fn(item));
}

/** @param {(payload: ToastPayload) => void} fn */
export function subscribeAppToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
