# 开发进度 (PROGRESS)

> 这份文档记录项目的开发进度（已完成 / 进行中 / 待办）、架构、密钥位置和"换电脑如何续上"。
> **每次有进展都要更新这份文件并提交，** 这样换设备 `git clone` 后就能接着开发。
> 最近更新：**2026-06-20**（Vite+Preact 重构 + 游戏化 P0–P2 + Agnes V2.0 空镜 + 5060 看门狗已上线；最新 commit `dc23b7d`。完整交接见 **第 11 节**）

---

## 1. 这是什么

3C 数码测评短视频「导演台」：输入一个产品名 → 一键自动「知乎搜索抓真实评测素材 → MiMo 大模型生成短视频分镜脚本」→ 在横向时间线上编辑分镜（改文案/时长、拖动排序、增删镜头）→ 导出方案/JSON。后续接 TTS 配音和视频渲染。

- 线上地址（生产）：https://3c-review-video-studio.pages.dev
- 仓库：https://github.com/3Wsky/3c-review-video-studio

---

## 2. 架构总览

| 层 | 用什么 | 说明 |
|---|---|---|
| 前端 | **Vite + Preact**（`src/` → `npm run build` → `dist/`）| Cloudflare Pages 构建命令 `npm run build`，输出目录 `dist`；legacy `director.js` 经 bridge 共存 |
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
| `VOICE_CLONE_URL` | 自部署 CosyVoice 服务的公网地址（可选） | 配置后「我的克隆音色」可用，见 `voice-clone/README.md` |
| `RENDER_URL` | **已配** = `https://render.1go.im` | 渲染/封面；5060 休眠时可能 502/530，看门狗可恢复。见 `video-render/README.md` |
| `AGNES_API_KEY` | Agnes Video V2.0 API Key（Secret） | 编导区「AI 空镜」；`/api/agnes-video` 代理；免费期排队约 3–6 分钟 |

> 本地跑 FastAPI 时同名变量放 `backend/.env`（参考 `backend/.env.example`），不要提交真实密钥。

**配在 GPU worker 机上的变量**（不是 Cloudflare，放在 5060 那台机器，见 `video-render/README.md`）：

