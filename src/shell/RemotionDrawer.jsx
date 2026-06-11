export default function RemotionDrawer() {
  return (
    <aside class="remotion-drawer" id="remotionModal" hidden aria-label="Remotion 实时预览">
      <div class="remotion-dialog">
        <div class="remotion-modal-head">
          <div class="remotion-modal-title">
            <i data-lucide="play-circle" />
            <span>实时预览 · Remotion</span>
            <small id="remotionFormatNote" />
          </div>
          <button class="square-button" id="remotionCloseBtn" type="button" title="关闭预览">
            <i data-lucide="x" />
          </button>
        </div>
        <div class="remotion-stage" id="remotionPlayerHost">
          <div class="remotion-loading" id="remotionLoading">
            正在加载预览引擎…
          </div>
        </div>
        <p class="remotion-modal-tip">
          和「渲染视频」用同一套 Remotion 模板，左侧改文案/时长/排序即时刷新，不用跑后端。
        </p>
      </div>
    </aside>
  );
}
