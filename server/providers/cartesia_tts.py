import time
import re
import httpx
import logging
from typing import Dict, Any, Optional, List
import cartesia
from server.config import settings
from server.providers.base import TTSProvider
from server.providers.edge_tts_provider import EdgeTTSProvider

logger = logging.getLogger(__name__)

# Curated list of high-quality tested voices with fallback metadata
POPULAR_VOICES = [
    {
        "id": "330c4fa0-1da3-4c55-8e97-951bfd724e20",
        "name": "SARA Cartesia Telugu (Sarika - Calm & Sweet Spirit)",
        "gender": "female",
        "style": "Sweet, Calm & Conversational",
        "language": "te",
        "description": "Native Cartesia Telugu voice with sweet laidback tone and gentle rhythm, perfect for natural conversation."
    },
    {
        "id": "3a8e6fea-81e5-4d4d-8755-86093146cdb8",
        "name": "SARA Cartesia Telugu (Vidya - Empathetic Voice)",
        "gender": "female",
        "style": "Gentle & Reassuring",
        "language": "te",
        "description": "Native Cartesia Telugu neural voice with gentle, sweet, reassuring tone designed to build trust."
    },
    {
        "id": "sarvam-te-kavitha",
        "name": "SARA Telugu Crystal (Kavitha - Sweet & Crystal Clear)",
        "gender": "female",
        "style": "Sweet & Crystal Clear",
        "language": "te",
        "description": "Crystal-clear sweet native Telugu voice with pristine articulation and natural rhythm."
    },
    {
        "id": "sarvam-te-pooja",
        "name": "SARA Telugu Sweet (Pooja - Native Sweet Voice)",
        "gender": "female",
        "style": "Sweet, Respectful & Warm",
        "language": "te",
        "description": "Authentic sweet native Telugu voice with natural respect, clear diction, and gentle cadence."
    },
    {
        "id": "sarvam-te-kavya",
        "name": "SARA Telugu Friendly (Kavya - Conversational)",
        "gender": "female",
        "style": "Friendly & Cheerful",
        "language": "te",
        "description": "Warm, cheerful, approachable native Telugu voice for customer engagement."
    },
    {
        "id": "sarvam-te-shruti",
        "name": "SARA Telugu Elegant (Shruti - Articulate)",
        "gender": "female",
        "style": "Clear & Professional",
        "language": "te",
        "description": "Crisp, articulate and elegant Telugu voice for executive advisory and professional queries."
    },
    {
        "id": "sarvam-te-amartya",
        "name": "SARA Telugu Male (Amartya - Confident)",
        "gender": "male",
        "style": "Confident & Respectful",
        "language": "te",
        "description": "Authentic native Telugu male voice with natural conversational tone."
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

import io
import wave
import struct
import math

def generate_offline_audio(duration: float = 0.5, freq: float = 440.0) -> bytes:
    """Generate valid 24kHz PCM WAV audio bytes for offline testing and preview fallback"""
    sample_rate = 24000
    num_samples = int(sample_rate * duration)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        frames = bytearray()
        for i in range(num_samples):
            value = int(8000 * math.sin(2 * math.pi * freq * i / sample_rate) * math.exp(-2.5 * i / num_samples))
            frames.extend(struct.pack('<h', max(-32768, min(32767, value))))
        wav.writeframes(frames)
    return buf.getvalue()

class CartesiaTTS(TTSProvider):
    _cartesia_exhausted: bool = False
    _last_exhausted_check: float = 0.0

    def __init__(self, api_key: Optional[str] = None, model_id: Optional[str] = None):
        self.api_key = api_key or settings.CARTESIA_API_KEY
        self.model_id = model_id or settings.CARTESIA_MODEL_ID or "sonic-preview"
        self.endpoint = "https://api.cartesia.ai/tts/bytes"
        self._cached_voices: Optional[List[Dict[str, Any]]] = None
        self._http_client: Optional[httpx.AsyncClient] = None


    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=15.0,
                limits=httpx.Limits(max_keepalive_connections=15, max_connections=30)
            )
        return self._http_client

    async def _synthesize_sarvam_fallback(self, text: str, language: Optional[str] = "en", speaker: Optional[str] = None) -> Dict[str, Any]:
        """
        High-fidelity fallback to Sarvam bulbul:v3 when Cartesia runs out of credits or encounters an error.
        Guarantees 100% voice uptime for English, Telugu, and Hindi conversations.
        Falls back to local synthetic WAV audio if cloud keys are not configured.
        """
        import base64
        start_time = time.perf_counter()
        if not settings.SARVAM_API_KEY:
            offline_wav = generate_offline_audio(duration=0.5)
            return {
                "audio_bytes": offline_wav,
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "sample_rate": 24000,
                "format": "audio/wav",
                "provider": "offline_fallback"
            }

        # Select native speaker according to language or requested speaker
        lang_norm = (language or "en").lower()
        if speaker:
            target_speaker = speaker
        elif "te" in lang_norm:
            target_speaker = "kavitha" # SARA Telugu Crystal (Sweet, Melodic & Gentle)
        elif "hi" in lang_norm:
            target_speaker = "aditya"
        else:
            target_speaker = "simran"

        # Sweet Melodic Pitch & Pacing Tuning
        pitch = 0.0
        if target_speaker == "kavitha":
            pitch = 0.06 # Melodic, sweet, gentle feminine pitch
            pace = 0.98  # Relaxed, warm, natural cadence
            target_lang = "te-IN"
        elif target_speaker == "kavya":
            pitch = 0.05
            pace = 0.96
            target_lang = "te-IN"
        elif "te" in lang_norm:
            pitch = 0.05
            pace = 0.98
            target_lang = "te-IN"
        elif "hi" in lang_norm:
            target_lang = "hi-IN"
            pace = 1.0
        else:
            target_lang = "en-IN"
            pace = 1.0

        # Phonetically polish text for natural, sweet pronunciation
        synth_text = self._normalize_telugu_speech_text(text) if ("te" in lang_norm or bool(re.search(r'[\u0C00-\u0C7F]', text))) else text

        headers = {
            "api-subscription-key": settings.SARVAM_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "inputs": [synth_text],
            "target_language_code": target_lang,
            "speaker": target_speaker,
            "pitch": pitch,
            "pace": pace,
            "enable_preprocessing": True,
            "model": "bulbul:v3"
        }

        try:
            client = await self._get_client()
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
                        "provider": "sarvam_native"
                    }
            logger.warning(f"Sarvam TTS fallback error {r.status_code}: {r.text[:120]}")
        except Exception as e:
            logger.warning(f"Sarvam TTS fallback exception: {e}")

        # High-fidelity Edge Neural fallback
        if not hasattr(self, '_edge_tts'):
            self._edge_tts = EdgeTTSProvider()
        return await self._edge_tts.synthesize_speech(text, voice_id=speaker, language=target_lang)

    @staticmethod
    def _normalize_telugu_speech_text(text: str) -> str:
        """
        Phonetically polish Telugu text so neural TTS produces sweet, seamless pronunciation
        without stumbling over English currency symbols, acronyms, or numbers.
        """
        import re
        if not text:
            return ""

        t = text
        # Remove currency symbol, preserving English numbers
        t = re.sub(r'₹\s*', '', t)
        t = re.sub(r'Rs\.?\s*', '', flags=re.IGNORECASE, string=t)

        # Ensure all prices, numbers, and BHK are in crisp English
        from server.engine.normalizer import normalize_numbers_to_english
        t = normalize_numbers_to_english(t)

        # Common terms in voice agent prompts
        t = re.sub(r'\bABC Properties\b', 'ఏబీసీ ప్రాపర్టీస్', t, flags=re.IGNORECASE)
        t = re.sub(r'\bSARA\b', 'సారా', t, flags=re.IGNORECASE)
        t = re.sub(r'\bGachibowli\b', 'గచ్చిబౌలి', t, flags=re.IGNORECASE)
        t = re.sub(r'\bKondapur\b', 'కొండాపూర్', t, flags=re.IGNORECASE)
        t = re.sub(r'\bKokapet\b', 'కోకాపేట్', t, flags=re.IGNORECASE)
        t = re.sub(r'\bHyderabad\b', 'హైదరాబాద్', t, flags=re.IGNORECASE)
        t = re.sub(r'\bSite visit\b', 'సైట్ విజిట్', t, flags=re.IGNORECASE)
        t = re.sub(r'\bFlats\b', 'ఫ్లాట్స్', t, flags=re.IGNORECASE)
        t = re.sub(r'\bVillas\b', 'విల్లాస్', t, flags=re.IGNORECASE)
        t = re.sub(r'\bPlots\b', 'ప్లాట్స్', t, flags=re.IGNORECASE)

        # Remove markdown markers like asterisks, brackets, bullets
        t = re.sub(r'[*_#`~]', '', t)
        t = re.sub(r'\s+', ' ', t).strip()
        return t


    async def synthesize_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: Optional[str] = "en"
    ) -> Dict[str, Any]:
        """
        Synthesize text into WAV audio bytes using Cartesia sonic-preview or Sarvam AI.
        Measures exact time to first audio bytes (TTFA).
        """
        import re
        start_time = time.perf_counter()
        target_voice = voice_id or settings.DEFAULT_VOICE_ID or "330c4fa0-1da3-4c55-8e97-951bfd724e20"

        # Check if text contains alphanumeric or Indic characters
        if not text or not any(c.isalnum() or ('\u0C00' <= c <= '\u0C7F') or ('\u0900' <= c <= '\u097F') for c in text):
            return {
                "audio_bytes": b"",
                "latency_ms": 0.0
            }

        # Check if text is Telugu or a Telugu voice is selected
        text_lower = text.lower()
        telugu_roman_markers = [
            "namaskaram", "andi", "kavali", "cheppandi", "cheyyandi", "entha", "ekkada",
            "dabbulu", "unnara", "unnam", "undi", "unnayi", "swagatam", "dhanyavadalu",
            "meeku", "nenu", "chudandi", "chepandi", "telugu"
        ]
        has_roman_telugu = any(marker in text_lower for marker in telugu_roman_markers)
        is_telugu = (
            (language and "te" in language.lower()) or
            ("te" in target_voice.lower() or target_voice in ["3a8e6fea-81e5-4d4d-8755-86093146cdb8", "330c4fa0-1da3-4c55-8e97-951bfd724e20", "07bc462a-c644-49f1-baf7-82d5599131be"]) or
            bool(re.search(r'[\u0C00-\u0C7F]', text)) or
            has_roman_telugu
        )

        is_sarvam = target_voice.lower().startswith("sarvam-") or "kavitha" in target_voice.lower() or "kavya" in target_voice.lower() or "pooja" in target_voice.lower()
        
        # Dynamic API key check in case user updated server/.env
        current_cartesia_key = settings.CARTESIA_API_KEY or self.api_key
        if current_cartesia_key != getattr(self, '_last_known_cartesia_key', None):
            self._last_known_cartesia_key = current_cartesia_key
            self.api_key = current_cartesia_key
            CartesiaTTS._cartesia_exhausted = False

        # When user requests Cartesia voices (Sarika 330c4fa0..., Vidya 3a8e6fea..., etc.), use Cartesia sonic-preview
        if not is_sarvam and self.api_key and not CartesiaTTS._cartesia_exhausted:
            synth_model = "sonic-preview" if (is_telugu or (language and "te" in language.lower())) else "sonic-2"

            synth_lang = "te" if (is_telugu or (language and "te" in language.lower())) else (language or "en")
            
            cartesia_voice_id = target_voice
            if cartesia_voice_id == "07bc462a-c644-49f1-baf7-82d5599131be":
                cartesia_voice_id = "330c4fa0-1da3-4c55-8e97-951bfd724e20"

            # Phonetically normalize Telugu text for sweet natural enunciation
            synth_text = self._normalize_telugu_speech_text(text) if is_telugu else text

            headers = {
                "X-API-Key": self.api_key,
                "Cartesia-Version": "2024-06-10",
                "Content-Type": "application/json"
            }
            voice_config = {
                "mode": "id",
                "id": cartesia_voice_id
            }
            # Inject sweet, gentle, melodic emotional timbre and natural pacing for Telugu
            if is_telugu:
                voice_config["__experimental_controls"] = {
                    "speed": -0.06,  # Relaxed natural cadence allowing soft Telugu vowel elongation
                    "emotion": ["positivity:highest"]  # Infuses warm, sweet, welcoming vocal timbre
                }

            payload = {
                "model_id": synth_model,
                "transcript": synth_text,
                "voice": voice_config,
                "output_format": {
                    "container": "wav",
                    "encoding": "pcm_s16le",
                    "sample_rate": 24000
                },
                "language": synth_lang
            }
            try:
                client = await self._get_client()
                response = await client.post(self.endpoint, headers=headers, json=payload)
                elapsed_ms = (time.perf_counter() - start_time) * 1000

                if response.status_code == 200:
                    raw_bytes = bytearray(response.content)
                    data_idx = raw_bytes.find(b'data')
                    if data_idx != -1 and len(raw_bytes) > data_idx + 8:
                        import struct
                        struct.pack_into('<I', raw_bytes, 4, len(raw_bytes) - 8)
                        struct.pack_into('<I', raw_bytes, data_idx + 4, len(raw_bytes) - (data_idx + 8))

                    CartesiaTTS._cartesia_exhausted = False
                    return {
                        "audio_bytes": bytes(raw_bytes),
                        "latency_ms": round(elapsed_ms, 2),
                        "sample_rate": 24000,
                        "format": "audio/wav",
                        "provider": f"cartesia_{synth_model}"
                    }
                else:
                    if response.status_code in [401, 402]:
                        CartesiaTTS._cartesia_exhausted = True
                        CartesiaTTS._last_exhausted_check = time.time()
                    logger.warning(f"Cartesia TTS HTTP {response.status_code}: {response.text[:120]}. Fast Sarvam fallback engaged.")

            except Exception as e:
                logger.warning(f"Error connecting to Cartesia: {e}. Fast Sarvam fallback engaged.")

        # Fallback to Sarvam AI native Indic synthesis: Map Sarika to sweet Kavitha voice
        speaker = "kavitha" if is_telugu else "simran"
        if "kavitha" in target_voice.lower() or "330c4fa0" in target_voice.lower() or "sarika" in target_voice.lower():
            speaker = "kavitha"
        elif "kavya" in target_voice.lower():
            speaker = "kavya"
        elif "shruti" in target_voice.lower():
            speaker = "shruti"
        elif "pooja" in target_voice.lower() or "vidya" in target_voice.lower() or "3a8e6fea" in target_voice.lower():
            speaker = "pooja"
        elif "amartya" in target_voice.lower() or "male" in target_voice.lower() or "daniel" in target_voice.lower() or "archie" in target_voice.lower():
            speaker = "aditya"
        return await self._synthesize_sarvam_fallback(text, language="te" if is_telugu else (language or "en"), speaker=speaker)

    def list_voices(self, gender: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List available voices. Pure sweet native Telugu voices are prioritized at the top.
        """
        voices = POPULAR_VOICES
        if gender:
            return [v for v in voices if v.get("gender", "").lower() == gender.lower()]
        return voices
