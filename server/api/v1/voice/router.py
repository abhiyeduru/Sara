"""
SARA AI — /api/v1/voice router
Handles Twilio Programmable Voice Webhooks, Bidirectional Media Streams,
Outbound Calls, Inbound Call Routing, and Provider Health Monitoring.
"""
import logging
import uuid
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Form, Request, Response, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.orm import Session

from server.config import settings
from server.database import get_db
from server.models import Call, PhoneNumber, AIEmployee, Lead
from server.services.voice.twilio_media_gateway import TwilioMediaGateway
from server.services.voice.twilio_client import get_twilio_client, get_default_from_number
from server.services.voice.plivo_media_gateway import PlivoMediaGateway
from server.services.voice.plivo_client import plivo_client
from server.services.voice.call_service import normalize_phone_number
from server.services.voice.recording_service import RecordingService
from server.services.voice.voice_events import voice_events_bus
from server.services.voice.deepgram_service import DeepgramSTTService
from server.services.voice.cartesia_service import CartesiaTTSService

logger = logging.getLogger("sara.api.voice")
router = APIRouter(prefix="/api/v1/voice", tags=["Voice Telephony & Media Streams"])


def _generate_plivo_media_stream_xml(request: Request, call_id: str, employee_id: Optional[str] = None) -> str:
    """
    Generate Plivo Bidirectional Media Stream XML.
    Uses <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">wss://...
    """
    if settings.PUBLIC_WS_URL:
        ws_url = f"{settings.PUBLIC_WS_URL.rstrip('/')}/api/v1/voice/plivo/media-stream?call_id={call_id}"
    else:
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or f"{settings.HOST}:{settings.PORT}"
        scheme = "wss" if request.headers.get("x-forwarded-proto") == "https" or "https" in str(request.base_url) else "ws"
        ws_url = f"{scheme}://{host}/api/v1/voice/plivo/media-stream?call_id={call_id}"

    if employee_id:
        ws_url += f"&amp;employee_id={employee_id}"

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">
        {ws_url}
    </Stream>
</Response>"""
    return xml


def _generate_media_stream_twiml(request: Request, call_id: str, employee_id: Optional[str] = None) -> str:
    """
    Generate Twilio Bidirectional Media Stream TwiML.
    Uses <Connect><Stream url="wss://..."> to establish low-latency full-duplex audio.
    """
    # Determine WebSocket host (WSS for HTTPS/secure tunnels)
    if settings.PUBLIC_WS_URL:
        ws_url = f"{settings.PUBLIC_WS_URL.rstrip('/')}/api/v1/voice/media-stream"
    else:
        # Fallback to request host
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or f"{settings.HOST}:{settings.PORT}"
        scheme = "wss" if request.headers.get("x-forwarded-proto") == "https" or "https" in str(request.base_url) else "ws"
        ws_url = f"{scheme}://{host}/api/v1/voice/media-stream"

    emp_param = f'<Parameter name="employee_id" value="{employee_id}" />' if employee_id else ''

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{ws_url}">
            <Parameter name="call_id" value="{call_id}" />
            {emp_param}
        </Stream>
    </Connect>
</Response>"""
    return twiml


# ── 1. Twilio Bidirectional Media Stream WebSocket ───────────────────────────
@router.websocket("/media-stream")
async def twilio_media_stream_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for Twilio Bidirectional Media Stream.
    Handles continuous audio streaming, Deepgram STT, OpenAI, and Cartesia TTS.
    """
    await websocket.accept()
    gateway = TwilioMediaGateway(websocket)
    await gateway.handle_stream()


# ── 2. Twilio Inbound Webhook ────────────────────────────────────────────────
@router.api_route("/incoming-call", methods=["GET", "POST"])
@router.api_route("/inbound", methods=["GET", "POST"])
async def incoming_call_webhook(
    request: Request,
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    CallSid: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Twilio posts here when a customer calls the Twilio phone number.
    Identifies assigned employee, creates Call record, and starts Bidirectional Media Stream.
    """
    logger.info(f"Incoming call received: From={From}, To={To}, CallSid={CallSid}")

    # Find phone record and assigned employee
    phone_rec = db.query(PhoneNumber).filter(
        (PhoneNumber.number == To) | (PhoneNumber.phone_number == To)
    ).first()

    assigned_emp_id = phone_rec.assigned_employee_id if phone_rec else None
    if not assigned_emp_id and phone_rec:
        assigned_emp_id = phone_rec.employee_id

    if not assigned_emp_id:
        active_emp = db.query(AIEmployee).filter(AIEmployee.status == "active").first()
        assigned_emp_id = active_emp.id if active_emp else None

    # Create Call record in DB
    call_id = f"call_{uuid.uuid4().hex[:12]}"
    new_call = Call(
        id=call_id,
        workspace_id=phone_rec.workspace_id if phone_rec else "workspace_default_1",
        ai_employee_id=assigned_emp_id,
        employee_id=assigned_emp_id,
        direction="inbound",
        twilio_call_sid=CallSid,
        from_number=From or "Unknown",
        to_number=To or "Sara AI Line",
        phone_number=From or "Unknown",
        status="in-progress",
    )
    db.add(new_call)
    db.commit()

    twiml = _generate_media_stream_twiml(request, call_id=call_id, employee_id=assigned_emp_id)
    return Response(content=twiml, media_type="application/xml")


