"""
SARA AI — Real-Time Conversation Orchestrator & State Machine
Coordinates Deepgram STT, OpenAI Intelligence, Cartesia Sonic TTS,
Barge-in / Speech Interruption, Tool Execution, and Latency Telemetry.
"""
import asyncio
import base64
import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Callable
from sqlalchemy.orm import Session

from server.config import settings
from server.models import (
    Call, AIEmployee, KnowledgeSource, KnowledgeDocument, Lead,
    ConversationSession, SessionMessage, LatencyMetric, CallEvent,
    Workspace, BusinessProfile
)
from server.engine.chunker import SentenceChunker
from server.engine.normalizer import normalize_numbers_to_english
from server.services.voice.deepgram_service import DeepgramSTTService
from server.services.voice.cartesia_service import CartesiaTTSService
from server.services.voice.openai_voice_service import OpenAIVoiceService
from server.services.voice.audio_codec_service import AudioCodecService
from server.providers.groq_llm import GroqLLM

logger = logging.getLogger("sara.voice.orchestrator")


class ConversationState:
    IDLE = "IDLE"
    LISTENING = "LISTENING"
    TRANSCRIBING = "TRANSCRIBING"
    THINKING = "THINKING"
    TOOL_EXECUTION = "TOOL_EXECUTION"
    SPEAKING = "SPEAKING"
    INTERRUPTED = "INTERRUPTED"
    ESCALATING = "ESCALATING"
    ENDING = "ENDING"
    ENDED = "ENDED"
    ERROR = "ERROR"


