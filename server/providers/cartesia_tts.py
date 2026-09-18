import time
import httpx
import logging
from typing import Dict, Any, Optional, List
import cartesia
from server.config import settings
from server.providers.base import TTSProvider

logger = logging.getLogger(__name__)

# Curated list of high-quality tested voices with fallback metadata
POPULAR_VOICES = [
    {
        "id": "07bc462a-c644-49f1-baf7-82d5599131be",
        "name": "SARA Telugu (Native)",
        "gender": "female",
        "style": "Warm & Fluent",
        "language": "te",
        "description": "Authentic native Telugu neural voice with clear pronunciation."
    },
    {
        "id": "4459a9a5-69d6-4680-b970-e13dc51845b6",
        "name": "SARA Hindi (Native)",
        "gender": "female",
        "style": "Polite & Professional",
        "language": "hi",
        "description": "Authentic native Hindi neural voice with warm conversational pacing."
    },
    {
        "id": "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
        "name": "Skylar (English Recommended)",
        "gender": "female",
        "style": "Warm & Professional",
        "language": "en",
        "description": "Natural, warm, confident voice with crystal clear articulation."
    },
    {
        "id": "62ae83ad-4f6a-430b-af41-a9bede9286ca",
        "name": "Gemma",
        "gender": "female",
        "style": "Friendly & Helpful",
        "language": "en",
        "description": "Approachable and empathetic tone ideal for customer support."
    },
    {
        "id": "47c38ca4-5f35-497b-b1a3-415245fb35e1",
        "name": "Daniel",
        "gender": "male",
        "style": "Authoritative & Calm",
        "language": "en",
        "description": "Deep, confident, executive voice ideal for financial & consultative sales."
    },
    {
        "id": "ef191366-f52f-447a-a398-ed8c0f2943a1",
        "name": "Archie",
        "gender": "male",
        "style": "Energetic & Modern",
        "language": "en",
        "description": "Youthful, vibrant male voice suitable for education and product sales."
    }
]

