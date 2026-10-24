"""SARA AI — /api/v1/analytics router"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from server.database import get_db
from server.auth import get_current_user
from server.models import (
    User, AIEmployee, Task, Lead, Call, Approval,
    WorkspaceMetric, ActivityLog, UsageEvent
)

logger = logging.getLogger("sara.api.analytics")
router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def dashboard_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Single endpoint powering the main dashboard:
    KPIs, workforce status, task summary, recent activity.
    """
    # Workspace and user identification
    allowed_ids = [user.id]
    from server.models import WorkspaceMember
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if member and member.workspace_id:
        allowed_ids.append(member.workspace_id)

    # AI Workforce query across both workspace_id and created_by
    emp_q = db.query(AIEmployee).filter(
        (AIEmployee.workspace_id.in_(allowed_ids)) | (AIEmployee.created_by == user.id)
    )
    total_employees = emp_q.count()
    active_employees = emp_q.filter(AIEmployee.status == "active").count()
    paused_employees = emp_q.filter(AIEmployee.status == "paused").count()
    all_employees_records = emp_q.order_by(AIEmployee.created_at.desc()).all()

    # Tasks
    total_tasks = db.query(Task).filter(Task.workspace_id.in_(allowed_ids)).count()
    running_tasks = db.query(Task).filter(Task.workspace_id.in_(allowed_ids), Task.status == "running").count()
    completed_tasks = db.query(Task).filter(Task.workspace_id.in_(allowed_ids), Task.status == "completed").count()
    pending_approvals = db.query(Approval).filter(
        Approval.workspace_id.in_(allowed_ids), Approval.status == "pending"
    ).count()

    # Leads
    total_leads = db.query(Lead).filter(Lead.workspace_id.in_(allowed_ids)).count()
    qualified_leads = db.query(Lead).filter(
        Lead.workspace_id.in_(allowed_ids), Lead.status.in_(["qualified", "proposal", "negotiation", "won"])
    ).count()

    # Calls
    total_calls = db.query(Call).filter(Call.workspace_id.in_(allowed_ids)).count()
    active_calls = db.query(Call).filter(Call.workspace_id.in_(allowed_ids), Call.status == "connected").count()

    # Recent activity
    recent_activity = db.query(ActivityLog).filter(
        ActivityLog.workspace_id.in_(allowed_ids)
    ).order_by(ActivityLog.created_at.desc()).limit(15).all()

    return {
        "workforce": {
            "total": total_employees,
            "active": active_employees,
            "paused": paused_employees,
            "draft": total_employees - active_employees - paused_employees,
        },
        "tasks": {
            "total": total_tasks,
            "running": running_tasks,
            "completed": completed_tasks,
            "completion_rate": round((completed_tasks / total_tasks * 100) if total_tasks else 0, 1),
        },
        "leads": {
            "total": total_leads,
            "qualified": qualified_leads,
            "conversion_rate": round((qualified_leads / total_leads * 100) if total_leads else 0, 1),
        },
        "calls": {
            "total": total_calls,
            "active": active_calls,
        },
        "approvals": {
            "pending": pending_approvals,
        },
        "recent_activity": [{
            "id": a.id,
            "actor_type": a.actor_type,
            "actor_name": a.actor_name,
            "action": a.action,
            "entity_type": a.entity_type,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        } for a in recent_activity],
        "all_employees": [{
            "id": e.id,
            "name": e.name,
            "role": e.role,
            "department": e.department,
            "status": e.status,
            "total_calls": e.total_calls or 0,
            "total_tasks": e.total_tasks or 0,
            "performance_score": e.performance_score or 96,
            "voice_language": e.voice_language or "te",
            "voice_name": e.voice_name or "Sindhu",
            "calling_mode": (e.universal_spec or {}).get("calling_mode", "instant"),
            "call_script": (e.universal_spec or {}).get("call_script"),
            "script_stages": (e.universal_spec or {}).get("script_stages"),
            "mission": e.mission,
            "description": e.description,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        } for e in all_employees_records],
        "top_employees": [{
            "id": e.id,
            "name": e.name,
            "role": e.role,
            "status": e.status,
            "total_calls": e.total_calls or 0,
            "total_tasks": e.total_tasks or 0,
            "performance_score": e.performance_score or 96,
            "voice_language": e.voice_language or "te",
            "calling_mode": (e.universal_spec or {}).get("calling_mode", "instant"),
            "created_at": e.created_at.isoformat() if e.created_at else None,
        } for e in all_employees_records[:8]],
    }


@router.get("/workforce")
async def workforce_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Per-employee performance stats."""
    ws = user.id
    employees = db.query(AIEmployee).filter(AIEmployee.workspace_id == ws).all()
    result = []
    for emp in employees:
        task_count = db.query(Task).filter(Task.ai_employee_id == emp.id).count()
        completed = db.query(Task).filter(Task.ai_employee_id == emp.id, Task.status == "completed").count()
        call_count = db.query(Call).filter(Call.ai_employee_id == emp.id).count()
        result.append({
            "id": emp.id,
            "name": emp.name,
            "role": emp.role,
            "department": emp.department,
            "status": emp.status,
            "total_calls": call_count,
            "total_tasks": task_count,
            "completed_tasks": completed,
            "task_completion_rate": round((completed / task_count * 100) if task_count else 0, 1),
            "performance_score": emp.performance_score,
        })
    return {"data": result}


@router.get("/leads")
async def lead_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lead funnel analytics."""
    ws = user.id
    stages = ["new", "contacted", "engaged", "qualified", "proposal", "negotiation", "won", "lost"]
    funnel = []
    for stage in stages:
        count = db.query(Lead).filter(Lead.workspace_id == ws, Lead.pipeline_stage == stage).count()
        funnel.append({"stage": stage, "count": count})

    sources = db.query(Lead.source, func.count(Lead.id)).filter(
        Lead.workspace_id == ws
    ).group_by(Lead.source).all()

    return {
        "funnel": funnel,
        "by_source": [{"source": s, "count": c} for s, c in sources],
        "total": db.query(Lead).filter(Lead.workspace_id == ws).count(),
    }


@router.get("/calls")
async def call_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Call volume and outcome analytics."""
    ws = user.id
    total = db.query(Call).filter(Call.workspace_id == ws).count()
    by_status = db.query(Call.status, func.count(Call.id)).filter(
        Call.workspace_id == ws
    ).group_by(Call.status).all()
    by_outcome = db.query(Call.outcome, func.count(Call.id)).filter(
        Call.workspace_id == ws
    ).group_by(Call.outcome).all()
    by_sentiment = db.query(Call.sentiment, func.count(Call.id)).filter(
        Call.workspace_id == ws
    ).group_by(Call.sentiment).all()

    return {
        "total": total,
        "by_status": [{"status": s, "count": c} for s, c in by_status],
        "by_outcome": [{"outcome": o or "unknown", "count": c} for o, c in by_outcome],
        "by_sentiment": [{"sentiment": s, "count": c} for s, c in by_sentiment],
    }


@router.get("/usage")
async def usage_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Credit usage breakdown."""
    ws = user.id
    events = db.query(
        UsageEvent.event_type,
        func.sum(UsageEvent.quantity).label("total_quantity"),
        func.sum(UsageEvent.total_cost).label("total_cost"),
    ).filter(UsageEvent.workspace_id == ws).group_by(UsageEvent.event_type).all()

    return {
        "by_type": [{
            "event_type": e.event_type,
            "total_quantity": float(e.total_quantity or 0),
            "total_cost": float(e.total_cost or 0),
        } for e in events],
        "total_cost": sum(float(e.total_cost or 0) for e in events),
    }
