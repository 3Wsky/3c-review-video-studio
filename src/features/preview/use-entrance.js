import { useEffect, useState } from "preact/hooks";

/**
 * 入场进度 p：0 → 1（easeOutCubic），key 变化时重播。
 * 预览端数据卡/Stat Ring 共用；渲染端用 GSAP/帧插值驱动同一套几何。
 * @param {string} key 重播键（一般含 scene id）
 * @param {number} duration 毫秒，默认 900
 */
export function useEntrance(key, duration = 900) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf;
    let start;
    setP(0);
    const tick = (ts) => {
      if (start == null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      setP(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, duration]);
  return p;
}

/** 错峰：第 i 项延迟 i*step 后在剩余窗口内走完（p ∈ [0,1] → 局部 [0,1]） */
export function stagger(p, i, step = 0.15) {
  const delay = i * step;
  return Math.max(0, Math.min(1, (p - delay) / (1 - delay || 1)));
}
