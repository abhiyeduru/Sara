"""SARA AI — /api/v1/activity router"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import ActivityLog, AuditLog, Notification, User

logger = logging.getLogger("sara.api.activity")
router = APIRouter(prefix="/api/v1/activity", tags=["Activity"])


@router.get("")
async def list_activity(
    actor_type: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ActivityLog).filter(ActivityLog.workspace_id == user.id)
    if actor_type:
        q = q.filter(ActivityLog.actor_type == actor_type)
    if entity_type:
        q = q.filter(ActivityLog.entity_type == entity_type)

    total = q.count()
    items = q.order_by(ActivityLog.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "data": [{
            "id": a.id,
            "actor_type": a.actor_type,
            "actor_id": a.actor_id,
            "actor_name": a.actor_name,
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "details": a.details,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        } for a in items],
    }


@router.get("/audit")
async def audit_log(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(AuditLog).filter(AuditLog.workspace_id == user.id)
    total = q.count()
    items = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "data": [{
            "id": a.id,
            "actor_type": a.actor_type,
            "actor_name": a.actor_name,
            "action": a.action,
            "resource_type": a.resource_type,
            "resource_id": a.resource_id,
            "outcome": a.outcome,
            "ip_address": a.ip_address,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        } for a in items],
    }


@router.get("/notifications")
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.workspace_id == user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    items = q.order_by(Notification.created_at.desc()).limit(limit).all()

    return {"data": [{
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "entity_type": n.entity_type,
        "entity_id": n.entity_id,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    } for n in items]}


@router.post("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.workspace_id == user.id,
    ).first()
    if n:
        n.is_read = True
        db.commit()
    return {"ok": True}