| 变量 | 说明 |
|---|---|
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | worker 逐镜配音用（预设 MiMo 音色）；缺了就静音兜底仍出片 |
| `VOICE_CLONE_URL` | worker 调克隆音色服务（`voice=clone` 时）。同机一般填 `http://localhost:9233` |
| `PEXELS_API_KEY` / `PIXABAY_API_KEY` | 可选：缺图自动空镜（autoStock），逗号分隔多 key。Pexels key 已实测通过 |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_PUBLIC_BASE` | 可选：成片传 Cloudflare R2 出分享链接；缺凭证降级为直接下载 |

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
- [x] **进度存档 PROGRESS.md**（PR #9）：记录已完成/进行中/待办 + 架构 + 密钥位置 + 换电脑续接。
- [x] **TTS 配音试听**（PR #10）：用 MiMo-V2.5-TTS（限时免费）每镜「试听配音」一键出声。
  - 新增 `functions/api/tts.js`（+ FastAPI `/api/tts` 镜像）：要合成的文本放 `assistant` message，`audio:{format,voice}` 选音色，解析 `message.audio.data`(base64)。前端「试听配音」按钮 + 高级设置音色选择（冰糖/茉莉/苏打/白桦），按 `voice::text` 缓存。可选环境变量 `OPENAI_TTS_MODEL`/`OPENAI_TTS_VOICE`。已在生产用华为Nova16 验证出声。
- [x] **一键导出**（PR #12）：工具栏「导出 ▾」下拉，导出 口播稿 `.txt` / 字幕 `.srt`（按每镜时长算连续时间码）/ 分镜表 `.csv`（带 BOM，Excel 不乱码）/ 方案 `.md`。纯前端，导出不依赖后端。
- [x] **逐镜重生**（PR #14）：每个镜头编辑区「重写本镜」按钮，只把这一镜送 MiMo 重写（保留时长 + 留人角色：钩子/高潮/反转 不变），就地替换、不动其它镜。新增 `functions/api/rewrite-scene.js`（+ FastAPI `/api/rewrite-scene` 镜像），带「上一镜口播 + 下一镜标题」做衔接，temperature 0.85 保证每次不同。已在生产用华为Nova16 验证。
- [x] **图片一键抠图**（PR #15）：高级设置素材区上传图片后，缩略图下「一键抠图」浏览器本地抠出主体（手机/耳机/手表），免费、不上传服务器、无 API key。用开源 `@imgly/background-removal`（AGPL，浏览器内 ONNX/WASM），CDN 懒加载，输出透明 PNG 直接用作画面预览；可「还原」原图。仓库已公开，AGPL 不冲突。
- [x] **克隆音色（CosyVoice 自部署）**：高级设置「克隆我的音色」上传一段 5–10s 录音 + 这段录音的文字 → 零样本克隆出你的音色，音色下拉多一项「我的克隆音色」，每镜「试听配音」即用你的声音。模型用开源 CosyVoice2-0.5B（需 GPU，RTX 50 系列要 cu128 PyTorch）。新增独立 GPU 服务 `voice-clone/`（`server.py` 提供 `/enroll` `/tts`，`deploy.sh` 一键部署，`README.md` 含 5060/Blackwell 注意事项）；主站点新增 `/api/voice-enroll` + `/api/tts` 克隆分支（Cloudflare Function 与 FastAPI 两处同步），通过 `VOICE_CLONE_URL` 转发。GPU 离线时返回明确报错、可退回 MiMo 预设音色。spkId 用 localStorage(`cloneVoice_v1`) 持久化。
- [x] **留人体检**（PR #16）：工具栏「留人体检」按钮，纯前端启发式给当前脚本打「留人分」（0-100 + 优秀/良好/及格/待优化），五个维度：开场5秒钩子(30%)/钩子连贯·不停留人(25%)/节奏拉扯(20%)/结尾结论+互动(15%)/语速时长匹配(10%)。弹窗里环形总分 + 维度条 + 逐镜诊断（标出弱钩子、过长镜头、语速不匹配、缺承接钩子/CTA），每个有问题的镜头可「去编辑」或一键「重写本镜」（复用 PR #14）。判定靠关键词词库（HOOK/LOOP/CTA/CONCLUSION）+ 时长/语速规则，不调后端、不花钱。`scoreRetention()` / `openCheckup()` 在 `app.js`。

---

## 5. 视频渲染管线（已完成代码，正在部署）🚧

选定 **HyperFrames**（HTML/CSS/JS + GSAP → 逐帧截图 + ffmpeg → MP4）为渲染内核，与克隆服务并列跑在同一台自有 GPU 机（RTX 5060，白天在线）。

- [x] **渲染地基**（PR #18）：`video-render/` 9:16 竖屏样例模板（产品图 Ken Burns + 参数卡数字滚动 + 进度条 + 逐句字幕）+ `render.sh` + README。**坑：HyperFrames 走确定性字体，默认不含中文 → Linux worker 需装 `fonts-noto-cjk` 或模板内嵌 Noto Sans SC，否则中文变方块。**
- [x] **Timeline JSON → 合成 HTML 自动生成**（PR #19）：`build.mjs` 每镜转一段 `.scene.clip`，数字+单位自动高亮，缺字段安全降级，确定性输出。
- [x] **渲染 worker 一站式出片**（PR #20）：`worker.mjs` 收 Timeline+音色 → 逐镜配音、ffprobe 校准真实时长 → 生成 HTML → `hyperframes render` → ffmpeg 混音 → MP4。`/api/render` 转发（`RENDER_URL`），前端「渲染视频」按钮 + 离线降级。
- [~] **部署到 5060**（进行中，已完成大半）：Windows 11 + WSL2(Ubuntu)。worker(:9234) 已跑通、命名隧道 `render.1go.im` 已通、`RENDER_URL` 已配通验证转发。**剩：把服务做成常驻（关窗口/待机不断）+ 端到端出片 + worker 配 MiMo TTS key + 装克隆音色(:9233)。** 详见第 9 节。

---

## 6. 五大功能（B/C/D/E/F，均已合并 main）✅

> 这五个在「连夜自动开发」里完成，分别开 PR。最终经 PR #26 收口全部并入 `main`。

- [x] **B 免费素材源**（PR #21）：`video-render/stock.mjs` + `functions/api/stock.js` + 后端 `/api/stock`。按关键词搜 Pexels/Pixabay 版权无忧素材（多 key 轮询），前端「素材库」面板搜图；渲染开 `autoStock` 时缺图分镜自动拉竖屏空镜（标「需替换」，实拍优先）。无 key 优雅降级。**Pexels key 已实测下载真实 JPEG 通过。**
- [x] **C 防垃圾质检闸门**（PR #22）：`qualityGate()` 把留人分 + 事实溯源 + 反洗稿做成出片前置门槛，不达标弹窗拦截（可人工放行）。渲染画面加事实溯源角标（`visual.cite`→「据：…」）和素材角标。
- [x] **D 横评对比矩阵**（PR #23）：`visual.compare = {products, rows:[{label,unit,better,values}]}` → 渲对比表，按 `better`(high/low) 逐维度判胜者金色高亮(✓)，综合胜者表头戴 👑。前端「横评对比」面板用简易 DSL 生成。
- [x] **E R2 存片 + 分享链接**（PR #24）：`video-render/r2.mjs`（S3 兼容 PutObject + SigV4 自签，零依赖）。worker 出片后可选传 Cloudflare R2 → 返回可播/下载/复制分享的 URL；缺凭证或上传失败自动回退直接下载。配在 **worker 机** 上的 `R2_*` 变量。
- [x] **F 多端裁剪**（PR #25）：`build.mjs` 支持 9:16/16:9/1:1 三画幅（含安全区适配）+ `buildXiaohongshuCaption()` 出小红书图文文案。worker 新增 `posterJob`/`POST /poster`（`hyperframes snapshot` 抽静帧出封面+配图，不出视频、不吃 GPU、快）+ `functions/api/poster.js` + 后端 `/api/poster`。前端画幅下拉 + 「图文/封面」按钮（封面/配图网格下载 + 可编辑小红书文案一键复制）。

---

## 7. 待办 / 路线图 📋

- [~] **完成 5060 部署**（当前任务，进度见第 9 节）：worker + 命名隧道 + `RENDER_URL` 已通；剩 = ①把 worker/隧道做成 systemd 常驻服务（现在是前台窗口，关机就停）②端到端跑一条真实出片 ③worker 配 `OPENAI_API_KEY`/`OPENAI_BASE_URL`（MiMo）让成片有声 ④装克隆音色(:9233) + 配 `VOICE_CLONE_URL=https://voice.1go.im`。
- [ ] **端到端实测**：部署好后用真实产品跑「生成→配音→渲染出 MP4」「图文/封面」全链路，验证中文字体、NVENC、R2 分享链接。
- [ ] **数据可视化参数卡**（推荐，未做）：把真实参数（续航/重量/价格/跑分）渲成动画条形图/雷达图/进度环（ECharts/D3 + GSAP），最能体现「有用」。
- [ ] **逐词字幕**：可选 `hyperframes transcribe`（内置 Whisper，替代单独 WhisperX）做卡拉OK字幕。
- [ ] **三项目融合补强**：把 Pixelle 提炼/约束提示词进一步融进 MiMo；用 Pixelle storyboard 模型对齐 Timeline 字段。
- [ ] **移动端适配 / 配色微调**（按需）。

