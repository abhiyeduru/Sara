from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from server.database import get_db
from server.auth import get_current_user
from server.models import User, ConversationSession, ConversationMessage, LatencyMetric
from server.schemas import ConversationSessionResponse, LatencyMetricResponse

router = APIRouter(prefix="/api/sessions", tags=["Sessions & Metrics"])

@router.get("/agent/{agent_id}", response_model=List[ConversationSessionResponse])
def get_agent_sessions(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all conversation sessions for an agent with messages and latencies"""
    sessions = (
        db.query(ConversationSession)
        .filter(ConversationSession.agent_id == agent_id, ConversationSession.user_id == current_user.id)
        .order_by(ConversationSession.started_at.desc())
        .limit(20)
        .all()
    )
    return sessions

@router.get("/{session_id}", response_model=ConversationSessionResponse)
def get_session_detail(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = (
        db.query(ConversationSession)
        .filter(ConversationSession.id == session_id, ConversationSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.get("/{session_id}/latencies", response_model=List[LatencyMetricResponse])
def get_session_latencies(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    latencies = (
        db.query(LatencyMetric)
        .filter(LatencyMetric.session_id == session_id)
        .order_by(LatencyMetric.turn_index.asc())
        .all()
    )
    return latencies
