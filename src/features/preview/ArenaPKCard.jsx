import { useMemo } from "preact/hooks";
import { useLinearTime, enter, useStageScale, STAGE_BASE_W, STAGE_BASE_H } from "./preview-utils.js";
import { layoutFor } from "../../../video-render/remotion/src/layout.mjs";
import "./arena-pk.css";

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

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none", overflow: "hidden" }}>
      <div
        class="apk-root"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: STAGE_BASE_W,
          height: STAGE_BASE_H,
          transform: `scale(${scale || 0})`,
          transformOrigin: "top left",
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
          <div class="apk-title" style={{ fontSize: lay.titleSize || 36, opacity: slideP }}>
            擂台 PK · {battle.rounds[0]?.dim || "对决"}
          </div>

          <div style={{ display: "flex", gap: 24, alignItems: "stretch", position: "relative" }}>
            <div
              class="apk-side apk-side--left"
              style={{
                transform: `translateX(${-80 * (1 - slideP)}px)`,
                opacity: slideP,
              }}
            >
              <div class="apk-name--left">{battle.products[0]}</div>
              <div class="apk-hp-track">
                <div class="apk-hp-fill--left" style={{ width: `${hpFillA * 100}%` }} />
              </div>
              <div class="apk-hp-value">{Math.round(hpA)}%</div>
            </div>

            <div
              class="apk-vs"
              style={{
                width: lay.vsSize || 64,
                height: lay.vsSize || 64,
                transform: `translate(-50%, -50%) scale(${0.3 + 0.7 * vsP})`,
                opacity: vsP,
              }}
            >
              VS
            </div>

            <div
              class="apk-side apk-side--right"
              style={{
                transform: `translateX(${80 * (1 - slideP)}px)`,
                opacity: slideP,
              }}
            >
              <div class="apk-name--right">{battle.products[1]}</div>
              <div class="apk-hp-track">
                <div class="apk-hp-fill--right" style={{ width: `${hpFillB * 100}%` }} />
              </div>
              <div class="apk-hp-value">{Math.round(hpB)}%</div>
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
                    class={`apk-round ${isCrit ? "apk-round--crit" : "apk-round--normal"}`}
                    style={{
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
              class={`apk-verdict ${battle.verdict === 0 ? "apk-verdict--left" : "apk-verdict--right"}`}
              style={{ opacity: enter(localTime, roundStart + roundCount * roundDur + 0.3, 0.5, "power2.out") }}
            >
              🏆 {battle.products[battle.verdict]} 胜出
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
