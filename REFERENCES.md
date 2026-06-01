# 参考思路

## 核心定位

这是一个数码 3C 评测视频生产系统，不是通用“一句话爆款视频”工具。

目标风格：

- 技术博主口播。
- 真实产品图优先。
- 观点清楚，参数谨慎。
- 不照搬评测原文。
- 用模板动画提升专业感。

## 三项目融合方式

```text
MoneyPrinterTurbo
  -> TTS / 字幕 / 任务流水线思路

Pixelle-Video
  -> 内容提炼 / 素材驱动分镜 / Storyboard 数据模型

HyperFrames
  -> HTML 视频模板 / 时间轴 / 字幕动画 / 最终渲染

本项目
  -> 3C 专属 Prompt + Timeline JSON 主控
```

## 为什么不直接使用其中一个项目

### 不直接使用 MoneyPrinterTurbo

它适合无脸素材混剪和快速批量生成，但对 3C 产品评测来说，产品真实图、参数卡、真人出镜位、事实核查都需要更强控制。

### 不直接使用 Pixelle-Video

它适合 AI 分镜和素材流水线，但 3C 内容第一阶段不需要大量 AI 图生视频。纯 AI 视频生成反而会带来产品外观和事实幻觉。

### 不直接使用 HyperFrames

HyperFrames 是渲染和动画核心，不负责 LLM 内容提炼、TTS、事实约束、素材管理。

## Timeline JSON 是主控

系统里的所有模块都围绕 Timeline JSON 工作：

```json
{
  "id": "scene_01",
  "start": 0,
  "end": 12,
  "voiceover": "这款耳机我不建议只看参数...",
  "subtitle": "这款耳机我不建议只看参数...",
  "visual": {
    "type": "真人口播 + 产品图",
    "layout": "center",
    "headline": "先看结论",
    "detail": "舒适度是主卖点",
    "asset": "product_01.jpg"
  }
}
```

## Cloudflare 架构边界

适合放在 Cloudflare：

- 静态前端。
- LLM 脚本生成 API。
- Timeline JSON 管理。
- R2 素材和成片存储。
- 用户登录、权限、任务状态。

不适合直接放在 Cloudflare Pages Functions：

- 长时间 MP4 渲染。
- 本地 ffmpeg 大任务。
- 大模型视频生成。
- 大文件长时间处理。

推荐方案：

```text
Cloudflare Pages + Pages Functions
  -> 生成脚本和 Timeline

Cloudflare R2
  -> 存素材和成片

外部按需 worker
  -> HyperFrames + ffmpeg 渲染 MP4
```

## 3C 内容 Prompt 原则

1. 不编造参数。
2. 不照搬知乎原句。
3. 先讲结论，再讲理由。
4. 每个观点都要有场景。
5. 明确适合谁、不适合谁。
6. 保留人工复核位。
7. 具体产品画面优先使用实拍素材。
8. 公共素材只做 B-roll。
