"""SARA AI — /api/v1/integrations & /api/v1/mcp routers"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import Integration, MCPServer, MCPTool, User

logger = logging.getLogger("sara.api.integrations")

router = APIRouter(prefix="/api/v1/integrations", tags=["Integrations"])
mcp_router = APIRouter(prefix="/api/v1/mcp", tags=["MCP"])


# ── INTEGRATIONS ────────────────────────────────────────────────────────────

class IntegrationConnect(BaseModel):
    provider: str
    display_name: str
    auth_type: str = "oauth2"
    config: dict = {}
    scopes: list = []

class IntegrationUpdate(BaseModel):
    status: Optional[str] = None
    config: Optional[dict] = None


@router.get("")
async def list_integrations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = db.query(Integration).filter(Integration.workspace_id == user.id).all()
    return {"data": [{
        "id": i.id,
        "provider": i.provider,
        "display_name": i.display_name,
        "status": i.status,
        "auth_type": i.auth_type,
        "scopes": i.scopes,
        "connected_at": i.connected_at.isoformat() if i.connected_at else None,
    } for i in items]}


@router.post("", status_code=201)
async def connect_integration(
    body: IntegrationConnect,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Check if already connected
    existing = db.query(Integration).filter(
        Integration.workspace_id == user.id,
        Integration.provider == body.provider,
    ).first()
    if existing:
        existing.status = "connected"
        existing.config = body.config
        existing.scopes = body.scopes
        db.commit()
        return {"message": f"{body.provider} reconnected", "id": existing.id}

    from datetime import datetime, timezone
    integration = Integration(
        workspace_id=user.id,
        provider=body.provider,
        display_name=body.display_name,
        auth_type=body.auth_type,
        config=body.config,
        scopes=body.scopes,
        status="connected",
        connected_at=datetime.now(timezone.utc),
    )
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return {"message": f"{body.provider} connected", "id": integration.id}


@router.delete("/{integration_id}", status_code=204)
async def disconnect_integration(
    integration_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    i = db.query(Integration).filter(
        Integration.id == integration_id,
        Integration.workspace_id == user.id,
    ).first()
    if not i:
        raise HTTPException(404, "Integration not found")
    i.status = "disconnected"
    i.config = {}
    db.commit()


# ── MCP ─────────────────────────────────────────────────────────────────────

class MCPServerCreate(BaseModel):
    name: str
    description: str = ""
    server_url: Optional[str] = None
    server_type: str = "http"
    auth_config: dict = {}


@mcp_router.get("")
async def list_mcp_servers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    servers = db.query(MCPServer).filter(MCPServer.workspace_id == user.id).all()
    return {"data": [{
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "server_url": s.server_url,
        "server_type": s.server_type,
        "status": s.status,
        "tool_count": len(s.tools),
        "last_ping": s.last_ping.isoformat() if s.last_ping else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    } for s in servers]}


@mcp_router.post("", status_code=201)
async def create_mcp_server(
    body: MCPServerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    server = MCPServer(
        workspace_id=user.id,
        name=body.name,
        description=body.description,
        server_url=body.server_url,
        server_type=body.server_type,
        auth_config=body.auth_config,
        status="connected",
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return {"message": "MCP server registered", "id": server.id}


@mcp_router.get("/{server_id}/tools")
async def list_mcp_tools(
    server_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tools = db.query(MCPTool).filter(MCPTool.server_id == server_id).all()
    return {"data": [{
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "risk_level": t.risk_level,
        "input_schema": t.input_schema,
    } for t in tools]}
