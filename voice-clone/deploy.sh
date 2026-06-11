#!/usr/bin/env bash
# 一键部署 CosyVoice2 克隆语音服务（需要带 NVIDIA GPU 的 Linux 机器）。
#
# 用法：
#   cd voice-clone
#   bash deploy.sh          # 拉仓库 + 装依赖 + 下模型 + 起服务
#   bash deploy.sh --no-run # 只准备环境，不启动服务
#
# 起来后默认监听 0.0.0.0:9233，把这个地址（公网可达）填到主站点的
# 环境变量 VOICE_CLONE_URL 即可（见本目录 README.md）。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

COSYVOICE_DIR="${COSYVOICE_DIR:-$HERE/CosyVoice}"
MODEL_DIR="${MODEL_DIR:-$COSYVOICE_DIR/pretrained_models/CosyVoice2-0.5B}"
PORT="${PORT:-9233}"

echo "==> 1/5 检查 GPU"
if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "!! 未检测到 nvidia-smi，CosyVoice2 需要 NVIDIA GPU 才能跑。" >&2
  echo "   仍可继续（CPU 极慢，仅供调试）。" >&2
fi

echo "==> 2/5 克隆 CosyVoice 仓库到 $COSYVOICE_DIR"
if [ ! -d "$COSYVOICE_DIR/.git" ]; then
  git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git "$COSYVOICE_DIR"
else
  git -C "$COSYVOICE_DIR" submodule update --init --recursive
fi

echo "==> 3/5 安装依赖"
python3 -m pip install --upgrade pip
# 先装支持 Blackwell(5090, sm_120) 的 cu128 PyTorch；老 torch 在 5090 上会报 sm_120 not supported。
# 其它架构的卡装这个也能用；如想固定 CUDA 版本可改 TORCH_INDEX_URL。
TORCH_INDEX_URL="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cu128}"
python3 -m pip install torch torchaudio --index-url "$TORCH_INDEX_URL" || \
  echo "!! cu128 torch 安装失败，将沿用 CosyVoice requirements 里的 torch（非 5090 可忽略）。" >&2
# CosyVoice 本体依赖（torch 已满足则不会被降级）
python3 -m pip install -r "$COSYVOICE_DIR/requirements.txt"
# 本服务依赖
python3 -m pip install -r "$HERE/requirements.txt"

echo "==> 4/5 下载 CosyVoice2-0.5B 模型到 $MODEL_DIR"
if [ ! -d "$MODEL_DIR" ] || [ -z "$(ls -A "$MODEL_DIR" 2>/dev/null)" ]; then
  # 优先用 modelscope（国内快），失败回退 huggingface
  if python3 -c "import modelscope" >/dev/null 2>&1 || python3 -m pip install modelscope >/dev/null 2>&1; then
    python3 - <<PY
from modelscope import snapshot_download
snapshot_download('iic/CosyVoice2-0.5B', local_dir='$MODEL_DIR')
PY
  else
    python3 -m pip install -U huggingface_hub
    python3 - <<PY
from huggingface_hub import snapshot_download
snapshot_download('FunAudioLLM/CosyVoice2-0.5B', local_dir='$MODEL_DIR')
PY
  fi
else
  echo "   模型已存在，跳过下载。"
fi

echo "==> 5/5 完成。"
export COSYVOICE_DIR MODEL_DIR

if [ "${1:-}" = "--no-run" ]; then
  echo "已准备好。手动启动： COSYVOICE_DIR=$COSYVOICE_DIR MODEL_DIR=$MODEL_DIR python3 server.py"
  exit 0
fi

echo "启动服务： http://0.0.0.0:$PORT  (Ctrl+C 停止)"
PORT="$PORT" python3 "$HERE/server.py"
