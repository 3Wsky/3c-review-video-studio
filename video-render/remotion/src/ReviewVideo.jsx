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
import { buildComposition, highlightTokens } from "./scene-model.mjs";
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

// 数字滚动：把 rawStr 里的数值部分从 0 缓动到目标（target），保留前后缀与小数位；
// 进度 p≥1 时直接还原原始字符串（避免浮点误差/单位丢失）。target 为 null（非数字）→ 原样返回。
function countUp(rawStr, target, p) {
  if (target == null) return rawStr;
  const m = /-?\d+(?:\.\d+)?/.exec(rawStr);
  if (!m) return rawStr;
  if (p >= 1) return rawStr;
  const decimals = (m[0].split(".")[1] || "").length;
  const shown = (target * p).toFixed(decimals);
  return rawStr.slice(0, m.index) + shown + rawStr.slice(m.index + m[0].length);
}

// 卡拉OK字幕：随本镜进度逐字「点亮」（未念到的字压暗、已念到的全亮、光标处一字宽平滑过渡）。
// progress ∈ [0,1] 是本镜「念到第几个字」的比例（时间正比，不依赖音频）。数字仍保持金色高亮。
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
                  {hasNum ? countUp(v, nums[i], barP) : v}
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
  // 卡拉OK逐字点亮：淡入后开始（0.7s），到本镜结束前留 0.35s 收尾；时长过短则至少扫 0.4s。线性匀速。
  const karaokeSpan = Math.max(0.4, scene.duration - 0.35 - 0.7);
  const karaokeP = enter(t, 0.7, karaokeSpan, "linear");
  const citeP = enter(t, 0.7, 0.5, "power1.out");
  const stockP = enter(t, 0.4, 0.5, "power1.out");

  const titleLay = layoutFor(formatKey, "title", Boolean(scene.compare));
  const detailLay = layoutFor(formatKey, "detail");
  const subLay = layoutFor(formatKey, "subtitle");
  const badgeLay = layoutFor(formatKey, "badge");
  const citeLay = layoutFor(formatKey, "cite");
  const stockLay = layoutFor(formatKey, "stock");

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
            {scene.headline}
          </div>
        ) : null}

        {!scene.compare && scene.detail ? (
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
