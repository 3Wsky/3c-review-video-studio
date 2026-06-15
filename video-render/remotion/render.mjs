#!/usr/bin/env node
// Remotion 程序化渲染入口（与 HyperFrames 那套 worker 流程并存的另一套渲染引擎）。
//
// 用法：
//   node render.mjs --in timeline.json --out out.mp4 [--format 9:16|16:9|1:1] [--assets <dir>] [--concurrency N]
//
// 做的事：
//   1) 读 Timeline JSON
//   2) 把 --assets 目录里的图片编码成 data URL，按「素材名 -> URL」建 assetMap
//      （素材名精确匹配文件，否则用目录里第一张图兜底；和 build.mjs.resolveAsset 行为一致）
//   3) bundle 本项目 → selectComposition(ReviewVideo) → renderMedia 出 MP4
//
// 产出的是「无声视频」：音频仍由外层 worker（逐镜 TTS + ffmpeg 混音）负责，
// 这样换引擎只换画面渲染，配音/时长校准/R2 等流程完全不变。

import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { entryIsVideo } from "../../shared/asset-kind.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

function parseArgs(argv) {
  const args = { in: null, out: "out.mp4", format: "9:16", assets: null, concurrency: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in" || a === "-i") args.in = argv[++i];
    else if (a === "--out" || a === "-o") args.out = argv[++i];
    else if (a === "--format" || a === "-f") args.format = argv[++i];
    else if (a === "--assets") args.assets = argv[++i];
    else if (a === "--concurrency") args.concurrency = Number(argv[++i]) || null;
  }
  return args;
}

function fileToDataUrl(file) {
  const ext = extname(file).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const b64 = readFileSync(file).toString("base64");
  return `data:${mime};base64,${b64}`;
}

// 扫 assets 目录，把 timeline 里引用到的素材名解析成 URL（图片 data URL / 视频 file URL）。
// 返回 { assetMap, assetKinds }，assetKinds[name] = "video" | "image"。
function buildAssetMap(timeline, assetsDir) {
  const assetMap = {};
  const assetKinds = {};
  if (!assetsDir || !existsSync(assetsDir)) return { assetMap, assetKinds };

  const allFiles = readdirSync(assetsDir);
  const images = allFiles.filter((f) => IMG_EXTS.has(extname(f).toLowerCase()));
  const videos = allFiles.filter((f) => VIDEO_EXTS.has(extname(f).toLowerCase()));
  if (images.length === 0 && videos.length === 0) return { assetMap, assetKinds };

  const imgFallback = images[0] || null;
  const vidFallback = videos[0] || null;
  const scenes = Array.isArray(timeline?.timeline) ? timeline.timeline : [];
  const names = new Set();
  for (const s of scenes) {
    const name = String(s?.visual?.asset || "").trim();
    if (name) names.add(name);
  }

  const matchFile = (files, ref) => {
    const base = basename(ref);
    const stem = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base;
    return files.find((f) => {
      const fb = basename(f);
      const fs = fb.includes(".") ? fb.slice(0, fb.lastIndexOf(".")) : fb;
      return (
        fb === base ||
        fb.toLowerCase() === base.toLowerCase() ||
        fs === base ||
        fs.toLowerCase() === base.toLowerCase() ||
        fs === stem ||
        fs.toLowerCase() === stem.toLowerCase()
      );
    });
  };

  for (const name of names) {
    const base = basename(name);
    const vidExact = matchFile(videos, base);
    const imgExact = matchFile(images, base);
    const brollUrl = scenes.find((s) => String(s?.visual?.asset || "").trim() === name)?.visual?.broll?.videoUrl;

    if (vidExact || entryIsVideo({ url: brollUrl })) {
      const pick = vidExact || vidFallback;
      if (pick) {
        assetMap[name] = pathToFileURL(join(assetsDir, pick)).href;
        assetKinds[name] = "video";
      }
      continue;
    }

    const pick = imgExact || imgFallback;
    if (pick) {
      assetMap[name] = fileToDataUrl(join(assetsDir, pick));
      assetKinds[name] = "image";
    }
  }

  return { assetMap, assetKinds };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in) {
    console.error(
      "用法: node render.mjs --in timeline.json --out out.mp4 [--format 9:16|16:9|1:1] [--assets <dir>] [--concurrency N]",
    );
    process.exit(1);
  }
  const timeline = JSON.parse(readFileSync(resolve(args.in), "utf8"));
  const { assetMap, assetKinds } = buildAssetMap(timeline, args.assets ? resolve(args.assets) : null);

  const entry = join(__dirname, "src", "index.jsx");
  console.log("[remotion] bundling…");
  const serveUrl = await bundle({
    entryPoint: entry,
    // 静态站不需要 webpack override；保持默认
  });

  const inputProps = { timeline, format: args.format, assetMap, assetKinds };
  console.log("[remotion] selecting composition…");
  const composition = await selectComposition({
    serveUrl,
    id: "ReviewVideo",
    inputProps,
  });

  console.log(
    `[remotion] render ${composition.width}x${composition.height} @${composition.fps}fps, ${composition.durationInFrames} frames → ${args.out}`,
  );
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: resolve(args.out),
    inputProps,
    concurrency: args.concurrency || null,
    chromiumOptions: { gl: "angle" },
    onProgress: ({ progress }) => {
      process.stdout.write(`\r[remotion] ${(progress * 100).toFixed(1)}%   `);
    },
  });
  process.stdout.write("\n");
  console.log(`[remotion] ✓ 完成 ${args.out}`);
}

main().catch((err) => {
  console.error("[remotion] 渲染失败:", err);
  process.exit(1);
});
