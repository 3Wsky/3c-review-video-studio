/** legacy director.js 仍依赖的 DOM 节点：音色克隆 / 素材库 / 横评 / 实拍上传 / 道法动画 */
export default function LegacyExtras() {
  return (
    <>
      <div class="field-grid">
        <label>
          <span>配音音色（试听用）</span>
          <select id="ttsVoice">
            <option value="mimo_default">默认（冰糖·女）</option>
            <option value="冰糖">冰糖 · 中文女</option>
            <option value="茉莉">茉莉 · 中文女</option>
            <option value="苏打">苏打 · 中文男</option>
            <option value="白桦">白桦 · 中文男</option>
            <option value="clone" id="cloneVoiceOption" disabled>
              我的克隆音色（先在下方上传）
            </option>
          </select>
        </label>
      </div>

      <details class="voice-clone" id="voiceCloneBox">
        <summary>
          <i data-lucide="mic" />
          克隆我的音色（上传 5–10s 录音，用自己的声音配音）
        </summary>
        <div class="voice-clone-body">
          <label class="upload-zone compact" for="voiceSampleInput">
            <input id="voiceSampleInput" type="file" accept="audio/*" />
            <i data-lucide="upload-cloud" />
            <span id="voiceSampleName">选择一段 5–10 秒、安静清晰的录音（wav/mp3/m4a）</span>
          </label>
          <label class="textarea-label">
            <span>这段录音说的内容（逐字，必填）</span>
            <input id="voicePromptText" type="text" placeholder="例如：大家好，今天给大家测评一款新手机。" />
          </label>
          <button class="icon-button" id="enrollVoiceBtn" type="button">
            <i data-lucide="wand-sparkles" />
            <span>克隆我的音色</span>
          </button>
          <p class="asset-tip" id="voiceCloneTip">
            需先部署 CosyVoice 服务并配置 VOICE_CLONE_URL（见 voice-clone/README.md）。克隆后在上方音色选「我的克隆音色」即可。
          </p>
        </div>
      </details>

      <details class="voice-clone" id="stockBox">
        <summary>
          <i data-lucide="image" />
          素材库 · 免费空镜（Pexels/Pixabay，版权无忧可商用）
        </summary>
        <div class="voice-clone-body">
          <div class="stock-search">
            <input id="stockQuery" type="text" placeholder="搜索关键词，如 smartphone / headphone / desk setup" />
            <button class="icon-button" id="stockSearchBtn" type="button">
              <i data-lucide="search" />
              <span>搜索</span>
            </button>
          </div>
          <div class="stock-grid" id="stockGrid" />
          <p class="asset-tip" id="stockTip">
            搜免费可商用素材做空镜。点缩略图可在新标签查看出处。需在后端配置 PEXELS_API_KEY / PIXABAY_API_KEY（见 backend/.env.example）。
          </p>
          <label class="checkbox-row">
            <input id="autoStockToggle" type="checkbox" />
            <span>渲染时：分镜缺图则自动用免费素材空镜兜底（标记「需替换」，实拍优先）</span>
          </label>
        </div>
      </details>

      <details class="voice-clone" id="compareBox">
        <summary>
          <i data-lucide="table-2" />
          横评对比 · 「这几款选谁」对比矩阵镜
        </summary>
        <div class="voice-clone-body">
          <p class="asset-tip">
            每行写一个维度，格式 <code>维度(单位, 高/低): 值1, 值2, 值3</code>。「高」=越大越好，「低」=越小越好；系统自动高亮每行胜者并选出综合赢家。
          </p>
          <textarea
            id="compareSpec"
            rows={7}
            placeholder={`产品: A机, B机, C机\n续航(小时, 高): 12, 10, 9\n重量(g, 低): 210, 190, 205\n价格(元, 低): 3999, 3499, 2999\n影像得分(分, 高): 148, 140, 132`}
          />
          <div class="stock-search">
            <button class="icon-button" id="compareInsertBtn" type="button">
              <i data-lucide="table-2" />
              <span>插入对比镜</span>
            </button>
          </div>
          <p class="asset-tip" id="compareTip">
            插入后会作为一个新分镜加到当前镜头之后，可在导演台继续编辑口播/字幕。
          </p>
        </div>
      </details>

      <label class="checkbox-row" style="margin-top: 14px; margin-bottom: 14px;">
        <input id="taoAnimationToggle" type="checkbox" defaultChecked />
        <span>启用道法起片过场动画（一生二，二生三，三生万物）</span>
      </label>

      <label class="upload-zone" for="assetInput">
        <input id="assetInput" type="file" accept="image/*,video/*" multiple />
        <i data-lucide="upload-cloud" />
        <span>上传产品实拍图或短视频（可选）· 图片可一键抠出主体</span>
      </label>
      <div class="asset-strip" id="assetStrip" />
      <p class="asset-tip">
        上传图片后点缩略图下方「一键抠图」：浏览器本地 AI 抠出主体（手机/耳机/手表），免费、不上传服务器，得到透明背景图直接用作画面。
      </p>
    </>
  );
}
