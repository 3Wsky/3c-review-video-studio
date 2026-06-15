#!/usr/bin/env bash
# 安装 systemd 常驻服务（WSL2 需启用 systemd：/etc/wsl.conf [boot] systemd=true）
# 推荐改用仓库根 scripts/install-systemd-all.sh（含 render worker）
set -euo pipefail
exec bash /mnt/f/3c-review-video-studio/scripts/install-systemd-all.sh
