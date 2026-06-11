#!/usr/bin/env bash
set -euo pipefail
ROOT="/mnt/f/3c-review-video-studio/voice-clone"
cd "$ROOT"
source "$ROOT/.venv/bin/activate"
export PATH="$ROOT/uv-bin:$PATH"

echo "==> modelscope + server deps"
uv pip install modelscope fastapi "uvicorn[standard]" python-multipart \
  --index-strategy unsafe-best-match

echo "==> CosyVoice deps (skip torch/torchaudio)"
grep -vE '^(torch|torchaudio|--extra)' "$ROOT/CosyVoice/requirements.txt" > /tmp/cosy-req.txt
uv pip install -r /tmp/cosy-req.txt --index-strategy unsafe-best-match

python -c "import modelscope; print('modelscope ok')"
python -c "import torch; print('torch', torch.__version__, 'cuda', torch.cuda.is_available())"
