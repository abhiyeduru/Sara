import time
import base64
import json
import asyncio
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from server.config import settings
from server.database import SessionLocal
from server.models import (
    VoiceAgent, ConversationSession, ConversationMessage, ConversationState, LatencyMetric, User
)
from server.engine.conversation_manager import ConversationManager
from server.engine.chunker import SentenceChunker
from server.providers.sarvam_stt import SarvamSTT
from server.providers.openai_llm import OpenAILLM
from server.providers.cartesia_tts import CartesiaTTS

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Voice Stream"])

stt_provider = SarvamSTT()
llm_provider = OpenAILLM()
tts_provider = CartesiaTTS()

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
        agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id).first()
        if not agent:
            # Fallback to any agent or default
            agent = db.query(VoiceAgent).first()

        if not agent:
            await websocket.send_json({"type": "error", "message": "No voice agent configured in database"})
            await websocket.close()
            return

        # 2. Get or generate prompt
        system_prompt = agent.generated_prompt.full_prompt if agent.generated_prompt else "You are SARA, a helpful business voice assistant."
        greeting_prompt = agent.generated_prompt.greeting_prompt if agent.generated_prompt else f"Hi, welcome to {agent.name}. How can I assist you today?"
        faq_list = [{"question": f.question, "answer": f.answer, "category": f.category} for f in agent.faqs]

        # 3. Create persistent ConversationSession in Neon Postgres
        session_record = ConversationSession(
            agent_id=agent.id,
            user_id=agent.user_id,
            active_language=agent.primary_language or "en",
            current_stage="GREETING",
            status="active"
        )
        db.add(session_record)
        db.flush()

        conv_state = ConversationState(
            session_id=session_record.id,
            agent_id=agent.id,
            conversation_stage="GREETING"
        )
        db.add(conv_state)
        db.commit()

        # 4. Initialize ConversationManager
        manager = ConversationManager(
            session_id=session_record.id,
            system_prompt=system_prompt,
            greeting_prompt=greeting_prompt,
            faqs=faq_list,
            voice_id=agent.voice_id,
            llm_provider=llm_provider,
            tts_provider=tts_provider,
            stt_provider=stt_provider
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

        # Select voice based on agent primary language
        greeting_voice = agent.voice_id
        if agent.primary_language == "te":
            greeting_voice = "07bc462a-c644-49f1-baf7-82d5599131be"
        elif agent.primary_language == "hi":
            greeting_voice = "4459a9a5-69d6-4680-b970-e13dc51845b6"

        # Synthesize and send initial greeting
        greeting_audio = await tts_provider.synthesize_speech(
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
            msg = ConversationMessage(
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
                    prompt_text = "Are you still there? Please let me know how I can help."
                    try:
                        tts_res = await tts_provider.synthesize_speech(text=prompt_text, voice_id=agent.voice_id)
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
                    closing_text = "Thank you for contacting us. You can reconnect whenever you're ready. Have a great day!"
                    try:
                        tts_res = await tts_provider.synthesize_speech(text=closing_text, voice_id=agent.voice_id)
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

        # 5. Main bidirectional real-time audio/text loop
        while True:
            data = await websocket.receive_text()
            last_activity_time = time.time()
            silence_prompt_sent = False
            payload = json.loads(data)
            msg_type = payload.get("type")

            # Handle Barge-In / Interruption
            if msg_type == "user.interrupt":
                manager.interrupt()
                await websocket.send_json({
                    "type": "agent.interrupted",
                    "timestamp": time.time(),
                    "message": "Speech cancelled due to barge-in"
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

                stt_res = await stt_provider.transcribe(audio_bytes, language_hint=manager.active_language)
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
                continue

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
            user_msg = ConversationMessage(
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
            active_voice_id = manager.voice_id
            if detected_lang == "te":
                active_voice_id = "07bc462a-c644-49f1-baf7-82d5599131be"
            elif detected_lang == "hi":
                active_voice_id = "4459a9a5-69d6-4680-b970-e13dc51845b6"
            elif detected_lang == "en":
                active_voice_id = manager.voice_id or "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"

            # Low-Latency Streaming LLM -> Sentence Chunker -> TTS
            await websocket.send_json({"type": "llm.started"})
            # Fast chunking: 2 words minimum yields instant first audio
            chunker = SentenceChunker(min_chunk_words=2, max_chunk_words=10)

            full_response_text = []
            first_token_time = None
            first_audio_sent = False
            first_audio_time = None
            llm_first_token_ms = 0.0
            tts_first_audio_ms = 0.0

            llm_stream = llm_provider.stream_chat(
                messages=manager.messages,
                system_prompt=manager.system_prompt,
                temperature=0.5,
                max_tokens=90
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

                        tts_start = time.perf_counter()
                        tts_res = await tts_provider.synthesize_speech(
                            text=phrase,
                            voice_id=active_voice_id,
                            language=detected_lang
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
                    tts_res = await tts_provider.synthesize_speech(
                        text=phrase,
                        voice_id=active_voice_id,
                        language=detected_lang
                    )
                    if tts_res.get("audio_bytes"):
                        b64_audio = base64.b64encode(tts_res["audio_bytes"]).decode("utf-8")
                        await websocket.send_json({
                            "type": "tts.audio",
                            "audio": b64_audio,
                            "text": phrase,
                            "chunk_latency_ms": round(tts_res.get("latency_ms", 0), 2)
                        })

            complete_agent_reply = "".join(full_response_text).strip()
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
            agent_msg = ConversationMessage(
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

            turn_index += 1

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from session {session_record.id if session_record else 'unknown'}")
        if session_record:
            session_record.status = "completed"
            db.commit()
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
