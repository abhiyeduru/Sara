from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class FAQBase(BaseModel):
    question: str
    answer: str
    category: str = "General"
    priority: int = 1

class FAQCreate(FAQBase):
    pass

class FAQResponse(FAQBase):
    id: str
    agent_id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RuleBase(BaseModel):
    rule_text: str
    rule_type: str = "behavior"
    is_active: bool = True

class RuleCreate(RuleBase):
    pass

class RuleResponse(RuleBase):
    id: str
    agent_id: str

    class Config:
        from_attributes = True

class BusinessProfileBase(BaseModel):
    business_name: str = "ABC Properties"
    description: Optional[str] = "Leading real estate company operating in Hyderabad."
    industry: Optional[str] = "Real Estate"
    locations: List[str] = Field(default_factory=lambda: ["Gachibowli", "Kondapur", "Kokapet"])
    services_offered: List[str] = Field(default_factory=lambda: ["2 BHK", "3 BHK", "Villas", "Plots"])
    products_offered: List[str] = Field(default_factory=list)
    operating_hours: Optional[str] = "9:00 AM – 7:00 PM IST"
    contact_info: Optional[str] = "+91 9876543210 / contact@abcproperties.example.com"
    website: Optional[str] = "https://abcproperties.example.com"
    important_policies: Optional[str] = "Transparent pricing, no hidden brokerage."
    additional_info: Optional[str] = ""

class BusinessProfileUpdate(BusinessProfileBase):
    pass

class BusinessProfileResponse(BusinessProfileBase):
    id: str
    agent_id: str

    class Config:
        from_attributes = True

class VoiceAgentBase(BaseModel):
    name: str = "SARA"
    role_title: str = "Real Estate Assistant"
    department: Optional[str] = "Sales"
    mission: Optional[str] = None
    business_type: str = "Real Estate"
    service_type: str = "Property enquiries"
    personality: str = "Professional & Friendly"
    communication_style: str = "Concise"
    sales_behavior: str = "Consultative"
    languages: List[str] = Field(default_factory=lambda: ["en", "te", "hi"])
    voice_id: str = "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"
    voice_gender: str = "female"
    voice_name: str = "Skylar"
    is_active: bool = True
    universal_spec: Optional[Any] = None
    workflow_spec: Optional[Any] = None
    tools_spec: Optional[Any] = None
    test_results: Optional[Any] = None


class AgentCompileRequest(BaseModel):
    natural_input: str
    language_preference: Optional[str] = "en"
    agent_id: Optional[str] = None

class AgentTeachRequest(BaseModel):
    instruction: str

class AgentDocumentResponse(BaseModel):
    id: str
    agent_id: str
    filename: str
    file_type: str
    file_size: int
    structured_facts: List[Any] = Field(default_factory=list)
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VoiceAgentCreate(VoiceAgentBase):
    business_profile: Optional[BusinessProfileBase] = None
    faqs: Optional[List[FAQCreate]] = None
    rules: Optional[List[RuleCreate]] = None

class VoiceAgentUpdate(BaseModel):
    name: Optional[str] = None
    role_title: Optional[str] = None
    business_type: Optional[str] = None
    service_type: Optional[str] = None
    personality: Optional[str] = None
    communication_style: Optional[str] = None
    sales_behavior: Optional[str] = None
    languages: Optional[List[str]] = None
    voice_id: Optional[str] = None
    voice_gender: Optional[str] = None
    voice_name: Optional[str] = None
    is_active: Optional[bool] = None

class GeneratedPromptResponse(BaseModel):
    id: Optional[str] = None
    agent_id: Optional[str] = None
    full_prompt: str
    greeting_prompt: str
    identity_section: Optional[str] = None
    business_section: Optional[str] = None
    spoken_rules: Optional[str] = None
    language_section: Optional[str] = None
    faq_section: Optional[str] = None
    rules_section: Optional[str] = None
    flow_section: Optional[str] = None
    escalation_policy: Optional[str] = None
    version: int = 1

class VoiceAgentDetailResponse(VoiceAgentBase):
    id: str
    user_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    business_profile: Optional[BusinessProfileResponse] = None
    faqs: List[FAQResponse] = Field(default_factory=list)
    rules: List[RuleResponse] = Field(default_factory=list)
    generated_prompt: Optional[GeneratedPromptResponse] = None

    class Config:
        from_attributes = True

class LatencyMetricResponse(BaseModel):
    turn_index: int
    stt_ms: float
    llm_first_token_ms: float
    llm_total_ms: float
    tts_first_audio_ms: float
    time_to_first_audio_ms: float
    total_response_ms: float
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SessionMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    detected_language: str
    detected_intent: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ConversationSessionResponse(BaseModel):
    id: str
    agent_id: str
    caller_name: str
    active_language: str
    current_stage: str
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    messages: List[SessionMessageResponse] = Field(default_factory=list)
    latencies: List[LatencyMetricResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

class VoiceItemResponse(BaseModel):
    id: str
    name: str
    gender: str
    style: str
    language: str
    description: str
