"""
SARA AI — Sarvam AI Text-to-Speech Provider (bulbul:v3)
Provides natural, human-like Indian language speech synthesis in Telugu, Hindi, English, etc.
"""
import time
import base64
import logging
import httpx
from typing import Dict, Any, Optional, List
from server.config import settings
from server.providers.base import TTSProvider

logger = logging.getLogger("sara.providers.sarvam_tts")

SARVAM_VOICES = [
    {
        "id": "sarvam-te-pooja",
        "speaker": "pooja",
        "name": "Pooja (Telugu Warm & Sweet)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "female",
        "provider": "sarvam",
        "style": "Sweet & Respectful",
        "description": "Authentic sweet native Telugu voice with natural respect, silky cadence, and smooth conversational flow.",
        "sample_text": "నమస్కారం అండీ! నేను సారా. మా దగ్గర గచ్చిబౌలి మరియు కొండాపూర్‌లో బెస్ట్ 2 BHK ఫ్లాట్స్ అందుబాటులో ఉన్నాయి."
    },
    {
        "id": "sarvam-te-roopa",
        "speaker": "roopa",
        "name": "Roopa (Telugu Sweet & Soothing)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "female",
        "provider": "sarvam",
        "style": "Sweet & Melodious",
        "description": "Gentle, soothing and sweet Telugu voice with melodious tone, perfect for premium customer experience.",
        "sample_text": "హలో అండీ! మీ కలల ఇంటిని ఎంచుకోవడంలో మీకు సహాయం చేయడానికి నేను ఎల్లప్పుడూ సిద్ధంగా ఉన్నాను."
    },
    {
        "id": "sarvam-te-priya",
        "speaker": "priya",
        "name": "Priya (Telugu Cheerful & Sweet)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "female",
        "provider": "sarvam",
        "style": "Bright & Cheerful",
        "description": "Bright, sweet and enthusiastic native Telugu voice that builds instant rapport with callers.",
        "sample_text": "ఖచ్చితంగా అండీ! ఈ ఆదివారం మీకు సైట్ విజిట్ సమయం ఎప్పుడు వీలవుతుందో చెప్తారా?"
    },
    {
        "id": "sarvam-te-kavitha",
        "speaker": "kavitha",
        "name": "Kavitha (Telugu Gentle & Polite)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "female",
        "provider": "sarvam",
        "style": "Soft & Polite",
        "description": "Sweet, polite, gentle native Telugu voice with pristine articulation and respectful cadence.",
        "sample_text": "నమస్కారం అండీ! ఏబీసీ ప్రాపర్టీస్‌కి స్వాగతం, మీకు ఏ విధంగా సహాయపడగలను?"
    },
    {
        "id": "sarvam-te-shruti",
        "speaker": "shruti",
        "name": "Shruti (Telugu Articulate & Crisp)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "female",
        "provider": "sarvam",
        "style": "Articulate & Sweet",
        "description": "Crisp, articulate and sweet professional Telugu voice for consultative advisory and luxury real estate.",
        "sample_text": "ఈ ప్రాజెక్ట్‌లో హెచ్‌ఎండీఏ అప్రూవ్డ్ గేటెడ్ కమ్యూనిటీ విల్లాలు క్లబ్‌హౌస్ సౌకర్యాలతో అందుబాటులో ఉన్నాయి."
    },
    {
        "id": "sarvam-te-kavya",
        "speaker": "kavya",
        "name": "Kavya (Telugu Friendly & Approachable)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "female",
        "provider": "sarvam",
        "style": "Friendly & Warm",
        "description": "Warm, cheerful, approachable native Telugu voice ideal for lead qualification and follow-ups.",
        "sample_text": "మీరు చూస్తున్న బడ్జెట్ రేంజ్ ఎంత ఉండొచ్చో చెప్తారా అండీ? దానికి తగిన బెస్ట్ ఆప్షన్స్ చూపిస్తాను."
    },
    {
        "id": "sarvam-te-neha",
        "speaker": "neha",
        "name": "Neha (Telugu Sweet & Empathetic)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "female",
        "provider": "sarvam",
        "style": "Empathetic & Sweet",
        "description": "Sweet, caring and empathetic tone with crystal clear Telugu diction for customer support.",
        "sample_text": "మీ విచారణకు ధన్యవాదాలు అండీ, ప్రాజెక్ట్ బ్రోచర్ మీ వాట్సాప్‌కి వెంటనే పంపిస్తాను."
    },
    {
        "id": "sarvam-te-simran",
        "speaker": "simran",
        "name": "Simran (Telugu & Indian English Sweet)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "female",
        "provider": "sarvam",
        "style": "Modern Conversational",
        "description": "Natural, confident, sweet bilingual voice that seamlessly switches between Telugu and Indian English.",
        "sample_text": "హలో అండీ! Kokapet లో మా new luxury project launch అవుతోంది, details కావాలా?"
    },
    {
        "id": "sarvam-te-shreya",
        "speaker": "shreya",
        "name": "Shreya (Telugu Soft Executive)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "female",
        "provider": "sarvam",
        "style": "Soft Executive",
        "description": "Elegant, gentle executive cadence with pristine pronunciation for commercial and HNI properties.",
        "sample_text": "మీరు ఇన్వెస్ట్‌మెంట్ కోసం చూస్తున్నారా లేక నివాసం కోసమా అండీ? మా వద్ద హై-రిటర్న్ ప్రాపర్టీస్ ఉన్నాయి."
    },
    {
        "id": "sarvam-te-vijay",
        "speaker": "vijay",
        "name": "Vijay (Telugu Friendly Male)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "male",
        "provider": "sarvam",
        "style": "Friendly & Warm",
        "description": "Warm, polite, respectful native Telugu male voice with natural cadence.",
        "sample_text": "నమస్కారం అండీ, నేను విజయ్. మా రియల్ ఎస్టేట్ ఆఫీస్ నుండి మాట్లాడుతున్నాను."
    },
    {
        "id": "sarvam-te-rahul",
        "speaker": "rahul",
        "name": "Rahul (Telugu Young Professional)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "male",
        "provider": "sarvam",
        "style": "Energetic & Crisp",
        "description": "Crisp, dynamic young professional Telugu male voice with great clarity.",
        "sample_text": "హలో అండీ! మీరు వెబ్‌సైట్‌లో ఎంక్వైరీ చేసారు కదా, సైట్ విజిట్ ఎప్పుడు ప్లాన్ చేద్దాం?"
    },
    {
        "id": "sarvam-te-aditya",
        "speaker": "aditya",
        "name": "Aditya (Telugu Confident Male)",
        "language": "te",
        "language_name": "Telugu (తెలుగు)",
        "gender": "male",
        "provider": "sarvam",
        "style": "Deep & Confident",
        "description": "Confident, trustworthy, deep male tone with natural Indian and Telugu cadence.",
        "sample_text": "నమస్కారం! నేను సారా నుండి మాట్లాడుతున్నాను. మీ ప్రాపర్టీ అవసరాలను తెలుసుకోవచ్చా?"
    }
]

