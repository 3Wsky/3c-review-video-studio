#!/usr/bin/env bash
# cloudflared 看门狗：连接断开后自动重启（不依赖 systemd Restart=always）
# 用法：wsl -u administrator -e bash /mnt/f/3c-review-video-studio/scripts/cloudflared-watchdog.sh &
set -euo pipefail

CF="/usr/local/bin/cloudflared"
TUNNEL="${1:-3c-worker}"
PROTO="${2:-http2}"

echo "[watchdog] starting cloudflared tunnel=$TUNNEL protocol=$PROTO"
while true; do
  "$CF" tunnel --protocol "$PROTO" run "$TUNNEL" || true
  echo "[watchdog] cloudflared exited, restart in 5s…" >&2
  sleep 5
done
