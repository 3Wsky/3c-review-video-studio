# 开发日志

## 2026-06-01

### 背景

目标是做一个面向数码 3C 的半自动评测视频生产系统：

- 输入产品实拍图、产品事实和知乎真实评测素材。
- 输出原创技术博主口播稿。
- 生成统一 Timeline JSON。
- 预留真人/数字人出镜位置。
- 后续由 HyperFrames 渲染视频。

### 调研项目

#### MoneyPrinterTurbo

观察到的价值：

- 有完整短视频流水线意识：文案、TTS、字幕、素材、合成。
- `app/services/llm.py` 内置通用视频脚本生成 Prompt，并支持自定义系统提示词。
- `app/services/voice.py` 的 TTS/字幕链路成熟，Edge TTS、Whisper 等策略值得复用。

对本项目的启发：

- 把脚本、配音、字幕当作一条可替换的服务链。
- 免费试跑阶段优先 Edge TTS，质量不足时再换付费 TTS 或 Whisper 字幕。

#### Pixelle-Video

观察到的价值：

- 有 `content_narration`、`asset_script_generation` 等模块化 Prompt。
- 有 Storyboard / StoryboardFrame 数据结构。
- `asset_based` pipeline 体现了“上传素材 -> LLM 绑定素材到分镜 -> 生成音频 -> 计算时长 -> 合成”的思路。

对本项目的启发：

- 3C 视频不能纯靠 AI 幻想画面，必须让实拍素材驱动分镜。
- 每个镜头都应该有 `asset`、`voiceover`、`subtitle`、`visual.type`、`duration`。

#### HyperFrames

观察到的价值：

- 用 HTML/CSS/JS 生成确定性视频。
- `data-start`、`data-duration`、`data-track-index` 很适合作为最终时间轴执行层。
- 适合做参数卡、字幕动画、真人出镜位、产品图动效。

对本项目的启发：

- 主控应是 Timeline JSON，而不是某个视频工具。
- HyperFrames 做最终画面和时间轴，不负责内容事实判断。

### 当前实现

- `index.html`：单页产品原型。
- `app.js`：前端状态、模拟生成、Cloudflare API 调用、Timeline 渲染。
- `functions/api/generate-timeline.js`：Cloudflare Pages Function，调用 OpenAI-compatible LLM 生成结构化 Timeline JSON。
- `architecture.md`：系统架构说明。
- `README.md`：部署和环境变量说明。

### 当前能力

- 本地 `file://` 打开时使用前端模拟生成。
- 部署到 Cloudflare Pages 后调用 `/api/generate-timeline`。
- 支持填写产品事实、评测素材、目标时长、平台、真人布局。
- 支持上传素材并在前端预览。
- 可下载 Timeline JSON 和方案 Markdown。

### 重要设计决定

1. 先不做视频渲染。
   原因：Cloudflare Workers/Pages Functions 不适合长时间 MP4 渲染。第一阶段先在 Cloudflare 上完成内容生成和时间轴。

2. 先不接 Pexels/Pixabay。
   原因：3C 产品视频的可信度来自实拍素材，公共 B-roll 只能做补充。

3. 先不接知乎自动抓取。
   原因：抓取和版权边界复杂，MVP 先支持用户粘贴评测素材。

4. API Key 只放 Cloudflare Secret。
   原因：不能把 LLM Key 写进前端。

### 下一步

1. 接 Cloudflare R2，上传产品图并保存素材索引。
2. 增加图片描述能力，让 LLM 知道每张图是什么角度/细节。
3. 接 TTS，生成每段音频并用音频时长校准 Timeline。
4. 生成 HyperFrames 项目文件。
5. 使用外部 worker 或按需服务器执行 `npx hyperframes render`。
6. 增加相似度检查和事实核查字段。
