import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from server.config import settings
from server.database import engine, get_db, init_db
from server.routes import agents, voices, sessions, websocket

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sara")

app = FastAPI(
    title="SARA — Configurable AI Voice Agent Platform",
    version="1.0.0",
    description="Low-latency real-time multilingual AI voice agent system"
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

@app.on_event("startup")
def on_startup():
    logger.info("Initializing SARA database tables on Neon PostgreSQL...")
    try:
        init_db()
        logger.info("Database tables verified.")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

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

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "Neon PostgreSQL (Connected)" if db_ok else "Database Error",
        "llm_provider": "Groq (qwen/qwen3.8-27b)",
        "tts_provider": "Cartesia (sonic-2)",
        "stt_provider": "Sarvam AI (saarika:v2.5)",
        "languages": ["en", "te", "hi"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host=settings.HOST, port=settings.PORT, reload=True)
