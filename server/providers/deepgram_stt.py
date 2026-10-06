"""
SARA AI — Ultra-Low Latency Deepgram Speech-to-Text Provider
Provides high-accuracy transcription using Deepgram Nova-3/Nova-2 models with persistent connection pooling
and instant Groq Whisper fallback.
"""
import time
import httpx
import logging
import io
from typing import Dict, Any, Optional
import certifi
from server.config import settings
from server.providers.base import STTProvider

logger = logging.getLogger("sara.providers.deepgram_stt")


class DeepgramSTT(STTProvider):
    _shared_client: Optional[httpx.AsyncClient] = None

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.DEEPGRAM_API_KEY
        self.endpoint = "https://api.in.deepgram.com/v1/listen"
        self.fallback_endpoint = "https://api.deepgram.com/v1/listen"
        self.model = "nova-3"

    @classmethod
    async def _get_client(cls) -> httpx.AsyncClient:
        if cls._shared_client is None or cls._shared_client.is_closed:
            cls._shared_client = httpx.AsyncClient(
                timeout=5.0,
                verify=certifi.where(),
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=40, keepalive_expiry=60.0),
            )
        return cls._shared_client

    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio bytes using Deepgram Nova model with smart formatting.
        Uses persistent connection pooling to eliminate TLS handshake overhead.
        """
        start_time = time.perf_counter()

        if not self.api_key:
            return await self._fallback_groq_whisper(audio_bytes, start_time, language_hint)

        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "audio/wav"
        }

        # Language and model mapping
        # Note: Nova-3 is required for Telugu and Indic languages; Nova-2/Nova-3 for English
        h = (language_hint or "en").lower()
        if "te" in h:
            model_to_use = "nova-3"
            lang_param = "te"
        elif "hi" in h:
            model_to_use = "nova-3"
            lang_param = "hi"
        else:
            model_to_use = "nova-2"
            lang_param = "en"

        params = {
            "model": model_to_use,
            "language": lang_param,
            "smart_format": "true",
            "punctuate": "true"
        }

        client = await self._get_client()
        for ep in (self.endpoint, self.fallback_endpoint):
            try:
                res = await client.post(ep, headers=headers, params=params, content=audio_bytes)
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
                            detected_lang = channels[0].get("detected_language", lang_param)
                            return {
                                "transcript": transcript,
                                "detected_language": detected_lang,
                                "confidence": round(confidence, 3),
                                "latency_ms": round(elapsed_ms, 2)
                            }
                else:
                    logger.warning(f"Deepgram STT {ep} returned {res.status_code}: {res.text[:120]}")
            except Exception as e:
                logger.warning(f"Deepgram STT notice for {ep}: {e}")

        # Rapid fallback to Groq Whisper if Deepgram is unreachable
        return await self._fallback_groq_whisper(audio_bytes, start_time, language_hint)

    async def _fallback_groq_whisper(self, audio_bytes: bytes, start_time: float, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """Ultra-fast LPU fallback using Groq Whisper model."""
        if not settings.GROQ_API_KEY:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            return {
                "transcript": "",
                "detected_language": language_hint or "en",
                "confidence": 0.0,
                "latency_ms": round(elapsed_ms, 2),
                "error": "No STT provider available"
            }

        try:
            from groq import Groq
            groq_client = Groq(api_key=settings.GROQ_API_KEY)
            buf = io.BytesIO(audio_bytes)
            buf.name = "audio.wav"

            h = (language_hint or "en").lower()
            lang = "te" if "te" in h else ("hi" if "hi" in h else "en")

            # Run Groq client in executor to avoid blocking async event loop
            import asyncio
            loop = asyncio.get_running_loop()
            def do_transcribe():
                return groq_client.audio.transcriptions.create(
                    file=buf,
                    model="whisper-large-v3-turbo",
                    language=lang
                )

            res = await loop.run_in_executor(None, do_transcribe)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            transcript = (getattr(res, "text", "") or "").strip()
            return {
                "transcript": transcript,
                "detected_language": lang,
                "confidence": 0.92,
                "latency_ms": round(elapsed_ms, 2)
            }
        except Exception as e:
            logger.error(f"Groq Whisper fallback error: {e}")
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            return {
                "transcript": "",
                "detected_language": language_hint or "en",
                "confidence": 0.0,
                "latency_ms": round(elapsed_ms, 2),
                "error": str(e)
            }
