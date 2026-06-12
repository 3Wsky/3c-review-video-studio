import { useMemo } from "preact/hooks";
import { useLinearTime, enter, useStageScale, STAGE_BASE_W, STAGE_BASE_H } from "./preview-utils.js";
import { layoutFor } from "../../../video-render/remotion/src/layout.mjs";

// 擂台 PK 预览卡：复用 Remotion <ArenaPK> 的 1080×1920 像素布局，整体 scale 进预览舞台，
// 保证预览与出片视觉一致（动画用 useLinearTime 线性时间驱动，几何来自 normalizeBattle）。
export default function ArenaPKCard({ battle, sceneKey, durationSec, formatKey = "9:16" }) {
  const localTime = useLinearTime(sceneKey, durationSec);
  const lay = useMemo(() => layoutFor(formatKey, "arena"), [formatKey]);
  const { ref, scale } = useStageScale(STAGE_BASE_W);

  const slideP = enter(localTime, 0, 0.5, "power3.out");
  const vsP = enter(localTime, 0.8, 0.35, "power3.out");
  const roundCount = battle.rounds.length;
  const roundDur = 0.55;
  const roundStart = 1.2;

  let activeRound = -1;
  for (let i = 0; i < roundCount; i++) {
    if (localTime >= roundStart + i * roundDur) activeRound = i;
  }
  const hpIdx = Math.min(activeRound + 1, battle.hp.length - 1);
  const [hpA, hpB] = battle.hp[hpIdx];
  const hpFillA = enter(localTime, 0.3, 0.6, "power2.out") * (hpA / 100);
  const hpFillB = enter(localTime, 0.3, 0.6, "power2.out") * (hpB / 100);

  const sideBase = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    padding: "20px 16px",
    borderRadius: 16,
    border: "2px solid",
  };

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: STAGE_BASE_W,
          height: STAGE_BASE_H,
          transform: `scale(${scale || 0})`,
          transformOrigin: "top left",
          fontFamily: "var(--game-font-hud, 'Rajdhani', system-ui, sans-serif)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: lay.top,
            left: lay.left,
            right: lay.right,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: lay.titleSize || 36,
              fontWeight: 700,
              color: "#ffd166",
              letterSpacing: 2,
              opacity: slideP,
            }}
          >
            擂台 PK · {battle.rounds[0]?.dim || "对决"}
          </div>

          <div style={{ display: "flex", gap: 24, alignItems: "stretch", position: "relative" }}>
            <div
              style={{
                ...sideBase,
                borderColor: "rgba(0,229,255,0.55)",
                background: "rgba(0,229,255,0.1)",
                transform: `translateX(${-80 * (1 - slideP)}px)`,
                opacity: slideP,
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 800, color: "#00e5ff" }}>{battle.products[0]}</div>
              <div style={{ width: "85%", height: lay.hpHeight || 28, borderRadius: 8, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{ width: `${hpFillA * 100}%`, height: "100%", background: "linear-gradient(90deg,#00e5ff,#7ee0c0)", borderRadius: 8 }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{Math.round(hpA)}%</div>
            </div>

            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) scale(${0.3 + 0.7 * vsP})`,
                width: lay.vsSize || 64,
                height: lay.vsSize || 64,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 900,
                color: "#10131a",
                background: "linear-gradient(135deg,#ffd166,#ffe680)",
                boxShadow: "0 0 24px rgba(255,209,102,0.6)",
                opacity: vsP,
                zIndex: 2,
              }}
            >
              VS
            </div>

            <div
              style={{
                ...sideBase,
                borderColor: "rgba(255,45,149,0.55)",
                background: "rgba(255,45,149,0.1)",
                transform: `translateX(${80 * (1 - slideP)}px)`,
                opacity: slideP,
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 800, color: "#ff2d95" }}>{battle.products[1]}</div>
              <div style={{ width: "85%", height: lay.hpHeight || 28, borderRadius: 8, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{ width: `${hpFillB * 100}%`, height: "100%", background: "linear-gradient(90deg,#ff2d95,#ff6eb4)", borderRadius: 8 }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{Math.round(hpB)}%</div>
            </div>
          </div>

          {activeRound >= 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {battle.rounds.slice(0, activeRound + 1).map((r, i) => {
                const dmgP = enter(localTime, roundStart + i * roundDur, 0.4, "power3.out");
                const isCrit = r.critical;
                return (
                  <div
                    key={r.dim}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 10,
                      fontSize: 26,
                      fontWeight: 700,
                      color: isCrit ? "#ffd166" : "#e8f4ff",
                      background: "rgba(6,10,18,0.75)",
                      border: `1px solid ${isCrit ? "rgba(255,209,102,0.6)" : "rgba(0,229,255,0.3)"}`,
                      opacity: dmgP,
                      transform: `translateY(${-20 * (1 - dmgP)}px)`,
                    }}
                  >
                    {r.dim}: {r.a.text} vs {r.b.text}
                    {r.winner >= 0 ? ` · -${r.damage}%` : ""}
                    {isCrit ? " CRIT" : ""}
                  </div>
                );
              })}
            </div>
          ) : null}

          {battle.verdict >= 0 ? (
            <div
              style={{
                textAlign: "center",
                fontSize: 34,
                fontWeight: 800,
                color: battle.verdict === 0 ? "#00e5ff" : "#ff2d95",
                opacity: enter(localTime, roundStart + roundCount * roundDur + 0.3, 0.5, "power2.out"),
              }}
            >
              🏆 {battle.products[battle.verdict]} 胜出
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
