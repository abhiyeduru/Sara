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
    ws = user.id

    # AI Workforce counts
    total_employees = db.query(AIEmployee).filter(AIEmployee.workspace_id == ws).count()
    active_employees = db.query(AIEmployee).filter(
        AIEmployee.workspace_id == ws, AIEmployee.status == "active"
    ).count()
    paused_employees = db.query(AIEmployee).filter(
        AIEmployee.workspace_id == ws, AIEmployee.status == "paused"
    ).count()

    # Tasks
    total_tasks = db.query(Task).filter(Task.workspace_id == ws).count()
    running_tasks = db.query(Task).filter(Task.workspace_id == ws, Task.status == "running").count()
    completed_tasks = db.query(Task).filter(Task.workspace_id == ws, Task.status == "completed").count()
    pending_approvals = db.query(Approval).filter(
        Approval.workspace_id == ws, Approval.status == "pending"
    ).count()

    # Leads
    total_leads = db.query(Lead).filter(Lead.workspace_id == ws).count()
    qualified_leads = db.query(Lead).filter(
        Lead.workspace_id == ws, Lead.status.in_(["qualified", "proposal", "negotiation", "won"])
    ).count()

    # Calls
    total_calls = db.query(Call).filter(Call.workspace_id == ws).count()
    active_calls = db.query(Call).filter(Call.workspace_id == ws, Call.status == "connected").count()

    # Recent activity
    recent_activity = db.query(ActivityLog).filter(
        ActivityLog.workspace_id == ws
    ).order_by(ActivityLog.created_at.desc()).limit(15).all()

    # Top employees (by total_calls desc)
    top_employees = db.query(AIEmployee).filter(
        AIEmployee.workspace_id == ws
    ).order_by(AIEmployee.total_calls.desc()).limit(5).all()

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
        "top_employees": [{
            "id": e.id,
            "name": e.name,
            "role": e.role,
            "status": e.status,
            "total_calls": e.total_calls,
            "total_tasks": e.total_tasks,
            "performance_score": e.performance_score,
        } for e in top_employees],
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
