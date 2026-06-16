"""CosyVoice2 voice-clone service (GPU).

A small FastAPI wrapper around CosyVoice2-0.5B that lets you:
  1. /enroll  —— 上传一段 5-10s 录音 + 这段录音的文字，注册成一个可复用的克隆音色 (spk_id)
  2. /tts     —— 用 spk_id + 任意文本，合成「你自己音色」的语音

主站点（Cloudflare Pages Function / FastAPI 后端）通过环境变量 VOICE_CLONE_URL
指向本服务，把克隆请求转发过来。

必须有 GPU。模型与依赖见同目录 deploy.sh / README.md。

环境变量：
  COSYVOICE_DIR   CosyVoice 仓库路径（含 third_party/Matcha-TTS），默认 ./CosyVoice
  MODEL_DIR       模型目录，默认 $COSYVOICE_DIR/pretrained_models/CosyVoice2-0.5B
  SPK_DATA_DIR    保存已注册音色（参考音频 + 文字）的目录，默认 ./spk_data
  ALLOWED_ORIGINS 允许的来源，逗号分隔，默认 *
"""

import base64
import io
import json
import os
import sys
import time
import uuid

import torch
import torchaudio
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

COSYVOICE_DIR = os.environ.get("COSYVOICE_DIR", os.path.join(os.path.dirname(__file__), "CosyVoice"))
MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(COSYVOICE_DIR, "pretrained_models", "CosyVoice2-0.5B"))
SPK_DATA_DIR = os.environ.get("SPK_DATA_DIR", os.path.join(os.path.dirname(__file__), "spk_data"))
REGISTRY_PATH = os.path.join(SPK_DATA_DIR, "registry.json")
PROMPT_SR = 16000  # CosyVoice 参考音频固定 16kHz

# CosyVoice 仓库依赖 sys.path 里能找到它自己和 Matcha-TTS
sys.path.append(COSYVOICE_DIR)
sys.path.append(os.path.join(COSYVOICE_DIR, "third_party", "Matcha-TTS"))

os.makedirs(SPK_DATA_DIR, exist_ok=True)

app = FastAPI(title="3C Voice Clone (CosyVoice2)")

