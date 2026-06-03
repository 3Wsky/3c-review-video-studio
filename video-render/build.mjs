#!/usr/bin/env node
// Timeline JSON → HyperFrames 合成 HTML 生成器
//
// 把导演台生成的 Timeline JSON（{ project, insights, timeline[] }）转成一份可被
// `hyperframes lint/validate/render` 处理的 9:16 合成 HTML：每个分镜是一段
// `.scene.clip`，按 data-start 顺序平铺，配 GSAP 入场动画（产品图 Ken Burns、
// 标题/字幕淡入）。结构借鉴 Pixelle-Video 分层模板：背景媒体层 + 渐变遮罩 + 内容层。
//
// 用法：
//   node build.mjs --in timeline.json --out index.html [--assets assets]
//
// 设计原则：
//   - 数据驱动 + 缺字段安全降级（无产品图→纯渐变背景；无标题→只渲字幕）。
//   - 确定性：不使用 Date.now()/Math.random()，相同输入产出相同 HTML。
//   - 也导出 buildHtml(timeline, opts) 供渲染 worker 程序化调用。

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

// ---------- 小工具 ----------

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 数值兜底：取正数，否则用默认值
function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// 高亮字幕里的「数字 + 单位」（如 12 小时 / 5000mAh / 1.2kg），纯正则、确定性，
// 让字幕带一点「数据感」。先转义再插入受控的高亮 span。
function highlightNumbers(text) {
  const safe = escapeHtml(text);
  return safe.replace(
    /(\d+(?:\.\d+)?\s*(?:[%‰]|小时|分钟|天|年|倍|档|档位|元|块|克|千克|公斤|kg|g|mm|cm|英寸|寸|mAh|W|GB|TB|MP|Hz|fps|nit|尼特)?)/g,
    '<span class="hl">$1</span>',
  );
}

// 把分镜的 asset 名解析到 assets/ 目录里真实存在的图片；找不到返回 null（降级为纯背景）。
function resolveAsset(assetName, assetsDir) {
  if (!assetName || !assetsDir || !existsSync(assetsDir)) return null;
  const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
  const files = readdirSync(assetsDir).filter((f) => exts.has(extname(f).toLowerCase()));
  if (files.length === 0) return null;
  const base = basename(String(assetName));
  // 1) 精确匹配文件名
  const exact = files.find((f) => f === base || f.toLowerCase() === base.toLowerCase());
  if (exact) return `assets/${exact}`;
  // 2) 占位名（uploaded_product_asset 之类）→ 用目录里第一张图兜底
  return `assets/${files[0]}`;
}

// 解析数值（支持 "12 小时"/"3999元"/"210g" 抽出数字），失败返回 NaN。
function toNumber(value) {
  const m = /-?\d+(?:\.\d+)?/.exec(String(value == null ? "" : value));
  return m ? Number(m[0]) : NaN;
}

// 归一化横评对比数据，并按 better(high/low) 算出每行胜者列下标（并列/无效 → -1）。
function normalizeCompare(raw) {
  if (!raw || !Array.isArray(raw.products) || !Array.isArray(raw.rows)) return null;
  const products = raw.products.map((p) => String(p == null ? "" : p).trim()).filter(Boolean);
  if (products.length < 2) return null;
  const rows = raw.rows
    .map((row) => {
      const values = (Array.isArray(row?.values) ? row.values : []).slice(0, products.length);
      const better = row?.better === "low" ? "low" : "high";
      const nums = values.map(toNumber);
      let winner = -1;
      let bestVal = better === "low" ? Infinity : -Infinity;
      let tie = false;
      nums.forEach((n, idx) => {
        if (!Number.isFinite(n)) return;
        if ((better === "low" && n < bestVal) || (better === "high" && n > bestVal)) {
          bestVal = n;
          winner = idx;
          tie = false;
        } else if (n === bestVal) {
          tie = true;
        }
      });
      if (tie) winner = -1;
      return {
        label: String(row?.label || "").trim(),
        unit: String(row?.unit || "").trim(),
        better,
        values: values.map((v) => String(v == null ? "" : v).trim()),
        winner,
      };
    })
    .filter((r) => r.label && r.values.length === products.length);
  if (rows.length === 0) return null;
  // 综合胜者：哪个产品拿下的「行胜者」最多
  const tally = new Array(products.length).fill(0);
  rows.forEach((r) => {
    if (r.winner >= 0) tally[r.winner] += 1;
  });
  let pick = 0;
  let pickTie = false;
  tally.forEach((c, idx) => {
    if (c > tally[pick]) {
      pick = idx;
      pickTie = false;
    } else if (idx !== pick && c === tally[pick]) {
      pickTie = true;
    }
  });
  return { products, rows, verdict: pickTie ? -1 : pick, tally };
}

// ---------- 核心：构造每镜数据 ----------

