#!/usr/bin/env bash
set -euo pipefail
for i in $(seq 1 36); do
  h=$(curl -sf localhost:9233/health 2>/dev/null || echo '{}')
  echo "[$i] $h"
  if echo "$h" | grep -q '"modelLoaded":true'; then
    exit 0
  fi
  err=$(echo "$h" | sed -n 's/.*"modelLoadError":\([^,}]*\).*/\1/p')
  if [ -n "$err" ] && [ "$err" != "null" ] && [ "$err" != "false" ]; then
    echo "model load error: $err"
    tail -15 /tmp/voice-clone.log 2>/dev/null || true
    exit 1
  fi
  sleep 10
done
tail -20 /tmp/voice-clone.log 2>/dev/null || true
exit 1
