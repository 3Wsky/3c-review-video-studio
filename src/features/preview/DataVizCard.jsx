import { useMemo } from "preact/hooks";
import {
  normalizeDataviz,
  countUpText,
  radarPoints,
  pointsToString,
  ringDash
} from "../../../shared/dataviz/geometry.mjs";
import { useEntrance, stagger } from "./use-entrance.js";
import "./dataviz.css";

function BarChart({ viz, p }) {
  return (
    <div class="dv-bars">
      {viz.items.map((item, i) => {
        const local = stagger(p, i);
        return (
          <div class="dv-bar-row" key={item.label}>
            <span class="dv-bar-label">{item.label}</span>
            <span class="dv-bar-track">
              <span class="dv-bar-fill" style={{ width: `${item.frac * local * 100}%` }} />
            </span>
            <span class="dv-bar-value">
              {countUpText(item.value, local)}
              {viz.unit ? <i>{viz.unit}</i> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RingChart({ viz, p }) {
  const items = viz.items.slice(0, 3);
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  return (
    <div class="dv-rings">
      {items.map((item, i) => {
        const local = stagger(p, i);
        const { circumference, dash } = ringDash(item.frac * local, r);
        return (
          <div class="dv-ring" key={item.label}>
            <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
              <circle class="dv-ring-bg" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} />
              <circle
                class="dv-ring-fg"
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke-width={stroke}
                stroke-dasharray={`${dash} ${circumference}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </svg>
            <strong>
              {countUpText(item.value, local)}
              {viz.unit ? <i>{viz.unit}</i> : null}
            </strong>
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RadarChart({ viz, p }) {
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 30;
  const n = viz.items.length;
  const grid = [0.33, 0.66, 1].map((k) => pointsToString(radarPoints(n, cx, cy, r * k)));
  const axes = radarPoints(n, cx, cy, r);
  const value = pointsToString(
    radarPoints(n, cx, cy, r, viz.items.map((item) => item.frac * p))
  );
  const labels = radarPoints(n, cx, cy, r + 16);
  return (
    <svg class="dv-radar" viewBox={`0 0 ${size} ${size}`} role="img">
      {grid.map((points) => (
        <polygon class="dv-radar-grid" points={points} key={points} />
      ))}
      {axes.map((a, i) => (
        <line class="dv-radar-axis" x1={cx} y1={cy} x2={a.x} y2={a.y} key={i} />
      ))}
      <polygon class="dv-radar-value" points={value} />
      {labels.map((pt, i) => (
        <text class="dv-radar-label" x={pt.x} y={pt.y} key={viz.items[i].label}>
          {viz.items[i].label}
        </text>
      ))}
    </svg>
  );
}

/**
 * 数据可视化参数卡：visual.dataviz → 动画条形图 / 雷达图 / 进度环。
 * 数据不合法（normalizeDataviz 返回 null）时不渲染，由调用方回退普通 info-card。
 */
export default function DataVizCard({ dataviz, sceneKey }) {
  const viz = useMemo(() => normalizeDataviz(dataviz), [dataviz]);
  const p = useEntrance(`${sceneKey}:${viz?.kind || ""}`);
  if (!viz) return null;
  return (
    <div class={`dv-card dv-${viz.kind}${viz.better === "low" ? " dv-low" : ""}`}>
      {viz.title ? <small class="dv-title">{viz.title}</small> : null}
      {viz.kind === "bar" ? <BarChart viz={viz} p={p} /> : null}
      {viz.kind === "ring" ? <RingChart viz={viz} p={p} /> : null}
      {viz.kind === "radar" ? <RadarChart viz={viz} p={p} /> : null}
    </div>
  );
}
