# 游戏化测评视频 · 批次1 设计交付

> **状态**：P0 实现依据 · 架构师可直接按本文打包素材与接入 Token  
> **关联文件**：`src/design/game-tokens.css` · `public/game-assets/`（待架构师落盘）  
> **画布基准**：1920×1080（16:9），预览舞台等比缩放

---

## 1. Game Token 落地清单

### 1.1 CSS 变量（已写入 `src/design/game-tokens.css`）

| 分类 | 变量前缀 | 数量 | 说明 |
|------|----------|------|------|
| HUD 语义色 | `--game-hud-*` | 14 | 青/品红/金/青绿/红 + dim/glow |
| 擂台 PK | `--game-pk-*` | 6 | 左右阵营色、VS、伤害数字 |
| 面板/扫描 | `--game-panel-*` `--game-scanline` | 5 | HUD 玻璃底、角标、扫描线 |
| 属性环 | `--game-ring-*` `--game-stat-*` | 7 | 环轨道/填充/节点/中心数字 |
| 雷达 | `--game-radar-*` | 3 | 网格、扫描扇、顶点高亮 |
| 拍摄引导 | `--game-frame-*` `--game-guide-*` | 5 | 取景框、准星、文案 |
| 转场 | `--game-glitch-*` `--game-speedline-*` 等 | 7 | 故障/速度线/扫描 wipe |
| 字体 | `--game-font-*` | 3 | Orbitron / Rajdhani / Share Tech Mono |
| 字号 | `--game-text-*` | 6 | 1080p 基准字号 |
| 动效 | `--game-dur-*` `--game-ease-*` | 10 | 与 GSAP 时间轴对齐 |
| 布局 | `--game-stat-*` `--game-pk-*` | 6 | Stat Ring / 擂台尺寸常量 |

完整值见 `src/design/game-tokens.css`，已在 `src/design/index.css` 引入。

### 1.2 字体引入方式（推荐：双轨）

| 场景 | 方式 | 路径 / 代码 |
|------|------|-------------|
| **开发预览**（当前） | Google Fonts CDN | `game-tokens.css` 顶部 `@import` |
| **Vite 生产包**（推荐） | 本地 woff2 | `public/fonts/game/Orbitron-*.woff2` 等 |
| **Remotion 渲染**（必须本地） | `@fontface` 指向 `public/fonts/game/` | 避免 CI 无网失败 |

**npm 备选**（架构师二选一）：

```bash
npm i @fontsource/orbitron @fontsource/rajdhani @fontsource/share-tech-mono
```

```js
// main.jsx 顶部
import '@fontsource/orbitron/700.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/share-tech-mono/400.css';
```

**用途分配**：

| 字体 | Token | 用途 |
|------|-------|------|
| Orbitron 700/900 | `--game-font-display` | 中心大数字、VS、伤害弹跳、Beat 标题 |
| Rajdhani 600/700 | `--game-font-hud` | HUD 标签、血条旁产品名、拍摄引导文案 |
| Share Tech Mono | `--game-font-mono` | 时间码、参数值、扫描读数 |

### 1.3 音效 Token（JS 常量，放 `shared/game/audio-manifest.mjs`）

| ID | 文件（落盘后） | 触发场景 | 时长参考 |
|----|----------------|----------|----------|
| `sfx_ui_open` | `ui/interface_open.ogg` | HUD 面板入场 | 0.3s |
| `sfx_scan_sweep` | `ui/scan_sweep.ogg` | 雷达扫描 / 扫描 wipe | 1.2s |
| `sfx_stat_pop` | `ui/stat_pop.ogg` | 属性节点点亮 | 0.25s |
| `sfx_count_tick` | `ui/count_tick.ogg` | 数字滚动尾音 | 0.15s |
| `sfx_impact_hit` | `combat/impact_hit.ogg` | 擂台伤害命中 | 0.4s |
| `sfx_impact_crit` | `combat/impact_crit.ogg` | 暴击 / 反转 Beat | 0.55s |
| `sfx_whoosh` | `ui/whoosh.ogg` | 速度线转场 | 0.35s |
| `sfx_glitch` | `ui/glitch.ogg` | 故障风转场 | 0.2s |
| `sfx_level_up` | `ui/level_up.ogg` | 属性环填满 | 0.6s |
| `sfx_camera_beep` | `ui/camera_beep.ogg` | 拍摄引导准星对齐 | 0.18s |

