// 逐词对齐字幕：用 whisper.cpp（本地、离线、免费）对配音音频转写，拿到「词/字级时间戳」，
// 供 ReviewVideo 的字幕组件按真实语音节奏逐字点亮。没有音频/转写失败时上层回退到线性匀速版。
//
// 设计要点：转写结果只用作「时间节奏」——把每个 token 的 [fromMs,toMs] 按顺序排好，
// ReviewVideo 据此算出「念到第几个字」的比例，再映射到真正要显示的 subtitle 文本上。
// 这样即便 whisper 转写文字与脚本字幕不完全一致，字幕仍按真实语速/停顿点亮。

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  installWhisperCpp,
  downloadWhisperModel,
  transcribe,
} from "@remotion/install-whisper-cpp";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// whisper.cpp 版本与模型：base 多语言模型对中文够用且体积适中（~148MB）。
export const WHISPER_VERSION = "1.5.5";
export const WHISPER_MODEL = "base";
const WHISPER_DIR = join(__dirname, "whisper.cpp");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 退出码 ${code}: ${err.slice(-300)}`))));
  });
}

// 首次使用时安装 whisper.cpp + 下载模型（幂等：已存在则秒过）。
// 注意：不要预先 mkdir 目标目录，否则 installWhisperCpp 会误判已安装而跳过编译。
export async function ensureWhisper({ log = () => {} } = {}) {
  const inst = await installWhisperCpp({ version: WHISPER_VERSION, to: WHISPER_DIR, printOutput: false });
  if (!inst.alreadyExisted) log(`whisper.cpp ${WHISPER_VERSION} 已安装 → ${WHISPER_DIR}`);
  const dl = await downloadWhisperModel({ model: WHISPER_MODEL, folder: WHISPER_DIR, printOutput: false });
  if (!dl.alreadyExisted) log(`whisper 模型 ${WHISPER_MODEL} 已下载`);
  return WHISPER_DIR;
}

// 把任意音频转成 whisper.cpp 要求的 16kHz 单声道 wav。
async function to16kWav(src, dst) {
  await run("ffmpeg", ["-y", "-i", src, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", dst]);
}

// 转写一段音频 → 有序的 token 级时间戳 [{ text, fromMs, toMs }]（相对该段音频起点）。
// 过滤掉空白/特殊 token；失败抛错由上层兜底。
export async function transcribeToCaptions(audioPath, { language = "zh", log = () => {} } = {}) {
  if (!existsSync(audioPath)) throw new Error(`音频不存在：${audioPath}`);
  await ensureWhisper({ log });
  const wav16 = audioPath.replace(/\.[^.]+$/, "") + ".16k.wav";
  await to16kWav(audioPath, wav16);

  const out = await transcribe({
    inputPath: wav16,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model: WHISPER_MODEL,
    tokenLevelTimestamps: true,
    language,
    printOutput: false,
  });

  const caps = [];
  for (const item of out.transcription || []) {
    for (const tk of item.tokens || []) {
      const text = String(tk.text || "");
      // whisper 的特殊标记形如 [_BEG_] / [_TT_123]，以及纯空白，跳过（不参与点亮节奏）。
      if (!text.trim() || /^\[_.*_\]$|^\[_/.test(text.trim())) continue;
      const fromMs = Number(tk.offsets?.from);
      const toMs = Number(tk.offsets?.to);
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) continue;
      caps.push({ text, fromMs, toMs });
    }
  }
  return caps;
}
