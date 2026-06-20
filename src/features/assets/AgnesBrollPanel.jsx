import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Button, Field, Textarea } from "../../components/ui/index.js";
import { showAppToast } from "../../core/toast-bus.js";
import { useDirectorStore } from "../../store/useDirectorStore.js";
import { patchScene } from "../editor/editor-bridge.js";
import {
  assetToImageDataUrl,
  buildAgnesPrompt,
  cancelAgnesJob,
  clearSceneAgnesJob,
  enqueueAgnesBroll,
  getSceneAgnesJob,
  isJobPolling,
  loadJobs,
  previewAgnesPrompt,
  resumeAgnesJobs
} from "./agnes-broll.js";

let resumeHooked = false;

export default function AgnesBrollPanel() {
  const timeline = useDirectorStore((s) => s.timeline);
  const currentScene = useDirectorStore((s) => s.currentScene);
  const assets = useDirectorStore((s) => s.assets);
  const category = useDirectorStore((s) => s.category);
  const busy = useDirectorStore((s) => s.busy);

  const [loading, setLoading] = useState(false);
  const [jobTick, setJobTick] = useState(0);
  const panelRef = useRef(null);

  const scene = timeline?.timeline?.[currentScene] || null;
  const broll = scene?.visual?.broll;
  const product = timeline?.project?.product || "";

  const activeJob = useMemo(() => {
    void jobTick;
    return getSceneAgnesJob(currentScene);
  }, [currentScene, jobTick, broll?.status, broll?.taskId]);

  const jobStuck = Boolean(activeJob && !isJobPolling(activeJob.taskId));

  const toast = (message, tone = "default") => showAppToast({ message, tone });

  const hooks = {
    onProgress: (msg) => toast(msg, "default"),
    onDone: () => {
      setJobTick((n) => n + 1);
      toast("空镜已就绪 ✓ 预览舞台已更新", "success");
    },
    onError: (err) => {
      setJobTick((n) => n + 1);
      toast(err.message || String(err), "warning");
    }
  };

  useEffect(() => {
    if (resumeHooked) return;
    resumeHooked = true;
    resumeAgnesJobs(hooks);
  }, []);

  const imageUrl = useMemo(() => {
    const img = assets.find((a) => a.type?.startsWith("image/") && a.url);
    return img?.url && /^https?:\/\//i.test(img.url) ? img.url : undefined;
  }, [assets]);

  const localImageAsset = useMemo(() => {
    const img = assets.find((a) => a.type?.startsWith("image/") && a.url);
    if (!img?.url || /^https?:\/\//i.test(img.url)) return null;
    return img;
  }, [assets]);

  const videoPrompt = scene?.visual?.videoPrompt || "";

  const promptPreview = useMemo(
    () =>
      scene
        ? previewAgnesPrompt({
            product,
            category,
            headline: scene.visual?.headline,
            detail: scene.visual?.detail,
            voiceover: scene.voiceover || scene.subtitle,
            visualType: scene.visual?.type,
            sceneTitle: scene.title,
            videoPrompt: scene.visual?.videoPrompt,
            visual: scene.visual
          })
        : "",
    [scene, product, category, videoPrompt]
  );

  const handleGenerate = async () => {
    if (!scene) {
      toast("请先在时间线选中一个分镜", "warning");
      return;
    }
    if (busy) {
      toast("一键生成进行中，请稍后再试空镜", "warning");
      return;
    }
    if (activeJob && !jobStuck) {
      toast("本镜已有空镜任务在排队，请等待或点「取消」", "default");
      return;
    }
    if (jobStuck) clearSceneAgnesJob(currentScene);

    setLoading(true);
    panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    toast("正在提交 Agnes V2.0…（Flash 扩写 + 图生视频，约 10–30 秒）", "default");

    try {
      const prompt = buildAgnesPrompt({
        product,
        category,
        headline: scene.visual?.headline,
        detail: scene.visual?.detail,
        voiceover: scene.voiceover || scene.subtitle,
        visualType: scene.visual?.type,
        sceneTitle: scene.title,
        videoPrompt: scene.visual?.videoPrompt,
        visual: scene.visual
      });

      let imageDataUrl;
      if (localImageAsset) {
        toast("正在读取产品图（图生视频）…", "default");
        imageDataUrl = await assetToImageDataUrl(localImageAsset);
        if (imageDataUrl && imageDataUrl.length > 2_500_000) {
          toast("产品图过大，已改为纯文生视频（建议压缩图片后重试）", "warning");
          imageDataUrl = undefined;
        }
      }

      await enqueueAgnesBroll(
        { sceneIndex: currentScene, prompt, imageUrl, imageDataUrl },
        hooks
      );

      setJobTick((n) => n + 1);
      toast("任务已提交，排队约 3–6 分钟，可继续编辑其他分镜", "success");

      patchScene(currentScene, {
        visual: {
          broll: {
            source: "agnes",
            query: prompt,
            duration: 5,
            status: "queued"
          }
        }
      });
    } catch (err) {
      toast(err.message || String(err), "warning");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    const id = activeJob?.taskId || broll?.taskId;
    if (!id) return;
    cancelAgnesJob(id);
    clearSceneAgnesJob(currentScene);
    setJobTick((n) => n + 1);
    patchScene(currentScene, {
      visual: { broll: { ...broll, status: "failed" } }
    });
    toast("已取消空镜生成", "default");
  };

  const handleClearStuck = () => {
    clearSceneAgnesJob(currentScene);
    setJobTick((n) => n + 1);
    toast("已清除卡住的任务，可重新生成", "success");
  };

  const statusLabel = loading
    ? "提交中…"
    : activeJob && !jobStuck
      ? "生成中…"
      : broll?.status === "completed"
        ? "已完成"
        : broll?.status === "queued" || broll?.status === "running"
          ? "排队/处理中"
          : jobStuck
            ? "任务卡住"
            : null;

  const buttonDisabled = !scene || loading || (Boolean(activeJob) && !jobStuck);

  return (
    <div class="agnes-broll-panel" ref={panelRef}>
      <div class="agnes-broll-panel__head">
        <span class="agnes-broll-panel__title">AI 空镜（Agnes Video V2.0）</span>
        {statusLabel ? <span class="agnes-broll-panel__status">{statusLabel}</span> : null}
      </div>
      <p class="ce-metric-hint">
        <strong>口播</strong>由 AI 一键生成；<strong>视频提示词</strong>由 AI 按镜单独撰写（与口播分离），你可下方修改后再生成空镜。
        {localImageAsset || imageUrl ? " 已检测到产品图，将走图生视频。" : " 建议上传产品图效果更好。"}
      </p>
      {jobStuck ? (
        <p class="agnes-broll-panel__stuck-hint">
          检测到上次任务未在运行（可能关闭过页面）。请点「清除并重试」。
        </p>
      ) : null}
      <Field label="本镜视频提示词（画面专用，非口播）">
        <Textarea
          rows={3}
          placeholder="一键生成后自动填入；描述镜头画面、运镜与氛围…"
          value={videoPrompt}
          onInput={(e) =>
            patchScene(currentScene, {
              visual: { videoPrompt: e.currentTarget.value }
            })
          }
        />
      </Field>
      {promptPreview ? (
        <p class="agnes-broll-panel__prompt-preview" title={promptPreview}>
          提交 brief（Flash 扩写前）：{promptPreview.length > 96 ? `${promptPreview.slice(0, 96)}…` : promptPreview}
        </p>
      ) : null}
      <div class="agnes-broll-panel__actions">
        <Button
          type="button"
          variant="primary"
          disabled={buttonDisabled}
          onClick={handleGenerate}
        >
          {loading || (activeJob && !jobStuck) ? "生成中…" : "AI 生成空镜"}
        </Button>
        {activeJob || broll?.taskId ? (
          <Button type="button" variant="ghost" onClick={handleCancel}>
            取消
          </Button>
        ) : null}
        {jobStuck ? (
          <Button type="button" variant="ghost" onClick={handleClearStuck}>
            清除并重试
          </Button>
        ) : null}
      </div>
      {broll?.videoUrl ? (
        <p class="asset-tip">
          已绑定远程 MP4：
          <a href={broll.videoUrl} target="_blank" rel="noreferrer">
            查看
          </a>
        </p>
      ) : null}
    </div>
  );
}
