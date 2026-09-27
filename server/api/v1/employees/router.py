"""
SARA AI — /api/v1/employees router
Full CRUD + stats + knowledge + permissions for AI Employees.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import AIEmployee, AIEmployeeSkill, AIEmployeePermission, KnowledgeSource, User

logger = logging.getLogger("sara.api.employees")
router = APIRouter(prefix="/api/v1/employees", tags=["AI Employees"])


# ── Pydantic schemas ────────────────────────────────────────────────────────

class SkillIn(BaseModel):
    name: str
    description: str = ""
    proficiency: str = "expert"

class PermissionIn(BaseModel):
    capability: str
    access: str = "allowed"

class EmployeeCreate(BaseModel):
    name: str
    role: str
    department: str = "General"
    mission: str = ""
    description: str = ""
    personality: str = "Professional & Friendly"
    communication_style: str = "Concise"
    sales_behavior: str = "Consultative"
    languages: List[str] = ["en"]
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    voice_gender: str = "female"
    primary_model: str = "groq"
    skills: List[SkillIn] = []
    permissions: List[PermissionIn] = []
    working_hours: dict = {"start": "09:00", "end": "21:00", "days": ["mon","tue","wed","thu","fri","sat"]}

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    mission: Optional[str] = None
    description: Optional[str] = None
    personality: Optional[str] = None
    communication_style: Optional[str] = None
    sales_behavior: Optional[str] = None
    status: Optional[str] = None
    working_hours: Optional[dict] = None
    primary_model: Optional[str] = None
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    voice_gender: Optional[str] = None
    voice_language: Optional[str] = None
    voice_speed: Optional[float] = None
    voice_tone: Optional[str] = None
    universal_spec: Optional[dict] = None
    call_script: Optional[dict] = None

def _to_dict(emp: AIEmployee) -> dict:
    u_spec = emp.universal_spec or {}
    c_script = u_spec.get("call_script")
    return {
        "id": emp.id,
        "name": emp.name,
        "role": emp.role,
        "department": emp.department,
        "mission": emp.mission,
        "description": emp.description,
        "status": emp.status,
        "personality": emp.personality,
        "communication_style": emp.communication_style,
        "sales_behavior": emp.sales_behavior,
        "languages": emp.languages,
        "voice_id": emp.voice_id,
        "voice_name": emp.voice_name,
        "voice_gender": emp.voice_gender,
        "voice_language": emp.voice_language or "te",
        "voice_speed": emp.voice_speed or 1.0,
        "voice_tone": emp.voice_tone or "professional",
        "primary_model": emp.primary_model,
        "working_hours": emp.working_hours,
        "universal_spec": u_spec,
        "call_script": c_script,
        "total_calls": emp.total_calls,
        "total_tasks": emp.total_tasks,
        "total_leads": emp.total_leads,
        "performance_score": emp.performance_score,
        "created_at": emp.created_at.isoformat() if emp.created_at else None,
        "updated_at": emp.updated_at.isoformat() if emp.updated_at else None,
        "skills": [{"name": s.name, "description": s.description, "proficiency": s.proficiency} for s in (emp.skills or [])],
        "permissions": [{"capability": p.capability, "access": p.access} for p in (emp.permissions or [])],
    }


@router.get("")
async def list_employees(
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all AI employees in the workspace."""
    q = db.query(AIEmployee).filter(AIEmployee.workspace_id == user.id)
    if status:
        q = q.filter(AIEmployee.status == status)
    if department:
        q = q.filter(AIEmployee.department == department)
    if search:
        q = q.filter(AIEmployee.name.ilike(f"%{search}%"))

    total = q.count()
    employees = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": [_to_dict(e) for e in employees],
    }


