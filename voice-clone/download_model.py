#!/usr/bin/env python3
"""Download CosyVoice2-0.5B model to F drive via ModelScope."""
import os
from modelscope import snapshot_download

ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(ROOT, "CosyVoice", "pretrained_models", "CosyVoice2-0.5B")

os.makedirs(MODEL_DIR, exist_ok=True)
print(f"Downloading iic/CosyVoice2-0.5B -> {MODEL_DIR}")
snapshot_download("iic/CosyVoice2-0.5B", local_dir=MODEL_DIR)
print(f"Done: {MODEL_DIR}")
