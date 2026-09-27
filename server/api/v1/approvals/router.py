"""SARA AI — /api/v1/approvals router"""
import logging
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import Approval, User, Notification

logger = logging.getLogger("sara.api.approvals")
router = APIRouter(prefix="/api/v1/approvals", tags=["Approvals"])


class ApprovalCreate(BaseModel):
    task_id: Optional[str] = None
    ai_employee_id: Optional[str] = None
    requested_by: str
    action_type: str
    action_title: str
    action_details: dict = {}
    risk_level: str = "medium"
    expires_in_minutes: int = 60


class ApprovalDecision(BaseModel):
    decision: str  # approved | rejected
    note: str = ""


def _approval_dict(a: Approval) -> dict:
    return {
        "id": a.id,
        "task_id": a.task_id,
        "ai_employee_id": a.ai_employee_id,
        "requested_by": a.requested_by,
        "reviewed_by": a.reviewed_by,
        "action_type": a.action_type,
        "action_title": a.action_title,
        "action_details": a.action_details,
        "risk_level": a.risk_level,
        "status": a.status,
        "decision_note": a.decision_note,
        "decided_at": a.decided_at.isoformat() if a.decided_at else None,
        "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("")
async def list_approvals(
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Approval).filter(Approval.workspace_id == user.id)
    if status:
        q = q.filter(Approval.status == status)
    if risk_level:
        q = q.filter(Approval.risk_level == risk_level)

    total = q.count()
    items = q.order_by(Approval.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "data": [_approval_dict(a) for a in items]}


@router.get("/pending")
async def pending_approvals(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Returns all pending approvals — used by the Approval Center page."""
    items = db.query(Approval).filter(
        Approval.workspace_id == user.id,
        Approval.status == "pending"
    ).order_by(Approval.created_at.desc()).all()
    return {"count": len(items), "data": [_approval_dict(a) for a in items]}


@router.post("", status_code=201)
async def create_approval(
    body: ApprovalCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """AI employee or system creates an approval request."""
    expires = datetime.now(timezone.utc) + timedelta(minutes=body.expires_in_minutes)
    approval = Approval(
        workspace_id=user.id,
        task_id=body.task_id,
        ai_employee_id=body.ai_employee_id,
        requested_by=body.requested_by,
        action_type=body.action_type,
        action_title=body.action_title,
        action_details=body.action_details,
        risk_level=body.risk_level,
        status="pending",
        expires_at=expires,
    )
    db.add(approval)

    # Create a notification for workspace owner
    notif = Notification(
        workspace_id=user.id,
        type="approval.requested",
        title=f"Action requires your approval",
        message=f"{body.requested_by} wants to: {body.action_title}",
        entity_type="approval",
    )
    db.add(notif)
    db.commit()
    db.refresh(approval)
    return _approval_dict(approval)


@router.post("/{approval_id}/decide")
async def decide_approval(
    approval_id: str,
    body: ApprovalDecision,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Human approves or rejects an AI action."""
    a = db.query(Approval).filter(
        Approval.id == approval_id,
        Approval.workspace_id == user.id,
    ).first()
    if not a:
        raise HTTPException(404, "Approval not found")
    if a.status != "pending":
        raise HTTPException(400, f"Approval already {a.status}")
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(400, "Decision must be 'approved' or 'rejected'")

    a.status = body.decision
    a.reviewed_by = user.id
    a.decision_note = body.note
    a.decided_at = datetime.now(timezone.utc)

    # Update linked task status
    if a.task_id:
        from server.models import Task
        task = db.query(Task).filter(Task.id == a.task_id).first()
        if task:
            task.status = "queued" if body.decision == "approved" else "cancelled"

    db.commit()
    db.refresh(a)
    logger.info(f"Approval {approval_id} {body.decision} by user {user.id}")
    return _approval_dict(a)


@router.get("/{approval_id}")
async def get_approval(
    approval_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = db.query(Approval).filter(
        Approval.id == approval_id,
        Approval.workspace_id == user.id,
    ).first()
    if not a:
        raise HTTPException(404, "Approval not found")
    return _approval_dict(a)
