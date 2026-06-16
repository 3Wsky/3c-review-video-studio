#!/usr/bin/env bash
# Poll external tunnel + local voice model load
set -euo pipefail
for i in $(seq 1 24); do
  R=$(curl -sf https://render.1go.im/health 2>/dev/null || echo FAIL)
  V=$(curl -sf https://voice.1go.im/health 2>/dev/null || echo FAIL)
  L=$(curl -sf http://localhost:9233/health 2>/dev/null || echo FAIL)
  echo "try=$i"
  echo "  render=$R"
  echo "  voice_ext=$V"
  echo "  voice_local=$L"
  if echo "$V" | grep -q '"modelLoaded":true'; then
    echo "VOICE_READY"
    exit 0
  fi
  sleep 10
done
echo "TIMEOUT"
exit 1
