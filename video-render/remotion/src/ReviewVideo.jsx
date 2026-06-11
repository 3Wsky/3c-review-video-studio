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

// 镜头转场层（scene.transition.in）· P0：speed-line / scan-wipe。
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

        {!scene.compare && !scene.metric && scene.detail ? (
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

        {scene.compare ? (
          <CompareMatrix scene={scene} formatKey={formatKey} localTime={t} />
        ) : null}

        {!scene.compare && scene.metric ? (
          <MetricCard metric={scene.metric} radar={scene.radar} localTime={t} lay={metricLay} />
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
