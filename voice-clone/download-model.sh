#!/usr/bin/env bash
set -euo pipefail
ROOT="/mnt/f/3c-review-video-studio/voice-clone"
MODEL_DIR="$ROOT/CosyVoice/pretrained_models/CosyVoice2-0.5B"
source "$ROOT/.venv/bin/activate"

if [ -d "$MODEL_DIR" ] && [ -n "$(ls -A "$MODEL_DIR" 2>/dev/null)" ]; then
  echo "模型已存在: $MODEL_DIR"
  exit 0
fi

mkdir -p "$(dirname "$MODEL_DIR")"
python "$ROOT/download_model.py"
echo "模型下载完成: $MODEL_DIR"
