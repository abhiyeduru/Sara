import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the server directory or root directory
load_dotenv(dotenv_path=Path(__file__).parent / ".env")
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

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
    PRIMARY_LLM: str = os.getenv("PRIMARY_LLM", "groq")

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

    # Deepgram STT
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    DEEPGRAM_REGION: str = os.getenv("DEEPGRAM_REGION", "global")
    DEEPGRAM_MODEL: str = os.getenv("DEEPGRAM_MODEL", "nova-3")
    PUBLIC_WS_URL: str = os.getenv("PUBLIC_WS_URL", "")
    PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "")

    # Ollama Local LLM
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

    # Exotel Telephony Layer
    EXOTEL_API_KEY: str = os.getenv("EXOTEL_API_KEY", "")
    EXOTEL_API_TOKEN: str = os.getenv("EXOTEL_API_TOKEN", "")
    EXOTEL_ACCOUNT_SID: str = os.getenv("EXOTEL_ACCOUNT_SID", "sara")
    EXOTEL_SUBDOMAIN: str = os.getenv("EXOTEL_SUBDOMAIN", "api.exotel.com")
    EXOTEL_CALLER_ID: str = os.getenv("EXOTEL_CALLER_ID", "")
    ALLOW_REAL_CALLS: bool = os.getenv("ALLOW_REAL_CALLS", "true").lower() in ("true", "1", "yes")

    # Firebase
    FIREBASE_API_KEY: str = os.getenv("FIREBASE_API_KEY", "")

    # Silence Handling Timeouts (Seconds)
    MEDIUM_SILENCE_SECONDS: float = float(os.getenv("MEDIUM_SILENCE_SECONDS", 14.0))
    LONG_SILENCE_SECONDS: float = float(os.getenv("LONG_SILENCE_SECONDS", 35.0))

    # Plivo Voice & Telephony Layer (Primary India / Global)
    PLIVO_AUTH_ID: str = os.getenv("PLIVO_AUTH_ID", "")
    PLIVO_AUTH_TOKEN: str = os.getenv("PLIVO_AUTH_TOKEN", "")
    PLIVO_PHONE_NUMBER: str = os.getenv("PLIVO_PHONE_NUMBER", "+918065522007")
    PLIVO_WEBHOOK_BASE_URL: str = os.getenv("PLIVO_WEBHOOK_BASE_URL", "http://localhost:8000")
    TELEPHONY_PROVIDER: str = os.getenv("TELEPHONY_PROVIDER", "plivo")

    # Google Workspace Hub OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8001/api/space/google/callback/")

settings = Settings()
