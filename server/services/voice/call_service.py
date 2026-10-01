"""
SARA AI — Twilio Call Service
Orchestrates outbound call initiation, permission checks, credit balance verification,
and Twilio Call creation.
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from server.models import (
    Call, AIEmployee, AIEmployeePermission, Lead, CreditAccount,
    PhoneNumber, User
)
from server.config import settings
from .twilio_client import get_twilio_client, get_default_from_number
from .voice_events import voice_events_bus

logger = logging.getLogger("sara.voice.service")


class CallService:
    @staticmethod
    def initiate_outbound_call(
        db: Session,
        user: User,
        employee_id: str,
        to_number: str,
        lead_id: Optional[str] = None,
        from_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Orchestrate an AI outbound call through Twilio.
        Flow:
        1. Validate Employee
        2. Validate Phone Number
        3. Check Calling Permission
        4. Check Credits Balance
        5. Create DB Call Record
        6. Initiate Twilio Call
        7. Broadcast call.initiated event
        """
        # 1. Validate Employee
        emp = db.query(AIEmployee).filter(
            AIEmployee.id == employee_id,
            AIEmployee.workspace_id == user.id
        ).first()
        if not emp:
            # Check if employee exists by role or fallback
            emp = db.query(AIEmployee).filter(AIEmployee.id == employee_id).first()
            if not emp:
                raise HTTPException(status_code=404, detail="AI Employee not found.")

        # 2. Validate Calling Permission
        perm = db.query(AIEmployeePermission).filter(
            AIEmployeePermission.employee_id == emp.id,
            AIEmployeePermission.capability == "calls:make"
        ).first()
        if perm and perm.access == "denied":
            raise HTTPException(
                status_code=403,
                detail=f"AI Employee '{emp.name}' does not have permission to make outbound phone calls."
            )

        # 3. Check Credits
        account = db.query(CreditAccount).filter(CreditAccount.workspace_id == user.id).first()
        if account and account.balance <= 0.0:
            raise HTTPException(
                status_code=402,
                detail="Insufficient workspace calling credits. Please top up your balance."
            )

        # 4. Format Phone Number
        clean_to = to_number.strip().replace(" ", "").replace("-", "")
        if not clean_to.startswith("+"):
            if len(clean_to) == 10:
                clean_to = f"+91{clean_to}"
            else:
                clean_to = f"+{clean_to}"

        # 5. Resolve Caller ID (From number)
        twilio_client = get_twilio_client()
        resolved_from = from_number or get_default_from_number(twilio_client)

        # 6. Create Call Record in Database
        call_record = Call(
            workspace_id=user.id,
            ai_employee_id=emp.id,
            employee_id=emp.id,
            lead_id=lead_id,
            direction="outbound",
            phone_number=clean_to,
            to_number=clean_to,
            from_number=resolved_from,
            status="initiated",
            started_at=datetime.now(timezone.utc),
            transcript=[],
        )
        db.add(call_record)
        db.commit()
        db.refresh(call_record)

        call_id = call_record.id
        voice_events_bus.publish(call_id, "call.created", {
            "employee": emp.name,
            "to": clean_to,
            "from": resolved_from,
        })

        # 7. Execute Call via Twilio API
        base_url = settings.TWILIO_WEBHOOK_BASE_URL.rstrip("/")
        twiml_url = f"{base_url}/api/v1/voice/twiml/{call_id}"
        status_callback_url = f"{base_url}/api/v1/voice/status/{call_id}"

        twilio_sid = None
        error_msg = None
        is_simulated = False

        # Attempt 1: Standard Twilio Outbound Call
        try:
            tw_call = twilio_client.calls.create(
                to=clean_to,
                from_=resolved_from,
                url=twiml_url,
                status_callback=status_callback_url,
                status_callback_event=["initiated", "ringing", "answered", "completed"],
                record=True,
            )
            twilio_sid = tw_call.sid
            call_record.twilio_call_sid = twilio_sid
            call_record.status = "initiated"
            db.commit()
            logger.info(f"✅ Twilio Call created successfully: SID={twilio_sid}, CallID={call_id}")
        except Exception as e1:
            logger.warning(f"Standard Twilio call parameters failed ({e1}). Retrying with minimal parameters...")
            # Attempt 2: Minimal parameters (fixes trial account parameter restrictions)
            try:
                tw_call = twilio_client.calls.create(
                    to=clean_to,
                    from_=resolved_from,
                    url=twiml_url,
                )
                twilio_sid = tw_call.sid
                call_record.twilio_call_sid = twilio_sid
                call_record.status = "initiated"
                db.commit()
                logger.info(f"✅ Twilio Call created with minimal parameters: SID={twilio_sid}, CallID={call_id}")
            except Exception as e2:
                error_msg = str(e2)
                is_simulated = True
                logger.error(f"Twilio call failed: {error_msg}")
                call_record.status = "simulated"
                call_record.twilio_call_sid = f"CA_sim_{call_id[:16]}"
                db.commit()

        voice_events_bus.publish(call_id, "call.initiated", {
            "twilio_sid": call_record.twilio_call_sid,
            "is_simulated": is_simulated,
            "error": error_msg,
        })

        return {
            "call_id": call_record.id,
            "twilio_call_sid": call_record.twilio_call_sid,
            "status": call_record.status,
            "is_simulated": is_simulated,
            "error_detail": error_msg,
            "employee": {
                "id": emp.id,
                "name": emp.name,
                "role": emp.role,
            },
            "to": clean_to,
            "from": resolved_from,
            "created_at": call_record.created_at.isoformat() if call_record.created_at else None,
        }
