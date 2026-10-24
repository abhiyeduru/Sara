import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from server.config import settings

logger = logging.getLogger("sara.database")

def create_db_engine():
    db_url = settings.DATABASE_URL
    if db_url and not db_url.startswith("sqlite"):
        try:
            test_engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_recycle=300,
                pool_size=15,
                max_overflow=30,
                pool_timeout=30,
                echo=False,
                connect_args={
                    "connect_timeout": 15,
                    "keepalives": 1,
                    "keepalives_idle": 30,
                    "keepalives_interval": 10,
                    "keepalives_count": 5
                } if "postgres" in db_url else {}
            )
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Connected successfully to PostgreSQL database (Neon).")
            return test_engine
        except Exception as e:
            logger.warning(f"PostgreSQL connection to Neon failed ({e}). Falling back to local SQLite database (sqlite:///sara.db)...")

    # Local SQLite fallback with NullPool to prevent QueuePool exhaustion under concurrent voice/polling loads
    from sqlalchemy.pool import NullPool
    from sqlalchemy import event
    sqlite_url = "sqlite:///sara.db"
    sqlite_engine = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False, "timeout": 60},
        poolclass=NullPool,
        echo=False
    )

    @event.listens_for(sqlite_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            # WAL mode enables concurrent read access while a write is occurring
            cursor.execute("PRAGMA journal_mode=WAL")
            # Busy timeout: wait up to 60,000ms for locks instead of throwing OperationalError
            cursor.execute("PRAGMA busy_timeout=60000")
            # Normal synchronous is fast and safe with WAL
            cursor.execute("PRAGMA synchronous=NORMAL")
            # Cache size: 64MB in-memory cache
            cursor.execute("PRAGMA cache_size=-64000")
            # Temp store in memory
            cursor.execute("PRAGMA temp_store=MEMORY")
            # Memory-mapped I/O for 256MB
            cursor.execute("PRAGMA mmap_size=268435456")
            # Enforce foreign key constraints
            cursor.execute("PRAGMA foreign_keys=ON")
            # Auto-checkpoint WAL every 1,000 pages to keep WAL file compact
            cursor.execute("PRAGMA wal_autocheckpoint=1000")
        except Exception as pe:
            logger.debug(f"SQLite PRAGMA tuning note: {pe}")
        finally:
            cursor.close()

    return sqlite_engine

engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_database_health_status(db = None):
    """
    Returns live database diagnostic health metrics:
    Latency, storage sizes, WAL state, and entity counts.
    """
    import os
    import time
    from sqlalchemy import text

    start_time = time.time()
    health = {
        "status": "healthy",
        "engine": "sqlite" if str(engine.url).startswith("sqlite") else "postgresql",
        "url_masked": str(engine.url).split("@")[-1] if "@" in str(engine.url) else str(engine.url),
        "latency_ms": 0.0,
        "wal_mode": False,
        "busy_timeout_ms": 60000,
        "db_size_mb": 0.0,
        "wal_size_mb": 0.0,
        "table_counts": {}
    }

    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        # Measure ping latency
        db.execute(text("SELECT 1"))
        health["latency_ms"] = round((time.time() - start_time) * 1000, 2)

        if health["engine"] == "sqlite":
            res = db.execute(text("PRAGMA journal_mode")).fetchone()
            if res:
                health["wal_mode"] = str(res[0]).lower() == "wal"

            # Check file size
            db_path = "sara.db"
            if os.path.exists(db_path):
                health["db_size_mb"] = round(os.path.getsize(db_path) / (1024 * 1024), 2)
            wal_path = "sara.db-wal"
            if os.path.exists(wal_path):
                health["wal_size_mb"] = round(os.path.getsize(wal_path) / (1024 * 1024), 2)

        # Count records
        for table in ["users", "workspaces", "calls", "credit_accounts", "credit_transactions", "leads", "tasks"]:
            try:
                cnt = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                health["table_counts"][table] = cnt
            except Exception:
                pass

    except Exception as e:
        health["status"] = "degraded"
        health["error"] = str(e)
    finally:
        if own_session:
            db.close()

    return health

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_default_agents(db, user_id: str):
    from server import models
    from server.engine.prompt_generator import PromptGenerator

    business_configs = [
        {
            "name": "SARA",
            "business_type": "Real Estate",
            "role_title": "Property Advisor",
            "service_type": "Property enquiries",
            "voice_id": "3a8e6fea-81e5-4d4d-8755-86093146cdb8",
            "biz": {
                "business_name": "ABC Properties",
                "description": "Premier real estate company in Hyderabad.",
                "locations": ["Gachibowli", "Kondapur", "Kokapet"],
                "services": ["2 BHK", "3 BHK", "Villas"],
                "operating_hours": "9 AM - 7 PM IST",
                "contact_info": "+91 9876543210 / info@abcproperties.example.com",
                "important_policies": "Transparent pricing, zero hidden brokerage."
            },
            "faqs": [
                {"question": "What is the starting price for a 2 BHK?", "answer": "The starting price for a 2 BHK is ₹85 Lakhs in Gachibowli and Kondapur.", "category": "Pricing"},
                {"question": "Where are your projects?", "answer": "In Gachibowli, Kondapur, and Kokapet.", "category": "Locations"},
                {"question": "What amenities are included?", "answer": "All projects include a clubhouse, swimming pool, 24/7 power backup, gym, and children play area.", "category": "General"},
                {"question": "Can I schedule a site visit?", "answer": "Yes, absolutely! We organize site visits every day between 10 AM and 6 PM. I can arrange one for you.", "category": "Booking"}
            ],
            "rules": [
                "Never invent prices or discounts not listed in business knowledge.",
                "Never promise inventory not verified in the database.",
                "If information is unavailable, politely offer human representative assistance."
            ]
        },
        {
            "name": "SARA",
            "business_type": "College / University",
            "role_title": "Admissions Counsellor",
            "service_type": "College information",
            "voice_id": "62ae83ad-4f6a-430b-af41-a9bede9286ca",
            "biz": {
                "business_name": "Vishwa University",
                "description": "Leading technological institute offering engineering and science courses.",
                "locations": ["Main Campus, Hyderabad"],
                "services": ["B.Tech CSE", "M.Tech", "Hostel facilities"],
                "operating_hours": "8:30 AM - 5:00 PM IST",
                "contact_info": "+91 9876543211 / admissions@vishwa.edu",
                "important_policies": "Merit based scholarships available."
            },
            "faqs": [
                {"question": "What is the fee for B.Tech?", "answer": "Tuition fee for B.Tech CSE is ₹1.5 Lakhs per year with merit scholarship options available.", "category": "Fees"},
                {"question": "What is the eligibility for CSE?", "answer": "Minimum 60% aggregate in 12th grade PCM with entrance test.", "category": "Eligibility"},
                {"question": "Is hostel facility available for boys and girls?", "answer": "Yes, separate modern hostel facilities with Wi-Fi, food, and security are provided on campus.", "category": "Campus"}
            ],
            "rules": [
                "Never invent admission quotas or unlisted courses.",
                "Never promise admission without entrance test verification.",
                "If a course is not in knowledge base, state it is unavailable."
            ]
        },
        {
            "name": "SARA",
            "business_type": "Product Sales",
            "role_title": "Product Specialist",
            "service_type": "Product information",
            "voice_id": "ef191366-f52f-447a-a398-ed8c0f2943a1",
            "biz": {
                "business_name": "Apex Electronics",
                "description": "Authorized dealer for high-performance computing systems.",
                "locations": ["Online Store & Hitec City Retail"],
                "services": ["Gaming Laptops", "Workstations", "Accessories"],
                "operating_hours": "10 AM - 9 PM IST",
                "contact_info": "+91 9876543212 / support@apexelectronics.example.com",
                "important_policies": "All products come with standard manufacturer warranty."
            },
            "faqs": [
                {"question": "What is the warranty period?", "answer": "All systems include a 1-year comprehensive manufacturer warranty.", "category": "Support"},
                {"question": "What is the price of the gaming laptop?", "answer": "The Apex Gaming series starts at ₹75,000.", "category": "Pricing"},
                {"question": "What payment methods are accepted?", "answer": "We accept all major credit/debit cards, UPI, net banking, and EMI options.", "category": "Policies"}
            ],
            "rules": [
                "Never promise unlisted discounts or free accessories.",
                "Never fabricate hardware specifications not listed."
            ]
        }
    ]

    for cfg in business_configs:
        gen = PromptGenerator.generate(
            agent_name=cfg["name"],
            role_title=cfg["role_title"],
            business_info=cfg["biz"],
            services=cfg["biz"]["services"],
            faqs=cfg["faqs"],
            rules=cfg["rules"],
            personality="Professional & Friendly",
            comm_style="Concise",
            sales_behavior="Consultative",
            languages=["en", "te", "hi"]
        )

        agent = models.VoiceAgent(
            user_id=user_id,
            name=cfg["name"],
            role_title=cfg["role_title"],
            business_type=cfg["business_type"],
            service_type=cfg["service_type"],
            personality="Professional & Friendly",
            communication_style="Concise",
            sales_behavior="Consultative",
            languages=["en", "te", "hi"],
            voice_id=cfg["voice_id"],
            voice_gender="female" if cfg["business_type"] != "Product Sales" else "male",
            voice_name="Skylar" if cfg["business_type"] == "Real Estate" else ("Gemma" if cfg["business_type"] == "College / University" else "Archie"),
            is_active=True
        )
        db.add(agent)
        db.flush()

        bp = models.BusinessProfile(
            agent_id=agent.id,
            user_id=user_id,
            business_name=cfg["biz"]["business_name"],
            description=cfg["biz"]["description"],
            industry=cfg["business_type"],
            locations=cfg["biz"]["locations"],
            services_offered=cfg["biz"]["services"],
            operating_hours=cfg["biz"]["operating_hours"],
            contact_info=cfg["biz"].get("contact_info", ""),
            important_policies=cfg["biz"].get("important_policies", "")
        )
        db.add(bp)

        for f in cfg["faqs"]:
            faq_obj = models.AgentFAQ(
                agent_id=agent.id,
                user_id=user_id,
                question=f["question"],
                answer=f["answer"],
                category=f.get("category", "General"),
                priority=1
            )
            db.add(faq_obj)

        for r in cfg["rules"]:
            rule_obj = models.AgentRule(
                agent_id=agent.id,
                user_id=user_id,
                rule_text=r,
                rule_type="custom",
                is_active=True
            )
            db.add(rule_obj)

        prompt_record = models.GeneratedPrompt(
            agent_id=agent.id,
            user_id=user_id,
            full_prompt=gen["full_prompt"],
            greeting_prompt=gen["greeting_prompt"],
            identity_section=gen["identity_section"],
            business_section=gen["business_section"],
            faq_section=gen["faq_section"],
            rules_section=gen["rules_section"],
            language_section=gen["language_section"],
            voice_behavior_section=gen["spoken_rules"],
            escalation_policy=gen["escalation_policy"]
        )
        db.add(prompt_record)

    db.commit()
    logger.info(f"Seeded {len(business_configs)} default business agents for user {user_id}")

def init_db():
    from server import models
    # Safe SQLite column migration for dev databases
    try:
        with engine.connect() as conn:
            # Check users columns
            res = conn.execute(text("PRAGMA table_info(users);")).fetchall()
            existing_cols = {r[1] for r in res}
            cols_to_add = {
                "name": "VARCHAR(255)",
                "phone": "VARCHAR(50)",
                "avatar_url": "VARCHAR(500)",
                "auth_provider": "VARCHAR(50) DEFAULT 'firebase'",
                "status": "VARCHAR(30) DEFAULT 'active'",
                "updated_at": "TIMESTAMP"
            }
            for col, col_def in cols_to_add.items():
                if col not in existing_cols:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_def};"))

            # Check calls columns
            c_res = conn.execute(text("PRAGMA table_info(calls);")).fetchall()
            c_existing = {r[1] for r in c_res}
            c_cols = {
                "twilio_call_sid": "VARCHAR(100)",
                "lead_id": "VARCHAR(64)",
                "employee_id": "VARCHAR(64)",
                "from_number": "VARCHAR(50)",
                "to_number": "VARCHAR(50)",
                "answered_at": "TIMESTAMP",
                "recording_url": "VARCHAR(500)",
                "transcript_url": "VARCHAR(500)",
                "credits_used": "FLOAT DEFAULT 0.0",
                "cost": "FLOAT DEFAULT 0.0",
                "updated_at": "TIMESTAMP"
            }
            for col, col_def in c_cols.items():
                if col not in c_existing:
                    conn.execute(text(f"ALTER TABLE calls ADD COLUMN {col} {col_def};"))

            # Check phone_numbers columns
            p_res = conn.execute(text("PRAGMA table_info(phone_numbers);")).fetchall()
            p_existing = {r[1] for r in p_res}
            p_cols = {
                "twilio_sid": "VARCHAR(100)",
                "assigned_employee_id": "VARCHAR(64)",
                "phone_number": "VARCHAR(50)",
                "friendly_name": "VARCHAR(150)"
            }
            for col, col_def in p_cols.items():
                if col not in p_existing:
                    conn.execute(text(f"ALTER TABLE phone_numbers ADD COLUMN {col} {col_def};"))

            conn.commit()
    except Exception:
        pass

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == "user_business_owner_1").first()
        if not user:
            user = models.User(
                id="user_business_owner_1",
                email="owner@sara.ai",
                display_name="SARA Business Owner"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Clean init without seeding dummy data
        pass
    except Exception as e:
        logger.error(f"Error during init_db: {e}")
        db.rollback()
    finally:
        db.close()
