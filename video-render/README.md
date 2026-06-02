# video-render — 3C 测评视频渲染（HyperFrames：HTML → MP4）

这是「导演台」的**视频渲染**模块，用 [HyperFrames](https://hyperframes.heygen.com)
把一段 HTML/CSS/JS 合成（GSAP 可 seek 动画）渲染成 MP4。和克隆音色服务一样，
它跑在你的 **GPU 台式机（RTX 5060）** 上，主站点（Cloudflare）只负责生成脚本/Timeline，
**长时间渲染必须放外部 worker**。

> 当前状态：**Timeline JSON → HTML 自动生成已打通**。`build.mjs` 把导演台的
> Timeline JSON 自动转成 9:16 合成 HTML（每个分镜一段 `.scene.clip`，按 `data-start`
> 平铺，配 Ken Burns + 标题/字幕淡入 + 数字高亮）。`index.html` 即由
> `samples/timeline.sample.json` 生成的演示产物。下一步接 `/api/render` 转发 + 配音校准。

---

## 它能做什么（已验证）

- 输入：一段 HTML 合成（`index.html`），根元素用 `data-width/height/duration/fps` 定义画布，
  每个图层是带 `data-start/data-duration/data-track-index` 的 `class="clip"` 子元素。
- 动画：GSAP 时间线（`window.__timelines["main"]`，必须 `paused`），HyperFrames 按帧 seek 截图。
- 输出：1080×1920 / 30fps MP4。
- 校验：`lint`（静态结构）+ `validate`（无头 Chrome 跑一遍，抓 JS 报错/缺资源/对比度）。

本样例实测：`lint` 0 error、`validate` 无 console 错误且 20 处文字过 WCAG AA、
`render` 出 8s / 1080×1920 / ~1.2MB MP4。

---

## 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | **22+** | HyperFrames 要求；低于 22 直接报错 |
| FFmpeg / FFprobe | 4.4+ | 编码与时长探测 |
| Chrome / chrome-headless-shell | 任意近版 | 逐帧截图；见下方「无头浏览器」 |
| 中文字体 | 必需 | 否则中文渲染成方块，见下方「中文字体」 |

`npx hyperframes doctor` 可一键自检上面这些。

---

## Timeline JSON → HTML（自动生成）

把导演台导出的 Timeline JSON 一键转成可渲染的合成 HTML：

```bash
cd video-render
node build.mjs --in samples/timeline.sample.json --out index.html --assets assets
bash render.sh            # 再渲成 MP4
```

- 输入：`{ project, insights, timeline[] }`（导演台 `generate-timeline` 的产物）。
- 每个 `timeline[i]` → 一段 `.scene.clip`：背景层（`visual.asset` 命中 `assets/` 里的图就用，
  否则纯渐变背景）+ 渐变遮罩 + 标题(`visual.headline`)/副标题(`visual.detail`)/字幕(`subtitle`∨`voiceover`)。
- 动画数据驱动：产品图 Ken Burns、标题/字幕逐镜淡入；字幕里的「数字+单位」（如 `12 小时`/`20%`）自动高亮。
- **安全降级**：缺字段不报错——没产品图→纯背景，没标题→只渲字幕。
- **确定性**：不用 `Date.now()`/`Math.random()`，相同输入产出相同 HTML（符合 HyperFrames 渲染要求）。
- `index.html` 顶部标了「由 build.mjs 自动生成，请勿手改」——要改样式/动画请改 `build.mjs`。

`buildHtml(timeline, { assetsDir })` 也作为 ES 模块导出，供后续渲染 worker 程序化调用。

---

## 一键渲染

```bash
cd video-render
bash render.sh            # 校验 + 软件渲染，输出 out.mp4
bash render.sh --gpu      # RTX 50 系列用 NVENC 硬件编码，更快
bash render.sh -o foo.mp4 # 指定输出文件名
```

或用 npm scripts：

```bash
npm run check     # lint + validate
npm run render    # 软件渲染 → out.mp4
npm run render:gpu
```

`render.sh` 会先检查 Node/ffmpeg 版本和中文字体，再 `lint`+`validate`，最后渲染。

---

## ⚠ 中文字体（最容易踩的坑）

HyperFrames 渲染用的是一套「**确定性字体**」机制：它只认内置可解析的字体名，
**默认不含中文字体**。如果合成里用了 `PingFang SC / 微软雅黑 / 思源黑体` 等，
渲染时会警告 `No deterministic font mapping`，并回退到无中文字形的字体 →
**中文显示为方块**。三种解决办法，任选其一：

1. **渲染机安装中文字体（最简单）**
   - Debian/Ubuntu：`sudo apt-get install -y fonts-noto-cjk`
   - Windows：自带「微软雅黑」，通常无需安装。
   本样例在装了文泉驿字体的 Linux 上能正常渲染中文，就是靠这条。

2. **在模板里内嵌字体（最稳、可移植）** —— 正式上线推荐
   下载一份中文 woff2（如 Noto Sans SC），放到 `assets/fonts/`，在 `index.html` 的
   `<style>` 顶部加：
   ```css
   @font-face {
     font-family: "Noto Sans SC";
     src: url("assets/fonts/NotoSansSC.woff2") format("woff2");
     font-weight: 100 900;
   }
   ```
   再把 `font-family` 改成 `"Noto Sans SC", sans-serif`。这样换任何机器渲染都一致。

3. Docker 渲染镜像里把字体装进镜像。

---

## 无头浏览器

`doctor`/`render` 默认用系统 Chrome。若提示 `Failed to launch the browser process`
（常见于容器/无 sandbox 环境），装官方的 chrome-headless-shell 并指过去：

```bash
npx @puppeteer/browsers install chrome-headless-shell@stable
export PRODUCER_HEADLESS_SHELL_PATH=/abs/path/to/chrome-headless-shell
export HYPERFRAMES_BROWSER_PATH=$PRODUCER_HEADLESS_SHELL_PATH
```

你那台 5060 桌面环境装了正常 Chrome 一般不需要这步。

---

## 目录结构

```
video-render/
  build.mjs          # Timeline JSON → 合成 HTML 生成器（核心）
  samples/
    timeline.sample.json  # 示例 Timeline（5 镜，结构同导演台产物）
  index.html         # 由 build.mjs 从样例生成的演示合成（请勿手改）
  assets/
    product.jpg      # 占位产品图（正式用换成实拍/抠图/官方素材）
  hyperframes.json   # HyperFrames 项目配置
  meta.json          # 画布尺寸/帧率元信息
  package.json       # check / render 脚本（已钉 hyperframes 版本）
  render.sh          # 一键校验+渲染脚本
```

---

## 路线（后续 PR）

1. ~~**Timeline → 模板生成**：把导演台的 Timeline JSON 自动转成这套 HTML（每镜一段 clip）。~~ ✅ 本 PR 已完成（`build.mjs`）。
2. **配音对齐**：复用 `/api/tts`（含克隆音色）合成每镜音频，按真实时长校准 `data-duration`；
   可选 `hyperframes transcribe` 出逐词时间戳做卡拉OK字幕。
3. **`/api/render` 转发**：主站点加渲染按钮，用 `RENDER_URL` 转发到本 worker（与 `VOICE_CLONE_URL` 并列），
   GPU 机离线时前端给降级提示。
4. **数据可视化参数卡 / 横评对比 / 多端裁剪（9:16·16:9·封面）**。
