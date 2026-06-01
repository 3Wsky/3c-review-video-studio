# Roadmap

## Phase 1: Cloudflare 内容生成

- [x] 静态前端原型
- [x] Timeline JSON 数据结构
- [x] Cloudflare Pages Function
- [x] OpenAI-compatible LLM 接口
- [x] 本地模拟兜底
- [ ] Cloudflare Pages 在线部署
- [ ] 真实模型测试

## Phase 2: 素材管理

- [ ] 接 Cloudflare R2
- [ ] 产品图上传到 R2
- [ ] 生成素材索引
- [ ] 图片描述/多模态识别
- [ ] 分镜绑定具体产品图

## Phase 3: 配音和字幕

- [ ] Edge TTS 试跑
- [ ] 逐段生成音频
- [ ] 读取音频时长
- [ ] 反推 scene start/end
- [ ] 生成 SRT / VTT

## Phase 4: HyperFrames 渲染

- [ ] Timeline JSON -> HyperFrames HTML
- [ ] 3C 参数卡模板
- [ ] 真人出镜位模板
- [ ] 字幕动画模板
- [ ] 外部 worker 执行 `npx hyperframes render`
- [ ] 输出 MP4 和封面

## Phase 5: 质量控制

- [ ] 相似度检查，降低洗稿风险
- [ ] 事实核查清单
- [ ] 参数字段人工确认
- [ ] 品类模板：耳机、手机、显卡、显示器、笔记本
- [ ] 发布标题和简介生成
