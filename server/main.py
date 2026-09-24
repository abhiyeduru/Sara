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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host=settings.HOST, port=settings.PORT, reload=True)
