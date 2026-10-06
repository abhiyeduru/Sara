import time
import base64
import json
import asyncio
import logging
import re
import uuid
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from server.config import settings
from server.database import SessionLocal
from server.models import (
    VoiceAgent, ConversationSession, SessionMessage, ConversationState, LatencyMetric, User,
    Workspace, BusinessProfile
)
from server.engine.conversation_manager import ConversationManager
from server.engine.chunker import SentenceChunker
from server.providers.sarvam_stt import SarvamSTT
from server.providers.openai_llm import OpenAILLM
from server.providers.groq_llm import GroqLLM
from server.providers.cartesia_tts import CartesiaTTS

from server.providers.sarvam_tts import SarvamTTS

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Voice Stream"])

from server.providers.deepgram_stt import DeepgramSTT

class UnifiedSTT:
    def __init__(self, deepgram: DeepgramSTT, sarvam: SarvamSTT):
        self.deepgram = deepgram
        self.sarvam = sarvam

    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        # Deepgram is the Primary STT Provider
        if self.deepgram.api_key:
            try:
                res = await self.deepgram.transcribe(audio_bytes, language_hint=language_hint)
                if res.get("transcript"):
                    return res
            except Exception as e:
                logger.warning(f"Deepgram STT notice: {e}")

        # Fallback if Deepgram encounters network issue
        try:
            res = await self.sarvam.transcribe(audio_bytes, language_hint=language_hint)
            if res.get("transcript") and not res.get("error"):
                return res
        except Exception as e:
            logger.warning(f"Secondary STT notice: {e}")

        return await self.sarvam._fallback_groq(audio_bytes, time.perf_counter(), language_hint=language_hint)

stt_provider = UnifiedSTT(DeepgramSTT(), SarvamSTT())
llm_provider = OpenAILLM() if settings.PRIMARY_LLM == "openai" else GroqLLM()
from server.providers.edge_tts_provider import EdgeTTSProvider

sarvam_tts = SarvamTTS()
cartesia_tts = CartesiaTTS()
edge_tts_provider = EdgeTTSProvider()

class UnifiedTTS:
    def __init__(self, sarvam: SarvamTTS, cartesia: CartesiaTTS, edge: EdgeTTSProvider):
        self.sarvam = sarvam
        self.cartesia = cartesia
        self.edge = edge

    async def synthesize_speech(self, text: str, voice_id: str, language: str = "en") -> Dict[str, Any]:
        try:
            if voice_id and (voice_id.startswith("sarvam-") or "sarvam" in voice_id.lower()):
                res = await self.sarvam.synthesize_speech(text=text, voice_id=voice_id, language=language)
                if res.get("audio_bytes"):
                    return res
            res = await self.cartesia.synthesize_speech(text=text, voice_id=voice_id, language=language)
            if res.get("audio_bytes"):
                return res
        except Exception as e:
            logger.warning(f"Primary TTS notice: {e}")
        return await self.edge.synthesize_speech(text=text, voice_id=voice_id, language=language)

tts_provider = UnifiedTTS(sarvam_tts, cartesia_tts, edge_tts_provider)
synthesize_speech = tts_provider.synthesize_speech


def get_synth_lang(phrase_text: str) -> str:
    """Dynamically determine native TTS language based on actual script content"""
    if re.search(r'[\u0C00-\u0C7F]', phrase_text):
        return "te"
    if re.search(r'[\u0900-\u097F]', phrase_text):
        return "hi"
    return "en"

from server.engine.normalizer import normalize_numbers_to_english