---

## 8. 换电脑后如何续上

1. `git clone https://github.com/3Wsky/3c-review-video-studio.git`
2. 看这份 `PROGRESS.md`：第 4/6 节是已完成功能，第 7 节是待办（当前在「完成 5060 部署」）。
3. 前端本地预览：仓库根目录 `python3 -m http.server 8099`，浏览器开 `http://localhost:8099/index.html`（本地没有密钥时走前端兜底示例数据，真实生成需用生产环境或配好密钥的后端）。
4. 真实生成/知乎/TTS 的密钥已配在 Cloudflare（见第 3 节），生产站点 `https://3c-review-video-studio.pages.dev` 直接可用；改完推 PR 合并到 `main` 即自动部署。
5. 想本地跑真实生成：`cd backend && cp .env.example .env`（填密钥）→ `pip install -r requirements.txt` → `uvicorn main:app --port 8000`。

---

## 9. 在 5060 上部署 GPU 服务（Windows + WSL2）

> 这两个服务跑在你的 RTX 5060 台式机上（白天在线）。Windows 推荐用 WSL2(Ubuntu)，仓库脚本直接能用。

**前置**：Windows 端装最新 NVIDIA 驱动 → PowerShell(管理员) `wsl --install -d Ubuntu` → 重启设用户名密码 → Ubuntu 里 `nvidia-smi` 能看到 5060（GPU 自动透传，WSL 内不用再装驱动）。

