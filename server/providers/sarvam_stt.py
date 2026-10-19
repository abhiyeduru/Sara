import io
import time
import httpx
import logging
from typing import Dict, Any, Optional
from server.config import settings
from server.providers.base import STTProvider
from server.services.voice.audio_codec_service import AudioCodecService

logger = logging.getLogger("sara.providers.sarvam_stt")

class SarvamSTT(STTProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.SARVAM_API_KEY or "sk_jn30w4nk_BBKoKdIB5re7Y7khT7suNyUd"
        self.endpoint = "https://api.sarvam.ai/speech-to-text"
        m = getattr(settings, "SARVAM_STT_MODEL", "saarika:v2.5")
        self.model = m if m in ["saarika:v2.5", "saaras:v3", "saaras:v4"] else "saarika:v2.5"

    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio using Sarvam AI Saaras/Saarika model (native Indic Telugu, Hindi, Indian English).
        """
        start_time = time.perf_counter()

        if not self.api_key:
            return {
                "transcript": "",
                "detected_language": "te",
                "confidence": 0.0,
                "latency_ms": 0.0,
                "error": "SARVAM_API_KEY not configured"
            }

        headers = {
            "api-subscription-key": self.api_key
        }

        # Normalize language_hint into standard BCP-47 for Sarvam (te-IN, hi-IN, en-IN)
        lang_code = "te-IN"
        if language_hint:
            h = language_hint.lower()
            if "te" in h:
                lang_code = "te-IN"
            elif "hi" in h:
                lang_code = "hi-IN"
            elif "en" in h:
                lang_code = "en-IN"

        # Ensure audio has a valid WAV container
        wav_payload = audio_bytes
        if not wav_payload.startswith(b"RIFF"):
            # Assume 16kHz linear PCM mono if length is even, otherwise decode mulaw
            if len(wav_payload) > 0:
                try:
                    wav_payload = AudioCodecService.pcm_to_wav(audio_bytes, sample_rate=16000)
                except Exception:
                    pass

        files = {
            "file": ("input.wav", wav_payload, "audio/wav")
        }
        data = {
            "model": self.model,
            "language_code": lang_code
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(self.endpoint, headers=headers, files=files, data=data)

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            if response.status_code == 200:
                result = response.json()
                transcript = result.get("transcript", "").strip()
                detected_lang = result.get("language_code", "te-IN")
                prob = result.get("language_probability", 1.0)

                # Normalize language tag
                norm_lang = "te"
                if "hi" in detected_lang.lower():
                    norm_lang = "hi"
                elif "en" in detected_lang.lower():
                    norm_lang = "en"

                return {
                    "transcript": transcript,
                    "detected_language": norm_lang,
                    "raw_language_code": detected_lang,
                    "confidence": prob,
                    "latency_ms": round(elapsed_ms, 2)
                }
            else:
                logger.error(f"Sarvam STT returned status {response.status_code}: {response.text}")
                return {
                    "transcript": "",
                    "detected_language": "te",
                    "confidence": 0.0,
                    "latency_ms": round(elapsed_ms, 2),
                    "error": f"Sarvam error {response.status_code}"
                }
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"Sarvam STT Exception: {e}")
            return {
                "transcript": "",
                "detected_language": "te",
                "confidence": 0.0,
                "latency_ms": round(elapsed_ms, 2),
                "error": str(e)
            }
