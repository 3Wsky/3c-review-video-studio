# 游戏化测评视频 · 批次2：拍摄引导 HUD 线框

> **状态**：设计交付 · 架构师实现 `ShootGuideHUD` 模板依据  
> **画布**：1080×1920（9:16 竖屏，抖音/快手主平台）  
> **关联**：`src/design/game-tokens.css` · `docs/game-design-batch1.md` §2.2 素材  
> **触发**：分镜 `visual.type === "拍摄引导"` 或 Beat B6 CTA 段

---

## 1. 设计目标

在成片里**教用户怎么拍**，让素人也能产出专业素材：

| 痛点 | HUD 解法 |
|------|----------|
| 不知道拍什么角度 | 取景框 + 虚线示范轮廓 |
| 构图跑偏 | 四角 bracket + 中心准星吸附反馈 |
| 步骤记不住 | 右侧 checklist 逐条打勾 |
| 没参考 | 左下示范 inset（动图/静帧） |

视觉气质：**科幻取景器**（青框 + 金准星），与导演台暗色霓虹品牌一致，但信息层更「教学向」。

---

## 2. 组件树

```
ShootGuideHUD (全屏 overlay, z-index 20)
├── GuideFrame          四角 bracket 取景框
├── GuideCrosshair      中心准星 + 吸附环
├── GuideHeader         顶部指令条（步骤序号 + 主文案）
├── GuideChecklist      右侧 checklist（3–4 项）
├── GuideDemoInset      左下示范小窗（16:9 或 1:1）
├── GuideSafeZone       安全区虚线（可选，口播镜）
└── GuideProgress       底部步骤进度点（●○○）
```

**Timeline JSON 扩展**（架构师）：

```json
{
  "visual": {
    "type": "拍摄引导",
    "shootGuide": {
      "variant": "product_macro | hand_hold | comparison | talking_head",
      "title": "拍一张正面特写",
      "steps": ["对准产品 Logo", "保持画面稳定 2 秒", "避免反光"],
      "demoAsset": "game-assets/demos/macro_front.webp",
      "frame": { "x": 0.12, "y": 0.18, "w": 0.76, "h": 0.52 }
    }
  }
}
```

`frame` 为**相对坐标**（0–1），适配不同分辨率渲染。

---

## 3. 四种拍摄变体线框

### 3.1 `product_macro` — 产品正面特写

**场景**：教用户拍产品正面，供后续 Ken Burns 实拍穿插。

```
┌──────────────────────────────────── 1080px ────┐
│ ▓▓ ① 拍正面特写 · 对准 Logo 区域 ▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← GuideHeader h=72
│                                                │
│    ┌──────────────────────────────┐            │
│    │ ┌──┐                    ┌──┐ │            │
│    │ │  │   · 产品轮廓虚线   │  │ │  ← frame   │
│    │ └──┘      ╋ 准星       └──┘ │    y=18%     │
│    │         (居中)              │    h=52%     │
│    │    ┌─ ─ ─ ─ ─ ─ ─ ─ ─┐    │            │
│    │    │  虚线示范轮廓     │    │            │
│    │    └─ ─ ─ ─ ─ ─ ─ ─ ─┘    │            │
│    └──────────────────────────────┘            │
│  ┌────────┐                      ┌──────────┐ │
│  │ DEMO   │  示范：正面平拍       │ ☑ 对准Logo│ │
│  │ inset  │                      │ ○ 稳 2 秒 │ │  ← Checklist
│  │ 240×135│                      │ ○ 避反光  │ │    w=280
│  └────────┘                      └──────────┘ │
│              ● ○ ○  步骤 1/3                   │  ← Progress
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← 底部安全区 120px
└────────────────────────────────────────────────┘
```

| 元素 | 相对位置 | 尺寸 | Token / 素材 |
|------|----------|------|--------------|
| Header 条 | top 0, full width | h=72px | `--game-panel-bg` 底 |
| 取景框 | x=12%, y=18% | w=76%, h=52% | `corner_*.png` ×4 |
| 准星 | frame 中心 | 48×48 | `crosshair.png` |
| 示范轮廓 | frame 内 80% | 虚线 2px | `--game-frame-stroke` dash |
| Demo inset | x=24, y=H-320 | 240×135 | 圆角 8px, 描边 cyan |
| Checklist | right 24, y=200 | w=280 | Rajdhani 18px |
| Progress | bottom 140, center | — | 圆点 10px |

---

### 3.2 `hand_hold` — 手持展示

**场景**：教用户单手托举产品，露出背面接口/配色。

