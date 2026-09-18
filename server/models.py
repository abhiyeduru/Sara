import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey, Index, JSON
)
from sqlalchemy.orm import relationship
from server.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(128), primary_key=True) # Firebase UID
    email = Column(String(255), nullable=True, index=True)
    display_name = Column(String(255), nullable=True)
    role = Column(String(50), default="business_user")
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    # Relationships
    agents = relationship("VoiceAgent", back_populates="user", cascade="all, delete-orphan")

class VoiceAgent(Base):
    __tablename__ = "voice_agents"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), default="SARA", nullable=False)
    role_title = Column(String(150), default="Business Representative")
    business_type = Column(String(100), default="Real Estate", nullable=False)
    service_type = Column(String(100), default="Property enquiries")
    personality = Column(String(50), default="Professional & Friendly")
    communication_style = Column(String(50), default="Concise")
    sales_behavior = Column(String(50), default="Consultative")
    languages = Column(JSON, default=lambda: ["en", "te", "hi"])
    primary_language = Column(String(20), default="en")
    voice_id = Column(String(100), default="db6b0ed5-d5d3-463d-ae85-518a07d3c2b4")
    voice_gender = Column(String(20), default="female")
    voice_name = Column(String(100), default="Skylar")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relationships
    user = relationship("User", back_populates="agents")
    business_profile = relationship("BusinessProfile", back_populates="agent", uselist=False, cascade="all, delete-orphan")
    services = relationship("AgentService", back_populates="agent", cascade="all, delete-orphan")
    faqs = relationship("AgentFAQ", back_populates="agent", cascade="all, delete-orphan")
    rules = relationship("AgentRule", back_populates="agent", cascade="all, delete-orphan")
    generated_prompt = relationship("GeneratedPrompt", back_populates="agent", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("ConversationSession", back_populates="agent", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_agent_user_active", "user_id", "is_active"),
    )

class BusinessProfile(Base):
    __tablename__ = "business_profiles"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_name = Column(String(200), default="ABC Properties", nullable=False)
    description = Column(Text, default="A leading real estate company operating in Hyderabad.")
    industry = Column(String(100), default="Real Estate")
    locations = Column(JSON, default=lambda: ["Gachibowli", "Kondapur", "Kokapet"])
    services_offered = Column(JSON, default=lambda: ["2 BHK", "3 BHK", "Villas", "Plots"])
    products_offered = Column(JSON, default=list)
    operating_hours = Column(String(100), default="9:00 AM – 7:00 PM IST")
    contact_info = Column(String(200), default="contact@abcproperties.com / +91 9876543210")
    website = Column(String(200), default="https://abcproperties.example.com")
    important_policies = Column(Text, default="Transparent pricing, no hidden brokerage for direct buyers.")
    additional_info = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    agent = relationship("VoiceAgent", back_populates="business_profile")

class AgentService(Base):
    __tablename__ = "agent_services"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, default="")
    is_primary = Column(Boolean, default=False)

    agent = relationship("VoiceAgent", back_populates="services")

class AgentFAQ(Base):
    __tablename__ = "agent_faqs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(String(100), default="General", index=True)
    priority = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    agent = relationship("VoiceAgent", back_populates="faqs")

    __table_args__ = (
        Index("ix_faq_agent_category", "agent_id", "category"),
    )

class AgentRule(Base):
    __tablename__ = "agent_rules"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_text = Column(Text, nullable=False)
    rule_type = Column(String(50), default="behavior") # behavior, restriction, safety, compliance
    is_active = Column(Boolean, default=True)

    agent = relationship("VoiceAgent", back_populates="rules")

class GeneratedPrompt(Base):
    __tablename__ = "generated_prompts"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    full_prompt = Column(Text, nullable=False)
    greeting_prompt = Column(Text, nullable=False)
    identity_section = Column(Text, default="")
    business_section = Column(Text, default="")
    rules_section = Column(Text, default="")
    faq_section = Column(Text, default="")
    language_section = Column(Text, default="")
    voice_behavior_section = Column(Text, default="")
    escalation_policy = Column(Text, default="")
    version = Column(Integer, default=1)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    agent = relationship("VoiceAgent", back_populates="generated_prompt")

class ConversationSession(Base):
    __tablename__ = "conversation_sessions"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    caller_name = Column(String(150), default="Caller")
    active_language = Column(String(20), default="en")
    current_stage = Column(String(50), default="GREETING")
    status = Column(String(50), default="active") # active, completed, interrupted, escalated
    started_at = Column(DateTime(timezone=True), default=get_utc_now)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    agent = relationship("VoiceAgent", back_populates="sessions")
    messages = relationship("ConversationMessage", back_populates="session", cascade="all, delete-orphan", order_by="ConversationMessage.created_at")
    state = relationship("ConversationState", back_populates="session", uselist=False, cascade="all, delete-orphan")
    latencies = relationship("LatencyMetric", back_populates="session", cascade="all, delete-orphan")

class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    session_id = Column(String(64), ForeignKey("conversation_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False) # user, agent, system
    content = Column(Text, nullable=False)
    detected_language = Column(String(20), default="en")
    detected_intent = Column(String(100), default="general")
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    session = relationship("ConversationSession", back_populates="messages")

class ConversationState(Base):
    __tablename__ = "conversation_states"

    session_id = Column(String(64), ForeignKey("conversation_sessions.id", ondelete="CASCADE"), primary_key=True)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_name = Column(String(150), nullable=True)
    conversation_stage = Column(String(50), default="GREETING")
    current_intent = Column(String(100), default="unknown")
    collected_fields = Column(JSON, default=dict)
    pending_action = Column(String(150), nullable=True)
    escalation_required = Column(Boolean, default=False)
    last_user_message = Column(Text, nullable=True)
    last_agent_message = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    session = relationship("ConversationSession", back_populates="state")

class LatencyMetric(Base):
    __tablename__ = "latency_metrics"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    session_id = Column(String(64), ForeignKey("conversation_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    turn_index = Column(Integer, default=1)
    stt_ms = Column(Float, default=0.0)
    llm_first_token_ms = Column(Float, default=0.0)
    llm_total_ms = Column(Float, default=0.0)
    tts_first_audio_ms = Column(Float, default=0.0)
    time_to_first_audio_ms = Column(Float, default=0.0)
    total_response_ms = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    session = relationship("ConversationSession", back_populates="latencies")
