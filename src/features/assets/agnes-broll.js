import { directorApi } from "../../legacy/director.js";
import { patchScene } from "../editor/editor-bridge.js";
import { getApiBase } from "../../core/api-client.js";

const STORAGE_KEY = "agnesBrollJobs";
const POLL_MS = 4000;
const MAX_WAIT_MS = 10 * 60 * 1000;

/** @typedef {{ taskId: string; sceneIndex: number; prompt: string; startedAt: number }} AgnesJob */

const activePollers = new Map();

function apiUrl(path) {
  const base = (getApiBase() || "").replace(/\/$/, "");
  return `${base}${path}`;
}

/** @returns {AgnesJob[]} */
export function loadJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { jobs: [] };
    return Array.isArray(data.jobs) ? data.jobs : [];
  } catch {
    return [];
  }
}

/** @param {AgnesJob[]} jobs */
function saveJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobs }));
}

export function buildAgnesPrompt({
  product,
  category,
  headline,
  detail,
  voiceover,
  visualType,
  sceneTitle,
  userPrompt
}) {
  const sceneSummary = buildSceneSummary({ voiceover, detail, headline, sceneTitle });
  const illustrating = sceneSummary
    ? `b-roll illustrating: ${sceneSummary}`
    : "cinematic product showcase";
  const peopleClause =
    visualType && /拍摄|真人|口播|shootGuide/i.test(String(visualType))
      ? ""
      : ", no people unless shootGuide";

  const bits = [
    product || "3C product",
    category || "",
    illustrating,
    headline ? String(headline).trim() : "",
    "cinematic 9:16 vertical",
    "no text" + peopleClause,
    userPrompt ? String(userPrompt).trim() : ""
  ].filter(Boolean);

  return bits.join(", ");
}

/** 口播/详情优先，供 Agnes 生成与当前镜语义一致的空镜 */
function buildSceneSummary({ voiceover, detail, headline, sceneTitle }) {
  const vo = String(voiceover || "").trim();
  const det = String(detail || "").trim();
  if (vo) return vo.slice(0, 160);
  if (det) return det.slice(0, 160);
  const hl = String(headline || "").trim();
  if (hl) return hl.slice(0, 120);
  return String(sceneTitle || "").trim().slice(0, 80);
}

/** @param {Parameters<typeof buildAgnesPrompt>[0]} input */
export function previewAgnesPrompt(input) {
  return buildAgnesPrompt(input);
}

export async function createAgnesTask({ prompt, imageUrl, durationSec = 5, format = "9:16" }) {
  const res = await fetch(apiUrl("/api/agnes-video"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, imageUrl, durationSec, format, poll: false })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `创建任务失败 (${res.status})`);
  if (!data.taskId) throw new Error("Agnes 未返回 taskId");
  return data;
}

export async function pollAgnesTask(taskId) {
  const res = await fetch(apiUrl(`/api/agnes-video?taskId=${encodeURIComponent(taskId)}`));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `查询失败 (${res.status})`);
  return data;
}

/**
 * 写入分镜 broll + 注册远程 MP4 为素材
 * @param {number} sceneIndex
 * @param {{ videoUrl: string; prompt: string; taskId: string }} meta
 */
export function applyAgnesBrollToScene(sceneIndex, { videoUrl, prompt, taskId }) {
  const assetName = `agnes_${String(taskId).slice(-8)}.mp4`;
  directorApi.applyAgnesBroll?.(sceneIndex, {
    assetName,
    videoUrl,
    broll: {
      source: "agnes",
      query: prompt,
      duration: 5,
      taskId,
      status: "completed",
      videoUrl
    }
  });
}

function removeJob(taskId) {
  saveJobs(loadJobs().filter((j) => j.taskId !== taskId));
}

/**
 * @param {AgnesJob} job
 * @param {{ onProgress?: (msg: string) => void; onDone?: () => void; onError?: (err: Error) => void }} hooks
 */
export function startJobPolling(job, hooks = {}) {
  if (activePollers.has(job.taskId)) return;

  const deadline = job.startedAt + MAX_WAIT_MS;
  let stopped = false;

  const stop = () => {
    stopped = true;
    activePollers.delete(job.taskId);
  };
  activePollers.set(job.taskId, stop);

  patchScene(job.sceneIndex, {
    visual: {
      broll: {
        source: "agnes",
        query: job.prompt,
        duration: 5,
        taskId: job.taskId,
        status: "queued"
      }
    }
  });

  const tick = async () => {
    if (stopped) return;
    if (Date.now() > deadline) {
      patchScene(job.sceneIndex, {
        visual: {
          broll: {
            source: "agnes",
            query: job.prompt,
            duration: 5,
            taskId: job.taskId,
            status: "timeout"
          }
        }
      });
      removeJob(job.taskId);
      hooks.onError?.(new Error("轮询超时（10 分钟）"));
      stop();
      return;
    }

    try {
      const data = await pollAgnesTask(job.taskId);
      const status = data.status || "queued";
      hooks.onProgress?.(`Agnes 空镜生成中… (${status})`);

      patchScene(job.sceneIndex, {
        visual: {
          broll: {
            source: "agnes",
            query: job.prompt,
            duration: 5,
            taskId: job.taskId,
            status,
            ...(data.videoUrl ? { videoUrl: data.videoUrl } : {})
          }
        }
      });

      if (status === "completed" && data.videoUrl) {
        applyAgnesBrollToScene(job.sceneIndex, {
          videoUrl: data.videoUrl,
          prompt: job.prompt,
          taskId: job.taskId
        });
        removeJob(job.taskId);
        hooks.onDone?.();
        stop();
        return;
      }

      if (status === "failed") {
        removeJob(job.taskId);
        hooks.onError?.(new Error(data.error || "视频生成失败"));
        stop();
        return;
      }
    } catch (err) {
      hooks.onError?.(err instanceof Error ? err : new Error(String(err)));
    }

    if (!stopped) setTimeout(tick, POLL_MS);
  };

  setTimeout(tick, POLL_MS);
}

/** 启动时恢复未完成 job */
export function resumeAgnesJobs(hooks = {}) {
  for (const job of loadJobs()) {
    if (Date.now() - job.startedAt > MAX_WAIT_MS) {
      removeJob(job.taskId);
      continue;
    }
    startJobPolling(job, hooks);
  }
}

/**
 * 创建任务并持久化 job
 * @param {{ sceneIndex: number; prompt: string; imageUrl?: string }} input
 */
export async function enqueueAgnesBroll(input, hooks = {}) {
  const created = await createAgnesTask({
    prompt: input.prompt,
    imageUrl: input.imageUrl,
    durationSec: 5,
    format: "9:16"
  });

  /** @type {AgnesJob} */
  const job = {
    taskId: created.taskId,
    sceneIndex: input.sceneIndex,
    prompt: input.prompt,
    startedAt: Date.now()
  };

  const jobs = loadJobs().filter((j) => j.sceneIndex !== input.sceneIndex);
  jobs.push(job);
  saveJobs(jobs);

  startJobPolling(job, hooks);
  return job;
}

export function cancelAgnesJob(taskId) {
  const stop = activePollers.get(taskId);
  if (stop) stop();
  removeJob(taskId);
}
