from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from server.config import settings

# Configure connection engine with Neon connection pooler support
# pool_pre_ping checks connectivity before handing connections out
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=10,
    max_overflow=20,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from server import models
    Base.metadata.create_all(bind=engine)
