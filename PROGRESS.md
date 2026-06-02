# 开发进度 (PROGRESS)

> 这份文档记录项目的开发进度（已完成 / 进行中 / 待办）、架构、密钥位置和"换电脑如何续上"。
> **每次有进展都要更新这份文件并提交，** 这样换设备 `git clone` 后就能接着开发。
> 最近更新：2026-06（短视频留人脚本结构上线后）

---

## 1. 这是什么

3C 数码测评短视频「导演台」：输入一个产品名 → 一键自动「知乎搜索抓真实评测素材 → MiMo 大模型生成短视频分镜脚本」→ 在横向时间线上编辑分镜（改文案/时长、拖动排序、增删镜头）→ 导出方案/JSON。后续接 TTS 配音和视频渲染。

- 线上地址（生产）：https://3c-review-video-studio.pages.dev
- 仓库：https://github.com/3Wsky/3c-review-video-studio

---

## 2. 架构总览

| 层 | 用什么 | 说明 |
|---|---|---|
| 前端 | 纯静态 `index.html` + `app.js` + `styles.css` | 部署在 Cloudflare Pages，推送到 `main` 自动部署 |
| 生成后端（主用） | Cloudflare Pages Functions | `functions/api/generate-timeline.js`（调 MiMo 生成分镜）、`functions/api/zhihu-search.js`（知乎搜索）。同源、免跨域、不睡眠 |
| 生成后端（备用/重活） | FastAPI `backend/main.py` | 逻辑与 Functions 一致，留给 Codespaces 跑渲染/TTS 等重任务 |
| 大模型 | 小米 MiMo（OpenAI 兼容） | Token Plan 套餐，`chat/completions` 接口 |
| 素材 | 知乎搜索开放接口 `zhihu_search` | 真实标题/摘要/赞同/精选评论 |

**数据结构**：生成结果是 Timeline JSON `{ project, insights, timeline[] }`，每个分镜含 `title/start/end/duration/voiceover/subtitle/visual/source`。

---

## 3. 密钥与环境变量（值不在仓库里，放在 Cloudflare）

在 Cloudflare Pages → 项目 `3c-review-video-studio` → Settings → 环境变量（Production）配置：

| 变量 | 值 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` | `tp-` 开头的 Token Plan key（Secret） | MiMo 鉴权 |
| `OPENAI_BASE_URL` | `https://token-plan-cn.xiaomimimo.com/v1` | Token Plan 专属地址（≠ 按量付费的 api.xiaomimimo.com） |
| `OPENAI_MODEL` | `MiMo-V2.5` | 文本生成模型 |
| `ZHIHU_ACCESS_SECRET` | 知乎 Access Secret（Secret） | 知乎搜索鉴权 |

> 本地跑 FastAPI 时同名变量放 `backend/.env`（参考 `backend/.env.example`），不要提交真实密钥。

---

## 4. 已完成 ✅

- [x] **免费技术栈打通**：Cloudflare Pages（前端）+ Pages Functions（生成后端）+ MiMo（生成）。
- [x] **MiMo 接通**（PR #1 起）：Token Plan 专属 base_url + `MiMo-V2.5`，生产可生成真实分镜 JSON。
- [x] **知乎搜索接入**（PR #2）：一键搜索 → 真实标题/摘要/赞同 → 自动填入素材。
- [x] **Prompt 约束竞品**（PR #3）：只评测当前产品，禁止把素材里其它品牌/型号/参数写进脚本。
- [x] **渲染 bug 修复**（PR #4）：`renderAll` 之前用 `.length` 误判对象导致用模拟数据覆盖真实结果，改判 `timeline.timeline.length`。
- [x] **导演台重构**（PR #5）：一句话起片 + 横向时间线轨道（点选编辑、拖动排序、增删镜头），技术项收进「高级设置」。8/8 端到端测试通过。
- [x] **深色影院风换肤**（PR #6）：黑底 + 紫/粉渐变光晕 + 玻璃拟态，纯 CSS。
- [x] **三项体验优化**（PR #7）：① 品类按产品名自动推断；② 一键生成 loading 骨架 + 按钮转圈；③ 草稿自动存 localStorage（key `directorDraft_v1`），刷新恢复 + 「重置」按钮。
- [x] **短视频留人脚本结构**（PR #8）：前 5 秒强钩子（第 1 镜 3-6s）+ 情绪曲线（钩子→痛点→悬念→高潮→反转→结尾互动），每镜结尾留开放回路钩子；分镜标题带节奏标签。已在生产用华为Nova16 验证（60s/90s 都符合）。

---

## 5. 进行中 🚧

- [ ] **TTS 配音试听**（当前任务）：用 MiMo-V2.5-TTS（限时免费）把每镜口播转成语音，页面里能试听。
  - 模型：`mimo-v2.5-tts`（内置音色；另有 `-voicedesign` 文本描述音色、`-voiceclone` 音色克隆）。
  - 接口形态：走 `chat/completions` 风格 —— **要合成的文本放在 `assistant` 角色的 message**，`user` 角色放风格指令（可选）。
  - 计划：新增 `functions/api/tts.js`（+ FastAPI 镜像），前端每镜加「试听」按钮播放返回音频。

---

## 6. 待办 / 路线图 📋

- [ ] **一键导出**：口播稿 `.txt` + 字幕 `.srt` + 分镜表，方便拿去剪映/配音。
- [ ] **逐镜重生**：只对某一镜点「重写」（换钩子/换说法），不重跑整条。
- [ ] **留人体检**：给脚本打「留人分」，标出钩子弱/过长的镜头并给建议。
- [ ] **移动端适配 / 配色微调**（按需）。
- [ ] **视频渲染管线**（重活，放 Codespaces）：TTS 配音 → WhisperX 逐字字幕对齐 → ffmpeg/HyperFrames 按时间线渲成 MP4 → 上传 R2 → 回链给前端。

---

## 7. 换电脑后如何续上

1. `git clone https://github.com/3Wsky/3c-review-video-studio.git`
2. 看这份 `PROGRESS.md` 了解进度，从「进行中 🚧」接着做。
3. 前端本地预览：仓库根目录 `python3 -m http.server 8099`，浏览器开 `http://localhost:8099/index.html`（本地没有密钥时走前端兜底示例数据，真实生成需用生产环境或配好密钥的后端）。
4. 真实生成/知乎/TTS 的密钥已配在 Cloudflare（见第 3 节），生产站点 `https://3c-review-video-studio.pages.dev` 直接可用；改完推 PR 合并到 `main` 即自动部署。
5. 想本地跑真实生成：`cd backend && cp .env.example .env`（填密钥）→ `pip install -r requirements.txt` → `uvicorn main:app --port 8000`。

---

## 8. 提交规范小抄

- 改前端：`index.html` / `app.js` / `styles.css`。
- 改生成逻辑：**Cloudflare Function 和 FastAPI 两处要同步改**（`functions/api/*.js` 与 `backend/main.py` 的 prompt 保持一致）。
- 每个改动开新分支 → PR → CI（Cloudflare Pages）通过 → 合并 `main` 自动部署。
- **每次完成一块，更新本文件的「已完成/进行中/待办」再提交。**
