"""
SARA AI — Sarvam AI Realtime Streaming Speech-to-Text Service
Ultra-low latency streaming transcription via official Sarvam AI Realtime WebSockets:
Endpoint: wss://api.sarvam.ai/speech-to-text-realtime/ws?model=saaras:v3-realtime&language_code={lang}&silence_duration_ms=600
Supports Telugu (te-IN), English (en-IN), Hindi (hi-IN), and code-mixed Indic languages.
Handles real-time VAD events (vad.speech_start, vad.speech_end) and real-time transcripts (transcript.partial, transcript.final).
"""
import asyncio
import base64
import json
import logging
import ssl
import sys
import time
import inspect
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List

_root_dir = str(Path(__file__).resolve().parent.parent.parent.parent)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

import certifi
import websockets
from websockets.exceptions import InvalidStatus, ConnectionClosed
from server.config import settings
from server.services.voice.audio_codec_service import AudioCodecService

logger = logging.getLogger("sara.voice.sarvam_realtime_stt")


class SarvamRealtimeSTTService:
    """
    Streaming STT client connecting to official Sarvam AI Realtime WebSocket API:
    Endpoint: wss://api.sarvam.ai/speech-to-text-realtime/ws
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        sample_rate: int = 8000,
        encoding: str = "mulaw",  # 'mulaw' for Plivo telephony, 'linear16' for browser PCM
        channels: int = 1,
        language: str = "te-IN",
        on_transcript: Optional[Callable[..., Any]] = None,
        on_speech_started: Optional[Callable[[], Any]] = None,
        on_utterance_end: Optional[Callable[[], Any]] = None,
        on_error: Optional[Callable[[str], Any]] = None,
    ):
        self.api_key = (api_key or getattr(settings, "SARVAM_API_KEY", None) or "sk_jn30w4nk_BBKoKdIB5re7Y7khT7suNyUd").strip()
        self.sample_rate = sample_rate
        self.raw_encoding = encoding.lower()
        self.channels = channels
        self.language = language or "te-IN"

        # Callbacks
        self.on_transcript = on_transcript
        self.on_speech_started = on_speech_started
        self.on_utterance_end = on_utterance_end
        self.on_error = on_error

        # WebSocket Connection State
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._is_connected = False
        self._is_closing = False
        self._receive_task: Optional[asyncio.Task] = None
        self._send_task: Optional[asyncio.Task] = None
        self._audio_queue: asyncio.Queue = asyncio.Queue(maxsize=400)

        # Audio Buffering: Aggregate audio into ~100ms chunks (3200 bytes at 16kHz 16-bit PCM)
        self._target_sample_rate = 16000
        self._chunk_size_samples = int(self._target_sample_rate * 0.10)  # 100ms = 1600 samples
        self._chunk_size_bytes = self._chunk_size_samples * 2  # 3200 bytes PCM16
        self._pending_pcm16_buffer = bytearray()

        self._is_in_speech = False
        self.last_transcript_time = time.time()
        self.last_audio_sent_time = time.time()

    @property
    def is_connected(self) -> bool:
        return self._is_connected and self.ws is not None

    def _resolve_lang_code(self) -> str:
        lang = (self.language or "te-IN").lower()
        if "te" in lang:
            return "te-IN"
        if "hi" in lang:
            return "hi-IN"
        if "en" in lang:
            return "en-IN"
        return "te-IN"

    async def connect(self) -> bool:
        """Establish WebSocket connection to Sarvam Realtime STT endpoint."""
        if not self.api_key:
            logger.error("Cannot connect to Sarvam Realtime STT: SARVAM_API_KEY missing.")
            if self.on_error:
                res = self.on_error("SARVAM_API_KEY is missing")
                if asyncio.iscoroutine(res):
                    await res
            return False

        lang_code = self._resolve_lang_code()
        url = (
            f"wss://api.sarvam.ai/speech-to-text-realtime/ws"
            f"?model=saaras:v3-realtime"
            f"&language_code={lang_code}"
            f"&silence_duration_ms=450"
            f"&min_speech_duration_ms=200"
        )
        headers = {
            "api-subscription-key": self.api_key
        }

        ssl_ctx = ssl.create_default_context(cafile=certifi.where())

        try:
            logger.info(f"Connecting to Sarvam Realtime STT: {url}...")
            sig = inspect.signature(websockets.connect)
            header_param = "additional_headers" if "additional_headers" in sig.parameters else "extra_headers"
            kwargs = {header_param: headers, "ssl": ssl_ctx}

            self.ws = await websockets.connect(url, **kwargs)
            self._is_connected = True
            self._is_closing = False

            # Start background receive and send loops
            self._receive_task = asyncio.create_task(self._receive_loop())
            self._send_task = asyncio.create_task(self._send_loop())

            logger.info("✅ Successfully connected to Sarvam AI Realtime Streaming STT WebSocket.")
            return True

        except InvalidStatus as e:
            status_code = getattr(e, "response", None)
            code = getattr(status_code, "status_code", None) or getattr(e, "status_code", None)
            if code in [401, 403]:
                logger.critical(f"❌ Sarvam STT Authentication failed (HTTP {code}). Invalid SARVAM_API_KEY. Will not retry.")
            elif code == 429:
                logger.critical(f"❌ Sarvam STT Quota or rate limit exceeded (HTTP {code}). Will not retry.")
            else:
                logger.error(f"❌ Sarvam STT rejected connection with HTTP {code}: {e}")

            self._is_connected = False
            if self.on_error:
                res = self.on_error(f"Sarvam STT connection rejected: HTTP {code}")
                if asyncio.iscoroutine(res):
                    await res
            return False

        except Exception as e:
            logger.error(f"Failed to connect to Sarvam Realtime STT: {e}", exc_info=True)
            self._is_connected = False
            if self.on_error:
                res = self.on_error(f"Sarvam connection error: {e}")
                if asyncio.iscoroutine(res):
                    await res
            return False

    async def send_audio(self, raw_audio: bytes) -> None:
        """
        Buffer and push incoming audio frames.
        Automatically converts 8kHz mulaw or arbitrary PCM to 16kHz linear16 PCM.
        """
        if not self.is_connected or not raw_audio:
            return

        try:
            # 1. Convert incoming stream to 16kHz linear PCM
            if self.raw_encoding in ["mulaw", "pcm_mulaw"]:
                pcm8 = AudioCodecService.decode_mulaw_to_pcm16(raw_audio)
                pcm16 = AudioCodecService.resample_pcm16(pcm8, 8000, self._target_sample_rate)
            elif self.sample_rate != self._target_sample_rate:
                pcm16 = AudioCodecService.resample_pcm16(raw_audio, self.sample_rate, self._target_sample_rate)
            else:
                pcm16 = raw_audio

            # 2. Append to buffer
            self._pending_pcm16_buffer.extend(pcm16)

            # 3. Drain ready ~100ms chunks (3200 bytes PCM16) into queue
            while len(self._pending_pcm16_buffer) >= self._chunk_size_bytes:
                pcm_chunk = bytes(self._pending_pcm16_buffer[:self._chunk_size_bytes])
                del self._pending_pcm16_buffer[:self._chunk_size_bytes]

                b64_audio = base64.b64encode(pcm_chunk).decode("ascii")

                try:
                    self._audio_queue.put_nowait(b64_audio)
                except asyncio.QueueFull:
                    try:
                        _ = self._audio_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                    self._audio_queue.put_nowait(b64_audio)

        except Exception as e:
            logger.error(f"Error encoding audio chunk for Sarvam STT: {e}")

    async def _send_loop(self) -> None:
        """Send aggregated PCM16 chunks to Sarvam Realtime WebSocket."""
        logger.info("Sarvam Realtime STT send loop running.")
        while self._is_connected and not self._is_closing and self.ws:
            try:
                b64_audio = await self._audio_queue.get()
                payload = {
                    "event": "audio_input",
                    "audio": b64_audio
                }
                await self.ws.send(json.dumps(payload))
                self.last_audio_sent_time = time.time()
                self._audio_queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                if not self._is_closing:
                    logger.warning(f"Error sending audio to Sarvam STT: {e}")
                break

    async def _receive_loop(self) -> None:
        """Receive and parse real-time events from Sarvam Realtime STT."""
        logger.info("Sarvam Realtime STT receive loop running.")
        while self._is_connected and not self._is_closing and self.ws:
            try:
                raw_msg = await self.ws.recv()
                if not raw_msg:
                    continue

                data = json.loads(raw_msg)
                event_name = data.get("event", "")

                # ---------------------------------------------------------
                # 1. Session begin
                # ---------------------------------------------------------
                if event_name == "session.begin":
                    req_id = data.get("request_id")
                    logger.info(f"✅ Sarvam STT session active (request_id={req_id})")

                # ---------------------------------------------------------
                # 2. VAD: Speech Start
                # ---------------------------------------------------------
                elif event_name == "vad.speech_start":
                    self._is_in_speech = True
                    conf = data.get("confidence", 0.95)
                    logger.info(f"🎙️ [Sarvam VAD] vad.speech_start (confidence={conf})")
                    if self.on_speech_started:
                        res = self.on_speech_started()
                        if asyncio.iscoroutine(res):
                            await res

                # ---------------------------------------------------------
                # 3. VAD: Speech End
                # ---------------------------------------------------------
                elif event_name == "vad.speech_end":
                    self._is_in_speech = False
                    conf = data.get("confidence", 0.0)
                    logger.info(f"🎙️ [Sarvam VAD] vad.speech_end (confidence={conf})")
                    if self.on_utterance_end:
                        res = self.on_utterance_end()
                        if asyncio.iscoroutine(res):
                            await res

                # ---------------------------------------------------------
                # 4. Real-time partial / interim transcript
                # ---------------------------------------------------------
                elif event_name == "transcript.partial":
                    text = (data.get("text") or "").strip()
                    if text:
                        self.last_transcript_time = time.time()
                        logger.info(f"🎙️ [Sarvam Partial STT] '{text}'")
                        if self.on_transcript:
                            res = self.on_transcript(
                                text,
                                False,  # is_final = False
                                False,  # speech_final = False
                                self._resolve_lang_code(),
                                0.95
                            )
                            if asyncio.iscoroutine(res):
                                await res

                # ---------------------------------------------------------
                # 5. Final transcript turn
                # ---------------------------------------------------------
                elif event_name == "transcript.final":
                    text = (data.get("text") or "").strip()
                    if text:
                        self.last_transcript_time = time.time()
                        logger.info(f"✅ [Sarvam Final Turn] '{text}'")
                        if self.on_transcript:
                            res = self.on_transcript(
                                text,
                                True,  # is_final = True
                                True,  # speech_final = True
                                self._resolve_lang_code(),
                                0.98
                            )
                            if asyncio.iscoroutine(res):
                                await res

                # ---------------------------------------------------------
                # 6. Error event
                # ---------------------------------------------------------
                elif "error" in data or event_name == "error":
                    err_msg = data.get("error") or data.get("message")
                    logger.error(f"Sarvam STT server error message: {err_msg}")
                    if self.on_error:
                        res = self.on_error(str(err_msg))
                        if asyncio.iscoroutine(res):
                            await res

            except ConnectionClosed as e:
                if not self._is_closing:
                    logger.warning(f"Sarvam STT connection closed by server: code={e.code}, reason={e.reason}")
                break
            except asyncio.CancelledError:
                break
            except Exception as e:
                if not self._is_closing:
                    logger.warning(f"Sarvam STT receive loop exception: {e}")
                break

        self._is_connected = False

    async def close(self) -> None:
        """Close WebSocket connection gracefully."""
        self._is_closing = True
        self._is_connected = False

        if self._send_task and not self._send_task.done():
            self._send_task.cancel()

        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()

        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
            self.ws = None

        logger.info("Sarvam Realtime STT closed.")

    async def disconnect(self) -> None:
        """Alias for close()."""
        await self.close()
