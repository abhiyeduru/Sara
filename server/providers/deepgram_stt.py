"""
SARA AI — Deepgram Speech-to-Text Provider
Provides high-accuracy, ultra-low latency transcription using Deepgram Nova-2/Nova-3 models.
"""
import time
import httpx
import logging
from typing import Dict, Any, Optional
from server.config import settings
from server.providers.base import STTProvider

logger = logging.getLogger("sara.providers.deepgram_stt")


class DeepgramSTT(STTProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.DEEPGRAM_API_KEY
        self.endpoint = "https://api.deepgram.com/v1/listen"
        self.model = "nova-2"

    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio bytes using Deepgram Nova model with smart formatting.
        """
        start_time = time.perf_counter()

        if not self.api_key:
            return {
                "transcript": "",
                "detected_language": "en",
                "confidence": 0.0,
                "latency_ms": 0.0,
                "error": "Deepgram API key not configured"
            }

        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "audio/wav"
        }

        # Language mapping
        params = {
            "model": self.model,
            "smart_format": "true",
            "punctuate": "true"
        }
        if language_hint:
            h = language_hint.lower()
            if "te" in h:
                # Deepgram supports te or multilingual
                params["language"] = "te"
            elif "hi" in h:
                params["language"] = "hi"
            elif "en" in h:
                params["language"] = "en"
        else:
            params["detect_language"] = "true"

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(self.endpoint, headers=headers, params=params, content=audio_bytes)

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            if res.status_code == 200:
                data = res.json()
                results = data.get("results", {})
                channels = results.get("channels", [])
                if channels:
                    alts = channels[0].get("alternatives", [])
                    if alts:
                        top = alts[0]
                        transcript = top.get("transcript", "").strip()
                        confidence = top.get("confidence", 0.95)
                        detected_lang = channels[0].get("detected_language", "en")
                        return {
                            "transcript": transcript,
                            "detected_language": detected_lang,
                            "confidence": round(confidence, 3),
                            "latency_ms": round(elapsed_ms, 2)
                        }
            logger.warning(f"Deepgram STT status {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Deepgram STT Exception: {e}")

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return {
            "transcript": "",
            "detected_language": "en",
            "confidence": 0.0,
            "latency_ms": round(elapsed_ms, 2),
            "error": "Deepgram transcription failed"
        }
