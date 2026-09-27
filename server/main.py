"""
SARA AI — Main Application Entry Point
AI Workforce Operating System — FastAPI Backend
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from server.config import settings
from server.database import engine, get_db, init_db

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sara")


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🧠 SARA AI Workforce OS — starting up...")
    try:
        init_db()
        logger.info("✅ Database tables initialised.")
    except Exception as e:
        logger.error(f"Database initialisation error: {e}")
    yield
    logger.info("🛑 SARA AI shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SARA AI — Workforce Operating System",
    version="2.0.0",
    description=(
        "Complete AI Workforce OS — Create, manage, and orchestrate AI employees "
        "for sales, support, marketing, and operations."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
def health_check():
    """Health check validating DB connectivity."""
    db_ok = False
    try:
        db: Session = next(get_db())
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    db_type = "PostgreSQL" if "postgres" in str(engine.url) else "SQLite"
    return {
        "status": "healthy" if db_ok else "degraded",
        "version": "2.0.0",
        "database": f"{db_type} ({'connected' if db_ok else 'error'})",
        "llm_primary": settings.PRIMARY_LLM,
        "features": [
            "AI Workforce Management",
            "Voice Calling",
            "CRM & Lead Management",
            "Workflow Automation",
            "Approval Engine",
            "RAG / Knowledge Base",
            "Real-time Events",
            "Billing & Credits",
            "RBAC & Multi-Tenant",
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# v1 API Routers
# ══════════════════════════════════════════════════════════════════════════════
from server.api.v1.workspaces.router import router as workspaces_router
from server.api.v1.employees.router  import router as employees_router
from server.api.v1.tasks.router      import router as tasks_router
from server.api.v1.workflows.router  import router as workflows_router
from server.api.v1.leads.router      import router as leads_router
from server.api.v1.calls.router      import router as calls_router
from server.api.v1.approvals.router  import router as approvals_router
from server.api.v1.analytics.router  import router as analytics_router
from server.api.v1.billing.router    import router as billing_router
from server.api.v1.activity.router   import router as activity_router
from server.api.v1.integrations.router import router as integrations_router, mcp_router
from server.api.v1.knowledge.router import router as knowledge_router
from server.api.v1.teams.router import router as teams_router
from server.api.v1.voice.router import router as voice_router
from server.api.v1.phone_numbers.router import router as phone_numbers_router

app.include_router(workspaces_router)
app.include_router(employees_router)
app.include_router(teams_router)
app.include_router(tasks_router)
app.include_router(workflows_router)
app.include_router(leads_router)
app.include_router(calls_router)
app.include_router(voice_router)
app.include_router(phone_numbers_router)
app.include_router(approvals_router)
app.include_router(analytics_router)
app.include_router(billing_router)
app.include_router(activity_router)
app.include_router(integrations_router)
app.include_router(mcp_router)
app.include_router(knowledge_router)

# ══════════════════════════════════════════════════════════════════════════════
# Legacy Routers (voice agent system — fully preserved)
# ══════════════════════════════════════════════════════════════════════════════
from server.routes import agents, voices, sessions, websocket, crm

app.include_router(agents.router)
app.include_router(voices.router)
app.include_router(sessions.router)
app.include_router(websocket.router)
app.include_router(crm.router)


# ── Serve React SPA ───────────────────────────────────────────────────────────
CLIENT_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "client", "dist"
)
if os.path.exists(CLIENT_DIST):
    assets_dir = os.path.join(CLIENT_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith(("api/", "ws/", "docs", "redoc")):
            from fastapi import Response
            return Response(status_code=404)
        target = os.path.join(CLIENT_DIST, full_path)
        if os.path.isfile(target):
            return FileResponse(target)
        index_html = os.path.join(CLIENT_DIST, "index.html")
        if os.path.isfile(index_html):
            return FileResponse(index_html)
        return {"message": "SARA AI Workforce OS — API running on /docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
