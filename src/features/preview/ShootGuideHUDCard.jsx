import { useMemo } from "preact/hooks";
import { useLinearTime, enter, useStageScale, STAGE_BASE_W, STAGE_BASE_H } from "./preview-utils.js";
import { layoutFor } from "../../../video-render/remotion/src/layout.mjs";

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
  const corner = 28;
  const activeStep = Math.min(guide.steps.length - 1, Math.floor(Math.max(0, localTime - 0.8) / 1.2));

  const cornerStyle = (pos) => ({
    position: "absolute",
    width: corner,
    height: corner,
    borderColor: "#00e5ff",
    borderStyle: "solid",
    ...(pos.includes("t") ? { top: 0, borderTopWidth: 3 } : { bottom: 0, borderBottomWidth: 3 }),
    ...(pos.includes("l") ? { left: 0, borderLeftWidth: 3 } : { right: 0, borderRightWidth: 3 }),
    opacity: frameP,
  });

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          transform: `scale(${scale || 0})`,
          transformOrigin: "top left",
          fontFamily: "var(--game-font-hud, 'Rajdhani', system-ui, sans-serif)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: lay.headerH || 72,
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            background: "rgba(6,10,18,0.88)",
            borderBottom: "1px solid rgba(0,229,255,0.28)",
            fontSize: 30,
            fontWeight: 700,
            color: "#e8f4ff",
            opacity: headP,
          }}
        >
          📷 {guide.title}
          {guide.angle ? <span style={{ marginLeft: 16, fontSize: 24, color: "#ffd166" }}>{guide.angle}</span> : null}
        </div>

        <div
          style={{
            position: "absolute",
            left: fx,
            top: fy,
            width: fw,
            height: fh,
            opacity: frameP,
            transform: `scale(${0.92 + 0.08 * frameP})`,
          }}
        >
          <div style={cornerStyle("tl")} />
          <div style={cornerStyle("tr")} />
          <div style={cornerStyle("bl")} />
          <div style={cornerStyle("br")} />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "2px solid #ffd166",
              boxShadow: "0 0 16px rgba(255,209,102,0.5)",
            }}
          >
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, marginLeft: -1, background: "#ffd166" }} />
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, marginTop: -1, background: "#ffd166" }} />
          </div>
        </div>

        {guide.steps.length ? (
          <div
            style={{
              position: "absolute",
              right: 24,
              top: (lay.headerH || 72) + 40,
              width: lay.checklistW || 280,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              opacity: enter(localTime, 0.5, 0.4, "power2.out"),
            }}
          >
            {guide.steps.map((step, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              return (
                <div
                  key={step}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    fontSize: 22,
                    fontWeight: 600,
                    color: done ? "#7ee0c0" : active ? "#fff" : "rgba(232,244,255,0.5)",
                    background: active ? "rgba(0,229,255,0.15)" : "rgba(6,10,18,0.6)",
                    border: `1px solid ${active ? "rgba(0,229,255,0.45)" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {done ? "☑" : active ? "▸" : "○"} {step}
                </div>
              );
            })}
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            bottom: 140,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 12,
            opacity: enter(localTime, 0.6, 0.4, "power1.out"),
          }}
        >
          {guide.steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: i <= activeStep ? "#00e5ff" : "rgba(255,255,255,0.25)",
                boxShadow: i === activeStep ? "0 0 10px #00e5ff" : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
