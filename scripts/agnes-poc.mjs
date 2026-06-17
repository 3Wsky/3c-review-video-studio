#!/usr/bin/env node
// Agnes Video V2.0 POC：Flash 扩写 → 创建任务 → 轮询（官方流程）
// 用法：AGNES_PROMPT="产品特写缓慢旋转" node scripts/agnes-poc.mjs
// 图生：AGNES_IMAGE_URL=https://... node scripts/agnes-poc.mjs

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createVideoTask, pollVideoUntilDone } from "../shared/agnes/client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadDevVars() {
  const path = resolve(root, ".dev.vars");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const dev = loadDevVars();
const apiKey = process.env.AGNES_API_KEY || dev.AGNES_API_KEY;
const prompt =
  (process.env.AGNES_PROMPT || "").trim() ||
  process.argv.slice(2).join(" ").trim() ||
  "产品正面特写，缓慢旋转，柔和科技灯光，9:16竖屏空镜";
const imageUrl = process.env.AGNES_IMAGE_URL || "";

if (!apiKey || apiKey === "replace-me") {
  console.error("请配置 AGNES_API_KEY（.dev.vars 或环境变量）");
  process.exit(1);
}

async function main() {
  console.log("Agnes V2.0 创建任务…", { prompt: prompt.slice(0, 80), imageUrl: imageUrl || "(无)" });

  const created = await createVideoTask(
    {
      prompt,
      imageUrl: imageUrl || undefined,
      durationSec: 5,
      format: "9:16",
      expandPrompt: true
    },
    apiKey
  );

  console.log("taskId:", created.taskId);
  console.log("promptUsed:", created.promptUsed?.slice(0, 120) + "…");
  console.log("mode:", created.mode);

  const done = await pollVideoUntilDone(
    created.taskId,
    apiKey,
    Number(process.env.AGNES_POLL_MS) || 600_000,
    8000
  );

  if (done.videoUrl) {
    console.log("\n✅ 视频 URL:\n", done.videoUrl);
    return;
  }

  console.error("未完成", done);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
