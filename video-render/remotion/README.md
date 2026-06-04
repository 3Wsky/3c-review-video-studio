# Remotion 渲染内核（与 HyperFrames 并存的另一套渲染引擎）

用 **React 写视频**（Remotion）把导演台的 Timeline JSON 渲成 MP4。和 `video-render/`
里的 HyperFrames 引擎是**两套并存**的引擎：同一份 Timeline、同样的镜头语义（产品图
Ken Burns、标题/字幕、数字高亮、横评对比矩阵、事实溯源/素材角标、多端裁剪 9:16/16:9/1:1），
区别只是一个用 HTML+GSAP 逐帧截图、一个用 React 组件。

> 同一套 React 合成（`src/ReviewVideo.jsx`）还被网页 `<Player>` 实时预览复用，
> 这样「预览所见」与「出片所得」像素一致。

## 目录

```
remotion/
  src/
    scene-model.mjs   共享分镜模型（纯 JS，无 React）：归一化 Timeline、横评胜者判定、字幕数字高亮 token
    layout.mjs        各元素定位/字号（复刻 build.mjs 的 CSS，按画幅覆盖）
    anim.mjs          把 GSAP 的「入场 from」翻译成基于帧的插值
    ReviewVideo.jsx   主合成 + Scene/Highlight/CompareMatrix/MetricCard 组件
    Root.jsx          注册 Composition（用 calculateMetadata 从 props 推导画幅/时长）
    index.jsx         registerRoot 入口
  render.mjs          程序化渲染入口（worker 调它出无声视频）
  package.json
```

## 本地用法

```bash
cd video-render/remotion
npm install                       # 首次会装 remotion 等依赖；首次渲染会下载 Chrome Headless Shell

# 打开 Remotion Studio 实时调（默认用 samples/timeline.sample.json）
npm run studio

# 直接出片（样例）
npm run render                    # → out.mp4（9:16）

# 指定输入/画幅/素材目录
node render.mjs --in ../samples/timeline.sample.json --out out.mp4 --format 16:9 --assets ../assets
```

参数：

| 参数 | 说明 |
|---|---|
| `--in` | Timeline JSON 路径（`{ project, insights, timeline[] }`） |
| `--out` | 输出 MP4 路径（默认 `out.mp4`） |
| `--format` | `9:16`（默认）/ `16:9` / `1:1` |
| `--assets` | 素材目录；按 `visual.asset` 名匹配图片，匹配不到用目录里第一张兜底，编码成 data URL 传进合成 |
| `--concurrency` | 渲染并发（默认 Remotion 自适应） |

`render.mjs` 产出的是**无声视频**：音频仍由外层 worker（逐镜 TTS + ffmpeg 混音）负责，
所以「换引擎」只换画面渲染，配音/时长校准/R2 上传等流程完全不变。

## 逐词对齐字幕（whisper）

底部字幕做「卡拉OK逐字点亮」。两种节奏：

- **真·逐词对齐**：worker 用 whisper.cpp（`whisper.mjs`，本地离线、免费）转写每镜配音，拿到词级时间戳写回 `timeline[].captions`（`[{ fromMs, toMs }]`，相对镜起点）；字幕据此跟着真实语音走，连停顿都会停。
- **线性回退**：没有 `captions` 时（如网页 `<Player>` 预览本身无音频），字幕按本镜时长匀速点亮。

进度计算是共享纯函数 `karaokeFraction(captions, tMs)`（见 `scene-model.mjs`，每个 token 等权、区间内插值、停顿不前进），渲染内核与网页预览共用。

whisper.cpp 二进制与模型（base，~148MB）首次用时由 `@remotion/install-whisper-cpp` **懒安装**到 `remotion/whisper.cpp/`（已 gitignore，不入库）。worker 侧默认对 `engine=remotion` 开启；设 `WHISPER_CAPTIONS=0` 可关闭（退回线性）。

## 数卡/单指标镜入场动效（数字滚动 + 进度环）

普通分镜里关键数字做「入场动效」，和横评矩阵那套（条形增长 + 数字滚动）一致地由共享纯函数驱动：

- **标题数字滚动**（自动）：任意分镜的 `headline` 里第一个数值在入场时从 0 缓动到目标（如「机身重量 199 克」→ 199 滚上来）。走 `formatCountUp(str, target, p)`（`scene-model.mjs`，`target=null` 时自动取串里的数），横评格也复用同一函数。
- **数据卡 + 进度环**（结构化，opt-in）：分镜带 `visual.metric` 时，居中渲染大数字滚动 + 圆形进度环。
  - 字段：`{ value, unit, label, caption, max, min, better }`。`value` 必填且可解析为数值。
  - 给了 `max`（且 `>min`，`min` 默认 0）时进度环按 `(value-min)/(max-min)` 占比填充，并显示「/ max 单位」；缺省则环退化为「入场扫满一圈」的装饰。
  - `better: "low"`（越小越好，如降噪 -45dB）只改强调色（青绿），不改占比。
  - 进度环占比走 `metricRingFraction(metric, p)`，随入场 `p` 从 0 长到目标占比。

`visual.metric` 存在时该镜不再渲染普通 `detail` 文本（数据卡的 `caption` 取而代之）。渲染内核与网页 `<Player>` 预览共用同一套组件/纯函数，两边像素一致。

## 在 worker 里启用

`video-render/worker.mjs` 的 `/render` 接口收 `engine` 字段：

- `engine: "hyperframes"`（默认）：原 HyperFrames 出片。
- `engine: "remotion"`：走本目录的 `render.mjs`。**前提：先在本目录 `npm install`**，
  否则 worker 返回明确报错。`/health` 的 `engines` 数组会显示当前可用引擎。

前端「渲染视频」按钮可带上 `engine`，经 `/api/render`（Cloudflare Function 或 FastAPI）透传到 worker。

## 字体

和 HyperFrames 一样，Remotion 用无头 Chrome 渲染，**中文需要系统装好 CJK 字体**
（Linux：`sudo apt install fonts-noto-cjk`），否则中文显示方块。

## 关于 Remotion 授权

Remotion 是 source-available，**公司团队（>3 人）需购买授权**，个人/小团队免费。
详见 <https://www.remotion.dev/license>。HyperFrames 引擎不受此限制，二者按需选用。
