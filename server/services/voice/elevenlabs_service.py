"""
SARA AI — ElevenLabs Realtime Streaming Speech-to-Text Service (Scribe v2 Realtime)
Provides ultra-low latency real-time streaming transcription using ElevenLabs Scribe WebSockets.
Supports Telugu, Hindi, English, code-switching, interim partial results, finalized turns, and speech-started events.
"""
import asyncio
import base64
import json
import logging
import ssl
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Optional, Callable, Dict, Any

_root_dir = str(Path(__file__).resolve().parent.parent.parent.parent)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

import certifi
import websockets
from server.config import settings

logger = logging.getLogger("sara.voice.elevenlabs")


class ElevenLabsSTTService:
    """
    Streaming STT client connecting to ElevenLabs Scribe v2 Realtime WebSocket API.
    Handles continuous telephony (mulaw) or PCM audio streaming,
    interim partial turns, finalized turns, and speech_started events for barge-in.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        sample_rate: int = 8000,
        encoding: str = "mulaw",  # 'mulaw' for Plivo/telephony, 'linear16' for browser PCM
        channels: int = 1,
        language: str = "te",
        on_transcript: Optional[Callable[[str, bool, str, float], Any]] = None,
        on_speech_started: Optional[Callable[[], Any]] = None,
        on_utterance_end: Optional[Callable[[], Any]] = None,
        on_error: Optional[Callable[[str], Any]] = None,
    ):
        self.api_key = api_key or getattr(settings, "ELEVENLABS_API_KEY", None) or "sk_9830223f1341064e578f3d5ca8ce823a77ad9871b5f7c4b0"
        self.sample_rate = sample_rate
        self.raw_encoding = encoding
        self.channels = channels
        self.language = language or "te"

        # ElevenLabs audio format mapping
        if encoding in ["mulaw", "pcm_mulaw"]:
            self.audio_format = "ulaw_8000"
            self._min_chunk_bytes = int(self.sample_rate * 0.10)  # 100ms = 800 bytes
        elif self.sample_rate == 8000:
            self.audio_format = "pcm_8000"
            self._min_chunk_bytes = int(self.sample_rate * 2 * 0.10)
        elif self.sample_rate == 16000:
            self.audio_format = "pcm_16000"
            self._min_chunk_bytes = int(self.sample_rate * 2 * 0.10)
        elif self.sample_rate == 24000:
            self.audio_format = "pcm_24000"
            self._min_chunk_bytes = int(self.sample_rate * 2 * 0.10)
        else:
            self.audio_format = "pcm_16000"
            self._min_chunk_bytes = int(16000 * 2 * 0.10)

        # Callbacks
        self.on_transcript = on_transcript
        self.on_speech_started = on_speech_started
        self.on_utterance_end = on_utterance_end
        self.on_error = on_error

        # State
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.is_connected = False
        self._receive_task: Optional[asyncio.Task] = None
        self._send_queue: asyncio.Queue = asyncio.Queue()
        self._send_task: Optional[asyncio.Task] = None
        self._audio_buffer = bytearray()
        self._turn_start_time = 0.0
        self._uncommitted_bytes = 0

        # SSL Context
        self.ssl_context = ssl.create_default_context(cafile=certifi.where())

    def _build_ws_url(self) -> str:
        base = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
        params = {
            "model_id": "scribe_v2_realtime",
            "audio_format": self.audio_format,
            "commit_strategy": "vad",
            "filter_background_audio": "true",
            "vad_silence_threshold_secs": "0.8",
        }
        lang = (self.language or "te").lower()
        if lang in ["te", "telugu"]:
            params["language_code"] = "te"
        elif lang in ["hi", "hindi"]:
            params["language_code"] = "hi"
        elif lang in ["en", "english"]:
            params["language_code"] = "en"
        return f"{base}?{urllib.parse.urlencode(params)}"

    async def connect(self) -> bool:
        """Establish authenticated WebSocket connection to ElevenLabs Scribe v2 Realtime."""
        if not self.api_key:
            logger.error("ElevenLabs API key not configured")
            if self.on_error:
                self.on_error("ElevenLabs API key not configured")
            return False

        headers = {"xi-api-key": self.api_key}
        url = self._build_ws_url()

        for attempt in range(2):
            try:
                self.ws = await websockets.connect(
                    url,
                    additional_headers=headers,
                    ssl=self.ssl_context,
                    ping_interval=20,
                    ping_timeout=10,
                )
                self.is_connected = True
                logger.info(f"✅ ElevenLabs Realtime STT connected successfully (model=scribe_v2_realtime, format={self.audio_format}, lang={self.language}).")

                # Background workers
                self._receive_task = asyncio.create_task(self._receive_loop())
                self._send_task = asyncio.create_task(self._sender_loop())
                return True
            except Exception as e:
                logger.warning(f"ElevenLabs connect attempt {attempt + 1} failed: {e}")
                if attempt == 0:
                    await asyncio.sleep(0.3)

        logger.error("Failed to connect to ElevenLabs Realtime STT WebSocket after 2 attempts.")
        self.is_connected = False
        if self.on_error:
            self.on_error("ElevenLabs WebSocket connection failed")
        return False

    async def send_audio(self, audio_chunk: bytes) -> None:
        """Buffer and stream raw audio bytes to ElevenLabs."""
        if not self.is_connected or not self.ws:
            return

        self._audio_buffer.extend(audio_chunk)
        while len(self._audio_buffer) >= self._min_chunk_bytes:
            frame = bytes(self._audio_buffer[:self._min_chunk_bytes])
            del self._audio_buffer[:self._min_chunk_bytes]
            await self._send_queue.put(frame)

    async def _sender_loop(self) -> None:
        """Background worker pushing audio frames to ElevenLabs WebSocket."""
        try:
            while self.is_connected and self.ws:
                chunk = await self._send_queue.get()
                b64 = base64.b64encode(chunk).decode("utf-8")
                self._uncommitted_bytes += len(chunk)
                msg = {
                    "message_type": "input_audio_chunk",
                    "audio_base_64": b64
                }
                try:
                    await self.ws.send(json.dumps(msg))
                except Exception as e:
                    logger.debug(f"ElevenLabs audio send notice: {e}")
                    break
        except asyncio.CancelledError:
            pass

    async def _receive_loop(self) -> None:
        """Process real-time transcript events from ElevenLabs."""
        try:
            while self.is_connected and self.ws:
                msg = await self.ws.recv()
                if isinstance(msg, bytes):
                    continue

                data = json.loads(msg)
                msg_type = data.get("message_type")

                if msg_type == "session_started":
                    session_id = data.get("session_id")
                    logger.info(f"ElevenLabs STT session started: id={session_id}")
                    continue

                if msg_type == "partial_transcript":
                    raw_text = data.get("text", "").strip()
                    import re
                    # Strip model artifact prefix e.g. "Bein .", "Being ."
                    text = re.sub(r"^(Bein\s*\.?|Being\s*\.?)\s*", "", raw_text, flags=re.IGNORECASE).strip()
                    if text:
                        if not self._turn_start_time:
                            self._turn_start_time = time.perf_counter()

                        # Only trigger speech-started if substantive words (at least 2 words)
                        words = [w for w in text.split() if len(w) > 1]
                        if len(words) >= 2 and self.on_speech_started:
                            if asyncio.iscoroutinefunction(self.on_speech_started):
                                await self.on_speech_started()
                            else:
                                self.on_speech_started()

                        latency_ms = (
                            round((time.perf_counter() - self._turn_start_time) * 1000, 1)
                            if self._turn_start_time > 0
                            else 120.0
                        )
                        if self.on_transcript:
                            if asyncio.iscoroutinefunction(self.on_transcript):
                                await self.on_transcript(text, False, self.language, latency_ms)
                            else:
                                self.on_transcript(text, False, self.language, latency_ms)

                elif msg_type == "committed_transcript":
                    raw_text = data.get("text", "").strip()
                    import re
                    text = re.sub(r"^(Bein\s*\.?|Being\s*\.?)\s*", "", raw_text, flags=re.IGNORECASE).strip()
                    if text:
                        latency_ms = (
                            round((time.perf_counter() - self._turn_start_time) * 1000, 1)
                            if self._turn_start_time > 0
                            else 120.0
                        )
                        self._turn_start_time = 0.0
                        self._uncommitted_bytes = 0

                        if self.on_transcript:
                            if asyncio.iscoroutinefunction(self.on_transcript):
                                await self.on_transcript(text, True, self.language, latency_ms)
                            else:
                                self.on_transcript(text, True, self.language, latency_ms)

                        if self.on_utterance_end:
                            if asyncio.iscoroutinefunction(self.on_utterance_end):
                                await self.on_utterance_end()
                            else:
                                self.on_utterance_end()

                elif msg_type in ["error", "input_error"]:
                    err_text = data.get("error", "Unknown ElevenLabs STT error")
                    logger.warning(f"ElevenLabs STT streaming notice: {err_text}")
                    if self.on_error:
                        self.on_error(err_text)

        except websockets.exceptions.ConnectionClosed as e:
            logger.info(f"ElevenLabs WebSocket closed: code={e.code}, reason={e.reason}")
        except Exception as e:
            logger.warning(f"ElevenLabs receive loop exception: {e}")
        finally:
            self.is_connected = False

    async def commit_turn(self) -> None:
        """Trigger explicit commit of uncommitted audio if >= 0.3s."""
        if not self.is_connected or not self.ws:
            return
        # 0.3s at 8kHz mulaw is 2400 bytes
        if self._uncommitted_bytes >= 2400:
            try:
                commit_msg = {
                    "message_type": "input_audio_chunk",
                    "audio_base_64": "",
                    "commit": True
                }
                await self.ws.send(json.dumps(commit_msg))
                self._uncommitted_bytes = 0
            except Exception as e:
                logger.debug(f"ElevenLabs commit notice: {e}")

    async def close(self) -> None:
        """Gracefully terminate ElevenLabs WebSocket session."""
        self.is_connected = False
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
        if self._send_task and not self._send_task.done():
            self._send_task.cancel()

        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
            self.ws = None
        logger.info("ElevenLabs STT session closed.")
