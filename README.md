# 3C Review Video Studio

这是一个融合 MoneyPrinterTurbo、Pixelle-Video、HyperFrames 思路的静态网站原型。

核心提炼：

- MoneyPrinterTurbo：适合借鉴脚本生成入口、TTS、字幕生成、任务流水线。
- Pixelle-Video：适合借鉴素材驱动分镜、content narration prompt、storyboard 数据模型。
- HyperFrames：适合做最终时间轴、HTML 动画、字幕、真人出镜位和 MP4 渲染。

当前版本是 Cloudflare Pages 友好的 MVP：可以上传产品图、粘贴评测内容、生成 3C 技术博主风格脚本、Timeline JSON 和 HyperFrames 渲染计划。

本地直接打开 `index.html` 时，会走前端模拟生成；部署到 Cloudflare Pages 后，会调用 `/api/generate-timeline`。

## 部署架构

- **前端**（`index.html` / `app.js` / `styles.css`）部署到 **Cloudflare Pages**。
- **后端** 有两种方式，二选一：
  - 用仓库自带的 **Cloudflare Pages Function**（`functions/api/generate-timeline.js`，同源 `/api/generate-timeline`）。
  - 用 **FastAPI 跑在 GitHub Codespaces**（见 [`backend/`](./backend/README.md)），把 Codespaces 暴露的公网地址填到页面顶部「后端地址」输入框即可。前端会把请求发到该地址的 `/api/generate-timeline`，留空则走同源。

## Cloudflare 部署

需要在 Cloudflare Pages 里设置环境变量/Secrets：

- `OPENAI_API_KEY`：OpenAI-compatible LLM API Key
- `OPENAI_BASE_URL`：OpenAI-compatible base URL，例如 `https://api.deepseek.com`；小米 MiMo Token Plan 为 `https://token-plan-cn.xiaomimimo.com/v1`
- `OPENAI_MODEL`：模型名，例如 `deepseek-chat` 或 `MiMo-V2.5`
- `ZHIHU_ACCESS_SECRET`（可选）：知乎搜索 API 的 Access Secret，在 <https://developer.zhihu.com/profile> 获取。配置后页面「知乎搜索」按钮可直接拉取真实标题/内容并填入评测素材。

所有 Key 必须放在 Cloudflare Pages 的环境变量/Secret 里，不能写进 `app.js` 或任何前端文件。

## 知乎搜索接入

- 后端接口：`/api/zhihu-search?q=关键词&count=10`（Cloudflare Function `functions/api/zhihu-search.js`，Codespaces FastAPI 同名接口）。
- 服务端用 `Authorization: Bearer <ZHIHU_ACCESS_SECRET>` + `X-Request-Timestamp`（秒级）调用知乎 `zhihu_search`，返回标题、摘要、赞同数、精选评论与链接。
- 前端「知乎搜索」按钮会把结果整理成素材文本填入「知乎真实评测素材」，再点「生成」即可让大模型基于真实内容写脚本。

本地预览（在仓库根目录执行）：

```bash
npx wrangler pages dev .
```

部署（在仓库根目录执行）：

```bash
npx wrangler pages deploy .
```

推荐用 Cloudflare Dashboard 的 Git 集成自动部署：Workers & Pages → Create → Pages → Connect to Git，选本仓库，Framework preset 选 None、Build command 留空、Build output directory 填 `/`。

## 后续接入建议

1. 后端使用 FastAPI。
2. LLM 使用 DeepSeek/Qwen/OpenAI，输出结构化 Timeline JSON。
3. TTS 使用 Edge TTS 试跑，稳定后换 Azure/OpenAI/火山/MiniMax。
4. 渲染层使用 HyperFrames CLI 或 Producer。
5. 存储使用 Cloudflare R2/S3。
