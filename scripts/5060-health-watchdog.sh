#!/usr/bin/env bash
# 5060 健康看门狗：WSL 唤醒/休眠后自动恢复 render + voice + cloudflared 隧道
# 用法：
#   bash scripts/5060-health-watchdog.sh          # 探活并打印状态
#   bash scripts/5060-health-watchdog.sh --recover  # 探活失败则重启相关 systemd 单元
#   bash scripts/5060-health-watchdog.sh --recover --wait-voice  # 恢复后等待 voice 模型加载
set -euo pipefail

ROOT="/mnt/f/3c-review-video-studio"
RECOVER=0
WAIT_VOICE=0
MAX_VOICE_WAIT_SEC="${MAX_VOICE_WAIT_SEC:-180}"

for arg in "$@"; do
  case "$arg" in
    --recover) RECOVER=1 ;;
    --wait-voice) WAIT_VOICE=1 ;;
  esac
done

log() { echo "[5060-watchdog] $*"; }

curl_json() {
  curl -sf --max-time "${2:-8}" "$1" 2>/dev/null || echo ""
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" --max-time "${2:-8}" "$1" 2>/dev/null || echo "000"
}

restart_unit() {
  local unit="$1"
  log "restarting $unit …"
  if sudo -n systemctl restart "$unit" 2>/dev/null; then
    return 0
  fi
  log "sudo unavailable for $unit — will try direct process restart"
  return 1
}

restart_render_direct() {
  log "direct restart render :9234"
  pkill -f "node worker.mjs" 2>/dev/null || true
  fuser -k 9234/tcp 2>/dev/null || true
  sleep 1
  nohup bash "$ROOT/video-render/worker.start.sh" >>/tmp/3c-render-worker.log 2>&1 &
}

restart_voice_direct() {
  log "direct restart voice :9233"
  pkill -f "voice-clone/server.py" 2>/dev/null || true
  fuser -k 9233/tcp 2>/dev/null || true
  sleep 1
  nohup bash "$ROOT/voice-clone/start-server.sh" >>/tmp/3c-voice-clone.log 2>&1 &
}

restart_tunnel_direct() {
  log "direct restart cloudflared tunnel"
  pkill -f "cloudflared tunnel.*3c-worker" 2>/dev/null || true
  sleep 1
  nohup /usr/local/bin/cloudflared tunnel --protocol http2 run 3c-worker >>/tmp/3c-cloudflared.log 2>&1 &
}

LOCAL_RENDER="$(curl_json http://localhost:9234/health)"
LOCAL_VOICE="$(curl_json http://localhost:9233/health)"
EXT_RENDER="$(http_code https://render.1go.im/health 12)"
EXT_VOICE="$(http_code https://voice.1go.im/health 12)"

render_local_ok=0
voice_local_ok=0
voice_model_ok=0
tunnel_render_ok=0
tunnel_voice_ok=0

echo "$LOCAL_RENDER" | grep -q '"ok":true' && render_local_ok=1
echo "$LOCAL_VOICE" | grep -q '"ok":true' && voice_local_ok=1
echo "$LOCAL_VOICE" | grep -q '"modelLoaded":true' && voice_model_ok=1
[ "$EXT_RENDER" = "200" ] && tunnel_render_ok=1
[ "$EXT_VOICE" = "200" ] && tunnel_voice_ok=1

log "local render=$render_local_ok voice=$voice_local_ok model=$voice_model_ok"
log "tunnel render=$tunnel_render_ok($EXT_RENDER) voice=$tunnel_voice_ok($EXT_VOICE)"

needs_fix=0
if [ "$render_local_ok" -eq 0 ]; then needs_fix=1; fi
if [ "$voice_local_ok" -eq 0 ]; then needs_fix=1; fi
if [ "$render_local_ok" -eq 1 ] && [ "$tunnel_render_ok" -eq 0 ]; then needs_fix=1; fi
if [ "$voice_local_ok" -eq 1 ] && [ "$tunnel_voice_ok" -eq 0 ]; then needs_fix=1; fi

if [ "$RECOVER" -eq 0 ]; then
  [ "$needs_fix" -eq 0 ] && exit 0
  exit 1
fi

if [ "$needs_fix" -eq 0 ]; then
  log "all healthy"
  exit 0
fi

log "unhealthy — applying recovery"

if [ "$render_local_ok" -eq 0 ]; then
  restart_unit 3c-render-worker || restart_render_direct
fi

if [ "$voice_local_ok" -eq 0 ]; then
  restart_unit 3c-voice-clone || restart_voice_direct
fi

if { [ "$render_local_ok" -eq 1 ] && [ "$tunnel_render_ok" -eq 0 ]; } || \
   { [ "$voice_local_ok" -eq 1 ] && [ "$tunnel_voice_ok" -eq 0 ]; } || \
   { [ "$render_local_ok" -eq 0 ] || [ "$voice_local_ok" -eq 0 ]; }; then
  if ! restart_unit 3c-cloudflared-tunnel; then
    restart_tunnel_direct
  fi
fi

sleep 5

LOCAL_RENDER="$(curl_json http://localhost:9234/health)"
LOCAL_VOICE="$(curl_json http://localhost:9233/health)"
EXT_RENDER="$(http_code https://render.1go.im/health 15)"
EXT_VOICE="$(http_code https://voice.1go.im/health 15)"

render_local_ok=0; voice_local_ok=0; voice_model_ok=0
tunnel_render_ok=0; tunnel_voice_ok=0
echo "$LOCAL_RENDER" | grep -q '"ok":true' && render_local_ok=1
echo "$LOCAL_VOICE" | grep -q '"ok":true' && voice_local_ok=1
echo "$LOCAL_VOICE" | grep -q '"modelLoaded":true' && voice_model_ok=1
[ "$EXT_RENDER" = "200" ] && tunnel_render_ok=1
[ "$EXT_VOICE" = "200" ] && tunnel_voice_ok=1

log "after recover: local render=$render_local_ok voice=$voice_local_ok model=$voice_model_ok tunnel render=$tunnel_render_ok voice=$tunnel_voice_ok"

if [ "$WAIT_VOICE" -eq 1 ] && [ "$voice_local_ok" -eq 1 ] && [ "$voice_model_ok" -eq 0 ]; then
  log "waiting for voice model (max ${MAX_VOICE_WAIT_SEC}s)…"
  elapsed=0
  while [ "$elapsed" -lt "$MAX_VOICE_WAIT_SEC" ]; do
    LOCAL_VOICE="$(curl_json http://localhost:9233/health)"
    if echo "$LOCAL_VOICE" | grep -q '"modelLoaded":true'; then
      voice_model_ok=1
      log "voice model loaded"
      break
    fi
    sleep 10
    elapsed=$((elapsed + 10))
  done
fi

if [ "$render_local_ok" -eq 1 ] && [ "$tunnel_render_ok" -eq 1 ] && [ "$voice_local_ok" -eq 1 ] && [ "$tunnel_voice_ok" -eq 1 ]; then
  log "recovery OK"
  exit 0
fi

log "recovery incomplete — check: journalctl -u 3c-render-worker -u 3c-voice-clone -u 3c-cloudflared-tunnel -n 30"
exit 1
