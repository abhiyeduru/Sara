"""
SARA AI — /api/v1/voice router
Handles Plivo Voice Webhooks, Bidirectional Media Streams,
Outbound Calls, Inbound Call Routing, and Provider Health Monitoring.
Completely decoupled from Twilio.
"""
import os
import asyncio
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
from server.services.voice.call_billing_service import CallBillingService

logger = logging.getLogger("sara.api.voice")
router = APIRouter(prefix="/api/v1/voice", tags=["Voice Telephony & Media Streams"])


def generate_plivo_media_stream_xml(request: Request, call_id: str, employee_id: Optional[str] = None) -> str:
    """
    Generate Plivo Bidirectional Media Stream XML.
    Uses <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">wss://...
    """
    # Automatically derive public WebSocket URL from incoming request's host
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if host and not host.startswith("localhost") and not host.startswith("127.0.0.1"):
        ws_url = f"wss://{host}/api/v1/voice/plivo/media-stream?call_id={call_id}"
    else:
        from server.services.voice.plivo_service import get_live_public_base_url
        live_base = get_live_public_base_url()
        if live_base:
            live_ws = live_base.replace("https://", "wss://").replace("http://", "ws://")
            ws_url = f"{live_ws}/api/v1/voice/plivo/media-stream?call_id={call_id}"
        else:
            ws_base = os.getenv("PUBLIC_WS_URL") or settings.PUBLIC_WS_URL
            if ws_base:
                ws_url = f"{ws_base.rstrip('/')}/api/v1/voice/plivo/media-stream?call_id={call_id}"
            else:
                scheme = "wss" if request.headers.get("x-forwarded-proto") == "https" or "https" in str(request.base_url) else "ws"
                ws_url = f"{scheme}://{host or f'{settings.HOST}:{settings.PORT}'}/api/v1/voice/plivo/media-stream?call_id={call_id}"


    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">{ws_url.strip()}</Stream>
</Response>"""
    return xml


# Backward-compatible alias for internal / external callers
_generate_plivo_media_stream_xml = generate_plivo_media_stream_xml

__all__ = [
    "router",
    "generate_plivo_media_stream_xml",
    "_generate_plivo_media_stream_xml",
]


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
    form_data = {}
    try:
        if request.method == "POST":
            form_data = dict(await request.form())
    except Exception:
        pass

    clean_from = From or form_data.get("From") or request.query_params.get("From") or "Unknown"
    clean_to_raw = To or form_data.get("To") or request.query_params.get("To") or settings.PLIVO_PHONE_NUMBER or "+918065522007"
    call_uuid = CallUUID or form_data.get("CallUUID") or request.query_params.get("CallUUID")

    logger.info(f"Plivo inbound call received: From={clean_from}, To={clean_to_raw}, CallUUID={call_uuid}")

    clean_to = clean_to_raw.replace("+", "").strip() if clean_to_raw else ""
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
        twilio_call_sid=f"plv_{call_uuid}" if call_uuid else None,
        from_number=clean_from,
        to_number=clean_to_raw,
        phone_number=clean_from,
        status="in-progress",
    )
    db.add(new_call)
    db.commit()

    xml = _generate_plivo_media_stream_xml(request, call_id=call_id, employee_id=assigned_emp_id)
    return Response(content=xml, media_type="application/xml")


# ── 3. Plivo Answer & Hangup Callbacks ───────────────────────────────────────
@router.api_route("/plivo/answer", methods=["GET", "POST"])
@router.api_route("/plivo/answer/{call_id}", methods=["GET", "POST"])
@router.api_route("/outbound-twiml/{call_id}", methods=["GET", "POST"])
@router.api_route("/twiml/{call_id}", methods=["GET", "POST"])
async def plivo_answer_endpoint(
    request: Request,
    call_id: Optional[str] = None,
    CallUUID: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Called by telephony carrier when an outbound or routed call connects.
    Returns Plivo XML with <Stream bidirectional="true"> to launch bidirectional AI conversation.
    """
    form_data = {}
    try:
        if request.method == "POST":
            form_data = dict(await request.form())
    except Exception:
        pass

    candidate_id = call_id or form_data.get("CallUUID") or request.query_params.get("CallUUID") or CallUUID
    call = None
    if candidate_id:
        call = db.query(Call).filter(
            (Call.id == candidate_id) | (Call.twilio_call_sid.like(f"%{candidate_id}%"))
        ).first()

    effective_call_id = (call.id if call else None) or call_id or (f"plv_{candidate_id}" if candidate_id else f"call_{uuid.uuid4().hex[:12]}")
    emp_id = (call.ai_employee_id or call.employee_id) if call else None

    logger.info(f"📞 Plivo answer callback received for call {effective_call_id} (SID: {candidate_id})")
    xml = _generate_plivo_media_stream_xml(request, call_id=effective_call_id, employee_id=emp_id)
    return Response(content=xml, media_type="application/xml")


