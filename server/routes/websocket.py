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
    VoiceAgent, AIEmployee, ConversationSession, SessionMessage, ConversationState, LatencyMetric, User,
    Workspace, BusinessProfile
)
from server.engine.conversation_manager import ConversationManager
from server.engine.chunker import SentenceChunker
from server.providers.gemini_llm import GeminiLLM
from server.providers.sarvam_tts import SarvamTTS
from server.providers.sarvam_stt import SarvamSTT

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Voice Stream"])

from server.providers.assemblyai_stt import AssemblyAISTT
from server.providers.deepgram_stt import DeepgramSTT
from server.providers.cartesia_stt import CartesiaSTT

class UnifiedSTT:
    def __init__(self, cartesia: CartesiaSTT, sarvam: SarvamSTT, assemblyai: AssemblyAISTT, deepgram: DeepgramSTT):
        self.cartesia = cartesia
        self.sarvam = sarvam
        self.assemblyai = assemblyai
        self.deepgram = deepgram

    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        primary_stt = getattr(settings, "PRIMARY_STT", "sarvam").lower()

        # 1. Sarvam AI STT (Native Indic/Telugu specialist — highly accurate)
        if (primary_stt == "sarvam" or primary_stt == "cartesia") and getattr(self.sarvam, "api_key", None):
            try:
                res = await self.sarvam.transcribe(audio_bytes, language_hint=language_hint)
                if res.get("transcript"):
                    return res
            except Exception as e:
                logger.warning(f"Sarvam STT notice: {e}")

        # 2. Cartesia Ink STT
        if getattr(self.cartesia, "api_key", None):
            try:
                res = await self.cartesia.transcribe(audio_bytes, language_hint=language_hint)
                if res.get("transcript"):
                    return res
            except Exception as e:
                logger.warning(f"Cartesia STT notice: {e}")

        # 3. AssemblyAI STT
        if self.assemblyai.api_key:
            try:
                res = await self.assemblyai.transcribe(audio_bytes, language_hint=language_hint)
                if res.get("transcript"):
                    return res
            except Exception as e:
                logger.warning(f"AssemblyAI STT notice: {e}")

        # 4. Deepgram STT
        if self.deepgram.api_key:
            try:
                res = await self.deepgram.transcribe(audio_bytes, language_hint=language_hint)
                if res.get("transcript"):
                    return res
            except Exception as e:
                logger.warning(f"Deepgram STT notice: {e}")

        # Final attempt with Cartesia if not already tried
        if getattr(self.cartesia, "api_key", None):
            return await self.cartesia.transcribe(audio_bytes, language_hint=language_hint)

        return {"transcript": "", "detected_language": "te", "confidence": 0.0, "latency_ms": 0.0}

stt_provider = UnifiedSTT(CartesiaSTT(), SarvamSTT(), AssemblyAISTT(), DeepgramSTT())
llm_provider = GeminiLLM()
from server.providers.cartesia_tts import CartesiaTTS
from server.providers.edge_tts_provider import EdgeTTSProvider

cartesia_tts = CartesiaTTS()
sarvam_tts = SarvamTTS()
edge_tts_provider = EdgeTTSProvider()

class UnifiedTTS:
    def __init__(self, cartesia: CartesiaTTS, sarvam: SarvamTTS, edge: EdgeTTSProvider):
        self.cartesia = cartesia
        self.sarvam = sarvam
        self.edge = edge

    async def synthesize_speech(self, text: str, voice_id: str, language: str = "te", output_mode: str = "browser") -> Dict[str, Any]:
        target_voice = voice_id or getattr(settings, "CARTESIA_PRIMARY_VOICE_ID", "07bc462a-c644-49f1-baf7-82d5599131be")
        target_lang = get_synth_lang(text) if (not language or language == "en") else language

        # 1. Primary: Cartesia TTS (voice 07bc462a-c644-49f1-baf7-82d5599131be)
        try:
            res = await self.cartesia.synthesize_speech(text=text, voice_id=target_voice, language=target_lang, output_mode=output_mode)
            if res.get("audio_bytes"):
                return res
        except Exception as e:
            logger.warning(f"Cartesia TTS notice: {e}")

        # 2. Secondary fallback: Sarvam AI bulbul:v3
        try:
            res = await self.sarvam.synthesize_speech(text=text, voice_id="sarvam-te-kavitha", language=target_lang)
            if res.get("audio_bytes"):
                return res
        except Exception as e:
            logger.warning(f"Sarvam TTS notice: {e}")

        # 3. Edge Neural TTS Fallback
        return await self.edge.synthesize_speech(text=text, voice_id=target_voice, language=target_lang)

