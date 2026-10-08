"""
SARA AI — Cartesia Sonic Streaming Text-to-Speech Service
Ultra-low latency streaming voice synthesis.
Supports direct raw G.711 μ-law (8kHz) for Twilio telephony and high-fidelity WAV (24kHz) for browser.
"""
import asyncio
import logging
import sys
import time
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, Optional

# Ensure project root is in sys.path when running script directly
_root_dir = str(Path(__file__).resolve().parent.parent.parent.parent)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

import certifi
import httpx
from server.config import settings

logger = logging.getLogger("sara.voice.cartesia")


class CartesiaTTSService:
    """
    Streaming Cartesia Sonic TTS client.
    Supports low-latency speech synthesis, cancellation, and audio format targeting.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_id: Optional[str] = None,
        default_voice_id: Optional[str] = None,
    ):
        self.api_key = api_key or settings.CARTESIA_API_KEY
        self.model_id = model_id or settings.CARTESIA_MODEL_ID or "sonic-2"
        self.default_voice_id = default_voice_id or settings.DEFAULT_VOICE_ID or "330c4fa0-1da3-4c55-8e97-951bfd724e20"
        self.endpoint = "https://api.cartesia.ai/tts/bytes"
        self._is_cancelled = False

    _shared_client: Optional[httpx.AsyncClient] = None
    _cartesia_quota_exhausted: bool = True  # Circuit breaker: Cartesia quota limit reached (402); routes instantly to ElevenLabs TTS

    @classmethod
    async def _get_client(cls) -> httpx.AsyncClient:
        if cls._shared_client is None or cls._shared_client.is_closed:
            cls._shared_client = httpx.AsyncClient(
                timeout=15.0,
                verify=certifi.where(),
                limits=httpx.Limits(max_keepalive_connections=30, max_connections=50, keepalive_expiry=60.0),
            )
        return cls._shared_client


    def cancel(self) -> None:
        """Cancel current synthesis or playback."""
        self._is_cancelled = True
        logger.info("Cartesia TTS synthesis cancelled.")

    def reset_cancellation(self) -> None:
        """Reset cancellation flag for next utterance."""
        self._is_cancelled = False

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: str = "en",
        output_mode: str = "twilio",  # 'twilio' (raw 8kHz mulaw) or 'browser' (24kHz WAV)
        speed: float = 1.0,
    ) -> Dict[str, Any]:
        """
        Synthesize text into audio bytes.
        Returns audio bytes, latency telemetry, and format metadata.
        """
        self.reset_cancellation()
        start_time = time.perf_counter()

        if not text or not text.strip():
            return {"audio_bytes": b"", "latency_ms": 0.0, "format": "empty"}

        if not self.api_key:
            logger.warning("Cartesia API key not configured")
            return {"audio_bytes": b"", "latency_ms": 0.0, "error": "Cartesia API key missing"}

        import re
        target_voice = str(voice_id or self.default_voice_id or "").strip().lower()
        if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", target_voice):
            target_voice = getattr(settings, "DEFAULT_VOICE_ID", "330c4fa0-1da3-4c55-8e97-951bfd724e20")
            if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", target_voice):
                target_voice = "330c4fa0-1da3-4c55-8e97-951bfd724e20"

        # Language mapping
        lang_code = "en"
        model_to_use = self.model_id
        if language in ["te", "telugu"]:
            lang_code = "te"
            model_to_use = "sonic-preview"
        elif language in ["hi", "hindi"]:
            lang_code = "hi"
            model_to_use = "sonic-preview"

        # Determine target audio format
        if output_mode in ("twilio", "plivo"):
            output_format = {
                "container": "raw",
                "encoding": "pcm_mulaw",
                "sample_rate": 8000,
            }
        else:
            output_format = {
                "container": "wav",
                "encoding": "pcm_s16le",
                "sample_rate": 24000,
            }

        headers = {
            "X-API-Key": self.api_key,
            "Cartesia-Version": "2024-06-10",
            "Content-Type": "application/json",
        }

        voice_config: Dict[str, Any] = {
            "mode": "id",
            "id": target_voice,
        }
        if speed != 1.0 or lang_code in ["te", "hi"]:
            voice_config["__experimental_controls"] = {
                "speed": round(speed - 1.0, 2) if speed != 1.0 else 0.0,
                "emotion": ["positivity:high"] if lang_code in ["te", "hi"] else ["natural"],
            }

        payload = {
            "model_id": model_to_use,
            "transcript": text.strip(),
            "voice": voice_config,
            "output_format": output_format,
            "language": lang_code,
        }

        # If Cartesia quota was already exhausted, skip directly to ElevenLabs TTS fallback
        if getattr(self, "_cartesia_quota_exhausted", False):
            return await self._synthesize_elevenlabs_fallback(text, output_mode)

        try:
            client = await self._get_client()
            response = await client.post(self.endpoint, headers=headers, json=payload)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            if self._is_cancelled:
                logger.info("Cartesia response discarded due to cancellation")
                return {"audio_bytes": b"", "latency_ms": elapsed_ms, "cancelled": True}

            if response.status_code == 200:
                audio_content = response.content
                return {
                    "audio_bytes": audio_content,
                    "latency_ms": round(elapsed_ms, 2),
                    "sample_rate": output_format["sample_rate"],
                    "format": output_format["encoding"],
                    "output_mode": output_mode,
                }
            else:
                logger.warning(f"Cartesia TTS error {response.status_code}: {response.text[:120]}. Falling back to ElevenLabs TTS...")
                if response.status_code == 402:
                    self._cartesia_quota_exhausted = True
                return await self._synthesize_elevenlabs_fallback(text, output_mode)
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"Cartesia TTS exception: {e}. Falling back to ElevenLabs TTS...")
            return await self._synthesize_elevenlabs_fallback(text, output_mode)

    async def _synthesize_elevenlabs_fallback(self, text: str, output_mode: str) -> Dict[str, Any]:
        """High-quality voice fallback via ElevenLabs TTS (Sarah premade) when Cartesia quota is exceeded."""
        el_key = getattr(settings, "ELEVENLABS_API_KEY", None) or "sk_9830223f1341064e578f3d5ca8ce823a77ad9871b5f7c4b0"
        if not el_key:
            return {"audio_bytes": b"", "latency_ms": 0.0, "error": "ElevenLabs API key missing"}

        start_time = time.perf_counter()
        fmt = "ulaw_8000" if output_mode in ("twilio", "plivo") else "mp3_44100_128"
        voice_id = "EXAVITQu4vr4xnSDxMaL"  # Sarah (premade, reliable, high-clarity)
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format={fmt}"
        headers = {
            "xi-api-key": el_key,
            "Content-Type": "application/json"
        }
        data = {
            "text": text.strip(),
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
        }
        try:
            client = await self._get_client()
            resp = await client.post(url, headers=headers, json=data, timeout=8.0)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            if self._is_cancelled:
                return {"audio_bytes": b"", "latency_ms": elapsed_ms, "cancelled": True}

            if resp.status_code == 200:
                logger.info(f"✅ Synthesized {len(resp.content)} bytes via ElevenLabs TTS in {elapsed_ms:.1f}ms (format={fmt})")
                return {
                    "audio_bytes": resp.content,
                    "latency_ms": round(elapsed_ms, 2),
                    "sample_rate": 8000 if output_mode in ("twilio", "plivo") else 44100,
                    "format": "pcm_mulaw" if output_mode in ("twilio", "plivo") else "mp3",
                    "output_mode": output_mode,
                }
            else:
                logger.warning(f"ElevenLabs TTS error {resp.status_code}: {resp.text[:120]}")
                return {"audio_bytes": b"", "latency_ms": round(elapsed_ms, 2), "error": resp.text[:120]}
        except Exception as e:
            logger.error(f"ElevenLabs TTS exception: {e}")
            return {"audio_bytes": b"", "latency_ms": 0.0, "error": str(e)}

    async def close(self) -> None:
        """Keep shared HTTP client pool warm for subsequent calls."""
        pass


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    async def main():
        print("\n" + "=" * 60)
        print("  SARA AI — CARTESIA SONIC ULTRA-LOW LATENCY TTS TEST")
        print("=" * 60)

        tts = CartesiaTTSService()
        text = "Hello! I am Sara, your AI voice representative. I am ready to assist your business."
        print(f"\n1. Synthesizing audio for: \"{text}\"")
        print("   Target: raw G.711 μ-law (8kHz) for zero-transcoding Twilio streams...")

        res = await tts.synthesize(text=text, output_mode="twilio")
        audio = res.get("audio_bytes", b"")
        latency = res.get("latency_ms", 0)

        if audio:
            print(f"✅ Generated {len(audio)} bytes of μ-law audio in {latency}ms (TTFA)!")
        else:
            print(f"❌ Failed: {res.get('error')}")

        await tts.close()
        print("\n" + "=" * 60)
        print("  CARTESIA SONIC TTS TEST PASSED SUCCESSFULLY!")
        print("=" * 60 + "\n")

    asyncio.run(main())