# ── 3. Twilio Outbound TwiML Endpoint ────────────────────────────────────────
@router.api_route("/outbound-twiml/{call_id}", methods=["GET", "POST"])
@router.api_route("/twiml/{call_id}", methods=["GET", "POST"])
async def outbound_twiml_endpoint(
    call_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Called by Twilio when an outbound call connects.
    Returns TwiML with <Connect><Stream> to launch bidirectional AI conversation.
    """
    call = db.query(Call).filter(Call.id == call_id).first()
    emp_id = (call.ai_employee_id or call.employee_id) if call else None

    twiml = _generate_media_stream_twiml(request, call_id=call_id, employee_id=emp_id)
    return Response(content=twiml, media_type="application/xml")


# ── 4. Outbound Call Trigger ─────────────────────────────────────────────────
@router.post("/outbound-call")
async def initiate_outbound_call(
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Initiate a real outbound phone call via Twilio.
    Validates phone number, consent, Twilio credentials, and initiates call.
    """
    to_number = payload.get("to_number") or payload.get("phone")
    employee_id = payload.get("employee_id")
    workspace_id = payload.get("workspace_id") or "workspace_default_1"

    if not to_number or not str(to_number).strip():
        raise HTTPException(status_code=400, detail="Destination phone number is required.")

    clean_to = normalize_phone_number(str(to_number))
    if not clean_to or len(clean_to) < 8:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phone number '{to_number}'. Please provide a valid phone number with country code."
        )

    # Validate Twilio credentials
    if not settings.TWILIO_ACCOUNT_SID or not (settings.TWILIO_AUTH_TOKEN or settings.TWILIO_API_KEY):
        raise HTTPException(
            status_code=400,
            detail="Twilio credentials are not configured. Please add your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
        )

    twilio_client = get_twilio_client()

    # Validate from_number
    from_number = payload.get("from_number") or settings.TWILIO_PHONE_NUMBER
    if not from_number:
        # Check if any phone number exists in DB
        first_phone = db.query(PhoneNumber).filter(PhoneNumber.status == "active").first()
        if first_phone:
            from_number = first_phone.number or first_phone.phone_number

    if not from_number:
        from_number = get_default_from_number(twilio_client)

    # Check Employee
    employee = None
    if employee_id:
        employee = db.query(AIEmployee).filter(AIEmployee.id == employee_id).first()
    if not employee:
        employee = db.query(AIEmployee).first()

    # Create Call record in DB
    call_id = f"call_{uuid.uuid4().hex[:12]}"
    new_call = Call(
        id=call_id,
        workspace_id=workspace_id,
        ai_employee_id=employee.id if employee else None,
        employee_id=employee.id if employee else None,
        direction="outbound",
        from_number=from_number,
        to_number=clean_to,
        phone_number=clean_to,
        status="initiating",
    )
    db.add(new_call)
    db.commit()

    # Base URL for Twilio webhook callback
    base_url = settings.TWILIO_WEBHOOK_BASE_URL.rstrip("/")
    if "localhost" in base_url and settings.PUBLIC_BASE_URL:
        base_url = settings.PUBLIC_BASE_URL.rstrip("/")

    twiml_url = f"{base_url}/api/v1/voice/outbound-twiml/{call_id}"
    status_callback_url = f"{base_url}/api/v1/voice/status/{call_id}"

    try:
        twilio_call = twilio_client.calls.create(
            to=clean_to,
            from_=from_number,
            url=twiml_url,
            status_callback=status_callback_url,
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            record=True,
        )

        new_call.twilio_call_sid = twilio_call.sid
        new_call.status = "ringing"
        db.commit()

        return {
            "success": True,
            "call_id": call_id,
            "twilio_sid": twilio_call.sid,
            "status": "ringing",
            "message": f"Outbound call initiated to {clean_to}."
        }
    except Exception as e:
        new_call.status = "failed"
        db.commit()
        error_str = str(e)
        logger.error(f"Twilio call creation error: {error_str}")

        if "422" in error_str or "21215" in error_str or "unverified" in error_str.lower() or "trial" in error_str.lower():
            friendly_detail = (
                f"Twilio Trial Restriction: Cannot place call to {clean_to}. "
                "Twilio trial accounts can only place calls to Verified Caller IDs. "
                "Please verify this phone number in your Twilio Console under Phone Numbers > Verified Caller IDs."
            )
        else:
            friendly_detail = f"Twilio telephony error: {error_str}"

        raise HTTPException(
            status_code=400 if "422" in error_str else 500,
            detail=friendly_detail
        )