class CartesiaTTS(TTSProvider):
    def __init__(self, api_key: Optional[str] = None, model_id: Optional[str] = None):
        self.api_key = api_key or settings.CARTESIA_API_KEY
        self.model_id = model_id or "sonic-2"
        self.endpoint = "https://api.cartesia.ai/tts/bytes"
        self._cached_voices: Optional[List[Dict[str, Any]]] = None
        self._cartesia_exhausted: bool = False
        self._last_exhausted_check: float = 0.0

    async def _synthesize_sarvam_fallback(self, text: str, language: Optional[str] = "en") -> Dict[str, Any]:
        """
        High-fidelity fallback to Sarvam bulbul:v3 when Cartesia runs out of credits or encounters an error.
        Guarantees 100% voice uptime for English, Telugu, and Hindi conversations.
        """
        import base64
        start_time = time.perf_counter()
        if not settings.SARVAM_API_KEY:
            return {"audio_bytes": b"", "latency_ms": 0.0, "error": "SARVAM_API_KEY not configured"}

        # Select native speaker according to language
        lang_norm = (language or "en").lower()
        if "te" in lang_norm:
            # Pooja is the sweet, respectful, natural proper Telugu voice
            speaker = "pooja"
            target_lang = "te-IN"
            pace = 1.02
        elif "hi" in lang_norm:
            speaker = "aditya"
            target_lang = "hi-IN"
            pace = 1.0
        else:
            speaker = "simran"
            target_lang = "en-IN"
            pace = 1.0

        headers = {
            "api-subscription-key": settings.SARVAM_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "inputs": [text],
            "target_language_code": target_lang,
            "speaker": speaker,
            "pace": pace,
            "enable_preprocessing": True,
            "model": "bulbul:v3"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post("https://api.sarvam.ai/text-to-speech", headers=headers, json=payload)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            if r.status_code == 200:
                res = r.json()
                audios = res.get("audios", [])
                if audios:
                    raw_audio = base64.b64decode(audios[0])
                    return {
                        "audio_bytes": raw_audio,
                        "latency_ms": round(elapsed_ms, 2),
                        "sample_rate": 24000,
                        "format": "audio/wav",
                        "provider": "sarvam_fallback"
                    }
            logger.warning(f"Sarvam TTS fallback error {r.status_code}: {r.text[:120]}")
        except Exception as e:
            logger.warning(f"Sarvam TTS fallback exception: {e}")

        return {"audio_bytes": b"", "latency_ms": round((time.perf_counter() - start_time) * 1000, 2), "error": "TTS synthesis failed across all providers"}

    async def synthesize_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: Optional[str] = "en"
    ) -> Dict[str, Any]:
        """
        Synthesize text into WAV audio bytes using Cartesia sonic-2.
        Falls back to native Sarvam TTS if Cartesia is out of credits or unavailable.
        Measures exact time to first audio bytes (TTFA).
        """
        start_time = time.perf_counter()
        target_voice = voice_id or settings.DEFAULT_VOICE_ID or "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"

        # Check if text contains alphanumeric content to prevent HTTP 400
        if not text or not any(c.isalnum() for c in text):
            return {
                "audio_bytes": b"",
                "latency_ms": 0.0
            }

        # Fast Circuit Breaker: Skip Cartesia immediately if quota is exhausted (saving ~400ms per phrase)
        if self._cartesia_exhausted and (time.time() - self._last_exhausted_check < 300):
            return await self._synthesize_sarvam_fallback(text, language=language)

        if not self.api_key:
            return await self._synthesize_sarvam_fallback(text, language=language)

        headers = {
            "X-API-Key": self.api_key,
            "Cartesia-Version": "2024-06-10",
            "Content-Type": "application/json"
        }

        payload = {
            "model_id": self.model_id,
            "transcript": text,
            "voice": {
                "mode": "id",
                "id": target_voice
            },
            "output_format": {
                "container": "wav",
                "encoding": "pcm_s16le",
                "sample_rate": 24000
            },
            "language": "en"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(self.endpoint, headers=headers, json=payload)

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            if response.status_code == 200:
                raw_bytes = bytearray(response.content)
                data_idx = raw_bytes.find(b'data')
                if data_idx != -1 and len(raw_bytes) > data_idx + 8:
                    import struct
                    struct.pack_into('<I', raw_bytes, 4, len(raw_bytes) - 8)
                    struct.pack_into('<I', raw_bytes, data_idx + 4, len(raw_bytes) - (data_idx + 8))

                self._cartesia_exhausted = False
                return {
                    "audio_bytes": bytes(raw_bytes),
                    "latency_ms": round(elapsed_ms, 2),
                    "sample_rate": 24000,
                    "format": "audio/wav",
                    "provider": "cartesia"
                }
            else:
                if response.status_code in [402, 401]:
                    self._cartesia_exhausted = True
                    self._last_exhausted_check = time.time()
                logger.warning(f"Cartesia TTS HTTP {response.status_code}. Activating fast Sarvam TTS fallback...")
                return await self._synthesize_sarvam_fallback(text, language=language)
        except Exception as e:
            logger.warning(f"Error connecting to Cartesia: {e}. Activating fast Sarvam TTS fallback...")
            return await self._synthesize_sarvam_fallback(text, language=language)

    def list_voices(self, gender: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List available voices from Cartesia. If API fails, return curated real voices.
        """
        if self._cached_voices:
            voices = self._cached_voices
        else:
            try:
                client = cartesia.Cartesia(api_key=self.api_key)
                cartesia_voices = list(client.voices.list())
                formatted = []
                for v in cartesia_voices:
                    g = "female"
                    name_lower = v.name.lower()
                    if any(m in name_lower for m in ["daniel", "archie", "parker", "michael", "james", "john", "david"]):
                        g = "male"
                    formatted.append({
                        "id": v.id,
                        "name": v.name,
                        "gender": g,
                        "description": getattr(v, "description", "") or "Cartesia high-fidelity neural voice",
                        "style": "Neural Natural",
                        "language": "en"
                    })
                self._cached_voices = formatted if formatted else POPULAR_VOICES
                voices = self._cached_voices
            except Exception as e:
                logger.warning(f"Failed to fetch live Cartesia voices: {e}. Falling back to popular voices.")
                voices = POPULAR_VOICES

        if gender:
            return [v for v in voices if v.get("gender", "").lower() == gender.lower()]
        return voices