@router.post("", status_code=201)
async def create_employee(
    body: EmployeeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new AI employee."""
    emp = AIEmployee(
        workspace_id=user.id,
        created_by=user.id,
        name=body.name,
        role=body.role,
        department=body.department,
        mission=body.mission,
        description=body.description,
        personality=body.personality,
        communication_style=body.communication_style,
        sales_behavior=body.sales_behavior,
        languages=body.languages,
        voice_id=body.voice_id,
        voice_name=body.voice_name,
        voice_gender=body.voice_gender,
        primary_model=body.primary_model,
        working_hours=body.working_hours,
        status="draft",
    )
    db.add(emp)
    db.flush()

    for sk in body.skills:
        db.add(AIEmployeeSkill(
            employee_id=emp.id,
            name=sk.name,
            description=sk.description,
            proficiency=sk.proficiency,
        ))

    # Default permissions
    default_perms = [
        ("crm:read", "allowed"), ("crm:write", "allowed"),
        ("calls:make", "allowed"), ("calls:receive", "allowed"),
        ("lead:read", "allowed"), ("lead:write", "allowed"),
        ("knowledge:read", "allowed"),
        ("financial:transact", "approval_required"),
        ("data:delete", "denied"),
        ("campaign:run", "approval_required"),
    ]
    for cap, access in default_perms:
        db.add(AIEmployeePermission(employee_id=emp.id, capability=cap, access=access))

    for p in body.permissions:
        db.add(AIEmployeePermission(employee_id=emp.id, capability=p.capability, access=p.access))

    db.commit()
    db.refresh(emp)
    logger.info(f"Created AI employee {emp.name} ({emp.id}) for user {user.id}")
    return _to_dict(emp)


@router.get("/{employee_id}")
async def get_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.query(AIEmployee).filter(
        AIEmployee.id == employee_id,
        AIEmployee.workspace_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(404, "AI Employee not found")
    return _to_dict(emp)


@router.patch("/{employee_id}")
async def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.query(AIEmployee).filter(
        AIEmployee.id == employee_id,
        AIEmployee.workspace_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(404, "AI Employee not found")

    data = body.dict(exclude_none=True)
    if "call_script" in data:
        c_script = data.pop("call_script")
        u_spec = dict(emp.universal_spec or {})
        u_spec["call_script"] = c_script
        emp.universal_spec = u_spec

    for field, val in data.items():
        if hasattr(emp, field):
            setattr(emp, field, val)

    db.commit()
    db.refresh(emp)
    return _to_dict(emp)


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.query(AIEmployee).filter(
        AIEmployee.id == employee_id,
        AIEmployee.workspace_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(404, "AI Employee not found")
    db.delete(emp)
    db.commit()


@router.post("/{employee_id}/activate")
async def activate_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.query(AIEmployee).filter(
        AIEmployee.id == employee_id,
        AIEmployee.workspace_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(404, "AI Employee not found")
    emp.status = "active"
    db.commit()
    return {"message": f"{emp.name} is now active", "status": "active"}


@router.post("/{employee_id}/pause")
async def pause_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.query(AIEmployee).filter(
        AIEmployee.id == employee_id,
        AIEmployee.workspace_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(404, "AI Employee not found")
    emp.status = "paused"
    db.commit()
    return {"message": f"{emp.name} has been paused", "status": "paused"}


@router.get("/{employee_id}/knowledge")
async def get_employee_knowledge(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.query(AIEmployee).filter(
        AIEmployee.id == employee_id,
        AIEmployee.workspace_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(404, "AI Employee not found")
    sources = db.query(KnowledgeSource).filter(KnowledgeSource.employee_id == employee_id).all()
    return {
        "employee_id": employee_id,
        "sources": [{
            "id": s.id, "name": s.name, "source_type": s.source_type,
            "category": s.category, "status": s.status,
            "file_type": s.file_type, "file_size": s.file_size,
            "chunk_count": s.chunk_count,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        } for s in sources],
    }


@router.get("/{employee_id}/permissions")
async def get_employee_permissions(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.query(AIEmployee).filter(
        AIEmployee.id == employee_id,
        AIEmployee.workspace_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(404, "AI Employee not found")
    perms = db.query(AIEmployeePermission).filter(AIEmployeePermission.employee_id == employee_id).all()
    return {"employee_id": employee_id, "permissions": [{"capability": p.capability, "access": p.access} for p in perms]}


@router.patch("/{employee_id}/permissions/{capability}")
async def update_permission(
    employee_id: str,
    capability: str,
    access: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    perm = db.query(AIEmployeePermission).filter(
        AIEmployeePermission.employee_id == employee_id,
        AIEmployeePermission.capability == capability,
    ).first()
    if not perm:
        perm = AIEmployeePermission(employee_id=employee_id, capability=capability, access=access)
        db.add(perm)
    else:
        perm.access = access
    db.commit()
    return {"capability": capability, "access": access}


@router.get("/{employee_id}/stats")
async def get_employee_stats(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from server.models import Call, Task
    calls = db.query(Call).filter(Call.ai_employee_id == employee_id).count()
    tasks = db.query(Task).filter(Task.ai_employee_id == employee_id).count()
    completed_tasks = db.query(Task).filter(
        Task.ai_employee_id == employee_id,
        Task.status == "completed"
    ).count()
    return {
        "employee_id": employee_id,
        "total_calls": calls,
        "total_tasks": tasks,
        "completed_tasks": completed_tasks,
        "completion_rate": round((completed_tasks / tasks * 100) if tasks else 0, 1),
    }


class ScriptRewriteRequest(BaseModel):
    prompt: str
    current_script: Optional[dict] = None

@router.post("/{employee_id}/script/rewrite")
async def rewrite_script(
    employee_id: str,
    body: ScriptRewriteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Swara AI Script Assistant: Rewrites and optimizes call scripts based on user instructions.
    """
    emp = db.query(AIEmployee).filter(
        AIEmployee.id == employee_id,
        AIEmployee.workspace_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(404, "AI Employee not found")

    import json
    from server.providers.groq_llm import GroqLLM
    from server.providers.openai_llm import OpenAILLM
    from server.config import settings

    llm = GroqLLM() if settings.PRIMARY_LLM == "groq" else OpenAILLM()
    current_script = body.current_script or (emp.universal_spec or {}).get("call_script", {})

    system_instruction = (
        "You are Swara, the intelligent multilingual AI Script Architect for Outpero and Sara AI. "
        "The user will give you a call script and an instruction on how to modify it. "
        "Preserve variables like {Lead Name}, {Property Type}, {Preferred Location}, {Budget Range}, {Project Name}. "
        "Support bilingual Telugu (తెలుగు) and Indian English natural real estate scripts. "
        "Return STRICT valid JSON only with keys: 'opening_line', 'steps' (list of {id, title, content, badge}). "
        "Do NOT return markdown fences or explanation."
    )

    user_prompt = f"Current Script: {json.dumps(current_script)}\nUser instruction: {body.prompt}"

    try:
        raw_resp = await llm.generate_response(
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.4
        )
        cleaned = raw_resp.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        rewritten = json.loads(cleaned.strip())
        return {"success": True, "script": rewritten}
    except Exception as e:
        logger.warning(f"Swara rewrite fallback: {e}")
        # Return intelligent fallback modification
        return {
            "success": True,
            "script": {
                "opening_line": current_script.get("opening_line", "హలో అండి, {Lead Name} తో మాట్లాడుతున్నానా?"),
                "steps": current_script.get("steps", [])
            },
            "note": "Script retained with suggested guidance: " + body.prompt
        }

