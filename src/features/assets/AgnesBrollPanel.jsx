import { useEffect, useMemo, useState } from "preact/hooks";
import { Button, Toast } from "../../components/ui/index.js";
import { useDirectorStore } from "../../store/useDirectorStore.js";
import { patchScene } from "../editor/editor-bridge.js";
import {
  buildAgnesPrompt,
  cancelAgnesJob,
  enqueueAgnesBroll,
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

  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const scene = timeline?.timeline?.[currentScene] || null;
  const broll = scene?.visual?.broll;
  const product = timeline?.project?.product || "";

  const activeJob = useMemo(
    () => loadJobs().find((j) => j.sceneIndex === currentScene) || null,
    [currentScene, toast, broll?.status]
  );

  const showToast = (message, tone = "default") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 6000);
  };

  const hooks = {
    onProgress: (msg) => showToast(msg, "default"),
    onDone: () => showToast("空镜已就绪 ✓ 预览舞台已更新", "success"),
    onError: (err) => showToast(err.message || String(err), "warning")
  };

  useEffect(() => {
    if (resumeHooked) return;
    resumeHooked = true;
    resumeAgnesJobs(hooks);
  }, []);

  const imageUrl = useMemo(() => {
    const img = assets.find((a) => a.type?.startsWith("image/") && a.url);
    return img?.url?.startsWith("http") ? img.url : undefined;
  }, [assets]);

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
            userPrompt: scene.visual?.broll?.query
          })
        : "",
    [scene, product, category]
  );

  const handleGenerate = async () => {
    if (!scene || busy) return;
    setLoading(true);
    try {
      const prompt = buildAgnesPrompt({
        product,
        category,
        headline: scene.visual?.headline,
        detail: scene.visual?.detail,
        voiceover: scene.voiceover || scene.subtitle,
        visualType: scene.visual?.type,
        sceneTitle: scene.title,
        userPrompt: scene.visual?.broll?.query
      });

      showToast("已提交 AI 空镜任务，约 3–5 分钟…可继续编辑其他镜", "default");

      await enqueueAgnesBroll(
        { sceneIndex: currentScene, prompt, imageUrl },
        hooks
      );

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
      showToast(err.message || String(err), "warning");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    const id = activeJob?.taskId || broll?.taskId;
    if (!id) return;
    cancelAgnesJob(id);
    patchScene(currentScene, {
      visual: { broll: { ...broll, status: "failed" } }
    });
    showToast("已取消空镜生成", "default");
  };

  const statusLabel = activeJob
    ? "生成中…"
    : broll?.status === "completed"
      ? "已完成"
      : broll?.status === "queued" || broll?.status === "running"
        ? "排队/处理中"
        : null;

  return (
    <div class="agnes-broll-panel">
      <div class="agnes-broll-panel__head">
        <span class="agnes-broll-panel__title">AI 生成空镜（Agnes）</span>
        {statusLabel ? <span class="agnes-broll-panel__status">{statusLabel}</span> : null}
      </div>
      <p class="ce-metric-hint">
        将基于<strong>当前镜口播</strong>生成 5s 竖屏 B-roll，完成后自动填入画面素材。免费期可能排队较久，可刷新页面后续轮询。
      </p>
      {promptPreview ? (
        <p class="agnes-broll-panel__prompt-preview" title={promptPreview}>
          Prompt 预览：{promptPreview.length > 96 ? `${promptPreview.slice(0, 96)}…` : promptPreview}
        </p>
      ) : null}
      <div class="agnes-broll-panel__actions">
        <Button
          type="button"
          variant="primary"
          disabled={!scene || loading || Boolean(activeJob)}
          onClick={handleGenerate}
        >
          {loading || activeJob ? "生成中…" : "AI 生成空镜"}
        </Button>
        {activeJob || broll?.taskId ? (
          <Button type="button" variant="ghost" onClick={handleCancel}>
            取消
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
      {toast ? (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
