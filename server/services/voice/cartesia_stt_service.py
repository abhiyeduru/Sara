"""
SARA AI — Cartesia Streaming Speech-to-Text Service (Ink)
Provides ultra-low latency real-time streaming transcription via Cartesia Ink STT WebSockets.
Features:
- Native 8kHz G.711 μ-law direct audio streaming (zero codec overhead with Plivo telephony)
- Multilingual and native Indic (Telugu, Hindi, Indian English) transcription
- Audio energy VAD for instant caller barge-in detection
- Conversational turn finalization via Cartesia 'finalize' command
"""
import asyncio
import json
import logging
import math
import ssl
import sys
import time
from pathlib import Path
from typing import Optional, Callable, Dict, Any

_root_dir = str(Path(__file__).resolve().parent.parent.parent.parent)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

import certifi
import websockets
from server.config import settings

logger = logging.getLogger("sara.voice.cartesia_stt")

# Precompute ITU-T G.711 μ-law magnitude lookup table (maps each 0-255 byte to 16-bit PCM magnitude)
# Silence (0xFF and 0x7F) -> 0; Peaks (0x00 and 0x80) -> 32124
MULAW_MAGNITUDE_LUT = [0] * 256
for b in range(256):
    inv = ~b & 0xFF
    exponent = (inv >> 4) & 0x07
    mantissa = inv & 0x0F
    magnitude = ((mantissa << 3) + 0x84) << exponent
    magnitude -= 0x84
    MULAW_MAGNITUDE_LUT[b] = max(0, magnitude)


def is_whisper_hallucination(text: str) -> bool:
    """
    Detect autoregressive Whisper looping hallucinations:
    e.g. 'పగాగగగగగగ...', 'మాదాదాదాదా...', 'కూసల్టేస్ల్టేస్ల్టేస్...', 'thank you thank you thank you'
    """
    if not text or not text.strip():
        return True
    t = text.strip()
    import re
    # Consecutive repetition of 1 to 8 characters repeated 3+ times
    pattern = r'(\S{1,8})\1{2,}'
    match = re.search(pattern, t)
    if match:
        repeated_part = match.group(0)
        if len(repeated_part) >= 6 or len(repeated_part) / max(len(t), 1) > 0.35:
            return True
    # Low character diversity check (long string with very few distinct characters)
    non_space = t.replace(' ', '')
    if len(non_space) >= 8 and len(set(non_space)) <= 3:
        return True
    words = t.lower().split()
    if len(words) >= 4:
        for i in range(len(words) - 3):
            if words[i] == words[i+1] == words[i+2] == words[i+3]:
                return True
    if len(words) >= 6:
        bigrams = [f'{words[i]} {words[i+1]}' for i in range(0, len(words)-1, 2)]
        for i in range(len(bigrams) - 2):
            if bigrams[i] == bigrams[i+1] == bigrams[i+2]:
                return True
    return False