音量建议：`sfx_*` 峰值 -6dB，与口播 ducking 留 12dB headroom。

---

## 2. Kenney / Hove 素材选型清单

### 2.1 下载包（直接链接）

| 包名 | 许可 | 下载 | 体积 |
|------|------|------|------|
| **UI Pack - Sci-Fi** | CC0 | [kenney.nl/assets/ui-pack-sci-fi](https://kenney.nl/assets/ui-pack-sci-fi) → `kenney_ui-pack-scifi.zip` | ~768 KB |
| **UI Pack**（通用血条/面板） | CC0 | [kenney.nl/assets/ui-pack](https://kenney.nl/assets/ui-pack) → `kenney_ui-pack.zip` | ~1.1 MB |
| **Sci-fi Sounds** | CC0 | [kenney.nl/assets/sci-fi-sounds](https://kenney.nl/assets/sci-fi-sounds) → `kenney_sci-fi-sounds.zip` | ~2 MB |
| **Interface Sounds** | CC0 | [kenney.nl/assets/interface-sounds](https://kenney.nl/assets/interface-sounds) → `kenney_interface-sounds.zip` | ~1 MB |
| **Impact Sounds** | CC0 | [kenney.nl/assets/impact-sounds](https://kenney.nl/assets/impact-sounds) → `kenney_impact-sounds.zip` | ~1.5 MB |
| **UI Audio** | CC0 | [kenney.nl/assets/ui-audio](https://kenney.nl/assets/ui-audio) → `kenney_ui-audio.zip` | ~500 KB |
| **Hove Sci-fi UI**（备选） | 见包内 | [opengameart.org/content/sci-fi-ui-sounds](https://opengameart.org/content/sci-fi-ui-sounds) | 视包而定 |

> OpenGameArt 镜像：`kenney_ui-pack-scifi.zip` @ [opengameart.org/content/ui-pack-sci-fi](https://opengameart.org/content/ui-pack-sci-fi)

### 2.2 首发 Sprite 选型（解压后复制并重命名）

建议目录：`public/game-assets/sprites/kenney/`

#### 来自 `kenney_ui-pack-scifi/PNG/Default/`

| 源文件 | 目标路径 | 用途 |
|--------|----------|------|
| `button_rectangle_depth_flat.png` | `sprites/kenney/btn_panel.png` | HUD 面板底 |
| `button_rectangle_depth_gloss.png` | `sprites/kenney/btn_panel_gloss.png` | 高亮按钮 |
| `bar_round_large_m.png` | `sprites/kenney/bar_hp_track.png` | 擂台血条轨道 |
| `bar_round_large_m_outline.png` | `sprites/kenney/bar_hp_fill_mask.png` | 血条填充遮罩 |
| `panel_rectangle.png` | `sprites/kenney/panel_hud.png` | 属性环外框 |
| `panel_corner_tl.png` + `panel_corner_tr.png` + `panel_corner_bl.png` + `panel_corner_br.png` | `sprites/kenney/corner_*.png` | 取景框四角 |
| `crosshair_a.png` | `sprites/kenney/crosshair.png` | 拍摄引导准星 |
| `icon_checkmark.png` | `sprites/kenney/icon_check.png` | 拍摄 checklist 完成 |
| `icon_cross.png` | `sprites/kenney/icon_cross.png` | 拍摄禁忌提示 |
| `progress_bar_round_large.png` | `sprites/kenney/ring_track.png` | 属性环轨道贴图（可选） |

#### 来自 `kenney_ui-pack/PNG/Blue/Default/`（蓝色系对齐 `--game-hud-cyan`）

| 源文件 | 目标路径 | 用途 |
|--------|----------|------|
| `bar_round_gloss_large.png` | `sprites/kenney/bar_stat_track.png` | 单维进度条 |
| `bar_round_gloss_small.png` | `sprites/kenney/bar_stat_sm.png` | 节点下微条 |
| `button_square_depth_flat.png` | `sprites/kenney/node_off.png` | 属性节点（未点亮） |
| `button_square_depth_gloss.png` | `sprites/kenney/node_on.png` | 属性节点（点亮） |
| `icon_diamond.png` | `sprites/kenney/icon_vs.png` | 擂台 VS 徽章底 |

### 2.3 首发音效选型

建议目录：`public/game-assets/audio/`

#### 来自 `kenney_sci-fi-sounds/Audio/`

| 源文件 | 目标路径 | 映射 ID |
|--------|----------|---------|
| `laserSmall_000.ogg` | `audio/ui/scan_sweep.ogg` | `sfx_scan_sweep` |
| `lowFrequency_explosion_000.ogg` | `audio/ui/stat_pop.ogg` | `sfx_stat_pop` |
| `spaceEngineSmall_000.ogg` | `audio/ui/whoosh.ogg` | `sfx_whoosh` |
| `thrusterFire_000.ogg` | `audio/ui/glitch.ogg` | `sfx_glitch` |

#### 来自 `kenney_interface-sounds/Audio/`

| 源文件 | 目标路径 | 映射 ID |
|--------|----------|---------|
| `confirmation_001.ogg` | `audio/ui/interface_open.ogg` | `sfx_ui_open` |
| `tick_001.ogg` | `audio/ui/count_tick.ogg` | `sfx_count_tick` |
| `select_001.ogg` | `audio/ui/camera_beep.ogg` | `sfx_camera_beep` |

#### 来自 `kenney_impact-sounds/Audio/`

| 源文件 | 目标路径 | 映射 ID |
|--------|----------|---------|
| `impactMetal_medium_000.ogg` | `audio/combat/impact_hit.ogg` | `sfx_impact_hit` |
| `impactBell_heavy_000.ogg` | `audio/combat/impact_crit.ogg` | `sfx_impact_crit` |

#### 来自 `kenney_ui-audio/Audio/`

| 源文件 | 目标路径 | 映射 ID |
|--------|----------|---------|
| `click1.ogg` | `audio/ui/level_up.ogg` | `sfx_level_up` |

### 2.4 目录树（架构师一次性落盘）

```
public/game-assets/
├── sprites/kenney/
│   ├── btn_panel.png
│   ├── bar_hp_track.png
│   ├── panel_hud.png
│   ├── corner_tl.png … corner_br.png
│   ├── crosshair.png
│   ├── node_on.png / node_off.png
│   └── icon_vs.png
├── audio/
│   ├── ui/          (7 files)
│   └── combat/      (2 files)
└── fonts/game/      (Orbitron/Rajdhani/ShareTechMono woff2)
```

---

## 3. P0 分镜线框

### 3.1 属性环 Stat Ring（升级版）

**场景时长**：6–8s · **数据源**：`visual.dataviz` kind=`ring`（3–4 项）

#### 布局（1920×1080，单位 px）

```
┌──────────────────────────────────────────────────────────────┐
│  [标题] 实测续航  ·  Rajdhani 22px  #ffd166  左上 (80, 72)    │
│                                                              │
│              ┌─── node N (续航) ───┐                          │
│              │  56×56  y=180       │                          │
│              └─────────┬──────────┘                          │
│   node W ──────────────┼────────────── node E                │
│   (重量)               │               (快充)                 │
│   x=280                │               x=1580                 │
│              ┌─────────▼──────────┐                          │
│              │    ╭──────────╮    │  外径 320, 描边 18        │
│              │    │   12.5   │    │  中心数字 Orbitron 96px    │
│              │    │   小时   │    │  单位 24px Rajdhani        │
│              │    ╰──────────╯    │  环心 (960, 520)           │
│              └─────────┬──────────┘                          │
│              ┌─── node S (屏幕) ───┐                          │
│              │  y=860              │                          │
│              └─────────────────────┘                          │
│  [Kenney panel_hud 铺底 640×480 @ (640, 280)]                 │
└──────────────────────────────────────────────────────────────┘
```

| 元素 | 位置 (x, y) | 尺寸 | 字体/色 |
|------|-------------|------|---------|
| 标题 | 80, 72 | — | Rajdhani 22px `--game-hud-gold` |
| 环心 | 960, 520 | 外径 320, stroke 18 | 轨道 `--game-ring-track` / 填充 `--game-ring-fill` |
| 中心值 | 960, 500 | — | Orbitron 96px `#fff` |
| 中心单位 | 960, 568 | — | Rajdhani 24px `--game-stat-unit` |
| 节点 N | 960, 180 | 56×56 | 图标 24px + 标签 14px |
| 节点 E | 1580, 520 | 56×56 | 同上 |
| 节点 S | 960, 860 | 56×56 | 同上 |
| 节点 W | 280, 520 | 56×56 | 同上 |
| HUD 底板 | 640, 280 | 640×480 | `panel_hud.png` + `--game-panel-border` |

#### 动效时序表

| 时间 | 元素 | 动作 | 缓动 | 音效 |
|------|------|------|------|------|
| 0.00s | 底板 | opacity 0→1, scale 0.92→1 | `--game-ease-snap` 0.28s | `sfx_ui_open` |
| 0.15s | 环轨道 | stroke-dashoffset 100%→0 | 0.9s ease-out | — |
| 0.30s | 节点 N | scale 0→1.15→1 | `--game-ease-impact` 0.28s | `sfx_stat_pop` |
| 0.45s | 节点 E | 同上（错峰 +150ms） | 同上 | `sfx_stat_pop` |
| 0.60s | 节点 S | 同上 | 同上 | `sfx_stat_pop` |
| 0.75s | 节点 W | 同上 | 同上 | `sfx_stat_pop` |
| 0.20s | 中心数字 | count-up 0→目标值 | 1.2s linear | `sfx_count_tick` @0.8s |
| 0.90s | 环填充 | frac 0→实际占比 | 0.9s 与轨道同步 | — |
| 1.10s | 全局 | 环 `--game-ring-glow` 脉冲一次 | 0.4s | `sfx_level_up` |
| 6.00s | 出场 | 扫描 wipe 离场（见 §3.2） | 0.42s | `sfx_whoosh` |

> 与现有 `DataVizCard` RingChart 关系：预览舞台可继续用 SVG stroke-dash；渲染端用 GSAP 驱动同一套 `ringDash()` + 本布局常量。

---

### 3.2 Beat 结构转场示意

**90s 六段 Beat**（起→编→测→比→转→合）每 8–12s 切换感官层：

| Beat | 时长 | 画面层 | 转场入场 |
|------|------|--------|----------|
| B1 真人开场 | 8s | 真人 3s + 口播字幕 | 速度线入场 |
| B2 空镜氛围 | 6s | Pexels 动态空镜 | 扫描 wipe |
| B3 实拍特写 | 10s | 用户上传产品图 Ken Burns | 故障风 0.18s |
| B4 数据擂台 | 12s | Stat Ring / 擂台 PK | 扫描光带 |
| B5 反转结论 | 10s | 真人 + 大字结论 | 速度线 + 闪白 |
| B6 CTA | 6s | 品牌 + 引导拍摄 | 光圈淡出 |

#### 转场 A：速度线入场（B1/B5）

```
参数：
  --game-speedline-angle: -12deg
  线条：12–18 条白色半透明，宽 2–6px，长 120–280px
  起点：x=1920 右侧屏外 → 终点：x=-200
  时长：420ms (--game-dur-speedline)
  叠加：轻微 motion blur 4px
  同时：下一镜头 scale 1.08→1.0 (280ms)
  音效：sfx_whoosh
```

```
    \\\  |  /
     \\  | /     ← 线条向左掠过
      \\ |/
  ──────●──────  下一镜头从中心展开
```

#### 转场 B：扫描光带 wipe（B2/B4 入场）

```
参数：
  光带宽度：18% 屏宽 (--game-scan-wipe-width)
  颜色：linear-gradient(90deg, transparent, --game-hud-cyan-glow, transparent)
  轨迹：x 从 -20% → 120%，时长 1.4s
  边缘：1px --game-hud-cyan 硬边 + 外发光 24px
  旧画面：被扫过区域 desaturate(0.3) + brightness(0.7)
  音效：sfx_scan_sweep
```

```
  [旧画面]  |▓▓▒░░░|  [新画面]
            ↑ 扫描光带
```

---

### 3.3 擂台 PK 线框（P1 预埋 · 用户已点单）

**场景时长**：10–12s · **数据源**：`visual.dataviz` kind=`bar` 两项对比或 compare 模式

#### 布局

```
┌──────────────────────────────────────────────────────────────┐
│                    擂台 PK · 续航对决                          │
│                    Rajdhani 22px 顶部居中                       │
│  ┌─────────────────────────────┐  ┌─────────────────────────┐ │
│  │ [产品A实拍 120×120]          │  │          [产品B实拍]     │ │
│  │  华为 Nova16                 │  │           iPhone 16      │ │
│  │  ████████████░░░  78%       │  │       ░░░████████████  92% │ │
│  │  HP 条 h=28  cyan            │  │            HP 条 magenta │ │
│  └─────────────────────────────┘  └─────────────────────────┘ │
│                         ┌────┐                                  │
│                         │ VS │  64×64  Orbitron  icon_vs 底     │
│                         └────┘                                  │
│              ┌──────────────────────┐                           │
│              │     -24%  伤害数字    │  ← 弹跳 36px 金色 crit    │
│              │   (输家一侧弹出)      │     impact 0.65s          │
│              └──────────────────────┘                           │
│  底部参数条：快充 │ 重量 │ 屏幕 │ 各 2px 分隔  gold 高亮胜项      │
└──────────────────────────────────────────────────────────────┘
```

| 元素 | 位置 | 尺寸 | 说明 |
|------|------|------|------|
| 左阵营区 | 80, 200 | 760×400 | `--game-pk-left` 描边 |
| 右阵营区 | 1080, 200 | 760×400 | `--game-pk-right` 描边 |
| 头像框 | 阵营顶中 | 120×120 | 用户实拍圆角 12px |
| 血条 | 头像下 24px | 宽 80% 阵营, h=28 | Kenney `bar_hp_track` |
| VS 徽章 | 928, 480 | 64×64 | 呼吸光晕 `--game-pk-vs` |
| 伤害数字 | 输家血条上方 | — | Orbitron 36px, `--game-ease-impact` |
| 胜项高光 | 底部 metric | — | 金色下划线 2px |

#### 动效时序

| 时间 | 动作 | 音效 |
|------|------|------|
| 0.0s | 双方面板从左右滑入 | `sfx_ui_open` |
| 0.3s | 血条从 0 涨到初始值 | — |
| 0.8s | VS 徽章 scale 0→1.2→1 | `sfx_stat_pop` |
| 1.2s | 对比项逐项闪烁（+200ms stagger） | `sfx_count_tick` |
| 2.0s | 劣势方伤害数字弹出 `-N%` | `sfx_impact_hit` |
| 2.4s | 优势方血条闪光 + crit 数字 | `sfx_impact_crit` |
| 3.0s | 底部胜项 gold 扫光 | `sfx_level_up` |

---

### 3.4 雷达 HUD 五维扫描（P2 · Valorant 特工选择风）

**场景时长**：6–8s · **数据源**：`visual.radar = { dims: [{label, value, max?}] }`（≥3 维，最多 6 维）

**与 Stat Ring 关系**：

| 条件 | 渲染组件 | 说明 |
|------|----------|------|
| 有 `visual.metric` | `StatRingCard` 四角节点 | radar dims 作属性环外围节点 |
| 无 metric，有 radar | `RadarHUDCard` 独立成镜 | 本节 spec |
| 有 `visual.dataviz` kind=radar | `DataVizCard` 静态雷达 | 无扫描动画，批次1 遗留 |

**Timeline JSON**：

```json
{
  "visual": {
    "type": "雷达扫描",
    "radar": {
      "dims": [
        { "label": "性能", "value": 92, "max": 100 },
        { "label": "续航", "value": 78, "max": 100 },
        { "label": "影像", "value": 85, "max": 100 },
        { "label": "散热", "value": 70, "max": 100 },
        { "label": "性价比", "value": 88, "max": 100 }
      ]
    }
  }
}
```

`frac` 由 `normalizeRadar()` 计算：分母 = 各维 `max` 峰值（缺省 max 时取全体 value 峰值）。

#### 布局（预览卡 · 字幕条上方）

```
┌──────────────────────────────────────────────┐
│ ┌─┐                              ┌─┐         │  ← HUD L 角标 14px
│ │                              │ │         │
│         RADAR SCAN  (Orbitron)               │  ← .rh-title
│              ┌─────────┐                     │
│             /   ·  ·   \                    │  ← 3 层网格 33%/66%/100%
│            │  ╱ sweep ╲  │                   │  ← 扫描扇形 + 扫描线
│             \  value   /                    │  ← 值多边形（逐顶点弹出）
│              └─────────┘                     │
│           性能  续航  影像 …                  │  ← 标签 orbit r+18
│ └─┘                              └─┘         │
└──────────────────────────────────────────────┘
  bottom: 92px · left/right: 18px · z-index: 6
```

| 元素 | 预览尺寸 | 1080p Remotion 等比 | Token |
|------|----------|---------------------|-------|
| 卡片底 | full width − 36px | layout.radar | `--game-panel-bg` |
| 边框 | 1px | — | `--game-panel-border` |
| SVG 画布 | 188×188 viewBox | scale × layout | — |
| 雷达半径 r | 60 (= 94−34) | 按比例放大 | — |
| 网格层 | 33% / 66% / 100% | 同左 | `--game-radar-grid` |
| 扫描线 | stroke 2px + dot r=3 | 同左 | `--game-hud-cyan` |
| 扫描扇形 | fill 12% cyan | 同左 | `--game-hud-cyan` |
| 值多边形 | fill 26% + stroke 2px | 同左 | `--game-hud-cyan` |
| 顶点锁定 | r 2.5→4.5 + 脉冲 | 同左 | `--game-radar-vertex` |
| 标签 | 10px Rajdhani | `--game-text-label` | 锁定后 #fff |

#### 动效时序（共用 `geometry.mjs` · 预览 1800ms · Remotion 按镜长插值）

| 进度 p | 动作 | 参数 | 音效 |
|--------|------|------|------|
| 0.0 | 卡片淡入 | opacity 0→1, 200ms | `sfx_ui_open` |
| 0.0–0.87 | 扫描线旋转 | `radarSweepAngle(p) = p × 1.15` 圈 | — |
| 每顶点 i | lock-on | `locks[i] = clamp((sweep − i/n) / 0.14)` | 锁定>0.5 → `sfx_scan_sweep` |
| 同步 | 值多边形弹出 | 半径 = frac × lock | — |
| 顶点 | 脉冲放大 | scale 0.6→1.35→1, 550ms | `sfx_stat_pop` |
| 0.87–1.0 | 扫描线淡出 | sweepOpacity 线性降至 0 | — |
| 1.0 |  hold | 全顶点点亮，值多边形完整 | — |

**几何 API**（`shared/dataviz/geometry.mjs`）：

```js
radarLockFractions(n, p, lockSpan = 0.14)
radarValuePoints(n, cx, cy, r, fracs, locks)
radarSweepEndpoint(cx, cy, r, p)  // → { x, y, angleDeg, done }
```

#### 渲染优先级（与 Remotion 对齐）

```
battle > shootGuide > metric(StatRing+radar节点) > radar(独立) > dataviz > info-card
```

#### 实现文件

| 端 | 路径 |
|----|------|
| 预览 | `src/features/preview/RadarHUDCard.jsx` + `radar-hud.css` |
| 几何 | `shared/dataviz/geometry.mjs` |
| 归一化 | `video-render/remotion/src/scene-model.mjs` → `normalizeRadar()` |
| Remotion | `ReviewVideo.jsx` → `<RadarHUD>`（架构师 P2 进行中） |

---

### 3.5 P2 转场库补充（glitch / pixel / crack / iris）

| 转场 | Beat 用途 | 时长 | Token | 预览类名 |
|------|-----------|------|-------|----------|
| `glitch-cut` | B3 实拍特写入场 | 180ms | `--game-glitch-shift` | `.vt-glitch-cut` |
| `pixel-dissolve` | 数据卡离场 | 720ms | `--game-pixel-dissolve-size: 8px` | `.vt-pixel-dissolve` |
| `screen-crack` | 反转 Beat 冲击 | 480ms | — | `.vt-screen-crack` |
| `iris-close` | B6 CTA 光圈收束 | 850ms | — | `.vt-iris-close` |

**glitch-cut 参数**：RGB 分离 ±6px + 品红/青硬边 + 扫描线纹理，steps(3) 切帧感。

**iris-close 参数**：径向遮罩 scale 2.2→0，box-shadow 9999px 模拟光圈闭合。

预览 CSS 见 `src/features/preview/transitions.css`；Remotion 帧动画待架构师对齐。

---

## 4. 落地优先级（批次对照）

| 优先级 | 内容 | 本批次 | 架构师动作 |
|--------|------|--------|------------|
| **P0** | Game Token CSS | ✅ 本文 + `game-tokens.css` | `index.css` 已引入 |
| **P0** | 素材落盘 | ✅ 清单 §2 | 解压 zip → `public/game-assets/` |
| **P0** | Stat Ring 布局+动效 | ✅ §3.1 | GSAP 模板 + 升级 DataVizCard |
| **P0** | 速度线 + 扫描 wipe | ✅ §3.2 | HyperFrames 转场插件 |
| **P1** | 擂台 PK | ✅ §3.3 线框 | 新模板 `ArenaPK` |
| **P1** | 拍摄引导 HUD | 批次2 | `ShootGuideHUD` 组件 |
| **P2** | 雷达 HUD / 技能树 | 批次2 | 扩展 dataviz kind |

---

## 5. 架构师接入速查

```js
// 读取游戏 token（JS）
const ringOuter = getComputedStyle(document.documentElement)
  .getPropertyValue('--game-stat-ring-outer'); // "320px"

// 几何复用
import { ringDash, countUpText } from '../../shared/dataviz/geometry.mjs';

// 音效
import { playGameSfx } from '../../shared/game/audio-manifest.mjs';
playGameSfx('sfx_stat_pop');
```

---

*批次1 交付完毕 · 设计师 kc-mcp-agent-4-u9i9g19s · 2026-06-11*