# ── 5. Status & Recording Callbacks ──────────────────────────────────────────
@router.post("/status/{call_id}")
async def call_status_callback(
    call_id: str,
    CallStatus: Optional[str] = Form(None),
    CallDuration: Optional[int] = Form(None),
    CallSid: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Twilio call lifecycle updates."""
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
    """Twilio call recording webhook."""
    if RecordingUrl:
        RecordingService.handle_recording_callback(
            db=db,
            call_id=call_id,
            recording_url=RecordingUrl,
            recording_sid=RecordingSid or "",
            duration=RecordingDuration or 0,
        )
    return {"status": "ok"}


# ── Plivo Voice & Bidirectional Media Stream Endpoints ───────────────────────
@router.websocket("/plivo/media-stream")
async def plivo_media_stream_endpoint(websocket: WebSocket, call_id: Optional[str] = None):
    """
    WebSocket endpoint for Plivo Bidirectional Media Stream.
    Handles continuous audio streaming, Deepgram STT, OpenAI LLM, and Cartesia TTS.
    """
    await websocket.accept()
    gateway = PlivoMediaGateway(websocket, call_id=call_id)
    await gateway.handle_stream()


@router.api_route("/plivo/answer/{call_id}", methods=["GET", "POST"])
async def plivo_answer_endpoint(
    call_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Called by Plivo when an outbound or routed call connects.
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
    call = db.query(Call).filter(
        (Call.id == call_id) | (Call.twilio_call_sid.like(f"%{call_id}%"))
    ).first()
    if call:
        call.status = "completed"
        db.commit()
        await voice_events_bus.broadcast({
            "type": "call.completed",
            "call_id": call.id,
            "call_sid": call.twilio_call_sid,
            "status": "completed",
        })
    return Response(content="<Response></Response>", media_type="application/xml")


@router.api_route("/plivo/inbound", methods=["GET", "POST"])
async def plivo_inbound_webhook(
    request: Request,
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    CallUUID: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Plivo posts here when a customer calls the Plivo phone number (+91 80 6552 2007).
    Identifies assigned employee, creates Call record, and returns bidirectional stream XML.
    """
    logger.info(f"Plivo inbound call received: From={From}, To={To}, CallUUID={CallUUID}")

    # Find phone record and assigned employee
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


# ── 6. Provider Health & Diagnostics ─────────────────────────────────────────
@router.get("/providers/health")
async def check_providers_health(db: Session = Depends(get_db)):
    """
    Live health check of all integrated providers:
    Plivo Telephony, Twilio Telephony, Deepgram STT, Cartesia TTS, and OpenAI Intelligence.
    Never fake success; returns actual operational status.
    """
    results: Dict[str, Any] = {}

    # 0. Plivo Telephony (Primary India Voice)
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

    # 1. Twilio
    if not settings.TWILIO_ACCOUNT_SID:
        results["twilio"] = {"status": "Not configured", "ready": False}
    else:
        try:
            client = get_twilio_client()
            acct = client.api.accounts(settings.TWILIO_ACCOUNT_SID).fetch()
            phone_count = len(client.incoming_phone_numbers.list(limit=5))
            results["twilio"] = {
                "status": "Healthy",
                "ready": True,
                "account_name": acct.friendly_name,
                "active_numbers": phone_count,
            }
        except Exception as e:
            results["twilio"] = {"status": "Error", "ready": False, "error": str(e)}

    # 2. Deepgram STT
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
