"""
SARA AI — Twilio Bidirectional Media Stream Gateway
Handles real-time WebSocket media streaming with Twilio Programmable Voice:
- Audio input: Twilio G.711 μ-law (8kHz) -> Deepgram Streaming STT
- Interruption: Deepgram speech_started -> Twilio clear event & TTS abort
- Audio output: Cartesia Sonic raw μ-law (8kHz) -> Base64 -> Twilio Media Stream
"""
import asyncio
import json
import logging
import time
from typing import Optional, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from server.database import SessionLocal
from server.models import Call, AIEmployee
from server.services.voice.deepgram_service import DeepgramSTTService
from server.services.voice.conversation_orchestrator import ConversationOrchestrator
from server.services.voice.audio_codec_service import AudioCodecService

logger = logging.getLogger("sara.voice.twilio_gateway")


class TwilioMediaGateway:
    """
    Manages a single Twilio Bidirectional Media Stream session.
    """

    def __init__(self, websocket: WebSocket):
        self.ws = websocket
        self.stream_sid: Optional[str] = None
        self.call_sid: Optional[str] = None
        self.call_id: Optional[str] = None
        self.db: Session = SessionLocal()

        self.deepgram_service: Optional[DeepgramSTTService] = None
        self.orchestrator: Optional[ConversationOrchestrator] = None
        self.is_running = True

    async def handle_stream(self) -> None:
        """Main lifecycle loop for Twilio WebSocket Media Stream."""
        try:
            while self.is_running:
                data = await self.ws.receive_text()
                message = json.loads(data)
                event = message.get("event")

                if event == "connected":
                    logger.info("Twilio Media Stream WebSocket connected.")

                elif event == "start":
                    await self._on_start(message)

                elif event == "media":
                    await self._on_media(message)

                elif event == "mark":
                    pass

                elif event == "stop":
                    logger.info(f"Twilio Media Stream stop received for stream {self.stream_sid}")
                    await self._on_stop()
                    break

        except WebSocketDisconnect:
            logger.info(f"Twilio Media Stream WebSocket disconnected (Stream: {self.stream_sid})")
            await self._on_stop()
        except Exception as e:
            logger.error(f"Error in Twilio Media Gateway: {e}", exc_info=True)
            await self._on_stop()
        finally:
            if self.db:
                self.db.close()

    async def _on_start(self, message: Dict[str, Any]) -> None:
        """Twilio start event: extract call parameters and initialize STT & Orchestrator."""
        start_data = message.get("start", {})
        self.stream_sid = start_data.get("streamSid")
        self.call_sid = start_data.get("callSid")
        custom_params = start_data.get("customParameters", {})
        self.call_id = custom_params.get("call_id") or self.call_sid

        logger.info(f"Twilio Stream started: streamSid={self.stream_sid}, callSid={self.call_sid}, call_id={self.call_id}")

        # Fetch Call and assigned AI Employee
        call = None
        employee = None
        if self.call_id:
            call = self.db.query(Call).filter(
                (Call.id == self.call_id) | (Call.twilio_call_sid == self.call_sid)
            ).first()

        if call:
            emp_id = call.ai_employee_id or call.employee_id
            if emp_id:
                employee = self.db.query(AIEmployee).filter(AIEmployee.id == emp_id).first()

        if not employee:
            employee = self.db.query(AIEmployee).first()

        # 1. Initialize Conversation Orchestrator
        self.orchestrator = ConversationOrchestrator(
            call_id=self.call_id,
            employee=employee,
            db=self.db,
            output_mode="twilio",  # Direct raw 8kHz mulaw
            send_audio_callback=self._send_audio_to_twilio,
            flush_audio_callback=self._send_clear_to_twilio,
        )

        # 2. Initialize Deepgram Streaming STT
        lang = employee.voice_language if employee and employee.voice_language else "en"
        self.deepgram_service = DeepgramSTTService(
            sample_rate=8000,
            encoding="mulaw",  # Twilio sends native 8kHz mulaw
            channels=1,
            language=lang,
            on_transcript=self._on_deepgram_transcript,
            on_speech_started=self._on_deepgram_speech_started,
        )

        connected = await self.deepgram_service.connect()
        if not connected:
            logger.error("Failed to connect to Deepgram STT stream for Twilio call")

        # 3. Send initial greeting
        greeting_text = (
            f"Hello, this is {employee.name if employee else 'Sara'}. "
            "Thank you for connecting with us today. How may I assist you?"
        )
        if employee and employee.mission:
            greeting_text = f"Hello, I am {employee.name}. How can I assist you today?"

        asyncio.create_task(self._send_greeting(greeting_text))

    async def _send_greeting(self, greeting_text: str) -> None:
        """Synthesize and stream initial greeting to caller."""
        await asyncio.sleep(0.3)  # Brief pause for audio stream stabilization
        if self.orchestrator and self.is_running:
            await self.orchestrator._synthesize_and_send_chunk(greeting_text, time.perf_counter(), True)
            self.orchestrator.transcript_history.append({
                "speaker": self.orchestrator.employee.name if self.orchestrator.employee else "Sara",
                "role": "assistant",
                "text": greeting_text,
                "timestamp": time.time()
            })

    async def _on_media(self, message: Dict[str, Any]) -> None:
        """Forward incoming caller audio from Twilio directly into Deepgram STT."""
        if not self.deepgram_service or not self.deepgram_service.is_connected:
            return

        media_data = message.get("media", {})
        payload = media_data.get("payload")
        if payload:
            raw_audio = AudioCodecService.decode_base64_payload(payload)
            await self.deepgram_service.send_audio(raw_audio)

    async def _on_deepgram_speech_started(self) -> None:
        """Barge-in trigger: customer started speaking."""
        if self.orchestrator:
            await self.orchestrator.handle_barge_in()

    async def _on_deepgram_transcript(self, transcript: str, is_final: bool, lang: str, confidence: float) -> None:
        """Handle transcript produced by Deepgram."""
        if is_final and transcript.strip() and self.orchestrator:
            await self.orchestrator.handle_user_utterance(
                text=transcript,
                confidence=confidence,
                detected_lang=lang
            )

    async def _send_audio_to_twilio(self, mulaw_audio: bytes, text: str) -> None:
        """
        Chunk and stream synthesized μ-law audio packets to Twilio WebSocket.
        """
        if not self.ws or not self.stream_sid:
            return

        # Chunk into 160-byte frames (20ms at 8kHz μ-law)
        chunks = AudioCodecService.chunk_mulaw(mulaw_audio, chunk_size=160)
        for chunk in chunks:
            if not self.is_running:
                break
            b64_payload = AudioCodecService.encode_base64_payload(chunk)
            media_msg = {
                "event": "media",
                "streamSid": self.stream_sid,
                "media": {
                    "payload": b64_payload
                }
            }
            try:
                await self.ws.send_text(json.dumps(media_msg))
                # Slight pacing to avoid buffer overrun on Twilio edge
                await asyncio.sleep(0.018)
            except Exception as e:
                logger.warning(f"Error streaming audio to Twilio: {e}")
                break

    async def _send_clear_to_twilio(self) -> None:
        """
        Send Twilio clear event to flush currently playing audio on caller's phone.
        This provides instantaneous barge-in!
        """
        if not self.ws or not self.stream_sid:
            return

        clear_msg = {
            "event": "clear",
            "streamSid": self.stream_sid
        }
        try:
            await self.ws.send_text(json.dumps(clear_msg))
            logger.info(f"Twilio buffer cleared for stream {self.stream_sid}")
        except Exception as e:
            logger.warning(f"Error sending clear to Twilio: {e}")

    async def _on_stop(self) -> None:
        """Call concluded: close STT, finalize conversation, generate AI call summary."""
        self.is_running = False
        if self.deepgram_service:
            await self.deepgram_service.close()
            self.deepgram_service = None

        if self.orchestrator:
            summary_data = await self.orchestrator.end_conversation()
            logger.info(f"Call {self.call_id} summary generated: {summary_data.get('summary')}")
            self.orchestrator = None
