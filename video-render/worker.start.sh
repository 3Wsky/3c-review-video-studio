#!/usr/bin/env bash
# 启动渲染 worker（方案 A：一站式）。跑在你的 GPU 台式机上，主站点用 RENDER_URL 转发到这里。
#
# 用法：
#   cd video-render
#   export OPENAI_API_KEY=...        # MiMo/OpenAI 兼容 key（逐镜配音；缺了就静音兜底）
#   export OPENAI_BASE_URL=...        # 默认 https://api.openai.com/v1
#   export VOICE_CLONE_URL=...        # 可选：克隆音色服务（voice=clone 时用）
#   export PORT=9234                  # 可选，默认 9234
#   bash worker.start.sh
set -euo pipefail
cd "$(dirname "$0")"

# Node 22+ 检查
if ! command -v node >/dev/null 2>&1; then
  echo "✗ 未找到 node，请装 Node.js 22+" >&2; exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "✗ Node 版本过低（当前 $(node -v)），HyperFrames 需要 22+" >&2; exit 1
fi

# ffmpeg / ffprobe 检查（拼接、混音、读时长都要用）
for bin in ffmpeg ffprobe npx; do
  command -v "$bin" >/dev/null 2>&1 || { echo "✗ 未找到 $bin" >&2; exit 1; }
done

echo "→ 渲染 worker 启动中（端口 ${PORT:-9234}）"
echo "  配音：$([ -n "${OPENAI_API_KEY:-}" ] && echo '已配置 OPENAI_API_KEY' || echo '未配置 → 静音兜底')"
echo "  克隆：$([ -n "${VOICE_CLONE_URL:-}" ] && echo "$VOICE_CLONE_URL" || echo '未配置')"
exec node worker.mjs
