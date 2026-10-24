"""
SARA AI — Plivo Bidirectional Media Stream Gateway
Handles real-time WebSocket media streaming with Plivo Voice API:
- Audio input: Plivo G.711 μ-law (8kHz) -> Deepgram Streaming STT
- Interruption: Deepgram speech_started -> Plivo clearAudio & TTS abort
- Audio output: Sarvam AI bulbul:v3 sweet voice -> μ-law (8kHz) -> Base64 -> Plivo playAudio event
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
from server.services.voice.elevenlabs_service import ElevenLabsSTTService
from server.services.voice.cartesia_stt_service import CartesiaStreamingSTTService
from server.services.voice.sarvam_realtime_stt import SarvamRealtimeSTTService
from server.services.voice.assemblyai_service import AssemblyAISTTService
from server.services.voice.deepgram_service import DeepgramSTTService
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
        self._finalized_chunks: List[str] = []
        self._interim_chunk: str = ""
        self._utterance_flush_task: Optional[asyncio.Task] = None
        self.call_start_time: Optional[float] = None
        self.max_duration_seconds: int = 600
        self._watchdog_task: Optional[asyncio.Task] = None
        self._warning_sent: bool = False
        self._pending_hangup_task: Optional[asyncio.Task] = None
        self.workspace_id: Optional[str] = None
        self._recorded_pcm_chunks: List[bytes] = []
        self.target_phone_number: Optional[str] = None
        self.direction: str = "outbound"
        self.ai_employee_id: Optional[str] = None
        # Non-blocking audio streaming pipeline
        self._outbound_audio_queue: asyncio.Queue = asyncio.Queue(maxsize=1500)
        self._audio_streaming_task: Optional[asyncio.Task] = None
        self._ambient_sample_offset: int = 0
        self._was_idle: bool = True
        self._caller_pitch_samples: List[float] = []
        self._caller_pcm_buffer: bytearray = bytearray()
        self._gender_detected: bool = False
        self._assistant_playback_end_time: float = 0.0

    def is_assistant_talking(self) -> bool:
        """Accurately checks whether assistant is audibly speaking or has pending audio playback."""
        now = time.time()
        has_pending_audio = (now < self._assistant_playback_end_time) or not self._outbound_audio_queue.empty()
        is_speaking_state = bool(self.orchestrator and (self.orchestrator.is_speaking or self.orchestrator.state == ConversationState.SPEAKING))
        greeting = bool(getattr(self, "_greeting_in_progress", False) or (self.orchestrator and getattr(self.orchestrator, "greeting_in_progress", False)))
        return has_pending_audio or is_speaking_state or greeting

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

        except WebSocketDisconnect as ws_disc:
            logger.info(f"Plivo Media Stream WebSocket disconnected (Stream: {self.stream_id}, code={getattr(ws_disc, 'code', None)}, reason={getattr(ws_disc, 'reason', None)})")
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

        # Initialize Conversation Orchestrator immediately (in memory)
        self.orchestrator = ConversationOrchestrator(
            call_id=self.call_id or "call_plivo",
            employee=None,
            db=self.db,
            output_mode="plivo",  # Direct raw 8kHz mulaw
            send_audio_callback=self._send_audio_to_plivo,
            send_event_callback=self._on_orchestrator_event,
            flush_audio_callback=self._send_clear_to_plivo,
            trigger_hangup_callback=self.hangup_after_playback,
        )

        # 1. Start dedicated background audio streaming task IMMEDIATELY (<1ms)
        self._audio_streaming_task = asyncio.create_task(self._audio_streaming_loop())

        # 2. Synthesize & stream initial greeting IMMEDIATELY (0ms lag!)
        greeting_text = "నమస్కారం అండి! నేను సారా మాట్లాడుతున్నాను, Saadhyam AI తరఫున. మీ వ్యాపారానికి సంబంధించిన ఒక చిన్న విషయం మాట్లాడటానికి కాల్ చేశాను అండి. ఇప్పుడు ఒక నిమిషం మాట్లాడటం వీలవుతుందా?"
        logger.info(f"🎙️ [Call {self.call_id}] Instant zero-delay initial greeting: '{greeting_text}'")
        self._greeting_task = asyncio.create_task(self._send_greeting(greeting_text))

        # 3. Start Streaming STT immediately
        asyncio.create_task(self._init_stt_stream(None))

        # 4. Resolve DB records & employee details in background without blocking audio
        async def _async_resolve_call_and_db():
            try:
                call = None
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
                        emp = self.db.query(AIEmployee).filter(AIEmployee.id == emp_id).first()
                        if emp and self.orchestrator:
                            self.orchestrator.employee = emp
            except Exception as e:
                logger.debug(f"[Call {self.call_id}] Background DB resolve notice: {e}")

        self.call_start_time = time.time()
        self.workspace_id = "user_business_owner_1"
        self.direction = "outbound"

        async def _background_post_connect():
            try:
                eligibility = CallBillingService.verify_call_eligibility(self.db, self.workspace_id)
                self.max_duration_seconds = eligibility.get("effective_limit_seconds", 600)
                self._watchdog_task = asyncio.create_task(self._duration_watchdog())
                if self.call_uuid:
                    try:
                        plivo_client.record_call(self.call_uuid)
                    except Exception as e:
                        logger.debug(f"Plivo record_call notice: {e}")
            except Exception as ex:
                logger.debug(f"Background post-connect notice: {ex}")

        asyncio.create_task(_background_post_connect())

    async def _init_stt_stream(self, employee: Any) -> None:
        """Initialize Streaming STT connection concurrently without blocking audio playback."""
        lang = (self.orchestrator.language if self.orchestrator else None) or (employee.voice_language if employee else None) or "te"
        if not lang or lang in ["en", "auto"]:
            lang = "te"
        stt_connected = False
        primary_stt = getattr(settings, "PRIMARY_STT", "sarvam").lower()

        # 1. Primary STT: Sarvam AI Saaras v4 (Native Indic real-time streaming STT for fluent Telugu/Hindi)
        if (primary_stt == "sarvam" or lang in ["te", "te-in", "hi", "hi-in"]) and getattr(settings, "SARVAM_API_KEY", None):
            try:
                self.deepgram_service = SarvamRealtimeSTTService(
                    sample_rate=8000,
                    encoding="mulaw",  # Plivo sends native 8kHz mulaw
                    channels=1,
                    language="te-IN" if "te" in lang else "hi-IN",
                    on_transcript=self._on_deepgram_transcript,
                    on_speech_started=self._on_deepgram_speech_started,
                    on_utterance_end=self._on_deepgram_utterance_end,
                )
                stt_connected = await self.deepgram_service.connect()
                if stt_connected:
                    logger.info(f"🎙️ [Call {self.call_id}] Connected to Sarvam AI Realtime Streaming STT (saaras:v4) for Plivo call")
            except Exception as e:
                logger.warning(f"Sarvam Realtime streaming init notice: {e}")

        # 2. Fallback STT: Deepgram Nova-3 (Native 8kHz mulaw ingestion)
        if not stt_connected and getattr(settings, "DEEPGRAM_API_KEY", None):
            try:
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
                if stt_connected:
                    logger.info(f"🎙️ [Call {self.call_id}] Connected to Deepgram Nova-3 Streaming STT (8kHz mulaw) for Plivo call")
            except Exception as e:
                logger.warning(f"Deepgram Nova-3 streaming init notice: {e}")

        # 3. Fallback: Cartesia Ink Streaming STT
        if not stt_connected and getattr(settings, "CARTESIA_API_KEY", None):
            try:
                self.deepgram_service = CartesiaStreamingSTTService(
                    api_key=settings.CARTESIA_API_KEY,
                    sample_rate=8000,
                    encoding="pcm_mulaw",
                    language=lang,
                    on_transcript=self._on_deepgram_transcript,
                    on_speech_started=self._on_deepgram_speech_started,
                    on_utterance_end=self._on_deepgram_utterance_end,
                )
                stt_connected = await self.deepgram_service.connect()
                if stt_connected:
                    logger.info(f"🎙️ [Call {self.call_id}] Connected to Cartesia Ink Realtime Streaming STT for Plivo call")
            except Exception as e:
                logger.warning(f"Cartesia Ink STT init notice: {e}")

        # 4. Fallback: AssemblyAI
        if not stt_connected and settings.ASSEMBLYAI_API_KEY:
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
                    logger.info(f"🎙️ [Call {self.call_id}] Connected to AssemblyAI Universal-3-6-Pro Streaming STT fallback for Plivo call")
            except Exception as e:
                logger.warning(f"AssemblyAI streaming init notice: {e}")

    async def _send_greeting(self, greeting_text: str) -> None:
        """Synthesize and stream initial greeting to caller immediately on call connect."""
        try:
            # Dynamically resolve greeting from orchestrator (supports user custom opening lines!)
            if self.orchestrator:
                custom_greeting = self.orchestrator.get_initial_greeting()
                if custom_greeting and custom_greeting.strip():
                    greeting_text = custom_greeting.strip()

            logger.info(f"🎙️ [Call {self.call_id}] _send_greeting coroutine started for: '{greeting_text[:50]}...'")
            await asyncio.sleep(0.01)  # Instant startup

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
                    # Break into natural clauses (. ! ?) so first audio plays in < 500ms
                    import re
                    clauses = [c.strip() for c in re.split(r'([.?!।\n]+)', greeting_text) if c.strip() and not re.match(r'^[.?!।\n]+$', c)]
                    if not clauses:
                        clauses = [greeting_text]

                    for idx, clause in enumerate(clauses):
                        if not self.is_running or not self._greeting_in_progress or (self.orchestrator and not getattr(self.orchestrator, "greeting_in_progress", False)):
                            logger.info(f"[Call {self.call_id}] Initial greeting interrupted at clause #{idx+1}")
                            break
                        await self.orchestrator._synthesize_and_send_chunk(clause, time.perf_counter(), idx == 0)
                finally:
                    self._greeting_in_progress = False
                    if self.orchestrator:
                        self.orchestrator.greeting_in_progress = False
                        if self.orchestrator.state == ConversationState.SPEAKING:
                            self.orchestrator.is_speaking = False
                            self.orchestrator.current_speaking_text = ""
                            self.orchestrator.set_state(ConversationState.LISTENING)
        except Exception as e:
            logger.error(f"❌ [Call {self.call_id}] Exception in _send_greeting: {e}", exc_info=True)

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

                # Real-time acoustic pitch (F0) tracking for caller gender detection
                if not getattr(self, "_gender_detected", False) and self.orchestrator:
                    self._caller_pcm_buffer.extend(pcm16)
                    while len(self._caller_pcm_buffer) >= 640:
                        window = bytes(self._caller_pcm_buffer[:640])
                        self._caller_pcm_buffer = self._caller_pcm_buffer[320:]
                        f0 = AudioCodecService.estimate_f0_pitch(window)
                        if f0 is not None:
                            self._caller_pitch_samples.append(f0)
                            if len(self._caller_pitch_samples) >= 5:
                                sorted_f0 = sorted(self._caller_pitch_samples)
                                median_f0 = sorted_f0[len(sorted_f0) // 2]
                                gender, title = AudioCodecService.classify_gender_from_f0(median_f0)
                                self._gender_detected = True
                                logger.info(
                                    f"🎙️ [Call {self.call_id}] Acoustic Pitch Detected: "
                                    f"F0={median_f0:.1f}Hz -> Identified caller: {gender.upper()} -> Title: '{title}'"
                                )
                                self.orchestrator.update_caller_gender(gender, title)
                                break

            self._media_frame_count = getattr(self, "_media_frame_count", 0) + 1
            if self._media_frame_count == 1 or self._media_frame_count % 100 == 0:
                logger.info(
                    f"🎙️ [Call {self.call_id}] Inbound audio event #{self._media_frame_count}: "
                    f"{len(raw_audio)} bytes (8kHz mulaw) | STT state=connected | timestamp={time.time():.3f}"
                )

            # Stream inbound caller audio directly into STT pipeline
            if self.deepgram_service and self.deepgram_service.is_connected:
                try:
                    await self.deepgram_service.send_audio(raw_audio)
                except Exception as e:
                    logger.warning(f"Error forwarding inbound audio to STT: {e}")

    async def _on_orchestrator_event(self, event: Dict[str, Any]) -> None:
        """Handle real-time transcript and status events from orchestrator."""
        if not event:
            return
        ev_type = event.get("type")
        if ev_type == "transcript" and self.call_id:
            # Update DB Call.transcript asynchronously in background so audio pipeline has 0ms blocking!
            history_copy = list(self.orchestrator.transcript_history) if self.orchestrator else []
            call_id = self.call_id
            call_uuid = getattr(self, "call_uuid", None)

            def _bg_update_db():
                try:
                    from server.database import SessionLocal
                    with SessionLocal() as db_session:
                        call = db_session.query(Call).filter(Call.id == call_id).first()
                        if not call and call_uuid:
                            call = db_session.query(Call).filter(Call.twilio_call_sid == f"plv_{call_uuid}").first()
                        if call:
                            call.transcript = history_copy
                            db_session.commit()
                except Exception as e:
                    logger.debug(f"DB live transcript update notice: {e}")

            asyncio.create_task(asyncio.to_thread(_bg_update_db))

        try:
            from server.services.voice.voice_events import voice_events_bus
            await voice_events_bus.broadcast({
                "type": "call.transcript",
                "call_id": self.call_id,
                **event
            })
        except Exception:
            pass

    async def _on_deepgram_speech_started(self) -> None:
        """Caller speech activity detected via VAD signal."""
        logger.info(f"🎙️ [Call {self.call_id}] VAD SpeechStarted event received from STT (customer began speaking)")
        self._user_spoke_first = True
        self._cancel_pending_hangup()

    async def _on_deepgram_utterance_end(self) -> None:
        """Speech silence detected -> trigger conversational turn immediately."""
        if self._utterance_flush_task and not self._utterance_flush_task.done():
            self._utterance_flush_task.cancel()
        self._utterance_flush_task = asyncio.create_task(
            self._debounced_flush(lang="te", confidence=0.95, delay=0.080)
        )

    async def _on_deepgram_transcript(
        self,
        transcript: str,
        is_final: bool,
        speech_final: Any = False,
        lang: Any = "te",
        confidence: float = 0.95,
        *args,
        **kwargs
    ) -> None:
        """Handle incoming transcript with instant word-level barge-in and natural turn assembly."""
        clean = transcript.strip()
        if not clean or not self.orchestrator:
            return

        self._cancel_pending_hangup()

        import re
        from server.services.voice.cartesia_stt_service import is_whisper_hallucination

        # Guard: Completely reject autoregressive Whisper hallucinations
        if is_whisper_hallucination(clean):
            logger.warning(f"[Call {self.call_id}] Discarded Whisper looping hallucination: '{clean}'")
            return

        # Normalize arguments across different STT providers
        real_is_final = bool(is_final)
        real_speech_final = False
        real_lang = "te"
        real_confidence = 0.95

        if isinstance(speech_final, str):
            real_lang = speech_final
            real_speech_final = real_is_final
        else:
            real_speech_final = bool(speech_final)
            if isinstance(lang, str):
                real_lang = lang
            if isinstance(confidence, (int, float)):
                real_confidence = float(confidence)

        # 1. Acoustic echo prevention: ignore if user utterance overlaps with assistant speech
        curr_text = getattr(self.orchestrator, "current_speaking_text", "").strip()
        last_text = getattr(self.orchestrator, "last_assistant_speech_text", "").strip()
        time_since_speech = time.perf_counter() - getattr(self.orchestrator, "last_assistant_speech_end_time", 0.0)

        clean_lower = clean.lower()
        trans_words = [w for w in re.findall(r"\w+", clean_lower) if len(w) > 1]

        # Check echo overlap against assistant speech (current, last, or recent assistant history)
        assistant_words = set(re.findall(r"\w+", (f"{curr_text} {last_text}").lower()))
        if self.orchestrator and self.orchestrator.transcript_history:
            recent_ass = [
                h["text"] for h in self.orchestrator.transcript_history[-3:]
                if h.get("role") == "assistant" and h.get("text")
            ]
            if recent_ass:
                assistant_words.update(re.findall(r"\w+", " ".join(recent_ass).lower()))

        is_talking = self.is_assistant_talking()
        if assistant_words and trans_words and (is_talking or time_since_speech < 2.2):
            overlap_count = sum(1 for w in trans_words if w in assistant_words)
            overlap_ratio = overlap_count / len(trans_words) if trans_words else 0
            if overlap_ratio >= 0.40 or (overlap_count >= 2 and len(trans_words) <= 3):
                logger.debug(f"[Call {self.call_id}] Filtered acoustic phone echo ({overlap_count}/{len(trans_words)} words matched assistant): '{clean}'")
                return

        # 2. Barge-in during assistant speech or greeting
        if is_talking:
            # Protect initial greeting from initial connect burst (first 1.8s of call)
            if self.call_start_time and (time.time() - self.call_start_time < 1.8):
                logger.debug(f"[Call {self.call_id}] Suppressing barge-in during initial carrier line stabilization")
                return

            # Non-word vocalizations, breaths, line hum
            filler_tokens = {
                "ఆ", "అ", "ఓ", "ఏ", "హ్", "మ్", "ఉ",
                "uh", "um", "ah", "eh", "oh", "mm", "hmm"
            }
            clean_words = [w for w in re.findall(r"\w+", clean_lower) if len(w) > 0 and w not in filler_tokens]
            if not clean_words or clean in filler_tokens or len(clean.replace(" ", "")) < 2:
                logger.debug(f"[Call {self.call_id}] Ignoring minor vocal filler/noise '{clean}' during playback")
                return

            # Prevent self-interruption from trailing/late STT transcript of the CURRENT turn's prompt
            last_prompt = (getattr(self.orchestrator, "last_user_text", "") or "").lower()
            if last_prompt:
                prompt_words = set(re.findall(r"\w+", last_prompt))
                overlap_with_prompt = sum(1 for w in clean_words if w in prompt_words)
                if overlap_with_prompt >= 1 and (len(clean_words) <= 2 or overlap_with_prompt / len(clean_words) >= 0.50):
                    logger.debug(f"[Call {self.call_id}] Suppressed trailing STT echo of active prompt: '{clean}'")
                    return

            # Explicit stop commands:
            INTERRUPT_KEYWORDS = {
                "వద్దు", "వద్దండి", "ఆగండి", "ఆగు", "విను", "వినండి", "ఒక్క నిమిషం", "చాలు", "లేదు", "ఆపండి", "హలో",
                "stop", "wait", "hold", "listen", "no", "quiet", "cancel", "shut", "enough", "hello"
            }
            has_explicit_interrupt = any(w in INTERRUPT_KEYWORDS for w in clean_words)

            # Minimal 350ms grace window after speaking starts to filter initial carrier line transients
            speaking_start = getattr(self.orchestrator, "speaking_start_time", 0.0)
            if speaking_start and (time.perf_counter() - speaking_start < 0.35) and not has_explicit_interrupt:
                logger.debug(f"[Call {self.call_id}] Suppressing interruption during first 350ms playback grace window: '{clean}'")
                return

            # Instant barge-in: If caller speaks any real word, stop assistant immediately!
            is_valid_barge_in = has_explicit_interrupt or (len(clean_words) >= 1)

            if not is_valid_barge_in:
                return

            logger.info(f"[Call {self.call_id}] 🛑 Caller spoke '{clean}' during playback -> halting assistant immediately!")
            self._greeting_in_progress = False
            if self.orchestrator:
                self.orchestrator.greeting_in_progress = False
            await self.orchestrator.handle_barge_in()
            await self._send_clear_to_plivo()

        # 3. Cumulative sentence assembly:
        # Accumulate finalized segments so pauses between words do NOT chop sentences in half
        if real_is_final:
            if clean and (not self._finalized_chunks or clean != self._finalized_chunks[-1]):
                self._finalized_chunks.append(clean)
            self._interim_chunk = ""
        else:
            self._interim_chunk = clean

        # 4. Turn Endpointing (Optimized for Fast Latency & Natural Cadence):
        # Check if caller paused mid-clause on a conjunction:
        TRAILING_CONJUNCTIONS = {
            "మరియు", "కానీ", "అయితే", "అంటే", "లేదా", "లేకపోతే", "ఎందుకంటే", "ఇంకా", "కూడా", "మరి", "ఆ", "ఉమ్",
            "and", "but", "or", "so", "because", "like", "if", "that", "uh", "um"
        }
        words = clean.lower().split()
        last_word = words[-1].strip(".,?!-") if words else ""
        is_trailing = last_word in TRAILING_CONJUNCTIONS
        is_very_short = len(words) < 2

        if not real_is_final and not real_speech_final:
            # For purely interim/incomplete chunks, fast 280ms debounce for natural turn-taking
            flush_delay = 0.280
        elif is_trailing or is_very_short:
            # Caller paused mid-clause or single word; brief 80ms pause
            flush_delay = 0.080
        elif real_speech_final:
            # Completed sentence recognized by STT VAD -> Instant dispatch!
            flush_delay = 0.010
        else:
            # Completed finalized STT segment -> Instant dispatch!
            flush_delay = 0.020

        if self._utterance_flush_task and not self._utterance_flush_task.done():
            self._utterance_flush_task.cancel()

        self._utterance_flush_task = asyncio.create_task(
            self._debounced_flush(lang=real_lang, confidence=real_confidence, delay=flush_delay)
        )

    async def _debounced_flush(self, lang: str, confidence: float, delay: float = 0.350) -> None:
        try:
            await asyncio.sleep(delay)
            await self._flush_pending_utterance(lang=lang, confidence=confidence)
        except asyncio.CancelledError:
            pass

    async def _flush_pending_utterance(self, lang: str, confidence: float) -> None:
        if self._utterance_flush_task and not self._utterance_flush_task.done():
            self._utterance_flush_task.cancel()

        # Guard: If assistant is still audibly speaking and no barge-in occurred, do not interrupt
        if self.is_assistant_talking():
            logger.debug(f"[Call {self.call_id}] Deferred utterance flush while assistant is actively speaking")
            return

        # Assemble full completed utterance across all finalized segments + trailing interim
        parts = list(self._finalized_chunks)
        if self._interim_chunk:
            last_part = parts[-1] if parts else ""
            if self._interim_chunk not in last_part:
                parts.append(self._interim_chunk)

        self._finalized_chunks.clear()
        self._interim_chunk = ""
        self._latest_turn_transcript = ""

        utterance = " ".join(parts).strip()
        if not utterance or len(utterance.replace(" ", "")) < 2 or not self.orchestrator:
            return

        # Prevent double-dispatching the exact same utterance within 1.5s
        now = time.time()
        last_disp = getattr(self, "_last_dispatched_utterance", "")
        last_time = getattr(self, "_last_dispatched_time", 0.0)
        if utterance.lower() == last_disp.lower() and (now - last_time < 1.5):
            logger.debug(f"[Call {self.call_id}] Suppressing immediate duplicate dispatch: '{utterance}'")
            return

        self._last_dispatched_utterance = utterance
        self._last_dispatched_time = now
        self._cancel_pending_hangup()

        # Ensure greeting flag is reset once caller communicates
        self._greeting_in_progress = False
        if self.orchestrator:
            self.orchestrator.greeting_in_progress = False

        # Filter carrier automated voicemail greetings only when full phrase matches
        carrier_patterns = [
            r"^your call has been forwarded to voicemail.*",
            r"^the person you('re| are| have called) is (not|currently) available.*",
            r"^at the tone,? please (record your message|press \d+).*",
            r"^when you have finished recording.*",
        ]
        import re
        is_voicemail_ivr = any(re.match(cp, utterance, flags=re.IGNORECASE) for cp in carrier_patterns)
        if is_voicemail_ivr:
            logger.info(f"[Call {self.call_id}] Detected carrier voicemail announcement: '{utterance}'")
            return

        cleaned_text = re.sub(r"\s+", " ", utterance).strip(" ,.-—")
        if not cleaned_text:
            return

        logger.info(f"[Call {self.call_id}] Dispatching customer utterance: '{cleaned_text}'")
        await self.orchestrator.handle_user_utterance(
            text=cleaned_text,
            confidence=confidence,
            detected_lang=lang
        )

    def _cancel_pending_hangup(self) -> None:
        """Cancel any scheduled automated hangup if customer speaks or continues call."""
        if getattr(self, "_pending_hangup_task", None) and not self._pending_hangup_task.done():
            logger.info(f"[Call {self.call_id}] 🛑 Customer active on line -> CANCELLED automated hangup!")
            self._pending_hangup_task.cancel()
            self._pending_hangup_task = None

    async def hangup_after_playback(self, delay: float = 12.0) -> None:
        """
        Allows polite closing audio to finish playing, then cleanly hangs up the call via Plivo API
        ONLY IF caller has remained silent and hasn't resumed speaking.
        """
        self._cancel_pending_hangup()
        self._pending_hangup_task = asyncio.create_task(self._delayed_hangup_worker(delay))

    async def _delayed_hangup_worker(self, delay: float = 12.0) -> None:
        try:
            await asyncio.sleep(delay)
            # Only disconnect if caller EXPLICITLY requested call termination (e.g., "call cut cheyandi", "bye")
            is_explicit = bool(self.orchestrator and getattr(self.orchestrator, "explicit_hangup_requested", False))
            if not is_explicit:
                logger.info(f"[Call {self.call_id}] Caller has not requested hangup. Keeping line open indefinitely.")
                return

            last_spoken_time = getattr(self, "_last_dispatched_time", 0.0)
            if last_spoken_time and (time.time() - last_spoken_time < 8.0):
                logger.info(f"[Call {self.call_id}] Caller spoke recently ({time.time() - last_spoken_time:.1f}s ago). Aborting hangup.")
                return

            self.is_running = False
            if self.call_uuid:
                try:
                    plivo_client.hangup_call(self.call_uuid)
                    logger.info(f"[Call {self.call_id}] Plivo call disconnected cleanly via API following explicit user request.")
                except Exception as e:
                    logger.warning(f"Error disconnecting call via Plivo API: {e}")
            if self.ws:
                try:
                    await self.ws.close()
                except Exception:
                    pass
        except asyncio.CancelledError:
            logger.info(f"[Call {self.call_id}] Automated hangup task CANCELLED because caller resumed conversation!")
        except Exception as ex:
            logger.error(f"Error in delayed hangup worker: {ex}")

    async def _send_audio_to_plivo(self, mulaw_audio: bytes, text: str) -> None:
        """
        Enqueues synthesized μ-law audio packets non-blockingly into outbound audio queue.
        Zero-overhead streaming prevents CPU starvation and jitter.
        """
        if not self.ws or not mulaw_audio:
            return

        # Buffer assistant audio for call recording playback
        pcm16 = AudioCodecService.decode_mulaw_to_pcm16(mulaw_audio)
        if pcm16:
            self._recorded_pcm_chunks.append(pcm16)

        # Accurately extend assistant playback window based on audio duration (8000 bytes = 1s of 8kHz μ-law)
        audio_dur = len(mulaw_audio) / 8000.0
        now = time.time()
        start_t = max(now, self._assistant_playback_end_time)
        self._assistant_playback_end_time = start_t + audio_dur

        playback_id = self._playback_counter
        # 1280 bytes = 160ms of 8kHz μ-law audio
        chunks = AudioCodecService.chunk_mulaw(mulaw_audio, chunk_size=1280)
        logger.info(f"Queued {len(chunks)} audio frames to Plivo for: '{text[:40]}...' (dur={audio_dur:.2f}s, gen {playback_id})")
        for idx, chunk in enumerate(chunks):
            if not self.is_running or self._playback_counter != playback_id:
                break
            try:
                self._outbound_audio_queue.put_nowait((playback_id, chunk, idx == 0))
            except asyncio.QueueFull:
                logger.warning("Plivo outbound audio queue full, dropping oldest frames")
                try:
                    _ = self._outbound_audio_queue.get_nowait()
                except Exception:
                    pass
                self._outbound_audio_queue.put_nowait((playback_id, chunk, idx == 0))

    async def _audio_streaming_loop(self) -> None:
        """
        Dedicated background worker continuously streaming queued audio packets to Plivo.
        Uses 6-frame RTP jitter pre-buffering and safe 110-125ms pacing to eliminate voice breaks.
        """
        logger.info(f"[Call {self.call_id}] Plivo audio streaming worker loop started.")
        frames_in_burst = 0
        while self.is_running:
            try:
                playback_id, chunk, is_first = await self._outbound_audio_queue.get()
                if not self.is_running or self._playback_counter != playback_id:
                    self._outbound_audio_queue.task_done()
                    continue

                if is_first:
                    frames_in_burst = 0

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
                    frames_in_burst += 1
                    if frames_in_burst == 1 or frames_in_burst % 10 == 0:
                        logger.info(f"▶️ [Call {self.call_id}] Sent playAudio packet #{frames_in_burst} ({len(chunk)} bytes) to Plivo")
                    # Rapid pre-buffer for first 6 frames (960ms) into Plivo's jitter buffer
                    if frames_in_burst <= 6:
                        await asyncio.sleep(0.005)
                    else:
                        q_size = self._outbound_audio_queue.qsize()
                        # 1280 bytes = 160ms of audio
                        # Pacing comfortably ahead of 160ms playback prevents Plivo buffer underruns
                        if q_size > 4:
                            pace_delay = 0.080
                        elif q_size > 1:
                            pace_delay = 0.110
                        else:
                            pace_delay = 0.125
                        await asyncio.sleep(pace_delay)
                except Exception as e:
                    logger.warning(f"Error streaming audio to Plivo: {e}")
                finally:
                    self._outbound_audio_queue.task_done()
                    if self._outbound_audio_queue.empty():
                        frames_in_burst = 0
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Error in Plivo audio streaming loop: {e}")
                await asyncio.sleep(0.05)

    async def _send_clear_to_plivo(self) -> None:
        """
        Send Plivo clearAudio event to flush currently playing audio queue.
        Provides zero-latency barge-in interruption.
        """
        self._playback_counter += 1
        self._assistant_playback_end_time = 0.0

        # Drain and clear pending outbound frames
        while not self._outbound_audio_queue.empty():
            try:
                self._outbound_audio_queue.get_nowait()
                self._outbound_audio_queue.task_done()
            except (asyncio.QueueEmpty, ValueError):
                break

        if not self.ws:
            return

        clear_msg = {
            "event": "clearAudio",
            "streamId": self.stream_id
        }
        try:
            await self.ws.send_text(json.dumps(clear_msg))
            logger.info(f"Plivo audio queue cleared for stream {self.stream_id} (barge-in)")
        except Exception as e:
            logger.warning(f"Error sending clearAudio to Plivo: {e}")

    async def _duration_watchdog(self) -> None:
        """
        Runtime watchdog enforcing call duration limits (5 minutes default cap, or wallet balance limit).
        Plays a polite 30-second warning, gives a final 5-minute reminder, and gracefully disconnects call via Plivo API.
        """
        try:
            while self.is_running:
                await asyncio.sleep(2)
                if not self.call_start_time or not self.is_running:
                    continue

                elapsed = time.time() - self.call_start_time

                # 30-second advance warning before limit (e.g. at 4m 30s for a 5m limit)
                if elapsed >= (self.max_duration_seconds - 30) and not self._warning_sent:
                    self._warning_sent = True
                    title = getattr(self.orchestrator, "caller_title", "") or "సార్"
                    logger.warning(
                        f"[Call {self.call_id}] 5-minute call limit reaching in 30 seconds "
                        f"({elapsed:.1f}s / {self.max_duration_seconds}s)"
                    )
                    if self.orchestrator and self.is_running:
                        warning_msg = (
                            f"{title}, మన కాల్ సమయం మరో 30 సెకన్లలో 5 నిమిషాల పరిమితికి చేరుకుంటుంది."
                            if getattr(self.orchestrator, "language", "te") == "te"
                            else f"Please note, our call will reach the 5-minute limit in 30 seconds."
                        )
                        asyncio.create_task(self._send_warning_notice(warning_msg))

                # Hard cutoff at 5 minutes: play final reminder and cut the call
                if elapsed >= self.max_duration_seconds:
                    logger.info(
                        f"[Call {self.call_id}] 5-minute call duration limit reached "
                        f"({elapsed:.1f}s >= {self.max_duration_seconds}s). Playing final reminder and cutting call..."
                    )
                    if self.orchestrator and self.is_running:
                        title = getattr(self.orchestrator, "caller_title", "") or "సార్"
                        final_msg = (
                            f"{title}, మన కాల్ 5 నిమిషాల సమయం పూర్తయింది. మాట్లాడినందుకు చాలా ధన్యవాదాలు {title}, నమస్కారం!"
                            if getattr(self.orchestrator, "language", "te") == "te"
                            else f"Our 5-minute call limit has been reached. Thank you for your time, have a wonderful day!"
                        )
                        try:
                            await self._send_warning_notice(final_msg)
                            # Wait 3.5 seconds to let audio stream to caller's handset before cutting
                            await asyncio.sleep(3.5)
                        except Exception as fe:
                            logger.warning(f"Error streaming timeout farewell: {fe}")

                    self.is_running = False
                    if self.call_uuid:
                        try:
                            plivo_client.hangup_call(self.call_uuid)
                            logger.info(f"[Call {self.call_id}] Plivo call {self.call_uuid} successfully disconnected at 5 min limit.")
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
                # Append to transcript history and send UI event
                emp_name = self.orchestrator.employee.name if self.orchestrator.employee else "Sara"
                self.orchestrator.transcript_history.append({
                    "speaker": emp_name,
                    "role": "assistant",
                    "text": message_text,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                if self.send_event_callback:
                    try:
                        res = self.send_event_callback({
                            "type": "transcript",
                            "call_id": self.call_id,
                            "speaker": emp_name,
                            "role": "assistant",
                            "text": message_text,
                            "timestamp": time.time()
                        })
                        if asyncio.iscoroutine(res):
                            asyncio.create_task(res)
                    except Exception:
                        pass

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

        if self._audio_streaming_task and not self._audio_streaming_task.done():
            self._audio_streaming_task.cancel()

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
