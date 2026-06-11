#!/usr/bin/env bash
for f in /mnt/f/3c-review-video-studio/voice-clone/*.sh; do
  sed -i 's/\r$//' "$f"
done
echo "CRLF fixed"
