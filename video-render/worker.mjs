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
import { mkdtemp, mkdir, writeFile, readFile, readdir, cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildHtml, buildXiaohongshuCaption, resolveFormat } from "./build.mjs";
import { keysFromEnv, pickStockPhotoUrl } from "./stock.mjs";
import { r2ConfigFromEnv, uploadToR2 } from "./r2.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 9234);
const HF = process.env.HYPERFRAMES_VERSION || "hyperframes@0.6.69";
// 渲染引擎：hyperframes（默认）或 remotion（React 出片，需先在 video-render/remotion 里 npm install）。
const REMOTION_RENDER = join(__dirname, "remotion", "render.mjs");
const VALID_ENGINES = new Set(["hyperframes", "remotion"]);
const DEFAULT_TTS_MODEL = "mimo-v2.5-tts";
const DEFAULT_TTS_VOICE = "mimo_default";
const MIN_SCENE = 1.2; // 每镜最短时长（秒），避免太短闪一下
const TAIL_PAD = 0.4; // 配音说完后留的尾音时长（秒）
// 逐词对齐字幕：用 whisper 转写每镜配音拿到词级时间戳（仅 Remotion 引擎消费）。WHISPER_CAPTIONS=0 可关。
const WHISPER_CAPTIONS = process.env.WHISPER_CAPTIONS !== "0";
const REMOTION_WHISPER = join(__dirname, "remotion", "whisper.mjs");
let _whisperMod = null;
async function transcribeScene(rawWav, log) {
  try {
    if (!_whisperMod) _whisperMod = await import(pathToFileURL(REMOTION_WHISPER).href);
    return await _whisperMod.transcribeToCaptions(rawWav, { log });
  } catch (e) {
    log(`逐词对齐失败（回退线性字幕）：${e.message}`);
    return null;
  }
}

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

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v"]);

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function videoFileName(assetName, url) {
  const base = basename(String(assetName || "remote.mp4").replace(/[^\w.\-]/g, "_"));
  if (VIDEO_EXTS.has(extname(base).toLowerCase())) return base;
  const fromUrl = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.exec(String(url || ""));
  const ext = fromUrl ? `.${fromUrl[1].toLowerCase()}` : ".mp4";
  return base.includes(".") ? base : `${base}${ext}`;
}

