"""
SARA AI — AssemblyAI Speech-to-Text Provider
Provides high-accuracy multilingual transcription using AssemblyAI with persistent HTTP client pooling
and seamless fallback to Deepgram and Groq Whisper.
"""
import time
import httpx
import logging
import io
import asyncio
from typing import Dict, Any, Optional
import certifi
from server.config import settings
from server.providers.base import STTProvider

logger = logging.getLogger("sara.providers.assemblyai_stt")


class AssemblyAISTT(STTProvider):
    _shared_client: Optional[httpx.AsyncClient] = None

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.ASSEMBLYAI_API_KEY
        self.upload_endpoint = "https://api.assemblyai.com/v2/upload"
        self.transcript_endpoint = "https://api.assemblyai.com/v2/transcript"

    @classmethod
    async def _get_client(cls) -> httpx.AsyncClient:
        if cls._shared_client is None or cls._shared_client.is_closed:
            cls._shared_client = httpx.AsyncClient(
                timeout=8.0,
                verify=certifi.where(),
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=40, keepalive_expiry=60.0),
            )
        return cls._shared_client

    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio bytes using AssemblyAI.
        Falls back seamlessly to Deepgram / Groq Whisper if AssemblyAI encounters any network delay.
        """
        start_time = time.perf_counter()

        if not self.api_key:
            return await self._fallback(audio_bytes, start_time, language_hint)

        headers = {
            "Authorization": self.api_key,
        }

        client = await self._get_client()
        try:
            # 1. Upload audio bytes
            upload_res = await client.post(
                self.upload_endpoint,
                headers=headers,
                content=audio_bytes,
                timeout=5.0
            )

            if upload_res.status_code == 200:
                audio_url = upload_res.json().get("upload_url")
                if audio_url:
                    # 2. Request transcription with universal model
                    trans_req = {
                        "audio_url": audio_url,
                        "speech_model": "nano",  # Fastest REST speech model (<800ms)
                        "language_detection": True,
                    }
                    if language_hint:
                        h = language_hint.lower()
                        if "te" in h:
                            trans_req["language_code"] = "te"
                        elif "hi" in h:
                            trans_req["language_code"] = "hi"
                        elif "en" in h:
                            trans_req["language_code"] = "en"

                    init_res = await client.post(
                        self.transcript_endpoint,
                        headers={"Authorization": self.api_key, "Content-Type": "application/json"},
                        json=trans_req,
                        timeout=5.0
                    )

                    if init_res.status_code == 200:
                        job_id = init_res.json().get("id")
                        poll_url = f"{self.transcript_endpoint}/{job_id}"

                        # Poll up to 2.5s for completion
                        for _ in range(8):
                            await asyncio.sleep(0.3)
                            poll_res = await client.get(poll_url, headers=headers)
                            if poll_res.status_code == 200:
                                poll_data = poll_res.json()
                                st = poll_data.get("status")
                                if st == "completed":
                                    elapsed_ms = (time.perf_counter() - start_time) * 1000
                                    return {
                                        "transcript": poll_data.get("text", "").strip(),
                                        "detected_language": poll_data.get("language_code", language_hint or "en"),
                                        "confidence": round(poll_data.get("confidence") or 0.95, 3),
                                        "latency_ms": round(elapsed_ms, 2)
                                    }
                                elif st == "error":
                                    logger.warning(f"AssemblyAI job error: {poll_data.get('error')}")
                                    break
        except Exception as e:
            logger.warning(f"AssemblyAI STT notice: {e}. Falling back...")

        # Ultra-fast fallback to Groq/Deepgram
        return await self._fallback(audio_bytes, start_time, language_hint)

    async def _fallback(self, audio_bytes: bytes, start_time: float, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """Fallback to Deepgram if available, else Groq Whisper."""
        try:
            from server.providers.deepgram_stt import DeepgramSTT
            dg = DeepgramSTT()
            if dg.api_key:
                return await dg.transcribe(audio_bytes, language_hint)
        except Exception:
            pass

        try:
            from server.providers.deepgram_stt import DeepgramSTT
            dg = DeepgramSTT()
            return await dg._fallback_groq_whisper(audio_bytes, start_time, language_hint)
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            return {
                "transcript": "",
                "detected_language": language_hint or "en",
                "confidence": 0.0,
                "latency_ms": round(elapsed_ms, 2),
                "error": str(e)
            }
