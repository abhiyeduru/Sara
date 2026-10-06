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

        # 2. Initialize Deepgram Streaming STT
        lang = (self.orchestrator.language if self.orchestrator else None) or (employee.voice_language if employee else None) or "te"
        self.deepgram_service = DeepgramSTTService(
            sample_rate=8000,
            encoding="mulaw",  # Plivo sends native 8kHz mulaw
            channels=1,
            language=lang,
            on_transcript=self._on_deepgram_transcript,
            on_speech_started=self._on_deepgram_speech_started,
            on_utterance_end=self._on_deepgram_utterance_end,
        )

        connected = await self.deepgram_service.connect()
        if not connected:
            logger.error("Failed to connect to Deepgram STT stream for Plivo call")

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
        """Synthesize and stream initial greeting to caller."""
        await asyncio.sleep(0.5)  # Stabilization pause for audio stream
        if self.orchestrator and self.is_running:
            logger.info(f"Streaming initial greeting: '{greeting_text}'")
            self.orchestrator.messages.append({"role": "assistant", "content": greeting_text})
            self.orchestrator.transcript_history.append({
                "speaker": self.orchestrator.employee.name if self.orchestrator.employee else "Sara",
                "role": "assistant",
                "text": greeting_text,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            await self.orchestrator._synthesize_and_send_chunk(greeting_text, time.perf_counter(), True)
            if self.orchestrator.state == ConversationState.SPEAKING:
                self.orchestrator.is_speaking = False
                self.orchestrator.set_state(ConversationState.LISTENING)

    async def _on_media(self, message: Dict[str, Any]) -> None:
        """Forward incoming caller audio from Plivo directly into Deepgram STT."""
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
        """Deepgram speech activity detected - logged for telemetry."""
        logger.debug(f"[Call {self.call_id}] Deepgram SpeechStarted detected")

    async def _on_deepgram_utterance_end(self) -> None:
        """Deepgram detected utterance end silence -> flush pending utterance."""
        await self._flush_pending_utterance(lang="te", confidence=0.95)

    async def _on_deepgram_transcript(
        self,
        transcript: str,
        is_final: bool,
        speech_final: bool = False,
        lang: str = "te",
        confidence: float = 0.95
    ) -> None:
        """Handle transcript produced by Deepgram with smart barge-in, echo suppression, and debounced turn assembly."""
        clean = transcript.strip()
        if not clean or not self.orchestrator:
            return

        # 1. Genuine Barge-in: interrupt ONLY when the caller speaks substantive words during playback
        if self.orchestrator.is_speaking:
            now = time.time()
            time_speaking = now - getattr(self.orchestrator, "speaking_start_time", 0.0)

            # Suppress self-interruption from acoustic echo during the first 1.2s of assistant playback
            if time_speaking < 1.2:
                logger.debug(f"[Call {self.call_id}] Suppressing echo during initial speech playback ({time_speaking:.2f}s)")
                return

            words = clean.split()
            single_word_greetings = {"హలో", "హలో!", "హలో.", "hello", "hi", "hey", "హా", "హా!", "yes", "yeah", "నమస్తే", "నమస్కారం"}
            is_greeting = len(words) <= 2 and all(w.lower().strip("!.,? ") in single_word_greetings for w in words)
            interruption_words = {"ఆగండి", "ఆగు", "wait", "stop", "వద్దు", "వినండి", "విను", "listen", "hold on"}
            has_interruption = any(w.lower().strip("!.,? ") in interruption_words for w in words)

            # Require confirmed final transcript OR explicit stop words to interrupt
            should_interrupt = has_interruption or (is_final and not is_greeting and len(words) >= 3 and confidence > 0.60)

            if should_interrupt:
                logger.info(f"[Call {self.call_id}] Caller spoke substantive words ('{clean}') -> barge-in confirmed")
                await self.orchestrator.handle_barge_in()
            else:
                logger.debug(f"[Call {self.call_id}] Ignoring non-interrupting speech during assistant speech: '{clean}'")
                return

        # 2. Accumulate final transcripts into a coherent customer utterance
        if is_final:
            # If assistant is currently speaking and this is just an overlapping greeting, drop it to prevent double-speaking
            if self.orchestrator.is_speaking:
                words = clean.split()
                single_word_greetings = {"హలో", "హలో!", "హలో.", "hello", "hi", "hey", "హా", "హా!", "yes", "yeah", "నమస్తే", "నమస్కారం"}
                if len(words) <= 2 and all(w.lower().strip("!.,? ") in single_word_greetings for w in words):
                    logger.debug(f"[Call {self.call_id}] Dropping overlapping greeting during assistant speech: '{clean}'")
                    return

            self._pending_utterance_chunks.append(clean)
            if speech_final:
                # Deepgram confirmed speech endpointing -> flush immediately (30ms) for ultra-low latency!
                if self._utterance_flush_task and not self._utterance_flush_task.done():
                    self._utterance_flush_task.cancel()
                self._utterance_flush_task = asyncio.create_task(
                    self._debounced_flush(lang=lang, confidence=confidence, delay=0.030)
                )
            else:
                # User might still be speaking -> short 250ms silence debouncer
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
        if not self._pending_utterance_chunks or not self.orchestrator:
            return
        combined_text = " ".join(self._pending_utterance_chunks).strip()
        self._pending_utterance_chunks = []
        if combined_text:
            # Detect Answering Machine / Voicemail / Carrier IVR
            voicemail_patterns = [
                "person you are calling", "person you have called", "trying to reach",
                "at the tone", "record your message", "rect your message", "please record",
                "leave a message", "after the beep", "you have reached", "currently unavailable",
                "switched off", "not reachable", "mailbox is full", "call forwarding"
            ]
            lower_text = combined_text.lower()
            if any(p in lower_text for p in voicemail_patterns):
                logger.warning(f"⚠️ [Call {self.call_id}] Carrier IVR / Voicemail detected: '{combined_text}'")
                voicemail_msg = "నమస్కారం! మేము Sara AI నుంచి కాల్ చేశాము. తర్వాత మళ్ళీ సంప్రదిస్తాము. ధన్యవాదాలు." if (self.orchestrator.language or "te") in ["te", "telugu"] else "Hello, this is Sara AI. We will reach back later. Thank you."
                asyncio.create_task(self._leave_voicemail_and_hangup(voicemail_msg))
                return

            logger.info(f"[Call {self.call_id}] Dispatching full customer utterance: '{combined_text}'")
            await self.orchestrator.handle_user_utterance(
                text=combined_text,
                confidence=confidence,
                detected_lang=lang
            )

    async def _leave_voicemail_and_hangup(self, message: str) -> None:
        """Play brief voicemail message and terminate the call gracefully."""
        try:
            if self.orchestrator:
                synth = await self.orchestrator.cartesia_service.synthesize(
                    text=message,
                    voice_id=self.orchestrator.voice_id,
                    language=self.orchestrator.language,
                    output_mode=self.orchestrator.output_mode,
                    speed=self.orchestrator.speed
                )
                audio_bytes = synth.get("audio_bytes", b"")
                if audio_bytes:
                    await self._send_audio_to_plivo(audio_bytes, message)
                    await asyncio.sleep(2.5)
            if self.call_uuid:
                plivo_client.hangup_call(self.call_uuid)
        except Exception as e:
            logger.error(f"[Call {self.call_id}] Error in voicemail handler: {e}")

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
