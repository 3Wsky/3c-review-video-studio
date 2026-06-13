import { useMemo } from "preact/hooks";
import {
  radarPoints,
  pointsToString,
  radarLockFractions,
  radarValuePoints,
  radarSweepEndpoint,
} from "../../../shared/dataviz/geometry.mjs";
import { useEntrance } from "./use-entrance.js";
import "./radar-hud.css";

/**
 * 雷达 HUD 五维扫描卡（P2）：visual.radar = { dims:[{label,value,max?}] }（≥3 维）。
 * 360° 扫描线掠过，顶点被扫到即锁定（lock-on）并脉冲放大，值多边形随锁定逐顶点展开。
 * 几何与渲染端 Remotion <RadarHUD> 共用 shared/dataviz/geometry.mjs，预览=出片。
 * 已是 normalizeRadar 后的渲染态（dims 带 frac）。
 */
export default function RadarHUDCard({ radar, sceneKey }) {
  const dims = radar?.dims || [];
  const p = useEntrance(`${sceneKey}:radar-hud`, 1800);
  if (dims.length < 3) return null;

  const size = 188;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = dims.length;

  const grid = useMemo(
    () => [0.33, 0.66, 1].map((k) => pointsToString(radarPoints(n, cx, cy, r * k))),
    [n, r]
  );
  const axes = useMemo(() => radarPoints(n, cx, cy, r), [n, r]);
  const labels = useMemo(() => radarPoints(n, cx, cy, r + 18), [n, r]);

  const locks = radarLockFractions(n, p);
  const fracs = dims.map((d) => d.frac);
  const value = pointsToString(radarValuePoints(n, cx, cy, r, fracs, locks));
  const sweep = radarSweepEndpoint(cx, cy, r, p);
  const sweepOpacity = sweep.done ? Math.max(0, 1 - (p - 0.87) / 0.13) : 0.9;

  // 扫描扇形：从 12 点方向顺时针扫至当前扫描端点
  const sweepSector =
    sweep.done || sweepOpacity <= 0
      ? null
      : (() => {
          const startX = cx;
          const startY = cy - r;
          const large = sweep.angleDeg > 180 ? 1 : 0;
          return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${large} 1 ${sweep.x} ${sweep.y} Z`;
        })();

  return (
    <div class="rh-card">
      <div class="rh-corners" aria-hidden="true">
        <i /><i />
      </div>
      <small class="rh-title">Radar Scan</small>
      <div class="rh-stage">
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="雷达扫描">
          <defs>
            <radialGradient id={`rh-sweep-${sceneKey}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(0,229,255,0.0)" />
              <stop offset="70%" stop-color="rgba(0,229,255,0.18)" />
              <stop offset="100%" stop-color="rgba(0,229,255,0.42)" />
            </radialGradient>
          </defs>

          {grid.map((points) => (
            <polygon class="rh-grid" points={points} key={points} />
          ))}
          {axes.map((a, i) => (
            <line class="rh-axis" x1={cx} y1={cy} x2={a.x} y2={a.y} key={`ax-${i}`} />
          ))}

          {/* 扫描扇形尾迹 */}
          {sweepSector ? <path class="rh-sweep-sector" d={sweepSector} /> : null}

          {!sweep.done || sweepOpacity > 0 ? (
            <g style={{ opacity: sweepOpacity }}>
              <line class="rh-sweep" x1={cx} y1={cy} x2={sweep.x} y2={sweep.y} />
              <circle class="rh-sweep-dot" cx={sweep.x} cy={sweep.y} r={3} />
            </g>
          ) : null}

          <polygon class="rh-value" points={value} />

          {/* 顶点锁定标记：扫到即点亮，>0.5 显示数值 */}
          {axes.map((a, i) => {
            const lit = locks[i] > 0.5;
            return (
              <circle
                key={`vx-${i}`}
                class={`rh-vertex${lit ? " is-lit" : ""}`}
                cx={a.x}
                cy={a.y}
                r={lit ? 4.5 : 2.5}
              />
            );
          })}

          {labels.map((pt, i) => (
            <text
              key={dims[i].label}
              class={`rh-label${locks[i] > 0.5 ? " is-lit" : ""}`}
              x={pt.x}
              y={pt.y}
            >
              {dims[i].label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
