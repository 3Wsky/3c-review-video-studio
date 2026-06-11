import { useDirectorStore } from "../../store/useDirectorStore.js";

/** @type {(() => void) | null} */
let gateProceedFn = null;

export function initQualityBridge() {
  window.addEventListener("director:open-checkup", (event) => {
    const report = event.detail?.report ?? null;
    useDirectorStore.getState().openCheckup(report);
  });

  window.addEventListener("director:close-checkup", () => {
    useDirectorStore.getState().closeCheckup();
  });

  window.addEventListener("director:open-gate", (event) => {
    const { report, onProceed } = event.detail || {};
    gateProceedFn = typeof onProceed === "function" ? onProceed : null;
    useDirectorStore.getState().openGate(report, Boolean(gateProceedFn));
  });

  window.addEventListener("director:close-gate", () => {
    gateProceedFn = null;
    useDirectorStore.getState().closeGate();
  });
}

export function proceedGate() {
  const fn = gateProceedFn;
  gateProceedFn = null;
  useDirectorStore.getState().closeGate();
  fn?.();
}