```
┌────────────────────────────────────┐
│ ▓▓ ② 手持展示 · 露出背面接口 ▓▓▓▓▓ │
│         ┌──┐              ┌──┐     │
│         │  │   ┌──────┐   │  │     │
│         └──┘   │ 手部  │   └──┘     │  frame 偏下 y=28%
│                │ 虚线  │            │  h=48%
│                └──────┘            │
│                   ╋                │
│  ┌────────┐          ┌──────────┐  │
│  │ 示范：  │          │ ☑ 托稳产品│  │
│  │ 虎口托底│          │ ○ 露接口  │  │
│  └────────┘          │ ○ 手不入镜│  │
│       ● ● ○          └──────────┘  │
└────────────────────────────────────┘
```

**差异**：frame 下移（`y: 0.28`）；示范轮廓为**手部 U 形**；checklist 第 3 项「手不入镜」高亮 `--game-hud-gold`。

---

### 3.3 `comparison` — 双机对比摆拍

**场景**：两款产品并排，供擂台 PK 实拍素材。

```
┌────────────────────────────────────┐
│ ▓▓ ③ 摆拍对比 · 两机并排等高 ▓▓▓▓▓ │
│    ┌────────────┬────────────┐     │
│    │ ┌──┐  ┌──┐ │ ┌──┐  ┌──┐│     │
│    │ │  │  │  │ │ │  │  │  ││     │  双框 split
│    │ └──┘  └──┘ │ └──┘  └──┘│     │  各 38% 宽
│    │  产品 A    │   产品 B   │     │
│    └────────────┴────────────┘     │
│              ╋ ╋  双准星           │
│  ┌────────┐          ┌──────────┐  │
│  │ 示范并排│          │ ☑ 底部对齐│  │
│  └────────┘          │ ○ 等高   │  │
│                      │ ○ 间距一致│  │
│         ● ● ●        └──────────┘  │
└────────────────────────────────────┘
```

| 元素 | 说明 |
|------|------|
| 双框 | 左 x=8%, 右 x=54%, 各 w=38%, 共享 y/h |
| 中线 | 1px `--game-grid` 竖线 |
| VS 小标 | 中线旁 32px `icon_vs.png`（可选） |

---

### 3.4 `talking_head` — 真人出镜口播

**场景**：教用户录 3–5 秒真人出镜，增加真实感。

```
┌────────────────────────────────────┐
│ ▓▓ ④ 真人出镜 · 看镜头说一句话 ▓▓▓▓ │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │  ┌──┐              ┌──┐     │  │  安全区虚线
│  │  │  │   头部轮廓    │  │     │  │  (头部上 1/3)
│  │  └──┘      ╋       └──┘     │  │
│  │         肩部轮廓            │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│  ┌────────┐          ┌──────────┐  │
│  │ 示范口型│          │ ☑ 眼睛看镜头│
│  └────────┘          │ ○ 说 1 句话│  │
│                      │ ○ 背景干净 │  │
│         ● ● ● ●      └──────────┘  │
│  ┌──────────────────────────────┐  │
│  │  提词器条：「这款续航真的顶」  │  │  ← Teleprompter h=56
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**提词器条**：底部 `y=H-200`，`--game-panel-bg` + 滚动字幕 `visual.shootGuide.teleprompter`。

---

## 4. 元素规格表

### 4.1 GuideFrame（四角 bracket）

| 属性 | 值 |
|------|-----|
| 角标尺寸 | 28×28px（`--game-frame-corner-len`） |
| 描边 | 3px solid `--game-frame-stroke` |
| 角标素材 | `sprites/kenney/corner_tl.png` 等，无素材时 CSS 纯绘 |
| 入场 | 四角从外向内 scale 0.6→1，错峰 80ms |
| 呼吸 | 选中态 opacity 0.85↔1.0，2s loop |

### 4.2 GuideCrosshair（准星）

| 属性 | 值 |
|------|-----|
| 尺寸 | 48×48px |
| 颜色 | `--game-crosshair`（金） |
| 吸附环 | 外圈 72px，stroke 1px `--game-hud-cyan-dim` |
| 「对齐」反馈 | 环缩至 56px + `sfx_camera_beep` + 准星 flash 0.12s |

### 4.3 GuideChecklist

| 状态 | 图标 | 文字色 |
|------|------|--------|
| pending | `○` 空心圆 14px | `--game-muted` → `#9aa0b4` |
| active | `◉` 脉冲圆 | `--game-hud-cyan` |
| done | `icon_check.png` 16px | `--game-guide-check` |

行高 36px，右对齐，最大 4 行。完成项：文字 + 删除线 0.3s。

### 4.4 GuideDemoInset

| 属性 | 值 |
|------|-----|
| 尺寸 | 240×135（16:9）或 200×200（1:1 macro） |
| 位置 | left 24px, bottom 200px |
| 边框 | 2px `--game-hud-cyan` + 角标「DEMO」12px |
| 内容 | webp/gif 循环，静音 |
| 入场 | slide-up 24px + fade，0.35s |

### 4.5 GuideHeader

