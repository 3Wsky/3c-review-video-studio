export default function ConsoleSection() {
  return (
    <section class="console panel" id="console-section">
      <div class="console-toolbar">
        <div class="metrics">
          <div>
            <strong id="sceneCount">6</strong>
            <span>分镜</span>
          </div>
          <div>
            <strong id="durationCount">90s</strong>
            <span>总时长</span>
          </div>
          <div>
            <strong id="sourceCount">4</strong>
            <span>观点来源</span>
          </div>
        </div>
        <div class="toolbar-actions">
          <button class="icon-button" id="regenerateBtn" type="button" title="用当前素材重新生成">
            <i data-lucide="refresh-cw" />
            <span>重新生成</span>
          </button>
          <button class="icon-button" id="addSceneBtn" type="button" title="在当前镜头后新增">
            <i data-lucide="plus" />
            <span>加镜头</span>
          </button>
          <button
            class="icon-button checkup-btn"
            id="checkupBtn"
            type="button"
            title="给脚本打留人分，标出弱钩子/拖节奏并给建议"
          >
            <i data-lucide="stethoscope" />
            <span>留人体检</span>
          </button>
          <button
            class="icon-button gate-btn"
            id="gateBtn"
            type="button"
            title="出片前质检：留人分 + 事实溯源 + 反洗稿，不达标会拦下"
          >
            <i data-lucide="shield-check" />
            <span>质检闸门</span>
          </button>
          <button class="icon-button" id="copyPromptBtn" type="button" title="复制 3C Prompt">
            <i data-lucide="clipboard-copy" />
            <span>Prompt</span>
          </button>
          <button class="icon-button" id="downloadJsonBtn" type="button">
            <i data-lucide="download" />
            <span>JSON</span>
          </button>
          <div class="export-menu" id="exportMenu">
            <button
              class="icon-button"
              id="exportToggle"
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              title="导出口播稿 / 字幕 / 分镜表"
            >
              <i data-lucide="file-down" />
              <span>导出</span>
              <i data-lucide="chevron-down" />
            </button>
            <div class="export-dropdown" id="exportDropdown" role="menu">
              <button class="export-item" id="exportScriptBtn" type="button" role="menuitem">
                口播稿 .txt
              </button>
              <button class="export-item" id="exportSrtBtn" type="button" role="menuitem">
                字幕 .srt
              </button>
              <button class="export-item" id="exportShotlistBtn" type="button" role="menuitem">
                分镜表 .csv
              </button>
              <button class="export-item" id="downloadBriefBtn" type="button" role="menuitem">
                方案 .md
              </button>
            </div>
          </div>
          <div class="render-group">
            <select id="renderFormat" class="render-format" title="多端裁剪：选输出画幅">
              <option value="9:16">9:16 竖屏（抖音/快手）</option>
              <option value="16:9">16:9 横屏（B站/PC）</option>
              <option value="1:1">1:1 方图</option>
            </select>
            <button
              class="icon-button render-btn"
              id="renderVideoBtn"
              type="button"
              title="把当前分镜渲染成 MP4（需配置渲染 worker RENDER_URL）"
            >
              <i data-lucide="clapperboard" />
              <span>渲染视频</span>
            </button>
            <button
              class="icon-button"
              id="remotionPreviewBtn"
              type="button"
              title="用 Remotion Player 在网页内实时预览当前分镜（无需后端渲染）"
            >
              <i data-lucide="play-circle" />
              <span>实时预览</span>
            </button>
          </div>
          <button
            class="icon-button"
            id="exportPosterBtn"
            type="button"
            title="一次产出封面图 + 小红书图文版（抽静帧 + 文案，不出视频，很快）"
          >
            <i data-lucide="image" />
            <span>图文/封面</span>
          </button>
          <button class="icon-button" id="resetBtn" type="button" title="清空草稿，重新开始">
            <i data-lucide="rotate-ccw" />
            <span>重置</span>
          </button>
        </div>
      </div>

      <div class="track-wrap">
        <div class="track-ruler" id="trackRuler" />
        <div class="track" id="track" />
        <p class="track-tip">拖动卡片可调整顺序 · 点击卡片在下方编辑 · 时长按比例显示</p>
      </div>

      <div class="editor-row">
        <aside class="preview-col">
          <div class="scene-nav">
            <button class="square-button" id="prevSceneBtn" type="button" title="上一镜">
              <i data-lucide="chevron-left" />
            </button>
            <span id="sceneIndicator">1 / 6</span>
            <button class="square-button" id="nextSceneBtn" type="button" title="下一镜">
              <i data-lucide="chevron-right" />
            </button>
          </div>
          <div class="phone-frame">
            <div class="video-stage" id="videoStage">
              <div class="stage-topline">
                <span id="stageProduct">3C 产品</span>
                <span id="stageTime">00:00</span>
              </div>
              <div class="product-visual" id="productVisual">
                <div class="device-placeholder">
                  <span />
                </div>
              </div>
              <div class="host-slot center" id="hostSlot">
                <div class="host-head" />
                <div class="host-body" />
              </div>
              <div class="info-card" id="infoCard">
                <small id="visualType">结论</small>
                <strong id="visualHeadline">先看结论</strong>
                <span id="visualDetail">最大优点与最大限制</span>
              </div>
              <div class="subtitle-bar" id="subtitleBar" />
            </div>
          </div>
        </aside>
        <section class="clip-editor" id="clipEditor" />
      </div>

      <details class="sources">
        <summary>
          <i data-lucide="book-open" />
          知乎来源与素材
        </summary>
        <div class="sources-body">
          <div class="zhihu-search">
            <label class="textarea-label">
              <span>知乎搜索关键词（留空则用产品名）</span>
              <input id="zhihuQuery" type="text" placeholder="如：华为Nova16 评测" />
            </label>
            <button class="icon-button" id="zhihuSearchBtn" type="button" title="用知乎搜索 API 拉取真实标题与内容">
              <i data-lucide="search" />
              <span>知乎搜索</span>
            </button>
          </div>
          <div class="zhihu-results" id="zhihuResults" />
          <label class="textarea-label">
            <span>知乎真实评测素材</span>
            <textarea id="reviewInput" rows="8" />
          </label>
        </div>
      </details>
    </section>
  );
}