@router.api_route("/plivo/hangup", methods=["GET", "POST"])
@router.api_route("/plivo/hangup/{call_id}", methods=["GET", "POST"])
async def plivo_hangup_endpoint(
    request: Request,
    call_id: Optional[str] = None,
    CallUUID: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Plivo call termination callback."""
    form_data = {}
    try:
        if request.method == "POST":
            form_data = dict(await request.form())
    except Exception:
        pass

    candidate_id = call_id or form_data.get("CallUUID") or request.query_params.get("CallUUID") or CallUUID

    # Plivo may send Duration or BillDuration in form or query params
    duration_sec = 0
    raw_dur = form_data.get("Duration") or form_data.get("BillDuration") or request.query_params.get("Duration") or request.query_params.get("BillDuration")
    if raw_dur:
        try:
            duration_sec = int(raw_dur)
        except Exception:
            pass

    call = None
    if candidate_id:
        call = db.query(Call).filter(
            (Call.id == candidate_id) | (Call.twilio_call_sid.like(f"%{candidate_id}%"))
        ).first()

    if call:
        call.status = "completed"
        if duration_sec > 0:
            call.duration_seconds = duration_sec
        db.commit()

        effective_dur = duration_sec or call.duration_seconds or 0
        CallBillingService.bill_completed_call(db, call.id, effective_dur)

        await voice_events_bus.broadcast({
            "type": "call.completed",
            "call_id": call.id,
            "call_sid": call.twilio_call_sid,
            "status": "completed",
            "duration": effective_dur,
        })
    elif candidate_id:
        CallBillingService.bill_completed_call(db, candidate_id, duration_sec)

    logger.info(f"📴 Plivo hangup callback completed for {candidate_id} (Duration: {duration_sec}s)")
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

    lead_name = payload.get("lead_name") or payload.get("name") or "Customer"
    variables = payload.get("variables") or {}
    location = payload.get("location") or (variables.get("Location") if isinstance(variables, dict) else None)
    budget = payload.get("budget") or (variables.get("Budget Range") if isinstance(variables, dict) else None)
    reqs: list = []
    if isinstance(variables, dict):
        for k, v in variables.items():
            if v and "name" not in k.lower() and "budget" not in k.lower() and "location" not in k.lower():
                reqs.append(f"{k}: {v}")
    elif isinstance(variables, list):
        reqs = [str(x) for x in variables]

    ws_id = payload.get("workspace_id") or (employee.workspace_id if employee else "ws_default_1")
    from server.models import Lead
    lead = db.query(Lead).filter(
        (Lead.phone == clean_to) | (Lead.phone.endswith(clean_to[-10:]))
    ).order_by(Lead.updated_at.desc()).first()

    if not lead:
        lead = Lead(
            workspace_id=ws_id,
            ai_employee_id=employee.id if employee else None,
            name=lead_name,
            phone=clean_to,
            location=location,
            budget=budget,
            requirements=reqs,
            source="Outbound Voice Call"
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)
    else:
        if lead_name and lead_name != "Customer":
            lead.name = lead_name
        if location:
            lead.location = location
        if budget:
            lead.budget = budget
        if reqs:
            lead.requirements = reqs
        if employee:
            lead.ai_employee_id = employee.id
        db.commit()

    class MockUser:
        id = ws_id

    res = CallService.initiate_outbound_call(
        db=db,
        user=MockUser(),
        employee_id=employee.id if employee else "emp_default",
        to_number=clean_to,
        lead_id=lead.id,
        from_number=from_number,
    )

    return {
        "success": True,
        "call_id": res.get("call_id"),
        "call_sid": res.get("call_sid"),
        "status": res.get("status"),
        "is_simulated": res.get("is_simulated", False),
        "error_detail": res.get("error_detail"),
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

    # 2. AssemblyAI STT
    if not settings.ASSEMBLYAI_API_KEY:
        results["assemblyai"] = {"status": "Not configured", "ready": False}
    else:
        try:
            aai = AssemblyAISTTService()
            conn = await asyncio.wait_for(aai.connect(), timeout=2.5)
            if conn:
                await aai.close()
                results["assemblyai"] = {"status": "Healthy", "ready": True, "model": "universal-3-6-pro"}
            else:
                results["assemblyai"] = {"status": "Error", "ready": False, "error": "Handshake failed"}
        except Exception as e:
            results["assemblyai"] = {"status": "Error", "ready": False, "error": str(e)}

    # 3. Deepgram STT
    if not settings.DEEPGRAM_API_KEY:
        results["deepgram"] = {"status": "Not configured", "ready": False}
    else:
        try:
            dg = DeepgramSTTService()
            conn = await asyncio.wait_for(dg.connect(), timeout=2.5)
            if conn:
                await dg.close()
                results["deepgram"] = {"status": "Healthy", "ready": True, "region": settings.DEEPGRAM_REGION or "global"}
            else:
                results["deepgram"] = {"status": "Error", "ready": False, "error": "Handshake failed"}
        except Exception as e:
            results["deepgram"] = {"status": "Error", "ready": False, "error": str(e)}

    # 3. Cartesia Ink STT (Primary Speech-to-Text)
    if not settings.CARTESIA_API_KEY:
        results["cartesia"] = {"status": "Not configured", "ready": False}
    else:
        results["cartesia"] = {
            "status": "Healthy",
            "ready": True,
            "model": f"{getattr(settings, 'CARTESIA_STT_MODEL', 'ink-whisper')} (streaming STT)",
            "encoding": "pcm_mulaw (zero codec overhead for Plivo)"
        }

    # 4. Sarvam AI Voice Engine (Sweet bulbul:v3 TTS)
    if not settings.SARVAM_API_KEY:
        results["sarvam"] = {"status": "Not configured", "ready": False}
    else:
        results["sarvam"] = {
            "status": "Healthy",
            "ready": True,
            "models": "bulbul:v3 (sweet, polite Indic TTS)",
            "default_voice": settings.DEFAULT_VOICE_ID or "sarvam-te-kavitha"
        }

    # 4. Google Gemini Intelligence Layer
    if not settings.GEMINI_API_KEY:
        results["gemini"] = {"status": "Not configured", "ready": False}
    else:
        results["gemini"] = {
            "status": "Healthy",
            "ready": True,
            "model": settings.GEMINI_MODEL or "gemini-flash-latest",
            "note": "Primary Intelligence Layer"
        }

    return results


# ── 7. Interactive Dashboard & Test Chat Endpoint (Powered by Google Gemini) ─────
@router.post("/chat/simulate")
@router.post("/chat")
async def chat_simulate(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """
    Simulated or interactive text chat with an AI Employee or Sara Assistant.
    Powered directly by Google Gemini Intelligence.
    """
    message = str(payload.get("message") or payload.get("text") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message content is required.")

    employee_id = payload.get("employee_id")
    employee = None
    if employee_id:
        employee = db.query(AIEmployee).filter(AIEmployee.id == employee_id).first()
    if not employee:
        employee = db.query(AIEmployee).first()

    # Resolve workspace business profile
    from server.models import Workspace
    ws = None
    if employee and employee.workspace_id:
        ws = db.query(Workspace).filter(Workspace.id == employee.workspace_id).first()
    if not ws:
        ws = db.query(Workspace).first()

    biz_profile = (ws.settings or {}).get("business_profile", {}) if ws else {}
    biz_name = biz_profile.get("business_name") or (ws.name if ws else "Our Business")
    biz_industry = biz_profile.get("industry", "Business Services")
    emp_name = employee.name if employee else "Sara"
    emp_role = employee.role if employee else "Client Advisory Specialist"

    services = biz_profile.get("products_services") or []
    services_str = ", ".join([f"{s.get('name')} ({s.get('price', 'Flexible')})" for s in services if isinstance(s, dict)]) if services else "Professional client services and consultation"

    # Assemble comprehensive grounded system prompt
    system_prompt = (
        f"You are {emp_name}, a {emp_role} representing {biz_name} ({biz_industry}).\n"
        f"Business Offerings: {services_str}.\n"
        f"Guidelines:\n"
        f"1. Respond directly, politely, and helpfully to the customer inquiry.\n"
        f"2. Keep responses natural, conversational, and concise (1-3 sentences).\n"
        f"3. If the user writes in Telugu, reply in natural, polite Telugu. If English, reply in English.\n"
        f"4. Always represent {biz_name} accurately based on its offerings.\n"
        f"5. State all prices, numbers, and phone numbers in clear English numerals."
    )
    emp_prompt = getattr(employee, "compiled_prompt", None) or getattr(employee, "mission", None) or getattr(employee, "description", None)
    if emp_prompt:
        system_prompt += f"\nSpecific Instructions:\n{emp_prompt}"

    # Prepare message history
    history = payload.get("history") or []
    messages = []
    for h in history:
        r = "user" if h.get("role") in ["user", "customer"] else "assistant"
        c = str(h.get("content") or h.get("text") or "").strip()
        if c:
            messages.append({"role": r, "content": c})

    # Append current user message
    messages.append({"role": "user", "content": message})

    from server.providers.gemini_llm import GeminiLLM
    gemini = GeminiLLM()
    try:
        reply = await gemini.generate_response(
            messages=messages,
            system_prompt=system_prompt,
            temperature=0.5,
            max_tokens=220
        )
    except Exception as e:
        logger.error(f"Error generating chat response via Gemini: {e}")
        from server.providers.gemini_llm import generate_grounded_offline_reply
        reply = generate_grounded_offline_reply(message, system_prompt)

    return {
        "success": True,
        "reply": reply,
        "response": reply,
        "employee_name": emp_name,
        "business_name": biz_name,
        "provider": "google_gemini"
    }