@router.websocket("/ws/voice/{agent_id}")
async def voice_websocket_endpoint(
    websocket: WebSocket,
    agent_id: str,
    user_id: Optional[str] = Query("user_business_owner_1")
):
    await websocket.accept()
    db: Session = SessionLocal()
    session_record: Optional[ConversationSession] = None
    manager: Optional[ConversationManager] = None

    try:
        # 1. Fetch Agent configuration
        agent = None
        if agent_id and agent_id != "agent_sara_default":
            agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id).first()
        if not agent:
            agent = db.query(VoiceAgent).first()


        if not agent:
            # Fallback in-memory SARA agent
            class FallbackAgent:
                id = "agent_sara_default"
                user_id = "user_business_owner_1"
                name = "SARA"
                role_title = "Property Advisor"
                business_type = "Real Estate"
                voice_id = "sarvam-te-pooja"
                voice_name = "Pooja"
                primary_language = "te"
                generated_prompt = None
                faqs = []
            agent = FallbackAgent()

        # Fetch business context dynamically
        biz_name = "మా సంస్థ"
        try:
            ws = db.query(Workspace).first()
            if ws and ws.name:
                biz_name = ws.name
            bp = db.query(BusinessProfile).first()
            if bp and bp.business_name:
                biz_name = bp.business_name
        except Exception:
            pass

        # 2. Get or generate prompt
        system_prompt = agent.generated_prompt.full_prompt if getattr(agent, 'generated_prompt', None) else (
            f"You are SARA, an ultra-intelligent, remarkably sweet, polite, and respectful AI representative for {biz_name}. "
            "You speak natively in conversational Telugu and English with pristine clarity, blending common English terms naturally. "
            "Always maintain a sweet, pleasant, and helpful demeanor. Always address the customer with high respect as అండీ (andi), "
            "using polite phrases like 'నమస్కారం అండి', 'చెప్పండి అండి', 'ఖచ్చితంగా అండి', 'తప్పకుండా చేస్తాను అండి'. "
            f"Speak accurately based on {biz_name}'s offerings and answer their questions gracefully."
        )
        greeting_prompt = agent.generated_prompt.greeting_prompt if getattr(agent, 'generated_prompt', None) else f"నమస్కారం అండీ! నేను సారా. {biz_name} కి స్వాగతం, మీకు ఏ విధంగా సహాయపడగలను?"
        faq_list = [{"question": f.question, "answer": f.answer, "category": f.category} for f in getattr(agent, 'faqs', [])]

        # 3. Create persistent ConversationSession in DB (safe fallback)
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        try:
            # Check user exists
            usr = db.query(User).filter(User.id == agent.user_id).first() if hasattr(agent, 'user_id') else None
            if not usr:
                usr = db.query(User).first()
            target_user_id = usr.id if usr else "user_business_owner_1"

            # Check agent exists in DB before linking FK
            db_agent = db.query(VoiceAgent).filter(VoiceAgent.id == getattr(agent, 'id', None)).first()
            if db_agent:
                session_record = ConversationSession(
                    agent_id=db_agent.id,
                    user_id=target_user_id,
                    active_language=getattr(agent, 'primary_language', 'te') or "te",
                    current_stage="GREETING",
                    status="active"
                )
                db.add(session_record)
                db.flush()

                conv_state = ConversationState(
                    session_id=session_record.id,
                    agent_id=db_agent.id,
                    conversation_stage="GREETING"
                )
                db.add(conv_state)
                db.commit()
                session_id = session_record.id
        except Exception as db_err:
            logger.warning(f"Session record persistence bypassed: {db_err}")
            db.rollback()
            session_record = None

        # 4. Initialize ConversationManager
        manager = ConversationManager(
            session_id=session_id,
            system_prompt=system_prompt,
            greeting_prompt=greeting_prompt,
            faqs=faq_list,
            voice_id=getattr(agent, 'voice_id', 'sarvam-te-pooja'),
            llm_provider=llm_provider,
            tts_provider=tts_provider,
            stt_provider=stt_provider,
            initial_language=getattr(agent, 'primary_language', 'te') or "te"
        )

        # Notify frontend that session has started
        await websocket.send_json({
            "type": "session.started",
            "session_id": session_record.id,
            "agent_name": agent.name,
            "greeting": greeting_prompt,
            "voice_id": agent.voice_id,
            "stage": manager.stage
        })

        # Select voice based on agent configuration
        greeting_voice = agent.voice_id or settings.DEFAULT_VOICE_ID or "330c4fa0-1da3-4c55-8e97-951bfd724e20"
        if agent.primary_language == "hi" and not agent.voice_id:
            greeting_voice = "4459a9a5-69d6-4680-b970-e13dc51845b6"

        # Synthesize and send initial greeting
        greeting_audio = await synthesize_speech(
            text=greeting_prompt,
            voice_id=greeting_voice,
            language=agent.primary_language or "en"
        )
        if greeting_audio.get("audio_bytes"):
            b64_audio = base64.b64encode(greeting_audio["audio_bytes"]).decode("utf-8")
            await websocket.send_json({
                "type": "tts.audio",
                "audio": b64_audio,
                "text": greeting_prompt,
                "is_greeting": True,
                "latency_ms": greeting_audio.get("latency_ms", 0)
            })

            # Record greeting message
            msg = SessionMessage(
                session_id=session_record.id,
                role="agent",
                content=greeting_prompt,
                detected_language="en",
                detected_intent="greeting"
            )
            db.add(msg)
            db.commit()

        turn_index = 1
        last_activity_time = time.time()
        silence_prompt_sent = False
        session_active = True

        # Silence monitoring background task
        async def silence_monitor():
            nonlocal silence_prompt_sent, session_active
            while session_active:
                await asyncio.sleep(2.0)
                if not session_active:
                    break
                idle_time = time.time() - last_activity_time
                if idle_time >= settings.MEDIUM_SILENCE_SECONDS and not silence_prompt_sent and manager.stage != "GREETING":
                    silence_prompt_sent = True
                    is_agent_te = agent.primary_language == "te"
                    prompt_text = "మీరు లైన్‌లో ఉన్నారా అండీ? నేను మీకు ఏ విధంగా సహాయపడగలను?" if is_agent_te else "Are you still there? Please let me know how I can help."
                    try:
                        voice_to_use = agent.voice_id or settings.DEFAULT_VOICE_ID or "330c4fa0-1da3-4c55-8e97-951bfd724e20"
                        tts_res = await synthesize_speech(
                            text=prompt_text,
                            voice_id=voice_to_use,
                            language="te" if is_agent_te else (agent.primary_language or "en")
                        )
                        if tts_res.get("audio_bytes"):
                            b64 = base64.b64encode(tts_res["audio_bytes"]).decode("utf-8")
                            await websocket.send_json({
                                "type": "tts.audio",
                                "audio": b64,
                                "text": prompt_text,
                                "is_silence_prompt": True
                            })
                    except Exception as err:
                        logger.warning(f"Silence prompt notice: {err}")

                elif idle_time >= settings.LONG_SILENCE_SECONDS and session_active:
                    is_agent_te = agent.primary_language == "te"
                    closing_text = "మమ్మల్ని సంప్రదించినందుకు ధన్యవాదాలు అండీ. మీకు ఎప్పుడు కావాలన్నా మళ్ళీ మాట్లాడవచ్చు. సెలవు!" if is_agent_te else "Thank you for contacting us. You can reconnect whenever you're ready. Have a great day!"
                    try:
                        voice_to_use = agent.voice_id or settings.DEFAULT_VOICE_ID or "330c4fa0-1da3-4c55-8e97-951bfd724e20"
                        tts_res = await synthesize_speech(
                            text=closing_text,
                            voice_id=voice_to_use,
                            language="te" if is_agent_te else (agent.primary_language or "en")
                        )
                        if tts_res.get("audio_bytes"):
                            b64 = base64.b64encode(tts_res["audio_bytes"]).decode("utf-8")
                            await websocket.send_json({
                                "type": "tts.audio",
                                "audio": b64,
                                "text": closing_text,
                                "is_silence_closing": True
                            })
                        await websocket.send_json({
                            "type": "session.ended",
                            "reason": "silence_timeout"
                        })
                    except Exception:
                        pass
                    break

        silence_task = asyncio.create_task(silence_monitor())

        last_processed_user_text = ""
        last_processed_user_time = 0.0

        # 5. Main bidirectional real-time audio/text loop
        while True:
            data = await websocket.receive_text()
            last_activity_time = time.time()
            silence_prompt_sent = False
            payload = json.loads(data)
            msg_type = payload.get("type")

            # Handle Explicit User Stop / End Call
            if msg_type in ["session.end", "call.end", "user.stop"]:
                manager.interrupt()
                session_active = False
                if 'silence_task' in locals() and not silence_task.done():
                    silence_task.cancel()
                await websocket.send_json({
                    "type": "session.ended",
                    "reason": "user_stopped"
                })
                break

            # Handle Barge-In / Interruption
            if msg_type == "user.interrupt":
                manager.interrupt()
                await websocket.send_json({
                    "type": "agent.interrupted",
                    "timestamp": time.time(),
                    "message": "Speech cancelled due to barge-in"
                })
                continue

            # Handle Dynamic Voice / Configuration Change
            if msg_type in ["voice.change", "config.update"]:
                new_voice = payload.get("voice_id")
                if new_voice:
                    manager.voice_id = new_voice
                    agent.voice_id = new_voice
                new_lang = payload.get("language")
                if new_lang:
                    manager.active_language = new_lang
                await websocket.send_json({
                    "type": "config.updated",
                    "voice_id": manager.voice_id,
                    "language": manager.active_language
                })
                continue

            user_text = ""
            stt_latency = 0.0
            turn_start_time = time.perf_counter()

            # Handle Audio Chunk (Microphone)
            if msg_type == "audio.input":
                audio_b64 = payload.get("audio", "")
                if not audio_b64:
                    continue

                audio_bytes = base64.b64decode(audio_b64)
                await websocket.send_json({"type": "stt.started"})

                hint = manager.active_language or agent.primary_language or "en"
                stt_res = await stt_provider.transcribe(audio_bytes, language_hint=hint)
                user_text = stt_res.get("transcript", "").strip()
                stt_latency = stt_res.get("latency_ms", 0.0)


                await websocket.send_json({
                    "type": "stt.final",
                    "transcript": user_text,
                    "detected_language": stt_res.get("detected_language", "en"),
                    "latency_ms": stt_latency
                })

            # Handle Direct Text (Testing / Fallback / Subtitle sync)
            elif msg_type == "text.input":
                user_text = payload.get("text", "").strip()
                stt_latency = 0.0

            if not user_text:
                await websocket.send_json({
                    "type": "stt.empty",
                    "message": "No speech detected"
                })
                continue

            # Strict Turn Deduplication Guard (Prevents dual-pipeline duplicate triggers)
            now_ts = time.time()
            clean_curr = user_text.strip().lower()
            clean_prev = last_processed_user_text.strip().lower()
            if (now_ts - last_processed_user_time < 3.0) and clean_prev:
                if (clean_curr == clean_prev or
                    (len(clean_curr) > 3 and clean_curr in clean_prev) or
                    (len(clean_prev) > 3 and clean_prev in clean_curr)):
                    logger.info(f"Discarding duplicate user utterance within debounce window: '{user_text}' (matches '{last_processed_user_text}')")
                    continue

            last_processed_user_text = user_text
            last_processed_user_time = now_ts

            manager.is_interrupted = False

            # Detect Language & Code-Switching
            detected_lang = manager.detect_language(user_text)
            manager.active_language = detected_lang

            # Detect Intent & Extract Slots
            detected_intent = manager.detect_intent(user_text)
            manager.current_intent = detected_intent
            manager.extract_slots(user_text)
            manager.advance_stage(detected_intent)

            await websocket.send_json({
                "type": "conversation.state",
                "language": detected_lang,
                "intent": detected_intent,
                "stage": manager.stage,
                "collected_fields": manager.collected_fields,
                "escalation_required": manager.escalation_required
            })

            # Save User Message to Database
            user_msg = SessionMessage(
                session_id=session_record.id,
                role="user",
                content=user_text,
                detected_language=detected_lang,
                detected_intent=detected_intent
            )
            db.add(user_msg)
            db.commit()

            # Add to conversation history for LLM
            manager.messages.append({"role": "user", "content": user_text})

            # Select native neural voice based on language
            active_voice_id = agent.voice_id or manager.voice_id or settings.DEFAULT_VOICE_ID or "330c4fa0-1da3-4c55-8e97-951bfd724e20"
            if detected_lang == "hi" and not agent.voice_id:
                active_voice_id = "4459a9a5-69d6-4680-b970-e13dc51845b6"

            # Low-Latency Streaming LLM -> Sentence Chunker -> TTS
            await websocket.send_json({"type": "llm.started"})
            # Ultra-low latency streaming chunker (min 2 words for rapid Time-To-First-Audio)
            chunker = SentenceChunker(min_chunk_words=2, max_chunk_words=12)

            full_response_text = []
            first_token_time = None
            first_audio_sent = False
            first_audio_time = None
            llm_first_token_ms = 0.0
            tts_first_audio_ms = 0.0

            llm_stream = llm_provider.stream_chat(
                messages=manager.messages,
                system_prompt=manager.system_prompt,
                temperature=0.4,
                max_tokens=250
            )

            async for chunk in llm_stream:
                if manager.is_interrupted:
                    logger.info("Turn interrupted mid-LLM stream")
                    break

                token = chunk.get("token", "")
                if chunk.get("first_token"):
                    first_token_time = time.perf_counter()
                    llm_first_token_ms = chunk.get("ttft_ms", (first_token_time - turn_start_time) * 1000)
                    await websocket.send_json({
                        "type": "llm.first_token",
                        "ttft_ms": round(llm_first_token_ms, 2)
                    })

                if token:
                    full_response_text.append(token)
                    await websocket.send_json({"type": "llm.token", "token": token})

                    # Feed into phrase chunker
                    ready_phrases = chunker.process_token(token)
                    for phrase in ready_phrases:
                        if manager.is_interrupted:
                            break

                        # Ensure all numerals and currency units are in English
                        phrase = normalize_numbers_to_english(phrase)
                        target_synth_lang = get_synth_lang(phrase)
                        tts_start = time.perf_counter()
                        tts_res = await synthesize_speech(
                            text=phrase,
                            voice_id=active_voice_id,
                            language=target_synth_lang
                        )
                        tts_dur = (time.perf_counter() - tts_start) * 1000

                        if tts_res.get("audio_bytes"):
                            if not first_audio_sent:
                                first_audio_sent = True
                                first_audio_time = time.perf_counter()
                                tts_first_audio_ms = tts_dur

                            b64_audio = base64.b64encode(tts_res["audio_bytes"]).decode("utf-8")
                            await websocket.send_json({
                                "type": "tts.audio",
                                "audio": b64_audio,
                                "text": phrase,
                                "chunk_latency_ms": round(tts_dur, 2)
                            })

            # Flush any remaining tokens in chunker
            if not manager.is_interrupted:
                remaining_phrases = chunker.flush()
                for phrase in remaining_phrases:
                    phrase = normalize_numbers_to_english(phrase)
                    target_synth_lang = get_synth_lang(phrase)
                    tts_res = await synthesize_speech(
                        text=phrase,
                        voice_id=active_voice_id,
                        language=target_synth_lang
                    )
                    if tts_res.get("audio_bytes"):
                        b64_audio = base64.b64encode(tts_res["audio_bytes"]).decode("utf-8")
                        await websocket.send_json({
                            "type": "tts.audio",
                            "audio": b64_audio,
                            "text": phrase,
                            "chunk_latency_ms": round(tts_res.get("latency_ms", 0), 2)
                        })

            complete_agent_reply = normalize_numbers_to_english("".join(full_response_text).strip())
            manager.messages.append({"role": "assistant", "content": complete_agent_reply})

            # Calculate precise turn metrics
            turn_end_time = time.perf_counter()
            total_response_ms = (turn_end_time - turn_start_time) * 1000
            time_to_first_audio_ms = (first_audio_time - turn_start_time) * 1000 if first_audio_time else total_response_ms

            # Save Latency Metric to Neon Database
            metric = LatencyMetric(
                session_id=session_record.id,
                turn_index=turn_index,
                stt_ms=round(stt_latency, 2),
                llm_first_token_ms=round(llm_first_token_ms, 2),
                llm_total_ms=round(total_response_ms - stt_latency, 2),
                tts_first_audio_ms=round(tts_first_audio_ms, 2),
                time_to_first_audio_ms=round(time_to_first_audio_ms, 2),
                total_response_ms=round(total_response_ms, 2)
            )
            db.add(metric)

            # Save Agent Message
            agent_msg = SessionMessage(
                session_id=session_record.id,
                role="agent",
                content=complete_agent_reply,
                detected_language=detected_lang,
                detected_intent=detected_intent
            )
            db.add(agent_msg)

            # Update session state in DB
            conv_state.conversation_stage = manager.stage
            conv_state.current_intent = manager.current_intent
            conv_state.collected_fields = manager.collected_fields
            conv_state.escalation_required = manager.escalation_required
            conv_state.last_user_message = user_text
            conv_state.last_agent_message = complete_agent_reply
            db.commit()

            # Broadcast comprehensive turn metrics to Test Console
            await websocket.send_json({
                "type": "turn.completed",
                "turn_index": turn_index,
                "metrics": {
                    "stt_ms": round(stt_latency, 2),
                    "llm_first_token_ms": round(llm_first_token_ms, 2),
                    "tts_first_audio_ms": round(tts_first_audio_ms, 2),
                    "time_to_first_audio_ms": round(time_to_first_audio_ms, 2),
                    "total_response_ms": round(total_response_ms, 2)
                },
                "stage": manager.stage,
                "language": detected_lang,
                "intent": detected_intent
            })

            # If the user said goodbye, stop, or ended the conversation: conclude and stop immediately
            if detected_intent == "closing" or manager.stage == "CLOSING":
                session_active = False
                if 'silence_task' in locals() and not silence_task.done():
                    silence_task.cancel()
                await websocket.send_json({
                    "type": "session.ended",
                    "reason": "conversation_concluded"
                })
                break

            turn_index += 1

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from session {session_record.id if session_record else 'unknown'}")
        if session_record:
            from datetime import datetime, timezone
            session_record.status = "completed"
            session_record.ended_at = datetime.now(timezone.utc)
            db.commit()

            # Auto-log completed voice call into Saadhyam CRM & update AI Employee
            try:
                from server.services.voice.crm_sync_service import CRMSyncService
                from server.engine.crm_intelligence import analyze_call_transcript

                duration = int((session_record.ended_at - session_record.started_at).total_seconds()) if session_record.started_at else 0
                msgs = db.query(SessionMessage).filter(SessionMessage.session_id == session_record.id).all()
                if msgs:
                    full_lines = []
                    t_history = []
                    for m in msgs:
                        speaker = "Agent" if m.role == "agent" else "Customer"
                        t_history.append({
                            "speaker": speaker,
                            "role": m.role,
                            "text": m.content,
                            "language": m.detected_language or "te",
                        })
                        full_lines.append(f"{speaker}: {m.content}")

                    intel = analyze_call_transcript(
                        transcript_text="\n".join(full_lines),
                        customer_name="Web Voice Caller",
                        agent_name=agent.name if agent else "SARA"
                    )

                    crm_sync_res = CRMSyncService.sync_call_to_crm_and_employee(
                        db=db,
                        call_id=session_record.id,
                        employee_id=agent_id if agent_id != "agent_sara_default" else None,
                        phone_number="Web Audio Client",
                        direction="inbound",
                        duration_seconds=max(duration, 5),
                        transcript_history=t_history,
                        summary_data={
                            "summary": intel.get("call_summary") or f"Web voice session completed ({len(msgs)} turns).",
                            "intent": intel.get("customer_intent", "Voice Consultation"),
                            "sentiment": intel.get("sentiment", "Positive"),
                            "lead_quality": 4,
                            "lead_name": "Web Voice Caller",
                            "budget": intel.get("budget", ""),
                            "timeline": intel.get("timeline", ""),
                            "action_items": [intel.get("next_recommended_action", "Follow-up required")],
                            "extracted_requirements": intel.get("requirements", []),
                        },
                        workspace_id=session_record.user_id,
                    )
                    logger.info(f"Auto-synced voice session {session_record.id} via CRMSyncService: {crm_sync_res}")
            except Exception as crm_err:
                logger.warning(f"Auto CRM call logging skipped: {crm_err}", exc_info=True)
    except Exception as e:
        logger.exception("Error in voice WebSocket session")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        session_active = False
        if 'silence_task' in locals() and not silence_task.done():
            silence_task.cancel()
        db.close()