**基础依赖（Ubuntu 里）**：
```bash
sudo apt update && sudo apt install -y git python3 python3-pip python3-venv ffmpeg fonts-noto-cjk curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs   # Node 22+
git clone https://github.com/3Wsky/3c-review-video-studio.git && cd 3c-review-video-studio
```

**① 渲染 worker（快，先验证）**：
```bash
cd ~/3c-review-video-studio/video-render
bash worker.start.sh        # :9234
curl http://localhost:9234/health   # {"ok":true,...}
```

**② 克隆音色（要下模型，慢）**：
```bash
cd ~/3c-review-video-studio/voice-clone
bash deploy.sh              # 装 cu128 PyTorch(5060必须) + 下 CosyVoice2-0.5B + 起 :9233
curl http://localhost:9233/health   # modelLoaded:true, cuda:true
```

**③ 暴露公网 + 配主站点**：用 Cloudflare Tunnel（免费、不用公网 IP）把 :9233/:9234 暴露成 https 域名，再到 Cloudflare Pages → Settings → 环境变量 配 `VOICE_CLONE_URL` / `RENDER_URL`。
（注：经 Cloudflare 转发的渲染若成片较长可能撞边缘超时，可把前端「后端地址」直指自部署 FastAPI `/api/render`(900s)，或后续改任务队列+轮询。）

---

### 9.1 本次部署已做到哪一步（2026-06，5060 笔记本 = Windows 11 + WSL2）

机器：**RTX 5060 Laptop（8GB）+ Windows 11**。WSL2 的 Ubuntu 装在 **D 盘**（`D:\WSL`），WSL 用户名 `administrator`，仓库克隆在 `~/3c-review-video-studio`。

**✅ 已完成：**
1. WSL2 + Ubuntu 装到 D 盘（`wsl --install --no-distribution` 先装平台 → 重启 → `wsl --install -d Ubuntu --location D:\WSL`）。
2. `nvidia-smi` 在 WSL 内看到 RTX 5060（驱动 610 / CUDA 13.3，GPU 透传成功）。
3. 基础依赖：`git python3 python3-pip python3-venv ffmpeg fonts-noto-cjk curl` + Node 22。
4. 起渲染 worker：`cd ~/3c-review-video-studio/video-render && bash worker.start.sh`（:9234），`/health` 返回 `ok:true`，`hyperframes@0.6.69` 就绪。
5. **命名 Cloudflare Tunnel**（固定地址，重启不变）：
   ```bash
   curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i /tmp/cloudflared.deb
   cloudflared tunnel login                 # 浏览器授权域名 1go.im
   cloudflared tunnel create 3c-worker      # 凭证存 ~/.cloudflared/<id>.json + cert.pem
   cloudflared tunnel route dns 3c-worker render.1go.im
   cloudflared tunnel route dns 3c-worker voice.1go.im
   # 写 ~/.cloudflared/config.yml：
   #   tunnel: <id>
   #   credentials-file: /home/administrator/.cloudflared/<id>.json
   #   ingress:
   #     - hostname: render.1go.im  ->  service: http://localhost:9234
   #     - hostname: voice.1go.im   ->  service: http://localhost:9233
   #     - service: http_status:404
   cloudflared tunnel run 3c-worker         # 前台运行
   ```
   外网验证 `https://render.1go.im/health` 返回 200（`voice.1go.im` 在克隆音色起来前是 502，正常）。
