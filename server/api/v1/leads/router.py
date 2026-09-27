"""SARA AI — /api/v1/leads router"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import Lead, User

logger = logging.getLogger("sara.api.leads")
router = APIRouter(prefix="/api/v1/leads", tags=["Leads"])


class LeadCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    source: str = "Website"
    intent: Optional[str] = None
    budget: Optional[str] = None
    timeline: Optional[str] = None
    requirements: list = []
    ai_employee_id: Optional[str] = None

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = None
    pipeline_stage: Optional[str] = None
    lead_score: Optional[int] = None
    intent: Optional[str] = None
    budget: Optional[str] = None
    next_action: Optional[str] = None
    ai_employee_id: Optional[str] = None


def _lead_dict(l: Lead) -> dict:
    return {
        "id": l.id,
        "name": l.name,
        "phone": l.phone,
        "email": l.email,
        "company": l.company,
        "location": l.location,
        "source": l.source,
        "status": l.status,
        "pipeline_stage": l.pipeline_stage,
        "lead_score": l.lead_score,
        "intent": l.intent,
        "budget": l.budget,
        "timeline": l.timeline,
        "requirements": l.requirements,
        "next_action": l.next_action,
        "ai_employee_id": l.ai_employee_id,
        "last_interaction": l.last_interaction.isoformat() if l.last_interaction else None,
        "next_followup_at": l.next_followup_at.isoformat() if l.next_followup_at else None,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


@router.get("")
async def list_leads(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    ai_employee_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Lead).filter(Lead.workspace_id == user.id)
    if status:
        q = q.filter(Lead.status == status)
    if source:
        q = q.filter(Lead.source == source)
    if ai_employee_id:
        q = q.filter(Lead.ai_employee_id == ai_employee_id)
    if search:
        q = q.filter(Lead.name.ilike(f"%{search}%") | Lead.phone.ilike(f"%{search}%"))

    total = q.count()
    leads = q.order_by(Lead.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "data": [_lead_dict(l) for l in leads]}


@router.post("", status_code=201)
async def create_lead(
    body: LeadCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lead = Lead(
        workspace_id=user.id,
        created_by=user.id,
        name=body.name,
        phone=body.phone,
        email=body.email,
        company=body.company,
        location=body.location,
        source=body.source,
        intent=body.intent,
        budget=body.budget,
        timeline=body.timeline,
        requirements=body.requirements,
        ai_employee_id=body.ai_employee_id,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _lead_dict(lead)


@router.get("/pipeline")
async def get_pipeline(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Returns leads grouped by pipeline stage for Kanban view."""
    stages = ["new", "contacted", "engaged", "qualified", "proposal", "negotiation", "won", "lost"]
    result = {}
    for stage in stages:
        leads = db.query(Lead).filter(
            Lead.workspace_id == user.id,
            Lead.pipeline_stage == stage
        ).order_by(Lead.lead_score.desc()).limit(10).all()
        result[stage] = {
            "count": db.query(Lead).filter(Lead.workspace_id == user.id, Lead.pipeline_stage == stage).count(),
            "leads": [_lead_dict(l) for l in leads],
        }
    return result


@router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    l = db.query(Lead).filter(Lead.id == lead_id, Lead.workspace_id == user.id).first()
    if not l:
        raise HTTPException(404, "Lead not found")
    return _lead_dict(l)


@router.patch("/{lead_id}")
async def update_lead(
    lead_id: str,
    body: LeadUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    l = db.query(Lead).filter(Lead.id == lead_id, Lead.workspace_id == user.id).first()
    if not l:
        raise HTTPException(404, "Lead not found")
    for field, val in body.dict(exclude_none=True).items():
        setattr(l, field, val)
    db.commit()
    db.refresh(l)
    return _lead_dict(l)


@router.delete("/{lead_id}", status_code=204)
async def delete_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    l = db.query(Lead).filter(Lead.id == lead_id, Lead.workspace_id == user.id).first()
    if not l:
        raise HTTPException(404, "Lead not found")
    db.delete(l)
    db.commit()
