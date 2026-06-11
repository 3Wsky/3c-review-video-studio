#!/usr/bin/env bash
set -euo pipefail
ROOT="/mnt/f/3c-review-video-studio/voice-clone"
source "$ROOT/.venv/bin/activate"
export PATH="$ROOT/uv-bin:$PATH"

echo "==> PyTorch cu128"
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128

echo "==> CosyVoice + server deps"
uv pip install -r "$ROOT/CosyVoice/requirements.txt"
uv pip install -r "$ROOT/requirements.txt"
uv pip install modelscope

python -c "import torch; print('torch', torch.__version__, 'cuda', torch.cuda.is_available())"
