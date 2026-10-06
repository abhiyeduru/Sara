"""
SARA AI — AssemblyAI Streaming Speech-to-Text Service (v3)
Provides ultra-low latency real-time streaming transcription using AssemblyAI Universal-3-6-Pro WebSockets.
Supports code-switching, interim results, finalized turns, and SpeechStarted barge-in events.
"""
import asyncio
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

logger = logging.getLogger("sara.voice.assemblyai")


class AssemblyAISTTService:
    """
    Streaming STT client connecting to AssemblyAI v3 live WebSocket API (universal-3-6-pro).
    Handles continuous telephony (mulaw) or PCM audio streaming with chunk aggregation (50-1000ms),
    interim partial turns, finalized turns, and speech_started events for barge-in.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        sample_rate: int = 8000,
        encoding: str = "mulaw",  # 'mulaw' for Plivo/telephony, 'linear16' for browser PCM
        channels: int = 1,
        language: str = "en",
        on_transcript: Optional[Callable[[str, bool, str, float], Any]] = None,
        on_speech_started: Optional[Callable[[], Any]] = None,
        on_utterance_end: Optional[Callable[[], Any]] = None,
        on_error: Optional[Callable[[str], Any]] = None,
    ):
        self.api_key = api_key or settings.ASSEMBLYAI_API_KEY
        self.sample_rate = sample_rate
        self.raw_encoding = encoding
        self.channels = channels
        self.language = language

        # AssemblyAI encoding translation
        if encoding in ["mulaw", "pcm_mulaw"]:
            self.encoding = "pcm_mulaw"
            # 8kHz mulaw: 1 byte per sample -> 8000 bytes/sec -> 100ms = 800 bytes
            self._min_chunk_bytes = int(self.sample_rate * 0.10)  # 100ms = 800 bytes
        else:
            self.encoding = "pcm_s16le"
            # 16-bit PCM: 2 bytes per sample -> 16000 * 2 = 32000 bytes/sec -> 100ms = 3200 bytes
            self._min_chunk_bytes = int(self.sample_rate * 2 * 0.10)

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
        self._last_speech_time = 0.0
        self._turn_start_time = 0.0

        # SSL Context
        self.ssl_context = ssl.create_default_context(cafile=certifi.where())

    def _build_ws_url(self) -> str:
        base = "wss://streaming.assemblyai.com/v3/ws"
        params = {
            "speech_model": "universal-3-6-pro",
            "encoding": self.encoding,
            "sample_rate": self.sample_rate,
            "format_turns": "true",
        }
        return f"{base}?{urllib.parse.urlencode(params)}"

    async def connect(self) -> bool:
        """Establish authenticated WebSocket connection to AssemblyAI v3."""
        if not self.api_key:
            logger.error("AssemblyAI API key not configured")
            if self.on_error:
                self.on_error("AssemblyAI API key not configured")
            return False

        headers = {"Authorization": self.api_key}
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
                logger.info(f"✅ AssemblyAI Streaming STT connected successfully (model=universal-3-6-pro, encoding={self.encoding}, {self.sample_rate}Hz).")

                # Background tasks
                self._receive_task = asyncio.create_task(self._receive_loop())
                self._send_task = asyncio.create_task(self._sender_loop())
                return True
            except Exception as e:
                logger.warning(f"AssemblyAI connect attempt {attempt + 1} failed: {e}")
                if attempt == 0:
                    await asyncio.sleep(0.3)

        logger.error("Failed to connect to AssemblyAI STT WebSocket after 2 attempts.")
        self.is_connected = False
        if self.on_error:
            self.on_error("AssemblyAI WebSocket connection failed")
        return False

    async def send_audio(self, audio_chunk: bytes) -> None:
        """
        Buffer and stream raw audio bytes to AssemblyAI.
        Ensures chunks meet AssemblyAI's 50ms - 1000ms duration requirement.
        """
        if not self.is_connected or not self.ws:
            return

        self._audio_buffer.extend(audio_chunk)
        while len(self._audio_buffer) >= self._min_chunk_bytes:
            frame = bytes(self._audio_buffer[:self._min_chunk_bytes])
            del self._audio_buffer[:self._min_chunk_bytes]
            await self._send_queue.put(frame)

    async def _sender_loop(self) -> None:
        """Background worker pushing frames to WebSocket."""
        try:
            while self.is_connected and self.ws:
                chunk = await self._send_queue.get()
                try:
                    await self.ws.send(chunk)
                except Exception as e:
                    logger.debug(f"AssemblyAI audio send notice: {e}")
                    break
        except asyncio.CancelledError:
            pass

    async def _receive_loop(self) -> None:
        """Process real-time turn messages and barge-in events from AssemblyAI."""
        try:
            while self.is_connected and self.ws:
                msg = await self.ws.recv()
                if isinstance(msg, bytes):
                    continue

                data = json.loads(msg)
                msg_type = data.get("type")

                if msg_type == "Begin":
                    session_id = data.get("id")
                    logger.info(f"AssemblyAI session established: id={session_id}")
                    continue

                if msg_type == "SpeechStarted":
                    logger.info("🎙️ AssemblyAI SpeechStarted detected -> instant barge-in trigger")
                    if self.on_speech_started:
                        if asyncio.iscoroutinefunction(self.on_speech_started):
                            await self.on_speech_started()
                        else:
                            self.on_speech_started()
                    continue

                if msg_type == "Turn":
                    transcript = data.get("transcript", "").strip()
                    end_of_turn = data.get("end_of_turn", False)

                    # Trigger instant barge-in on substantive partial words
                    if transcript and not end_of_turn:
                        if not self._turn_start_time:
                            self._turn_start_time = time.perf_counter()
                        if self.on_speech_started:
                            if asyncio.iscoroutinefunction(self.on_speech_started):
                                await self.on_speech_started()
                            else:
                                self.on_speech_started()

                    if transcript:
                        latency_ms = (
                            round((time.perf_counter() - self._turn_start_time) * 1000, 1)
                            if self._turn_start_time > 0
                            else 120.0
                        )

                        if self.on_transcript:
                            if asyncio.iscoroutinefunction(self.on_transcript):
                                await self.on_transcript(transcript, end_of_turn, self.language, latency_ms)
                            else:
                                self.on_transcript(transcript, end_of_turn, self.language, latency_ms)

                    if end_of_turn:
                        self._turn_start_time = 0.0
                        if self.on_utterance_end:
                            if asyncio.iscoroutinefunction(self.on_utterance_end):
                                await self.on_utterance_end()
                            else:
                                self.on_utterance_end()

                elif msg_type == "Error":
                    err_text = data.get("error", "Unknown AssemblyAI error")
                    logger.warning(f"AssemblyAI streaming notice: {err_text}")
                    if self.on_error:
                        self.on_error(err_text)

        except websockets.exceptions.ConnectionClosed as e:
            logger.info(f"AssemblyAI WebSocket closed: code={e.code}, reason={e.reason}")
        except Exception as e:
            logger.warning(f"AssemblyAI receive loop exception: {e}")
        finally:
            self.is_connected = False

    async def close(self) -> None:
        """Gracefully terminate AssemblyAI WebSocket session."""
        self.is_connected = False
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
        if self._send_task and not self._send_task.done():
            self._send_task.cancel()

        if self.ws:
            try:
                # Flush remaining buffered audio if >= 50ms
                min_50ms = self._min_chunk_bytes // 2
                if len(self._audio_buffer) >= min_50ms:
                    await self.ws.send(bytes(self._audio_buffer))
                await self.ws.close(1000, "Normal Closure")
            except Exception:
                pass
            self.ws = None
        self._audio_buffer.clear()
        logger.info("AssemblyAI STT service closed.")
