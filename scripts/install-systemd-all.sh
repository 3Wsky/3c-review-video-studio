#!/usr/bin/env bash
# 安装 5060 WSL2 systemd 常驻：渲染 worker + 克隆音色 + Cloudflare 隧道
# 前置：/etc/wsl.conf 已设 [boot] systemd=true 并 wsl --shutdown 重启过
set -euo pipefail

ROOT="/mnt/f/3c-review-video-studio"

for f in \
  "$ROOT/video-render/systemd/3c-render-worker.service" \
  "$ROOT/voice-clone/systemd/3c-voice-clone.service" \
  "$ROOT/voice-clone/systemd/3c-cloudflared.service" \
  "$ROOT/scripts/systemd/3c-health-watchdog.service" \
  "$ROOT/scripts/systemd/3c-health-watchdog.timer"; do
  if [ ! -f "$f" ]; then
    echo "✗ 缺少单元文件: $f" >&2
    exit 1
  fi
done

# 行尾统一 LF（Windows 编辑后 WSL 可执行）
sed -i 's/\r$//' \
  "$ROOT/video-render/worker.start.sh" \
  "$ROOT/voice-clone/start-server.sh" \
  "$ROOT/scripts/install-systemd-all.sh" \
  "$ROOT/scripts/5060-health-watchdog.sh" \
  "$ROOT/scripts/cloudflared-watchdog.sh" 2>/dev/null || true

sudo cp "$ROOT/video-render/systemd/3c-render-worker.service" /etc/systemd/system/
sudo cp "$ROOT/voice-clone/systemd/3c-voice-clone.service" /etc/systemd/system/
sudo cp "$ROOT/voice-clone/systemd/3c-cloudflared.service" /etc/systemd/system/3c-cloudflared-tunnel.service
sudo cp "$ROOT/scripts/systemd/3c-health-watchdog.service" /etc/systemd/system/
sudo cp "$ROOT/scripts/systemd/3c-health-watchdog.timer" /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable 3c-render-worker 3c-voice-clone 3c-cloudflared-tunnel 3c-health-watchdog.timer

# 停掉可能占用端口的旧手动进程（忽略错误）
pkill -f "node worker.mjs" 2>/dev/null || true
pkill -f "voice-clone/server.py" 2>/dev/null || true
sleep 1

sudo systemctl restart 3c-render-worker 3c-voice-clone 3c-cloudflared-tunnel
sudo systemctl start 3c-health-watchdog.timer

echo ""
echo "=== 服务状态 ==="
systemctl is-active 3c-render-worker 3c-voice-clone 3c-cloudflared-tunnel 3c-health-watchdog.timer || true
echo ""
echo "探活："
curl -sf "http://localhost:9234/health" | head -c 200 || echo "render :9234 未就绪"
echo ""
curl -sf "http://localhost:9233/health" | head -c 200 || echo "voice :9233 未就绪"
echo ""
echo "提示：若外网 1033/502，手动恢复："
echo "  bash $ROOT/scripts/5060-health-watchdog.sh --recover --wait-voice"
echo "Windows 登录自恢复（管理员 PowerShell 注册一次）："
echo "  schtasks /Create /TN 3C-5060-WakeRecover /TR \"powershell -NoProfile -ExecutionPolicy Bypass -File F:/3c-review-video-studio/scripts/wsl-wake-recover.ps1\" /SC ONLOGON /RL HIGHEST /F"
echo "或前台看门狗："
echo "  bash $ROOT/scripts/cloudflared-watchdog.sh"
echo ""
echo "完成。日志: journalctl -u 3c-render-worker -f"