_allowed = os.environ.get("ALLOWED_ORIGINS", "*").strip()
_origins = ["*"] if _allowed in ("", "*") else [o.strip() for o in _allowed.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 延迟加载，避免没装好依赖时 import 就崩
_model = None
_model_loading = False
_model_load_error: str | None = None


def get_model():
    global _model, _model_loading, _model_load_error
    if _model is None:
        _model_loading = True
        _model_load_error = None
        try:
            from cosyvoice.cli.cosyvoice import AutoModel

            _model = AutoModel(model_dir=MODEL_DIR)
            _restore_speakers(_model)
        except Exception as error:  # noqa: BLE001
            _model_load_error = str(error)
            raise
        finally:
            _model_loading = False
    return _model


def _preload_model() -> None:
    """后台预加载模型，让 /health 能反映真实就绪状态。"""
    import threading

    def _load() -> None:
        try:
            print("[voice-clone] preloading model...", flush=True)
            get_model()
            print("[voice-clone] model ready", flush=True)
        except Exception as error:  # noqa: BLE001
            print(f"[voice-clone] preload failed: {error}", flush=True)

    threading.Thread(target=_load, daemon=True, name="model-preload").start()


@app.on_event("startup")
def _on_startup() -> None:
    if os.environ.get("PRELOAD_MODEL", "1").strip().lower() not in ("0", "false", "no"):
        _preload_model()


def _load_registry() -> dict:
    if not os.path.exists(REGISTRY_PATH):
        return {}
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (ValueError, OSError):
        return {}


def _save_registry(registry: dict) -> None:
    with open(REGISTRY_PATH, "w", encoding="utf-8") as fh:
        json.dump(registry, fh, ensure_ascii=False, indent=2)


def _restore_speakers(model) -> None:
    """重启后用磁盘上保存的参考音频 + 文字，把音色重新注册回模型。"""
    registry = _load_registry()
    for spk_id, info in registry.items():
        wav_path = info.get("wav_path")
        prompt_text = info.get("prompt_text") or ""
        if wav_path and os.path.exists(wav_path):
            try:
                model.add_zero_shot_spk(prompt_text, wav_path, spk_id)
            except Exception as error:  # noqa: BLE001 - 单个音色失败不应阻断启动
                print(f"[voice-clone] restore spk {spk_id} failed: {error}", flush=True)
    try:
        model.save_spkinfo()
    except Exception:  # noqa: BLE001
        pass


def _save_prompt_wav(raw: bytes, spk_id: str) -> str:
    """把上传的任意音频转成 16kHz 单声道 wav 存盘，返回路径。"""
    waveform, sr = torchaudio.load(io.BytesIO(raw))
    if waveform.shape[0] > 1:  # 多声道转单声道
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != PROMPT_SR:
        waveform = torchaudio.functional.resample(waveform, sr, PROMPT_SR)
    wav_path = os.path.join(SPK_DATA_DIR, f"{spk_id}.wav")
    torchaudio.save(wav_path, waveform, PROMPT_SR)
    return wav_path


class TtsInput(BaseModel):
    text: str | None = None
    spk_id: str | None = None
    format: str | None = "wav"


@app.get("/health")
def health():
    registry = _load_registry()
    return {
        "ok": _model_load_error is None,
        "modelDir": MODEL_DIR,
        "modelLoaded": _model is not None,
        "modelLoading": _model_loading,
        "modelLoadError": _model_load_error,
        "cuda": torch.cuda.is_available(),
        "speakers": list(registry.keys()),
    }


@app.post("/warmup")
def warmup():
    """显式触发模型加载（运维探针 / 首次部署后预热）。"""
    try:
        get_model()
    except Exception as error:  # noqa: BLE001
        return JSONResponse({"error": str(error), "modelLoaded": False}, status_code=503)
    return {"modelLoaded": True, "speakers": list(_load_registry().keys())}


@app.get("/speakers")
def speakers():
    registry = _load_registry()
    return {
        "speakers": [
            {"spkId": spk_id, "promptText": info.get("prompt_text", ""), "createdAt": info.get("created_at")}
            for spk_id, info in registry.items()
        ]
    }


@app.post("/enroll")
async def enroll(
    audio: UploadFile = File(...),
    prompt_text: str = Form(...),
    spk_id: str | None = Form(None),
):
    prompt_text = (prompt_text or "").strip()
    if not prompt_text:
        return JSONResponse({"error": "缺少录音文字 prompt_text（这段录音里你说了什么）"}, status_code=400)

    raw = await audio.read()
    if not raw:
        return JSONResponse({"error": "音频为空"}, status_code=400)

    spk_id = (spk_id or "").strip() or f"clone_{uuid.uuid4().hex[:10]}"

    try:
        wav_path = _save_prompt_wav(raw, spk_id)
    except Exception as error:  # noqa: BLE001
        return JSONResponse({"error": f"音频解析失败：{error}"}, status_code=400)

    try:
        model = get_model()
        ok = model.add_zero_shot_spk(prompt_text, wav_path, spk_id)
        if ok is False:
            return JSONResponse({"error": "音色注册失败（add_zero_shot_spk 返回 False）"}, status_code=502)
        model.save_spkinfo()
    except Exception as error:  # noqa: BLE001
        return JSONResponse({"error": f"音色注册失败：{error}"}, status_code=500)

    registry = _load_registry()
    registry[spk_id] = {
        "prompt_text": prompt_text,
        "wav_path": wav_path,
        "created_at": int(time.time()),
    }
    _save_registry(registry)
    return {"spkId": spk_id, "promptText": prompt_text}


@app.post("/tts")
def tts(data: TtsInput):
    text = (data.text or "").strip()
    if not text:
        return JSONResponse({"error": "缺少要合成的文本 text"}, status_code=400)
    spk_id = (data.spk_id or "").strip()
    if not spk_id:
        return JSONResponse({"error": "缺少音色 spk_id（先调用 /enroll 克隆）"}, status_code=400)

    registry = _load_registry()
    if spk_id not in registry:
        return JSONResponse({"error": f"未找到音色 {spk_id}，请先 /enroll"}, status_code=404)

    fmt = (data.format or "wav").lower()
    if fmt not in ("wav", "mp3"):
        fmt = "wav"

    try:
        model = get_model()
        chunks = []
        # 已注册音色：prompt_text / prompt_wav 传空，用 zero_shot_spk_id 指定
        for out in model.inference_zero_shot(text, "", "", zero_shot_spk_id=spk_id, stream=False):
            chunks.append(out["tts_speech"])
        if not chunks:
            return JSONResponse({"error": "合成返回为空"}, status_code=502)
        speech = torch.cat(chunks, dim=1)
    except Exception as error:  # noqa: BLE001
        return JSONResponse({"error": f"合成失败：{error}"}, status_code=500)

    buffer = io.BytesIO()
    try:
        torchaudio.save(buffer, speech, model.sample_rate, format=fmt)
    except Exception:  # noqa: BLE001 - 某些环境没有 mp3 编码器时退回 wav
        buffer = io.BytesIO()
        fmt = "wav"
        torchaudio.save(buffer, speech, model.sample_rate, format="wav")

    audio_b64 = base64.b64encode(buffer.getvalue()).decode("ascii")
    return {"audio": audio_b64, "format": fmt, "spkId": spk_id}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "9233")))
