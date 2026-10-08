"""
SARA AI — Plivo Bidirectional Media Stream Gateway
Handles real-time WebSocket media streaming with Plivo Voice API:
- Audio input: Plivo G.711 μ-law (8kHz) -> Deepgram Streaming STT
- Interruption: Deepgram speech_started -> Plivo clearAudio & TTS abort
- Audio output: Cartesia Sonic raw μ-law (8kHz) -> Base64 -> Plivo playAudio event
"""
import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from server.database import SessionLocal
from server.models import Call, AIEmployee
from server.services.voice.deepgram_service import DeepgramSTTService
from server.services.voice.assemblyai_service import AssemblyAISTTService
from server.config import settings
from server.services.voice.conversation_orchestrator import ConversationOrchestrator, ConversationState
from server.services.voice.audio_codec_service import AudioCodecService
from server.services.voice.call_billing_service import CallBillingService
from server.services.voice.plivo_client import plivo_client

logger = logging.getLogger("sara.voice.plivo_gateway")


class PlivoMediaGateway:
    """
    Manages a single Plivo Bidirectional Media Stream session over WebSockets.
    """

    def __init__(self, websocket: WebSocket, call_id: Optional[str] = None):
        self.ws = websocket
        self.stream_id: Optional[str] = None
        self.call_uuid: Optional[str] = None
        self.call_id: Optional[str] = call_id
        self.db: Session = SessionLocal()

        self.deepgram_service: Optional[DeepgramSTTService] = None
        self.orchestrator: Optional[ConversationOrchestrator] = None
        self.is_running = True
        self._playback_counter = 0
        self._latest_turn_transcript: str = ""
        self._greeting_in_progress: bool = False
        self._pending_utterance_chunks: List[str] = []
        self._utterance_flush_task: Optional[asyncio.Task] = None
        self.call_start_time: Optional[float] = None
        self.max_duration_seconds: int = 600
        self._watchdog_task: Optional[asyncio.Task] = None
        self._warning_sent: bool = False
        self.workspace_id: Optional[str] = None
        self._recorded_pcm_chunks: List[bytes] = []
        self.target_phone_number: Optional[str] = None
        self.direction: str = "outbound"
        self.ai_employee_id: Optional[str] = None

    async def handle_stream(self) -> None:
        """Main lifecycle loop for Plivo WebSocket Media Stream."""
        try:
            while self.is_running:
                data = await self.ws.receive_text()
                message = json.loads(data)
                event = message.get("event")

                if event == "connected":
                    logger.info("Plivo Media Stream WebSocket connected.")

                elif event == "start":
                    await self._on_start(message)

                elif event == "media":
                    await self._on_media(message)

                elif event == "clearedAudio":
                    logger.debug("Plivo confirmed clearAudio execution.")

                elif event == "stop":
                    logger.info(f"Plivo Media Stream stop received for stream {self.stream_id}")
                    await self._on_stop()
                    break

        except WebSocketDisconnect:
            logger.info(f"Plivo Media Stream WebSocket disconnected (Stream: {self.stream_id})")
            await self._on_stop()
        except Exception as e:
            logger.error(f"Error in Plivo Media Gateway: {e}", exc_info=True)
            await self._on_stop()
        finally:
            if self.db:
                self.db.close()

    async def _on_start(self, message: Dict[str, Any]) -> None:
        """Plivo start event: extract call parameters and initialize STT & Orchestrator."""
        start_data = message.get("start", {})
        self.stream_id = start_data.get("streamId") or start_data.get("stream_id")
        self.call_uuid = start_data.get("callId") or start_data.get("callUUID") or start_data.get("call_uuid")

        if not self.call_id:
            self.call_id = self.call_uuid

        logger.info(f"Plivo Stream started: streamId={self.stream_id}, callUUID={self.call_uuid}, call_id={self.call_id}")

        # Fetch Call and assigned AI Employee from database
        call = None
        employee = None
        if self.call_id:
            call = self.db.query(Call).filter(
                (Call.id == self.call_id) |
                (Call.twilio_call_sid == self.call_uuid) |
                (Call.twilio_call_sid == f"plv_{self.call_uuid}")
            ).first()

        if call:
            call.status = "in-progress"
            self.db.commit()
            emp_id = call.ai_employee_id or call.employee_id
            if emp_id:
                employee = self.db.query(AIEmployee).filter(AIEmployee.id == emp_id).first()

        if not employee:
            employee = self.db.query(AIEmployee).first()

        # 1. Initialize Conversation Orchestrator in Plivo mode (raw 8kHz mulaw)
        self.orchestrator = ConversationOrchestrator(
            call_id=self.call_id or "call_plivo",
            employee=employee,
            db=self.db,
            output_mode="plivo",  # Direct raw 8kHz mulaw
            send_audio_callback=self._send_audio_to_plivo,
            flush_audio_callback=self._send_clear_to_plivo,
        )

        # 2. Initialize Streaming STT (AssemblyAI Primary with Deepgram Fallback)
        lang = (self.orchestrator.language if self.orchestrator else None) or (employee.voice_language if employee else None) or "te"
        stt_connected = False

        if getattr(settings, "PRIMARY_STT", "assemblyai") == "assemblyai" and settings.ASSEMBLYAI_API_KEY:
            try:
                self.deepgram_service = AssemblyAISTTService(
                    sample_rate=8000,
                    encoding="mulaw",  # Plivo sends native 8kHz mulaw
                    channels=1,
                    language=lang,
                    on_transcript=self._on_deepgram_transcript,
                    on_speech_started=self._on_deepgram_speech_started,
                    on_utterance_end=self._on_deepgram_utterance_end,
                )
                stt_connected = await self.deepgram_service.connect()
                if stt_connected:
                    logger.info(f"🎙️ [Call {self.call_id}] Connected to AssemblyAI Universal-3-6-Pro Streaming STT for Plivo call")
            except Exception as e:
                logger.warning(f"AssemblyAI streaming init notice: {e}")

        if not stt_connected:
            logger.info(f"🎙️ [Call {self.call_id}] Using Deepgram Streaming STT for Plivo call")
            self.deepgram_service = DeepgramSTTService(
                sample_rate=8000,
                encoding="mulaw",  # Plivo sends native 8kHz mulaw
                channels=1,
                language=lang,
                on_transcript=self._on_deepgram_transcript,
                on_speech_started=self._on_deepgram_speech_started,
                on_utterance_end=self._on_deepgram_utterance_end,
            )
            stt_connected = await self.deepgram_service.connect()
            if not stt_connected:
                logger.error(f"Failed to connect to Deepgram STT stream for Plivo call {self.call_id}")

        # 3. Setup Call Start Time & Duration Limit Watchdog (5 to 10 min, ₹6/min)
        self.call_start_time = time.time()
        ws_id = (call.workspace_id if call else None) or "user_business_owner_1"
        self.workspace_id = ws_id
        eligibility = CallBillingService.verify_call_eligibility(self.db, ws_id)
        self.max_duration_seconds = eligibility.get("effective_limit_seconds", 600)
        logger.info(
            f"Plivo Call {self.call_id} duration limit configured to {self.max_duration_seconds}s "
            f"({self.max_duration_seconds // 60}m) at ₹{CallBillingService.RATE_PER_MINUTE_INR}/min "
            f"(account balance: ₹{eligibility.get('balance', 0):,.2f})"
        )
        self._watchdog_task = asyncio.create_task(self._duration_watchdog())

        self.target_phone_number = (call.to_number or call.phone_number) if call else None
        self.direction = getattr(call, "direction", "outbound") if call else "outbound"
        self.ai_employee_id = (call.ai_employee_id or call.employee_id) if call else (employee.id if employee else None)

        # Trigger carrier-level Plivo call recording
        if self.call_uuid:
            try:
                plivo_client.record_call(self.call_uuid)
            except Exception as e:
                logger.debug(f"Plivo record_call notice: {e}")

        # 4. Send initial greeting
        greeting_text = self.orchestrator.get_initial_greeting()
        asyncio.create_task(self._send_greeting(greeting_text))

    async def _send_greeting(self, greeting_text: str) -> None:
        """Synthesize and stream initial greeting to caller with immunity against connection noise."""
        await asyncio.sleep(0.8)  # Allow carrier audio connection to stabilize
        if self.orchestrator and self.is_running:
            self._greeting_in_progress = True
            self.orchestrator.greeting_in_progress = True
            logger.info(f"Streaming initial greeting: '{greeting_text}'")
            self.orchestrator.messages.append({"role": "assistant", "content": greeting_text})
            self.orchestrator.transcript_history.append({
                "speaker": self.orchestrator.employee.name if self.orchestrator.employee else "Sara",
                "role": "assistant",
                "text": greeting_text,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            try:
                await self.orchestrator._synthesize_and_send_chunk(greeting_text, time.perf_counter(), True)
            finally:
                self._greeting_in_progress = False
                if self.orchestrator:
                    self.orchestrator.greeting_in_progress = False
                    if self.orchestrator.state == ConversationState.SPEAKING:
                        self.orchestrator.is_speaking = False
                        self.orchestrator.current_speaking_text = ""
                        self.orchestrator.set_state(ConversationState.LISTENING)

    async def _on_media(self, message: Dict[str, Any]) -> None:
        """Forward incoming caller audio from Plivo directly into STT."""
        if not self.deepgram_service or not self.deepgram_service.is_connected:
            return

        media_data = message.get("media", {})
        payload = media_data.get("payload")
        if payload:
            raw_audio = AudioCodecService.decode_base64_payload(payload)
            # Transcode and buffer caller audio for call recording playback
            pcm16 = AudioCodecService.decode_mulaw_to_pcm16(raw_audio)
            if pcm16:
                self._recorded_pcm_chunks.append(pcm16)
            await self.deepgram_service.send_audio(raw_audio)

    async def _on_deepgram_speech_started(self) -> None:
        """Caller started speaking -> trigger barge-in only after minimum spoken duration to prevent carrier click aborts."""
        if getattr(self, "_greeting_in_progress", False) or (self.orchestrator and getattr(self.orchestrator, "greeting_in_progress", False)):
            return  # Protect initial greeting from mobile connect clicks

        if self.orchestrator and self.orchestrator.is_speaking:
            spoken_duration = time.perf_counter() - self.orchestrator.speaking_start_time
            if spoken_duration >= 1.0:
                logger.info(f"[Call {self.call_id}] 🛑 SpeechStarted detected (spoken {spoken_duration:.2f}s) -> halting assistant playback")
                await self.orchestrator.handle_barge_in()

    async def _on_deepgram_utterance_end(self) -> None:
        """Speech silence detected -> flush pending utterance after natural pause."""
        await self._flush_pending_utterance(lang="te", confidence=0.95)

    async def _on_deepgram_transcript(
        self,
        transcript: str,
        is_final: bool,
        speech_final: bool = False,
        lang: str = "te",
        confidence: float = 0.95,
        *args,
        **kwargs
    ) -> None:
        """Handle incoming transcript with instant word-level barge-in and natural turn assembly."""
        clean = transcript.strip()
        if not clean or not self.orchestrator:
            return

        import re
        # 1. Protect initial greeting from any interruption
        is_greeting = getattr(self, "_greeting_in_progress", False) or getattr(self.orchestrator, "greeting_in_progress", False)
        if is_greeting:
            return

        # 2. Acoustic echo prevention: ignore if caller words match what assistant is currently speaking
        if self.orchestrator.is_speaking and getattr(self.orchestrator, "current_speaking_text", ""):
            curr_words = set(re.findall(r"\w+", self.orchestrator.current_speaking_text.lower()))
            trans_words = set(re.findall(r"\w+", clean.lower()))
            if trans_words and trans_words.issubset(curr_words):
                logger.debug(f"[Call {self.call_id}] Ignored acoustic echo of assistant speech: '{clean}'")
                return

        # 3. Instant Barge-In on substantive caller speech (>= 2 words and >= 0.8s into speech)
        if self.orchestrator.is_speaking:
            spoken_duration = time.perf_counter() - self.orchestrator.speaking_start_time
            words = [w for w in clean.split() if len(w) > 1]
            if len(words) >= 2 and spoken_duration >= 0.8:
                logger.info(f"[Call {self.call_id}] 🛑 Caller spoke '{clean}' during assistant speech -> halting assistant immediately!")
                await self.orchestrator.handle_barge_in()

        # 4. Update latest cumulative transcript for this turn
        self._latest_turn_transcript = clean

        # 5. Endpointing: If turn is still ongoing, do NOT flush mid-sentence unless 1.2s silence
        if not (is_final or speech_final):
            if self._utterance_flush_task and not self._utterance_flush_task.done():
                self._utterance_flush_task.cancel()
            self._utterance_flush_task = asyncio.create_task(
                self._debounced_flush(lang=lang, confidence=confidence, delay=1.200)
            )
            return

        # 6. Turn finalized by STT -> trigger immediate turn execution after 250ms debounce
        if self._utterance_flush_task and not self._utterance_flush_task.done():
            self._utterance_flush_task.cancel()

        self._utterance_flush_task = asyncio.create_task(
            self._debounced_flush(lang=lang, confidence=confidence, delay=0.250)
        )

    async def _debounced_flush(self, lang: str, confidence: float, delay: float = 0.250) -> None:
        try:
            await asyncio.sleep(delay)
            await self._flush_pending_utterance(lang=lang, confidence=confidence)
        except asyncio.CancelledError:
            pass

    async def _flush_pending_utterance(self, lang: str, confidence: float) -> None:
        if self._utterance_flush_task and not self._utterance_flush_task.done():
            self._utterance_flush_task.cancel()
        utterance = getattr(self, "_latest_turn_transcript", "").strip()
        self._latest_turn_transcript = ""
        if not utterance or not self.orchestrator:
            return

        # If greeting is currently in progress, do not process user utterance yet
        if getattr(self, "_greeting_in_progress", False) or getattr(self.orchestrator, "greeting_in_progress", False):
            logger.info(f"[Call {self.call_id}] Greeting in progress; ignoring utterance: '{utterance}'")
            return

        import re
        # Filter carrier automated announcements (e.g. call forwarding / voicemail greetings)
        carrier_patterns = [
            r"your call has been forwarded to voicemail",
            r"has been forwarded to voicemail",
            r"forwarded to voicemail",
            r"has been forwarded to",
            r"the person you're trying to reach is not available",
            r"the person you are trying to reach is not available",
            r"the person you're trying to reach",
            r"the person you are trying to reach",
            r"the person you have called is currently unavailable",
            r"the person you have called",
            r"at the tone, please record your message",
            r"at the tone, please press \d+",
            r"at the tone",
            r"please record your message",
            r"when you have finished recording.*",
            r"you may hang up",
            r"leave a message",
            r"record your message",
            r"after the beep",
            r"not available",
            r"currently unavailable",
            r"voicemail",
        ]
        cleaned_text = utterance
        for cp in carrier_patterns:
            cleaned_text = re.sub(cp, "", cleaned_text, flags=re.IGNORECASE)

        cleaned_text = re.sub(r"\s+", " ", cleaned_text).strip(" ,.-—")

        # If the chunk only contained carrier IVR boilerplate, ignore it and keep listening for human voice
        if not cleaned_text or len(cleaned_text) < 2:
            logger.info(f"[Call {self.call_id}] Ignored empty or carrier IVR noise: '{utterance}'")
            return

        logger.info(f"[Call {self.call_id}] Dispatching customer utterance: '{cleaned_text}'")
        await self.orchestrator.handle_user_utterance(
            text=cleaned_text,
            confidence=confidence,
            detected_lang=lang
        )

    async def _send_audio_to_plivo(self, mulaw_audio: bytes, text: str) -> None:
        """
        Chunk and stream synthesized μ-law audio packets to Plivo WebSocket via playAudio.
        Uses 160ms chunks (1280 bytes) for smooth, low-latency, jitter-free playback.
        """
        if not self.ws or not mulaw_audio:
            return

        # Transcode and buffer assistant audio for full two-way call recording
        pcm16 = AudioCodecService.decode_mulaw_to_pcm16(mulaw_audio)
        if pcm16:
            self._recorded_pcm_chunks.append(pcm16)

        playback_id = self._playback_counter
        # 1280 bytes = 160ms of 8kHz μ-law audio
        chunks = AudioCodecService.chunk_mulaw(mulaw_audio, chunk_size=1280)
        logger.info(f"Streaming {len(chunks)} audio frames to Plivo for: '{text[:40]}...'")
        for chunk in chunks:
            if not self.is_running or self._playback_counter != playback_id:
                logger.debug(f"Audio playback halted (current gen: {self._playback_counter}, playback id: {playback_id})")
                break
            b64_payload = AudioCodecService.encode_base64_payload(chunk)
            play_msg = {
                "event": "playAudio",
                "media": {
                    "contentType": "audio/x-mulaw",
                    "sampleRate": 8000,
                    "payload": b64_payload,
                }
            }
            try:
                await self.ws.send_text(json.dumps(play_msg))
                await asyncio.sleep(0.150)  # 150ms sleep for 160ms audio chunk
            except Exception as e:
                logger.warning(f"Error streaming audio to Plivo: {e}")
                break

    async def _send_clear_to_plivo(self) -> None:
        """
        Send Plivo clearAudio event to flush currently playing audio queue.
        Provides zero-latency barge-in interruption.
        """
        self._playback_counter += 1
        if not self.ws:
            return

        clear_msg = {
            "event": "clearAudio"
        }
        try:
            await self.ws.send_text(json.dumps(clear_msg))
            logger.info(f"Plivo audio queue cleared for stream {self.stream_id}")
        except Exception as e:
            logger.warning(f"Error sending clearAudio to Plivo: {e}")

    async def _duration_watchdog(self) -> None:
        """
        Runtime watchdog enforcing call duration limits (5 to 10 min, or wallet balance limit).
        Plays a polite 30-second warning and gracefully hangs up call via Plivo API.
        """
        try:
            while self.is_running:
                await asyncio.sleep(2)
                if not self.call_start_time or not self.is_running:
                    continue

                elapsed = time.time() - self.call_start_time

                # 30-second advance warning before limit
                if elapsed >= (self.max_duration_seconds - 30) and not self._warning_sent:
                    self._warning_sent = True
                    logger.warning(
                        f"[Call {self.call_id}] Call limit reaching in 30 seconds "
                        f"({elapsed:.1f}s / {self.max_duration_seconds}s)"
                    )
                    if self.orchestrator and self.is_running:
                        warning_msg = (
                            "మీ కాల్ గరిష్ట సమయ పరిమితిని చేరుకుంటోంది. మరో 30 సెకన్లలో కాల్ ముగుస్తుంది."
                            if getattr(self.orchestrator, "language", "te") == "te"
                            else "Your call duration limit is approaching. The call will end in 30 seconds."
                        )
                        asyncio.create_task(self._send_warning_notice(warning_msg))

                # Hard cutoff at limit
                if elapsed >= self.max_duration_seconds:
                    logger.info(
                        f"[Call {self.call_id}] Call duration limit reached "
                        f"({elapsed:.1f}s >= {self.max_duration_seconds}s). Disconnecting via Plivo."
                    )
                    self.is_running = False
                    if self.call_uuid:
                        try:
                            plivo_client.hangup_call(self.call_uuid)
                        except Exception as e:
                            logger.warning(f"Error disconnecting call via Plivo API: {e}")
                    break
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in Plivo duration watchdog: {e}")

    async def _send_warning_notice(self, message_text: str) -> None:
        """Synthesize and stream timeout warning audio to caller."""
        try:
            if self.orchestrator and self.is_running:
                await self.orchestrator._synthesize_and_send_chunk(message_text, time.perf_counter(), True)
                if self.orchestrator.state == ConversationState.SPEAKING:
                    self.orchestrator.is_speaking = False
                    self.orchestrator.set_state(ConversationState.LISTENING)
        except Exception as e:
            logger.debug(f"Could not synthesize warning notice: {e}")

    async def _on_stop(self) -> None:
        """Call concluded: close STT, finalize conversation, bill call, generate AI call summary."""
        self.is_running = False
        if self._watchdog_task and not self._watchdog_task.done():
            self._watchdog_task.cancel()

        if self.deepgram_service:
            await self.deepgram_service.close()
            self.deepgram_service = None

        duration_seconds = int(time.time() - self.call_start_time) if self.call_start_time else 0

        # Finalize call duration & bill call directly (₹6/min)
        if self.db and self.call_id:
            try:
                billing_res = CallBillingService.bill_completed_call(
                    self.db,
                    self.call_id,
                    duration_seconds=duration_seconds,
                )
                logger.info(f"Plivo Call {self.call_id} billing result: {billing_res}")
            except Exception as e:
                logger.error(f"Failed to bill Plivo call {self.call_id}: {e}")

        summary_data = {}
        transcripts = []
        if self.orchestrator:
            transcripts = list(self.orchestrator.transcript_history)
            summary_data = await self.orchestrator.end_conversation()
            logger.info(f"Plivo Call {self.call_id} summary generated: {summary_data.get('summary')}")
            self.orchestrator = None

        # Synchronize call to CRM, AI Employee stats, and save audio recording to WAV
        if self.db and self.call_id:
            try:
                from server.services.voice.crm_sync_service import CRMSyncService
                all_pcm = b"".join(self._recorded_pcm_chunks) if self._recorded_pcm_chunks else None
                crm_res = CRMSyncService.sync_call_to_crm_and_employee(
                    db=self.db,
                    call_id=self.call_id,
                    employee_id=self.ai_employee_id,
                    phone_number=self.target_phone_number,
                    direction=self.direction,
                    duration_seconds=duration_seconds,
                    transcript_history=transcripts,
                    summary_data=summary_data,
                    recorded_pcm16_bytes=all_pcm,
                    workspace_id=self.workspace_id,
                )
                logger.info(f"Plivo Call {self.call_id} synced to CRM & Employee: {crm_res}")
            except Exception as e:
                logger.error(f"Failed to sync call {self.call_id} to CRM and employee: {e}", exc_info=True)