| 属性 | 值 |
|------|-----|
| 高度 | 72px |
| 背景 | `--game-panel-bg` + bottom 1px `--game-panel-border` |
| 步骤徽章 | 28×28 圆 `--game-hud-cyan` 底，Orbitron 14px |
| 主文案 | Rajdhani 22px `--game-guide-text` |
| 扫描线 | 可选：header 底部 1px 扫描光带 3s loop |

---

## 5. 动效时序（单镜 8–10s）

| 时间 | 元素 | 动作 | 音效 |
|------|------|------|------|
| 0.00s | 全屏 | fade in + 轻微 vignette | `sfx_ui_open` |
| 0.20s | Header | slide-down 12px | — |
| 0.35s | Frame 四角 | stagger scale in | — |
| 0.50s | Crosshair | scale 0→1 + 吸附环出现 | — |
| 0.70s | Checklist 第1项 | → active 脉冲 | — |
| 1.00s | Demo inset | slide-up | — |
| 2.50s | 第1项 | active→done，第2项→active | `sfx_camera_beep` |
| 4.50s | 第2项 | →done，第3项→active | `sfx_camera_beep` |
| 6.50s | 第3项 | →done | `sfx_stat_pop` |
| 7.00s | 全局 | 准星「对齐」闪光 + 框 gold 描边 0.4s | `sfx_level_up` |
| 8.00s | 出场 | 扫描 wipe 向上离场 | `sfx_scan_sweep` |

> `prefers-reduced-motion`：跳过 stagger/呼吸，保留 fade。

---

## 6. 文案模板库

| variant | title | steps[] |
|---------|-------|---------|
| product_macro | 拍一张{部位}特写 | 对准{焦点}, 保持稳定 2 秒, 避免反光 |
| hand_hold | 手持展示·露出{部位} | 虎口托稳, 露出{接口/配色}, 手指不入镜 |
| comparison | 摆拍对比·两机并排 | 底部对齐, 顶部等高, 间距约一指宽 |
| talking_head | 真人出镜·说一句话 | 眼睛看镜头, 说「{提词}」, 背景干净 |

**LLM 填充位**：`{部位}` `{焦点}` `{接口/配色}` `{提词}` 由 MiMo 根据产品品类生成。

---

## 7. 示范素材清单（落盘）

建议路径：`public/game-assets/demos/`

| 文件 | 用途 | 来源建议 |
|------|------|----------|
| `macro_front.webp` | 正面特写示范 | 内部样张 / 占位 |
| `hand_hold_back.webp` | 手持背面 | 同上 |
| `comparison_side.webp` | 双机并排 | 同上 |
| `talking_head_center.webp` | 口播构图 | 同上 |
| `talking_head_demo.gif` | 口播动图示范 | 3–5s 循环 |

预览阶段可用 CSS 占位剪影，渲染端替换真实 webp。

---

## 8. CSS 类名约定（架构师）

```css
.shoot-guide { /* 根容器 */ }
.shoot-guide__header { }
.shoot-guide__frame { }
.shoot-guide__corner { }       /* --tl --tr --bl --br */
.shoot-guide__crosshair { }
.shoot-guide__checklist { }
.shoot-guide__check-item { }   /* --pending --active --done */
.shoot-guide__demo { }
.shoot-guide__progress { }
.shoot-guide__teleprompter { } /* talking_head only */
```

新增 Token（可选写入 `game-tokens.css`）：

```css
--game-guide-header-h: 72px;
--game-guide-inset-w: 240px;
--game-guide-inset-h: 135px;
--game-guide-checklist-w: 280px;
--game-guide-teleprompter-h: 56px;
```

---

## 9. 与现有 PreviewStage 关系

| 层 | 现状 | 批次2 |
|----|------|-------|
| 预览舞台 | `host-slot` 虚线占位 | `visual.shootGuide` 时叠 `ShootGuideHUD` 预览组件 |
| 渲染端 | HyperFrames 逐帧 | 新模板 `ShootGuideHUD.jsx`（Remotion） |
| 导演台 | 无拍摄引导编辑 | Inspector 增加 shootGuide 字段（P2） |

预览组件可先以 `visual.type === "拍摄引导"` 判断挂载，与 `DataVizCard` 互斥。

---

## 10. 落地优先级

| 步骤 | 内容 | 负责 |
|------|------|------|
| 1 | `game-tokens.css` 追加 §8 常量 | 设计师 ✅ 本文 |
| 2 | demo webp 占位落盘 | 架构师 |
| 3 | `ShootGuideHUD` Remotion 模板 | 架构师 |
| 4 | PreviewStage 预览挂载 | 架构师 |
| 5 | timeline-builder 插入 B6 拍摄引导镜 | 产品/算法 |

---

*批次2 拍摄引导 HUD 线框 · 设计师 kc-mcp-agent-4-u9i9g19s · 2026-06-11*
