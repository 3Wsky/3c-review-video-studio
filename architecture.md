# 3C Review Video Studio 架构设计

## 目标

把产品实拍图、知乎真实评测素材、产品事实、真人/数字人口播位，合成一条原创的数码 3C 技术博主风视频。

系统的主控不是某个开源项目，而是统一的 `Timeline JSON`。脚本、配音、字幕、动画、真人出镜、产品图动效都服从同一条时间轴。

## 三项目代码提炼

### MoneyPrinterTurbo

可用部分：

- `app/services/llm.py`：内置通用视频脚本生成 prompt，支持 `video_subject`、`paragraph_number`、`video_script_prompt`、`custom_system_prompt`。
- `app/services/voice.py`：TTS 和字幕链路成熟，包含 Edge TTS、Azure、Gemini、SiliconFlow、MiMo 等路径。
- 字幕策略：默认建议 Edge 字幕，不理想时切 Whisper。
- 任务式视频流程：主题/文案 -> 配音 -> 字幕 -> 素材 -> 合成。

对本系统的启发：

- 借它的“脚本/TTS/字幕一体化流水线”思想。
- 第一版不要直接吞整个项目，只抽象成 `VoiceService`、`SubtitleService`、`ScriptDraftService`。

### Pixelle-Video

可用部分：

- `pixelle_video/prompts/content_narration.py`：把用户提供内容提炼成适合 TTS 的分镜解说词。
- `pixelle_video/prompts/asset_script_generation.py`：根据用户素材生成带 `asset_path` 的场景脚本。
- `pixelle_video/models/storyboard.py`：Storyboard、StoryboardFrame 数据结构。
- `pixelle_video/pipelines/asset_based.py`：上传素材 -> 分析素材 -> LLM 分配素材到分镜 -> 生成音频 -> 计算时长 -> 合成。
- `pixelle_video/services/video.py`：处理视频/音频时长差异，包含 trim、pad、BGM 混音等逻辑。

对本系统的启发：

- 用“素材驱动分镜”，不要纯文本幻想画面。
- 用户上传产品实拍图后，LLM 需要把每张图绑定到具体分镜。
- 每个分镜要有 `asset`、`voiceover`、`subtitle`、`duration`、`visual.type`。

### HyperFrames

可用部分：

- HTML + CSS + JS 原生写视频画面。
- `data-start`、`data-duration`、`data-track-index` 控制时间轴和图层。
- CLI 支持 `preview`、`lint`、`render`、`inspect`、`snapshot`。
- 可用 GSAP、CSS、Lottie、Three.js、WAAPI 做可 seek 的动画。
- 适合 Agent 生成和维护模板。

对本系统的启发：

- 用它做最终渲染核心。
- 参数卡、字幕、产品图动效、真人出镜预留位都应该由 HyperFrames 模板控制。
- 不需要一开始引入 AI 视频生成，3C 内容更适合可控模板。

## 推荐系统分层

```text
Web UI
  - 项目管理
  - 素材上传
  - 评测文本输入
  - 脚本编辑
  - 分镜时间轴
  - 画面预览

API Backend
  - ProjectService
  - AssetService
  - ReviewExtractionService
  - ScriptService
  - TimelineService
  - VoiceService
  - SubtitleService
  - RenderService

Worker
  - TTS 生成
  - 字幕对齐
  - HyperFrames HTML 生成
  - ffmpeg/HyperFrames 渲染
  - 封面导出

Storage
  - product assets
  - voiceover
  - subtitles
  - timeline.json
  - render output
```

## 主数据结构

```json
{
  "project": {
    "product": "某款开放式蓝牙耳机",
    "category": "耳机",
    "platform": "抖音 / 快手 9:16",
    "targetDuration": 90,
    "layout": "center"
  },
  "timeline": [
    {
      "id": "scene_01",
      "start": 0,
      "end": 12.5,
      "voiceover": "这款耳机我不建议只看参数...",
      "subtitle": "这款耳机我不建议只看参数...",
      "visual": {
        "type": "真人口播 + 产品图",
        "layout": "center",
        "asset": "product_01.jpg",
        "headline": "先看结论",
        "detail": "舒适度是主卖点"
      },
      "checks": [
        "事实来自输入材料",
        "避免长句照搬",
        "保留人工复核位"
      ]
    }
  ]
}
```

## 第一阶段 MVP

只做这条线：

```text
上传产品图
粘贴知乎评测内容
填写产品事实
LLM 提炼观点
LLM 生成原创口播稿
生成 Timeline JSON
TTS 生成配音
按音频时长校准 timeline
HyperFrames 生成视频模板
导出 MP4
```

暂不做：

- 自动抓知乎
- AI 视频生成
- 复杂数字人
- 自动发布平台
- 多账号批量矩阵

## 第二阶段

- 接入真实 LLM API。
- 接入 Edge TTS 或 Azure TTS。
- 接入 HyperFrames CLI 渲染。
- 增加脚本相似度检查，避免洗稿。
- 增加事实核查字段，防止编造参数。
- 增加模板库：耳机、手机、显卡、显示器、笔记本。

## 部署建议

轻量试验：

```text
GitHub Codespaces
前端静态页面
FastAPI 后端
本地文件存储
HyperFrames CLI
```

Cloudflare 优先方案：

```text
Cloudflare Pages：前端
Cloudflare Pages Functions：/api/generate-timeline
Cloudflare R2：素材/成片
LLM API：DeepSeek/Qwen/OpenAI/OpenAI-compatible
外部按需 worker：HyperFrames + ffmpeg 渲染 MP4
```

正式一点：

```text
Cloudflare Pages：前端
Cloudflare R2：素材/成片
轻量 VPS / 按需 Codespaces：API + worker
HyperFrames CLI：渲染
LLM/TTS：云 API
```
