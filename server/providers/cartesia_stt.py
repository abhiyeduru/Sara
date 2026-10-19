import time
import io
import wave
import logging
from typing import Dict, Any, Optional
from server.config import settings
from server.providers.base import STTProvider
from server.services.voice.audio_codec_service import AudioCodecService

logger = logging.getLogger("sara.providers.cartesia_stt")

class CartesiaSTT(STTProvider):
    """
    Cartesia Ink Whisper Speech-to-Text Provider.
    Supports low-latency Indic (Telugu, Hindi, English) transcription.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, "CARTESIA_API_KEY", None) or "sk_car_Ewjfxb7rjsahKuRAsX3tqq"
        self.model = "ink-whisper"
        self._client = None

    def _get_client(self):
        if self._client is None:
            from cartesia import AsyncCartesia
            self._client = AsyncCartesia(api_key=self.api_key)
        return self._client

    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio using Cartesia Ink-Whisper model.
        """
        start_time = time.perf_counter()

        if not self.api_key:
            return {
                "transcript": "",
                "detected_language": "te",
                "confidence": 0.0,
                "latency_ms": 0.0,
                "error": "CARTESIA_API_KEY not configured"
            }

        # Normalize language hint
        lang = "te"
        if language_hint:
            h = language_hint.lower()
            if "te" in h or "telugu" in h:
                lang = "te"
            elif "hi" in h or "hindi" in h:
                lang = "hi"
            elif "en" in h or "english" in h:
                lang = "en"

        # Ensure valid audio container (WAV)
        wav_payload = audio_bytes
        if not wav_payload.startswith(b"RIFF"):
            if len(wav_payload) > 0:
                try:
                    wav_payload = AudioCodecService.pcm_to_wav(audio_bytes, sample_rate=16000)
                except Exception:
                    # Try creating standard 16kHz 16-bit mono WAV container
                    buf = io.BytesIO()
                    with wave.open(buf, 'wb') as wav:
                        wav.setnchannels(1)
                        wav.setsampwidth(2)
                        wav.setframerate(16000)
                        wav.writeframes(audio_bytes)
                    wav_payload = buf.getvalue()

        try:
            from server.services.voice.cartesia_stt_service import is_whisper_hallucination

            client = self._get_client()
            response = await client.stt.transcribe(
                file=("input.wav", wav_payload, "audio/wav"),
                model=self.model,
                language=lang
            )

            elapsed_ms = (time.perf_counter() - start_time) * 1000
            transcript_text = getattr(response, "text", "") or ""
            transcript_text = transcript_text.strip()
            detected_lang = getattr(response, "language", lang) or lang

            if transcript_text and is_whisper_hallucination(transcript_text):
                logger.warning(f"Cartesia STT returned Whisper hallucination: '{transcript_text[:40]}...' — falling back to Sarvam STT")
                try:
                    from server.providers.sarvam_stt import SarvamSTT
                    sarvam = SarvamSTT()
                    return await sarvam.transcribe(wav_payload, language_hint=lang)
                except Exception as ex:
                    logger.warning(f"Sarvam STT fallback error: {ex}")
                    transcript_text = ""

            logger.info(f"Cartesia STT transcribed in {elapsed_ms:.1f}ms: '{transcript_text}'")

            return {
                "transcript": transcript_text,
                "detected_language": detected_lang,
                "confidence": 0.95 if transcript_text else 0.0,
                "latency_ms": round(elapsed_ms, 2)
            }
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"Cartesia STT error: {e}", exc_info=True)
            # Try Sarvam fallback on Cartesia error
            try:
                from server.providers.sarvam_stt import SarvamSTT
                sarvam = SarvamSTT()
                return await sarvam.transcribe(wav_payload, language_hint=lang)
            except Exception:
                pass
            return {
                "transcript": "",
                "detected_language": lang,
                "confidence": 0.0,
                "latency_ms": round(elapsed_ms, 2),
                "error": str(e)
            }
