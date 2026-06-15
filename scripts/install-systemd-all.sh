#!/usr/bin/env bash
# 安装 5060 WSL2 systemd 常驻：渲染 worker + 克隆音色 + Cloudflare 隧道
# 前置：/etc/wsl.conf 已设 [boot] systemd=true 并 wsl --shutdown 重启过
set -euo pipefail

ROOT="/mnt/f/3c-review-video-studio"

for f in \
  "$ROOT/video-render/systemd/3c-render-worker.service" \
  "$ROOT/voice-clone/systemd/3c-voice-clone.service" \
  "$ROOT/voice-clone/systemd/3c-cloudflared.service"; do
  if [ ! -f "$f" ]; then
    echo "✗ 缺少单元文件: $f" >&2
    exit 1
  fi
done

# 行尾统一 LF（Windows 编辑后 WSL 可执行）
sed -i 's/\r$//' \
  "$ROOT/video-render/worker.start.sh" \
  "$ROOT/voice-clone/start-server.sh" \
  "$ROOT/scripts/install-systemd-all.sh" 2>/dev/null || true

sudo cp "$ROOT/video-render/systemd/3c-render-worker.service" /etc/systemd/system/
sudo cp "$ROOT/voice-clone/systemd/3c-voice-clone.service" /etc/systemd/system/
sudo cp "$ROOT/voice-clone/systemd/3c-cloudflared.service" /etc/systemd/system/3c-cloudflared-tunnel.service

sudo systemctl daemon-reload
sudo systemctl enable 3c-render-worker 3c-voice-clone 3c-cloudflared-tunnel

# 停掉可能占用端口的旧手动进程（忽略错误）
pkill -f "node worker.mjs" 2>/dev/null || true
pkill -f "voice-clone/server.py" 2>/dev/null || true
sleep 1

sudo systemctl restart 3c-render-worker 3c-voice-clone 3c-cloudflared-tunnel

echo ""
echo "=== 服务状态 ==="
systemctl is-active 3c-render-worker 3c-voice-clone 3c-cloudflared-tunnel || true
echo ""
echo "探活："
curl -sf "http://localhost:9234/health" | head -c 200 || echo "render :9234 未就绪"
echo ""
curl -sf "http://localhost:9233/health" | head -c 200 || echo "voice :9233 未就绪"
echo ""
echo "完成。日志: journalctl -u 3c-render-worker -f"
