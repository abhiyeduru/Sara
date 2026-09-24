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
        self.groq_api_key = settings.GROQ_API_KEY

    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio using Sarvam AI Saaras/Saarika model.
        Includes ultra-fast Groq Whisper fallback if Sarvam times out or encounters network latency.
        """
        start_time = time.perf_counter()

        if not self.api_key:
            return await self._fallback_groq(audio_bytes, start_time)

        headers = {
            "api-subscription-key": self.api_key
        }

        # Normalize language_hint into standard BCP-47 for Sarvam (te-IN, hi-IN, en-IN)
        lang_code = "unknown"
        if language_hint:
            h = language_hint.lower()
            if "te" in h:
                lang_code = "te-IN"
            elif "hi" in h:
                lang_code = "hi-IN"
            elif "en" in h:
                lang_code = "en-IN"

        files = {
            "file": ("input.wav", audio_bytes, "audio/wav")
        }
        data = {
            "model": self.model,
            "language_code": lang_code
        }

        try:
            # 3.0s timeout ensures voice conversation never hangs
            async with httpx.AsyncClient(timeout=3.0) as client:
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
                logger.warning(f"Sarvam STT returned {response.status_code}, falling back to Groq Whisper")
                return await self._fallback_groq(audio_bytes, start_time, language_hint=lang_code)
        except Exception as e:
            logger.warning(f"Sarvam STT notice ({e}), invoking fast Groq Whisper fallback")
            return await self._fallback_groq(audio_bytes, start_time, language_hint=lang_code)

    async def _fallback_groq(self, audio_bytes: bytes, start_time: float, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Ultra-fast Groq Whisper STT fallback (~200ms latency).
        """
        if not self.groq_api_key:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            return {
                "transcript": "",
                "detected_language": "en",
                "confidence": 0.0,
                "latency_ms": round(elapsed_ms, 2),
                "error": "STT unavailable"
            }

        try:
            whisper_data = {
                "model": "whisper-large-v3-turbo",
                "response_format": "verbose_json",
                "prompt": "SARA Real Estate, 2 BHK, 3 BHK, Gachibowli, Kondapur, Lakhs, Crores, site visit."
            }
            if language_hint and "te" in language_hint.lower():
                whisper_data["language"] = "te"
            elif language_hint and "hi" in language_hint.lower():
                whisper_data["language"] = "hi"

            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.groq_api_key}"},
                    files={"file": ("input.wav", audio_bytes, "audio/wav")},
                    data=whisper_data
                )

            elapsed_ms = (time.perf_counter() - start_time) * 1000
            if res.status_code == 200:
                data = res.json()
                transcript = data.get("text", "").strip()
                raw_lang = data.get("language", "english").lower()
                norm_lang = "te" if "telugu" in raw_lang else ("hi" if "hindi" in raw_lang else "en")
                return {
                    "transcript": transcript,
                    "detected_language": norm_lang,
                    "raw_language_code": raw_lang,
                    "confidence": 0.95,
                    "latency_ms": round(elapsed_ms, 2)
                }
        except Exception as e:
            logger.error(f"Groq Whisper fallback failed: {e}")

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return {
            "transcript": "",
            "detected_language": "en",
            "confidence": 0.0,
            "latency_ms": round(elapsed_ms, 2),
            "error": "STT processing failed"
        }

