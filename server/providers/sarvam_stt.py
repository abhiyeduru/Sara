import io
import time
import httpx
import logging
from typing import Dict, Any, Optional
from server.config import settings
from server.providers.base import STTProvider

logger = logging.getLogger(__name__)

class SarvamSTT(STTProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.SARVAM_API_KEY
        self.endpoint = "https://api.sarvam.ai/speech-to-text"
        self.model = settings.SARVAM_STT_MODEL or "saarika:v2.5"

    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio using Sarvam AI Saaras/Saarika model.
        Returns actual measured latency and detected language (English, Telugu, Hindi, etc.)
        """
        start_time = time.perf_counter()

        if not self.api_key:
            return {
                "transcript": "",
                "detected_language": "en",
                "confidence": 0.0,
                "latency_ms": 0.0,
                "error": "SARVAM_API_KEY not configured"
            }

        headers = {
            "api-subscription-key": self.api_key
        }

        # Sarvam handles language hints such as 'te-IN', 'hi-IN', 'en-IN' or 'unknown'
        lang_code = "unknown"
        if language_hint:
            if language_hint.startswith("te"):
                lang_code = "te-IN"
            elif language_hint.startswith("hi"):
                lang_code = "hi-IN"
            elif language_hint.startswith("en"):
                lang_code = "en-IN"

        files = {
            "file": ("input.wav", audio_bytes, "audio/wav")
        }
        data = {
            "model": self.model,
            "language_code": lang_code
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(self.endpoint, headers=headers, files=files, data=data)

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            if response.status_code == 200:
                result = response.json()
                transcript = result.get("transcript", "").strip()
                detected_lang = result.get("language_code", "en-IN")
                prob = result.get("language_probability", 1.0)

                # Normalize language tag
                norm_lang = "en"
                if "te" in detected_lang.lower():
                    norm_lang = "te"
                elif "hi" in detected_lang.lower():
                    norm_lang = "hi"

                return {
                    "transcript": transcript,
                    "detected_language": norm_lang,
                    "raw_language_code": detected_lang,
                    "confidence": prob,
                    "latency_ms": round(elapsed_ms, 2)
                }
            else:
                logger.error(f"Sarvam STT failed: {response.status_code} {response.text}")
                return {
                    "transcript": "",
                    "detected_language": "en",
                    "confidence": 0.0,
                    "latency_ms": round(elapsed_ms, 2),
                    "error": f"Sarvam error HTTP {response.status_code}"
                }
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.exception("Error during Sarvam STT transcription")
            return {
                "transcript": "",
                "detected_language": "en",
                "confidence": 0.0,
                "latency_ms": round(elapsed_ms, 2),
                "error": str(e)
            }
