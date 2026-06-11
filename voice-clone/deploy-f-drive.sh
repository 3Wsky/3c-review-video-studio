#!/usr/bin/env bash
# F 盘一键部署 CosyVoice2-0.5B（uv + venv，全部在 F 盘，无需 sudo）
set -euo pipefail

ROOT="/mnt/f/3c-review-video-studio/voice-clone"
cd "$ROOT"

COSYVOICE_DIR="$ROOT/CosyVoice"
MODEL_DIR="$COSYVOICE_DIR/pretrained_models/CosyVoice2-0.5B"
UV_DIR="$ROOT/uv-bin"
VENV_DIR="$ROOT/.venv"
PORT="${PORT:-9233}"

echo "==> [1/7] 安装 uv 到 F 盘"
if [ ! -x "$UV_DIR/uv" ]; then
  mkdir -p "$UV_DIR"
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="$UV_DIR" UV_NO_MODIFY_PATH=1 sh
fi
export PATH="$UV_DIR:$PATH"
uv --version

echo "==> [2/7] 安装 Python 3.10 + 创建 venv（F 盘 .venv/）"
export UV_PYTHON_INSTALL_DIR="$ROOT/python-dist"
mkdir -p "$UV_PYTHON_INSTALL_DIR"
if [ ! -x "$VENV_DIR/bin/python" ]; then
  uv python install 3.10
  uv venv "$VENV_DIR" --python 3.10
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
python --version

echo "==> [3/7] 克隆 CosyVoice 到 F 盘 + 子模块"
if [ ! -f "$COSYVOICE_DIR/cosyvoice/cli/cosyvoice.py" ] && [ ! -f "$COSYVOICE_DIR/README.md" ]; then
  rm -rf "$COSYVOICE_DIR"
  if ! git clone --recursive --depth 1 https://github.com/FunAudioLLM/CosyVoice.git "$COSYVOICE_DIR" 2>/dev/null; then
    echo "GitHub 直连失败，尝试 gitclone 镜像..."
    git clone --recursive --depth 1 https://gitclone.com/github.com/FunAudioLLM/CosyVoice.git "$COSYVOICE_DIR"
  fi
else
  echo "仓库已存在，更新子模块..."
  git -C "$COSYVOICE_DIR" submodule update --init --recursive
fi

echo "==> [4/7] 安装 PyTorch cu128 + 依赖"
uv pip install --upgrade pip
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
uv pip install -r "$COSYVOICE_DIR/requirements.txt"
uv pip install -r "$ROOT/requirements.txt"
uv pip install modelscope

echo "==> [5/7] 下载 CosyVoice2-0.5B 模型（ModelScope → F 盘）"
if [ ! -d "$MODEL_DIR" ] || [ -z "$(ls -A "$MODEL_DIR" 2>/dev/null)" ]; then
  mkdir -p "$(dirname "$MODEL_DIR")"
  python - <<PY
from modelscope import snapshot_download
snapshot_download('iic/CosyVoice2-0.5B', local_dir='$MODEL_DIR')
PY
else
  echo "模型已存在，跳过"
fi

echo "==> [6/7] 验证 GPU"
python -c "import torch; print('torch', torch.__version__, 'cuda', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')"

echo "==> [7/7] 部署完成"
echo "启动: bash $ROOT/start-server.sh"
echo "健康检查: curl http://localhost:$PORT/health"
