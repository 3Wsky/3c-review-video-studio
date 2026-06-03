// Remotion 动画小工具：把 build.mjs 里 GSAP 的「入场 from」时间线翻译成基于帧的插值。
//
// GSAP 的 `tl.from(el, { autoAlpha:0, y:44, duration:0.7, ease:"power3.out" }, at)`
// 含义：元素在 at 秒开始、用 duration 秒、从 (透明、偏移 y) 缓动到 (不透明、归位)。
// 这里用 Remotion 的 interpolate 复刻成进度 p∈[0,1]，再由组件换算 opacity / transform。

import { interpolate, Easing } from "remotion";

// GSAP ease 名 → Remotion Easing
export function easeOf(name) {
  switch (name) {
    case "power3.out":
      return Easing.out(Easing.cubic);
    case "power2.out":
      return Easing.out(Easing.quad);
    case "power1.out":
      return Easing.out(Easing.ease);
    case "power1.inOut":
      return Easing.inOut(Easing.ease);
    case "none":
    case "linear":
      return Easing.linear;
    default:
      return Easing.out(Easing.cubic);
  }
}

// 入场进度：localTime（秒，相对本镜起点）在 [delay, delay+dur] 内从 0→1，外部钳制。
export function enter(localTime, delay, dur, ease = "power3.out") {
  return interpolate(localTime, [delay, delay + Math.max(0.0001, dur)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOf(ease),
  });
}

// 一次性「回弹强调」脉冲：在 [start, start+dur] 内 1 → peak → 1（yoyo 一次）。
export function pulse(localTime, start, dur, peak = 1.12) {
  const half = Math.max(0.0001, dur / 2);
  return interpolate(
    localTime,
    [start, start + half, start + 2 * half],
    [1, peak, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) },
  );
}
