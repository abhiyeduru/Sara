import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the server directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Neon or SQLite Database URL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///sara.db"
    )
    NEON_API_KEY: str = os.getenv("NEON_API_KEY", "")

    # OpenAI LLM
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    PRIMARY_LLM: str = os.getenv("PRIMARY_LLM", "openai")

    # Groq LLM (Ultra-Low Latency ~120ms TTFT)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

    # Cartesia TTS
    CARTESIA_API_KEY: str = os.getenv("CARTESIA_API_KEY", "")
    CARTESIA_MODEL_ID: str = os.getenv("CARTESIA_MODEL_ID", "sonic-preview")
    DEFAULT_VOICE_ID: str = os.getenv("DEFAULT_VOICE_ID", "330c4fa0-1da3-4c55-8e97-951bfd724e20")

    # Sarvam STT
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    SARVAM_STT_MODEL: str = os.getenv("SARVAM_STT_MODEL", "saarika:v2.5")

    # Firebase
    FIREBASE_API_KEY: str = os.getenv("FIREBASE_API_KEY", "")

    # Silence Handling Timeouts (Seconds)
    MEDIUM_SILENCE_SECONDS: float = float(os.getenv("MEDIUM_SILENCE_SECONDS", 14.0))
    LONG_SILENCE_SECONDS: float = float(os.getenv("LONG_SILENCE_SECONDS", 35.0))

settings = Settings()
