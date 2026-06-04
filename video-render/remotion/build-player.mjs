#!/usr/bin/env node
// 把网页 <Player> 预览打成单文件 IIFE，供纯静态导演台（无构建步骤）直接 <script> 加载。
// 产物提交进仓库：../../assets/remotion-player.js（Cloudflare Pages 按静态资源服务）。
//
// 重新生成：cd video-render/remotion && npm run build:player

import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outfile = join(__dirname, "..", "..", "assets", "remotion-player.js");

await build({
  entryPoints: [join(__dirname, "player-entry.jsx")],
  outfile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  loader: { ".js": "jsx", ".mjs": "jsx", ".json": "json" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

console.log(`✓ 已生成 ${outfile}`);
