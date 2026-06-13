// 3C 测评短视频 Remotion 合成（与 HyperFrames 那套 build.mjs 出片语义对齐）。
//
// 入参 inputProps：{ timeline, format, assetMap }
//   - timeline : 导演台的 Timeline JSON（{ project, insights, timeline[] }）
//   - format   : "9:16" | "16:9" | "1:1"
//   - assetMap : { 素材名 -> 图片 URL（data: / blob: / http(s):） }，缺省则纯渐变背景
//
// 同一份组件既被 render.mjs 用于出 MP4，也被 <Player> 用于网页实时预览。

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  buildComposition,
  highlightTokens,
  karaokeFraction,
  formatCountUp,
  metricRingFraction,
  radarPoints,
  pointsToString,
  ringDash,
  countUpText,
  radarLockFractions,
  radarValuePoints,
  radarSweepEndpoint,
} from "./scene-model.mjs";
import { layoutFor } from "./layout.mjs";
import { enter, pulse } from "./anim.mjs";

const FONT_STACK =
  '"PingFang SC", "Source Han Sans", "Microsoft YaHei", "Noto Sans SC", "WenQuanYi Zen Hei", sans-serif';

// 字幕数字高亮：把 token 数组渲染成受控 span（高亮色 #ffd166），不使用 innerHTML。
function Highlight({ text }) {
  const tokens = highlightTokens(text);
  return (
    <>
      {tokens.map((t, i) =>
        t.hl ? (
          <span key={i} style={{ color: "#ffd166" }}>
            {t.text}
          </span>
        ) : (
          <React.Fragment key={i}>{t.text}</React.Fragment>
        ),
      )}
    </>
  );
}

// 一行内把数值归一化成「越好越满」的条形比例 ∈ [0,1]：
// better=high → 越大越满；better=low → 越小越满。无有效差异（全相等/缺数）→ 都给满。
function goodnessFractions(nums, better) {
  const finite = nums.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (finite.length === 0) return nums.map(() => 0);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min;
  return nums.map((n) => {
    if (typeof n !== "number" || !Number.isFinite(n)) return 0;
    if (span <= 0) return 1; // 全相等：都给满条
    return better === "low" ? (max - n) / span : (n - min) / span;
  });
}

// 数字滚动统一走 scene-model 的 formatCountUp（纯函数、带单测），渲染内核与网页预览共用。

// 卡拉OK字幕：随本镜进度逐字「点亮」（未念到的字压暗、已念到的全亮、光标处一字宽平滑过渡）。
// progress ∈ [0,1] 是本镜「念到第几个字」的比例：有 whisper 逐词时间戳时跟真实语音走，否则线性匀速。数字仍保金色高亮。
function SubtitleKaraoke({ text, progress }) {
  const tokens = highlightTokens(text);
  const chars = [];
  tokens.forEach((tk) => {
    for (const ch of Array.from(tk.text)) chars.push({ ch, hl: tk.hl });
  });
  if (chars.length === 0) return null;
  const spoken = progress * chars.length;
  return (
    <>
      {chars.map((c, i) => {
        const lit = Math.max(0, Math.min(1, spoken - i)); // 光标处 0→1 渐亮
        return (
          <span key={i} style={{ color: c.hl ? "#ffd166" : "#fff", opacity: 0.4 + 0.6 * lit }}>
            {c.ch}
          </span>
        );
      })}
    </>
  );
}

