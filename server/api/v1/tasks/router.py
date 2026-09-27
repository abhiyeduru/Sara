"""SARA AI — /api/v1/tasks router"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from server.database import get_db
from server.auth import get_current_user
from server.models import Task, User, Approval

logger = logging.getLogger("sara.api.tasks")
router = APIRouter(prefix="/api/v1/tasks", tags=["Tasks"])


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    task_type: str = "ai"
    priority: str = "medium"
    ai_employee_id: Optional[str] = None
    due_at: Optional[str] = None
    lead_id: Optional[str] = None
    customer_id: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    result: Optional[str] = None
    ai_employee_id: Optional[str] = None


def _task_dict(t: Task) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "task_type": t.task_type,
        "priority": t.priority,
        "status": t.status,
        "ai_employee_id": t.ai_employee_id,
        "result": t.result,
        "error": t.error,
        "due_at": t.due_at.isoformat() if t.due_at else None,
        "started_at": t.started_at.isoformat() if t.started_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "lead_id": t.lead_id,
        "customer_id": t.customer_id,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("")
async def list_tasks(
    status: Optional[str] = Query(None),
    task_type: Optional[str] = Query(None),
    ai_employee_id: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Task).filter(Task.workspace_id == user.id)
    if status:
        q = q.filter(Task.status == status)
    if task_type:
        q = q.filter(Task.task_type == task_type)
    if ai_employee_id:
        q = q.filter(Task.ai_employee_id == ai_employee_id)
    if priority:
        q = q.filter(Task.priority == priority)

    total = q.count()
    tasks = q.order_by(Task.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "data": [_task_dict(t) for t in tasks]}


@router.post("", status_code=201)
async def create_task(
    body: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    due = None
    if body.due_at:
        try:
            due = datetime.fromisoformat(body.due_at)
        except Exception:
            pass

    task = Task(
        workspace_id=user.id,
        created_by=user.id,
        title=body.title,
        description=body.description,
        task_type=body.task_type,
        priority=body.priority,
        ai_employee_id=body.ai_employee_id,
        due_at=due,
        lead_id=body.lead_id,
        customer_id=body.customer_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_dict(task)


@router.get("/summary")
async def task_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Quick counts by status for dashboard."""
    statuses = ["pending", "running", "waiting", "waiting_approval", "completed", "failed"]
    result = {}
    for s in statuses:
        result[s] = db.query(Task).filter(Task.workspace_id == user.id, Task.status == s).count()
    result["total"] = db.query(Task).filter(Task.workspace_id == user.id).count()
    return result


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(Task).filter(Task.id == task_id, Task.workspace_id == user.id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    return _task_dict(t)


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(Task).filter(Task.id == task_id, Task.workspace_id == user.id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    for field, val in body.dict(exclude_none=True).items():
        setattr(t, field, val)
    if body.status == "completed" and not t.completed_at:
        t.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(t)
    return _task_dict(t)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(Task).filter(Task.id == task_id, Task.workspace_id == user.id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    db.delete(t)
    db.commit()