6. Cloudflare Pages → Settings → 变量(Production) 加 `RENDER_URL = https://render.1go.im`（无结尾`/`）→ 重新部署 → 外网打 `/api/render` 不再 501、能转发到 worker（验证通过）。

**⏳ 待办（下次开机继续）：**
- **A. 把 worker + 隧道做成常驻服务**（重要！现在是前台窗口跑，关窗口/笔记本待机/关机就断）。WSL 里建议用 `systemd`（新版 WSL 默认开 systemd，可在 `/etc/wsl.conf` 加 `[boot]\nsystemd=true`）写两个 service：一个 `node worker.mjs`，一个 `cloudflared tunnel run 3c-worker`；或临时用 `nohup ... &`。另外 Windows 电源设置改「合盖不睡眠/插电常亮」。
- **B. worker 配 MiMo 配音 key 让成片有声**：worker 启动前 `export OPENAI_API_KEY=<tp- key>` + `export OPENAI_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1`（同 Cloudflare 那套），否则渲出来是静音片。
- **C. 端到端出片实测**：网站生成分镜 → 点「渲染视频」→ 应出 MP4（或配了 R2 出分享链接）。也可直接 `curl -X POST https://render.1go.im/render -d @timeline.json`。
- **D. 装克隆音色服务**：`cd ~/3c-review-video-studio/voice-clone && bash deploy.sh`（下 cu128 PyTorch + CosyVoice2-0.5B，约 15~25GB，较久）→ 起 :9233 → 隧道里 `voice.1go.im` 自动生效 → Cloudflare Pages 配 `VOICE_CLONE_URL=https://voice.1go.im`。

> 注：命名隧道 `3c-worker` 和它的 DNS（render/voice.1go.im）已存在你 Cloudflare 账号里，**换机器只要重新跑 worker + `cloudflared tunnel run`**（隧道凭证文件 `~/.cloudflared/` 在那台 5060 上；换全新机器需重新 `cloudflared tunnel login` 或拷贝凭证）。**注意：这是「部署 GPU 服务」，跟「换电脑继续写代码」是两回事——写代码只需 clone 仓库看本文档即可。**

---

## 10. 提交规范小抄

- 改前端：`src/`（Preact 组件 + `src/legacy/director.js` bridge）；`npm run build` 验证后 push。
- 改生成逻辑：**Cloudflare Function 和 FastAPI 两处要同步改**；prompt 优先改 `shared/prompts/` 再引用。
- 每个改动开新分支 → PR → CI（Cloudflare Pages）通过 → 合并 `main` 自动部署。
- **每次完成一块，更新本文件的「已完成/进行中/待办」再提交。**
- **git push 代理**：本机 Clash 监听 **7890**（全局 git 代理若写 7897 会超时）。

---

## 11. 2026-06-20 进度快照（换项目 / 下次接续用）

> 共享记忆 key：`project-handoff-2026-06-20`（KC MCP 全局 scope，agent 可读）

### 11.1 当前版本

| 项 | 值 |
|---|---|
| 最新 commit | `dc23b7d` — AI 空镜点击无反应修复（全局 Toast、卡住任务清除、busy 锁） |
| 上一大版 | `0545540` — Agnes Video V2.0 + 每镜 `videoPrompt` + 游戏特效写入 prompt |
| 生产站 | https://3c-review-video-studio.pages.dev |
| 构建产物 | `dist/assets/index-B84R8uB7.js`（2026-06-20 已部署） |
| `/api/health` | llm / 知乎 / render / voiceClone / **agnes** 全 `configured` ✅ |

### 11.2 已完成（不必重做）

