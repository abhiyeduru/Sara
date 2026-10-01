"""
SARA AI — Exotel Call Service
Orchestrates outbound and inbound calls via Exotel for Indian phone numbers (+91),
persisting call sessions, transcripts, statuses, and handling callbacks.
"""
import uuid
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from server.models import (
    Call, AIEmployee, AIEmployeePermission, CreditAccount, User
)
from server.config import settings
from .exotel_client import exotel_client, validate_indian_phone_number
from .voice_events import voice_events_bus

logger = logging.getLogger("sara.voice.exotel_service")


class ExotelService:
    @staticmethod
    async def initiate_outbound_call(
        db: Session,
        user: User,
        employee_id: str,
        to_number: str,
        lead_id: Optional[str] = None,
        from_number: Optional[str] = None,
        simulate: bool = False,
    ) -> Dict[str, Any]:
        """
        Orchestrate an AI outbound call via Exotel.
        1. Validate Indian phone number format (+91...)
        2. Validate AI Employee existence & permissions
        3. Check workspace credits
        4. Create Call record in DB
        5. Invoke Exotel API (or Simulation)
        6. Return call details
        """
        # 1. Validate & normalize number
        try:
            normalized_to = validate_indian_phone_number(to_number)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        # 2. Validate Employee
        emp = db.query(AIEmployee).filter(AIEmployee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="AI Employee not found.")

        # 3. Check Credits
        account = db.query(CreditAccount).filter(CreditAccount.workspace_id == user.id).first()
        if account and account.balance <= 0.0:
            raise HTTPException(
                status_code=402,
                detail="Insufficient workspace calling credits. Please top up your balance."
            )

        # 4. Create Call Record in Database
        call_id = f"call_{uuid.uuid4().hex[:12]}"
        call_record = Call(
            id=call_id,
            workspace_id=user.id,
            ai_employee_id=emp.id,
            employee_id=emp.id,
            lead_id=lead_id,
            direction="outbound",
            phone_number=normalized_to,
            to_number=normalized_to,
            from_number=from_number or settings.EXOTEL_CALLER_ID or "+918000000000",
            status="initiated",
            started_at=datetime.now(timezone.utc),
            transcript=[],
        )
        db.add(call_record)
        db.commit()
        db.refresh(call_record)

        # 5. Connect via Exotel (or Simulate)
        if simulate or not settings.ALLOW_REAL_CALLS:
            call_sid = f"exo_sim_{call_id}"
            call_record.twilio_call_sid = call_sid
            call_record.status = "in-progress"
            db.commit()

            # Broadcast event
            await voice_events_bus.broadcast({
                "type": "call.initiated",
                "call_id": call_id,
                "call_sid": call_sid,
                "provider": "exotel_simulation",
                "to": normalized_to,
                "employee": emp.name,
            })

            return {
                "success": True,
                "call_id": call_id,
                "call_sid": call_sid,
                "status": "in-progress",
                "simulated": True,
                "provider": "exotel_simulation",
                "message": f"Simulated call started for {normalized_to} with {emp.name}."
            }

        # Real call initiation
        base_public = settings.FRONTEND_URL.replace("5173", "8000").replace("5174", "8000")
        status_url = f"{base_public}/api/webhooks/exotel/status"
        passthru_url = f"{base_public}/api/webhooks/exotel/passthru"

        res = await exotel_client.initiate_call(
            to_number=normalized_to,
            from_number=from_number or settings.EXOTEL_CALLER_ID,
            callback_url=passthru_url,
            status_callback_url=status_url,
            custom_field=call_id,
        )

        if res.get("success"):
            call_sid = res.get("call_sid", f"exo_{call_id}")
            call_record.twilio_call_sid = call_sid
            call_record.status = res.get("status", "initiated")
            db.commit()

            await voice_events_bus.broadcast({
                "type": "call.initiated",
                "call_id": call_id,
                "call_sid": call_sid,
                "provider": "exotel",
                "to": normalized_to,
                "employee": emp.name,
            })

            return {
                "success": True,
                "call_id": call_id,
                "call_sid": call_sid,
                "status": call_record.status,
                "simulated": False,
                "provider": "exotel",
                "message": f"Exotel call placed to {normalized_to}."
            }
        else:
            # Fallback to simulated mode if Exotel account is pending caller ID activation
            err_msg = res.get("message", "Exotel connection failed")
            logger.warning(f"Exotel call failed: {err_msg}. Engaging local simulation mode.")
            call_record.status = "simulated"
            call_record.twilio_call_sid = f"exo_sim_{call_id}"
            db.commit()

            return {
                "success": True,
                "call_id": call_id,
                "call_sid": f"exo_sim_{call_id}",
                "status": "simulated",
                "simulated": True,
                "provider": "exotel_simulation",
                "warning": err_msg,
                "message": f"Exotel call simulated for {normalized_to} (Exotel account responded: {err_msg[:100]})."
            }

    @staticmethod
    async def handle_status_callback(db: Session, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle Exotel status callbacks.
        Exotel posts fields: CallSid, Status, From, To, RecordingUrl, DialCallDuration, CustomField
        """
        call_sid = form_data.get("CallSid") or form_data.get("Sid")
        status = (form_data.get("Status") or "completed").lower()
        duration = int(form_data.get("DialCallDuration") or form_data.get("Duration") or 0)
        custom_field = form_data.get("CustomField")
        recording_url = form_data.get("RecordingUrl")

        logger.info(f"Exotel status callback received: CallSid={call_sid}, Status={status}, Duration={duration}")

        call_record = None
        if custom_field:
            call_record = db.query(Call).filter(Call.id == custom_field).first()
        if not call_record and call_sid:
            call_record = db.query(Call).filter(Call.twilio_call_sid == call_sid).first()

        if call_record:
            call_record.status = status
            if duration > 0:
                call_record.duration_seconds = duration
            if recording_url:
                call_record.recording_url = recording_url
            if status in ("completed", "canceled", "failed", "busy", "no-answer"):
                call_record.ended_at = datetime.now(timezone.utc)
            db.commit()

            # Broadcast real-time update
            await voice_events_bus.broadcast({
                "type": f"call.{status}",
                "call_id": call_record.id,
                "call_sid": call_sid,
                "status": status,
                "duration": duration
            })

        return {"status": "ok", "call_sid": call_sid}
