import { useMemo } from "preact/hooks";
import { useLinearTime, enter, useStageScale, STAGE_BASE_W, STAGE_BASE_H } from "./preview-utils.js";
import { layoutFor } from "../../../video-render/remotion/src/layout.mjs";
import "./shoot-guide-hud.css";

// 拍摄引导 HUD 预览卡：复用 Remotion <ShootGuideHUD> 的 1080×1920 整屏布局，整体 scale 进预览舞台。
// 取景框坐标 guide.frame 为 0–1 相对值，乘以 1080×1920 基准画布。
export default function ShootGuideHUDCard({ guide, sceneKey, durationSec, formatKey = "9:16" }) {
  const localTime = useLinearTime(sceneKey, durationSec);
  const lay = useMemo(() => layoutFor(formatKey, "shootGuide"), [formatKey]);
  const { ref, scale } = useStageScale(STAGE_BASE_W);

  const headP = enter(localTime, 0.1, 0.4, "power2.out");
  const frameP = enter(localTime, 0.25, 0.5, "power3.out");

  const W = STAGE_BASE_W;
  const H = STAGE_BASE_H;

  const fx = guide.frame.x * W;
  const fy = guide.frame.y * H;
  const fw = guide.frame.w * W;
  const fh = guide.frame.h * H;
  const headerH = lay.headerH || 72;
  const activeStep = Math.min(guide.steps.length - 1, Math.floor(Math.max(0, localTime - 0.8) / 1.2));

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none", overflow: "hidden" }}>
      <div
        class="sgh-root"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          transform: `scale(${scale || 0})`,
          transformOrigin: "top left",
        }}
      >
        <div class="sgh-header" style={{ height: headerH, opacity: headP }}>
          📷 {guide.title}
          {guide.angle ? <span class="sgh-header-angle">{guide.angle}</span> : null}
        </div>

        <div
          class="sgh-frame-wrap"
          style={{
            left: fx,
            top: fy,
            width: fw,
            height: fh,
            opacity: frameP,
            transform: `scale(${0.92 + 0.08 * frameP})`,
          }}
        >
          <div class="sgh-frame-hole" style={{ inset: 0 }} />
          <div class="sgh-corner sgh-corner--tl" />
          <div class="sgh-corner sgh-corner--tr" />
          <div class="sgh-corner sgh-corner--bl" />
          <div class="sgh-corner sgh-corner--br" />
          <div class="sgh-demo-outline" aria-hidden="true" />
          <div class="sgh-crosshair" aria-hidden="true" />
        </div>

        {guide.steps.length ? (
          <div
            class="sgh-checklist"
            style={{
              top: headerH + 40,
              width: lay.checklistW || 280,
              opacity: enter(localTime, 0.5, 0.4, "power2.out"),
            }}
          >
            {guide.steps.map((step, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              const state = done ? "done" : active ? "active" : "pending";
              return (
                <div key={step} class={`sgh-step sgh-step--${state}`}>
                  {done ? "☑" : active ? "▸" : "○"} {step}
                </div>
              );
            })}
          </div>
        ) : null}

        <div class="sgh-progress" style={{ opacity: enter(localTime, 0.6, 0.4, "power1.out") }}>
          {guide.steps.map((_, i) => (
            <div
              key={i}
              class={`sgh-dot${i < activeStep ? " is-done" : ""}${i === activeStep ? " is-active" : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
