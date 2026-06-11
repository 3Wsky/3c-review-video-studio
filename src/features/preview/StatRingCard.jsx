import { useMemo } from "preact/hooks";
import {
  normalizeMetric,
  radarFromSpec,
  countUpText,
  ringDash,
  ringNodePoints
} from "../../../shared/dataviz/geometry.mjs";
import { useEntrance, stagger } from "./use-entrance.js";
import "./dataviz.css";

/**
 * 技能树 Stat Ring（visual.metric 的游戏化升级）：
 * 中心数字 0→value 滚动 + 环形经验条 + 四角属性节点点亮（取 visual.radar.dims 前 4 维）
 * + 「技能解锁」横幅 slide-up。无 radar 时退化为「数字 + 经验环」（即原单环数据卡语义）。
 * 音效（STAT_TICK / SKILL_UNLOCK）等素材包就位后接入，当前静默。
 */
export default function StatRingCard({ metric, radar, sceneKey }) {
  const m = useMemo(() => normalizeMetric(metric), [metric]);
  const viz = useMemo(() => radarFromSpec(radar), [radar]);
  const p = useEntrance(`${sceneKey}:stat-ring`, 1400);
  if (!m) return null;

  const size = 108;
  const stroke = 9;
  const r = (size - stroke) / 2 - 8;
  const ringP = Math.min(1, p / 0.7); // 环先行，0.7p 内走完
  const { circumference, dash } = ringDash((m.frac == null ? 1 : m.frac) * ringP, r);
  const accent = m.better === "low" ? "var(--game-hp-green, #3dff8a)" : "var(--game-achievement, #ffd700)";
  const nodes = viz ? viz.items.slice(0, 4) : [];
  const nodePts = nodes.length ? ringNodePoints(nodes.length, size / 2, size / 2, r + 1) : [];
  const bannerP = stagger(p, 4, 0.18); // 节点全亮后横幅压轴

  return (
    <div class="sr-card" style={{ "--sr-accent": accent }}>
      {m.label ? <small class="sr-label">{m.label}</small> : null}
      <div class="sr-stage">
        <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle class="sr-ring-bg" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} />
          <circle
            class="sr-ring-fg"
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke-width={stroke}
            stroke-dasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          {nodePts.map((pt, i) => {
            const lit = stagger(p, i + 1, 0.16) > 0.5;
            return (
              <g key={nodes[i].label} class={`sr-node${lit ? " is-lit" : ""}`}>
                <circle cx={pt.x} cy={pt.y} r={6.5} />
                <text x={pt.x} y={pt.y + (pt.y > size / 2 ? 16 : -12)}>
                  {nodes[i].label}
                </text>
              </g>
            );
          })}
        </svg>
        <strong class="sr-value">
          {countUpText(m.value, Math.min(1, p / 0.8))}
          {m.unit ? <i>{m.unit}</i> : null}
        </strong>
      </div>
      {m.caption ? <span class="sr-caption">{m.caption}</span> : null}
      <div class="sr-banner" style={{ opacity: bannerP, transform: `translateY(${12 * (1 - bannerP)}px)` }}>
        ⬡ {m.label || "属性"} · 解锁
      </div>
    </div>
  );
}
