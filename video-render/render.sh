#!/usr/bin/env bash
# 3C 测评视频渲染一键脚本（HyperFrames：HTML → MP4）
# 用法：
#   bash render.sh              # 校验 + 软件渲染，输出 out.mp4
#   bash render.sh --gpu        # 用 NVENC 硬件编码（RTX 50 系列更快）
#   bash render.sh -o foo.mp4   # 指定输出文件
set -euo pipefail
cd "$(dirname "$0")"

HF="hyperframes@0.6.69"
OUT="out.mp4"
GPU_FLAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --gpu) GPU_FLAG="--gpu"; shift ;;
    -o) OUT="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

echo "==> 检查依赖"
command -v node >/dev/null || { echo "缺少 Node.js（需 22+）"; exit 1; }
command -v ffmpeg >/dev/null || { echo "缺少 ffmpeg"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "Node 版本过低（当前 $(node -v)），HyperFrames 需要 22+"; exit 1
fi

echo "==> 检查中文字体（避免渲染出方块）"
if command -v fc-list >/dev/null; then
  if [[ "$(fc-list :lang=zh | wc -l)" -eq 0 ]]; then
    echo "⚠ 未检测到中文字体。Linux 请先安装，例如："
    echo "    sudo apt-get install -y fonts-noto-cjk    # Debian/Ubuntu"
    echo "  否则中文会显示为方块。Windows 自带微软雅黑，通常无需安装。"
  fi
fi

echo "==> 校验合成（lint + validate）"
npx --yes "$HF" lint
npx --yes "$HF" validate

echo "==> 渲染 → $OUT ${GPU_FLAG:+(GPU/NVENC)}"
# shellcheck disable=SC2086
npx --yes "$HF" render $GPU_FLAG -o "$OUT"

echo "==> 完成：$(pwd)/$OUT"