class ConversationOrchestrator:
    """
    Core conversational voice engine for a live call or simulation.
    Orchestrates the entire streaming audio and turn pipeline.
    """

    def __init__(
        self,
        call_id: str,
        employee: Optional[AIEmployee] = None,
        db: Optional[Session] = None,
        output_mode: str = "twilio",  # 'twilio' (raw 8kHz mulaw) or 'browser' (24kHz WAV)
        send_audio_callback: Optional[Callable[[bytes, str], Any]] = None,
        flush_audio_callback: Optional[Callable[[], Any]] = None,
        send_event_callback: Optional[Callable[[Dict[str, Any]], Any]] = None,
    ):
        self.call_id = call_id
        self.employee = employee
        self.db = db
        self.output_mode = output_mode

        # Callbacks for streaming output back to WebSocket
        self.send_audio_callback = send_audio_callback
        self.flush_audio_callback = flush_audio_callback
        self.send_event_callback = send_event_callback

        # Conversation State
        self.state = ConversationState.IDLE
        self.is_active = True
        self.messages: List[Dict[str, str]] = []
        self.transcript_history: List[Dict[str, Any]] = []

        # Turn & Deduplication
        self.turn_index = 0
        self.last_user_text = ""
        self.last_user_time = 0.0

        # Services
        self.voice_id = employee.voice_id if employee and employee.voice_id else settings.DEFAULT_VOICE_ID or "330c4fa0-1da3-4c55-8e97-951bfd724e20"
        self.language = employee.voice_language if employee and employee.voice_language else "en"
        self.speed = employee.voice_speed if employee and employee.voice_speed else 1.0

        self.cartesia_service = CartesiaTTSService(default_voice_id=self.voice_id)
        self.openai_service = OpenAIVoiceService()
        self.fallback_groq = GroqLLM()

        self.active_turn_task: Optional[asyncio.Task] = None
        self.speaking_start_time: float = 0.0
        self.is_speaking: bool = False
        self.use_groq_primary: bool = (getattr(settings, "PRIMARY_LLM", "groq").lower() == "groq")
        self._system_prompt = self._compile_system_prompt()

    def get_initial_greeting(self) -> str:
        """Construct warm, respectful, business-tailored initial greeting."""
        emp_name = self.employee.name if self.employee else "Sara"
        lang = (self.language or "te").lower()
        biz_name = "మా సంస్థ"

        if self.db and self.employee:
            try:
                ws = self.db.query(Workspace).filter(Workspace.id == self.employee.workspace_id).first()
                if ws and ws.name:
                    biz_name = ws.name
                bp = self.db.query(BusinessProfile).filter(BusinessProfile.user_id == self.employee.workspace_id).first()
                if bp and bp.business_name:
                    biz_name = bp.business_name
            except Exception:
                pass

        if lang in ["te", "telugu"]:
            return f"నమస్కారం అండి! నేను {biz_name} నుంచి {emp_name} మాట్లాడుతున్నాను. మీకు ఎలా సహాయం చేయగలను అండి?"
        elif lang in ["hi", "hindi"]:
            return f"नमस्ते जी! मैं {biz_name} से {emp_name} बात कर रही हूँ। मैं आपकी क्या सहायता कर सकती हूँ?"
        else:
            return f"Hello! This is {emp_name} from {biz_name}. How can I assist you today?"

    def set_state(self, new_state: str) -> None:
        """Explicit state transition with event logging."""
        prev = self.state
        self.state = new_state
        logger.debug(f"[Call {self.call_id}] State: {prev} -> {new_state}")
        if self.send_event_callback:
            try:
                res = self.send_event_callback({
                    "type": "state_change",
                    "previous_state": prev,
                    "state": new_state,
                    "timestamp": time.time()
                })
                if asyncio.iscoroutine(res):
                    asyncio.create_task(res)
            except Exception:
                pass

    def _compile_system_prompt(self) -> str:
        """Compile layered system prompt with dynamic business context and sweet, polite conversational guidelines."""
        emp_name = self.employee.name if self.employee else "Sara"
        role = self.employee.role if self.employee else "Customer Advisor"
        dept = self.employee.department if self.employee else "Support & Sales"
        mission = self.employee.mission if self.employee else "Assist customers with care, introduce business services, and answer questions."

        # Fetch verified business profile & knowledge
        biz_name = "మా సంస్థ (Our Business)"
        biz_desc = ""
        biz_industry = ""
        knowledge_context = ""

        if self.db and self.employee:
            try:
                # 1. Fetch Workspace
                ws = self.db.query(Workspace).filter(Workspace.id == self.employee.workspace_id).first()
                if ws and ws.name:
                    biz_name = ws.name
                    if ws.settings and isinstance(ws.settings, dict):
                        bp_data = ws.settings.get("business_profile") or {}
                        biz_desc = bp_data.get("description", "")
                        biz_industry = bp_data.get("industry", "")

                # 2. Fetch BusinessProfile table if present
                bp = self.db.query(BusinessProfile).filter(BusinessProfile.user_id == self.employee.workspace_id).first()
                if bp:
                    biz_name = bp.business_name or biz_name
                    biz_desc = bp.description or biz_desc
                    biz_industry = bp.industry or biz_industry

                # 3. Fetch Knowledge Documents
                docs = self.db.query(KnowledgeDocument).filter(
                    KnowledgeDocument.workspace_id == self.employee.workspace_id
                ).limit(5).all()
                if docs:
                    knowledge_snippets = [f"- {d.title}: {d.content[:300]}" for d in docs if d.content]
                    knowledge_context = "\nVERIFIED BUSINESS FACTS:\n" + "\n".join(knowledge_snippets)
            except Exception:
                pass

        base_prompt = f"""You are {emp_name}, representing {biz_name} ({biz_industry or 'Enterprise'}) as a {role} in the {dept} team.
Your mission: {mission}
{f"Business Overview: {biz_desc}" if biz_desc else ""}

SWEET & RESPECTFUL CONVERSATIONAL TONE (VERY IMPORTANT):
1. **Sweet, Polite & Warm**: Speak with genuine kindness, warmth, and respectful affection (మర్యాదగా, వినయంగా, తియ్యగా మాట్లాడండి).
2. **Telugu & Indic Honorifics**:
   - Always address the customer with high respect: "నమస్కారం అండి" (Namaskaram andi), "అండి" (andi), "చెప్పండి అండి", "ఖచ్చితంగా అండి", "తప్పకుండా అండి", "ధన్యవాదాలు అండి".
   - Never be blunt, cold, or mechanical. Make the customer feel truly welcomed and valued.
3. **Language Matching**:
   - If the customer speaks Telugu, reply natively in sweet, natural conversational Telugu blended with common English words.
   - If they speak English or Telugu-English mix, match their language seamlessly.
4. **Tailored to {biz_name}**:
   - Talk strictly about {biz_name}'s specific products, services, offerings, and policies.
   - NEVER assume an unrelated industry or invent facts outside the business context.
5. **Concise & Turn-Based**:
   - Keep each turn to 1-3 crisp, pleasant sentences so the customer can converse naturally without long monologues.
6. **Actions & Tools**:
   - If customer shares details or requests a callback: use `create_lead`.
   - If customer wants an appointment or demo: use `schedule_appointment`.
   - If customer asks for a human supervisor: politely use `transfer_to_human`.
   - When concluding, warmly thank the customer and use `end_call`.

{knowledge_context}
"""
        return base_prompt

    async def handle_barge_in(self) -> None:
        """
        Executed when Deepgram STT detects speech activity.
        Stops current speaking turn ONLY IF assistant is actively SPEAKING
        and has passed the minimum duration grace period.
        """
        now = time.perf_counter()

        # 1. Never interrupt during THINKING, TOOL_EXECUTION, or IDLE
        if self.state != ConversationState.SPEAKING or not self.is_speaking:
            logger.debug(f"[Call {self.call_id}] Barge-in ignored: state is {self.state} (not actively SPEAKING)")
            return

        # 2. Prevent self-interruption from speaker echo, carrier noise, or initial speech onset
        speaking_duration = now - self.speaking_start_time
        min_speaking_duration = 0.9  # Must have spoken for at least 900ms
        if speaking_duration < min_speaking_duration:
            logger.debug(f"[Call {self.call_id}] Barge-in ignored: speaking duration {speaking_duration:.2f}s < {min_speaking_duration}s grace period")
            return

        logger.info(f"[Call {self.call_id}] Barge-in confirmed (spoken {speaking_duration:.2f}s) -> interrupting assistant turn")
        self.set_state(ConversationState.INTERRUPTED)
        self.is_speaking = False

        # Cancel active turn task
        if self.active_turn_task and not self.active_turn_task.done():
            self.active_turn_task.cancel()

        # Cancel TTS synthesis
        self.cartesia_service.cancel()
        self.openai_service.cancel()

        # Flush buffered audio in carrier queue
        if self.flush_audio_callback:
            try:
                res = self.flush_audio_callback()
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.warning(f"[Call {self.call_id}] Error in flush_audio_callback: {e}")

        self.set_state(ConversationState.LISTENING)

    async def handle_user_utterance(self, text: str, confidence: float = 0.95, detected_lang: str = "en") -> None:
        """
        Process completed customer utterance, generate streaming response,
        synthesize TTS chunks, and stream audio to Twilio or browser.
        """
        clean_text = text.strip()
        if not clean_text:
            return

        # Deduplication guard: ignore echo or accidental repeat within 2.5s
        now = time.time()
        if (now - self.last_user_time < 2.5) and (clean_text.lower() == self.last_user_text.lower()):
            logger.debug(f"[Call {self.call_id}] Discarding duplicate utterance: '{clean_text}'")
            return

        self.last_user_text = clean_text
        self.last_user_time = now
        self.turn_index += 1
        turn_start_time = time.perf_counter()

        logger.info(f"[Call {self.call_id}] Customer (Turn {self.turn_index}): {clean_text}")

        # Record customer message
        self.messages.append({"role": "user", "content": clean_text})
        self.transcript_history.append({
            "speaker": "customer",
            "role": "user",
            "text": clean_text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        if self.send_event_callback:
            try:
                res = self.send_event_callback({
                    "type": "transcript",
                    "speaker": "customer",
                    "role": "user",
                    "text": clean_text,
                    "confidence": confidence,
                    "timestamp": time.time()
                })
                if asyncio.iscoroutine(res):
                    await res
            except Exception:
                pass

        # Launch agent turn task
        self.active_turn_task = asyncio.create_task(
            self._execute_agent_turn(clean_text, turn_start_time)
        )

    async def _execute_agent_turn(self, user_text: str, turn_start_time: float) -> None:
        """Execute LLM streaming, phrase chunking, TTS generation, and audio dispatch."""
        self.set_state(ConversationState.THINKING)
        chunker = SentenceChunker(min_chunk_words=4, max_chunk_words=14)

        full_reply_tokens: List[str] = []
        first_token_time: Optional[float] = None
        first_audio_time: Optional[float] = None
        llm_first_token_ms = 0.0
        tts_first_audio_ms = 0.0

        try:
            use_groq = (
                getattr(settings, "PRIMARY_LLM", "groq").lower() == "groq"
                or not self.openai_service.api_key
                or getattr(self, "use_groq_primary", False)
            )

            if use_groq:
                # Ultra-low latency (~150ms) direct streaming via Groq
                async for gchunk in self.fallback_groq.stream_chat(
                    messages=self.messages,
                    system_prompt=self._system_prompt,
                    max_tokens=150
                ):
                    if self.state == ConversationState.INTERRUPTED:
                        break
                    tok = gchunk.get("token", "")
                    if tok:
                        if gchunk.get("first_token"):
                            first_token_time = time.perf_counter()
                            llm_first_token_ms = (first_token_time - turn_start_time) * 1000
                            if self.send_event_callback:
                                try:
                                    res = self.send_event_callback({
                                        "type": "llm_first_token",
                                        "ttft_ms": round(llm_first_token_ms, 2)
                                    })
                                    if asyncio.iscoroutine(res):
                                        await res
                                except Exception:
                                    pass

                        full_reply_tokens.append(tok)
                        phrases = chunker.process_token(tok)
                        for phrase in phrases:
                            if self.state == ConversationState.INTERRUPTED:
                                break
                            await self._synthesize_and_send_chunk(
                                phrase, turn_start_time, first_audio_time is None
                            )
                            if first_audio_time is None:
                                first_audio_time = time.perf_counter()
            else:
                # 1. Stream response tokens from OpenAI
                llm_stream = self.openai_service.stream_conversation_turn(
                    messages=self.messages,
                    system_prompt=self._system_prompt,
                    enable_tools=True
                )

                async for event in llm_stream:
                    if self.state == ConversationState.INTERRUPTED:
                        break

                    ev_type = event.get("type")

                    # Handle text token
                    if ev_type == "token":
                        token = event.get("token", "")
                        if event.get("first_token"):
                            first_token_time = time.perf_counter()
                            llm_first_token_ms = (first_token_time - turn_start_time) * 1000
                            if self.send_event_callback:
                                try:
                                    res = self.send_event_callback({
                                        "type": "llm_first_token",
                                        "ttft_ms": round(llm_first_token_ms, 2)
                                    })
                                    if asyncio.iscoroutine(res):
                                        await res
                                except Exception:
                                    pass

                        full_reply_tokens.append(token)

                        # Sentence boundary detection
                        phrases = chunker.process_token(token)
                        for phrase in phrases:
                            if self.state == ConversationState.INTERRUPTED:
                                break
                            await self._synthesize_and_send_chunk(
                                phrase, turn_start_time, first_audio_time is None
                            )
                            if first_audio_time is None:
                                first_audio_time = time.perf_counter()

                    # Handle Tool Call
                    elif ev_type == "tool_call":
                        self.set_state(ConversationState.TOOL_EXECUTION)
                        tool_name = event.get("name")
                        tool_args = event.get("arguments", {})
                        await self._execute_tool(tool_name, tool_args)

                    # Handle Error / Insufficient Quota
                    elif ev_type == "error":
                        self.use_groq_primary = True
                        logger.warning("Routing turn through ultra-low latency Groq fallback.")
                        async for gchunk in self.fallback_groq.stream_chat(
                            messages=self.messages,
                            system_prompt=self._system_prompt,
                            max_tokens=150
                        ):
                            tok = gchunk.get("token", "")
                            if tok:
                                full_reply_tokens.append(tok)
                                phrases = chunker.process_token(tok)
                                for p in phrases:
                                    await self._synthesize_and_send_chunk(
                                        p, turn_start_time, first_audio_time is None
                                    )
                                    if first_audio_time is None:
                                        first_audio_time = time.perf_counter()

            # Flush any remaining tokens in chunker
            if self.state != ConversationState.INTERRUPTED:
                remaining_phrases = chunker.flush()
                for p in remaining_phrases:
                    await self._synthesize_and_send_chunk(p, turn_start_time, first_audio_time is None)
                    if first_audio_time is None:
                        first_audio_time = time.perf_counter()

            # Fallback if no tokens generated
            if not full_reply_tokens and self.state != ConversationState.INTERRUPTED:
                fallback_msg = "నమస్కారం అండి! నేను వింటున్నాను, చెప్పండి అండి." if self.language in ["te", "telugu"] else "I am here, please tell me."
                full_reply_tokens.append(fallback_msg)
                await self._synthesize_and_send_chunk(fallback_msg, turn_start_time, True)

            # Finalize turn
            complete_text = normalize_numbers_to_english("".join(full_reply_tokens).strip())
            if complete_text:
                self.messages.append({"role": "assistant", "content": complete_text})
                self.transcript_history.append({
                    "speaker": self.employee.name if self.employee else "Sara",
                    "role": "assistant",
                    "text": complete_text,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

                if self.send_event_callback:
                    try:
                        res = self.send_event_callback({
                            "type": "transcript",
                            "speaker": self.employee.name if self.employee else "Sara",
                            "role": "assistant",
                            "text": complete_text,
                            "timestamp": time.time()
                        })
                        if asyncio.iscoroutine(res):
                            await res
                    except Exception:
                        pass

            # Telemetry persistence
            turn_end_time = time.perf_counter()
            total_turn_ms = (turn_end_time - turn_start_time) * 1000
            ttfa_ms = ((first_audio_time - turn_start_time) * 1000) if first_audio_time else total_turn_ms

            logger.info(
                f"[Call {self.call_id}] Turn {self.turn_index} finished: "
                f"TTFT={round(llm_first_token_ms, 1)}ms | TTFA={round(ttfa_ms, 1)}ms | Total={round(total_turn_ms, 1)}ms"
            )

            # Persist LatencyMetric to DB
            if self.db:
                try:
                    metric = LatencyMetric(
                        session_id=self.call_id,
                        turn_index=self.turn_index,
                        llm_first_token_ms=round(llm_first_token_ms, 2),
                        time_to_first_audio_ms=round(ttfa_ms, 2),
                        total_response_ms=round(total_turn_ms, 2)
                    )
                    self.db.add(metric)
                    self.db.commit()
                except Exception as e:
                    self.db.rollback()
                    logger.debug(f"Could not persist LatencyMetric: {e}")

            if self.state not in [ConversationState.ENDING, ConversationState.ENDED]:
                self.is_speaking = False
                self.set_state(ConversationState.LISTENING)

        except asyncio.CancelledError:
            self.is_speaking = False
            logger.info(f"[Call {self.call_id}] Turn task cancelled due to barge-in.")
        except Exception as e:
            self.is_speaking = False
            logger.error(f"[Call {self.call_id}] Error in agent turn: {e}", exc_info=True)
            self.set_state(ConversationState.LISTENING)

    async def _synthesize_and_send_chunk(self, text_chunk: str, turn_start_time: float, is_first: bool) -> None:
        """Synthesize text chunk via Cartesia Sonic and push directly to audio callback."""
        if not text_chunk or not text_chunk.strip() or self.state == ConversationState.INTERRUPTED:
            return

        normalized = normalize_numbers_to_english(text_chunk.strip())
        self.set_state(ConversationState.SPEAKING)
        self.speaking_start_time = time.perf_counter()
        self.is_speaking = True

        synth_res = await self.cartesia_service.synthesize(
            text=normalized,
            voice_id=self.voice_id,
            language=self.language,
            output_mode=self.output_mode,
            speed=self.speed
        )

        audio_bytes = synth_res.get("audio_bytes", b"")
        if audio_bytes and self.send_audio_callback and self.state != ConversationState.INTERRUPTED:
            if asyncio.iscoroutinefunction(self.send_audio_callback):
                await self.send_audio_callback(audio_bytes, normalized)
            else:
                self.send_audio_callback(audio_bytes, normalized)

    async def _execute_tool(self, tool_name: str, args: Dict[str, Any]) -> None:
        """Execute structured business tool inside DB within tenant scope."""
        logger.info(f"[Call {self.call_id}] Executing tool '{tool_name}' with args: {args}")

        if not self.db:
            return

        try:
            ws_id = self.employee.workspace_id if self.employee else "workspace_default_1"

            if tool_name == "create_lead":
                lead = Lead(
                    workspace_id=ws_id,
                    name=args.get("name", "Interested Prospect"),
                    phone=args.get("phone", ""),
                    email=args.get("email", ""),
                    source="AI Voice Call",
                    status="qualified",
                    pipeline_stage="qualified",
                    intent=args.get("interest", "Property Inquiry"),
                    budget=args.get("budget", ""),
                    requirements=[args.get("interest", "")] if args.get("interest") else [],
                    next_action=args.get("notes", "Follow up regarding site visit")
                )
                self.db.add(lead)
                self.db.commit()
                logger.info(f"Lead saved: {lead.name} ({lead.id})")

            elif tool_name == "schedule_appointment":
                # Save meeting / task record
                from server.models import Task
                task = Task(
                    workspace_id=ws_id,
                    title=f"Site Visit: {args.get('customer_name', 'Customer')} ({args.get('date', '')} at {args.get('time', '')})",
                    status="todo",
                    priority="high",
                    notes=f"Appointment Type: {args.get('appointment_type', 'site_visit')}. Notes: {args.get('notes', '')}"
                )
                self.db.add(task)
                self.db.commit()
                logger.info(f"Appointment task saved: {task.title}")

            elif tool_name == "transfer_to_human":
                self.set_state(ConversationState.ESCALATING)
                logger.info(f"Escalating call to human executive. Reason: {args.get('reason')}")

            elif tool_name == "end_call":
                self.set_state(ConversationState.ENDING)
                logger.info(f"End call requested. Reason: {args.get('reason')}")

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error executing tool {tool_name}: {e}")

    async def end_conversation(self) -> Dict[str, Any]:
        """Wrap up conversation, generate AI call summary, and persist final records."""
        self.set_state(ConversationState.ENDED)
        self.is_active = False

        if self.active_turn_task and not self.active_turn_task.done():
            self.active_turn_task.cancel()

        await self.cartesia_service.close()

        # Generate summary
        summary_data = await self.openai_service.generate_call_summary(self.transcript_history)

        # Update Call record if DB is attached
        if self.db:
            try:
                call_record = self.db.query(Call).filter(Call.id == self.call_id).first()
                if call_record:
                    call_record.status = "completed"
                    call_record.summary = summary_data.get("summary", "Call completed.")
                    call_record.sentiment = summary_data.get("sentiment", "Neutral")
                    call_record.transcript = self.transcript_history
                    self.db.commit()
            except Exception as e:
                self.db.rollback()
                logger.warning(f"Could not persist final call summary: {e}")

        return summary_data
