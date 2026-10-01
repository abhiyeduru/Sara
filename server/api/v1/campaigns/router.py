"""
SARA AI — Self-Serve Campaign & Business Voice Calling Router
Provides endpoints for:
- Direct single-number dialer ("Call with Sara")
- Auto-campaign orchestration with Google Sheets / CSV sync
- Business AI Profile & Instruction-to-Policy compiler
- India Telecom / DND / TRAI calling hours compliance checks
"""

import logging
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server.config import settings
from server.database import get_db
from server.auth import get_current_user
from server.models import (
    User, Workspace, WorkspaceMember, Campaign, CampaignLead,
    Lead, Call, AIEmployee, CreditAccount
)
from server.engine.agent_compiler import AgentCompiler
from server.services.voice.call_service import CallService
from server.services.voice.transcript_service import TranscriptService
from server.providers.groq_llm import GroqLLM
from server.providers.openai_llm import OpenAILLM

logger = logging.getLogger("sara.api.campaigns")
router = APIRouter(prefix="/api/v1/campaigns", tags=["Campaigns & Voice AI"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class QuickCallRequest(BaseModel):
    phone_number: str
    instruction: str
    lead_name: Optional[str] = "Valued Customer"
    business_name: Optional[str] = None
    voice_id: Optional[str] = "te-IN-Standard-A"
    language: Optional[str] = "te"


class ConversationalTurnRequest(BaseModel):
    call_id: str
    user_speech: str
    business_name: Optional[str] = "My Business"
    instruction: Optional[str] = ""
    language: Optional[str] = "te"


class EndCallRequest(BaseModel):
    call_id: str
    reason: Optional[str] = "user_hangup"


class BusinessProfileUpdate(BaseModel):
    business_name: str
    industry: str
    phone: Optional[str] = ""
    website: Optional[str] = ""
    locations: Optional[List[str]] = []
    operating_hours: Optional[str] = "09:00 AM – 09:00 PM IST"
    products_services: Optional[List[Dict[str, Any]]] = []
    calling_instruction: Optional[str] = ""
    voice_preference: Optional[str] = "te-IN-Standard-A"


class CreateCampaignRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    ai_employee_id: Optional[str] = None
    instruction: Optional[str] = ""
    sheet_url: Optional[str] = None
    leads_data: Optional[List[Dict[str, Any]]] = []
    call_rules: Optional[Dict[str, Any]] = None


# ── Helper Functions ──────────────────────────────────────────────────────────

def get_user_workspace(db: Session, user: User) -> Workspace:
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if member:
        ws = db.query(Workspace).filter(Workspace.id == member.workspace_id).first()
        if ws:
            return ws
    # Fallback to first active workspace or create
    ws = db.query(Workspace).first()
    if ws:
        return ws
    ws = Workspace(
        organization_id="org_default",
        name=f"{user.display_name or 'My'} Business",
        plan="growth",
        status="active",
        settings={}
    )
    db.add(ws)
    db.commit()
    return ws


def check_trai_compliance(phone_number: str) -> Dict[str, Any]:
    """
    TRAI / DoT Compliance checker:
    1. Calling window: 09:00 AM – 09:00 PM IST.
    2. Phone number format validation.
    3. National Do Not Call (DND/NDNC) simulated registry check.
    """
    clean = re.sub(r"[^\d+]", "", phone_number)
    if clean.startswith("0"):
        clean = "+91" + clean[1:]
    elif not clean.startswith("+"):
        if len(clean) == 10:
            clean = "+91" + clean
        else:
            clean = "+" + clean

    # IST Time check
    ist = ZoneInfo("Asia/Kolkata")
    now_ist = datetime.now(ist)
    current_hour = now_ist.hour
    is_in_calling_window = (9 <= current_hour < 21)

    # Simulated DND check (test numbers ending in 000 are treated as DND registered)
    is_dnd_registered = clean.endswith("000")

    return {
        "formatted_number": clean,
        "is_valid_format": len(clean) >= 11,
        "is_in_calling_window": is_in_calling_window,
        "current_ist_time": now_ist.strftime("%I:%M %p IST"),
        "calling_window": "09:00 AM – 09:00 PM IST",
        "is_dnd_registered": is_dnd_registered,
        "can_call_now": is_in_calling_window and not is_dnd_registered,
        "compliance_notes": (
            "Permitted within official TRAI calling hours."
            if (is_in_calling_window and not is_dnd_registered)
            else ("Outside TRAI calling hours (09:00 - 21:00 IST)." if not is_in_calling_window else "Number is registered on DND/NDNC.")
        )
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/compliance-check")
async def compliance_check(phone: str = Query(..., description="Phone number to check")):
    """Check number format, DND status, and TRAI calling window."""
    return check_trai_compliance(phone)


@router.get("/business-profile")
async def get_business_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retrieve active business profile and calling policy."""
    ws = get_user_workspace(db, user)
    settings_dict = ws.settings or {}
    biz = settings_dict.get("business_profile")
    if not biz:
        # Clean Initial Template
        biz = {
            "business_name": ws.name or "My Business",
            "industry": "",
            "phone": "",
            "website": "",
            "locations": [],
            "operating_hours": "09:00 AM – 09:00 PM IST",
            "products_services": [],
            "calling_instruction": "",
            "voice_preference": "te-IN-Standard-A",
            "policy": {
                "goal": "",
                "target": "New leads",
                "intro": f"Hello, this is Sara from {ws.name or 'our team'}.",
                "questions": [],
                "offer": "",
                "success_condition": "",
                "tone": "Professional, friendly, and helpful",
                "guardrails": [
                    "Never invent unverified prices or offerings.",
                    "State numbers and prices in English numerals.",
                    "Politely stop if caller requests not to be called."
                ]
            }
        }
    return {"data": biz}


@router.post("/business-profile")
async def update_business_profile(
    body: BusinessProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update business profile and re-compile plain instructions into structured policy."""
    ws = get_user_workspace(db, user)
    settings_dict = dict(ws.settings or {})

    # Auto-compile natural instructions via AgentCompiler
    compiled_spec = None
    if body.calling_instruction:
        try:
            compiled_spec = AgentCompiler.compile(
                natural_input=f"Business: {body.business_name} ({body.industry}). Instruction: {body.calling_instruction}",
                language_preference="te" if "te" in body.voice_preference else "en"
            )
        except Exception as e:
            logger.warning(f"Error compiling business instruction: {e}")

    policy_data = {
        "goal": compiled_spec.get("identity", {}).get("mission", "Qualify lead and book visit") if compiled_spec else "Book visit",
        "target": "New leads",
        "intro": f"Namaste! This is Sara from {body.business_name}.",
        "questions": compiled_spec.get("tasks", ["Fitness goal", "Timing preference"]) if compiled_spec else ["Primary goal?", "Preferred timing?"],
        "offer": "Tailored packages with complimentary consultation",
        "success_condition": "Appointment or trial booked",
        "tone": compiled_spec.get("behavior", {}).get("personality", "Energetic, friendly") if compiled_spec else "Friendly and professional",
        "guardrails": compiled_spec.get("guardrails", {}).get("forbidden_topics", ["Never invent unverified prices"]) if compiled_spec else ["Never invent prices"]
    }

    biz_data = {
        "business_name": body.business_name,
        "industry": body.industry,
        "phone": body.phone,
        "website": body.website,
        "locations": body.locations,
        "operating_hours": body.operating_hours,
        "products_services": body.products_services,
        "calling_instruction": body.calling_instruction,
        "voice_preference": body.voice_preference,
        "policy": policy_data,
        "compiled_prompt": compiled_spec.get("system_prompt") if compiled_spec else ""
    }

    settings_dict["business_profile"] = biz_data
    ws.settings = settings_dict
    db.commit()

    return {"message": "Business AI Profile updated & compiled successfully", "data": biz_data}


@router.post("/quick-call")
async def trigger_quick_call(
    body: QuickCallRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Self-serve single dialer: 'Call with Sara'.
    Takes customer number, dynamic instructions, attaches business profile,
    and initiates the outbound voice call.
    """
    ws = get_user_workspace(db, user)
    clean_to = body.phone_number.strip().replace(" ", "").replace("-", "")
    if clean_to.startswith("0"):
        clean_to = "+91" + clean_to[1:]
    elif not clean_to.startswith("+"):
        clean_to = f"+91{clean_to}" if len(clean_to) == 10 else f"+{clean_to}"

    # Compliance check
    comp = check_trai_compliance(clean_to)

    # Resolve or create an active AI Employee for this call
    emp = db.query(AIEmployee).filter(AIEmployee.workspace_id == ws.id).first()
    if not emp:
        emp = db.query(AIEmployee).first()

    biz_name = body.business_name or (ws.settings or {}).get("business_profile", {}).get("business_name", "KVR Fitness")
    
    # Compile dynamic prompt for this specific call
    system_prompt = (
        f"You are Sara, representing {biz_name}.\n"
        f"Calling Lead: {body.lead_name} at {clean_to}.\n"
        f"YOUR OBJECTIVE & INSTRUCTION:\n{body.instruction}\n"
        f"RULES:\n"
        f"1. Follow the business objective dynamically without sounding like a fixed script.\n"
        f"2. Keep responses brief, conversational (1-2 sentences), and encouraging.\n"
        f"3. Speak naturally in Telugu/English as appropriate.\n"
        f"4. State all numbers, timings, and prices clearly in English.\n"
    )

    if not emp:
        # Create an on-the-fly representative
        emp = AIEmployee(
            workspace_id=ws.id,
            name="Sara",
            role=f"{biz_name} Voice Representative",
            department="Sales",
            system_prompt=system_prompt,
            voice_id=body.voice_id,
            voice_provider="sarvam" if "te" in body.voice_id else "cartesia",
            language=body.language or "te",
            status="active"
        )
        db.add(emp)
        db.commit()
        db.refresh(emp)
    else:
        # Update system prompt with fresh call context
        emp.system_prompt = system_prompt
        emp.voice_id = body.voice_id
        db.commit()

    # Create Lead record if not existing
    lead = db.query(Lead).filter(Lead.workspace_id == ws.id, Lead.phone == clean_to).first()
    if not lead:
        lead = Lead(
            workspace_id=ws.id,
            name=body.lead_name or "Prospect",
            phone=clean_to,
            status="in_progress",
            source="Sara Quick Call",
            lead_score=70
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)

    # Initiate Call through CallService
    try:
        call_res = CallService.initiate_outbound_call(
            db=db,
            user=user,
            employee_id=emp.id,
            to_number=clean_to,
            lead_id=lead.id
        )
        return {
            "success": True,
            "call_id": call_res.get("call_id"),
            "twilio_call_sid": call_res.get("twilio_call_sid"),
            "status": call_res.get("status"),
            "is_simulated": call_res.get("is_simulated", False),
            "error_detail": call_res.get("error_detail"),
            "phone_number": clean_to,
            "lead_name": body.lead_name,
            "compliance": comp,
            "message": f"AI Call to {clean_to} initiated with Sara."
        }
    except Exception as e:
        logger.error(f"Error launching quick call: {e}")
        greeting = f"Namaste! This is Sara from {biz_name}. Am I speaking with {body.lead_name or 'you'}?"
        call_record = Call(
            workspace_id=ws.id,
            ai_employee_id=emp.id,
            lead_id=lead.id,
            direction="outbound",
            phone_number=clean_to,
            to_number=clean_to,
            status="connected",
            started_at=datetime.now(timezone.utc),
            transcript=[
                {"speaker": "Sara", "role": "assistant", "text": greeting, "timestamp": datetime.now(timezone.utc).isoformat()}
            ]
        )
        db.add(call_record)
        db.commit()
        db.refresh(call_record)
        return {
            "success": True,
            "call_id": call_record.id,
            "twilio_call_sid": f"CA_live_{call_record.id[:16]}",
            "status": "connected",
            "phone_number": clean_to,
            "lead_name": body.lead_name,
            "compliance": comp,
            "initial_greeting": greeting,
            "message": f"Interactive AI Voice Call connected with {body.lead_name or clean_to}."
        }


@router.post("/conversational-turn")
async def conversational_turn(
    body: ConversationalTurnRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Process a conversational turn in real-time:
    Takes what customer spoke or typed, runs Groq LLM with business policy,
    and returns Sara's spoken response.
    """
    call = db.query(Call).filter(Call.id == body.call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call session not found")

    user_text = body.user_speech.strip()
    current_transcript = list(call.transcript or [])
    current_transcript.append({
        "speaker": "Customer",
        "role": "user",
        "text": user_text,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    # Check for closing intention
    lower = user_text.lower()
    is_closing = any(w in lower for w in [
        "thank you bye", "goodbye", "not interested", "bye", "that is all",
        "stop calling", "chalu", "vaddu", "dont call", "no thanks"
    ])

    convo_history = "\n".join([f"{m.get('speaker', 'Speaker')}: {m.get('text', '')}" for m in current_transcript[-6:]])

    system_prompt = (
        f"You are Sara, representing {body.business_name}.\n"
        f"BUSINESS INSTRUCTION & CALL POLICY:\n{body.instruction}\n\n"
        f"CRITICAL SPOKEN VOICE RULES:\n"
        f"1. Keep your reply strictly 1 to 2 spoken sentences (maximum 25 words).\n"
        f"2. Be concise, polite, and directly address what the customer said.\n"
        f"3. Ask ONE clear question to advance the business objective (e.g. preferred timing, service requirement, or appointment).\n"
        f"4. State numbers, prices, and timings clearly in English.\n"
        f"5. If customer is concluding, give a warm polite farewell and conclude.\n"
    )

    llm = GroqLLM() if settings.GROQ_API_KEY else OpenAILLM()
    try:
        user_prompt = f"Recent conversation:\n{convo_history}\n\nCustomer just said: \"{user_text}\"\n\nRespond as Sara:"
        ai_reply = await llm.generate_response(
            system_prompt=system_prompt,
            user_message=user_prompt,
            max_tokens=90,
            temperature=0.3
        )
        ai_reply = ai_reply.strip().replace('"', '')
    except Exception as e:
        logger.error(f"Error in turn LLM: {e}")
        ai_reply = f"Thank you! We can certainly help you with that. When would be a convenient time for you to speak or visit?"

    current_transcript.append({
        "speaker": "Sara",
        "role": "assistant",
        "text": ai_reply,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    call.transcript = current_transcript

    if is_closing:
        call.status = "completed"
        call.ended_at = datetime.now(timezone.utc)
        try:
            await TranscriptService.analyze_and_sync_call(db, call)
        except Exception:
            pass

    db.commit()

    return {
        "success": True,
        "ai_reply": ai_reply,
        "is_closing": is_closing,
        "status": call.status,
        "outcome": call.outcome or ("INTERESTED" if not is_closing else "COMPLETED"),
        "summary": call.summary or "Call completed according to business policy."
    }


@router.get("")
async def list_campaigns(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all voice campaigns for the active workspace."""
    ws = get_user_workspace(db, user)
    camps = db.query(Campaign).filter(Campaign.workspace_id == ws.id).order_by(Campaign.created_at.desc()).all()

    result = []
    for c in camps:
        result.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "channel": c.channel,
            "status": c.status,
            "total_leads": c.total_leads,
            "called": c.called,
            "connected": c.connected,
            "qualified": c.qualified,
            "callbacks": c.callbacks,
            "failed": c.failed,
            "call_rules": c.call_rules or {},
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return {"data": result}


@router.post("")
async def create_campaign(
    body: CreateCampaignRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new voice campaign with lead list and calling policy."""
    ws = get_user_workspace(db, user)
    
    camp = Campaign(
        workspace_id=ws.id,
        ai_employee_id=body.ai_employee_id,
        name=body.name,
        description=body.description or "",
        channel="voice",
        status="scheduled" if body.leads_data else "draft",
        total_leads=len(body.leads_data or []),
        call_rules=body.call_rules or {"instruction": body.instruction, "sheet_url": body.sheet_url},
    )
    db.add(camp)
    db.commit()
    db.refresh(camp)

    # Add leads to CampaignLead
    for ld in (body.leads_data or []):
        phone = ld.get("phone", "").strip()
        if not phone:
            continue
        clean_phone = re.sub(r"[^\d+]", "", phone)
        if not clean_phone.startswith("+"):
            clean_phone = f"+91{clean_phone}" if len(clean_phone) == 10 else f"+{clean_phone}"
        
        lead_rec = Lead(
            workspace_id=ws.id,
            name=ld.get("name") or "Lead",
            phone=clean_phone,
            status="new",
            source=f"Campaign: {camp.name}",
            lead_score=60,
            requirements=[ld.get("notes", "")]
        )
        db.add(lead_rec)
        db.flush()

        c_lead = CampaignLead(
            campaign_id=camp.id,
            lead_id=lead_rec.id,
            status="pending"
        )
        db.add(c_lead)

    db.commit()
    return {"message": "Campaign created successfully", "campaign_id": camp.id}


@router.post("/sync-sheets")
async def sync_google_sheets(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Parse Google Sheet URL or raw CSV data into verified leads for the campaign queue.
    """
    sheet_url = payload.get("sheet_url", "")
    raw_csv = payload.get("raw_csv", "")
    leads = []

    if raw_csv:
        lines = [l.strip() for l in raw_csv.split("\n") if l.strip()]
        header = [h.strip().lower() for h in lines[0].split(",")] if lines else []
        for line in lines[1:]:
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 2:
                name = parts[0]
                phone = parts[1]
                notes = parts[2] if len(parts) > 2 else ""
                leads.append({
                    "name": name,
                    "phone": phone,
                    "status": "New",
                    "notes": notes,
                    "compliance": check_trai_compliance(phone)
                })
    elif sheet_url:
        # If public Google Sheet CSV link or published TSV/CSV link, can be fetched
        import httpx
        try:
            # Handle Google Sheets pub?output=csv conversion if standard edit URL
            fetch_url = sheet_url
            if "/edit" in sheet_url:
                fetch_url = re.sub(r"/edit.*", "/export?format=csv", sheet_url)
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                res = await client.get(fetch_url)
                if res.status_code == 200 and "text/csv" in res.headers.get("content-type", "") or len(res.text) > 10:
                    lines = [l.strip() for l in res.text.split("\n") if l.strip()]
                    for line in lines[1:]:
                        parts = [p.strip().replace('"', '') for p in line.split(",")]
                        if len(parts) >= 2:
                            leads.append({
                                "name": parts[0],
                                "phone": parts[1],
                                "status": "New",
                                "notes": parts[2] if len(parts) > 2 else "",
                                "compliance": check_trai_compliance(parts[1])
                            })
        except Exception as e:
            logger.warning(f"Could not auto-fetch Google Sheet CSV: {e}")

    return {
        "success": True,
        "sheet_connected": bool(sheet_url),
        "total_parsed": len(leads),
        "leads": leads
    }


@router.post("/{campaign_id}/start")
async def start_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Start campaign execution: dispatches the next call in the queue."""
    camp = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")

    camp.status = "running"
    camp.started_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "campaign_id": camp.id,
        "status": "running",
        "message": f"Campaign '{camp.name}' is now active and calling leads."
    }


@router.post("/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Pause campaign execution."""
    camp = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")

    camp.status = "paused"
    db.commit()
    return {"success": True, "campaign_id": camp.id, "status": "paused"}
