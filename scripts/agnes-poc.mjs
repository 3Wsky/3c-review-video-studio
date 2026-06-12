#!/usr/bin/env node
// Agnes Video POC 验证：读 .dev.vars 或环境变量 AGNES_API_KEY，直连 API 生成短视频。
// 用法：node scripts/agnes-poc.mjs "产品特写缓慢旋转，科技感灯光"
// 可选：AGNES_IMAGE_URL=https://... node scripts/agnes-poc.mjs "..."

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
// Windows 控制台向 argv 传中文可能 GBK 乱码，优先用 AGNES_PROMPT 环境变量传 prompt
const prompt =
  (process.env.AGNES_PROMPT || "").trim() ||
  process.argv.slice(2).join(" ").trim() ||
  "产品正面特写，缓慢旋转，柔和科技灯光，9:16竖屏";
const imageUrl = process.env.AGNES_IMAGE_URL || "";

if (!apiKey || apiKey === "replace-me") {
  console.error("请配置 AGNES_API_KEY（.dev.vars 或环境变量）");
  process.exit(1);
}

const BASE = "https://apihub.agnes-ai.com/v1";

async function main() {
  console.log("创建视频任务…", { prompt: prompt.slice(0, 60) + "…", imageUrl: imageUrl || "(无)" });

  const body = {
    model: "agnes-video-v2.0",
    prompt,
    width: 768,
    height: 1152,
    num_frames: 121,
    frame_rate: 24
  };
  if (imageUrl) body.image = imageUrl;

  const createResp = await fetch(`${BASE}/videos`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const created = await createResp.json().catch(() => ({}));
  if (!createResp.ok) {
    console.error("创建失败", createResp.status, created);
    process.exit(1);
  }

  const taskId = created.id || created.task_id || created.video_id;
  console.log("taskId:", taskId);

  const deadline = Date.now() + (Number(process.env.AGNES_POLL_MS) || 600_000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const pollResp = await fetch(`${BASE}/videos/${encodeURIComponent(taskId)}`, {
      headers: { authorization: `Bearer ${apiKey}` }
    });
    const data = await pollResp.json().catch(() => ({}));
    const status = String(data.status || data.state || "").toLowerCase();
    console.log("status:", status);

    const rawUrl =
      data.video_url || data.url || data.output?.video_url || data.remixed_from_video_id;
    const url = typeof rawUrl === "string" && /^https?:\/\//.test(rawUrl) ? rawUrl : null;
    if (url) {
      console.log("\n✅ 视频 URL:\n", url);
      return;
    }
    if (["failed", "error", "cancelled"].includes(status)) {
      console.error("生成失败", data);
      process.exit(1);
    }
  }
  console.error("轮询超时");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
