#!/usr/bin/env node
// 渲染 worker（方案 A：一站式）
//
// 跑在你的 GPU 台式机（RTX 5060）上，和克隆音色服务并列。主站点用 RENDER_URL 转发到这里。
// 收到 Timeline JSON + 音色后，自己完成：
//   1) 逐镜调 TTS / 克隆服务合成音频（拿不到就用静音兜底，仍能出片）
//   2) ffprobe 读每镜真实音频时长，校准每镜 data-duration
//   3) build.mjs(buildHtml) 生成合成 HTML
//   4) hyperframes render → 无声视频
//   5) ffmpeg 把逐镜音频按时长拼成声轨并混入 → 返回最终 MP4
//
// 依赖：Node 22+、ffmpeg/ffprobe、npx（拉 hyperframes）。无第三方 npm 依赖（只用内置模块）。
//
// 环境变量：
//   PORT                默认 9234
//   OPENAI_API_KEY      MiMo/OpenAI 兼容 key（逐镜配音用；缺了就静音兜底）
//   OPENAI_BASE_URL     默认 https://api.openai.com/v1
//   OPENAI_TTS_MODEL    默认 mimo-v2.5-tts
//   OPENAI_TTS_VOICE    默认音色
//   VOICE_CLONE_URL     克隆服务地址（voice == clone 时用）
//   HYPERFRAMES_VERSION 默认 hyperframes@0.6.69
//
// 启动：node worker.mjs   （或 bash worker.start.sh）

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHtml } from "./build.mjs";
import { keysFromEnv, pickStockPhotoUrl } from "./stock.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 9234);
const HF = process.env.HYPERFRAMES_VERSION || "hyperframes@0.6.69";
const DEFAULT_TTS_MODEL = "mimo-v2.5-tts";
const DEFAULT_TTS_VOICE = "mimo_default";
const MIN_SCENE = 1.2; // 每镜最短时长（秒），避免太短闪一下
const TAIL_PAD = 0.4; // 配音说完后留的尾音时长（秒）

// ---------- 子进程封装 ----------

function run(cmd, args, opts = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, args, { ...opts });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else rejectRun(new Error(`${cmd} 退出码 ${code}: ${stderr || stdout}`));
    });
  });
}

// 用 ffprobe 读音频时长（秒）
async function probeDuration(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nk=1:nw=1",
    file,
  ]);
  const d = parseFloat(String(stdout).trim());
  return Number.isFinite(d) ? d : 0;
}

// ---------- 逐镜配音 ----------