function normalizeScenes(timeline, assetsDir) {
  const scenes = Array.isArray(timeline?.timeline) ? timeline.timeline : [];
  let cursor = 0;
  return scenes.map((scene, i) => {
    const duration = num(
      scene?.duration ?? (num(scene?.end, 0) - num(scene?.start, 0)),
      4,
    );
    const start = cursor;
    cursor += duration;
    const visual = scene?.visual || {};
    return {
      id: `scene-${i + 1}`,
      index: i + 1,
      start: Math.round(start * 1000) / 1000,
      duration: Math.round(duration * 1000) / 1000,
      badge: String(scene?.title || "").trim(),
      headline: String(visual.headline || "").trim(),
      detail: String(visual.detail || "").trim(),
      subtitle: String(scene?.subtitle || scene?.voiceover || "").trim(),
      asset: resolveAsset(visual.asset, assetsDir),
      // 事实溯源角标：visual.cite / scene.cite（如「据 官方规格」「实测」）。
      cite: String(visual.cite || scene?.cite || "").trim(),
      // 素材标记：自动空镜（B 的 autoStock）拉的图标「示意·需替换」，尊重实拍优先。
      stock: visual.assetSource === "stock",
      // 横评对比：visual.compare / scene.compare → 渲染对比矩阵（胜者高亮）。
      compare: normalizeCompare(visual.compare || scene?.compare),
    };
  });
}

// ---------- HTML 片段 ----------

// 横评对比矩阵：表头（产品名，综合胜者带皇冠高亮）+ 每行一个维度（胜者格金色）。
function compareMarkup(s) {
  const c = s.compare;
  const cols = c.products.length;
  const headCells = c.products
    .map((p, i) => {
      const win = i === c.verdict;
      return `<div class="cmp-cell cmp-head${win ? " cmp-pick" : ""}">${win ? "👑 " : ""}${escapeHtml(p)}</div>`;
    })
    .join("");
  const rowsHtml = c.rows
    .map((row, r) => {
      const label = row.unit ? `${row.label}<small>（${escapeHtml(row.unit)}）</small>` : escapeHtml(row.label);
      const cells = row.values
        .map((v, i) => {
          const win = i === row.winner;
          return `<div class="cmp-cell cmp-val${win ? " cmp-win" : ""}">${escapeHtml(v)}${win ? '<i class="cmp-tick">✓</i>' : ""}</div>`;
        })
        .join("");
      return `<div id="${s.id}-cmp-r${r}" class="cmp-row" style="grid-template-columns: 1.25fr repeat(${cols}, 1fr)"><div class="cmp-cell cmp-label">${label}</div>${cells}</div>`;
    })
    .join("\n          ");
  return `<div id="${s.id}-cmp" class="compare">
          <div class="cmp-row cmp-headrow" style="grid-template-columns: 1.25fr repeat(${cols}, 1fr)"><div class="cmp-cell cmp-corner">对比</div>${headCells}</div>
          ${rowsHtml}
        </div>`;
}

function sceneMarkup(s) {
  const bg = s.asset
    ? `<div class="bg-layer"><img id="${s.id}-img" src="${escapeHtml(s.asset)}" alt="" /></div>`
    : `<div class="bg-layer bg-fallback"></div>`;
  const badge = s.badge ? `<div id="${s.id}-badge" class="badge">${escapeHtml(s.badge)}</div>` : "";
  const headline = s.headline
    ? `<div id="${s.id}-title" class="title${s.compare ? " title-compact" : ""}">${escapeHtml(s.headline)}</div>`
    : "";
  // 对比镜用矩阵取代中部 detail，避免重叠。
  const detail = !s.compare && s.detail
    ? `<div id="${s.id}-detail" class="detail">${escapeHtml(s.detail)}</div>`
    : "";
  const compare = s.compare ? compareMarkup(s) : "";
  const subtitle = s.subtitle
    ? `<div id="${s.id}-sub" class="subtitle">${highlightNumbers(s.subtitle)}</div>`
    : "";
  const cite = s.cite
    ? `<div id="${s.id}-cite" class="cite">据：${escapeHtml(s.cite)}</div>`
    : "";
  const stockTag = s.stock
    ? `<div id="${s.id}-stock" class="stock-tag">素材·示意（待替换）</div>`
    : "";
  return `      <section
        id="${s.id}"
        class="scene clip"
        data-start="${s.start}"
        data-duration="${s.duration}"
        data-track-index="0"
      >
        ${bg}
        <div class="gradient-overlay"></div>
        <div class="content">
          ${badge}
          ${headline}
          ${detail}
          ${compare}
          ${subtitle}
          ${cite}
          ${stockTag}
        </div>
      </section>`;
}

