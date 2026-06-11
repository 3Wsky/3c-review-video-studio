#!/usr/bin/env bash
# 安装 systemd 常驻服务（WSL2 需启用 systemd：/etc/wsl.conf [boot] systemd=true）
set -euo pipefail
ROOT="/mnt/f/3c-review-video-studio/voice-clone"
sudo cp "$ROOT/systemd/3c-voice-clone.service" /etc/systemd/system/
sudo cp "$ROOT/systemd/3c-cloudflared.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable 3c-voice-clone 3c-cloudflared
sudo systemctl restart 3c-voice-clone 3c-cloudflared
echo "Done. Check: systemctl status 3c-voice-clone 3c-cloudflared"
