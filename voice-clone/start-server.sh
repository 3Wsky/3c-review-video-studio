#!/usr/bin/env bash
# 在 F 盘启动 CosyVoice2 克隆服务 (:9233)
set -euo pipefail
ROOT="/mnt/f/3c-review-video-studio/voice-clone"
COSYVOICE_DIR="$ROOT/CosyVoice"
MODEL_DIR="$COSYVOICE_DIR/pretrained_models/CosyVoice2-0.5B"
VENV_DIR="$ROOT/.venv"
PORT="${PORT:-9233}"

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "venv 不存在，请先运行: bash deploy-f-drive.sh" >&2
  exit 1
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
export COSYVOICE_DIR MODEL_DIR PORT
cd "$ROOT"
exec python server.py
