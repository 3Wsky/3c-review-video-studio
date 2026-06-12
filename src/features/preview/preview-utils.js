import { useEffect, useRef, useState } from "preact/hooks";

// 渲染端（Remotion）9:16 基准画布尺寸——擂台/拍摄引导卡的绝对像素布局以此为准。
export const STAGE_BASE_W = 1080;
export const STAGE_BASE_H = 1920;

/**
 * 测量预览舞台真实宽度并算出相对 1080 基准的缩放比。
 * 让擂台 / 拍摄引导这类「整屏 HUD」直接复用 Remotion 的 1080×1920 像素布局，
 * 再整体 scale 进小尺寸预览框，预览与出片视觉一致（不维护双份布局）。
 * 返回 { ref, scale }：把 ref 挂到包裹层的父节点（舞台），scale 用于 transform。
 */
export function useStageScale(baseW = STAGE_BASE_W) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / baseW);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseW]);
  return { ref, scale };
}

/** @param {number} value */
export function formatSceneTime(value) {
  const seconds = Math.max(0, Math.round(value));
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * 线性时间进度钩子：0 → durationSec（秒），key 变化时重播。
 * @param {string} key 重播键
 * @param {number} durationSec 持续时间（秒）
 */
export function useLinearTime(key, durationSec = 4) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf;
    let start;
    setT(0);
    const tick = (ts) => {
      if (start == null) start = ts;
      const elapsed = (ts - start) / 1000;
      setT(Math.min(durationSec, elapsed));
      if (elapsed < durationSec) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, durationSec]);
  return t;
}

function easeCubicOut(t) {
  return 1 - Math.pow(1 - t, 3);
}
function easeQuadOut(t) {
  return 1 - Math.pow(1 - t, 2);
}
function easeLinear(t) {
  return t;
}

/**
 * 入场进度：localTime 在 [delay, delay+dur] 内从 0→1
 */
export function enter(localTime, delay, dur, ease = "power3.out") {
  if (localTime < delay) return 0;
  if (localTime > delay + dur) return 1;
  const t = (localTime - delay) / dur;
  if (ease === "power3.out") return easeCubicOut(t);
  if (ease === "power2.out") return easeQuadOut(t);
  return easeLinear(t);
}

/**
 * 一次性「回弹强调」脉冲：在 [start, start+dur] 内 1 → peak → 1
 */
export function pulse(localTime, start, dur, peak = 1.12) {
  if (localTime < start || localTime > start + dur) return 1;
  const t = (localTime - start) / dur;
  const progress = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
  const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  return 1 + (peak - 1) * easeProgress;
}
