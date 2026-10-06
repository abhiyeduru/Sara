"""
SARA AI — /api/v1/voice router
Handles Plivo Voice Webhooks, Bidirectional Media Streams,
Outbound Calls, Inbound Call Routing, and Provider Health Monitoring.
Completely decoupled from Twilio.
"""
import os
import logging
import uuid
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Form, Request, Response, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.orm import Session

from server.config import settings
from server.database import get_db
from server.models import Call, PhoneNumber, AIEmployee, Lead
from server.services.voice.plivo_media_gateway import PlivoMediaGateway
from server.services.voice.plivo_client import plivo_client
from server.services.voice.call_service import CallService, normalize_phone_number
from server.services.voice.recording_service import RecordingService
from server.services.voice.voice_events import voice_events_bus
from server.services.voice.deepgram_service import DeepgramSTTService
from server.services.voice.assemblyai_service import AssemblyAISTTService
from server.services.voice.cartesia_service import CartesiaTTSService
from server.services.voice.call_billing_service import CallBillingService

logger = logging.getLogger("sara.api.voice")
router = APIRouter(prefix="/api/v1/voice", tags=["Voice Telephony & Media Streams"])


def _generate_plivo_media_stream_xml(request: Request, call_id: str, employee_id: Optional[str] = None) -> str:
    """
    Generate Plivo Bidirectional Media Stream XML.
    Uses <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">wss://...
    """
    # Automatically derive public WebSocket URL from the incoming request's host
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if host and ("trycloudflare.com" in host or "loca.lt" in host or "ngrok" in host):
        ws_url = f"wss://{host}/api/v1/voice/plivo/media-stream?call_id={call_id}"
    else:
        ws_base = os.getenv("PUBLIC_WS_URL") or settings.PUBLIC_WS_URL
        if ws_base:
            ws_url = f"{ws_base.rstrip('/')}/api/v1/voice/plivo/media-stream?call_id={call_id}"
        else:
            scheme = "wss" if request.headers.get("x-forwarded-proto") == "https" or "https" in str(request.base_url) else "ws"
            ws_url = f"{scheme}://{host or f'{settings.HOST}:{settings.PORT}'}/api/v1/voice/plivo/media-stream?call_id={call_id}"

    if employee_id:
        ws_url += f"&amp;employee_id={employee_id}"

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">
        {ws_url}
    </Stream>
</Response>"""
    return xml


# ── 1. Plivo Bidirectional Media Stream WebSocket ─────────────────────────────
@router.websocket("/plivo/media-stream")
@router.websocket("/media-stream")
async def plivo_media_stream_endpoint(websocket: WebSocket, call_id: Optional[str] = None):
    """
    WebSocket endpoint for Bidirectional Media Stream (Plivo carrier).
    Handles continuous audio streaming, Deepgram STT, OpenAI LLM, and Cartesia TTS.
    """
    await websocket.accept()
    gateway = PlivoMediaGateway(websocket, call_id=call_id)
    await gateway.handle_stream()


# ── 2. Inbound Call Webhook (Plivo) ──────────────────────────────────────────
@router.api_route("/plivo/inbound", methods=["GET", "POST"])
@router.api_route("/incoming-call", methods=["GET", "POST"])
@router.api_route("/inbound", methods=["GET", "POST"])
async def inbound_call_webhook(
    request: Request,
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    CallUUID: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Plivo posts here when a customer calls the SARA phone number (+91 80 6552 2007).
    Identifies assigned employee, creates Call record, and returns bidirectional stream XML.
    """
    logger.info(f"Plivo inbound call received: From={From}, To={To}, CallUUID={CallUUID}")

    clean_to = To.replace("+", "").strip() if To else ""
    phone_rec = db.query(PhoneNumber).filter(
        (PhoneNumber.number.like(f"%{clean_to}%")) |
        (PhoneNumber.phone_number.like(f"%{clean_to}%"))
    ).first()

    assigned_emp_id = phone_rec.assigned_employee_id if phone_rec else None
    if not assigned_emp_id and phone_rec:
        assigned_emp_id = phone_rec.employee_id

    if not assigned_emp_id:
        active_emp = db.query(AIEmployee).filter(AIEmployee.status == "active").first()
        assigned_emp_id = active_emp.id if active_emp else None

    call_id = f"call_{uuid.uuid4().hex[:12]}"
    new_call = Call(
        id=call_id,
        workspace_id=phone_rec.workspace_id if phone_rec else "workspace_default_1",
        ai_employee_id=assigned_emp_id,
        employee_id=assigned_emp_id,
        direction="inbound",
        twilio_call_sid=f"plv_{CallUUID}" if CallUUID else None,
        from_number=From or "Unknown",
        to_number=To or settings.PLIVO_PHONE_NUMBER or "+918065522007",
        phone_number=From or "Unknown",
        status="in-progress",
    )
    db.add(new_call)
    db.commit()

    xml = _generate_plivo_media_stream_xml(request, call_id=call_id, employee_id=assigned_emp_id)
    return Response(content=xml, media_type="application/xml")


