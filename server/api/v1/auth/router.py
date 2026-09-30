"""
SARA AI — Google OAuth & Business Onboarding Authentication Router
Provides:
- Google Identity Services token verification
- Google OAuth 2.0 authorization redirect & callback exchange
- Post-login Business Details onboarding step
- Current user profile & session verification
"""

import logging
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server.config import settings
from server.database import get_db
from server.auth import get_current_user
from server.models import User, Workspace, WorkspaceMember, Organization, CreditAccount
from server.engine.agent_compiler import AgentCompiler

logger = logging.getLogger("sara.api.auth")
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & Onboarding"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class GoogleVerifyRequest(BaseModel):
    credential: str  # Google ID token (JWT)


class DemoLoginRequest(BaseModel):
    email: Optional[str] = "owner@business.com"
    name: Optional[str] = "Business Owner"


class BusinessOnboardingRequest(BaseModel):
    business_name: str
    industry: str
    phone: Optional[str] = ""
    website: Optional[str] = ""
    locations: Optional[List[str]] = []
    operating_hours: Optional[str] = "09:00 AM – 09:00 PM IST"
    calling_instruction: Optional[str] = ""
    products_services: Optional[List[Dict[str, Any]]] = []
    voice_preference: Optional[str] = "te-IN-Standard-A"


# ── Helper: Get or Init User Workspace ────────────────────────────────────────

def get_or_create_user_workspace(db: Session, user: User) -> Workspace:
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if member:
        ws = db.query(Workspace).filter(Workspace.id == member.workspace_id).first()
        if ws:
            return ws

    # Create new Organization & Workspace for this user
    org_name = f"{user.display_name or user.name or 'My'} Business"
    org = Organization(
        name=org_name,
        timezone="Asia/Kolkata",
        currency="INR"
    )
    db.add(org)
    db.flush()

    ws = Workspace(
        organization_id=org.id,
        name=org_name,
        plan="growth",
        status="active",
        settings={}
    )
    db.add(ws)
    db.flush()

    mem = WorkspaceMember(
        workspace_id=ws.id,
        user_id=user.id,
        role="owner",
        status="active"
    )
    db.add(mem)

    # Initial credits
    credits = CreditAccount(workspace_id=ws.id, balance=1000.0, total_purchased=1000.0, plan="growth")
    db.add(credits)

    db.commit()
    return ws


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config")
def get_auth_config():
    """Return public OAuth client configuration for frontend Google Identity Services button."""
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID,
        "auth_methods": ["google", "demo"]
    }


@router.post("/google/verify")
async def verify_google_credential(
    payload: GoogleVerifyRequest,
    db: Session = Depends(get_db),
):
    """
    Verify Google Identity Services credential token (ID token) with Google's tokeninfo API.
    Creates or retrieves the User and checks if business onboarding is needed.
    """
    token = payload.credential
    if not token:
        raise HTTPException(status_code=400, detail="Missing Google credential token")

    google_user = None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}")
            if resp.status_code == 200:
                google_user = resp.json()
            else:
                logger.warning(f"Google tokeninfo error: {resp.text}")
    except Exception as e:
        logger.error(f"Error validating Google ID token: {e}")

    if not google_user or not google_user.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid Google Authentication Token")

    sub = google_user["sub"]
    email = google_user.get("email")
    name = google_user.get("name") or google_user.get("email", "").split("@")[0]
    picture = google_user.get("picture")

    user_id = f"google_{sub}"
    user = db.query(User).filter((User.id == user_id) | (User.email == email)).first()

    if not user:
        user = User(
            id=user_id,
            email=email,
            name=name,
            display_name=name,
            avatar_url=picture,
            auth_provider="google",
            status="active",
            role="business_user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update profile info
        if picture and not user.avatar_url:
            user.avatar_url = picture
        if name and not user.display_name:
            user.display_name = name
        db.commit()

    ws = get_or_create_user_workspace(db, user)
    biz = (ws.settings or {}).get("business_profile") or {}
    needs_onboarding = not bool(biz.get("business_name") and biz.get("industry"))

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.display_name or user.name,
            "avatar_url": user.avatar_url,
            "auth_provider": "google",
        },
        "workspace_id": ws.id,
        "needs_business_onboarding": needs_onboarding,
        "business_profile": biz
    }


@router.post("/demo-login")
async def demo_login(
    payload: DemoLoginRequest = Body(default=DemoLoginRequest()),
    db: Session = Depends(get_db),
):
    """
    Instant demo/test login for immediate access without Google Account.
    """
    email = payload.email or "owner@business.com"
    name = payload.name or "Business Owner"
    user_id = "user_demo_owner"

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            email=email,
            name=name,
            display_name=name,
            avatar_url="",
            auth_provider="demo",
            status="active"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    ws = get_or_create_user_workspace(db, user)
    biz = (ws.settings or {}).get("business_profile") or {}
    needs_onboarding = not bool(biz.get("business_name") and biz.get("industry"))

    return {
        "success": True,
        "token": "dev-token-demo",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.display_name or user.name,
            "avatar_url": "",
            "auth_provider": "demo",
        },
        "workspace_id": ws.id,
        "needs_business_onboarding": needs_onboarding,
        "business_profile": biz
    }