// 下载远程 MP4（Agnes B-roll 等）到 assetsDir，供 Remotion / HyperFrames 本地引用。
async function fillRemoteVideoAssets(scenes, assetsDir, remoteAssets, log) {
  const jobs = [];
  const seen = new Set();

  const queue = (assetName, url) => {
    const name = String(assetName || "").trim();
    const href = String(url || "").trim();
    if (!name || !isRemoteUrl(href)) return;
    const key = `${name}\0${href}`;
    if (seen.has(key)) return;
    seen.add(key);
    jobs.push({ assetName: name, url: href });
  };

  if (remoteAssets && typeof remoteAssets === "object") {
    for (const [name, meta] of Object.entries(remoteAssets)) {
      const url = typeof meta === "string" ? meta : meta?.url;
      queue(name, url);
    }
  }

  for (const s of scenes) {
    const visual = s.visual || {};
    if (visual.asset) queue(visual.asset, visual.broll?.videoUrl);
    else if (visual.broll?.videoUrl) queue(`agnes_${visual.broll.taskId || "broll"}.mp4`, visual.broll.videoUrl);
  }

  for (const job of jobs) {
    const fileName = videoFileName(job.assetName, job.url);
    const dest = join(assetsDir, fileName);
    if (existsSync(dest)) {
      log(`远程空镜已缓存：${fileName}`);
      continue;
    }
    try {
      log(`下载远程空镜：${fileName} …`);
      const resp = await fetch(job.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      await writeFile(dest, buf);
      log(`远程空镜就绪：${fileName}（${(buf.length / 1024).toFixed(0)}KB）`);
    } catch (e) {
      log(`远程空镜下载失败 ${fileName}：${e.message}`);
    }
  }
}

// 用 HyperFrames 渲染无声视频：buildHtml → npx hyperframes render。
async function renderSilentHyperframes({ work, timeline, assetsDir, format, gpu }, log) {
  const html = buildHtml(timeline, { assetsDir, format });
  await writeFile(join(work, "index.html"), html, "utf8");
  await cp(join(__dirname, "hyperframes.json"), join(work, "hyperframes.json"));
  const silent = join(work, "silent.mp4");
  const renderArgs = ["--yes", HF, "render", "-o", silent];
  if (gpu) renderArgs.push("--gpu");
  log("开始 hyperframes render…");
  await run("npx", renderArgs, { cwd: work, env: process.env });
  return silent;
}

// 用 Remotion 渲染无声视频：把 timeline 落盘 → node remotion/render.mjs（React 合成出片）。
// 音频仍交给外层（逐镜 TTS + ffmpeg 混音），所以这里只出画面。
async function renderSilentRemotion({ work, timeline, assetsDir, format }, log) {
  if (!existsSync(REMOTION_RENDER)) {
    throw new Error("Remotion 渲染脚本不存在（video-render/remotion/render.mjs）");
  }
  if (!existsSync(join(__dirname, "remotion", "node_modules"))) {
    throw new Error("Remotion 依赖未安装：请先在 video-render/remotion 里执行 npm install");
  }
  const tlFile = join(work, "timeline.json");
  await writeFile(tlFile, JSON.stringify(timeline), "utf8");
  const silent = join(work, "silent.mp4");
  log("开始 remotion render…");
  await run(
    "node",
    [REMOTION_RENDER, "--in", tlFile, "--out", silent, "--format", format || "9:16", "--assets", assetsDir],
    { cwd: join(__dirname, "remotion"), env: process.env },
  );
  return silent;
}

async function renderJob({ timeline, voice, cloneSpkId, gpu, assets, remoteAssets, autoStock, format, engine }, log) {
  const scenes = Array.isArray(timeline?.timeline) ? timeline.timeline : [];
  if (scenes.length === 0) throw new Error("Timeline 为空：timeline[] 没有分镜");
  const eng = VALID_ENGINES.has(String(engine || "").trim()) ? String(engine).trim() : "hyperframes";

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
      // 逐词对齐：转写真实配音拿到词级时间戳，写回该镜（相对镜起点），供 Remotion 字幕跟读点亮。
      if (eng === "remotion" && WHISPER_CAPTIONS && text) {
        const caps = await transcribeScene(raw, log);
        if (caps && caps.length) {
          s.captions = caps;
          log(`镜 ${i + 1}：逐词对齐 ${caps.length} 个 token`);
        }
      }
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

  // 2.6) Agnes / 远程 MP4 空镜（预览端写入 broll.videoUrl 或 remoteAssets）
  await fillRemoteVideoAssets(scenes, assetsDir, remoteAssets, log);

  // 3+4) 按引擎渲染无声视频（按请求画幅：9:16 / 16:9 / 1:1）
  log(`渲染引擎：${eng}`);
  const silent =
    eng === "remotion"
      ? await renderSilentRemotion({ work, timeline, assetsDir, format }, log)
      : await renderSilentHyperframes({ work, timeline, assetsDir, format, gpu }, log);

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

// 多端裁剪之「封面 + 小红书图文版」：不做视频编码，只用 hyperframes snapshot 抽静帧 + 文案。
// 比出片快得多、不吃 GPU。返回封面 PNG + 每镜配图 PNG + 小红书文案（标题/正文/标签）。
async function posterJob({ timeline, assets, autoStock, format, frames }, log) {
  const scenes = Array.isArray(timeline?.timeline) ? timeline.timeline : [];
  if (scenes.length === 0) throw new Error("Timeline 为空：timeline[] 没有分镜");

  const fmt = resolveFormat(format || "1:1");
  const work = await mkdtemp(join(tmpdir(), "poster-"));
  const assetsDir = join(work, "assets");
  await mkdir(assetsDir, { recursive: true });
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

  // 没有真实音频，给每镜估个时长，使 snapshot 能 seek 到对应镜
  let t = 0;
  const mids = [];
  for (const s of scenes) {
    const text = String(s?.voiceover || s?.subtitle || "").trim();
    const dur = num(s?.duration, 0) || estimateByText(text);
    s.duration = round(dur);
    mids.push(round(t + dur / 2));
    t += dur;
  }
  // 抽帧数量上限（默认每镜一帧，封面取第 1 帧）
  const cap = Math.max(1, Math.min(Number(frames) || scenes.length, 12));
  const ats = mids.slice(0, cap);

  if (autoStock) await fillStockAssets(scenes, assetsDir, timeline, log);

  const html = buildHtml(timeline, { assetsDir, format: format || "1:1" });
  await writeFile(join(work, "index.html"), html, "utf8");

  log(`抽帧 ${ats.length} 张（${fmt.cls} ${fmt.w}×${fmt.h}）：${ats.join(", ")}s`);
  const snapArgs = ["--yes", HF, "snapshot", "--at", ats.join(","), "--describe", "false"];
  await run("npx", snapArgs, { cwd: work, env: process.env });

  const snapDir = join(work, "snapshots");
  const files = (await readdir(snapDir))
    .filter((f) => f.endsWith(".png"))
    .sort();
  const images = [];
  for (const f of files) {
    images.push({ name: f, buf: await readFile(join(snapDir, f)) });
  }
  const caption = buildXiaohongshuCaption(timeline);

  rm(work, { recursive: true, force: true }).catch(() => {});
  return { images, caption, format: fmt };
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

// R2 object key 用的安全文件名（保留中英文数字，其余转 -）。
function safeFileBase(title) {
  const t = String(title || "3c-review").trim().replace(/[^\w\u4e00-\u9fa5.-]+/g, "-").replace(/^-+|-+$/g, "");
  return (t || "3c-review").slice(0, 48);
}
// renders/<时间戳>-<随机> 前缀，避免重名覆盖。
function dateKey() {
  const d = new Date().toISOString().replace(/[:T]/g, "-").replace(/\..+/, "");
  return `${d}-${Math.random().toString(36).slice(2, 8)}`;
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
      hasR2: Boolean(r2ConfigFromEnv()),
      hyperframes: HF,
      // 可用渲染引擎：hyperframes 始终在；remotion 需在 video-render/remotion 装好依赖。
      engines: ["hyperframes", ...(existsSync(join(__dirname, "remotion", "node_modules")) ? ["remotion"] : [])],
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

      // 配了 R2 凭证就上传，返回可分享 URL（JSON）；否则/失败则直接回传 MP4 二进制（老路）。
      const r2cfg = r2ConfigFromEnv();
      if (r2cfg) {
        try {
          const base = safeFileBase(input?.timeline?.project?.title);
          const ftag = resolveFormat(input?.format).cls;
          const key = `renders/${dateKey()}-${base}-${ftag}.mp4`;
          const uploaded = await uploadToR2(mp4, key, "video/mp4", r2cfg);
          log(`R2 上传成功：${uploaded.url}${uploaded.public ? "" : "（私有 bucket，需配 R2_PUBLIC_BASE 才能公网播放）"}`);
          return sendJson(res, 200, {
            ok: true,
            url: uploaded.url,
            key: uploaded.key,
            public: uploaded.public,
            bytes: mp4.length,
            logs,
          });
        } catch (e) {
          log(`R2 上传失败，回退为直接下载：${e.message}`);
        }
      }

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
  // 多端裁剪：封面图 + 小红书图文版（抽静帧 + 文案，不出视频）
  if (req.method === "POST" && req.url === "/poster") {
    try {
      const raw = await readBody(req);
      const input = JSON.parse(raw.toString("utf8"));
      const logs = [];
      const log = (m) => {
        logs.push(m);
        console.log(`[poster] ${m}`);
      };
      const { images, caption, format } = await posterJob(input, log);

      // 配了 R2：上传每张图，返回 URL；否则把图（不大）内联成 data URL 一起返回。
      const r2cfg = r2ConfigFromEnv();
      const base = safeFileBase(input?.timeline?.project?.title);
      const prefix = `posters/${dateKey()}-${base}`;
      const out = [];
      for (let i = 0; i < images.length; i++) {
        const im = images[i];
        if (r2cfg) {
          try {
            const up = await uploadToR2(im.buf, `${prefix}-${String(i).padStart(2, "0")}.png`, "image/png", r2cfg);
            out.push({ url: up.url, public: up.public, bytes: im.buf.length });
            continue;
          } catch (e) {
            log(`图 ${i} R2 上传失败，内联兜底：${e.message}`);
          }
        }
        out.push({ dataUrl: `data:image/png;base64,${im.buf.toString("base64")}`, bytes: im.buf.length });
      }
      return sendJson(res, 200, {
        ok: true,
        format: `${format.w}x${format.h}`,
        cover: out[0] || null,
        images: out,
        caption, // { title, body, tags, text }
        hosted: Boolean(r2cfg),
        logs,
      });
    } catch (error) {
      console.error("[poster] 失败:", error);
      return sendJson(res, 500, { error: error.message || "图文导出失败" });
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
