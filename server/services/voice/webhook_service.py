"""
SARA AI — Twilio Webhook & Conversational Voice AI Runtime
Handles TwiML generation, real-time speech processing, AI Employee reasoning,
knowledge RAG injection, and conversational loop.
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from twilio.twiml.voice_response import VoiceResponse, Gather

from server.models import Call, AIEmployee, KnowledgeSource, KnowledgeDocument, Lead
from server.config import settings
from server.providers.gemini_llm import GeminiLLM
from .voice_events import voice_events_bus
from .transcript_service import TranscriptService

logger = logging.getLogger("sara.voice.webhook")


class WebhookService:
    @staticmethod
    def generate_initial_twiml(db: Session, call_id: str) -> str:
        """
        Generate initial TwiML for when customer answers the phone.
        Plays personalized AI Employee greeting and begins listening for speech.
        """
        call = db.query(Call).filter(Call.id == call_id).first()
        emp = None
        if call and (call.ai_employee_id or call.employee_id):
            emp = db.query(AIEmployee).filter(
                AIEmployee.id == (call.ai_employee_id or call.employee_id)
            ).first()

        lang = getattr(emp, "voice_language", "te") or "te"
        say_voice = "Polly.Kavitha" if lang in ["te", "telugu"] else ("Polly.Kajal" if lang in ["hi", "hindi"] else "Polly.Kajal")
        say_lang = "te-IN" if lang in ["te", "telugu"] else ("hi-IN" if lang in ["hi", "hindi"] else "en-IN")

        if lang in ["te", "telugu"]:
            greeting = f"నమస్కారం అండీ! నేను {emp.name if emp else 'సారా'}. మీరు ఇప్పుడు మాట్లాడగలరా అండీ?"
        elif lang in ["hi", "hindi"]:
            greeting = f"नमस्ते जी! मैं {emp.name if emp else 'सारा'} बोल रही हूँ। क्या बात करने का सही समय है?"
        else:
            greeting = f"Hello! This is {emp.name if emp else 'Sara'}. Is now a good time to speak?"


        # Record greeting in transcript
        if call:
            call.status = "in-progress"
            call.answered_at = datetime.now(timezone.utc)
            if not call.transcript:
                call.transcript = []
            call.transcript.append({
                "speaker": emp.name if emp else "Sara",
                "role": "assistant",
                "text": greeting,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            db.commit()

        voice_events_bus.publish(call_id, "call.answered", {"timestamp": datetime.now(timezone.utc).isoformat()})
        voice_events_bus.publish(call_id, "ai.responding", {"text": greeting})

        base_url = settings.TWILIO_WEBHOOK_BASE_URL.rstrip("/")
        resp = VoiceResponse()

        # Start recording if configured
        resp.record(
            action=f"{base_url}/api/v1/voice/recording/{call_id}",
            recording_status_callback=f"{base_url}/api/v1/voice/recording/{call_id}",
            play_beep=False,
            max_length=600,
        )

        gather = Gather(
            input="speech",
            action=f"{base_url}/api/v1/voice/process/{call_id}",
            method="POST",
            speech_timeout="auto",
            language=say_lang,
        )
        gather.say(greeting, voice=say_voice, language=say_lang)
        resp.append(gather)

        # Fallback if no speech detected
        silence_prompt = "నమస్కారం అండీ, నేను వింటున్నాను. మీ రిక్వైర్మెంట్ గురించి చెప్పండి." if say_lang == "te-IN" else "I'm listening. Could you please share your requirement?"
        resp.say(silence_prompt, voice=say_voice, language=say_lang)
        resp.redirect(f"{base_url}/api/v1/voice/twiml/{call_id}")

        return str(resp)

    @staticmethod
    async def process_speech_and_respond(
        db: Session,
        call_id: str,
        speech_result: str,
        confidence: Optional[float] = None
    ) -> str:
        """
        Process user speech through the AI Employee runtime (LLM + Knowledge RAG),
        and return the next TwiML with response speech and continued listen loop.
        """
        call = db.query(Call).filter(Call.id == call_id).first()
        base_url = settings.TWILIO_WEBHOOK_BASE_URL.rstrip("/")
        resp = VoiceResponse()

        emp = None
        if call and (call.ai_employee_id or call.employee_id):
            emp = db.query(AIEmployee).filter(
                AIEmployee.id == (call.ai_employee_id or call.employee_id)
            ).first()

        lang = getattr(emp, "voice_language", "te") or "te"
        say_voice = "Polly.Kavitha" if lang in ["te", "telugu"] else ("Polly.Kajal" if lang in ["hi", "hindi"] else "Polly.Kajal")
        say_lang = "te-IN" if lang in ["te", "telugu"] else ("hi-IN" if lang in ["hi", "hindi"] else "en-IN")

        if not speech_result or not speech_result.strip():
            gather = Gather(
                input="speech",
                action=f"{base_url}/api/v1/voice/process/{call_id}",
                method="POST",
                speech_timeout="auto",
                language=say_lang,
            )
            prompt_empty = "నేను ఇంకా వింటున్నాను అండీ. మీకు ఫ్లాట్ లేదా ప్లాట్ కావాలా చెప్తారా?" if say_lang == "te-IN" else "I'm still here. Could you tell me what you're looking for?"
            gather.say(prompt_empty, voice=say_voice, language=say_lang)
            resp.append(gather)
            return str(resp)

        user_text = speech_result.strip()
        voice_events_bus.publish(call_id, "call.speech_received", {"text": user_text, "confidence": confidence})

        emp = None
        if call and (call.ai_employee_id or call.employee_id):
            emp = db.query(AIEmployee).filter(
                AIEmployee.id == (call.ai_employee_id or call.employee_id)
            ).first()

        # Update Call Transcript
        if call:
            current_transcript = list(call.transcript or [])
            current_transcript.append({
                "speaker": "Customer",
                "role": "user",
                "text": user_text,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            call.transcript = current_transcript
            db.commit()

        # Check for immediate conversational wrap-up
        lower_speech = user_text.lower()
        is_closing = any(w in lower_speech for w in [
            "thank you bye", "goodbye", "not interested thanks", "that is all bye",
            "have a good day", "don't call again", "call me tomorrow"
        ])

        voice_events_bus.publish(call_id, "ai.thinking", {"input": user_text})

        # Knowledge RAG context lookup
        rag_context = ""
        try:
            matched_docs = db.query(KnowledgeDocument).filter(
                KnowledgeDocument.content.ilike(f"%{user_text[:20]}%")
            ).limit(2).all()
            if matched_docs:
                rag_context = "\n".join([d.content for d in matched_docs])
        except Exception:
            pass

        # Build prompt for AI Employee
        biz_name = "our business"
        if emp and getattr(emp, "workspace", None):
            biz_name = emp.workspace.name or biz_name
        role = emp.role if emp and emp.role else "Business & Client Advisor"
        system_prompt = (
            f"You are {emp.name if emp else 'Sara'}, {role} representing {biz_name}.\n"
            f"Personality: {emp.personality if emp else 'Professional & Friendly'}.\n"
            f"Communication Style: Short, natural, conversational spoken responses (1 to 2 sentences max). Do not use bullet points or markdown.\n"
            f"Instructions:\n"
            f"1. Acknowledge what the customer said.\n"
            f"2. Answer their question concisely using verified offerings.\n"
            f"3. Ask one clear qualifying follow-up question tailored to understand their requirements or schedule the next step.\n"
        )
        if rag_context:
            system_prompt += f"\nVERIFIED KNOWLEDGE:\n{rag_context}\n"

        # Conversation history formatted
        history_msgs = []
        for msg in (call.transcript or [])[-6:]:
            speaker = msg.get("speaker") or msg.get("role")
            text = msg.get("text")
            history_msgs.append(f"{speaker}: {text}")
        convo_history_str = "\n".join(history_msgs)

        ai_reply = ""
        try:
            llm = GeminiLLM()
            user_prompt = f"Recent conversation:\n{convo_history_str}\n\nCustomer just said: \"{user_text}\"\n\nRespond as {emp.name if emp else 'Sara'}:"
            ai_reply = await llm.generate_response(
                system_prompt=system_prompt,
                user_message=user_prompt,
                max_tokens=120,
                temperature=0.3
            )
            ai_reply = ai_reply.strip().replace('"', '')
        except Exception as e:
            logger.error(f"Error generating AI reply: {e}")
            ai_reply = "Understood. We have prime options available right now. Would you be looking for a 3 BHK or 4 BHK layout?"

        # Save AI reply to transcript
        if call:
            current_transcript = list(call.transcript or [])
            current_transcript.append({
                "speaker": emp.name if emp else "Sara",
                "role": "assistant",
                "text": ai_reply,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            call.transcript = current_transcript
            db.commit()

        voice_events_bus.publish(call_id, "ai.responding", {"text": ai_reply})

        # If conversation is concluding
        if is_closing:
            resp.say(ai_reply, voice=say_voice, language=say_lang)
            closing_msg = "చాలా ధన్యవాదాలు అండీ, మంచి రోజు కావాలని కోరుకుంటున్నాను!" if say_lang == "te-IN" else "Thank you for your time. Have a wonderful day!"
            resp.say(closing_msg, voice=say_voice, language=say_lang)
            resp.hangup()
            return str(resp)

        # Continue conversational loop
        gather = Gather(
            input="speech",
            action=f"{base_url}/api/v1/voice/process/{call_id}",
            method="POST",
            speech_timeout="auto",
            language=say_lang,
        )
        gather.say(ai_reply, voice=say_voice, language=say_lang)
        resp.append(gather)

        # In case customer stays silent
        silence_reprompt = "మీరు లైన్‌లో ఉన్నారా అండీ? సైట్ విజిట్ కోసం సమయం తెలుపగలరా?" if say_lang == "te-IN" else "Are you still there? Please let me know if you'd like to schedule a site tour."
        resp.say(silence_reprompt, voice=say_voice, language=say_lang)
        resp.redirect(f"{base_url}/api/v1/voice/twiml/{call_id}")

        return str(resp)

    @staticmethod
    async def handle_status_callback(
        db: Session,
        call_id: str,
        call_status: str,
        duration: Optional[int] = None,
        call_sid: Optional[str] = None
    ) -> bool:
        """
        Handle Twilio call status updates: initiated, ringing, in-progress, completed, busy, no-answer, failed.
        """
        call = db.query(Call).filter(Call.id == call_id).first()
        if not call:
            logger.warning(f"Status update for unknown call {call_id}: {call_status}")
            return False

        old_status = call.status
        call.status = call_status

        if call_sid and not call.twilio_call_sid:
            call.twilio_call_sid = call_sid

        if call_status == "ringing":
            voice_events_bus.publish(call_id, "call.ringing")
        elif call_status in ["in-progress", "answered"]:
            if not call.answered_at:
                call.answered_at = datetime.now(timezone.utc)
            voice_events_bus.publish(call_id, "call.answered")
        elif call_status in ["completed", "busy", "no-answer", "failed", "canceled"]:
            call.ended_at = datetime.now(timezone.utc)
            if duration:
                call.duration_seconds = duration
            elif call.answered_at:
                call.duration_seconds = int((call.ended_at - call.answered_at).total_seconds())

            voice_events_bus.publish(call_id, f"call.{call_status}", {
                "duration": call.duration_seconds,
            })

            # Run post-call analysis asynchronously
            try:
                await TranscriptService.analyze_and_sync_call(db, call)
            except Exception as e:
                logger.error(f"Error running post-call transcript analysis for call {call_id}: {e}")

        db.commit()
        return True
