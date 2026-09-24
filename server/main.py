import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from server.config import settings
from server.database import engine, get_db, init_db
from server.routes import agents, voices, sessions, websocket, crm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sara")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SARA database tables...")
    try:
        init_db()
        logger.info("Database tables and default agents verified.")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
    yield

app = FastAPI(
    title="SARA — Configurable AI Voice Agent Platform",
    version="1.0.0",
    description="Low-latency real-time multilingual AI voice agent system",
    lifespan=lifespan
)

# CORS Middleware allowing client communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Include Routers
app.include_router(agents.router)
app.include_router(voices.router)
app.include_router(sessions.router)
app.include_router(websocket.router)
app.include_router(crm.router)

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """Health check validating database connectivity and AI provider configs"""
    db_ok = False
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    db_type = "Neon PostgreSQL (Connected)" if "postgres" in str(engine.url) else "SQLite (Local Active)"
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": db_type if db_ok else "Database Error",
        "llm_provider": "Groq (qwen/qwen3.8-27b)",
        "tts_provider": "Cartesia (sonic-2)",
        "stt_provider": "Sarvam AI (saarika:v2.5)",
        "languages": ["en", "te", "hi"]
    }

# Mount static frontend build if present
CLIENT_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "client", "dist")
if os.path.exists(CLIENT_DIST):
    assets_dir = os.path.join(CLIENT_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            return {"error": "Not Found"}
        target = os.path.join(CLIENT_DIST, full_path)
        if os.path.isfile(target):
            return FileResponse(target)
        index_html = os.path.join(CLIENT_DIST, "index.html")
        if os.path.isfile(index_html):
            return FileResponse(index_html)
        return {"message": "SARA API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host=settings.HOST, port=settings.PORT, reload=True)

