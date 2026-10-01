"""SARA AI — /api/v1/workspaces + /api/v1/settings router"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import User, Workspace, WorkspaceMember, Organization

logger = logging.getLogger("sara.api.workspaces")
router = APIRouter(prefix="/api/v1/workspaces", tags=["Workspaces"])


class WorkspaceSetup(BaseModel):
    company_name: str
    industry: Optional[str] = None
    company_size: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    currency: str = "INR"


@router.get("/current")
async def get_current_workspace(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get or auto-create the user's workspace."""
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if member:
        ws = db.query(Workspace).filter(Workspace.id == member.workspace_id).first()
        org = db.query(Organization).filter(Organization.id == ws.organization_id).first()
        return {
            "workspace_id": ws.id,
            "name": ws.name,
            "plan": ws.plan,
            "status": ws.status,
            "organization": {
                "id": org.id if org else None,
                "name": org.name if org else ws.name,
                "industry": org.industry if org else None,
                "timezone": org.timezone if org else "Asia/Kolkata",
                "currency": org.currency if org else "INR",
            },
            "role": member.role,
        }

    # Auto-create org + workspace for new user
    org = Organization(
        name=f"{user.display_name or user.email or 'My'} Company",
        timezone="Asia/Kolkata",
        currency="INR",
    )
    db.add(org)
    db.flush()

    ws = Workspace(
        organization_id=org.id,
        name=f"{user.display_name or 'My'} Workspace",
        plan="growth",
        status="active",
    )
    db.add(ws)
    db.flush()

    member = WorkspaceMember(
        workspace_id=ws.id,
        user_id=user.id,
        role="owner",
        status="active",
    )
    db.add(member)

    from server.models import CreditAccount
    credit = CreditAccount(workspace_id=ws.id, balance=1000.0, total_purchased=1000.0, plan="growth")
    db.add(credit)

    db.commit()
    return {
        "workspace_id": ws.id,
        "name": ws.name,
        "plan": ws.plan,
        "status": ws.status,
        "organization": {"id": org.id, "name": org.name, "industry": None, "timezone": org.timezone, "currency": org.currency},
        "role": "owner",
    }


@router.post("/setup")
async def setup_workspace(
    body: WorkspaceSetup,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Initial onboarding workspace setup."""
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if not member:
        raise HTTPException(404, "No workspace found. Call /current first.")

    ws = db.query(Workspace).filter(Workspace.id == member.workspace_id).first()
    org = db.query(Organization).filter(Organization.id == ws.organization_id).first()

    ws.name = body.company_name + " Workspace"
    if org:
        org.name = body.company_name
        org.industry = body.industry
        org.company_size = body.company_size
        org.timezone = body.timezone
        org.currency = body.currency

    db.commit()
    return {"message": "Workspace configured successfully"}


@router.get("/members")
async def list_members(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if not member:
        return {"data": []}

    members = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == member.workspace_id
    ).all()

    result = []
    for m in members:
        u = db.query(User).filter(User.id == m.user_id).first()
        result.append({
            "user_id": m.user_id,
            "name": u.display_name or u.email if u else m.user_id,
            "email": u.email if u else None,
            "role": m.role,
            "status": m.status,
            "joined_at": m.joined_at.isoformat() if m.joined_at else None,
        })
    return {"data": result}
