#!/usr/bin/env bash
# 修复 torch / torchaudio ABI 不匹配（aoti_torch_abi_version undefined symbol）
set -euo pipefail
ROOT="/mnt/f/3c-review-video-studio/voice-clone"
PY="$ROOT/.venv/bin/python"
PIP="$ROOT/.venv/bin/pip"
UNIT=3c-voice-clone.service

echo "==> stop service"
sudo systemctl stop "$UNIT" 2>/dev/null || true
pkill -f 'voice-clone/server.py' 2>/dev/null || true
sudo fuser -k 9233/tcp 2>/dev/null || true

echo "==> reinstall matching torch+torchaudio (cu128, RTX 5060 sm_120)"
"$PIP" install --upgrade pip
"$PIP" install --upgrade torch torchaudio --index-url https://download.pytorch.org/whl/cu128

echo "==> verify imports"
"$PY" -c "import torch, torchaudio; print('torch', torch.__version__, 'torchaudio', torchaudio.__version__, 'cuda', torch.cuda.is_available())"

echo "==> refresh systemd unit + start"
sudo cp "$ROOT/systemd/3c-voice-clone.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable "$UNIT"
sudo systemctl start "$UNIT"

echo "==> wait for :9233 health"
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:9233/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> wait for modelLoaded (max 10 min)"
for i in $(seq 1 120); do
  health=$(curl -sf "http://127.0.0.1:9233/health" 2>/dev/null || echo '{}')
  echo "[$i] $health"
  if echo "$health" | grep -q '"modelLoaded":true'; then
    echo "✓ modelLoaded:true"
    curl -sf "https://voice.1go.im/health" || true
    exit 0
  fi
  if echo "$health" | grep -q '"modelLoadError":'; then
    err=$(echo "$health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('modelLoadError') or '')" 2>/dev/null || true)
    if [ -n "$err" ] && [ "$err" != "None" ]; then
      echo "✗ model load error: $err" >&2
      journalctl -u "$UNIT" --no-pager -n 30
      exit 1
    fi
  fi
  sleep 5
done

journalctl -u "$UNIT" --no-pager -n 20
exit 1
