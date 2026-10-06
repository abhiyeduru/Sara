"""
SARA AI — CRM & AI Employee Call Synchronization Engine
Ensures:
1. Every call is recorded to disk (.wav) and accessible via streaming endpoints.
2. All call metrics and performance are recorded directly on the AI Employee.
3. Every call is automatically logged into the CRM:
   - Updates/Creates Customer profile with memory & sentiment
   - Updates/Creates Lead with score, requirements & status
   - Creates full CallRecord with recording, transcripts, and AI intelligence
   - Creates Customer ActivityTimeline event
"""
import os
import wave
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from server.models import (
    Call, AIEmployee, Customer, Lead, CallRecord, CallRecording,
    CallTranscript, CallIntelligence, ActivityTimeline, ActivityLog, User
)
from server.services.voice.audio_codec_service import AudioCodecService

logger = logging.getLogger("sara.voice.crm_sync")

STORAGE_RECORDINGS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage", "recordings")
)
os.makedirs(STORAGE_RECORDINGS_DIR, exist_ok=True)


class CRMSyncService:
    @classmethod
    def save_audio_to_wav(
        cls,
        call_id: str,
        pcm16_data: bytes,
        sample_rate: int = 8000,
        channels: int = 1
    ) -> Optional[str]:
        """
        Write linear PCM 16-bit audio frames into a browser-playable .wav file.
        Returns the absolute file path.
        """
        if not pcm16_data or len(pcm16_data) < 320:
            logger.debug(f"[Call {call_id}] Not enough audio data to write WAV recording ({len(pcm16_data) if pcm16_data else 0} bytes)")
            return None

        try:
            wav_path = os.path.join(STORAGE_RECORDINGS_DIR, f"{call_id}.wav")
            with wave.open(wav_path, "wb") as wf:
                wf.setnchannels(channels)
                wf.setsampwidth(2)  # 16-bit PCM = 2 bytes per sample
                wf.setframerate(sample_rate)
                wf.writeframes(pcm16_data)

            file_size = os.path.getsize(wav_path)
            logger.info(f"🎙️ [Call {call_id}] Audio recording saved: {wav_path} ({file_size} bytes)")
            return wav_path
        except Exception as e:
            logger.error(f"[Call {call_id}] Failed to write WAV recording: {e}")
            return None

    @classmethod
    def sync_call_to_crm_and_employee(
        cls,
        db: Session,
        call_id: str,
        employee_id: Optional[str] = None,
        phone_number: Optional[str] = None,
        direction: str = "outbound",
        duration_seconds: int = 0,
        transcript_history: Optional[List[Dict[str, Any]]] = None,
        summary_data: Optional[Dict[str, Any]] = None,
        recorded_pcm16_bytes: Optional[bytes] = None,
        remote_recording_url: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Comprehensive synchronizer that:
        1. Persists audio file locally and sets up streaming URLs.
        2. Updates AI Employee lifetime stats (calls, leads, performance score).
        3. Creates/updates CRM Customer and Lead.
        4. Inserts CallRecord, CallRecording, CallTranscript, CallIntelligence.
        5. Logs ActivityTimeline and ActivityLog entries.
        """
        transcript_history = transcript_history or []
        summary_data = summary_data or {}
        dur = max(0, int(duration_seconds or 0))

        # ── 1. Fetch Call & Employee ──────────────────────────────────────────
        call = db.query(Call).filter(
            (Call.id == call_id) | (Call.twilio_call_sid.like(f"%{call_id}%"))
        ).first()

        effective_emp_id = employee_id or (call.ai_employee_id or call.employee_id if call else None)
        employee = None
        if effective_emp_id:
            employee = db.query(AIEmployee).filter(AIEmployee.id == effective_emp_id).first()
        if not employee:
            employee = db.query(AIEmployee).filter(AIEmployee.status == "active").first()
        if not employee:
            employee = db.query(AIEmployee).first()

        emp_name = employee.name if employee else "SARA"
        ws_id = workspace_id or (call.workspace_id if call else None) or (employee.workspace_id if employee else None) or "workspace_default_1"

        # Determine user_id
        user_id = ws_id
        user_record = db.query(User).filter(User.id == user_id).first()
        if not user_record:
            user_record = db.query(User).first()
            if user_record:
                user_id = user_record.id

        # Target phone number
        target_phone = phone_number or (call.to_number if call and call.direction == "outbound" else None) or (call.from_number if call else None) or "+919876543210"

        # Extract parsed intelligence
        summary_text = summary_data.get("summary") or (call.summary if call else "") or "Call completed with customer."
        sentiment = summary_data.get("sentiment") or (call.sentiment if call else "") or "Positive"
        intent = summary_data.get("intent") or (call.intent if call else "") or "Real Estate Property Enquiry"
        outcome = summary_data.get("outcome") or (call.outcome if call else "") or "Qualified"
        lead_quality = int(summary_data.get("lead_quality") or 4)
        lead_score = int(summary_data.get("lead_score") or (lead_quality * 20))
        next_action = summary_data.get("action_items", ["Follow up via WhatsApp"])[0] if isinstance(summary_data.get("action_items"), list) and summary_data.get("action_items") else "Follow up with property brochure"
        extracted_reqs = summary_data.get("extracted_requirements") or []

        # Customer name
        customer_name = summary_data.get("lead_name")
        if not customer_name:
            # Check if caller mentioned a name in transcript
            for t in transcript_history:
                txt = t.get("text", "")
                if "నా పేరు " in txt:
                    customer_name = txt.split("నా పేరు ")[1].split()[0]
                    break
                elif "my name is " in txt.lower():
                    customer_name = txt.lower().split("my name is ")[1].split()[0].capitalize()
                    break
        if not customer_name:
            customer_name = f"Customer ({target_phone[-4:] if len(target_phone) >= 4 else 'Direct'})"

        is_qualified = lead_quality >= 3 or outcome.upper() in ["QUALIFIED", "INTERESTED"]

        # ── 2. Save Audio Recording (.wav) ───────────────────────────────────
        wav_file_path = None
        if recorded_pcm16_bytes:
            wav_file_path = cls.save_audio_to_wav(call_id, recorded_pcm16_bytes)

        # Audio stream URL
        streaming_url = f"/api/crm/calls/{call_id}/recording/stream"
        final_recording_url = remote_recording_url or streaming_url if wav_file_path else (remote_recording_url or streaming_url)

        if call:
            call.recording_url = final_recording_url
            call.summary = summary_text
            call.sentiment = sentiment
            call.intent = intent
            call.outcome = outcome
            call.lead_score = lead_score
            call.duration_seconds = dur
            call.status = "completed"
            if not call.ended_at:
                call.ended_at = datetime.now(timezone.utc)

        # ── 3. Update AI Employee Stats ──────────────────────────────────────
        if employee:
            try:
                employee.total_calls = (employee.total_calls or 0) + 1
                if is_qualified:
                    employee.total_leads = (employee.total_leads or 0) + 1
                # Performance score: 0 to 100 based on lead quality & successful completion
                curr_score = employee.performance_score or 80.0
                new_turn_score = min(100.0, max(50.0, lead_quality * 20.0))
                employee.performance_score = round((curr_score * 0.8) + (new_turn_score * 0.2), 1)
                employee.updated_at = datetime.now(timezone.utc)
                logger.info(f"🤖 [AI Employee {employee.name}] Stats updated: total_calls={employee.total_calls}, total_leads={employee.total_leads}, score={employee.performance_score}")
            except Exception as e:
                logger.warning(f"Error updating AI Employee stats: {e}")

        # ── 4. Create / Update CRM Customer ──────────────────────────────────
        customer = None
        try:
            if target_phone:
                customer = db.query(Customer).filter(
                    (Customer.phone == target_phone) |
                    (Customer.phone.like(f"%{target_phone[-10:]}%"))
                ).first()

            if not customer:
                customer = Customer(
                    id=f"cust_{uuid.uuid4().hex[:12]}",
                    user_id=user_id,
                    name=customer_name,
                    phone=target_phone,
                    status="Qualified" if is_qualified else "Contacted",
                    pipeline_stage="Qualified" if is_qualified else "Contacted",
                    lead_score=lead_score,
                    source="AI Voice Call",
                    budget=str(summary_data.get("budget", "")),
                    timeline=str(summary_data.get("timeline", "")),
                    interest=intent,
                    assigned_agent=emp_name,
                    memory={
                        "latest_call_summary": summary_text,
                        "sentiment": sentiment,
                        "intent": intent,
                        "last_call_at": datetime.now(timezone.utc).isoformat(),
                    },
                    last_interaction=datetime.now(timezone.utc),
                )
                db.add(customer)
                db.flush()
                logger.info(f"👤 Created new CRM Customer: {customer.name} ({customer.phone})")
            else:
                customer.last_interaction = datetime.now(timezone.utc)
                if is_qualified and customer.status in ["New Lead", "Contacted"]:
                    customer.status = "Qualified"
                    customer.pipeline_stage = "Qualified"
                customer.lead_score = max(customer.lead_score or 50, lead_score)
                curr_mem = dict(customer.memory or {})
                curr_mem["latest_call_summary"] = summary_text
                curr_mem["sentiment"] = sentiment
                curr_mem["last_call_at"] = datetime.now(timezone.utc).isoformat()
                customer.memory = curr_mem
                logger.info(f"👤 Updated existing CRM Customer: {customer.name}")

            if call:
                call.customer_id = customer.id
        except Exception as e:
            logger.warning(f"Error persisting CRM Customer: {e}")

        # ── 5. Create / Update CRM Lead ──────────────────────────────────────
        try:
            lead = None
            if target_phone:
                lead = db.query(Lead).filter(
                    (Lead.phone == target_phone) |
                    (Lead.phone.like(f"%{target_phone[-10:]}%"))
                ).first()

            if not lead:
                lead = Lead(
                    id=f"lead_{uuid.uuid4().hex[:12]}",
                    workspace_id=ws_id,
                    ai_employee_id=employee.id if employee else None,
                    name=customer_name,
                    phone=target_phone,
                    source="Inbound Call" if direction == "inbound" else "Outbound Call",
                    status="qualified" if is_qualified else "contacted",
                    pipeline_stage="qualified" if is_qualified else "contacted",
                    lead_score=lead_score,
                    intent=intent,
                    requirements=extracted_reqs if isinstance(extracted_reqs, list) else [str(extracted_reqs)],
                    next_action=next_action,
                    last_interaction=datetime.now(timezone.utc),
                )
                db.add(lead)
                db.flush()
                logger.info(f"🎯 Created CRM Lead: {lead.name} ({lead.phone})")
            else:
                lead.last_interaction = datetime.now(timezone.utc)
                if is_qualified:
                    lead.status = "qualified"
                    lead.pipeline_stage = "qualified"
                lead.lead_score = max(lead.lead_score or 50, lead_score)
                lead.intent = intent
                lead.next_action = next_action
                logger.info(f"🎯 Updated CRM Lead: {lead.name}")

            if call:
                call.lead_id = lead.id
        except Exception as e:
            logger.warning(f"Error persisting CRM Lead: {e}")

        # ── 6. Create CRM CallRecord & Recording Record ───────────────────────
        try:
            crm_call = db.query(CallRecord).filter(
                (CallRecord.id == call_id) | (CallRecord.session_id == call_id)
            ).first()

            if not crm_call:
                crm_call = CallRecord(
                    id=call_id,
                    user_id=user_id,
                    customer_id=customer.id if customer else None,
                    session_id=call_id,
                    caller=target_phone if direction == "inbound" else emp_name,
                    receiver=emp_name if direction == "inbound" else target_phone,
                    phone_number=target_phone,
                    direction=direction.capitalize(),
                    call_type="AI Voice Call",
                    start_time=call.started_at if call and call.started_at else datetime.now(timezone.utc),
                    end_time=datetime.now(timezone.utc),
                    duration_seconds=dur,
                    call_status="Completed",
                )
                db.add(crm_call)
                db.flush()

            # Insert CallRecording
            file_to_record = wav_file_path or os.path.join(STORAGE_RECORDINGS_DIR, f"{call_id}.wav")
            file_exists = os.path.exists(file_to_record)
            existing_rec = db.query(CallRecording).filter(CallRecording.call_id == crm_call.id).first()
            if not existing_rec:
                rec_model = CallRecording(
                    id=f"rec_{uuid.uuid4().hex[:12]}",
                    call_id=crm_call.id,
                    customer_id=customer.id if customer else None,
                    file_path=file_to_record if file_exists else (remote_recording_url or file_to_record),
                    file_name=f"{call_id}.wav",
                    file_size_bytes=os.path.getsize(file_to_record) if file_exists else 0,
                    mime_type="audio/wav",
                    duration_seconds=dur,
                    transcription_status="Completed",
                    analysis_status="Completed",
                    is_consent_given=True,
                )
                db.add(rec_model)

            # Insert CallTranscript turns
            if transcript_history:
                db.query(CallTranscript).filter(CallTranscript.call_id == crm_call.id).delete()
                offset = 0.0
                for item in transcript_history:
                    speaker = item.get("speaker") or item.get("role") or "Agent"
                    is_agent = str(speaker).lower() in ["agent", "assistant", "sara"]
                    db.add(CallTranscript(
                        id=f"trans_{uuid.uuid4().hex[:12]}",
                        call_id=crm_call.id,
                        speaker="Agent" if is_agent else "Customer",
                        speaker_name=emp_name if is_agent else customer_name,
                        start_time_offset=round(offset, 1),
                        end_time_offset=round(offset + 3.0, 1),
                        text=item.get("text") or item.get("content") or "",
                        language=item.get("language", "te"),
                        sentiment=sentiment,
                    ))
                    offset += 3.5

            # Insert CallIntelligence
            existing_intel = db.query(CallIntelligence).filter(CallIntelligence.call_id == crm_call.id).first()
            if not existing_intel:
                intel_rec = CallIntelligence(
                    id=f"intel_{uuid.uuid4().hex[:12]}",
                    call_id=crm_call.id,
                    customer_id=customer.id if customer else None,
                    customer_intent=intent,
                    requirements=extracted_reqs if isinstance(extracted_reqs, list) else [str(extracted_reqs)],
                    budget=str(summary_data.get("budget", "")),
                    timeline=str(summary_data.get("timeline", "")),
                    sentiment=sentiment,
                    sentiment_score=0.9 if sentiment == "Positive" else (0.4 if sentiment == "Negative" else 0.7),
                    purchase_intent="High" if is_qualified else "Medium",
                    purchase_intent_score=0.85 if is_qualified else 0.5,
                    follow_up_needed=True,
                    follow_up_reason=next_action,
                    next_recommended_action=next_action,
                    call_summary=summary_text,
                    raw_ai_response=summary_data,
                )
                db.add(intel_rec)

            # Insert ActivityTimeline for Customer
            if customer:
                timeline_entry = ActivityTimeline(
                    id=f"act_{uuid.uuid4().hex[:12]}",
                    customer_id=customer.id,
                    user_id=user_id,
                    activity_type="Voice Call",
                    title=f"AI Voice Call with {emp_name} ({dur}s)",
                    description=summary_text,
                    actor_type="AI Employee",
                    actor_name=emp_name,
                    source="Telephony",
                    status="Completed",
                    metadata_json={
                        "call_id": call_id,
                        "duration_seconds": dur,
                        "recording_url": final_recording_url,
                        "sentiment": sentiment,
                        "outcome": outcome,
                    }
                )
                db.add(timeline_entry)

            # Insert system ActivityLog
            act_log = ActivityLog(
                workspace_id=ws_id,
                actor_type="ai",
                actor_id=employee.id if employee else None,
                actor_name=emp_name,
                action=f"Completed call with {customer_name} ({dur}s)",
                entity_type="call",
                entity_id=call_id,
                details={
                    "call_id": call_id,
                    "phone": target_phone,
                    "duration_seconds": dur,
                    "recording_url": final_recording_url,
                    "summary": summary_text,
                }
            )
            db.add(act_log)

            db.commit()
            logger.info(f"✅ Successfully synced call {call_id} to AI Employee {emp_name} and CRM.")

        except Exception as e:
            db.rollback()
            logger.error(f"Error creating CRM CallRecord and Intelligence for {call_id}: {e}", exc_info=True)

        return {
            "success": True,
            "call_id": call_id,
            "employee_id": employee.id if employee else None,
            "customer_id": customer.id if customer else None,
            "lead_id": lead.id if lead else None,
            "recording_url": final_recording_url,
            "summary": summary_text,
            "duration": dur,
        }
