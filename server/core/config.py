"""
SARA AI — Core Configuration
Centralised settings with environment-variable support.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    # ── Server ─────────────────────────────────────────────────────────────
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5174")
    API_VERSION: str = "v1"
    API_PREFIX: str = "/api/v1"

    # ── Database ────────────────────────────────────────────────────────────
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///sara.db")

    # ── JWT / Auth ──────────────────────────────────────────────────────────
    JWT_SECRET: str = os.getenv("JWT_SECRET", "sara-dev-secret-change-in-prod")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", 1440))  # 24h
    FIREBASE_API_KEY: str = os.getenv("FIREBASE_API_KEY", "")

    # ── LLM Providers ───────────────────────────────────────────────────────
    PRIMARY_LLM: str = os.getenv("PRIMARY_LLM", "groq")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # ── Voice ───────────────────────────────────────────────────────────────
    CARTESIA_API_KEY: str = os.getenv("CARTESIA_API_KEY", "")
    CARTESIA_MODEL_ID: str = os.getenv("CARTESIA_MODEL_ID", "sonic-preview")
    DEFAULT_VOICE_ID: str = os.getenv("DEFAULT_VOICE_ID", "330c4fa0-1da3-4c55-8e97-951bfd724e20")
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    SARVAM_STT_MODEL: str = os.getenv("SARVAM_STT_MODEL", "saarika:v2.5")

    # ── Silence Handling ─────────────────────────────────────────────────────
    MEDIUM_SILENCE_SECONDS: float = float(os.getenv("MEDIUM_SILENCE_SECONDS", 14.0))
    LONG_SILENCE_SECONDS: float = float(os.getenv("LONG_SILENCE_SECONDS", 35.0))

    # ── Redis ────────────────────────────────────────────────────────────────
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # ── Storage ──────────────────────────────────────────────────────────────
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")  # local | s3
    S3_BUCKET: str = os.getenv("S3_BUCKET", "")
    S3_REGION: str = os.getenv("S3_REGION", "ap-south-1")
    AWS_ACCESS_KEY: str = os.getenv("AWS_ACCESS_KEY", "")
    AWS_SECRET_KEY: str = os.getenv("AWS_SECRET_KEY", "")

    # ── Billing ──────────────────────────────────────────────────────────────
    DEFAULT_CREDITS: int = int(os.getenv("DEFAULT_CREDITS", 1000))
    COST_PER_CALL_SECOND: float = float(os.getenv("COST_PER_CALL_SECOND", 0.005))
    COST_PER_LLM_TOKEN: float = float(os.getenv("COST_PER_LLM_TOKEN", 0.000002))

    # ── Rate Limiting ────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", 120))


settings = Settings()