// 返回 base64 wav，失败返回 null（由调用方静音兜底）
async function synthOne(text, voice, spkId) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  if (voice === "clone") {
    const cloneUrl = String(process.env.VOICE_CLONE_URL || "").trim().replace(/\/$/, "");
    if (!cloneUrl || !spkId) return null;
    const resp = await fetch(`${cloneUrl}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: clean, spk_id: spkId, format: "wav" }),
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok || !payload.audio) return null;
    return payload.audio;
  }
  // MiMo / OpenAI 兼容
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL;
  const v = voice || process.env.OPENAI_TTS_VOICE || DEFAULT_TTS_VOICE;
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "assistant", content: clean }], audio: { format: "wav", voice: v } }),
  });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) return null;
  return payload?.choices?.[0]?.message?.audio?.data || null;
}

// 生成指定时长的静音 wav
async function makeSilence(file, seconds) {
  await run("ffmpeg", [
    "-y", "-f", "lavfi",
    "-i", `anullsrc=channel_layout=mono:sample_rate=24000`,
    "-t", String(Math.max(0.1, seconds)),
    "-c:a", "pcm_s16le", file,
  ]);
}

// 把一段音频精确补/裁到目标时长（不足补静音，超出截断）
async function fitToDuration(src, dst, seconds) {
  await run("ffmpeg", [
    "-y", "-i", src,
    "-af", "apad", "-t", String(seconds),
    "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", dst,
  ]);
}

// ---------- 渲染主流程 ----------

// 缺图自动空镜：给没有 asset 的分镜从免费素材源（Pexels/Pixabay）拉一张图，下载到 assetsDir。
async function fillStockAssets(scenes, assetsDir, timeline, log) {
  const pexelsKeys = keysFromEnv(process.env.PEXELS_API_KEY);
  const pixabayKeys = keysFromEnv(process.env.PIXABAY_API_KEY);
  if (pexelsKeys.length === 0 && pixabayKeys.length === 0) {
    log("autoStock：未配置 PEXELS_API_KEY/PIXABAY_API_KEY，跳过自动空镜");
    return;
  }
  const product = String(timeline?.project?.product || "").trim();
  const category = String(timeline?.project?.category || "").trim();
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const visual = s.visual || (s.visual = {});
    if (String(visual.asset || "").trim()) continue; // 已有素材，不覆盖
    const query =
      String(visual.stockQuery || visual.query || visual.headline || s.title || "").trim() ||
      [product, category].filter(Boolean).join(" ") ||
      "technology gadget";
    try {
      const url = await pickStockPhotoUrl(query, { pexelsKeys, pixabayKeys, orientation: "portrait" });
      if (!url) {
        log(`镜 ${i + 1} autoStock：「${query}」无结果`);
        continue;
      }
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      const m = /\.(png|webp|jpe?g)(\?|$)/i.exec(url);
      let ext = m && m[1] ? m[1].toLowerCase() : "jpg";
      if (ext === "jpeg") ext = "jpg";
      const name = `stock-${i}.${ext}`;
      await writeFile(join(assetsDir, name), buf);
      visual.asset = name;
      visual.assetSource = "stock"; // 标记「素材源/需替换」，尊重实拍优先
      log(`镜 ${i + 1} autoStock：「${query}」→ ${name}（${(buf.length / 1024).toFixed(0)}KB）`);
    } catch (e) {
      log(`镜 ${i + 1} autoStock 失败：${e.message}`);
    }
  }
}

async function renderJob({ timeline, voice, cloneSpkId, gpu, assets, autoStock }, log) {
  const scenes = Array.isArray(timeline?.timeline) ? timeline.timeline : [];
  if (scenes.length === 0) throw new Error("Timeline 为空：timeline[] 没有分镜");

  const work = await mkdtemp(join(tmpdir(), "render-"));
  const audioDir = join(work, "audio");
  const assetsDir = join(work, "assets");
  await mkdir(audioDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });

  // worker 自带的占位素材（产品图等）；请求里带的 assets（base64）覆盖之
  const localAssets = join(__dirname, "assets");
  if (existsSync(localAssets)) await cp(localAssets, assetsDir, { recursive: true });
  if (assets && typeof assets === "object") {
    for (const [name, b64] of Object.entries(assets)) {
      if (typeof b64 === "string" && b64) {
        await writeFile(join(assetsDir, name.replace(/[^\w.\-]/g, "_")), Buffer.from(b64, "base64"));
      }
    }
  }
  await cp(join(__dirname, "hyperframes.json"), join(work, "hyperframes.json"));

  // 1+2) 逐镜配音 + 读真实时长校准
  const sceneAudio = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const text = String(s?.voiceover || s?.subtitle || "").trim();
    const raw = join(audioDir, `raw-${i}.wav`);
    let dur = 0;
    let b64 = null;
    try {
      b64 = await synthOne(text, voice, cloneSpkId);
    } catch (e) {
      log(`镜 ${i + 1} 配音失败，转静音兜底：${e.message}`);
    }
    if (b64) {
      await writeFile(raw, Buffer.from(b64, "base64"));
      dur = await probeDuration(raw);
    }
    // 估时长兜底：原 duration → 字数估算 → MIN_SCENE
    const estimated = num(s?.duration, 0) || estimateByText(text);
    const sceneDur = Math.max(MIN_SCENE, round(b64 ? dur + TAIL_PAD : estimated));
    // 对齐到该镜时长的音频片段（无配音则纯静音）
    const fitted = join(audioDir, `scene-${i}.wav`);
    if (b64) await fitToDuration(raw, fitted, sceneDur);
    else await makeSilence(fitted, sceneDur);
    sceneAudio.push(fitted);
    s.duration = sceneDur; // 写回，供 build.mjs 平铺
    log(`镜 ${i + 1}/${scenes.length}：${b64 ? `配音 ${dur.toFixed(2)}s` : "静音"} → 时长 ${sceneDur}s`);
  }

  // 2.5) 缺图自动空镜（可选，需 PEXELS/PIXABAY key）
  if (autoStock) await fillStockAssets(scenes, assetsDir, timeline, log);

  // 3) 生成合成 HTML
  const html = buildHtml(timeline, { assetsDir });
  await writeFile(join(work, "index.html"), html, "utf8");

  // 4) hyperframes render（无声视频）
  const silent = join(work, "silent.mp4");
  const renderArgs = ["--yes", HF, "render", "-o", silent];
  if (gpu) renderArgs.push("--gpu");
  log("开始 hyperframes render…");
  await run("npx", renderArgs, { cwd: work, env: process.env });

  // 5) 拼接声轨 + 混音
  const soundtrack = join(work, "soundtrack.wav");
  const listFile = join(work, "concat.txt");
  await writeFile(listFile, sceneAudio.map((f) => `file '${f}'`).join("\n"), "utf8");
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", soundtrack]);

  const out = join(work, "out.mp4");
  await run("ffmpeg", [
    "-y", "-i", silent, "-i", soundtrack,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-shortest", out,
  ]);

  const buf = await readFile(out);
  rm(work, { recursive: true, force: true }).catch(() => {});
  return buf;
}

function num(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
}
function round(n) {
  return Math.round(n * 1000) / 1000;
}
// 中文约 4.5 字/秒，给字数估个时长兜底
function estimateByText(text) {
  const chars = String(text || "").replace(/\s/g, "").length;
  return Math.max(MIN_SCENE, round(chars / 4.5 + 0.6));
}

// ---------- HTTP 服务 ----------

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(data);
}

function readBody(req, limit = 64 * 1024 * 1024) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        rejectBody(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", rejectBody);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "render-worker",
      hasLLM: Boolean(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY),
      hasClone: Boolean((process.env.VOICE_CLONE_URL || "").trim()),
      hasStock: Boolean(keysFromEnv(process.env.PEXELS_API_KEY).length || keysFromEnv(process.env.PIXABAY_API_KEY).length),
      hyperframes: HF,
    });
  }
  if (req.method === "POST" && req.url === "/render") {
    try {
      const raw = await readBody(req);
      const input = JSON.parse(raw.toString("utf8"));
      const logs = [];
      const log = (m) => {
        logs.push(m);
        console.log(`[render] ${m}`);
      };
      const mp4 = await renderJob(input, log);
      res.writeHead(200, {
        "content-type": "video/mp4",
        "content-length": mp4.length,
        "content-disposition": 'attachment; filename="render.mp4"',
      });
      return res.end(mp4);
    } catch (error) {
      console.error("[render] 失败:", error);
      return sendJson(res, 500, { error: error.message || "渲染失败" });
    }
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, { allow: "POST, GET, OPTIONS" });
    return res.end();
  }
  return sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`[render-worker] 监听 :${PORT}  (hyperframes=${HF})`);
});
