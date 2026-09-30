"""Vietnamese text-to-speech for the roleplay persona (mock for ElevenLabs/OpenAI TTS).

Uses Piper with the open vi_VN "vais1000" voice, running on the CPU inside the API pod,
so every phone hears the same clear Vietnamese voice regardless of installed browser voices.
"""
import io
import threading
import wave
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

# persona pacing via speaking speed only (length_scale > 1 is slower); pitch is left natural
PACE = {"store_manager": 1.08, "customer": 1.0, "promotion": 1.0, "full_sale": 1.0, "store_staff": 0.95}

_lock = threading.Lock()
_voice = None


class TTSUnavailable(RuntimeError):
    pass


def _load():
    global _voice
    if _voice is None:
        path = Path(get_settings().tts_model_path)
        if not path.exists():
            raise TTSUnavailable(f"voice model missing at {path}")
        from piper import PiperVoice  # heavy import, only when TTS is used

        _voice = PiperVoice.load(str(path))
    return _voice


def warm() -> None:
    """Loads the voice ahead of the first request; a missing model only disables TTS."""
    try:
        with _lock:
            _load()
    except TTSUnavailable:
        pass


@lru_cache(maxsize=256)
def synthesize(text: str, group: str) -> bytes:
    """WAV (mono, 22.05 kHz) for one persona line; cached because openings repeat."""
    with _lock:  # one ONNX session shared by all requests
        voice = _load()
        from piper import SynthesisConfig

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav:
            voice.synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=PACE.get(group, 1.0)))
    return buf.getvalue()
