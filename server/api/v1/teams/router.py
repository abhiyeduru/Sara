"""SARA AI — /api/v1/teams router"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import AITeam, AITeamMember, AIEmployee, User

logger = logging.getLogger("sara.api.teams")
router = APIRouter(prefix="/api/v1/teams", tags=["Teams"])


class TeamCreate(BaseModel):
    name: str
    mission: Optional[str] = ""
    department: Optional[str] = "General"
    status: Optional[str] = "active"
    member_ids: Optional[List[str]] = []


class MemberAdd(BaseModel):
    employee_id: str
    role: Optional[str] = "member"


def _team_dict(team: AITeam, db: Session) -> dict:
    members = []
    for m in team.members:
        emp = db.query(AIEmployee).filter(AIEmployee.id == m.employee_id).first()
        members.append({
            "id": m.id,
            "employee_id": m.employee_id,
            "name": emp.name if emp else "Unknown",
            "role": m.role,
            "department": emp.department if emp else "",
            "avatar": (getattr(emp, "avatar_url", None) or getattr(emp, "avatar", None)) if emp else None,
        })

    leader_name = "Sara Autonomous Lead"
    for m in members:
        if m["role"] == "lead":
            leader_name = m["name"]
            break

    return {
        "id": team.id,
        "name": team.name,
        "description": team.mission,
        "mission": team.mission,
        "department": team.department,
        "status": team.status,
        "leader": leader_name,
        "members_count": len(members),
        "members": members,
        "created_at": team.created_at.isoformat() if team.created_at else None,
    }


@router.get("")
async def list_teams(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    teams = db.query(AITeam).filter(AITeam.workspace_id == user.id).all()
    return {"data": [_team_dict(t, db) for t in teams]}


@router.post("", status_code=201)
async def create_team(
    body: TeamCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    team = AITeam(
        workspace_id=user.id,
        name=body.name,
        mission=body.mission or "",
        department=body.department or "General",
        status=body.status or "active",
        created_by=user.id,
    )
    db.add(team)
    db.commit()
    db.refresh(team)

    if body.member_ids:
        for idx, emp_id in enumerate(body.member_ids):
            tm = AITeamMember(
                team_id=team.id,
                employee_id=emp_id,
                role="lead" if idx == 0 else "member"
            )
            db.add(tm)
        db.commit()
        db.refresh(team)

    return _team_dict(team, db)


@router.get("/{team_id}")
async def get_team(
    team_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    team = db.query(AITeam).filter(
        AITeam.id == team_id,
        AITeam.workspace_id == user.id
    ).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return _team_dict(team, db)


@router.post("/{team_id}/members")
async def add_member(
    team_id: str,
    body: MemberAdd,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    team = db.query(AITeam).filter(
        AITeam.id == team_id,
        AITeam.workspace_id == user.id
    ).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    tm = AITeamMember(
        team_id=team.id,
        employee_id=body.employee_id,
        role=body.role or "member"
    )
    db.add(tm)
    db.commit()
    db.refresh(team)
    return _team_dict(team, db)


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    team = db.query(AITeam).filter(
        AITeam.id == team_id,
        AITeam.workspace_id == user.id
    ).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db.delete(team)
    db.commit()