// 横评对比矩阵：表头（综合胜者带皇冠高亮）+ 每行一个维度（胜者格金色 ✓）。
// 数值格带「条形增长 + 数字滚动」入场动效：随该行 stagger 揭晓，条按归一化优度长出、数字从 0 滚到位。
function CompareMatrix({ scene, formatKey, localTime }) {
  const c = scene.compare;
  const lay = layoutFor(formatKey, "compare");
  const cols = c.products.length;
  const gridCols = `1.25fr repeat(${cols}, 1fr)`;

  const headP = enter(localTime, 0.3, 0.5, "power2.out");
  const winStart = 0.7 + c.rows.length * 0.22;
  const winPulse = pulse(localTime, winStart, 0.56, 1.12);
  const pickPulse = pulse(localTime, winStart + 0.2, 0.64, 1.08);

  const cellBase = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "22px 12px",
    borderRadius: 14,
    fontSize: 38,
    fontWeight: 600,
    textAlign: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    minHeight: 92,
    lineHeight: 1.2,
  };

  return (
    <div
      style={{
        position: "absolute",
        top: lay.top,
        left: lay.left,
        right: lay.right,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* 表头 */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: gridCols,
          opacity: headP,
          transform: `translateY(${-24 * (1 - headP)}px)`,
        }}
      >
        <div style={{ ...cellBase, fontSize: 40, fontWeight: 800, padding: "20px 10px", color: "#aeb6cf", background: "rgba(255,255,255,0.03)" }}>
          对比
        </div>
        {c.products.map((p, i) => {
          const win = i === c.verdict;
          return (
            <div
              key={i}
              style={{
                ...cellBase,
                fontSize: 40,
                fontWeight: 800,
                padding: "20px 10px",
                color: win ? "#fff" : "#dbe3ff",
                background: win ? "rgba(255,190,80,0.28)" : "rgba(88,110,255,0.20)",
                borderColor: win ? "rgba(255,205,120,0.85)" : "rgba(140,160,255,0.45)",
                transform: win ? `scale(${pickPulse})` : undefined,
              }}
            >
              {win ? "👑 " : ""}
              {p}
            </div>
          );
        })}
      </div>

      {/* 维度行 */}
      {c.rows.map((row, r) => {
        const p = enter(localTime, 0.55 + r * 0.22, 0.45, "power2.out");
        // 条形/数字稍晚于该行滑入再增长，做出「先到位、再读数」的节奏感。
        const barP = enter(localTime, 0.55 + r * 0.22 + 0.12, 0.5, "power2.out");
        const nums = Array.isArray(row.nums) ? row.nums : [];
        const fracs = goodnessFractions(nums, row.better);
        return (
          <div
            key={r}
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: gridCols,
              opacity: p,
              transform: `translateX(${-40 * (1 - p)}px)`,
            }}
          >
            <div
              style={{
                ...cellBase,
                justifyContent: "flex-start",
                textAlign: "left",
                fontSize: 34,
                color: "#c6cfe6",
                background: "transparent",
                borderColor: "transparent",
                paddingLeft: 6,
              }}
            >
              {row.label}
              {row.unit ? (
                <small style={{ fontSize: 24, color: "#8d97b4", fontWeight: 500 }}>（{row.unit}）</small>
              ) : null}
            </div>
            {row.values.map((v, i) => {
              const win = i === row.winner;
              const hasNum = typeof nums[i] === "number" && Number.isFinite(nums[i]);
              const fillW = Math.max(0, Math.min(1, fracs[i])) * barP * 100;
              return (
                <div
                  key={i}
                  style={{
                    ...cellBase,
                    position: "relative",
                    overflow: "hidden",
                    paddingBottom: 30,
                    color: win ? "#20231a" : "#eef0f6",
                    background: win ? "#ffd166" : "rgba(255,255,255,0.06)",
                    borderColor: win ? "#ffd166" : "rgba(255,255,255,0.10)",
                    fontWeight: win ? 800 : 600,
                    transform: win ? `scale(${winPulse})` : undefined,
                  }}
                >
                  {hasNum ? formatCountUp(v, nums[i], barP) : v}
                  {hasNum ? (
                    <div
                      style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        bottom: 12,
                        height: 8,
                        borderRadius: 5,
                        background: win ? "rgba(20,40,16,0.16)" : "rgba(255,255,255,0.10)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${fillW}%`,
                          height: "100%",
                          borderRadius: 5,
                          background: win ? "#1f3a14" : "rgba(130,158,255,0.95)",
                        }}
                      />
                    </div>
                  ) : null}
                  {win ? (
                    <i style={{ position: "absolute", top: 6, right: 12, fontSize: 24, fontStyle: "normal", color: "#1a3a1a" }}>✓</i>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// 错峰：第 i 项延迟 i*step 后在剩余窗口内走完（与前端 use-entrance.stagger 同语义）。
function staggerLocal(p, i, step = 0.15) {
  const delay = i * step;
  return Math.max(0, Math.min(1, (p - delay) / (1 - delay || 1)));
}

// 数据可视化参数卡（visual.dataviz：bar/radar/ring）· 渲染端版本。
// 与前端 src/features/preview/DataVizCard.jsx 同语义（共用 shared/dataviz/geometry 几何 +
// 错峰入场），但按 1080p 视频尺度放大字号/线宽。better=low 用青绿强调，否则金色。
function DataVizCard({ viz, localTime, lay }) {
  const cardP = enter(localTime, 0.3, 0.5, "power3.out");
  const p = enter(localTime, 0.45, 1.0, "power2.out");
  const accent = viz.better === "low" ? "#7ee0c0" : "#ffd166";

  return (
    <div
      style={{
        position: "absolute",
        top: lay.top,
        left: lay.left,
        right: lay.right,
        padding: "28px 32px",
        borderRadius: 20,
        background: "rgba(16,19,26,0.92)",
        border: "1px solid rgba(255,255,255,0.14)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        opacity: cardP,
        transform: `translateY(${30 * (1 - cardP)}px)`,
      }}
    >
      {viz.title ? (
        <div style={{ color: accent, fontSize: lay.titleSize, fontWeight: 900, letterSpacing: 1.2 }}>
          {viz.title}
        </div>
      ) : null}
      {viz.kind === "bar" ? <DataVizBars viz={viz} p={p} accent={accent} lay={lay} /> : null}
      {viz.kind === "ring" ? <DataVizRings viz={viz} p={p} accent={accent} lay={lay} /> : null}
      {viz.kind === "radar" ? <DataVizRadar viz={viz} p={p} accent={accent} lay={lay} /> : null}
    </div>
  );
}

function DataVizBars({ viz, p, accent, lay }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {viz.items.map((item, i) => {
        const local = staggerLocal(p, i);
        return (
          <div
            key={item.label}
            style={{ display: "grid", gridTemplateColumns: "minmax(140px,auto) 1fr minmax(120px,auto)", alignItems: "center", gap: 18 }}
          >
            <span style={{ color: "#c6cfe6", fontSize: lay.labelSize, fontWeight: 700, whiteSpace: "nowrap" }}>
              {item.label}
            </span>
            <span style={{ height: 22, borderRadius: 11, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${item.frac * local * 100}%`,
                  borderRadius: 11,
                  background: `linear-gradient(90deg, ${accent}66, ${accent})`,
                }}
              />
            </span>
            <span style={{ color: "#fff", fontSize: lay.valueSize, fontWeight: 800, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {countUpText(item.value, local)}
              {viz.unit ? <i style={{ fontStyle: "normal", fontSize: lay.unitSize, fontWeight: 700, color: accent, marginLeft: 4 }}>{viz.unit}</i> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DataVizRings({ viz, p, accent, lay }) {
  const items = viz.items.slice(0, 3);
  const size = lay.ringSize;
  const stroke = Math.round(size * 0.12);
  const r = (size - stroke) / 2;
  return (
    <div style={{ display: "flex", justifyContent: "space-around", gap: 18 }}>
      {items.map((item, i) => {
        const local = staggerLocal(p, i);
        const { circumference, dash } = ringDash(item.frac * local, r);
        return (
          <div key={item.label} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} strokeLinecap="round" />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={accent}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </svg>
            <strong style={{ position: "absolute", top: size * 0.34, fontSize: lay.valueSize, fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
              {countUpText(item.value, local)}
              {viz.unit ? <i style={{ fontStyle: "normal", fontSize: lay.unitSize, fontWeight: 700, color: accent, marginLeft: 2 }}>{viz.unit}</i> : null}
            </strong>
            <span style={{ color: "#c6cfe6", fontSize: lay.labelSize, fontWeight: 700 }}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DataVizRadar({ viz, p, accent, lay }) {
  const size = lay.radarSize;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - lay.radarPad;
  const n = viz.items.length;
  const grid = [0.33, 0.66, 1].map((k) => pointsToString(radarPoints(n, cx, cy, r * k)));
  const axes = radarPoints(n, cx, cy, r);
  const value = pointsToString(radarPoints(n, cx, cy, r, viz.items.map((item) => item.frac * p)));
  const labels = radarPoints(n, cx, cy, r + lay.radarPad * 0.6);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", margin: "0 auto" }}>
      {grid.map((points) => (
        <polygon key={points} points={points} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
      ))}
      {axes.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke="rgba(255,255,255,0.10)" strokeWidth={1.5} />
      ))}
      <polygon points={value} fill={`${accent}52`} stroke={accent} strokeWidth={3} strokeLinejoin="round" />
      {labels.map((pt, i) => (
        <text key={viz.items[i].label} x={pt.x} y={pt.y} fill="#c6cfe6" fontSize={lay.labelSize} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
          {viz.items[i].label}
        </text>
      ))}
    </svg>
  );
}

// 雷达 HUD 五维扫描卡（visual.radar 独立成镜，无 metric）· P2。
// 360° 扫描线 + 顶点 lock-on + 值多边形逐顶点展开；几何与前端 RadarHUDCard 共用 geometry.mjs。
function RadarHUD({ radar, localTime, lay }) {
  const dims = radar?.dims || [];
  if (dims.length < 3) return null;

  const cardP = enter(localTime, 0.1, 0.45, "power3.out");
  const p = enter(localTime, 0.15, 1.65, "power2.out");

  const size = lay.size || 420;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - (lay.pad || 70);
  const n = dims.length;

  const grid = [0.33, 0.66, 1].map((k) => pointsToString(radarPoints(n, cx, cy, r * k)));
  const axes = radarPoints(n, cx, cy, r);
  const labels = radarPoints(n, cx, cy, r + (lay.pad || 70) * 0.26);
  const locks = radarLockFractions(n, p);
  const fracs = dims.map((d) => d.frac);
  const value = pointsToString(radarValuePoints(n, cx, cy, r, fracs, locks));
  const sweep = radarSweepEndpoint(cx, cy, r, p);
  const sweepOpacity = sweep.done ? Math.max(0, 1 - (p - 0.87) / 0.13) : 0.9;

  const sweepSector =
    sweep.done || sweepOpacity <= 0
      ? null
      : (() => {
          const startX = cx;
          const startY = cy - r;
          const large = sweep.angleDeg > 180 ? 1 : 0;
          return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${large} 1 ${sweep.x} ${sweep.y} Z`;
        })();

  const hudCyan = "#00e5ff";
  const vertexLit = "#7ee0c0";

  return (
    <div
      style={{
        position: "absolute",
        top: lay.top,
        left: lay.left,
        right: lay.right,
        padding: "18px 22px 24px",
        borderRadius: 4,
        background: "rgba(10, 16, 22, 0.92)",
        border: "1px solid rgba(0, 229, 255, 0.28)",
        boxShadow: "inset 0 0 24px rgba(0, 229, 255, 0.04)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        opacity: cardP,
        transform: `translateY(${28 * (1 - cardP)}px)`,
      }}
    >
      <div
        style={{
          fontSize: lay.titleSize || 28,
          fontWeight: 700,
          letterSpacing: 2,
          color: hudCyan,
          textTransform: "uppercase",
        }}
      >
        Radar Scan
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="雷达扫描">
        {grid.map((points) => (
          <polygon key={points} points={points} fill="none" stroke="rgba(0,229,255,0.15)" strokeWidth={1} />
        ))}
        {axes.map((a, i) => (
          <line key={`ax-${i}`} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke="rgba(0,229,255,0.12)" strokeWidth={1} />
        ))}
        {sweepSector ? <path d={sweepSector} fill={hudCyan} opacity={0.12} /> : null}
        {!sweep.done || sweepOpacity > 0 ? (
          <g opacity={sweepOpacity}>
            <line x1={cx} y1={cy} x2={sweep.x} y2={sweep.y} stroke={hudCyan} strokeWidth={2} strokeLinecap="round" />
            <circle cx={sweep.x} cy={sweep.y} r={4} fill={hudCyan} />
          </g>
        ) : null}
        <polygon
          points={value}
          fill="rgba(0,229,255,0.26)"
          stroke={hudCyan}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {axes.map((a, i) => {
          const lit = locks[i] > 0.5;
          return (
            <circle
              key={`vx-${i}`}
              cx={a.x}
              cy={a.y}
              r={lit ? 5 : 3}
              fill={lit ? vertexLit : "rgba(255,255,255,0.3)"}
            />
          );
        })}
        {labels.map((pt, i) => (
          <text
            key={dims[i].label}
            x={pt.x}
            y={pt.y}
            fill={locks[i] > 0.5 ? "#fff" : "rgba(198,207,230,0.5)"}
            fontSize={Math.max(22, Math.round(size * 0.052))}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {dims[i].label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// 数卡/单指标镜 · 技能树 Stat Ring：居中经验环 + 大数字滚动入场，
// 环按 metricRingFraction 从 0 长到目标占比（给了 max 时按 value/max，否则装饰性扫满一圈）；
// 大数字用 formatCountUp 从 0 滚到目标值，到位时轻微回弹强调。label 在上、caption 在下。
// 游戏化升级（fullspec P0-②）：带 radar.dims 时环外四角属性节点依次点亮 + 「解锁」横幅压轴；
// 无 radar 时即原单环数据卡（fallback）。
function MetricCard({ metric, radar, localTime, lay }) {
  const cardP = enter(localTime, 0.35, 0.5, "power3.out");
  const ringP = enter(localTime, 0.55, 0.8, "power2.out");
  const numP = enter(localTime, 0.55, 0.9, "power1.out");
  const settle = pulse(localTime, 1.45, 0.5, 1.06);

  const size = lay.ring || 360;
  const stroke = Math.round(size * 0.05);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = metricRingFraction(metric, ringP);
  const accent = metric.better === "low" ? "#7ee0c0" : "#ffd166";
  const rollNum = formatCountUp(metric.valueText, metric.value, numP);

  // 四角属性节点（-45° 起 N 等分，几何与 shared/dataviz/geometry.ringNodePoints 对齐）
  const nodes = radar ? radar.dims.slice(0, 4) : [];
  const nodeR = r + stroke + 6;
  const nodePts = nodes.map((_, i) => {
    const deg = -45 + (i * 360) / nodes.length;
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: size / 2 + Math.cos(rad) * nodeR, y: size / 2 + Math.sin(rad) * nodeR };
  });
  const bannerP = enter(localTime, 1.0 + nodes.length * 0.2 + 0.3, 0.5, "power3.out");

  return (
    <div
      style={{
        position: "absolute",
        top: lay.top,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 22,
        opacity: cardP,
        transform: `translateY(${34 * (1 - cardP)}px)`,
      }}
    >
      {metric.label ? (
        <div style={{ fontSize: lay.labelSize || 38, color: "#c6cfe6", fontWeight: 600, letterSpacing: 1.5 }}>
          {metric.label}
        </div>
      ) : null}

      <div style={{ position: "relative", width: size, height: size, transform: `scale(${settle})` }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circ * frac} ${circ}`}
          />
        </svg>
        {nodes.map((d, i) => {
          const litP = enter(localTime, 1.0 + i * 0.2, 0.35, "power3.out");
          const pt = nodePts[i];
          const dotR = Math.max(10, Math.round(size * 0.045));
          return (
            <div
              key={d.label}
              style={{
                position: "absolute",
                left: pt.x,
                top: pt.y,
                transform: `translate(-50%, -50%) scale(${0.4 + 0.6 * litP})`,
                opacity: 0.25 + 0.75 * litP,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: dotR * 2,
                  height: dotR * 2,
                  borderRadius: "50%",
                  background: litP > 0.5 ? "#c77dff" : "rgba(255,255,255,0.14)",
                  border: `2px solid ${litP > 0.5 ? "#fff" : "rgba(255,255,255,0.25)"}`,
                  boxShadow: litP > 0.5 ? "0 0 16px #c77dff" : "none",
                }}
              />
              <span
                style={{
                  fontSize: Math.max(20, Math.round(size * 0.075)),
                  fontWeight: 700,
                  color: litP > 0.5 ? "#fff" : "rgba(198,207,230,0.5)",
                  whiteSpace: "nowrap",
                  textShadow: "0 2px 8px rgba(0,0,0,0.7)",
                }}
              >
                {d.label}
              </span>
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <span style={{ fontSize: lay.valueSize || 132, fontWeight: 800, lineHeight: 1 }}>{rollNum}</span>
          {metric.unit ? (
            <span style={{ fontSize: lay.unitSize || 48, fontWeight: 700, color: accent, marginLeft: 8 }}>{metric.unit}</span>
          ) : null}
        </div>
        {metric.max != null ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: size * 0.18,
              textAlign: "center",
              fontSize: 28,
              color: "#8d97b4",
              fontWeight: 600,
            }}
          >
            / {metric.max}
            {metric.unit}
          </div>
        ) : null}
      </div>

      {metric.caption ? (
        <div
          style={{
            fontSize: lay.captionSize || 38,
            color: "#aeb6cf",
            fontWeight: 500,
            textAlign: "center",
            maxWidth: "82%",
            lineHeight: 1.4,
          }}
        >
          {metric.caption}
        </div>
      ) : null}

      {nodes.length ? (
        <div
          style={{
            padding: "12px 44px",
            borderRadius: 999,
            fontSize: Math.max(26, Math.round(size * 0.09)),
            fontWeight: 800,
            letterSpacing: 2,
            color: "#10131a",
            background: "linear-gradient(90deg, #ffd700, #ffe680)",
            boxShadow: "0 0 28px rgba(255,215,0,0.5)",
            opacity: bannerP,
            transform: `translateY(${26 * (1 - bannerP)}px)`,
          }}
        >
          ⬡ {metric.label || "属性"} · 解锁
        </div>
      ) : null}
    </div>
  );
}

// 擂台 PK：双阵营血条对决，逐回合结算伤害（数据来自 normalizeBattle）。
function ArenaPK({ battle, localTime, lay }) {
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
  );
}

// 拍摄引导 HUD：全屏取景框 + checklist + 步骤进度（教用户怎么拍）。
function ShootGuideHUD({ guide, localTime, formatKey }) {
  const { width: W, height: H } = useVideoConfig();
  const lay = layoutFor(formatKey, "shootGuide");
  const headP = enter(localTime, 0.1, 0.4, "power2.out");
  const frameP = enter(localTime, 0.25, 0.5, "power3.out");
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
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 20 }}>
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
    </AbsoluteFill>
  );
}

// 镜头转场层（scene.transition.in）· P0：speed-line / scan-wipe；P2：glitch-cut / pixel-dissolve / screen-crack / iris-close。
// 与网页预览 transitions.css 的动效语义一致，这里用帧插值实现（确定性逐帧渲染）。
const SPEED_LINES = [
  { top: 0.12, h: 3, delay: 0 },
  { top: 0.26, h: 5, delay: 0.05 },
  { top: 0.43, h: 3, delay: 0.02 },
  { top: 0.58, h: 2, delay: 0.08 },
  { top: 0.74, h: 5, delay: 0.04 },
  { top: 0.88, h: 3, delay: 0.1 },
];

function TransitionLayer({ kind, localTime }) {
  const { width, height } = useVideoConfig();
  if (localTime > 1) return null;

  if (kind === "speed-line") {
    const flash = 1 - enter(localTime, 0, 0.4, "power2.out");
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        {SPEED_LINES.map((line, i) => {
          const p = enter(localTime, line.delay, 0.42, "power2.out");
          if (p >= 1) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: line.top * height,
                left: 0,
                width: width,
                height: line.h,
                borderRadius: line.h,
                background:
                  "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.95) 50%, transparent 90%)",
                transform: `translateX(${(1.1 - 2.3 * p) * width}px)`,
                opacity: 1 - Math.max(0, p - 0.7) / 0.3,
              }}
            />
          );
        })}
        <AbsoluteFill style={{ background: "#fff", opacity: 0.16 * flash }} />
      </AbsoluteFill>
    );
  }

  if (kind === "scan-wipe") {
    const p = enter(localTime, 0, 0.58, "power2.out");
    if (p >= 1) return null;
    const y = (-1 + 2 * p) * height;
    const fade = 1 - Math.max(0, p - 0.85) / 0.15;
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: fade }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: y,
            height: height,
            background:
              "linear-gradient(to bottom, transparent 88%, rgba(0,229,255,0.18) 98%, #00e5ff 100%)",
            filter: "drop-shadow(0 0 18px #00e5ff)",
          }}
        />
      </AbsoluteFill>
    );
  }

  if (kind === "glitch-cut") {
    const p = enter(localTime, 0, 0.22, "power2.out");
    if (p >= 1) return null;
    const shift = 6 * (1 - p);
    const phase = Math.floor(p * 9) % 3;
    const dx = phase === 0 ? -shift : phase === 1 ? shift : -shift * 0.5;
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        <AbsoluteFill style={{ background: "rgba(255,255,255,0.08)", opacity: 1 - p }} />
        <AbsoluteFill
          style={{
            boxShadow: "inset 0 0 0 9999px rgba(8,8,15,0.55)",
            borderLeft: "3px solid #ff2d95",
            borderRight: "3px solid #00e5ff",
            transform: `translateX(${dx}px)`,
            opacity: 1 - p * 0.85,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.04) 2px 3px)",
            transform: `translateY(${(-8 + 16 * p) * height * 0.01}px)`,
            opacity: 0.9 * (1 - p),
          }}
        />
      </AbsoluteFill>
    );
  }

  if (kind === "pixel-dissolve") {
    const p = enter(localTime, 0, 0.72, "steps(8)");
    if (p >= 1) return null;
    const fade = 1 - p;
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "rgba(8,8,15,0.35)",
          opacity: fade,
          transform: `scale(${1 + 0.02 * p})`,
          filter: `contrast(${1.1 + 0.3 * p}) brightness(${1 + 0.2 * p})`,
        }}
      />
    );
  }

  if (kind === "screen-crack") {
    const p = enter(localTime, 0, 0.48, "power2.out");
    if (p >= 1) return null;
    const crackLines = [-72, -36, 0, 36, 72, 108, 144];
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        <AbsoluteFill
          style={{
            background: "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.12) 0%, transparent 42%)",
            opacity: 1 - p * 0.6,
          }}
        />
        {crackLines.map((deg, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "45%",
              width: 2,
              height: `${(40 + (i % 3) * 8) * (0.3 + 0.7 * p)}%`,
              background: "linear-gradient(to bottom, rgba(255,255,255,0.85), transparent)",
              transformOrigin: "50% 0%",
              transform: `translateX(-50%) rotate(${deg}deg)`,
              opacity: 1 - p * 0.5,
            }}
          />
        ))}
      </AbsoluteFill>
    );
  }

  if (kind === "iris-close") {
    const p = enter(localTime, 0, 0.6, "power3.inOut");
    if (p >= 1) return null;
    const radius = Math.max(0, (1 - p) * 120);
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <AbsoluteFill
          style={{
            background: "#000",
            WebkitMaskImage: `radial-gradient(circle at 50% 50%, transparent ${radius}%, black ${radius + 2}%)`,
            maskImage: `radial-gradient(circle at 50% 50%, transparent ${radius}%, black ${radius + 2}%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  return null;
}

function Scene({ scene, formatKey, assetMap }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // 本镜局部时间（秒）

  const assetUrl = scene.asset && assetMap ? assetMap[scene.asset] : null;

  // Ken Burns：整镜缓慢推近 1 → 1.08
  const kb = 1 + 0.08 * Math.min(1, t / Math.max(0.0001, scene.duration));

  const badgeP = enter(t, 0.15, 0.5, "power3.out");
  const titleP = enter(t, 0.25, 0.7, "power3.out");
  const detailP = enter(t, 0.45, 0.6, "power2.out");
  const subP = enter(t, 0.55, 0.5, "power2.out");
  // 卡拉OK逐字点亮：优先用 whisper 逐词对齐时间戳跟着真实语音走；
  // 没有 captions 时回退线性匀速（淡入后 0.7s 起、结束前留 0.35s 收尾、过短至少扫 0.4s）。
  const realK = karaokeFraction(scene.captions, t * 1000);
  const karaokeSpan = Math.max(0.4, scene.duration - 0.35 - 0.7);
  const karaokeP = realK == null ? enter(t, 0.7, karaokeSpan, "linear") : realK;
  const citeP = enter(t, 0.7, 0.5, "power1.out");
  const stockP = enter(t, 0.4, 0.5, "power1.out");

  const titleLay = layoutFor(formatKey, "title", Boolean(scene.compare));
  const detailLay = layoutFor(formatKey, "detail");
  const subLay = layoutFor(formatKey, "subtitle");
  const badgeLay = layoutFor(formatKey, "badge");
  const citeLay = layoutFor(formatKey, "cite");
  const stockLay = layoutFor(formatKey, "stock");
  const metricLay = layoutFor(formatKey, "metric");
  const datavizLay = layoutFor(formatKey, "dataviz");
  const radarHudLay = layoutFor(formatKey, "radarHud");
  const arenaLay = layoutFor(formatKey, "arena");

  return (
    <AbsoluteFill>
      {/* 背景层 */}
      {assetUrl ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img
            src={assetUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transformOrigin: "50% 42%",
              transform: `scale(${kb})`,
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, rgba(91,140,255,0.22), transparent 60%), radial-gradient(120% 80% at 50% 100%, rgba(138,107,255,0.20), transparent 60%), #0b0d12",
          }}
        />
      )}

      {/* 渐变遮罩 */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(6,8,14,0.86) 0%, rgba(6,8,14,0.50) 18%, rgba(6,8,14,0.12) 40%, rgba(6,8,14,0.12) 50%, rgba(6,8,14,0.88) 100%)",
        }}
      />

      {/* 内容层 */}
      <AbsoluteFill style={{ color: "#fff" }}>
        {scene.badge ? (
          <div
            style={{
              position: "absolute",
              top: badgeLay.top,
              left: "50%",
              transform: `translateX(-50%) translateY(${-30 * (1 - badgeP)}px)`,
              opacity: badgeP,
              padding: "14px 34px",
              borderRadius: 999,
              fontSize: badgeLay.fontSize,
              fontWeight: 600,
              letterSpacing: 2,
              color: "#d9e1ff",
              background: "rgba(88,110,255,0.18)",
              border: "1px solid rgba(140,160,255,0.45)",
              whiteSpace: "nowrap",
            }}
          >
            {scene.badge}
          </div>
        ) : null}

        {scene.headline ? (
          <div
            style={{
              position: "absolute",
              top: titleLay.top,
              left: titleLay.left,
              right: titleLay.right,
              fontSize: titleLay.fontSize,
              fontWeight: 800,
              lineHeight: 1.18,
              textAlign: "center",
              textShadow: "0 6px 24px rgba(0,0,0,0.6)",
              opacity: titleP,
              transform: `translateY(${44 * (1 - titleP)}px)`,
            }}
          >
            {formatCountUp(scene.headline, null, titleP)}
          </div>
        ) : null}

        {!scene.battle && !scene.compare && !scene.metric && !scene.dataviz && !scene.radar && scene.detail ? (
          <div
            style={{
              position: "absolute",
              top: detailLay.top,
              left: detailLay.left,
              right: detailLay.right,
              fontSize: detailLay.fontSize,
              fontWeight: 500,
              lineHeight: 1.4,
              textAlign: "center",
              color: "#c6cfe6",
              textShadow: "0 3px 14px rgba(0,0,0,0.6)",
              opacity: detailP,
              transform: `translateY(${26 * (1 - detailP)}px)`,
            }}
          >
            {scene.detail}
          </div>
        ) : null}

        {scene.battle ? (
          <ArenaPK battle={scene.battle} localTime={t} lay={arenaLay} />
        ) : null}

        {!scene.battle && scene.compare ? (
          <CompareMatrix scene={scene} formatKey={formatKey} localTime={t} />
        ) : null}

        {!scene.battle && !scene.compare && scene.metric ? (
          <MetricCard metric={scene.metric} radar={scene.radar} localTime={t} lay={metricLay} />
        ) : null}

        {!scene.battle && !scene.compare && !scene.metric && scene.radar ? (
          <RadarHUD radar={scene.radar} localTime={t} lay={radarHudLay} />
        ) : null}

        {!scene.battle && !scene.compare && !scene.metric && !scene.radar && scene.dataviz ? (
          <DataVizCard viz={scene.dataviz} localTime={t} lay={datavizLay} />
        ) : null}

        {scene.shootGuide ? (
          <ShootGuideHUD guide={scene.shootGuide} localTime={t} formatKey={formatKey} />
        ) : null}

        {scene.subtitle ? (
          <div
            style={{
              position: "absolute",
              left: subLay.left,
              right: subLay.right,
              bottom: subLay.bottom,
              fontSize: subLay.fontSize,
              fontWeight: 600,
              lineHeight: 1.5,
              textAlign: "center",
              textShadow: "0 3px 12px rgba(0,0,0,0.7)",
              opacity: subP,
              transform: `translateY(${20 * (1 - subP)}px)`,
            }}
          >
            <SubtitleKaraoke text={scene.subtitle} progress={karaokeP} />
          </div>
        ) : null}

        {scene.cite ? (
          <div
            style={{
              position: "absolute",
              left: citeLay.left,
              bottom: citeLay.bottom,
              fontSize: citeLay.fontSize,
              fontWeight: 500,
              letterSpacing: 0.5,
              color: "rgba(220,228,245,0.78)",
              padding: "6px 16px",
              borderRadius: 8,
              background: "rgba(8,10,16,0.42)",
              borderLeft: "4px solid rgba(140,160,255,0.7)",
              opacity: citeP,
            }}
          >
            据：{scene.cite}
          </div>
        ) : null}

        {scene.stock ? (
          <div
            style={{
              position: "absolute",
              top: stockLay.top,
              right: stockLay.right,
              fontSize: stockLay.fontSize,
              fontWeight: 500,
              color: "#ffd9a8",
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(180,110,40,0.28)",
              border: "1px solid rgba(255,190,120,0.5)",
              opacity: stockP,
            }}
          >
            素材·示意（待替换）
          </div>
        ) : null}
      </AbsoluteFill>

      {/* 转场层（最顶）：入场动效，~0.6s 内自然消隐 */}
      {scene.transition?.in ? <TransitionLayer kind={scene.transition.in} localTime={t} /> : null}
    </AbsoluteFill>
  );
}

export function ReviewVideo({ timeline, format = "9:16", assetMap = {} }) {
  const { fps } = useVideoConfig();
  const comp = buildComposition(timeline, format);
  const formatKey = comp.format.cls === "fmt-16x9" ? "16:9" : comp.format.cls === "fmt-1x1" ? "1:1" : "9:16";

  return (
    <AbsoluteFill style={{ background: "#0b0d12", fontFamily: FONT_STACK }}>
      {comp.scenes.map((scene) => {
        const from = Math.round(scene.start * fps);
        const dur = Math.max(1, Math.round(scene.duration * fps));
        return (
          <Sequence key={scene.id} from={from} durationInFrames={dur} name={`${scene.index}. ${scene.badge || scene.headline || ""}`}>
            <Scene scene={scene} formatKey={formatKey} assetMap={assetMap} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