function sceneTimeline(s) {
  const lines = [];
  const t = s.start;
  if (s.asset) {
    // Ken Burns：整镜缓慢推近
    lines.push(
      `      tl.fromTo("#${s.id}-img", { scale: 1.0 }, { scale: 1.08, duration: ${s.duration}, ease: "none" }, ${t});`,
    );
  }
  if (s.badge) {
    lines.push(
      `      tl.from("#${s.id}-badge", { autoAlpha: 0, y: -30, duration: 0.5, ease: "power3.out" }, ${round(t + 0.15)});`,
    );
  }
  if (s.headline) {
    lines.push(
      `      tl.from("#${s.id}-title", { autoAlpha: 0, y: 44, duration: 0.7, ease: "power3.out" }, ${round(t + 0.25)});`,
    );
  }
  if (s.detail && !s.compare) {
    lines.push(
      `      tl.from("#${s.id}-detail", { autoAlpha: 0, y: 26, duration: 0.6, ease: "power2.out" }, ${round(t + 0.45)});`,
    );
  }
  if (s.subtitle) {
    lines.push(
      `      tl.from("#${s.id}-sub", { autoAlpha: 0, y: 20, duration: 0.5, ease: "power2.out" }, ${round(t + 0.55)});`,
    );
  }
  if (s.compare) {
    // 表头先出，随后各维度行自上而下逐行滑入，胜者格在出现后回弹强调。
    lines.push(
      `      tl.from("#${s.id}-cmp .cmp-headrow", { autoAlpha: 0, y: -24, duration: 0.5, ease: "power2.out" }, ${round(t + 0.3)});`,
    );
    s.compare.rows.forEach((_, r) => {
      lines.push(
        `      tl.from("#${s.id}-cmp-r${r}", { autoAlpha: 0, x: -40, duration: 0.45, ease: "power2.out" }, ${round(t + 0.55 + r * 0.22)});`,
      );
    });
    const after = round(t + 0.7 + s.compare.rows.length * 0.22);
    lines.push(
      `      tl.fromTo("#${s.id}-cmp .cmp-win", { scale: 1 }, { scale: 1.12, duration: 0.28, yoyo: true, repeat: 1, ease: "power1.inOut" }, ${after});`,
    );
    if (s.compare.verdict >= 0) {
      lines.push(
        `      tl.fromTo("#${s.id}-cmp .cmp-pick", { scale: 1 }, { scale: 1.08, duration: 0.32, yoyo: true, repeat: 1, ease: "power1.inOut" }, ${round(after + 0.2)});`,
      );
    }
  }
  if (s.cite) {
    lines.push(
      `      tl.from("#${s.id}-cite", { autoAlpha: 0, duration: 0.5, ease: "power1.out" }, ${round(t + 0.7)});`,
    );
  }
  if (s.stock) {
    lines.push(
      `      tl.from("#${s.id}-stock", { autoAlpha: 0, duration: 0.5, ease: "power1.out" }, ${round(t + 0.4)});`,
    );
  }
  return lines.join("\n");
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// ---------- 组装整页 ----------

export function buildHtml(timeline, opts = {}) {
  const assetsDir = opts.assetsDir || null;
  const scenes = normalizeScenes(timeline, assetsDir);
  if (scenes.length === 0) throw new Error("Timeline 为空：timeline[] 没有分镜");
  const total = round(scenes.reduce((sum, s) => sum + s.duration, 0));
  const product = escapeHtml(timeline?.project?.product || "产品测评");

  const body = scenes.map(sceneMarkup).join("\n\n");
  const tweens = scenes.map(sceneTimeline).filter(Boolean).join("\n");

  return `<!doctype html>
<html lang="zh" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${WIDTH}, height=${HEIGHT}" />
    <!--
      由 build.mjs 从 Timeline JSON 自动生成，请勿手改（改模板请改 build.mjs）。
      产品：${product}
      CJK 字体：HyperFrames 渲染走确定性字体，默认不含中文。Linux worker 需装
      fonts-noto-cjk 或在下方 style 内 @font-face 内嵌 Noto Sans SC，否则中文变方块。
    -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
        background: #0b0d12;
        font-family: "PingFang SC", "Source Han Sans", "Microsoft YaHei",
          "Noto Sans SC", "WenQuanYi Zen Hei", sans-serif;
      }
      .scene { position: absolute; inset: 0; }
      .bg-layer { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
      .bg-layer img { width: 100%; height: 100%; object-fit: cover; transform-origin: 50% 42%; }
      .bg-fallback {
        background:
          radial-gradient(120% 80% at 50% 0%, rgba(91,140,255,0.22), transparent 60%),
          radial-gradient(120% 80% at 50% 100%, rgba(138,107,255,0.20), transparent 60%),
          #0b0d12;
      }
      .gradient-overlay {
        position: absolute; inset: 0; z-index: 1;
        background: linear-gradient(to bottom,
          rgba(6,8,14,0.86) 0%,
          rgba(6,8,14,0.50) 18%,
          rgba(6,8,14,0.12) 40%,
          rgba(6,8,14,0.12) 50%,
          rgba(6,8,14,0.88) 100%);
      }
      .content { position: absolute; inset: 0; z-index: 2; color: #fff; }
      .badge {
        position: absolute; top: 96px; left: 50%; transform: translateX(-50%);
        padding: 14px 34px; border-radius: 999px;
        font-size: 30px; font-weight: 600; letter-spacing: 2px;
        color: #d9e1ff; background: rgba(88,110,255,0.18);
        border: 1px solid rgba(140,160,255,0.45); white-space: nowrap;
      }
      .title {
        position: absolute; top: 196px; left: 80px; right: 80px;
        font-size: 86px; font-weight: 800; line-height: 1.18; text-align: center;
        text-shadow: 0 6px 24px rgba(0,0,0,0.6);
      }
      .detail {
        position: absolute; top: 470px; left: 110px; right: 110px;
        font-size: 44px; font-weight: 500; line-height: 1.4; text-align: center;
        color: #c6cfe6; text-shadow: 0 3px 14px rgba(0,0,0,0.6);
      }
      .subtitle {
        position: absolute; left: 80px; right: 80px; bottom: 150px;
        font-size: 56px; font-weight: 600; line-height: 1.5; text-align: center;
        text-shadow: 0 3px 12px rgba(0,0,0,0.7);
      }
      .subtitle .hl { color: #ffd166; }
      .cite {
        position: absolute; left: 80px; bottom: 96px;
        font-size: 26px; font-weight: 500; letter-spacing: 0.5px;
        color: rgba(220,228,245,0.78);
        padding: 6px 16px; border-radius: 8px;
        background: rgba(8,10,16,0.42);
        border-left: 4px solid rgba(140,160,255,0.7);
      }
      .stock-tag {
        position: absolute; top: 40px; right: 40px;
        font-size: 24px; font-weight: 500;
        color: #ffd9a8; padding: 6px 16px; border-radius: 999px;
        background: rgba(180,110,40,0.28);
        border: 1px solid rgba(255,190,120,0.5);
      }
      .title-compact { top: 150px; font-size: 70px; }
      .compare {
        position: absolute; top: 340px; left: 56px; right: 56px;
        display: flex; flex-direction: column; gap: 12px;
      }
      .cmp-row {
        display: grid; gap: 12px; align-items: stretch;
      }
      .cmp-cell {
        display: flex; align-items: center; justify-content: center;
        padding: 22px 12px; border-radius: 14px;
        font-size: 38px; font-weight: 600; text-align: center;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10);
        min-height: 92px; line-height: 1.2;
      }
      .cmp-headrow .cmp-cell { font-size: 40px; font-weight: 800; padding: 20px 10px; }
      .cmp-corner { color: #aeb6cf; background: rgba(255,255,255,0.03); }
      .cmp-head { color: #dbe3ff; background: rgba(88,110,255,0.20); border-color: rgba(140,160,255,0.45); }
      .cmp-pick { color: #fff; background: rgba(255,190,80,0.28); border-color: rgba(255,205,120,0.85); }
      .cmp-label {
        justify-content: flex-start; text-align: left;
        font-size: 34px; font-weight: 600; color: #c6cfe6;
        background: transparent; border-color: transparent; padding-left: 6px;
      }
      .cmp-label small { font-size: 24px; color: #8d97b4; font-weight: 500; }
      .cmp-val { color: #eef0f6; }
      .cmp-win {
        color: #20231a; background: #ffd166; border-color: #ffd166;
        font-weight: 800; position: relative;
      }
      .cmp-tick {
        position: absolute; top: 6px; right: 12px;
        font-size: 24px; font-style: normal; color: #1a3a1a;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${total}"
      data-width="${WIDTH}"
      data-height="${HEIGHT}"
      data-fps="${FPS}"
    >
${body}
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${tweens}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { in: null, out: "index.html", assets: "assets" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in" || a === "-i") args.in = argv[++i];
    else if (a === "--out" || a === "-o") args.out = argv[++i];
    else if (a === "--assets") args.assets = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in) {
    console.error("用法: node build.mjs --in timeline.json --out index.html [--assets assets]");
    process.exit(1);
  }
  const timeline = JSON.parse(readFileSync(resolve(args.in), "utf8"));
  const assetsDir = args.assets ? resolve(args.assets) : null;
  const html = buildHtml(timeline, { assetsDir });
  writeFileSync(resolve(args.out), html, "utf8");
  const n = Array.isArray(timeline?.timeline) ? timeline.timeline.length : 0;
  console.log(`✓ 已生成 ${args.out}（${n} 个分镜）`);
}

// 仅在作为脚本直接运行时执行（被 import 时不跑）
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
