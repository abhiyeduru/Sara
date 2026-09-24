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
    department = Column(String(100), default="Sales")
    mission = Column(Text, default="Assist customers, answer queries, and qualify leads.")
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
    universal_spec = Column(JSON, default=dict) # Full Canonical Specification JSON
    workflow_spec = Column(JSON, default=dict)  # Executable Workflow Graph
    tools_spec = Column(JSON, default=list)    # Detected Tools & MCPs
    test_results = Column(JSON, default=list)  # Automated test evaluation results
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relationships
    user = relationship("User", back_populates="agents")
    business_profile = relationship("BusinessProfile", back_populates="agent", uselist=False, cascade="all, delete-orphan")
    services = relationship("AgentService", back_populates="agent", cascade="all, delete-orphan")
    faqs = relationship("AgentFAQ", back_populates="agent", cascade="all, delete-orphan")
    rules = relationship("AgentRule", back_populates="agent", cascade="all, delete-orphan")
    documents = relationship("AgentDocument", back_populates="agent", cascade="all, delete-orphan")
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

class AgentDocument(Base):
    __tablename__ = "agent_documents"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), default="pdf")
    file_size = Column(Integer, default=0)
    extracted_text = Column(Text, default="")
    structured_facts = Column(JSON, default=list) # Extracted facts, entities, policies
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    agent = relationship("VoiceAgent", back_populates="documents")

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

# ==========================================
# SAADHYAM UNIVERSAL CRM & CONVERSATION MODELS
# ==========================================

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    phone = Column(String(50), nullable=True, index=True)
    email = Column(String(255), nullable=True, index=True)
    company = Column(String(200), nullable=True, default="")
    source = Column(String(100), default="Website", index=True) # Website, Meta Ads, Google Ads, WhatsApp, Phone calls, etc.
    campaign = Column(String(100), default="")
    ad = Column(String(100), default="")
    location = Column(String(150), default="")
    budget = Column(String(100), default="")
    timeline = Column(String(100), default="")
    interest = Column(String(150), default="")
    status = Column(String(50), default="New Lead", index=True)
    pipeline_stage = Column(String(50), default="New Lead", index=True) # New Lead, Contacted, Qualified, Interested, Proposal, Negotiation, Won, Lost
    lead_score = Column(Integer, default=50) # 0-100
    assigned_user = Column(String(150), default="Unassigned")
    assigned_agent = Column(String(150), default="SARA")
    requirements = Column(JSON, default=list) # e.g. ["3BHK villa", "Kakinada"]
    preferences = Column(JSON, default=list) # e.g. ["East facing", "Gated community"]
    memory = Column(JSON, default=dict) # cumulative consolidated memory with source references
    custom_fields = Column(JSON, default=dict)
    last_interaction = Column(DateTime(timezone=True), default=get_utc_now)
    next_followup = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relationships
    calls = relationship("CallRecord", back_populates="customer", cascade="all, delete-orphan", order_by="desc(CallRecord.created_at)")
    activities = relationship("ActivityTimeline", back_populates="customer", cascade="all, delete-orphan", order_by="desc(ActivityTimeline.timestamp)")
    tasks = relationship("CRMTask", back_populates="customer", cascade="all, delete-orphan", order_by="CRMTask.due_date")
    deals = relationship("Deal", back_populates="customer", cascade="all, delete-orphan")
    communications = relationship("CRMCommunication", back_populates="customer", cascade="all, delete-orphan", order_by="desc(CRMCommunication.timestamp)")
    meetings = relationship("CRMMeeting", back_populates="customer", cascade="all, delete-orphan", order_by="desc(CRMMeeting.scheduled_at)")
    documents = relationship("CRMDocument", back_populates="customer", cascade="all, delete-orphan", order_by="desc(CRMDocument.created_at)")
    audit_logs = relationship("CRMAuditLog", back_populates="customer")

class CustomerPipeline(Base):
    __tablename__ = "customer_pipelines"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), default="Standard Sales Pipeline", nullable=False)
    stages = Column(JSON, default=lambda: [
        {"id": "new_lead", "name": "New Lead", "color": "#3B82F6", "order": 1},
        {"id": "contacted", "name": "Contacted", "color": "#8B5CF6", "order": 2},
        {"id": "qualified", "name": "Qualified", "color": "#EC4899", "order": 3},
        {"id": "interested", "name": "Interested", "color": "#F59E0B", "order": 4},
        {"id": "proposal", "name": "Proposal Sent", "color": "#10B981", "order": 5},
        {"id": "negotiation", "name": "Negotiation", "color": "#6366F1", "order": 6},
        {"id": "won", "name": "Won", "color": "#059669", "order": 7, "is_won": True},
        {"id": "lost", "name": "Lost", "color": "#EF4444", "order": 8, "is_lost": True},
    ])
    is_default = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

