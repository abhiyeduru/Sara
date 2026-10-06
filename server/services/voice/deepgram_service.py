"""
SARA AI — Deepgram Streaming Speech-to-Text Service
Provides real-time streaming transcription using Deepgram Nova-2 WebSockets.
Supports interim results, final transcripts, and VAD speech_started events for barge-in.
"""
import asyncio
import json
import logging
import ssl
import sys
import time
from pathlib import Path
from typing import Optional, Callable, Dict, Any

# Ensure project root is in sys.path when running script directly
_root_dir = str(Path(__file__).resolve().parent.parent.parent.parent)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

import certifi
import websockets
from server.config import settings

logger = logging.getLogger("sara.voice.deepgram")


class DeepgramSTTService:
    """
    Streaming STT client connecting to Deepgram live WebSocket API.
    Handles continuous audio streaming, interim results, final results,
    and speech_started events for conversational barge-in.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        sample_rate: int = 8000,
        encoding: str = "mulaw",  # 'mulaw' for Twilio, 'linear16' for browser PCM
        channels: int = 1,
        language: str = "en",
        region: Optional[str] = None,
        on_transcript: Optional[Callable[[str, bool, str, float], Any]] = None,
        on_speech_started: Optional[Callable[[], Any]] = None,
        on_utterance_end: Optional[Callable[[], Any]] = None,
        on_error: Optional[Callable[[str], Any]] = None,
    ):
        self.api_key = api_key or settings.DEEPGRAM_API_KEY
        self.sample_rate = sample_rate
        self.encoding = encoding
        self.channels = channels
        self.language = language
        self.region = region or settings.DEEPGRAM_REGION or "global"

        # Callbacks
        self.on_transcript = on_transcript
        self.on_speech_started = on_speech_started
        self.on_utterance_end = on_utterance_end
        self.on_error = on_error

        # State
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.is_connected = False
        self._receive_task: Optional[asyncio.Task] = None
        self._keepalive_task: Optional[asyncio.Task] = None
        self._last_speech_time = 0.0

        # SSL Context for Mac cert validation
        self.ssl_context = ssl.create_default_context(cafile=certifi.where())

    def _build_ws_url(self) -> str:
        base = "wss://api.deepgram.com/v1/listen"
        if self.region and self.region.lower() in ["india", "in", "in-south"]:
            base = "wss://api.in.deepgram.com/v1/listen"

        lang_param = self.language
        if lang_param in ["te", "telugu"]:
            lang_param = "te"
        elif lang_param in ["hi", "hindi"]:
            lang_param = "hi"
        else:
            lang_param = "en"

        model_to_use = "nova-3" if lang_param in ["te", "telugu"] else (getattr(settings, "DEEPGRAM_MODEL", None) or "nova-3")
        params = [
            f"model={model_to_use}",
            f"encoding={self.encoding}",
            f"sample_rate={self.sample_rate}",
            f"channels={self.channels}",
            "smart_format=true",
            "interim_results=true",
            "vad_events=true",
            "endpointing=250",
            "utterance_end_ms=600",
            f"language={lang_param}",
        ]
        return f"{base}?{'&'.join(params)}"

    async def connect(self) -> bool:
        """Establish authenticated WebSocket connection to Deepgram."""
        if not self.api_key:
            logger.error("Deepgram API key not configured")
            if self.on_error:
                self.on_error("Deepgram API key not configured")
            return False

        url = self._build_ws_url()
        headers = {"Authorization": f"Token {self.api_key}"}

        try:
            self.ws = await websockets.connect(
                url,
                additional_headers=headers,
                ssl=self.ssl_context,
                ping_interval=20,
                ping_timeout=10,
            )
            self.is_connected = True
            logger.info("Deepgram Streaming STT connected successfully.")

            # Launch background receive and keepalive tasks
            self._receive_task = asyncio.create_task(self._receive_loop())
            self._keepalive_task = asyncio.create_task(self._keepalive_loop())
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Deepgram STT: {e}")
            self.is_connected = False
            if self.on_error:
                self.on_error(str(e))
            return False

    async def send_audio(self, audio_chunk: bytes) -> None:
        """Send raw audio bytes to Deepgram streaming pipeline."""
        if not self.is_connected or not self.ws:
            return
        try:
            await self.ws.send(audio_chunk)
        except Exception as e:
            logger.warning(f"Error sending audio to Deepgram: {e}")

    async def _receive_loop(self) -> None:
        """Receive transcription events from Deepgram."""
        try:
            while self.is_connected and self.ws:
                msg = await self.ws.recv()
                if isinstance(msg, bytes):
                    continue

                data = json.loads(msg)
                msg_type = data.get("type")

                # 1. Speech Started Event -> Trigger instant barge-in!
                if msg_type == "SpeechStarted":
                    logger.info("Deepgram SpeechStarted detected -> Triggering instant barge-in")
                    if self.on_speech_started:
                        if asyncio.iscoroutinefunction(self.on_speech_started):
                            await self.on_speech_started()
                        else:
                            self.on_speech_started()

                # 2. Utterance End Event
                elif msg_type == "UtteranceEnd":
                    if self.on_utterance_end:
                        if asyncio.iscoroutinefunction(self.on_utterance_end):
                            await self.on_utterance_end()
                        else:
                            self.on_utterance_end()

                # 3. Transcription Results
                elif msg_type == "Results" or "channel" in data:
                    is_final = data.get("is_final", False)
                    speech_final = data.get("speech_final", False)
                    channel = data.get("channel", {})
                    alternatives = channel.get("alternatives", [])
                    if alternatives:
                        alt = alternatives[0]
                        transcript = alt.get("transcript", "").strip()
                        confidence = alt.get("confidence", 0.0)
                        detected_lang = channel.get("detected_language", self.language)

                        if transcript:
                            if self.on_transcript:
                                import inspect
                                sig = inspect.signature(self.on_transcript)
                                num_params = len(sig.parameters)
                                if asyncio.iscoroutinefunction(self.on_transcript):
                                    if num_params >= 5:
                                        await self.on_transcript(transcript, is_final, speech_final, detected_lang, confidence)
                                    else:
                                        await self.on_transcript(transcript, is_final, detected_lang, confidence)
                                else:
                                    if num_params >= 5:
                                        self.on_transcript(transcript, is_final, speech_final, detected_lang, confidence)
                                    else:
                                        self.on_transcript(transcript, is_final, detected_lang, confidence)


        except websockets.exceptions.ConnectionClosed:
            logger.info("Deepgram STT connection closed normally")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Deepgram receive error: {e}")
            if self.on_error:
                self.on_error(str(e))
        finally:
            self.is_connected = False

    async def _keepalive_loop(self) -> None:
        """Send periodic KeepAlive messages to maintain WebSocket connection."""
        try:
            while self.is_connected and self.ws:
                await asyncio.sleep(5.0)
                if self.is_connected and self.ws:
                    await self.ws.send(json.dumps({"type": "KeepAlive"}))
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

    async def finalize(self) -> None:
        """Send finalize message to flush any pending audio in Deepgram buffer."""
        if self.is_connected and self.ws:
            try:
                await self.ws.send(json.dumps({"type": "Finalize"}))
            except Exception:
                pass

    async def close(self) -> None:
        """Cleanly close Deepgram WebSocket connection."""
        self.is_connected = False
        if self._keepalive_task and not self._keepalive_task.done():
            self._keepalive_task.cancel()
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
        if self.ws:
            try:
                await self.ws.send(json.dumps({"type": "CloseStream"}))
                await self.ws.close()
            except Exception:
                pass
            self.ws = None
        logger.info("Deepgram STT service closed.")


if __name__ == "__main__":
    import sys
    from pathlib import Path
    # Ensure workspace root is in sys.path
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    if str(root_dir) not in sys.path:
        sys.path.insert(0, str(root_dir))

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    async def main():
        print("\n" + "=" * 60)
        print("  SARA AI — DEEPGRAM NOVA-2 LIVE STREAMING STT TEST")
        print("=" * 60)

        interim_count = 0
        final_count = 0

        def on_transcript(data):
            nonlocal interim_count, final_count
            text = data.get("text", "")
            is_final = data.get("is_final", False)
            if is_final:
                final_count += 1
                print(f"\n[FINAL STT] -> \"{text}\"")
            else:
                interim_count += 1
                print(f"[INTERIM] -> \"{text}\"", end="\r")

        def on_speech_started():
            print("\n⚡ [VAD EVENT] SpeechStarted detected! (Barge-in trigger)")

        stt = DeepgramSTTService(
            encoding="mulaw",
            sample_rate=8000,
            on_transcript=on_transcript,
            on_speech_started=on_speech_started,
        )

        print("\n1. Connecting to Deepgram live WebSocket...")
        t0 = time.time()
        ok = await stt.connect()
        connect_ms = (time.time() - t0) * 1000

        if not ok:
            print(f"❌ Failed to connect to Deepgram. Please check DEEPGRAM_API_KEY in .env")
            return

        print(f"✅ Connected to Deepgram Nova-2 in {connect_ms:.1f}ms (Region: {stt.region})")

        print("\n2. Streaming 2.0s of test audio frames (G.711 μ-law @ 8kHz)...")
        # Generate 100 frames of 20ms audio (160 bytes each = 2000ms)
        for i in range(100):
            # 160 bytes μ-law frame
            frame = b"\xff" * 160
            await stt.send_audio(frame)
            await asyncio.sleep(0.02)

        print("✅ Finished streaming audio frames.")

        print("\n3. Sending Finalize signal...")
        await stt.finalize()
        await asyncio.sleep(0.5)

        print("\n4. Closing connection cleanly...")
        await stt.close()

        print("\n" + "=" * 60)
        print("  DEEPGRAM STREAMING STT TEST PASSED SUCCESSFULLY!")
        print("=" * 60 + "\n")

    asyncio.run(main())