@router.get("/google/login")
def google_oauth_redirect():
    """
    Redirect browser to Google OAuth 2.0 Authorization Endpoint.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not configured.")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account"
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_oauth_callback(
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Exchange Google OAuth code for tokens, retrieve profile, and redirect to frontend.
    """
    if error or not code:
        return RedirectResponse(f"http://localhost:5174/?auth_error={error or 'cancelled'}")

    token_url = "https://oauth2.googleapis.com/token"
    candidate_uris = [
        settings.GOOGLE_REDIRECT_URI,
        "http://localhost:8001/api/space/google/callback/",
        "http://localhost:8001/api/space/google/callback",
        "http://localhost:8000/api/v1/auth/google/callback",
        "http://localhost:8000/api/space/google/callback/",
    ]
    # Remove duplicates preserving order
    seen = set()
    redirect_uris = [u for u in candidate_uris if u and not (u in seen or seen.add(u))]

    tokens = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for r_uri in redirect_uris:
                data = {
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": r_uri,
                    "grant_type": "authorization_code"
                }
                token_res = await client.post(token_url, data=data)
                if token_res.status_code == 200:
                    tokens = token_res.json()
                    logger.info(f"Google OAuth token exchange succeeded using redirect_uri: {r_uri}")
                    break
                else:
                    logger.warning(f"Google token exchange attempt failed for {r_uri}: {token_res.text}")

            if not tokens:
                logger.error(f"Failed to exchange Google code across all candidate URIs.")
                return RedirectResponse("http://localhost:5174/?auth_error=exchange_failed")

            id_token = tokens.get("id_token")
            access_token = tokens.get("access_token")

            # Fetch user profile
            userinfo_res = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            user_data = userinfo_res.json() if userinfo_res.status_code == 200 else {}
    except Exception as e:
        logger.error(f"Google OAuth callback error: {e}")
        return RedirectResponse("http://localhost:5174/?auth_error=server_error")

    sub = user_data.get("sub") or "google_user"
    email = user_data.get("email", "")
    name = user_data.get("name") or email.split("@")[0]
    picture = user_data.get("picture", "")

    user_id = f"google_{sub}"
    user = db.query(User).filter((User.id == user_id) | (User.email == email)).first()

    if not user:
        user = User(
            id=user_id,
            email=email,
            name=name,
            display_name=name,
            avatar_url=picture,
            auth_provider="google",
            status="active"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    ws = get_or_create_user_workspace(db, user)
    biz = (ws.settings or {}).get("business_profile") or {}
    needs_onboarding = "1" if not (biz.get("business_name") and biz.get("industry")) else "0"

    encoded_name = urllib.parse.quote(name)
    encoded_email = urllib.parse.quote(email)
    encoded_avatar = urllib.parse.quote(picture)

    return RedirectResponse(
        f"http://localhost:5174/?google_auth=success&token={id_token or access_token}&user_id={user.id}&name={encoded_name}&email={encoded_email}&avatar={encoded_avatar}&needs_onboarding={needs_onboarding}"
    )


@router.post("/business-onboarding")
async def complete_business_onboarding(
    body: BusinessOnboardingRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    After Google Login: Saves user's business details, compiles calling policy with AgentCompiler,
    and transitions user into the active Voice AI Studio.
    """
    ws = get_or_create_user_workspace(db, user)
    settings_dict = dict(ws.settings or {})

    # Auto-compile calling policy via AgentCompiler
    compiled_spec = None
    if body.calling_instruction:
        try:
            compiled_spec = AgentCompiler.compile(
                natural_input=f"Business: {body.business_name} ({body.industry}). Instruction: {body.calling_instruction}",
                language_preference="te" if "te" in (body.voice_preference or "") else "en"
            )
        except Exception as e:
            logger.warning(f"Error compiling business instruction during onboarding: {e}")

    policy_data = {
        "goal": compiled_spec.get("identity", {}).get("mission", "Qualify leads and book appointments") if compiled_spec else "Qualify leads and book appointments",
        "target": "New leads",
        "intro": f"Hello, this is Sara calling from {body.business_name}.",
        "questions": compiled_spec.get("tasks", ["Requirements", "Preferred timing"]) if compiled_spec else ["Requirements", "Preferred timing"],
        "offer": "Tailored packages with dedicated consultation",
        "success_condition": "Appointment or trial booked",
        "tone": compiled_spec.get("behavior", {}).get("personality", "Professional, warm, encouraging") if compiled_spec else "Professional, warm, encouraging",
        "guardrails": [
            "Never invent unverified prices or offerings.",
            "State numbers and prices in English numerals.",
            "Politely stop if caller requests not to be called."
        ]
    }

    biz_data = {
        "business_name": body.business_name,
        "industry": body.industry,
        "phone": body.phone,
        "website": body.website,
        "locations": body.locations or [],
        "operating_hours": body.operating_hours or "09:00 AM – 09:00 PM IST",
        "products_services": body.products_services or [],
        "calling_instruction": body.calling_instruction,
        "voice_preference": body.voice_preference or "te-IN-Standard-A",
        "policy": policy_data,
        "compiled_prompt": compiled_spec.get("system_prompt") if compiled_spec else ""
    }

    ws.name = body.business_name
    settings_dict["business_profile"] = biz_data
    settings_dict["onboarded"] = True
    ws.settings = settings_dict

    # Also update Organization name if present
    org = db.query(Organization).filter(Organization.id == ws.organization_id).first()
    if org:
        org.name = body.business_name
        org.industry = body.industry

    db.commit()

    return {
        "success": True,
        "message": f"Business details for '{body.business_name}' saved and Sara AI Policy compiled!",
        "business_profile": biz_data
    }


@router.get("/me")
async def get_current_user_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get authenticated user info, workspace, and business details.
    """
    ws = get_or_create_user_workspace(db, user)
    biz = (ws.settings or {}).get("business_profile") or {}
    needs_onboarding = not bool(biz.get("business_name") and biz.get("industry"))

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.display_name or user.name,
            "avatar_url": user.avatar_url,
            "auth_provider": user.auth_provider,
        },
        "workspace": {
            "id": ws.id,
            "name": ws.name,
            "plan": ws.plan,
        },
        "needs_business_onboarding": needs_onboarding,
        "business_profile": biz
    }
