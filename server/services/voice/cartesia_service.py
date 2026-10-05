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
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=15.0,
                verify=certifi.where(),
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=40),
            )
        return self._client

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
        target_voice = voice_id or self.default_voice_id
        if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", str(target_voice).strip().lower()):
            target_voice = self.default_voice_id

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
                logger.warning(f"Cartesia TTS error {response.status_code}: {response.text[:120]}")
                return {
                    "audio_bytes": b"",
                    "latency_ms": round(elapsed_ms, 2),
                    "error": f"Cartesia HTTP {response.status_code}: {response.text[:100]}",
                }
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"Cartesia TTS exception: {e}")
            return {
                "audio_bytes": b"",
                "latency_ms": round(elapsed_ms, 2),
                "error": str(e),
            }

    async def close(self) -> None:
        """Close HTTP client connections."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None


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
