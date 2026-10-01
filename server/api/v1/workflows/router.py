"""SARA AI — /api/v1/workflows router"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import Workflow, WorkflowRun, User

logger = logging.getLogger("sara.api.workflows")
router = APIRouter(prefix="/api/v1/workflows", tags=["Workflows"])


class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    trigger: str
    nodes: list = []
    edges: list = []
    variables: dict = {}

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger: Optional[str] = None
    status: Optional[str] = None
    nodes: Optional[list] = None
    edges: Optional[list] = None


def _wf_dict(w: Workflow) -> dict:
    return {
        "id": w.id,
        "name": w.name,
        "description": w.description,
        "trigger": w.trigger,
        "status": w.status,
        "nodes": w.nodes,
        "edges": w.edges,
        "variables": w.variables,
        "total_runs": w.total_runs,
        "success_runs": w.success_runs,
        "success_rate": round((w.success_runs / w.total_runs * 100) if w.total_runs else 0, 1),
        "last_run_at": w.last_run_at.isoformat() if w.last_run_at else None,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }


@router.get("")
async def list_workflows(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Workflow).filter(Workflow.workspace_id == user.id)
    if status:
        q = q.filter(Workflow.status == status)
    total = q.count()
    items = q.order_by(Workflow.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "data": [_wf_dict(w) for w in items]}


@router.post("", status_code=201)
async def create_workflow(
    body: WorkflowCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    wf = Workflow(
        workspace_id=user.id,
        created_by=user.id,
        name=body.name,
        description=body.description,
        trigger=body.trigger,
        nodes=body.nodes,
        edges=body.edges,
        variables=body.variables,
        status="draft",
    )
    db.add(wf)
    db.commit()
    db.refresh(wf)
    return _wf_dict(wf)


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.workspace_id == user.id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    return _wf_dict(wf)


@router.patch("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.workspace_id == user.id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    for field, val in body.dict(exclude_none=True).items():
        setattr(wf, field, val)
    db.commit()
    db.refresh(wf)
    return _wf_dict(wf)


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.workspace_id == user.id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    db.delete(wf)
    db.commit()


@router.post("/{workflow_id}/activate")
async def activate_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.workspace_id == user.id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    wf.status = "active"
    db.commit()
    return {"message": f"Workflow '{wf.name}' activated", "status": "active"}


@router.post("/{workflow_id}/pause")
async def pause_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.workspace_id == user.id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    wf.status = "paused"
    db.commit()
    return {"message": f"Workflow '{wf.name}' paused", "status": "paused"}


@router.get("/{workflow_id}/runs")
async def get_workflow_runs(
    workflow_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    runs = db.query(WorkflowRun).filter(WorkflowRun.workflow_id == workflow_id) \
             .order_by(WorkflowRun.started_at.desc()).limit(limit).all()
    return {"data": [{
        "id": r.id,
        "status": r.status,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "ended_at": r.ended_at.isoformat() if r.ended_at else None,
        "error": r.error,
    } for r in runs]}