class SarvamTTS(TTSProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.SARVAM_API_KEY
        self.endpoint = "https://api.sarvam.ai/text-to-speech"
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=15.0)
        return self._http_client

    def list_voices(self) -> List[Dict[str, Any]]:
        return SARVAM_VOICES

    async def synthesize_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: Optional[str] = None,
        pitch: float = 0.0,
        pace: float = 1.0,
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()
        if not self.api_key:
            return {"error": "SARVAM_API_KEY not configured"}

        # Resolve speaker from voice_id
        speaker = "kavitha"
        if voice_id:
            for v in SARVAM_VOICES:
                if v["id"] == voice_id:
                    speaker = v["speaker"]
                    if not language:
                        language = v["language"]
                    break
            if voice_id.startswith("sarvam-"):
                parts = voice_id.split("-")
                if len(parts) >= 3:
                    speaker = parts[2]

        # Determine target language code
        lang_code = "te-IN"
        if language == "hi" or any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in text):
            lang_code = "hi-IN"
        elif language == "en":
            lang_code = "en-IN"
        elif language == "te" or any(ord(c) >= 0x0C00 and ord(c) <= 0x0C7F for c in text):
            lang_code = "te-IN"

        # Natural human studio acoustics (zero artificial distortion)
        if pitch is None:
            pitch = 0.0
        if pace is None:
            pace = 1.0

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "inputs": [text],
            "target_language_code": lang_code,
            "speaker": speaker,
            "pitch": pitch,
            "pace": pace,
            "enable_preprocessing": True,
            "model": "bulbul:v3"
        }

        try:
            client = await self._get_client()
            r = await client.post(self.endpoint, headers=headers, json=payload)
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
                        "provider": "sarvam_ai",
                        "speaker": speaker,
                        "language": lang_code
                    }
            logger.error(f"Sarvam TTS Error {r.status_code}: {r.text}")
            return {"error": f"Sarvam error {r.status_code}: {r.text}"}
        except Exception as e:
            logger.exception(f"Sarvam TTS Exception: {e}")
            return {"error": str(e)}
