"""SARA AI — /api/v1/knowledge router"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import KnowledgeSource, KnowledgeDocument, AIEmployee, User

logger = logging.getLogger("sara.api.knowledge")
router = APIRouter(prefix="/api/v1/knowledge", tags=["Knowledge"])


class KnowledgeCreate(BaseModel):
    name: str
    source_type: str = "document"  # document | website | text | faq
    category: str = "Company Knowledge"  # Company Knowledge | Products | FAQs | Policies | SOPs
    employee_id: Optional[str] = None
    url: Optional[str] = None
    extracted_text: Optional[str] = ""


@router.get("")
async def list_knowledge(
    employee_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all knowledge sources for workspace with filtering."""
    query = db.query(KnowledgeSource).filter(KnowledgeSource.workspace_id == user.id)

    if employee_id:
        query = query.filter(KnowledgeSource.employee_id == employee_id)
    if category:
        query = query.filter(KnowledgeSource.category == category)
    if source_type:
        query = query.filter(KnowledgeSource.source_type == source_type)
    if search:
        query = query.filter(KnowledgeSource.name.ilike(f"%{search}%"))

    total = query.count()
    sources = query.order_by(KnowledgeSource.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "sources": [
            {
                "id": s.id,
                "name": s.name,
                "source_type": s.source_type,
                "category": s.category,
                "employee_id": s.employee_id,
                "file_type": s.file_type,
                "file_size": s.file_size,
                "url": s.url,
                "status": s.status,
                "chunk_count": s.chunk_count,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sources
        ]
    }


@router.post("")
async def create_knowledge(
    payload: KnowledgeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new knowledge source."""
    # Find employee or default to first employee in workspace
    emp_id = payload.employee_id
    if not emp_id:
        first_emp = db.query(AIEmployee).filter(AIEmployee.workspace_id == user.id).first()
        if first_emp:
            emp_id = first_emp.id
        else:
            # Create a fallback employee placeholder
            placeholder = AIEmployee(
                workspace_id=user.id,
                name="SARA General Assistant",
                role="General Knowledge Specialist",
                system_prompt="You are a knowledgeable assistant with full context of company documents.",
            )
            db.add(placeholder)
            db.flush()
            emp_id = placeholder.id

    chunks = []
    text_content = payload.extracted_text or ""
    if text_content:
        # Simple chunking for immediate readiness
        chunk_size = 500
        words = text_content.split(" ")
        curr = []
        for w in words:
            curr.append(w)
            if len(" ".join(curr)) > chunk_size:
                chunks.append(" ".join(curr))
                curr = []
        if curr:
            chunks.append(" ".join(curr))

    source = KnowledgeSource(
        workspace_id=user.id,
        employee_id=emp_id,
        name=payload.name,
        source_type=payload.source_type,
        category=payload.category,
        url=payload.url,
        extracted_text=text_content,
        chunk_count=len(chunks),
        status="indexed" if text_content else "pending",
        created_by=user.id,
    )
    db.add(source)
    db.flush()

    for idx, c in enumerate(chunks):
        doc = KnowledgeDocument(
            source_id=source.id,
            chunk_index=idx,
            content=c,
        )
        db.add(doc)

    db.commit()
    db.refresh(source)

    return {
        "id": source.id,
        "name": source.name,
        "source_type": source.source_type,
        "category": source.category,
        "status": source.status,
        "chunk_count": source.chunk_count,
        "created_at": source.created_at.isoformat() if source.created_at else None,
    }


@router.get("/{source_id}")
async def get_knowledge(
    source_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get single knowledge source details and preview chunks."""
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == source_id,
        KnowledgeSource.workspace_id == user.id
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Knowledge source not found")

    docs = db.query(KnowledgeDocument).filter(
        KnowledgeDocument.source_id == source.id
    ).order_by(KnowledgeDocument.chunk_index.asc()).limit(20).all()

    return {
        "id": source.id,
        "name": source.name,
        "source_type": source.source_type,
        "category": source.category,
        "employee_id": source.employee_id,
        "file_type": source.file_type,
        "file_size": source.file_size,
        "url": source.url,
        "status": source.status,
        "extracted_text": source.extracted_text,
        "chunk_count": source.chunk_count,
        "created_at": source.created_at.isoformat() if source.created_at else None,
        "chunks": [{"id": d.id, "chunk_index": d.chunk_index, "content": d.content} for d in docs]
    }


@router.delete("/{source_id}")
async def delete_knowledge(
    source_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a knowledge source and associated chunks."""
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == source_id,
        KnowledgeSource.workspace_id == user.id
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Knowledge source not found")

    db.delete(source)
    db.commit()
    return {"status": "deleted", "id": source_id}


@router.post("/search")
async def search_knowledge(
    query: str = Query(..., min_length=1),
    employee_id: Optional[str] = Query(None),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Semantic/text search across all indexed chunks in the workspace."""
    q = db.query(KnowledgeDocument).join(KnowledgeSource).filter(
        KnowledgeSource.workspace_id == user.id,
        KnowledgeDocument.content.ilike(f"%{query}%")
    )
    if employee_id:
        q = q.filter(KnowledgeSource.employee_id == employee_id)

    results = q.limit(limit).all()
    return {
        "query": query,
        "results": [
            {
                "id": r.id,
                "source_id": r.source_id,
                "content": r.content,
                "chunk_index": r.chunk_index
            }
            for r in results
        ]
    }
