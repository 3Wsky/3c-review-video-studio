#!/usr/bin/env bash
# 修复 CosyVoice 推理环境：deepspeed 仅需训练，推理导入会因缺 CUDA_HOME 崩溃
set -euo pipefail
ROOT="/mnt/f/3c-review-video-studio/voice-clone"
PY="$ROOT/.venv/bin/python"
PIP="$ROOT/.venv/bin/pip"
UNIT=3c-voice-clone.service

echo "==> uninstall deepspeed (inference-only; needs CUDA toolkit to import)"
"$PIP" uninstall -y deepspeed 2>/dev/null || true

echo "==> verify cosyvoice import"
export DS_BUILD_OPS=0
"$PY" -c "
import sys
sys.path.append('$ROOT/CosyVoice')
sys.path.append('$ROOT/CosyVoice/third_party/Matcha-TTS')
from cosyvoice.cli.cosyvoice import AutoModel
print('AutoModel import ok')
"

echo "==> refresh systemd + restart"
sudo cp "$ROOT/systemd/3c-voice-clone.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart "$UNIT"

echo "==> wait for modelLoaded (max 10 min)"
for i in $(seq 1 120); do
  health=$(curl -sf "http://127.0.0.1:9233/health" 2>/dev/null || echo '{}')
  echo "[$i] $health"
  if echo "$health" | grep -q '"modelLoaded":true'; then
    echo "✓ modelLoaded:true"
    curl -sf "https://voice.1go.im/health" || true
    exit 0
  fi
  err=$(echo "$health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('modelLoadError') or '')" 2>/dev/null || true)
  if [ -n "$err" ] && [ "$err" != "None" ]; then
    echo "✗ model load error: $err" >&2
    journalctl -u "$UNIT" --no-pager -n 20
    exit 1
  fi
  sleep 5
done
journalctl -u "$UNIT" --no-pager -n 20
exit 1