# ── 3. Plivo Answer & Hangup Callbacks ───────────────────────────────────────
@router.api_route("/plivo/answer/{call_id}", methods=["GET", "POST"])
@router.api_route("/outbound-twiml/{call_id}", methods=["GET", "POST"])
@router.api_route("/twiml/{call_id}", methods=["GET", "POST"])
async def plivo_answer_endpoint(
    call_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Called by telephony carrier when an outbound or routed call connects.
    Returns Plivo XML with <Stream bidirectional="true"> to launch bidirectional AI conversation.
    """
    call = db.query(Call).filter(
        (Call.id == call_id) | (Call.twilio_call_sid.like(f"%{call_id}%"))
    ).first()
    emp_id = (call.ai_employee_id or call.employee_id) if call else None

    xml = _generate_plivo_media_stream_xml(request, call_id=call_id, employee_id=emp_id)
    return Response(content=xml, media_type="application/xml")


@router.api_route("/plivo/hangup/{call_id}", methods=["GET", "POST"])
async def plivo_hangup_endpoint(
    call_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Plivo call termination callback."""
    # Plivo may send Duration or BillDuration in form or query params
    duration_sec = 0
    try:
        if request.method == "POST":
            form = await request.form()
            raw_dur = form.get("Duration") or form.get("BillDuration")
            if raw_dur:
                duration_sec = int(raw_dur)
        if not duration_sec:
            raw_q = request.query_params.get("Duration") or request.query_params.get("BillDuration")
            if raw_q:
                duration_sec = int(raw_q)
    except Exception as e:
        logger.debug(f"Could not parse hangup duration from request: {e}")

    call = db.query(Call).filter(
        (Call.id == call_id) | (Call.twilio_call_sid.like(f"%{call_id}%"))
    ).first()
    if call:
        call.status = "completed"
        if duration_sec > 0:
            call.duration_seconds = duration_sec
        db.commit()

        # Bill call (idempotent; ₹6/min)
        effective_dur = duration_sec or call.duration_seconds or 0
        CallBillingService.bill_completed_call(db, call.id, effective_dur)

        await voice_events_bus.broadcast({
            "type": "call.completed",
            "call_id": call.id,
            "call_sid": call.twilio_call_sid,
            "status": "completed",
            "duration": effective_dur,
        })
    else:
        CallBillingService.bill_completed_call(db, call_id, duration_sec)

    return Response(content="<Response></Response>", media_type="application/xml")


@router.api_route("/plivo/recording/{call_id}", methods=["GET", "POST"])
async def plivo_recording_callback(
    call_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Plivo calls this webhook when a carrier call recording is ready.
    Extracts RecordUrl / RecordingUrl, updates Call and CRM CallRecording.
    """
    form_data = {}
    if request.method == "POST":
        try:
            form_data = dict(await request.form())
        except Exception:
            pass

    recording_url = (
        form_data.get("RecordUrl") or
        form_data.get("RecordingUrl") or
        request.query_params.get("RecordUrl") or
        request.query_params.get("RecordingUrl")
    )

    if recording_url:
        call = db.query(Call).filter(
            (Call.id == call_id) | (Call.twilio_call_sid.like(f"%{call_id}%"))
        ).first()
        if call:
            call.recording_url = recording_url
            db.commit()

        from server.models import CallRecord, CallRecording
        crm_call = db.query(CallRecord).filter(
            (CallRecord.id == call_id) | (CallRecord.session_id == call_id)
        ).first()
        if crm_call and crm_call.recording:
            crm_call.recording.file_path = recording_url
            crm_call.recording.mime_type = "audio/mpeg" if recording_url.endswith(".mp3") else "audio/wav"
            db.commit()

        logger.info(f"🎙️ Plivo recording URL received for call {call_id}: {recording_url}")

    return Response(content="<Response></Response>", media_type="application/xml")


# ── 4. Outbound Call Trigger ─────────────────────────────────────────────────
@router.post("/outbound-call")
async def initiate_outbound_call(
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Initiate an outbound phone call via Plivo Voice API.
    Validates phone number, consent, Plivo credentials, and initiates call.
    """
    to_number = payload.get("to_number") or payload.get("phone")
    employee_id = payload.get("employee_id")
    from_number = payload.get("from_number") or settings.PLIVO_PHONE_NUMBER

    if not to_number or not str(to_number).strip():
        raise HTTPException(status_code=400, detail="Destination phone number is required.")

    clean_to = normalize_phone_number(str(to_number))
    if not clean_to or len(clean_to) < 8:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phone number '{to_number}'. Please provide a valid phone number with country code."
        )

    employee = None
    if employee_id:
        employee = db.query(AIEmployee).filter(AIEmployee.id == employee_id).first()
    if not employee:
        employee = db.query(AIEmployee).first()

    class MockUser:
        id = payload.get("workspace_id") or "workspace_default_1"

    res = CallService.initiate_outbound_call(
        db=db,
        user=MockUser(),
        employee_id=employee.id if employee else "emp_default",
        to_number=clean_to,
        from_number=from_number,
    )

    return {
        "success": True,
        "call_id": res.get("call_id"),
        "call_sid": res.get("call_sid"),
        "status": res.get("status"),
        "is_simulated": res.get("is_simulated", False),
        "message": f"Outbound call initiated to {clean_to} via Plivo Voice.",
    }


# ── 5. Status & Recording Callbacks ──────────────────────────────────────────
@router.post("/status/{call_id}")
async def call_status_callback(
    call_id: str,
    CallStatus: Optional[str] = Form(None),
    CallDuration: Optional[int] = Form(None),
    CallSid: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Call lifecycle updates."""
    logger.info(f"Call {call_id} status: {CallStatus} (Duration: {CallDuration}s)")
    call = db.query(Call).filter(Call.id == call_id).first()
    if call:
        if CallStatus in ["completed", "failed", "busy", "no-answer", "canceled"]:
            call.status = CallStatus
            if CallDuration:
                call.duration = CallDuration
            db.commit()
    return {"status": "ok"}


@router.post("/recording/{call_id}")
async def call_recording_callback(
    call_id: str,
    RecordingUrl: Optional[str] = Form(None),
    RecordingSid: Optional[str] = Form(None),
    RecordingDuration: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Call recording webhook."""
    if RecordingUrl:
        RecordingService.handle_recording_callback(
            db=db,
            call_id=call_id,
            recording_url=RecordingUrl,
            recording_sid=RecordingSid or "",
            duration=RecordingDuration or 0,
        )
    return {"status": "ok"}


# ── 6. Provider Health & Diagnostics ─────────────────────────────────────────
@router.get("/providers/health")
async def check_providers_health(db: Session = Depends(get_db)):
    """
    Live health check of all integrated providers:
    Plivo Telephony, Deepgram STT, Cartesia TTS, and OpenAI Intelligence.
    Never fake success; returns actual operational status.
    """
    results: Dict[str, Any] = {}

    # 1. Plivo Telephony (Primary India Voice)
    if not plivo_client.is_configured:
        results["plivo"] = {"status": "Not configured", "ready": False}
    else:
        try:
            summary = plivo_client.get_account_summary()
            nums = plivo_client.list_numbers()
            results["plivo"] = {
                "status": "Healthy",
                "ready": True,
                "account_name": summary.get("name", "Active"),
                "auth_id": summary.get("auth_id"),
                "billing_mode": summary.get("billing_mode"),
                "cash_credits": summary.get("cash_credits"),
                "active_numbers": len(nums),
                "primary_number": settings.PLIVO_PHONE_NUMBER,
            }
        except Exception as e:
            results["plivo"] = {"status": "Error", "ready": False, "error": str(e)}

    # 2. AssemblyAI STT (Primary)
    if not settings.ASSEMBLYAI_API_KEY:
        results["assemblyai"] = {"status": "Not configured", "ready": False}
    else:
        try:
            aai = AssemblyAISTTService()
            conn = await aai.connect()
            if conn:
                await aai.close()
                results["assemblyai"] = {"status": "Healthy", "ready": True, "model": "universal-3-6-pro"}
            else:
                results["assemblyai"] = {"status": "Error", "ready": False, "error": "Handshake failed"}
        except Exception as e:
            results["assemblyai"] = {"status": "Error", "ready": False, "error": str(e)}

    # 3. Deepgram STT (Fallback)
    if not settings.DEEPGRAM_API_KEY:
        results["deepgram"] = {"status": "Not configured", "ready": False}
    else:
        try:
            dg = DeepgramSTTService()
            conn = await dg.connect()
            if conn:
                await dg.close()
                results["deepgram"] = {"status": "Healthy", "ready": True, "region": settings.DEEPGRAM_REGION or "global"}
            else:
                results["deepgram"] = {"status": "Error", "ready": False, "error": "Handshake failed"}
        except Exception as e:
            results["deepgram"] = {"status": "Error", "ready": False, "error": str(e)}

    # 3. Cartesia TTS
    if not settings.CARTESIA_API_KEY:
        results["cartesia"] = {"status": "Not configured", "ready": False}
    else:
        try:
            tts = CartesiaTTSService()
            res = await tts.synthesize("Health check.", language="en", output_mode="twilio")
            await tts.close()
            if res.get("audio_bytes"):
                results["cartesia"] = {
                    "status": "Healthy",
                    "ready": True,
                    "model": settings.CARTESIA_MODEL_ID,
                    "latency_ms": res.get("latency_ms")
                }
            else:
                results["cartesia"] = {"status": "Degraded", "ready": False, "error": res.get("error")}
        except Exception as e:
            results["cartesia"] = {"status": "Error", "ready": False, "error": str(e)}

    # 4. OpenAI Intelligence Layer
    if not settings.OPENAI_API_KEY:
        results["openai"] = {"status": "Not configured", "ready": False}
    else:
        results["openai"] = {
            "status": "Configured",
            "ready": True,
            "model": settings.OPENAI_MODEL or "gpt-4o-mini",
            "note": "Primary Intelligence Layer"
        }

    return results