- [x] **Vite+Preact 模块化** Phase A/B/C：`src/core` · `src/features/*` · Design System v2 · Strangler 模式（Preact UI + legacy director bridge）
- [x] **Cloudflare Pages 构建**：Dashboard Build command = `npm run build`，output = `dist`
- [x] **游戏化 P0–P2**：转场(speed-line/scan-wipe 等 6 种) · Stat Ring · 擂台 PK · 拍摄引导 HUD · 雷达 HUD · Kenney CC0 素材
- [x] **游戏化 prompt 兜底**：LLM 漏标时 `ensureGamifiedVisual()` 按节奏标签自动注入镜型
- [x] **道法起片渐进动画**（道生一→三生万物，含 reduced-motion 降级）
- [x] **品类净化**：默认品类改「手机」；跨品类耳机文案自动 scrub（`shared/category-sanitize.mjs`）
- [x] **每镜 videoPrompt**：口播与画面分离；Agnes 空镜优先用专用提示词 + 游戏特效 bake 进 brief
- [x] **Agnes Phase 2+2b**：异步 B-roll（4s 轮询、localStorage 续任务）· V2.0 Flash 扩写 · ti2vid 图生视频
- [x] **5060 部署**：CosyVoice2-0.5B `:9233`（F 盘）· render worker `:9234` · 命名隧道 render/voice.1go.im
- [x] **5060 常驻/恢复**：systemd 三服务 + `scripts/5060-health-watchdog.sh` + Windows 计划任务 `3C-5060-*`
- [x] **T19 CosyVoice 修复**：torch/torchaudio ABI + 卸载 deepspeed（推理不需要）

### 11.3 5060 服务速查

| 服务 | 本地 | 外网 | 说明 |
|---|---|---|---|
| 渲染 worker | `:9234` | https://render.1go.im | HyperFrames + ffmpeg |
| 克隆音色 | `:9233` | https://voice.1go.im | CosyVoice2-0.5B，modelLoaded 约 1min |
| 隧道 | cloudflared `3c-worker` | — | `Restart=always`，协议 http2 |

**文件全在 F 盘**：`F:\3c-review-video-studio`（WSL 映射 `/mnt/f/3c-review-video-studio`）

**一键恢复**（5060 唤醒后）：
```bash
wsl bash /mnt/f/3c-review-video-studio/scripts/5060-health-watchdog.sh --recover
```
或 Windows 计划任务 `3C-5060-WakeRecover`（登录触发）/ `3C-5060-HealthWatchdog`（每 5 分钟）。

> **注意**：5060 合盖/关机后外网会 502/530；前端编辑、一键生成、Agnes 空镜仍可用（走 Cloudflare）；**渲染 MP4 / 克隆音色** 需 5060 在线。

### 11.4 本地开发

```bash
cd F:\3c-review-video-studio   # 或 clone 后 cd
npm install
npm run dev                    # http://localhost:5173，/api 代理到 8788
npm run build                  # 产出 dist/
node --test remotion/tests/*.test.mjs   # Remotion 单测（24 条）
```

### 11.5 用户验收清单（回归用）

1. **一键生成** → 道法动画 → 分镜生成
2. **编导** ◀▶ 切换分镜 → 预览游戏化（擂台/雷达/HUD/转场/属性环）
3. **AI 空镜** → 选中分镜 → 面板点「AI 生成空镜」→ 右下角 Toast → 3–6 分钟 MP4 填入
4. **渲染 MP4**（需 5060 在线）
5. **克隆音色**（需 voice 模型加载完）

### 11.6 待办 / 下次优先

| 优先级 | 项 | 说明 |
|---|---|---|
| P0 | 验证 `dc23b7d` AI 空镜修复 | 用户反馈「点击没反应」已修；需 Ctrl+F5 硬刷新后复验 |
| P0 | 5060 唤醒 + 全链路出片 | render/voice 530 时先跑看门狗 |
| P1 | MuseTalk 数字人 MVP | 用户确认方向 A（照片+克隆音→对口型）；端口 `:9235` presenter.1go.im |
| P2 | 太极起片 redesign | 等设计师 `docs/tao-taichi-redesign.md` |
| P2 | 仓库根旧 `app.js/index.html/styles.css` 清理 | 冗余，不影响运行 |

### 11.7 已知限制

- Agnes 免费期排队 **3–6 分钟**，定位为**离线预生成 B-roll**，不适合同步等出片
- 配音缺 `OPENAI_API_KEY` 时 worker 静音兜底
- 超大产品图 (>2.5MB) Agnes 自动改文生视频
- git 全局代理端口 7897 失效，push 用 `-c http.proxy=http://127.0.0.1:7890`
