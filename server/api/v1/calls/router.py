"""SARA AI — /api/v1/calls router (new unified calls system)"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import Call, User

logger = logging.getLogger("sara.api.calls")
router = APIRouter(prefix="/api/v1/calls", tags=["Calls"])


class CallCreate(BaseModel):
    employee_id: str
    to: str
    lead_id: Optional[str] = None
    from_number: Optional[str] = None
    provider: Optional[str] = "plivo"  # "plivo", "twilio", "simulator", "exotel"
    simulate: Optional[bool] = False


def _call_dict(c: Call) -> dict:
    return {
        "id": c.id,
        "ai_employee_id": c.ai_employee_id or c.employee_id,
        "customer_id": c.customer_id,
        "lead_id": c.lead_id,
        "campaign_id": c.campaign_id,
        "twilio_call_sid": c.twilio_call_sid,
        "direction": c.direction,
        "phone_number": c.to_number or c.phone_number,
        "to_number": c.to_number or c.phone_number,
        "from_number": c.from_number,
        "status": c.status,
        "duration_seconds": c.duration_seconds,
        "recording_url": c.recording_url,
        "transcript_url": c.transcript_url,
        "transcript": c.transcript or [],
        "summary": c.summary,
        "sentiment": c.sentiment,
        "intent": c.intent,
        "lead_score": c.lead_score,
        "outcome": c.outcome,
        "credits_used": c.credits_used,
        "cost": c.cost,
        "cost_credits": c.cost_credits or c.credits_used,
        "started_at": c.started_at.isoformat() if c.started_at else None,
        "answered_at": c.answered_at.isoformat() if c.answered_at else None,
        "ended_at": c.ended_at.isoformat() if c.ended_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "employee_name": c.ai_employee.name if c.ai_employee else "AI Employee",
    }


@router.post("", status_code=201)
async def make_outbound_call(
    body: CallCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Trigger an outbound AI call via configured telephony provider (default: Plivo).
    """
    active_provider = body.provider or getattr(settings, "TELEPHONY_PROVIDER", "plivo")

    if active_provider == "plivo":
        from server.services.voice.plivo_service import PlivoService
        return await PlivoService.initiate_outbound_call(
            db=db,
            user=user,
            employee_id=body.employee_id,
            to_number=body.to,
            lead_id=body.lead_id,
            from_number=body.from_number,
            simulate=body.simulate or False,
        )

    if active_provider == "exotel":
        from server.services.voice.exotel_service import ExotelService
        return await ExotelService.initiate_outbound_call(
            db=db,
            user=user,
            employee_id=body.employee_id,
            to_number=body.to,
            lead_id=body.lead_id,
            from_number=body.from_number,
            simulate=body.simulate,
        )

    from server.services.voice.call_service import CallService
    return CallService.initiate_outbound_call(
        db=db,
        user=user,
        employee_id=body.employee_id,
        to_number=body.to,
        lead_id=body.lead_id,
        from_number=body.from_number,
    )


@router.post("/plivo", status_code=201)
async def make_plivo_call(
    body: CallCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Explicitly trigger an outbound call via Plivo Voice."""
    from server.services.voice.plivo_service import PlivoService
    return await PlivoService.initiate_outbound_call(
        db=db,
        user=user,
        employee_id=body.employee_id,
        to_number=body.to,
        lead_id=body.lead_id,
        from_number=body.from_number,
        simulate=body.simulate or False,
    )


@router.post("/exotel", status_code=201)
async def make_exotel_call(
    body: CallCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Explicitly trigger an outbound call via Exotel."""
    from server.services.voice.exotel_service import ExotelService
    return await ExotelService.initiate_outbound_call(
        db=db,
        user=user,
        employee_id=body.employee_id,
        to_number=body.to,
        lead_id=body.lead_id,
        from_number=body.from_number,
        simulate=body.simulate,
    )


@router.get("")
async def list_calls(
    status: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    ai_employee_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Call).filter(Call.workspace_id == user.id)
    if status:
        q = q.filter(Call.status == status)
    if direction:
        q = q.filter(Call.direction == direction)
    if ai_employee_id:
        q = q.filter((Call.ai_employee_id == ai_employee_id) | (Call.employee_id == ai_employee_id))

    total = q.count()
    calls = q.order_by(Call.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "data": [_call_dict(c) for c in calls]}


@router.get("/live")
async def live_calls(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Returns currently active (connected) calls."""
    calls = db.query(Call).filter(
        Call.workspace_id == user.id,
        Call.status == "connected"
    ).all()
    return {"count": len(calls), "data": [_call_dict(c) for c in calls]}


@router.get("/{call_id}")
async def get_call(
    call_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.query(Call).filter(Call.id == call_id, Call.workspace_id == user.id).first()
    if not c:
        raise HTTPException(404, "Call not found")
    return _call_dict(c)


@router.get("/{call_id}/transcript")
async def get_call_transcript(
    call_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.query(Call).filter(Call.id == call_id, Call.workspace_id == user.id).first()
    if not c:
        raise HTTPException(404, "Call not found")
    return {"call_id": call_id, "transcript": c.transcript or [], "summary": c.summary}


@router.post("/{call_id}/hangup")
async def hangup_call(
    call_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    from server.services.voice.voice_events import voice_events_bus
    c = db.query(Call).filter(Call.id == call_id, Call.workspace_id == user.id).first()
    if not c:
        raise HTTPException(404, "Call not found")

    # Hangup provider call if active
    if c.twilio_call_sid:
        if c.twilio_call_sid.startswith("plv_"):
            from server.services.voice.plivo_client import plivo_client
            plivo_client.hangup_call(c.twilio_call_sid)
        elif c.twilio_call_sid.startswith("exo_"):
            from server.services.voice.exotel_client import exotel_client
            await exotel_client.hangup_call(c.twilio_call_sid)

    c.status = "completed"
    c.ended_at = datetime.now(timezone.utc)
    db.commit()

    await voice_events_bus.broadcast({
        "type": "call.completed",
        "call_id": c.id,
        "call_sid": c.twilio_call_sid,
        "status": "completed"
    })
    return {"success": True, "message": "Call terminated successfully", "call_id": call_id}