class CallRecord(Base):
    __tablename__ = "call_records"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(64), nullable=True, index=True) # links to VoiceAgent ConversationSession
    caller = Column(String(100), default="Customer")
    receiver = Column(String(100), default="SARA")
    phone_number = Column(String(50), default="")
    direction = Column(String(50), default="Inbound") # Inbound, Outbound, AI Voice Call, Human Call, Transferred
    call_type = Column(String(50), default="AI Voice Call")
    start_time = Column(DateTime(timezone=True), default=get_utc_now)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, default=0)
    call_status = Column(String(50), default="Completed") # Completed, Missed, Voicemail, Busy, Callback Requested
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    # Relationships
    customer = relationship("Customer", back_populates="calls")
    recording = relationship("CallRecording", back_populates="call", uselist=False, cascade="all, delete-orphan")
    transcripts = relationship("CallTranscript", back_populates="call", cascade="all, delete-orphan", order_by="CallTranscript.start_time_offset")
    intelligence = relationship("CallIntelligence", back_populates="call", uselist=False, cascade="all, delete-orphan")

class CallRecording(Base):
    __tablename__ = "call_recordings"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    call_id = Column(String(64), ForeignKey("call_records.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    file_path = Column(String(500), nullable=False) # Server path inside storage/recordings/
    file_name = Column(String(255), default="recording.wav")
    file_size_bytes = Column(Integer, default=0)
    mime_type = Column(String(100), default="audio/wav")
    duration_seconds = Column(Integer, default=0)
    transcription_status = Column(String(50), default="Completed") # Pending, Processing, Completed, Failed
    analysis_status = Column(String(50), default="Completed") # Pending, Processing, Completed, Failed
    is_consent_given = Column(Boolean, default=True)
    retention_days = Column(Integer, default=90)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    call = relationship("CallRecord", back_populates="recording")

class CallTranscript(Base):
    __tablename__ = "call_transcripts"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    call_id = Column(String(64), ForeignKey("call_records.id", ondelete="CASCADE"), nullable=False, index=True)
    speaker = Column(String(50), nullable=False) # Agent, Customer
    speaker_name = Column(String(100), default="Customer")
    start_time_offset = Column(Float, default=0.0) # Seconds
    end_time_offset = Column(Float, default=0.0)
    text = Column(Text, nullable=False)
    language = Column(String(20), default="en")
    confidence = Column(Float, default=0.95)
    sentiment = Column(String(30), default="Neutral")
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    call = relationship("CallRecord", back_populates="transcripts")

class CallIntelligence(Base):
    __tablename__ = "call_intelligence"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    call_id = Column(String(64), ForeignKey("call_records.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_intent = Column(Text, default="")
    requirements = Column(JSON, default=list)
    budget = Column(String(100), default="")
    timeline = Column(String(100), default="")
    objections = Column(JSON, default=list)
    questions = Column(JSON, default=list)
    competitors = Column(JSON, default=list)
    sentiment = Column(String(50), default="Interested") # Positive, Neutral, Negative, Frustrated, Interested, Uncertain
    sentiment_score = Column(Float, default=0.8)
    purchase_intent = Column(String(50), default="High") # High, Medium, Low, Uncertain
    purchase_intent_score = Column(Float, default=0.85)
    promises = Column(JSON, default=list)
    follow_up_needed = Column(Boolean, default=True)
    follow_up_reason = Column(Text, default="")
    follow_up_date = Column(DateTime(timezone=True), nullable=True)
    next_recommended_action = Column(Text, default="")
    call_summary = Column(Text, default="")
    raw_ai_response = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    call = relationship("CallRecord", back_populates="intelligence")

class ActivityTimeline(Base):
    __tablename__ = "activity_timelines"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_type = Column(String(50), nullable=False) # call, message, email, meeting, note, task, followup, appointment, payment, deal_update, ai_action, human_action, workflow_action
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    actor_type = Column(String(50), default="AI Agent") # AI Agent, Human Employee, Customer, System
    actor_name = Column(String(150), default="SARA")
    source = Column(String(100), default="CRM")
    status = Column(String(50), default="Completed")
    metadata_json = Column(JSON, default=dict)
    timestamp = Column(DateTime(timezone=True), default=get_utc_now, index=True)

    customer = relationship("Customer", back_populates="activities")

class CRMTask(Base):
    __tablename__ = "crm_tasks"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    task_type = Column(String(50), default="Follow-up") # Follow-up, Callback, Meeting, Document, Proposal, Payment
    priority = Column(String(20), default="Medium") # Low, Medium, High, Urgent
    status = Column(String(50), default="Pending") # Pending, In Progress, Completed, Cancelled
    due_date = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(String(150), default="Sales Agent")
    is_ai_generated = Column(Boolean, default=False)
    trigger_reason = Column(Text, default="")
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    customer = relationship("Customer", back_populates="tasks")

class Deal(Base):
    __tablename__ = "deals"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    amount = Column(Float, default=0.0)
    currency = Column(String(10), default="INR")
    stage = Column(String(50), default="Qualified") # Qualified, Proposal, Negotiation, Won, Lost
    probability = Column(Integer, default=50) # 0 to 100
    expected_close_date = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    customer = relationship("Customer", back_populates="deals")

class CRMAutomation(Base):
    __tablename__ = "crm_automations"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    natural_language_prompt = Column(Text, default="")
    trigger_event = Column(String(100), nullable=False) # lead.created, call.completed, transcript.completed, conversation.analyzed, etc.
    conditions = Column(JSON, default=dict)
    actions = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    execution_count = Column(Integer, default=0)
    last_executed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

class CRMAuditLog(Base):
    __tablename__ = "crm_audit_logs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_type = Column(String(50), default="AI") # AI, Human, System
    actor_name = Column(String(150), default="Sales AI")
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), default="Customer")
    entity_id = Column(String(64), nullable=True)
    previous_value = Column(JSON, default=dict)
    new_value = Column(JSON, default=dict)
    reason = Column(Text, default="")
    timestamp = Column(DateTime(timezone=True), default=get_utc_now)

    customer = relationship("Customer", back_populates="audit_logs")

class CRMCommunication(Base):
    __tablename__ = "crm_communications"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String(50), default="WhatsApp") # WhatsApp, Email, SMS
    direction = Column(String(20), default="Inbound") # Inbound, Outbound
    sender = Column(String(100), default="")
    recipient = Column(String(100), default="")
    subject = Column(String(255), default="") # For emails
    body = Column(Text, nullable=False)
    media_url = Column(String(500), nullable=True)
    delivery_status = Column(String(50), default="Delivered") # Sent, Delivered, Read, Failed
    read_status = Column(Boolean, default=True)
    ai_summary = Column(Text, default="")
    ai_intent = Column(String(100), default="")
    timestamp = Column(DateTime(timezone=True), default=get_utc_now, index=True)

    customer = relationship("Customer", back_populates="communications")

class CRMMeeting(Base):
    __tablename__ = "crm_meetings"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    participants = Column(JSON, default=list) # List of participant names/emails
    scheduled_at = Column(DateTime(timezone=True), default=get_utc_now)
    duration_minutes = Column(Integer, default=30)
    meeting_notes = Column(Text, default="")
    recording_url = Column(String(500), nullable=True)
    ai_summary = Column(Text, default="")
    decisions = Column(JSON, default=list)
    action_items = Column(JSON, default=list)
    status = Column(String(50), default="Scheduled") # Scheduled, Completed, Cancelled
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    customer = relationship("Customer", back_populates="meetings")

class CRMDocument(Base):
    __tablename__ = "crm_documents"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    doc_type = Column(String(50), default="Brochure") # Brochure, Proposal, Contract, KYC, Receipt
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    uploaded_by = Column(String(100), default="SARA")
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    customer = relationship("Customer", back_populates="documents")

class CRMPrivacySettings(Base):
    __tablename__ = "crm_privacy_settings"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    recording_retention_days = Column(Integer, default=90)
    transcript_retention_days = Column(Integer, default=180)
    audit_log_retention_days = Column(Integer, default=365)
    require_recording_consent = Column(Boolean, default=True)
    enable_auto_pii_masking = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)
