"""
SARA AI — Complete Data Models
Multi-tenant AI Workforce Operating System schema.

Hierarchy:
  Platform → Organization → Workspace → Users → AI Workforce →
  Teams → AI Employees → Skills / Knowledge / Tools / Tasks / Workflows →
  Conversations → Actions → Approvals → Events
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float,
    DateTime, ForeignKey, Index, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from server.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())

generate_uuid = _uuid


def _now() -> datetime:
    return datetime.now(timezone.utc)

get_utc_now = _now


# ═══════════════════════════════════════════════════════════════════════════
# 1. USER & ORGANISATION
# ═══════════════════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id           = Column(String(128), primary_key=True)          # Firebase UID or UUID
    name         = Column(String(255), nullable=True)
    email        = Column(String(255), nullable=True, index=True)
    display_name = Column(String(255), nullable=True)
    phone        = Column(String(50),  nullable=True)
    avatar_url   = Column(String(500), nullable=True)
    auth_provider= Column(String(50),  default="firebase")        # firebase | google | email
    status       = Column(String(30),  default="active")          # active | suspended | deleted
    role         = Column(String(50),  default="business_user")   # legacy compat
    created_at   = Column(DateTime(timezone=True), default=_now)
    updated_at   = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    # Relationships
    workspace_memberships = relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")
    api_keys              = relationship("APIKey",          back_populates="user", cascade="all, delete-orphan")

    # Legacy relationships (preserved for existing voice agent routes)
    agents = relationship("VoiceAgent", back_populates="user", cascade="all, delete-orphan")


class Organization(Base):
    __tablename__ = "organizations"

    id           = Column(String(64), primary_key=True, default=_uuid)
    name         = Column(String(200), nullable=False)
    industry     = Column(String(100), nullable=True)
    company_size = Column(String(50),  nullable=True)             # 1-10 | 11-50 | 51-200 | 201-1000 | 1000+
    logo_url     = Column(String(500), nullable=True)
    timezone     = Column(String(100), default="Asia/Kolkata")
    currency     = Column(String(10),  default="INR")
    country      = Column(String(100), default="India")
    created_at   = Column(DateTime(timezone=True), default=_now)
    updated_at   = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    workspaces = relationship("Workspace", back_populates="organization", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id              = Column(String(64), primary_key=True, default=_uuid)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name            = Column(String(200), nullable=False)
    slug            = Column(String(100), nullable=True, unique=True)
    description     = Column(Text, default="")
    plan            = Column(String(50),  default="growth")        # free | starter | growth | enterprise
    status          = Column(String(30),  default="active")
    settings        = Column(JSON, default=dict)
    created_at      = Column(DateTime(timezone=True), default=_now)
    updated_at      = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    organization = relationship("Organization",   back_populates="workspaces")
    members      = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    ai_employees = relationship("AIEmployee",     back_populates="workspace",  cascade="all, delete-orphan")
    ai_teams     = relationship("AITeam",         back_populates="workspace",  cascade="all, delete-orphan")
    credits      = relationship("CreditAccount",  back_populates="workspace",  uselist=False, cascade="all, delete-orphan")

    __table_args__ = (Index("ix_workspace_org", "organization_id"),)


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id      = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"),     nullable=False, index=True)
    role         = Column(String(50), default="member")            # owner | admin | manager | ai_manager | member | viewer
    status       = Column(String(30), default="active")
    joined_at    = Column(DateTime(timezone=True), default=_now)

    workspace = relationship("Workspace", back_populates="members")
    user      = relationship("User",      back_populates="workspace_memberships")

    __table_args__ = (Index("ix_wm_ws_user", "workspace_id", "user_id"),)


# ═══════════════════════════════════════════════════════════════════════════
# 2. AI EMPLOYEES
# ═══════════════════════════════════════════════════════════════════════════

class AIEmployee(Base):
    __tablename__ = "ai_employees"

    id              = Column(String(64),  primary_key=True, default=_uuid)
    workspace_id    = Column(String(64),  ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String(64),  nullable=True, index=True)
    created_by      = Column(String(128), nullable=True)

    # Identity
    name          = Column(String(100), nullable=False)
    avatar_url    = Column(String(500), nullable=True)
    role          = Column(String(150), nullable=False, default="AI Employee")
    department    = Column(String(100), default="General")
    mission       = Column(Text, default="")
    description   = Column(Text, default="")

    # Configuration
    status          = Column(String(30), default="draft")  # draft | training | active | paused | archived
    primary_model   = Column(String(100), default="groq")
    fallback_model  = Column(String(100), default="openai")
    fast_model      = Column(String(100), default="groq")
    reasoning_model = Column(String(100), default="openai")

    # Voice
    voice_id      = Column(String(100), nullable=True)
    voice_name    = Column(String(100), nullable=True)
    voice_gender  = Column(String(20),  default="female")
    voice_language= Column(String(20),  default="en")
    voice_speed   = Column(Float, default=1.0)
    voice_tone    = Column(String(50),  default="professional")

    # Behaviour
    languages     = Column(JSON, default=lambda: ["en"])
    working_hours = Column(JSON, default=lambda: {"start": "09:00", "end": "21:00", "days": ["mon","tue","wed","thu","fri","sat"]})
    personality   = Column(String(50), default="Professional & Friendly")
    communication_style = Column(String(50), default="Concise")
    sales_behavior= Column(String(50), default="Consultative")

    # Runtime specs (compiled from natural language)
    compiled_prompt   = Column(Text, default="")
    universal_spec    = Column(JSON, default=dict)
    workflow_spec     = Column(JSON, default=dict)
    tools_spec        = Column(JSON, default=list)
    test_results      = Column(JSON, default=list)

    # Stats (denormalised for performance)
    total_calls       = Column(Integer, default=0)
    total_tasks       = Column(Integer, default=0)
    total_leads       = Column(Integer, default=0)
    performance_score = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    # Relationships
    workspace   = relationship("Workspace",       back_populates="ai_employees")
    skills      = relationship("AIEmployeeSkill", back_populates="employee", cascade="all, delete-orphan")
    permissions = relationship("AIEmployeePermission", back_populates="employee", cascade="all, delete-orphan")
    knowledge   = relationship("KnowledgeSource", back_populates="employee", cascade="all, delete-orphan")
    tasks       = relationship("Task",            back_populates="ai_employee",  foreign_keys="Task.ai_employee_id")
    calls       = relationship("Call",            back_populates="ai_employee",  foreign_keys="Call.ai_employee_id")

    __table_args__ = (Index("ix_ai_emp_ws_status", "workspace_id", "status"),)


class AIEmployeeSkill(Base):
    __tablename__ = "ai_employee_skills"

    id          = Column(String(64), primary_key=True, default=_uuid)
    employee_id = Column(String(64), ForeignKey("ai_employees.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(100), nullable=False)
    description = Column(Text, default="")
    proficiency = Column(String(30), default="expert")  # beginner | intermediate | expert

    employee = relationship("AIEmployee", back_populates="skills")


class AIEmployeePermission(Base):
    __tablename__ = "ai_employee_permissions"

    id          = Column(String(64), primary_key=True, default=_uuid)
    employee_id = Column(String(64), ForeignKey("ai_employees.id", ondelete="CASCADE"), nullable=False, index=True)
    capability  = Column(String(100), nullable=False)   # e.g. "crm:write"
    access      = Column(String(30), default="allowed") # allowed | denied | approval_required | limited

    employee = relationship("AIEmployee", back_populates="permissions")

    __table_args__ = (Index("ix_emp_perm_cap", "employee_id", "capability"),)


class AIEmployeeVersion(Base):
    """Snapshot of an AI employee configuration at a point in time."""
    __tablename__ = "ai_employee_versions"

    id          = Column(String(64), primary_key=True, default=_uuid)
    employee_id = Column(String(64), ForeignKey("ai_employees.id", ondelete="CASCADE"), nullable=False, index=True)
    version     = Column(Integer, nullable=False)
    snapshot    = Column(JSON, default=dict)  # full config JSON
    notes       = Column(Text, default="")
    created_by  = Column(String(128), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (Index("ix_emp_ver", "employee_id", "version"),)


# ═══════════════════════════════════════════════════════════════════════════
# 3. AI TEAMS
# ═══════════════════════════════════════════════════════════════════════════

class AITeam(Base):
    __tablename__ = "ai_teams"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name         = Column(String(150), nullable=False)
    mission      = Column(Text, default="")
    department   = Column(String(100), default="")
    status       = Column(String(30), default="active")
    created_by   = Column(String(128), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=_now)
    updated_at   = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    workspace = relationship("Workspace",   back_populates="ai_teams")
    members   = relationship("AITeamMember", back_populates="team", cascade="all, delete-orphan")


class AITeamMember(Base):
    __tablename__ = "ai_team_members"

    id          = Column(String(64), primary_key=True, default=_uuid)
    team_id     = Column(String(64), ForeignKey("ai_teams.id", ondelete="CASCADE"),    nullable=False, index=True)
    employee_id = Column(String(64), ForeignKey("ai_employees.id", ondelete="CASCADE"), nullable=False, index=True)
    role        = Column(String(100), default="member")  # lead | member
    joined_at   = Column(DateTime(timezone=True), default=_now)

    team = relationship("AITeam", back_populates="members")


# ═══════════════════════════════════════════════════════════════════════════
# 4. TASKS
# ═══════════════════════════════════════════════════════════════════════════

class Task(Base):
    __tablename__ = "tasks"

    id              = Column(String(64), primary_key=True, default=_uuid)
    workspace_id    = Column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    ai_employee_id  = Column(String(64), ForeignKey("ai_employees.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by      = Column(String(128), nullable=True)

    title       = Column(String(500), nullable=False)
    description = Column(Text, default="")
    task_type   = Column(String(50),  default="ai")      # ai | human | hybrid
    priority    = Column(String(20),  default="medium")  # low | medium | high | urgent
    status      = Column(String(50),  default="pending")
    # pending | queued | running | waiting | waiting_approval | completed | failed | retrying | cancelled

    # Timing
    due_at       = Column(DateTime(timezone=True), nullable=True)
    started_at   = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Result
    result       = Column(Text, default="")
    result_data  = Column(JSON, default=dict)
    error        = Column(Text, default="")
    retry_count  = Column(Integer, default=0)
    max_retries  = Column(Integer, default=3)

    # Relations
    lead_id      = Column(String(64), nullable=True, index=True)
    customer_id  = Column(String(64), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    ai_employee = relationship("AIEmployee", back_populates="tasks", foreign_keys=[ai_employee_id])
    approval    = relationship("Approval",   back_populates="task",  uselist=False)

    __table_args__ = (Index("ix_task_ws_status", "workspace_id", "status"),)


# ═══════════════════════════════════════════════════════════════════════════
# 5. WORKFLOWS
# ═══════════════════════════════════════════════════════════════════════════

class Workflow(Base):
    __tablename__ = "workflows"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by   = Column(String(128), nullable=True)

    name        = Column(String(200), nullable=False)
    description = Column(Text, default="")
    trigger     = Column(String(100), nullable=False)  # event type that starts this workflow
    status      = Column(String(30), default="active")  # active | paused | draft | archived

    nodes       = Column(JSON, default=list)   # list of node definitions
    edges       = Column(JSON, default=list)   # connections between nodes
    variables   = Column(JSON, default=dict)   # input/output variable definitions

    total_runs  = Column(Integer, default=0)
    success_runs= Column(Integer, default=0)
    last_run_at = Column(DateTime(timezone=True), nullable=True)

    created_at  = Column(DateTime(timezone=True), default=_now)
    updated_at  = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    runs = relationship("WorkflowRun", back_populates="workflow", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_workflow_ws_status", "workspace_id", "status"),)


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id          = Column(String(64), primary_key=True, default=_uuid)
    workflow_id = Column(String(64), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_data= Column(JSON, default=dict)
    status      = Column(String(30), default="running")  # running | completed | failed | cancelled
    current_node= Column(String(64), nullable=True)
    execution_log=Column(JSON, default=list)
    error       = Column(Text, default="")
    started_at  = Column(DateTime(timezone=True), default=_now)
    ended_at    = Column(DateTime(timezone=True), nullable=True)

    workflow = relationship("Workflow", back_populates="runs")


# ═══════════════════════════════════════════════════════════════════════════
# 6. KNOWLEDGE & RAG
# ═══════════════════════════════════════════════════════════════════════════

class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"

    id          = Column(String(64), primary_key=True, default=_uuid)
    employee_id = Column(String(64), ForeignKey("ai_employees.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id= Column(String(64), nullable=False, index=True)
    created_by  = Column(String(128), nullable=True)

    name        = Column(String(255), nullable=False)
    source_type = Column(String(50), default="document")  # document | website | database | api | crm
    category    = Column(String(100), default="General")   # Company Knowledge | Products | FAQs | Policies | SOPs

    # Storage
    file_path   = Column(String(500), nullable=True)   # for documents
    file_type   = Column(String(50),  nullable=True)   # pdf | docx | txt | csv | xlsx
    file_size   = Column(Integer, default=0)
    url         = Column(String(500), nullable=True)   # for websites/apis

    # Processing
    status         = Column(String(30), default="pending")  # pending | processing | indexed | failed
    extracted_text = Column(Text, default="")
    chunk_count    = Column(Integer, default=0)
    embedding_model= Column(String(100), default="")

    created_at = Column(DateTime(timezone=True), default=_now)

    employee = relationship("AIEmployee", back_populates="knowledge")
    documents= relationship("KnowledgeDocument", back_populates="source", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_ks_emp_status", "employee_id", "status"),)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id        = Column(String(64), primary_key=True, default=_uuid)
    source_id = Column(String(64), ForeignKey("knowledge_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index= Column(Integer, default=0)
    content   = Column(Text, nullable=False)
    extra_data  = Column(JSON, default=dict)
    embedding = Column(JSON, default=list)   # float vector (stored as JSON for SQLite compat)
    created_at= Column(DateTime(timezone=True), default=_now)

    source = relationship("KnowledgeSource", back_populates="documents")


# ═══════════════════════════════════════════════════════════════════════════
# 7. MEMORY
# ═══════════════════════════════════════════════════════════════════════════

class Memory(Base):
    __tablename__ = "memories"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    employee_id  = Column(String(64), nullable=True, index=True)
    customer_id  = Column(String(64), nullable=True, index=True)
    scope        = Column(String(30), default="episodic")  # short_term | episodic | semantic | employee | workspace

    content      = Column(Text, nullable=False)
    summary      = Column(Text, default="")
    importance   = Column(Float, default=0.5)  # 0.0 – 1.0
    embedding    = Column(JSON, default=list)
    extra_data     = Column(JSON, default=dict)

    expires_at   = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (Index("ix_memory_ws_emp", "workspace_id", "employee_id"),)


# ═══════════════════════════════════════════════════════════════════════════
# 8. TOOLS / MCP
# ═══════════════════════════════════════════════════════════════════════════

class MCPServer(Base):
    __tablename__ = "mcp_servers"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    name         = Column(String(150), nullable=False)
    description  = Column(Text, default="")
    server_url   = Column(String(500), nullable=True)
    server_type  = Column(String(50), default="http")  # http | sse | stdio
    auth_config  = Column(JSON, default=dict)           # encrypted credentials
    status       = Column(String(30), default="connected")
    last_ping    = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=_now)

    tools = relationship("MCPTool", back_populates="server", cascade="all, delete-orphan")


class MCPTool(Base):
    __tablename__ = "mcp_tools"

    id        = Column(String(64), primary_key=True, default=_uuid)
    server_id = Column(String(64), ForeignKey("mcp_servers.id", ondelete="CASCADE"), nullable=False, index=True)
    name      = Column(String(150), nullable=False)
    description= Column(Text, default="")
    input_schema= Column(JSON, default=dict)
    risk_level = Column(String(20), default="low")  # low | medium | high | critical
    created_at = Column(DateTime(timezone=True), default=_now)

    server = relationship("MCPServer", back_populates="tools")


# ═══════════════════════════════════════════════════════════════════════════
# 9. CALLS
# ═══════════════════════════════════════════════════════════════════════════

class Call(Base):
    __tablename__ = "calls"

    id              = Column(String(64), primary_key=True, default=_uuid)
    workspace_id    = Column(String(64), nullable=False, index=True)
    ai_employee_id  = Column(String(64), ForeignKey("ai_employees.id", ondelete="SET NULL"), nullable=True, index=True)
    employee_id     = Column(String(64), nullable=True, index=True)  # alias for employee lookup
    customer_id     = Column(String(64), nullable=True, index=True)
    lead_id         = Column(String(64), nullable=True, index=True)
    campaign_id     = Column(String(64), nullable=True, index=True)

    # Telephony
    twilio_call_sid = Column(String(100), nullable=True, index=True)
    direction       = Column(String(20), default="outbound")  # inbound | outbound
    phone_number    = Column(String(50), nullable=True)       # legacy/display number
    from_number     = Column(String(50), nullable=True)
    to_number       = Column(String(50), nullable=True)
    status          = Column(String(30), default="initiated")
    # initiated | ringing | in-progress | connected | completed | busy | no-answer | failed | canceled

    started_at      = Column(DateTime(timezone=True), nullable=True)
    answered_at     = Column(DateTime(timezone=True), nullable=True)
    ended_at        = Column(DateTime(timezone=True), nullable=True)
    duration_seconds= Column(Integer, default=0)

    # Media & Recording
    recording_url   = Column(String(500), nullable=True)
    transcript_url  = Column(String(500), nullable=True)

    # AI Analysis & Outcome
    transcript      = Column(JSON, default=list)
    summary         = Column(Text, default="")
    sentiment       = Column(String(30), default="neutral")
    intent          = Column(String(100), default="")
    lead_score      = Column(Integer, default=0)
    outcome         = Column(String(50), default="")
    # QUALIFIED | INTERESTED | NOT_INTERESTED | CALLBACK | NO_ANSWER | BUSY | WRONG_NUMBER | VOICEMAIL | FAILED

    # Billing & Cost
    credits_used    = Column(Float, default=0.0)
    cost            = Column(Float, default=0.0)
    cost_credits    = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    ai_employee = relationship("AIEmployee", back_populates="calls", foreign_keys=[ai_employee_id])
    events      = relationship("CallEvent", back_populates="call", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_call_ws_status", "workspace_id", "status"),
        Index("ix_call_sid", "twilio_call_sid"),
    )


class CallEvent(Base):
    __tablename__ = "call_events"

    id         = Column(String(64), primary_key=True, default=_uuid)
    call_id    = Column(String(64), ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    timestamp  = Column(DateTime(timezone=True), default=_now)
    event_metadata = Column(JSON, default=dict)

    call = relationship("Call", back_populates="events")


# ═══════════════════════════════════════════════════════════════════════════
# 10. CONVERSATIONS (unified: voice | whatsapp | email | web)
# ═══════════════════════════════════════════════════════════════════════════

class Conversation(Base):
    __tablename__ = "conversations"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    employee_id  = Column(String(64), nullable=True, index=True)
    customer_id  = Column(String(64), nullable=True, index=True)
    call_id      = Column(String(64), nullable=True, index=True)

    channel      = Column(String(30), default="voice")  # voice | whatsapp | email | website | sms
    status       = Column(String(30), default="active")
    sentiment    = Column(String(30), default="neutral")
    intent       = Column(String(100), default="")
    summary      = Column(Text, default="")

    started_at   = Column(DateTime(timezone=True), default=_now)
    ended_at     = Column(DateTime(timezone=True), nullable=True)

    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_conv_ws_channel", "workspace_id", "channel"),)


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id              = Column(String(64), primary_key=True, default=_uuid)
    conversation_id = Column(String(64), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role            = Column(String(20), nullable=False)  # user | assistant | system
    content         = Column(Text, nullable=False)
    channel         = Column(String(30), default="voice")
    language        = Column(String(20), default="en")
    sentiment       = Column(String(30), nullable=True)
    intent          = Column(String(100), nullable=True)
    attachments     = Column(JSON, default=list)
    extra_data        = Column(JSON, default=dict)
    created_at      = Column(DateTime(timezone=True), default=_now)

    conversation = relationship("Conversation", back_populates="messages")


# ═══════════════════════════════════════════════════════════════════════════
# 11. LEADS & CUSTOMERS
# ═══════════════════════════════════════════════════════════════════════════

class Lead(Base):
    __tablename__ = "leads"

    id              = Column(String(64), primary_key=True, default=_uuid)
    workspace_id    = Column(String(64), nullable=False, index=True)
    ai_employee_id  = Column(String(64), nullable=True, index=True)   # assigned AI employee
    created_by      = Column(String(128), nullable=True)

    # Contact
    name            = Column(String(200), nullable=False)
    phone           = Column(String(50), nullable=True, index=True)
    email           = Column(String(255), nullable=True, index=True)
    company         = Column(String(200), nullable=True)
    location        = Column(String(150), nullable=True)

    # Classification
    source          = Column(String(100), default="Website")  # Website | Campaign | WhatsApp | Referral | Inbound Call
    status          = Column(String(50), default="new")
    # new | contacted | engaged | qualified | proposal | negotiation | won | lost
    pipeline_stage  = Column(String(50), default="new")
    lead_score      = Column(Integer, default=50)

    # AI Analysis
    intent          = Column(String(150), nullable=True)
    budget          = Column(String(100), nullable=True)
    timeline        = Column(String(100), nullable=True)
    requirements    = Column(JSON, default=list)
    next_action     = Column(Text, default="")
    next_followup_at= Column(DateTime(timezone=True), nullable=True)

    last_interaction= Column(DateTime(timezone=True), default=_now)
    created_at      = Column(DateTime(timezone=True), default=_now)
    updated_at      = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (Index("ix_lead_ws_status", "workspace_id", "status"),)


# ═══════════════════════════════════════════════════════════════════════════
# 12. CAMPAIGNS
# ═══════════════════════════════════════════════════════════════════════════

class Campaign(Base):
    __tablename__ = "campaigns"

    id              = Column(String(64), primary_key=True, default=_uuid)
    workspace_id    = Column(String(64), nullable=False, index=True)
    ai_employee_id  = Column(String(64), nullable=True, index=True)
    created_by      = Column(String(128), nullable=True)

    name            = Column(String(200), nullable=False)
    description     = Column(Text, default="")
    channel         = Column(String(30), default="voice")  # voice | whatsapp | email | sms
    status          = Column(String(30), default="draft")  # draft | scheduled | running | paused | completed

    # Stats
    total_leads     = Column(Integer, default=0)
    called          = Column(Integer, default=0)
    connected       = Column(Integer, default=0)
    qualified       = Column(Integer, default=0)
    callbacks       = Column(Integer, default=0)
    failed          = Column(Integer, default=0)

    schedule_at     = Column(DateTime(timezone=True), nullable=True)
    started_at      = Column(DateTime(timezone=True), nullable=True)
    ended_at        = Column(DateTime(timezone=True), nullable=True)

    call_rules      = Column(JSON, default=dict)
    created_at      = Column(DateTime(timezone=True), default=_now)
    updated_at      = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    leads = relationship("CampaignLead", back_populates="campaign", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_campaign_ws_status", "workspace_id", "status"),)


class CampaignLead(Base):
    __tablename__ = "campaign_leads"

    id          = Column(String(64), primary_key=True, default=_uuid)
    campaign_id = Column(String(64), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id     = Column(String(64), nullable=False, index=True)
    status      = Column(String(30), default="pending")
    call_id     = Column(String(64), nullable=True)
    outcome     = Column(String(50), nullable=True)
    attempts    = Column(Integer, default=0)
    created_at  = Column(DateTime(timezone=True), default=_now)

    campaign = relationship("Campaign", back_populates="leads")


# ═══════════════════════════════════════════════════════════════════════════
# 13. APPROVALS
# ═══════════════════════════════════════════════════════════════════════════

class Approval(Base):
    __tablename__ = "approvals"

    id              = Column(String(64), primary_key=True, default=_uuid)
    workspace_id    = Column(String(64), nullable=False, index=True)
    task_id         = Column(String(64), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    ai_employee_id  = Column(String(64), nullable=True)
    requested_by    = Column(String(128), nullable=True)  # AI employee name
    reviewed_by     = Column(String(128), nullable=True)  # human user id

    action_type     = Column(String(50), nullable=False)  # campaign | financial | api | content | data_delete
    action_title    = Column(String(500), nullable=False)
    action_details  = Column(JSON, default=dict)

    risk_level      = Column(String(20), default="medium")  # low | medium | high | critical
    status          = Column(String(30), default="pending")  # pending | approved | rejected | expired

    decision_note   = Column(Text, default="")
    decided_at      = Column(DateTime(timezone=True), nullable=True)
    expires_at      = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), default=_now)

    task = relationship("Task", back_populates="approval")

    __table_args__ = (Index("ix_approval_ws_status", "workspace_id", "status"),)


# ═══════════════════════════════════════════════════════════════════════════
# 14. INTEGRATIONS / OAUTH
# ═══════════════════════════════════════════════════════════════════════════

class Integration(Base):
    __tablename__ = "integrations"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    provider     = Column(String(50), nullable=False)   # google | microsoft | whatsapp | slack | hubspot | …
    display_name = Column(String(150), nullable=False)
    status       = Column(String(30), default="disconnected")  # connected | disconnected | error | pending
    auth_type    = Column(String(30), default="oauth2")  # oauth2 | api_key | webhook
    config       = Column(JSON, default=dict)             # encrypted credentials & settings
    scopes       = Column(JSON, default=list)
    connected_at = Column(DateTime(timezone=True), nullable=True)
    expires_at   = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (Index("ix_integration_ws_prov", "workspace_id", "provider"),)


class PhoneNumber(Base):
    __tablename__ = "phone_numbers"

    id                   = Column(String(64), primary_key=True, default=_uuid)
    workspace_id         = Column(String(64), nullable=False, index=True)
    employee_id          = Column(String(64), nullable=True)
    assigned_employee_id = Column(String(64), nullable=True)  # alias
    twilio_sid           = Column(String(100), nullable=True, index=True)
    number               = Column(String(50), nullable=False)
    phone_number         = Column(String(50), nullable=True)  # alias
    friendly_name        = Column(String(150), nullable=True)
    country              = Column(String(10), default="IN")
    provider             = Column(String(50), default="twilio")
    capabilities         = Column(JSON, default=lambda: ["voice", "sms"])
    status               = Column(String(30), default="active")
    monthly_cost         = Column(Float, default=0.0)
    created_at           = Column(DateTime(timezone=True), default=_now)


# ═══════════════════════════════════════════════════════════════════════════
# 15. BILLING / CREDITS
# ═══════════════════════════════════════════════════════════════════════════

class CreditAccount(Base):
    __tablename__ = "credit_accounts"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    balance      = Column(Float, default=0.0)     # current credit balance
    total_purchased= Column(Float, default=0.0)
    total_consumed = Column(Float, default=0.0)
    currency     = Column(String(10), default="INR")
    plan         = Column(String(50), default="growth")
    updated_at   = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    workspace    = relationship("Workspace", back_populates="credits")
    transactions = relationship("CreditTransaction", back_populates="account", cascade="all, delete-orphan")


class CreditTransaction(Base):
    """Immutable ledger — never update, only insert."""
    __tablename__ = "credit_transactions"

    id          = Column(String(64), primary_key=True, default=_uuid)
    account_id  = Column(String(64), ForeignKey("credit_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    type        = Column(String(30), nullable=False)  # topup | usage | refund | adjustment
    amount      = Column(Float, nullable=False)        # positive = credit, negative = debit
    balance_after= Column(Float, nullable=False)
    description = Column(String(500), nullable=False)
    reference   = Column(String(200), nullable=True)   # call_id | task_id | invoice_id …
    created_at  = Column(DateTime(timezone=True), default=_now)

    account = relationship("CreditAccount", back_populates="transactions")


class UsageEvent(Base):
    """Fine-grained usage events consumed by the billing & analytics engines."""
    __tablename__ = "usage_events"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    event_type   = Column(String(50), nullable=False)  # voice_call_second | llm_token | task | message | …
    quantity     = Column(Float, default=1.0)
    unit_cost    = Column(Float, default=0.0)
    total_cost   = Column(Float, default=0.0)
    reference_id = Column(String(64), nullable=True)
    extra_data     = Column(JSON, default=dict)
    created_at   = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (Index("ix_usage_ws_type", "workspace_id", "event_type"),)


# ═══════════════════════════════════════════════════════════════════════════
# 16. AUDIT / ACTIVITY
# ═══════════════════════════════════════════════════════════════════════════

class ActivityLog(Base):
    """High-level activity feed shown on the dashboard."""
    __tablename__ = "activity_logs"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    actor_type   = Column(String(30), default="ai")  # ai | human | system
    actor_id     = Column(String(128), nullable=True)
    actor_name   = Column(String(150), nullable=True)
    action       = Column(String(200), nullable=False)
    entity_type  = Column(String(50), nullable=True)
    entity_id    = Column(String(64), nullable=True)
    details      = Column(JSON, default=dict)
    created_at   = Column(DateTime(timezone=True), default=_now, index=True)

    __table_args__ = (Index("ix_activity_ws_ts", "workspace_id", "created_at"),)


class AuditLog(Base):
    """Detailed immutable audit trail for compliance."""
    __tablename__ = "audit_logs"

    id             = Column(String(64), primary_key=True, default=_uuid)
    workspace_id   = Column(String(64), nullable=False, index=True)
    actor_type     = Column(String(30), nullable=False)
    actor_id       = Column(String(128), nullable=True)
    actor_name     = Column(String(150), nullable=True)
    action         = Column(String(100), nullable=False)
    resource_type  = Column(String(50), nullable=True)
    resource_id    = Column(String(64), nullable=True)
    previous_value = Column(JSON, default=dict)
    new_value      = Column(JSON, default=dict)
    ip_address     = Column(String(50), nullable=True)
    user_agent     = Column(String(500), nullable=True)
    outcome        = Column(String(30), default="success")
    created_at     = Column(DateTime(timezone=True), default=_now, index=True)


# ═══════════════════════════════════════════════════════════════════════════
# 17. NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════

class Notification(Base):
    __tablename__ = "notifications"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    user_id      = Column(String(128), nullable=True, index=True)
    type         = Column(String(50), nullable=False)    # approval.requested | task.completed | workflow.failed | …
    title        = Column(String(300), nullable=False)
    message      = Column(Text, default="")
    entity_type  = Column(String(50), nullable=True)
    entity_id    = Column(String(64), nullable=True)
    is_read      = Column(Boolean, default=False)
    created_at   = Column(DateTime(timezone=True), default=_now)


# ═══════════════════════════════════════════════════════════════════════════
# 18. API KEYS & WEBHOOKS
# ═══════════════════════════════════════════════════════════════════════════

class APIKey(Base):
    __tablename__ = "api_keys"

    id           = Column(String(64), primary_key=True, default=_uuid)
    user_id      = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=False, index=True)
    name         = Column(String(100), nullable=False)
    key_hash     = Column(String(256), nullable=False, unique=True)
    key_prefix   = Column(String(10),  nullable=False)  # first 8 chars for display
    scopes       = Column(JSON, default=list)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at   = Column(DateTime(timezone=True), nullable=True)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="api_keys")


class Webhook(Base):
    __tablename__ = "webhooks"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    name         = Column(String(150), nullable=False)
    url          = Column(String(500), nullable=False)
    events       = Column(JSON, default=list)
    secret       = Column(String(256), nullable=True)   # for signature verification
    is_active    = Column(Boolean, default=True)
    last_fired_at= Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=_now)


# ═══════════════════════════════════════════════════════════════════════════
# 19. ANALYTICS (pre-aggregated metrics)
# ═══════════════════════════════════════════════════════════════════════════

class AnalyticsEvent(Base):
    """Raw analytics events — feed into aggregated metric tables."""
    __tablename__ = "analytics_events"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    event_type   = Column(String(100), nullable=False)
    entity_type  = Column(String(50), nullable=True)
    entity_id    = Column(String(64), nullable=True)
    properties   = Column(JSON, default=dict)
    created_at   = Column(DateTime(timezone=True), default=_now, index=True)

    __table_args__ = (Index("ix_ae_ws_type", "workspace_id", "event_type"),)


class WorkspaceMetric(Base):
    """Daily aggregated metrics per workspace (fast dashboard queries)."""
    __tablename__ = "workspace_metrics"

    id           = Column(String(64), primary_key=True, default=_uuid)
    workspace_id = Column(String(64), nullable=False, index=True)
    date         = Column(String(10), nullable=False)   # YYYY-MM-DD
    calls_made   = Column(Integer, default=0)
    calls_connected= Column(Integer, default=0)
    leads_created= Column(Integer, default=0)
    leads_qualified= Column(Integer, default=0)
    tasks_completed= Column(Integer, default=0)
    ai_cost      = Column(Float, default=0.0)
    revenue_influenced= Column(Float, default=0.0)
    created_at   = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (Index("ix_wm_ws_date", "workspace_id", "date"),)


# ═══════════════════════════════════════════════════════════════════════════
# LEGACY — Preserved from existing voice agent system
# These tables are kept intact so existing routes continue to work.
# ═══════════════════════════════════════════════════════════════════════════

class VoiceAgent(Base):
    __tablename__ = "voice_agents"

    id                  = Column(String(64), primary_key=True, default=_uuid)
    user_id             = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name                = Column(String(100), default="SARA", nullable=False)
    role_title          = Column(String(150), default="Business Representative")
    department          = Column(String(100), default="Sales")
    mission             = Column(Text, default="Assist customers, answer queries, and qualify leads.")
    business_type       = Column(String(100), default="Real Estate", nullable=False)
    service_type        = Column(String(100), default="Property enquiries")
    personality         = Column(String(50), default="Professional & Friendly")
    communication_style = Column(String(50), default="Concise")
    sales_behavior      = Column(String(50), default="Consultative")
    languages           = Column(JSON, default=lambda: ["en", "te", "hi"])
    primary_language    = Column(String(20), default="en")
    voice_id            = Column(String(100), default="db6b0ed5-d5d3-463d-ae85-518a07d3c2b4")
    voice_gender        = Column(String(20), default="female")
    voice_name          = Column(String(100), default="Skylar")
    universal_spec      = Column(JSON, default=dict)
    workflow_spec       = Column(JSON, default=dict)
    tools_spec          = Column(JSON, default=list)
    test_results        = Column(JSON, default=list)
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime(timezone=True), default=_now)
    updated_at          = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    user             = relationship("User",          back_populates="agents")
    business_profile = relationship("BusinessProfile", back_populates="agent", uselist=False, cascade="all, delete-orphan")
    services         = relationship("AgentService",    back_populates="agent", cascade="all, delete-orphan")
    faqs             = relationship("AgentFAQ",        back_populates="agent", cascade="all, delete-orphan")
    rules            = relationship("AgentRule",       back_populates="agent", cascade="all, delete-orphan")
    documents        = relationship("AgentDocument",   back_populates="agent", cascade="all, delete-orphan")
    generated_prompt = relationship("GeneratedPrompt", back_populates="agent", uselist=False, cascade="all, delete-orphan")
    sessions         = relationship("ConversationSession", back_populates="agent", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_agent_user_active", "user_id", "is_active"),)


class BusinessProfile(Base):
    __tablename__ = "business_profiles"
    id            = Column(String(64), primary_key=True, default=_uuid)
    agent_id      = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    user_id       = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_name = Column(String(200), default="ABC Properties", nullable=False)
    description   = Column(Text, default="")
    industry      = Column(String(100), default="Real Estate")
    locations     = Column(JSON, default=list)
    services_offered = Column(JSON, default=list)
    products_offered = Column(JSON, default=list)
    operating_hours  = Column(String(100), default="9:00 AM – 7:00 PM IST")
    contact_info     = Column(String(200), default="")
    website          = Column(String(200), default="")
    important_policies = Column(Text, default="")
    additional_info  = Column(Text, default="")
    created_at    = Column(DateTime(timezone=True), default=_now)
    updated_at    = Column(DateTime(timezone=True), default=_now, onupdate=_now)
    agent = relationship("VoiceAgent", back_populates="business_profile")


class AgentService(Base):
    __tablename__ = "agent_services"
    id       = Column(String(64), primary_key=True, default=_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id  = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name     = Column(String(150), nullable=False)
    description = Column(Text, default="")
    is_primary  = Column(Boolean, default=False)
    agent = relationship("VoiceAgent", back_populates="services")


class AgentFAQ(Base):
    __tablename__ = "agent_faqs"
    id       = Column(String(64), primary_key=True, default=_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id  = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer   = Column(Text, nullable=False)
    category = Column(String(100), default="General", index=True)
    priority = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=_now)
    agent = relationship("VoiceAgent", back_populates="faqs")
    __table_args__ = (Index("ix_faq_agent_category", "agent_id", "category"),)


class AgentRule(Base):
    __tablename__ = "agent_rules"
    id       = Column(String(64), primary_key=True, default=_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id  = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_text  = Column(Text, nullable=False)
    rule_type  = Column(String(50), default="behavior")
    is_active  = Column(Boolean, default=True)
    agent = relationship("VoiceAgent", back_populates="rules")


class GeneratedPrompt(Base):
    __tablename__ = "generated_prompts"
    id       = Column(String(64), primary_key=True, default=_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    user_id  = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    full_prompt         = Column(Text, nullable=False)
    greeting_prompt     = Column(Text, nullable=False)
    identity_section    = Column(Text, default="")
    business_section    = Column(Text, default="")
    rules_section       = Column(Text, default="")
    faq_section         = Column(Text, default="")
    language_section    = Column(Text, default="")
    voice_behavior_section = Column(Text, default="")
    escalation_policy   = Column(Text, default="")
    version             = Column(Integer, default=1)
    updated_at          = Column(DateTime(timezone=True), default=_now, onupdate=_now)
    agent = relationship("VoiceAgent", back_populates="generated_prompt")


class AgentDocument(Base):
    __tablename__ = "agent_documents"
    id       = Column(String(64), primary_key=True, default=_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id  = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_type= Column(String(50), default="pdf")
    file_size= Column(Integer, default=0)
    extracted_text   = Column(Text, default="")
    structured_facts = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=_now)
    agent = relationship("VoiceAgent", back_populates="documents")


class ConversationSession(Base):
    __tablename__ = "conversation_sessions"
    id       = Column(String(64), primary_key=True, default=_uuid)
    agent_id = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id  = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    caller_name    = Column(String(150), default="Caller")
    active_language= Column(String(20), default="en")
    current_stage  = Column(String(50), default="GREETING")
    status         = Column(String(50), default="active")
    started_at     = Column(DateTime(timezone=True), default=_now)
    ended_at       = Column(DateTime(timezone=True), nullable=True)
    agent    = relationship("VoiceAgent", back_populates="sessions")
    messages = relationship("SessionMessage", back_populates="session", cascade="all, delete-orphan", order_by="SessionMessage.created_at")
    state    = relationship("ConversationState", back_populates="session", uselist=False, cascade="all, delete-orphan")
    latencies= relationship("LatencyMetric", back_populates="session", cascade="all, delete-orphan")


class SessionMessage(Base):
    """Renamed from ConversationMessage to avoid clash with new unified model."""
    __tablename__ = "session_messages"
    id         = Column(String(64), primary_key=True, default=_uuid)
    session_id = Column(String(64), ForeignKey("conversation_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role       = Column(String(20), nullable=False)
    content    = Column(Text, nullable=False)
    detected_language = Column(String(20), default="en")
    detected_intent   = Column(String(100), default="general")
    created_at = Column(DateTime(timezone=True), default=_now)
    session = relationship("ConversationSession", back_populates="messages")


class ConversationState(Base):
    __tablename__ = "conversation_states"
    session_id       = Column(String(64), ForeignKey("conversation_sessions.id", ondelete="CASCADE"), primary_key=True)
    agent_id         = Column(String(64), ForeignKey("voice_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_name    = Column(String(150), nullable=True)
    conversation_stage= Column(String(50), default="GREETING")
    current_intent   = Column(String(100), default="unknown")
    collected_fields = Column(JSON, default=dict)
    pending_action   = Column(String(150), nullable=True)
    escalation_required = Column(Boolean, default=False)
    last_user_message= Column(Text, nullable=True)
    last_agent_message= Column(Text, nullable=True)
    updated_at       = Column(DateTime(timezone=True), default=_now, onupdate=_now)
    session = relationship("ConversationSession", back_populates="state")


class LatencyMetric(Base):
    __tablename__ = "latency_metrics"
    id              = Column(String(64), primary_key=True, default=_uuid)
    session_id      = Column(String(64), ForeignKey("conversation_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    turn_index      = Column(Integer, default=1)
    stt_ms          = Column(Float, default=0.0)
    llm_first_token_ms = Column(Float, default=0.0)
    llm_total_ms    = Column(Float, default=0.0)
    tts_first_audio_ms = Column(Float, default=0.0)
    time_to_first_audio_ms = Column(Float, default=0.0)
    total_response_ms = Column(Float, default=0.0)
    created_at      = Column(DateTime(timezone=True), default=_now)
    session = relationship("ConversationSession", back_populates="latencies")


# ── Legacy CRM models (preserved) ──────────────────────────────────────────

class Customer(Base):
    __tablename__ = "customers"
    id                 = Column(String(64), primary_key=True, default=_uuid)
    user_id            = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name               = Column(String(200), nullable=False, index=True)
    phone              = Column(String(50), nullable=True, index=True)
    email              = Column(String(255), nullable=True, index=True)
    company            = Column(String(200), nullable=True, default="")
    source             = Column(String(100), default="Website", index=True)
    campaign           = Column(String(100), default="")
    ad                 = Column(String(100), default="")
    location           = Column(String(150), default="")
    budget             = Column(String(100), default="")
    timeline           = Column(String(100), default="")
    interest           = Column(String(150), default="")
    status             = Column(String(50), default="New Lead", index=True)
    pipeline_stage     = Column(String(50), default="New Lead", index=True)
    lead_score         = Column(Integer, default=50)
    assigned_user      = Column(String(150), default="Unassigned")
    assigned_agent     = Column(String(150), default="SARA")
    requirements       = Column(JSON, default=list)
    preferences        = Column(JSON, default=list)
    memory             = Column(JSON, default=dict)
    custom_fields      = Column(JSON, default=dict)
    last_interaction   = Column(DateTime(timezone=True), default=_now)
    next_followup      = Column(DateTime(timezone=True), nullable=True)
    created_at         = Column(DateTime(timezone=True), default=_now)
    updated_at         = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    calls          = relationship("CallRecord",       back_populates="customer", cascade="all, delete-orphan", order_by="desc(CallRecord.created_at)")
    activities     = relationship("ActivityTimeline", back_populates="customer", cascade="all, delete-orphan", order_by="desc(ActivityTimeline.timestamp)")
    tasks          = relationship("CRMTask",          back_populates="customer", cascade="all, delete-orphan", order_by="CRMTask.due_date")
    deals          = relationship("Deal",             back_populates="customer", cascade="all, delete-orphan")
    communications = relationship("CRMCommunication", back_populates="customer", cascade="all, delete-orphan", order_by="desc(CRMCommunication.timestamp)")
    meetings       = relationship("CRMMeeting",       back_populates="customer", cascade="all, delete-orphan", order_by="desc(CRMMeeting.scheduled_at)")
    documents      = relationship("CRMDocument",      back_populates="customer", cascade="all, delete-orphan", order_by="desc(CRMDocument.created_at)")
    audit_logs     = relationship("CRMAuditLog",      back_populates="customer")


class CustomerPipeline(Base):
    __tablename__ = "customer_pipelines"
    id         = Column(String(64), primary_key=True, default=_uuid)
    user_id    = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name       = Column(String(100), default="Standard Sales Pipeline", nullable=False)
    stages     = Column(JSON, default=lambda: [
        {"id": "new_lead",     "name": "New Lead",     "color": "#3B82F6", "order": 1},
        {"id": "contacted",    "name": "Contacted",    "color": "#8B5CF6", "order": 2},
        {"id": "qualified",    "name": "Qualified",    "color": "#EC4899", "order": 3},
        {"id": "interested",   "name": "Interested",   "color": "#F59E0B", "order": 4},
        {"id": "proposal",     "name": "Proposal Sent","color": "#10B981", "order": 5},
        {"id": "negotiation",  "name": "Negotiation",  "color": "#6366F1", "order": 6},
        {"id": "won",          "name": "Won",          "color": "#059669", "order": 7, "is_won": True},
        {"id": "lost",         "name": "Lost",         "color": "#EF4444", "order": 8, "is_lost": True},
    ])
    is_default = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class CallRecord(Base):
    __tablename__ = "call_records"
    id               = Column(String(64), primary_key=True, default=_uuid)
    customer_id      = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id          = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id       = Column(String(64), nullable=True, index=True)
    caller           = Column(String(100), default="Customer")
    receiver         = Column(String(100), default="SARA")
    phone_number     = Column(String(50), default="")
    direction        = Column(String(50), default="Inbound")
    call_type        = Column(String(50), default="AI Voice Call")
    start_time       = Column(DateTime(timezone=True), default=_now)
    end_time         = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, default=0)
    call_status      = Column(String(50), default="Completed")
    created_at       = Column(DateTime(timezone=True), default=_now)

    customer    = relationship("Customer",       back_populates="calls")
    recording   = relationship("CallRecording",  back_populates="call", uselist=False, cascade="all, delete-orphan")
    transcripts = relationship("CallTranscript", back_populates="call", cascade="all, delete-orphan", order_by="CallTranscript.start_time_offset")
    intelligence= relationship("CallIntelligence", back_populates="call", uselist=False, cascade="all, delete-orphan")


class CallRecording(Base):
    __tablename__ = "call_recordings"
    id                   = Column(String(64), primary_key=True, default=_uuid)
    call_id              = Column(String(64), ForeignKey("call_records.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    customer_id          = Column(String(64), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    file_path            = Column(String(500), nullable=False)
    file_name            = Column(String(255), default="recording.wav")
    file_size_bytes      = Column(Integer, default=0)
    mime_type            = Column(String(100), default="audio/wav")
    duration_seconds     = Column(Integer, default=0)
    transcription_status = Column(String(50), default="Completed")
    analysis_status      = Column(String(50), default="Completed")
    is_consent_given     = Column(Boolean, default=True)
    retention_days       = Column(Integer, default=90)
    created_at           = Column(DateTime(timezone=True), default=_now)
    call = relationship("CallRecord", back_populates="recording")


class CallTranscript(Base):
    __tablename__ = "call_transcripts"
    id                = Column(String(64), primary_key=True, default=_uuid)
    call_id           = Column(String(64), ForeignKey("call_records.id", ondelete="CASCADE"), nullable=False, index=True)
    speaker           = Column(String(50), nullable=False)
    speaker_name      = Column(String(100), default="Customer")
    start_time_offset = Column(Float, default=0.0)
    end_time_offset   = Column(Float, default=0.0)
    text              = Column(Text, nullable=False)
    language          = Column(String(20), default="en")
    confidence        = Column(Float, default=0.95)
    sentiment         = Column(String(30), default="Neutral")
    created_at        = Column(DateTime(timezone=True), default=_now)
    call = relationship("CallRecord", back_populates="transcripts")


class CallIntelligence(Base):
    __tablename__ = "call_intelligence"
    id                    = Column(String(64), primary_key=True, default=_uuid)
    call_id               = Column(String(64), ForeignKey("call_records.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    customer_id           = Column(String(64), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_intent       = Column(Text, default="")
    requirements          = Column(JSON, default=list)
    budget                = Column(String(100), default="")
    timeline              = Column(String(100), default="")
    objections            = Column(JSON, default=list)
    questions             = Column(JSON, default=list)
    competitors           = Column(JSON, default=list)
    sentiment             = Column(String(50), default="Interested")
    sentiment_score       = Column(Float, default=0.8)
    purchase_intent       = Column(String(50), default="High")
    purchase_intent_score = Column(Float, default=0.85)
    promises              = Column(JSON, default=list)
    follow_up_needed      = Column(Boolean, default=True)
    follow_up_reason      = Column(Text, default="")
    follow_up_date        = Column(DateTime(timezone=True), nullable=True)
    next_recommended_action= Column(Text, default="")
    call_summary          = Column(Text, default="")
    raw_ai_response       = Column(JSON, default=dict)
    created_at            = Column(DateTime(timezone=True), default=_now)
    call = relationship("CallRecord", back_populates="intelligence")


class ActivityTimeline(Base):
    __tablename__ = "activity_timelines"
    id            = Column(String(64), primary_key=True, default=_uuid)
    customer_id   = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id       = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_type = Column(String(50), nullable=False)
    title         = Column(String(255), nullable=False)
    description   = Column(Text, default="")
    actor_type    = Column(String(50), default="AI Agent")
    actor_name    = Column(String(150), default="SARA")
    source        = Column(String(100), default="CRM")
    status        = Column(String(50), default="Completed")
    metadata_json = Column(JSON, default=dict)
    timestamp     = Column(DateTime(timezone=True), default=_now, index=True)
    customer = relationship("Customer", back_populates="activities")


class CRMTask(Base):
    __tablename__ = "crm_tasks"
    id           = Column(String(64), primary_key=True, default=_uuid)
    customer_id  = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id      = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title        = Column(String(255), nullable=False)
    description  = Column(Text, default="")
    task_type    = Column(String(50), default="Follow-up")
    priority     = Column(String(20), default="Medium")
    status       = Column(String(50), default="Pending")
    due_date     = Column(DateTime(timezone=True), nullable=True)
    assigned_to  = Column(String(150), default="Sales Agent")
    is_ai_generated = Column(Boolean, default=False)
    trigger_reason  = Column(Text, default="")
    completed_at    = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=_now)
    updated_at   = Column(DateTime(timezone=True), default=_now, onupdate=_now)
    customer = relationship("Customer", back_populates="tasks")


class Deal(Base):
    __tablename__ = "deals"
    id                  = Column(String(64), primary_key=True, default=_uuid)
    customer_id         = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id             = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name                = Column(String(200), nullable=False)
    amount              = Column(Float, default=0.0)
    currency            = Column(String(10), default="INR")
    stage               = Column(String(50), default="Qualified")
    probability         = Column(Integer, default=50)
    expected_close_date = Column(DateTime(timezone=True), nullable=True)
    closed_at           = Column(DateTime(timezone=True), nullable=True)
    notes               = Column(Text, default="")
    created_at          = Column(DateTime(timezone=True), default=_now)
    updated_at          = Column(DateTime(timezone=True), default=_now, onupdate=_now)
    customer = relationship("Customer", back_populates="deals")


class CRMAutomation(Base):
    __tablename__ = "crm_automations"
    id                       = Column(String(64), primary_key=True, default=_uuid)
    user_id                  = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name                     = Column(String(200), nullable=False)
    description              = Column(Text, default="")
    natural_language_prompt  = Column(Text, default="")
    trigger_event            = Column(String(100), nullable=False)
    conditions               = Column(JSON, default=dict)
    actions                  = Column(JSON, default=list)
    is_active                = Column(Boolean, default=True)
    execution_count          = Column(Integer, default=0)
    last_executed_at         = Column(DateTime(timezone=True), nullable=True)
    created_at               = Column(DateTime(timezone=True), default=_now)
    updated_at               = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class CRMAuditLog(Base):
    __tablename__ = "crm_audit_logs"
    id             = Column(String(64), primary_key=True, default=_uuid)
    user_id        = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id    = Column(String(64), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_type     = Column(String(50), default="AI")
    actor_name     = Column(String(150), default="Sales AI")
    action         = Column(String(100), nullable=False)
    entity_type    = Column(String(50), default="Customer")
    entity_id      = Column(String(64), nullable=True)
    previous_value = Column(JSON, default=dict)
    new_value      = Column(JSON, default=dict)
    reason         = Column(Text, default="")
    timestamp      = Column(DateTime(timezone=True), default=_now)
    customer = relationship("Customer", back_populates="audit_logs")


class CRMCommunication(Base):
    __tablename__ = "crm_communications"
    id              = Column(String(64), primary_key=True, default=_uuid)
    customer_id     = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id         = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    channel         = Column(String(50), default="WhatsApp")
    direction       = Column(String(20), default="Inbound")
    sender          = Column(String(100), default="")
    recipient       = Column(String(100), default="")
    subject         = Column(String(255), default="")
    body            = Column(Text, nullable=False)
    media_url       = Column(String(500), nullable=True)
    delivery_status = Column(String(50), default="Delivered")
    read_status     = Column(Boolean, default=True)
    ai_summary      = Column(Text, default="")
    ai_intent       = Column(String(100), default="")
    timestamp       = Column(DateTime(timezone=True), default=_now, index=True)
    customer = relationship("Customer", back_populates="communications")


class CRMMeeting(Base):
    __tablename__ = "crm_meetings"
    id               = Column(String(64), primary_key=True, default=_uuid)
    customer_id      = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id          = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title            = Column(String(255), nullable=False)
    participants     = Column(JSON, default=list)
    scheduled_at     = Column(DateTime(timezone=True), default=_now)
    duration_minutes = Column(Integer, default=30)
    meeting_notes    = Column(Text, default="")
    recording_url    = Column(String(500), nullable=True)
    ai_summary       = Column(Text, default="")
    decisions        = Column(JSON, default=list)
    action_items     = Column(JSON, default=list)
    status           = Column(String(50), default="Scheduled")
    created_at       = Column(DateTime(timezone=True), default=_now)
    customer = relationship("Customer", back_populates="meetings")


class CRMDocument(Base):
    __tablename__ = "crm_documents"
    id              = Column(String(64), primary_key=True, default=_uuid)
    customer_id     = Column(String(64), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id         = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title           = Column(String(255), nullable=False)
    doc_type        = Column(String(50), default="Brochure")
    file_path       = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    uploaded_by     = Column(String(100), default="SARA")
    created_at      = Column(DateTime(timezone=True), default=_now)
    customer = relationship("Customer", back_populates="documents")


class CRMPrivacySettings(Base):
    __tablename__ = "crm_privacy_settings"
    id                         = Column(String(64), primary_key=True, default=_uuid)
    user_id                    = Column(String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    recording_retention_days   = Column(Integer, default=90)
    transcript_retention_days  = Column(Integer, default=180)
    audit_log_retention_days   = Column(Integer, default=365)
    require_recording_consent  = Column(Boolean, default=True)
    enable_auto_pii_masking    = Column(Boolean, default=True)
    updated_at                 = Column(DateTime(timezone=True), default=_now, onupdate=_now)