class CartesiaStreamingSTTService:
    """
    Real-time streaming STT client connecting to Cartesia WebSocket API:
    wss://api.cartesia.ai/stt/websocket
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        sample_rate: int = 8000,
        encoding: str = "pcm_mulaw",  # 'pcm_mulaw' for Plivo / telephony, 'pcm_s16le' for browser PCM
        language: str = "te",
        model: str = "ink-whisper",
        on_transcript: Optional[Callable[..., Any]] = None,
        on_speech_started: Optional[Callable[[], Any]] = None,
        on_utterance_end: Optional[Callable[[], Any]] = None,
        on_error: Optional[Callable[[str], Any]] = None,
    ):
        self.api_key = (
            api_key
            or getattr(settings, "CARTESIA_API_KEY", None)
            or "sk_car_Ewjfxb7rjsahKuRAsX3tqq"
        )
        self.sample_rate = sample_rate
        # Normalize encoding name for Cartesia
        if encoding in ("mulaw", "pcm_mulaw"):
            self.encoding = "pcm_mulaw"
        elif encoding in ("linear16", "pcm_s16le", "pcm"):
            self.encoding = "pcm_s16le"
        else:
            self.encoding = encoding

        self.language = (language or "te").lower()
        self.model = model or getattr(settings, "CARTESIA_STT_MODEL", "ink-whisper") or "ink-whisper"

        # Callbacks
        self.on_transcript = on_transcript
        self.on_speech_started = on_speech_started
        self.on_utterance_end = on_utterance_end
        self.on_error = on_error

        # WebSocket State
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._is_connected = False
        self._receive_task: Optional[asyncio.Task] = None
        self._send_task: Optional[asyncio.Task] = None
        self._audio_queue: asyncio.Queue = asyncio.Queue(maxsize=300)

        # Voice Activity & Turn Tracking (Accurate ITU-T G.711 μ-law RMS)
        self.is_user_speaking = False
        self.last_speech_time = 0.0
        self.silence_threshold_seconds = 0.50  # Finalize after 500ms of caller pause
        self.speech_energy_threshold = 380.0   # RMS threshold for actual caller voice
        self.silence_energy_threshold = 240.0  # RMS threshold under which audio is considered silence
        self._finalize_scheduled = False
        self._last_finalized_text = ""
        self._last_received_text = ""
        self._last_received_text_time = 0.0

    @property
    def is_connected(self) -> bool:
        return self._is_connected and self.ws is not None

    def _resolve_lang_code(self) -> str:
        lang = (self.language or "te").lower()
        if lang in ["te", "telugu"]:
            return "te"
        elif lang in ["hi", "hindi"]:
            return "hi"
        elif lang in ["en", "english"]:
            return "en"
        return "te"

    def _calculate_mulaw_rms(self, mulaw_chunk: bytes) -> float:
        """Calculate fast, exact RMS energy of G.711 μ-law bytes using precomputed LUT."""
        if not mulaw_chunk:
            return 0.0
        sum_sq = sum(MULAW_MAGNITUDE_LUT[b] * MULAW_MAGNITUDE_LUT[b] for b in mulaw_chunk)
        return math.sqrt(sum_sq / len(mulaw_chunk))

    async def connect(self) -> bool:
        """Establish WebSocket connection to Cartesia Ink STT."""
        if not self.api_key:
            logger.error("Cartesia STT: API key is not configured.")
            return False

        lang_code = self._resolve_lang_code()
        url = (
            f"wss://api.cartesia.ai/stt/websocket"
            f"?model={self.model}"
            f"&encoding={self.encoding}"
            f"&sample_rate={self.sample_rate}"
            f"&language={lang_code}"
            f"&cartesia_version=2026-03-01"
            f"&api_key={self.api_key}"
        )

        ssl_ctx = ssl.create_default_context(cafile=certifi.where())

        try:
            self.ws = await websockets.connect(
                url,
                ssl=ssl_ctx,
                ping_interval=15,
                ping_timeout=10,
                close_timeout=5,
            )
            self._is_connected = True
            logger.info(
                f"🎙️ Connected to Cartesia STT (model={self.model}, lang={lang_code}, enc={self.encoding})"
            )

            # Start background pump and receive loops
            self._receive_task = asyncio.create_task(self._receive_loop())
            self._send_task = asyncio.create_task(self._send_loop())
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Cartesia STT: {e}")
            if self.on_error:
                res = self.on_error(str(e))
                if asyncio.iscoroutine(res):
                    await res
            return False

    async def send_audio(self, audio_chunk: bytes) -> None:
        """Enqueue audio chunk for streaming to Cartesia STT and inspect VAD energy."""
        if not self._is_connected or not audio_chunk:
            return

        # VAD Energy check
        energy = self._calculate_mulaw_rms(audio_chunk) if self.encoding == "pcm_mulaw" else 500.0
        now = time.time()

        if energy >= self.speech_energy_threshold:
            self.last_speech_time = now
            if not self.is_user_speaking:
                self.is_user_speaking = True
                logger.debug(f"🎙️ [Cartesia STT] User speech start detected (energy={energy:.1f})")
                if self.on_speech_started:
                    try:
                        res = self.on_speech_started()
                        if asyncio.iscoroutine(res):
                            asyncio.create_task(res)
                    except Exception as e:
                        logger.warning(f"Error in on_speech_started: {e}")

        elif self.is_user_speaking and energy < self.silence_energy_threshold:
            if (now - self.last_speech_time > self.silence_threshold_seconds):
                # Silence detected after speech: trigger finalize
                self.is_user_speaking = False
                asyncio.create_task(self._trigger_finalize())

        # Put audio in transmission queue
        try:
            self._audio_queue.put_nowait(audio_chunk)
        except asyncio.QueueFull:
            try:
                self._audio_queue.get_nowait()
                self._audio_queue.put_nowait(audio_chunk)
            except Exception:
                pass

    async def _trigger_finalize(self) -> None:
        """Send finalize command to Cartesia to flush buffered audio and emit final transcript."""
        if self.ws and self._is_connected:
            try:
                await self.ws.send("finalize")
            except Exception as e:
                logger.debug(f"Cartesia finalize notice: {e}")

    async def _send_loop(self) -> None:
        """Worker task that pushes queued audio chunks to Cartesia STT."""
        while self._is_connected and self.ws:
            try:
                chunk = await self._audio_queue.get()
                if chunk and self.ws:
                    await self.ws.send(chunk)
                self._audio_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Cartesia STT send error: {e}")
                break

    async def _receive_loop(self) -> None:
        """Worker task that receives transcription events from Cartesia STT."""
        try:
            async for raw_message in self.ws:
                try:
                    data = json.loads(raw_message)
                except Exception:
                    continue

                msg_type = data.get("type", "")

                if msg_type == "transcript":
                    text = data.get("text", "").strip()
                    is_final = data.get("is_final", False)

                    if text:
                        # Guard against Whisper autoregressive repetition hallucinations
                        if is_whisper_hallucination(text):
                            logger.warning(f"🎙️ [Cartesia STT] Filtered Whisper repetition hallucination: '{text[:40]}...'")
                            continue

                        now_t = time.time()
                        if text == self._last_received_text and (now_t - self._last_received_text_time < 0.8):
                            continue
                        self._last_received_text = text
                        self._last_received_text_time = now_t

                        logger.info(f"🎙️ [Cartesia STT Transcript] text='{text}' (final={is_final})")
                        if self.on_transcript:
                            try:
                                import inspect
                                sig = inspect.signature(self.on_transcript)
                                if len(sig.parameters) >= 2:
                                    res = self.on_transcript(text, is_final)
                                else:
                                    res = self.on_transcript(text)
                                if asyncio.iscoroutine(res):
                                    await res
                            except Exception as e:
                                logger.error(f"Error in on_transcript callback: {e}")

                        if is_final:
                            if self.on_utterance_end:
                                try:
                                    res = self.on_utterance_end()
                                    if asyncio.iscoroutine(res):
                                        await res
                                except Exception as e:
                                    logger.error(f"Error in on_utterance_end callback: {e}")

                elif msg_type == "turn.start":
                    if self.on_speech_started:
                        try:
                            res = self.on_speech_started()
                            if asyncio.iscoroutine(res):
                                await res
                        except Exception:
                            pass

                elif msg_type in ("turn.end", "flush_done"):
                    if self.on_utterance_end:
                        try:
                            res = self.on_utterance_end()
                            if asyncio.iscoroutine(res):
                                await res
                        except Exception:
                            pass

                elif msg_type == "error":
                    err_msg = data.get("message", "Unknown Cartesia error")
                    logger.warning(f"Cartesia STT message error: {err_msg}")
                    if self.on_error:
                        res = self.on_error(err_msg)
                        if asyncio.iscoroutine(res):
                            await res

        except asyncio.CancelledError:
            pass
        except websockets.exceptions.ConnectionClosed as e:
            logger.info(f"Cartesia STT connection closed: code={e.code}, reason={e.reason}")
        except Exception as e:
            logger.error(f"Cartesia STT receive error: {e}", exc_info=True)
            if self.on_error:
                res = self.on_error(str(e))
                if asyncio.iscoroutine(res):
                    await res
        finally:
            self._is_connected = False

    async def close(self) -> None:
        """Cleanly close connection and cancel background tasks."""
        self._is_connected = False
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
        if self._send_task and not self._send_task.done():
            self._send_task.cancel()

        if self.ws:
            try:
                await self.ws.send("close")
                await self.ws.close()
            except Exception:
                pass
            self.ws = None
        logger.info("Cartesia STT service closed.")
