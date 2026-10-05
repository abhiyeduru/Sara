"""
SARA AI — Voice Telephony Call Service (Plivo / Exotel)
Orchestrates outbound call initiation, permission checks, credit balance verification,
and Plivo/Exotel Call creation. Completely decoupled from Twilio.
"""
import os
import uuid
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
from .plivo_client import plivo_client, normalize_plivo_phone_number
from .voice_events import voice_events_bus

logger = logging.getLogger("sara.voice.call_service")


def normalize_phone_number(raw_phone: str) -> str:
    """
    Standardize raw phone numbers into clean E.164 international format (+91...).
    Handles typos like '=' instead of '+', spaces, dashes, brackets, and leading zeros.
    """
    if not raw_phone:
        return ""
    cleaned = (
        str(raw_phone)
        .strip()
        .replace("=", "+")
        .replace(" ", "")
        .replace("-", "")
        .replace("(", "")
        .replace(")", "")
        .replace(".", "")
    )
    if cleaned.startswith("+"):
        digits = "".join(c for c in cleaned[1:] if c.isdigit())
        return f"+{digits}"
    digits = "".join(c for c in cleaned if c.isdigit())
    if len(digits) == 10:
        return f"+91{digits}"
    elif digits.startswith("91") and len(digits) == 12:
        return f"+{digits}"
    elif digits.startswith("0") and len(digits) == 11:
        return f"+91{digits[1:]}"
    elif digits.startswith("1") and len(digits) == 11:
        return f"+{digits}"
    return f"+{digits}"


class CallService:
    @staticmethod
    def initiate_outbound_call(
        db: Session,
        user: User,
        employee_id: str,
        to_number: str,
        lead_id: Optional[str] = None,
        from_number: Optional[str] = None,
        simulate: bool = False,
    ) -> Dict[str, Any]:
        """
        Orchestrate an AI outbound call through Plivo Voice API.
        Flow:
        1. Validate Employee
        2. Validate & Normalize Phone Number
        3. Check Calling Permission
        4. Check Credits Balance
        5. Create DB Call Record
        6. Initiate Plivo Call (or Simulation)
        7. Broadcast call.initiated event
        """
        # 1. Validate Employee
        emp = db.query(AIEmployee).filter(
            AIEmployee.id == employee_id,
            AIEmployee.workspace_id == user.id
        ).first()
        if not emp:
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

        # 4. Format & Normalize Phone Number
        clean_to = normalize_phone_number(to_number)
        if not clean_to or len(clean_to) < 8:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid phone number '{to_number}'. Please provide a valid number with country code."
            )

        # 5. Resolve Caller ID (From number)
        resolved_from = from_number or plivo_client.caller_id or "+918065522007"

        # 6. Create Call Record in Database
        call_id = f"call_{uuid.uuid4().hex[:12]}"
        call_record = Call(
            id=call_id,
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

        voice_events_bus.publish(call_id, "call.created", {
            "employee": emp.name,
            "to": clean_to,
            "from": resolved_from,
        })

        # 7. Execute Call via Plivo API or Simulation
        from dotenv import dotenv_values
        fresh_env = dotenv_values()
        base_url = (
            fresh_env.get("PLIVO_WEBHOOK_BASE_URL")
            or fresh_env.get("PUBLIC_BASE_URL")
            or os.getenv("PLIVO_WEBHOOK_BASE_URL")
            or getattr(settings, "PLIVO_WEBHOOK_BASE_URL", None)
            or os.getenv("PUBLIC_BASE_URL")
            or settings.PUBLIC_BASE_URL
            or "https://difficulties-them-regulations-kenneth.trycloudflare.com"
        ).rstrip("/")

        # Guard against invalid localhost answer_url for cloud telephony
        if "localhost" in base_url or "127.0.0.1" in base_url:
            base_url = "https://difficulties-them-regulations-kenneth.trycloudflare.com"

        answer_url = f"{base_url}/api/v1/voice/plivo/answer/{call_id}"
        hangup_url = f"{base_url}/api/v1/voice/plivo/hangup/{call_id}"

        call_sid = None
        error_msg = None
        is_sim = simulate or not settings.ALLOW_REAL_CALLS or not plivo_client.is_configured

        if not is_sim:
            try:
                clean_dest = clean_to.replace("+", "").strip()
                clean_src = resolved_from.replace("+", "").strip()
                call_resp = plivo_client.initiate_call(
                    to_number=clean_dest,
                    from_number=clean_src,
                    answer_url=answer_url,
                    hangup_url=hangup_url,
                )
                req_uuid = call_resp.get("request_uuid") or call_resp.get("call_uuid") or call_id
                call_sid = f"plv_{req_uuid}"
                call_record.twilio_call_sid = call_sid
                call_record.status = "ringing"
                db.commit()
                logger.info(f"✅ Plivo Call created successfully: SID={call_sid}, CallID={call_id}")
            except Exception as e:
                logger.warning(f"Plivo live call failed ({e}). Falling back to simulation mode.")
                error_msg = str(e)
                is_sim = True

        if is_sim:
            call_sid = f"plv_sim_{call_id[:12]}"
            call_record.twilio_call_sid = call_sid
            call_record.status = "in-progress" if not error_msg else "simulated"
            db.commit()

        voice_events_bus.publish(call_id, "call.initiated", {
            "call_sid": call_sid,
            "twilio_sid": call_sid,
            "is_simulated": is_sim,
            "provider": "plivo",
            "error": error_msg,
        })

        return {
            "success": True,
            "call_id": call_record.id,
            "call_sid": call_sid,
            "twilio_call_sid": call_sid,
            "status": call_record.status,
            "is_simulated": is_sim,
            "error_detail": error_msg,
            "provider": "plivo",
            "employee": {
                "id": emp.id,
                "name": emp.name,
                "role": emp.role,
            },
            "to": clean_to,
            "from": resolved_from,
            "created_at": call_record.created_at.isoformat() if call_record.created_at else None,
        }
