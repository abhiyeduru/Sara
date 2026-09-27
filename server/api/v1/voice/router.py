"""
SARA AI — /api/v1/voice router (Twilio Webhooks & TwiML Execution)
Receives Twilio callbacks for Speech-to-Text, Call Status, and Call Recordings.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Form, Request, Response
from sqlalchemy.orm import Session

from server.database import get_db
from server.services.voice.webhook_service import WebhookService
from server.services.voice.recording_service import RecordingService
from server.services.voice.voice_events import voice_events_bus
from server.models import Call, PhoneNumber, AIEmployee

logger = logging.getLogger("sara.api.voice")
router = APIRouter(prefix="/api/v1/voice", tags=["Voice Telephony Webhooks"])


@router.api_route("/twiml/{call_id}", methods=["GET", "POST"])
async def twiml_endpoint(
    call_id: str,
    db: Session = Depends(get_db),
):
    """
    Twilio fetches this TwiML XML when the call is answered.
    """
    twiml_xml = WebhookService.generate_initial_twiml(db, call_id)
    return Response(content=twiml_xml, media_type="application/xml")


@router.post("/process/{call_id}")
async def process_speech(
    call_id: str,
    SpeechResult: Optional[str] = Form(None),
    Confidence: Optional[float] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Twilio posts speech recognition results from <Gather>.
    Runs AI reasoning loop (LLM + Knowledge RAG) and returns next TwiML.
    """
    logger.info(f"🎤 [Call {call_id[:8]}] Speech detected: '{SpeechResult}' (Confidence: {Confidence})")
    next_twiml = await WebhookService.process_speech_and_respond(
        db=db,
        call_id=call_id,
        speech_result=SpeechResult or "",
        confidence=Confidence,
    )
    return Response(content=next_twiml, media_type="application/xml")


@router.post("/status/{call_id}")
async def call_status_callback(
    call_id: str,
    CallStatus: Optional[str] = Form(None),
    CallDuration: Optional[int] = Form(None),
    CallSid: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Twilio status updates: initiated, ringing, in-progress, completed, busy, no-answer, failed.
    """
    logger.info(f"📞 [Call {call_id[:8]}] Status update: {CallStatus} (Duration: {CallDuration}s, SID: {CallSid})")
    await WebhookService.handle_status_callback(
        db=db,
        call_id=call_id,
        call_status=CallStatus or "unknown",
        duration=CallDuration,
        call_sid=CallSid,
    )
    return {"status": "ok"}


@router.post("/recording/{call_id}")
async def call_recording_callback(
    call_id: str,
    RecordingUrl: Optional[str] = Form(None),
    RecordingSid: Optional[str] = Form(None),
    RecordingDuration: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Twilio notifies that call recording MP3 is ready.
    """
    logger.info(f"🎙️ [Call {call_id[:8]}] Recording ready: {RecordingUrl}")
    if RecordingUrl:
        RecordingService.handle_recording_callback(
            db=db,
            call_id=call_id,
            recording_url=RecordingUrl,
            recording_sid=RecordingSid or "",
            duration=RecordingDuration or 0,
        )
    return {"status": "ok"}


@router.post("/inbound")
async def inbound_call_handler(
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    CallSid: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Handles incoming calls to Twilio phone numbers configured in Sara.
    Routes call to assigned AI employee.
    """
    logger.info(f"Incoming call to {To} from {From} (Twilio SID: {CallSid})")
    # Lookup which employee is assigned to this number
    phone_rec = db.query(PhoneNumber).filter(
        (PhoneNumber.number == To) | (PhoneNumber.phone_number == To)
    ).first()

    assigned_emp_id = phone_rec.assigned_employee_id if phone_rec else None
    if not assigned_emp_id and phone_rec:
        assigned_emp_id = phone_rec.employee_id

    # Fallback to first active employee
    if not assigned_emp_id:
        emp = db.query(AIEmployee).filter(AIEmployee.status == "active").first()
        assigned_emp_id = emp.id if emp else None

    # Create inbound call record
    new_call = Call(
        workspace_id=phone_rec.workspace_id if phone_rec else "user_business_owner_1",
        ai_employee_id=assigned_emp_id,
        employee_id=assigned_emp_id,
        direction="inbound",
        twilio_call_sid=CallSid,
        from_number=From,
        to_number=To,
        phone_number=From,
        status="in-progress",
    )
    db.add(new_call)
    db.commit()
    db.refresh(new_call)

    # Return initial TwiML for this new inbound call
    twiml_xml = WebhookService.generate_initial_twiml(db, new_call.id)
    return Response(content=twiml_xml, media_type="application/xml")