tts_provider = UnifiedTTS(cartesia_tts, sarvam_tts, edge_tts_provider)
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
    user_id: Optional[str] = Query(None)
):
    await websocket.accept()
    db: Session = SessionLocal()
    session_record: Optional[ConversationSession] = None
    conv_state: Optional[ConversationState] = None
    manager: Optional[ConversationManager] = None

    try:
        # 1. Fetch Employee / Agent configuration
        ai_emp = None
        if agent_id and agent_id != "agent_sara_default":
            ai_emp = db.query(AIEmployee).filter(AIEmployee.id == agent_id).first()
        if not ai_emp:
            ai_emp = db.query(AIEmployee).filter(AIEmployee.name.ilike("%sara%")).first() or db.query(AIEmployee).first()

        agent = None
        if agent_id and agent_id != "agent_sara_default":
            agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id).first()
        if not agent:
            agent = db.query(VoiceAgent).first()

        emp_name = ai_emp.name if ai_emp else (agent.name if agent else "SARA")
        active_voice_id = getattr(ai_emp, 'voice_id', None) or getattr(agent, 'voice_id', None) or getattr(settings, 'CARTESIA_PRIMARY_VOICE_ID', '07bc462a-c644-49f1-baf7-82d5599131be')

        # Fetch dynamic business context
        biz_name = "మా సంస్థ"
        biz_summary = ""
        try:
            ws = db.query(Workspace).first()
            if ws:
                if ws.name:
                    biz_name = ws.name
                if ws.settings and isinstance(ws.settings, dict):
                    bp_data = ws.settings.get("business_profile") or {}
                    if bp_data.get("business_name"):
                        biz_name = bp_data["business_name"]
                    prods = bp_data.get("products_services") or []
                    prod_str = ", ".join([f"{p.get('name')} (ధర: {p.get('price')})" for p in prods if isinstance(p, dict)])
                    biz_summary = f"Business: {biz_name}. Type: {bp_data.get('business_type', '')}. Products/Services: {prod_str}."
            bp = db.query(BusinessProfile).first()
            if bp and bp.business_name:
                biz_name = bp.business_name
        except Exception:
            pass

        # 2. Compile system prompt following user prompt rules
        system_prompt = f"""# SARA AI — TELUGU VOICE AGENT SYSTEM PROMPT

## 1. Identity and Language
You are Sara, a friendly, professional female AI voice assistant for business and real-estate calls representing {biz_name}.
Your primary language is Telugu, with natural Andhra Pradesh and Telangana conversational styles.
- Speak fluent, grammatically correct Telugu.
- Understand Telugu, English, and Telugu-English mixed speech.
- Respond in the same language the customer uses.
- When the customer speaks Telugu, prioritize Telugu in your response.
- Use simple, natural spoken Telugu rather than formal literary Telugu.
- Never generate random, unrelated, or meaningless sentences.

## 2. Accurate Customer Understanding
- Respond only to what the customer actually says.
- Never invent customer responses, preferences, or intentions.
- If the audio is unclear, politely ask: "క్షమించండి, మీరు చెప్పింది సరిగ్గా వినిపించలేదు. దయచేసి ఇంకొకసారి చెప్పగలరా?"
- If no speech is detected, wait briefly and follow the configured no-response policy.
- Do not treat silence or an empty transcript as customer consent.

## 3. Natural Telugu Responses
- Use correct Telugu grammar and natural word order.
- Keep spoken responses short, strictly 1–2 sentences.
- Speak with warmth, silky sweet politeness, and respectful 'అండీ'.
- Preserve English business terms when they sound natural in Telugu conversation.
- Pronounce names, locations, prices, and dates clearly.
- After each question, stop speaking and listen.

## 4. Business & Real-Estate Calls
- Follow the configured business objective for {biz_name}.
- Ask one question at a time.
- Collect customer requirements naturally.
- Use only verified information from the business knowledge base and CRM.
- Never invent prices, offers, property availability, or appointments.
- Confirm important details before taking action.
{biz_summary}"""

        greeting_prompt = "హలో! నమస్కారం. నేను సారా మాట్లాడుతున్నాను. మీరు ఇప్పుడు ఒక నిమిషం మాట్లాడగలరా?"
        faq_list = [{"question": f.question, "answer": f.answer, "category": f.category} for f in getattr(agent, 'faqs', [])] if agent else []

        # 3. Create persistent ConversationSession in DB (safe fallback)
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        try:
            usr = db.query(User).first()
            target_user_id = user_id or (usr.id if usr else "user_default")

            db_agent = db.query(VoiceAgent).first()
            if db_agent:
                session_record = ConversationSession(
                    agent_id=db_agent.id,
                    user_id=target_user_id,
                    active_language="te",
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
            conv_state = None

        # 4. Initialize ConversationManager
        manager = ConversationManager(
            session_id=session_id,
            system_prompt=system_prompt,
            greeting_prompt=greeting_prompt,
            faqs=faq_list,
            voice_id=active_voice_id,
            llm_provider=llm_provider,
            tts_provider=tts_provider,
            stt_provider=stt_provider,
            initial_language="te"
        )

        # Notify frontend that session has started
        await websocket.send_json({
            "type": "session.started",
            "session_id": session_record.id if session_record else session_id,
            "agent_name": emp_name,
            "greeting": greeting_prompt,
            "voice_id": active_voice_id,
            "stage": manager.stage
        })

        # Synthesize and send initial greeting with sweet voice
        greeting_audio = await synthesize_speech(
            text=greeting_prompt,
            voice_id=active_voice_id,
            language=get_synth_lang(greeting_prompt)
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
            if session_record:
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
                        voice_to_use = agent.voice_id or settings.DEFAULT_VOICE_ID or "sarvam-te-kavitha"
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
                        voice_to_use = agent.voice_id or settings.DEFAULT_VOICE_ID or "sarvam-te-kavitha"
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

                hint = manager.active_language or getattr(agent, "voice_language", None) or "te"
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
            if session_record:
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
            active_voice_id = getattr(ai_emp, 'voice_id', None) or getattr(agent, 'voice_id', None) or manager.voice_id or getattr(settings, 'CARTESIA_PRIMARY_VOICE_ID', '07bc462a-c644-49f1-baf7-82d5599131be')

            # Low-Latency Streaming LLM -> Sentence Chunker -> TTS
            await websocket.send_json({"type": "llm.started"})
            # Phrase chunker configured for rapid TTFA without fragmentation
            chunker = SentenceChunker(min_chunk_words=4, max_chunk_words=12)

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

            phrase_queue: asyncio.Queue = asyncio.Queue()

            async def _ws_tts_worker():
                nonlocal first_audio_sent, first_audio_time, tts_first_audio_ms
                while True:
                    phrase_item = await phrase_queue.get()
                    if phrase_item is None:
                        phrase_queue.task_done()
                        break
                    if manager.is_interrupted:
                        phrase_queue.task_done()
                        break

                    phrase_item = normalize_numbers_to_english(phrase_item)
                    target_synth_lang = get_synth_lang(phrase_item)
                    tts_start = time.perf_counter()
                    try:
                        tts_res = await synthesize_speech(
                            text=phrase_item,
                            voice_id=active_voice_id,
                            language=target_synth_lang
                        )
                        tts_dur = (time.perf_counter() - tts_start) * 1000

                        if tts_res.get("audio_bytes") and not manager.is_interrupted:
                            if not first_audio_sent:
                                first_audio_sent = True
                                first_audio_time = time.perf_counter()
                                tts_first_audio_ms = tts_dur

                            b64_audio = base64.b64encode(tts_res["audio_bytes"]).decode("utf-8")
                            await websocket.send_json({
                                "type": "tts.audio",
                                "audio": b64_audio,
                                "text": phrase_item,
                                "chunk_latency_ms": round(tts_dur, 2)
                            })
                    except Exception as err:
                        logger.warning(f"Error synthesizing websocket phrase: {err}")
                    finally:
                        phrase_queue.task_done()

            tts_task = asyncio.create_task(_ws_tts_worker())

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
                        await phrase_queue.put(phrase)

            # Flush any remaining tokens in chunker
            if not manager.is_interrupted:
                remaining_phrases = chunker.flush()
                for phrase in remaining_phrases:
                    await phrase_queue.put(phrase)

            # Signal worker to finalize and await completion
            await phrase_queue.put(None)
            if tts_task:
                try:
                    await tts_task
                except asyncio.CancelledError:
                    pass

            complete_agent_reply = normalize_numbers_to_english("".join(full_response_text).strip())
            manager.messages.append({"role": "assistant", "content": complete_agent_reply})

            # Calculate precise turn metrics
            turn_end_time = time.perf_counter()
            total_response_ms = (turn_end_time - turn_start_time) * 1000
            time_to_first_audio_ms = (first_audio_time - turn_start_time) * 1000 if first_audio_time else total_response_ms

            # Save Latency Metric to Neon Database
            if session_record:
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
                if conv_state:
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
