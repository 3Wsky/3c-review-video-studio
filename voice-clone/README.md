# 克隆语音服务（CosyVoice2，自部署 / GPU）

让网站用「你自己的音色」配音：上传一段 5–10 秒的录音 + 这段录音的文字，
就能零样本克隆出你的音色，之后任意文本都用这个音色合成。

- 模型：开源 [CosyVoice2-0.5B](https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B)（Apache-2.0，商用友好）
- 本服务只是它的一层 FastAPI 包装：`/enroll` 注册音色、`/tts` 合成。
- 主站点（Cloudflare Pages Function / FastAPI 后端）通过环境变量 `VOICE_CLONE_URL` 调本服务。

> ⚠️ **必须有 NVIDIA GPU**。0.5B 模型推理显存约 4–6GB，CPU 也能跑但极慢，只能调试。
> Cloudflare / 普通无 GPU 服务器跑不了，需要单独一台 GPU 机（自有显卡、或云 GPU 如 AutoDL / RunPod / Vast.ai）。

## 0、RTX 50 系列 / Blackwell 用户必看（CUDA 12.8）

RTX 50 系列（5060 / 5070 / 5090 等）都是 Blackwell 架构（算力 `sm_120`），CosyVoice 官方
`requirements.txt` 里钉的 PyTorch 版本偏老，**直接装会报 `CUDA error: no kernel image is available` / `sm_120 not supported`**。

> 显存参考：CosyVoice2-0.5B 推理约占 **4–6GB**，5060 的 8GB 够用（别同时再加载别的大模型即可）。

解决：装支持 Blackwell 的 PyTorch（CUDA 12.8 构建），再装 CosyVoice 其余依赖。
`deploy.sh` 会优先尝试这一步；如手动处理：

```bash
# 先装 cu128 的 PyTorch（支持 sm_120 / 5090）
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
# 再装 CosyVoice 其余依赖（torch 已满足，不会被降级）
pip install -r CosyVoice/requirements.txt
```

确认能用上 GPU：

```bash
python3 -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"
# 期望：2.x+cu128 True NVIDIA GeForce RTX 5060/5070/5090...
```

> Windows 台式机建议用 WSL2（Ubuntu）跑本服务，驱动装 Windows 端最新 Game Ready/Studio 即可，
> WSL 内不用单独装驱动，但要装 CUDA 12.8 toolkit 对应的 PyTorch（如上）。

## 一、在 GPU 机器上启动

```bash
git clone https://github.com/3Wsky/3c-review-video-studio.git
cd 3c-review-video-studio/voice-clone
bash deploy.sh        # 拉 CosyVoice 仓库 + 装依赖 + 下模型 + 起服务（监听 0.0.0.0:9233）
```

`deploy.sh` 做的事：
1. 克隆 `FunAudioLLM/CosyVoice`（含子模块 Matcha-TTS）到 `voice-clone/CosyVoice`
2. 安装 CosyVoice 依赖 + 本服务依赖（`requirements.txt`）
3. 下载 `CosyVoice2-0.5B` 模型（优先 ModelScope，回退 HuggingFace）
4. 启动 `server.py`

只想准备环境、稍后自己起服务：`bash deploy.sh --no-run`。

健康检查：`curl http://localhost:9233/health`。

## 二、把地址告诉主站点

让本服务公网可达（云 GPU 一般给一个转发域名；自有机器可用 frp / cloudflare tunnel / `ssh -R`）。
拿到形如 `https://your-gpu-host:9233` 的地址后：

- **Cloudflare Pages**：项目 → Settings → 环境变量，加 `VOICE_CLONE_URL = https://your-gpu-host:9233`
- **本地 / Codespaces FastAPI 后端**：设环境变量 `VOICE_CLONE_URL=https://your-gpu-host:9233`

主站点新增的两个接口会自动把请求转发到这里：
- `POST /api/voice-enroll` → 本服务 `/enroll`
- `POST /api/tts`（当 `voice=clone` 时）→ 本服务 `/tts`

前端「高级设置 → 我的克隆音色」上传录音后即可在每镜「试听配音」用你的音色。

## 三、接口

| 方法 | 路径 | 入参 | 出参 |
|---|---|---|---|
| GET | `/health` | — | `{ok, modelLoaded, cuda, speakers[]}` |
| GET | `/speakers` | — | `{speakers:[{spkId, promptText, createdAt}]}` |
| POST | `/enroll` | multipart：`audio`（音频文件）、`prompt_text`（这段录音的文字）、可选 `spk_id` | `{spkId, promptText}` |
| POST | `/tts` | json：`{text, spk_id, format}`（format: `wav`/`mp3`） | `{audio(base64), format, spkId}` |

注册的音色（参考音频 + 文字）保存在 `SPK_DATA_DIR`（默认 `voice-clone/spk_data`），
服务重启会自动重新加载，不用重传。

## 四、环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `COSYVOICE_DIR` | `./CosyVoice` | CosyVoice 仓库路径（含 `third_party/Matcha-TTS`） |
| `MODEL_DIR` | `$COSYVOICE_DIR/pretrained_models/CosyVoice2-0.5B` | 模型目录 |
| `SPK_DATA_DIR` | `./spk_data` | 已注册音色保存目录 |
| `PORT` | `9233` | 监听端口 |
| `ALLOWED_ORIGINS` | `*` | 允许的来源，逗号分隔 |

## 五、录音建议

- 时长 5–10 秒，安静环境、单人、口齿清楚。
- `prompt_text` 必须是这段录音**逐字**说的内容（错字会影响克隆质量）。
- 普通话效果最好；中英混读也支持。
