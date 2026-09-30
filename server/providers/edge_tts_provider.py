"""
SARA AI — Edge Neural Text-to-Speech Provider
High-fidelity, ultra-low latency, zero-cost neural voice synthesis with authentic
multilingual support for Telugu, Hindi, and Indian English.
"""
import time
import re
import logging
import edge_tts
from typing import Dict, Any, Optional, List
from server.providers.base import TTSProvider

logger = logging.getLogger("sara.providers.edge_tts")

EDGE_VOICES = [
    {
        "id": "edge-te-shruti",
        "voice": "te-IN-ShrutiNeural",
        "name": "Shruti (Telugu Sweet & Natural)",
        "gender": "female",
        "language": "te",
        "style": "Sweet & Conversational"
    },
    {
        "id": "edge-te-mohan",
        "voice": "te-IN-MohanNeural",
        "name": "Mohan (Telugu Confident Male)",
        "gender": "male",
        "language": "te",
        "style": "Confident & Professional"
    },
    {
        "id": "edge-en-neerja",
        "voice": "en-IN-NeerjaExpressiveNeural",
        "name": "Neerja (Indian English Expressive)",
        "gender": "female",
        "language": "en",
        "style": "Expressive & Warm"
    },
    {
        "id": "edge-en-prabhat",
        "voice": "en-IN-PrabhatNeural",
        "name": "Prabhat (Indian English Male)",
        "gender": "male",
        "language": "en",
        "style": "Clear & Trustworthy"
    },
    {
        "id": "edge-hi-swara",
        "voice": "hi-IN-SwaraNeural",
        "name": "Swara (Hindi Polite & Warm)",
        "gender": "female",
        "language": "hi",
        "style": "Warm & Respectful"
    },
    {
        "id": "edge-hi-madhur",
        "voice": "hi-IN-MadhurNeural",
        "name": "Madhur (Hindi Confident Male)",
        "gender": "male",
        "language": "hi",
        "style": "Deep & Reassuring"
    }
]

class EdgeTTSProvider(TTSProvider):
    def __init__(self):
        pass

    def list_voices(self) -> List[Dict[str, Any]]:
        return EDGE_VOICES

    def _resolve_voice(self, voice_id: Optional[str], text: str, language: Optional[str] = None) -> str:
        # Check text script
        is_te = bool(re.search(r'[\u0C00-\u0C7F]', text)) or (language and "te" in language.lower())
        is_hi = bool(re.search(r'[\u0900-\u097F]', text)) or (language and "hi" in language.lower())

        vid = (voice_id or "").lower()
        is_male = any(m in vid for m in ["aditya", "vijay", "rahul", "mohan", "prabhat", "madhur", "male", "daniel", "amartya"])

        if is_te:
            return "te-IN-MohanNeural" if is_male else "te-IN-ShrutiNeural"
        elif is_hi:
            return "hi-IN-MadhurNeural" if is_male else "hi-IN-SwaraNeural"
        else:
            return "en-IN-PrabhatNeural" if is_male else "en-IN-NeerjaExpressiveNeural"

    async def synthesize_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: Optional[str] = None,
        pitch: Optional[str] = None,
        rate: Optional[str] = None,
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()
        if not text or not text.strip():
            return {"audio_bytes": b"", "latency_ms": 0.0}

        clean_text = text.strip()
        target_voice = self._resolve_voice(voice_id, clean_text, language)

        try:
            communicate = edge_tts.Communicate(clean_text, target_voice)
            chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])

            audio_data = b"".join(chunks)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            if audio_data:
                return {
                    "audio_bytes": audio_data,
                    "latency_ms": round(elapsed_ms, 2),
                    "sample_rate": 24000,
                    "format": "audio/mp3",
                    "provider": "edge_neural",
                    "voice": target_voice
                }
            logger.warning(f"EdgeTTS returned 0 audio bytes for voice {target_voice}")
            return {"audio_bytes": b"", "error": "Empty audio output"}
        except Exception as e:
            logger.exception(f"EdgeTTS synthesis exception: {e}")
            return {"audio_bytes": b"", "error": str(e)}
