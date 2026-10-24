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
    ws_ids = [user.id, "workspace_default_1", "ws_default_1", "user_business_owner_1"]
    q = db.query(Call).filter((Call.workspace_id.in_(ws_ids)) | (Call.workspace_id == user.id))
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
    ws_ids = [user.id, "workspace_default_1", "ws_default_1", "user_business_owner_1"]
    calls = db.query(Call).filter(
        (Call.workspace_id.in_(ws_ids)) | (Call.workspace_id == user.id),
        Call.status == "connected"
    ).all()
    return {"count": len(calls), "data": [_call_dict(c) for c in calls]}


@router.get("/{call_id}")
async def get_call(
    call_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.query(Call).filter(Call.id == call_id).first()
    if not c:
        raise HTTPException(404, "Call not found")
    return _call_dict(c)


@router.get("/{call_id}/transcript")
async def get_call_transcript(
    call_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.query(Call).filter(Call.id == call_id).first()
    if not c:
        c = db.query(Call).filter(Call.twilio_call_sid == call_id).first()
    if not c:
        from server.models import CallRecord
        crm_c = db.query(CallRecord).filter(
            (CallRecord.id == call_id) | (CallRecord.session_id == call_id)
        ).first()
        if crm_c:
            transcripts = [
                {
                    "speaker": getattr(t, "speaker", "caller"),
                    "role": getattr(t, "speaker", "user"),
                    "text": getattr(t, "text", ""),
                    "timestamp": str(getattr(t, "timestamp", ""))
                }
                for t in (crm_c.transcripts or [])
            ]
            return {"call_id": call_id, "transcript": transcripts, "summary": crm_c.summary or ""}
        return {"call_id": call_id, "transcript": [], "summary": ""}
    return {"call_id": call_id, "transcript": c.transcript or [], "summary": c.summary or ""}


@router.post("/{call_id}/hangup")
async def hangup_call(
    call_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    from server.services.voice.voice_events import voice_events_bus
    c = db.query(Call).filter(Call.id == call_id).first()
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

    try:
        from server.services.voice.crm_sync_service import CRMSyncService
        CRMSyncService.sync_call_to_crm_and_employee(
            db=db,
            call_id=c.id,
            employee_id=c.ai_employee_id or c.employee_id,
            phone_number=c.to_number or c.from_number,
            direction=c.direction or "outbound",
            duration_seconds=c.duration_seconds or 0,
            transcript_history=c.transcript or [],
            summary_data={
                "summary": c.summary,
                "sentiment": c.sentiment,
                "intent": c.intent,
                "outcome": c.outcome,
                "lead_score": c.lead_score,
            },
            workspace_id=c.workspace_id,
        )
    except Exception as sync_err:
        logger.warning(f"Error syncing hung up call to CRM: {sync_err}")

    await voice_events_bus.broadcast({
        "type": "call.completed",
        "call_id": c.id,
        "call_sid": c.twilio_call_sid,
        "status": "completed"
    })
    return {"success": True, "message": "Call terminated successfully", "call_id": call_id}


@router.api_route("/{call_id}/recording", methods=["GET", "HEAD"])
async def get_call_recording(
    call_id: str,
    download: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stream call recording audio file for browser playback or download."""
    import os
    from fastapi.responses import FileResponse, RedirectResponse, Response
    from server.services.voice.crm_sync_service import STORAGE_RECORDINGS_DIR

    disposition = "attachment" if download else "inline"
    filename = f"recording_{call_id}.wav"

    # 1. Direct WAV file check on disk
    wav_file = os.path.join(STORAGE_RECORDINGS_DIR, f"{call_id}.wav")
    if os.path.exists(wav_file) and os.path.getsize(wav_file) > 100:
        return FileResponse(
            path=wav_file,
            media_type="audio/wav",
            filename=filename if download else None,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Disposition": f'{disposition}; filename="{filename}"'
            }
        )

    # 2. Check Call record in DB
    c = db.query(Call).filter(Call.id == call_id).first()
    if not c:
        c = db.query(Call).filter(Call.twilio_call_sid == call_id).first()
    if c and c.recording_url:
        if c.recording_url.startswith("http"):
            return RedirectResponse(url=c.recording_url)
        if os.path.exists(c.recording_url) and os.path.getsize(c.recording_url) > 100:
            return FileResponse(
                path=c.recording_url,
                media_type="audio/wav",
                filename=filename if download else None,
                headers={
                    "Accept-Ranges": "bytes",
                    "Content-Disposition": f'{disposition}; filename="{filename}"'
                }
            )

    # 3. Check CRM CallRecord
    from server.models import CallRecord
    crm_c = db.query(CallRecord).filter(
        (CallRecord.id == call_id) | (CallRecord.session_id == call_id)
    ).first()
    if crm_c and getattr(crm_c, "recording", None):
        rec = crm_c.recording
        rec_url = getattr(rec, "recording_url", None) or getattr(rec, "file_path", None)
        if rec_url:
            if rec_url.startswith("http"):
                return RedirectResponse(url=rec_url)
            if os.path.exists(rec_url) and os.path.getsize(rec_url) > 100:
                return FileResponse(
                    path=rec_url,
                    media_type="audio/wav",
                    filename=filename if download else None,
                    headers={
                        "Accept-Ranges": "bytes",
                        "Content-Disposition": f'{disposition}; filename="{filename}"'
                    }
                )

    # 4. If recording is pending/not generated yet, return 204 No Content to avoid breaking WebKit media controls
    return Response(status_code=204)


