from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from server.database import get_db
from server.auth import get_current_user
from server.models import (
    User, VoiceAgent, BusinessProfile, AgentFAQ, AgentRule, GeneratedPrompt, AgentDocument
)
from server.schemas import (
    VoiceAgentCreate, VoiceAgentUpdate, VoiceAgentDetailResponse,
    FAQCreate, FAQResponse, RuleCreate, RuleResponse,
    GeneratedPromptResponse, BusinessProfileUpdate, BusinessProfileResponse,
    AgentCompileRequest, AgentTeachRequest, AgentDocumentResponse
)
from server.engine.prompt_generator import PromptGenerator
from server.engine.agent_compiler import AgentCompiler
from server.engine.document_processor import DocumentProcessor
from server.engine.continuous_teacher import ContinuousTeacher
from server.engine.test_runner import TestRunner

router = APIRouter(prefix="/api/agents", tags=["Voice Agents"])


# Standard pre-configured business templates for the 10-step wizard
BUSINESS_TEMPLATES = {
    "Real Estate": {
        "services": ["Property enquiries", "Property recommendations", "Pricing questions", "Location information", "Property availability", "Site visit booking", "Lead qualification", "Follow-up calls"],
        "default_name": "SARA",
        "role_title": "Real Estate Assistant",
        "faqs": [
            {"question": "What is the starting price for a 2 BHK?", "answer": "The starting price for a 2 BHK is ₹85 Lakhs in Gachibowli and Kondapur.", "category": "Pricing", "priority": 1},
            {"question": "What amenities are included?", "answer": "All projects include a clubhouse, swimming pool, 24/7 power backup, gym, and children play area.", "category": "General", "priority": 2},
            {"question": "Can I schedule a site visit?", "answer": "Yes, absolutely! We organize site visits every day between 10 AM and 6 PM. I can arrange one for you.", "category": "Booking", "priority": 1}
        ],
        "rules": [
            "Never invent prices or discounts not confirmed in business knowledge.",
            "Always offer to arrange a site visit when the customer shows interest.",
            "If asked about discounts or payment plans, offer to connect with a senior manager."
        ]
    },
    "College / University": {
        "services": ["College information", "Course information", "Eligibility", "Fees", "Admission process", "Application assistance", "Campus information", "Hostel information", "Scholarship information", "Counselling appointment"],
        "default_name": "SARA",
        "role_title": "Admissions Counsellor",
        "faqs": [
            {"question": "What is the eligibility for B.Tech CSE?", "answer": "Minimum 60% aggregate in 12th standard with Physics, Chemistry, and Mathematics, plus a valid entrance exam score.", "category": "Eligibility", "priority": 1},
            {"question": "What are the tuition fees per year?", "answer": "Tuition fee for B.Tech is ₹1.5 Lakhs per year with merit scholarship options available.", "category": "Fees", "priority": 1},
            {"question": "Is hostel facility available for boys and girls?", "answer": "Yes, separate modern hostel facilities with Wi-Fi, food, and security are provided on campus.", "category": "Campus", "priority": 2}
        ],
        "rules": [
            "Never promise admissions or bypass entrance test criteria.",
            "Direct scholarship applicants to the financial aid cell."
        ]
    },
    "Product Sales": {
        "services": ["Product information", "Product comparison", "Pricing", "Offers", "Availability", "Order assistance", "Product recommendation", "Customer questions", "Sales qualification"],
        "default_name": "SARA",
        "role_title": "Product Specialist",
        "faqs": [
            {"question": "What is the warranty period?", "answer": "All products come with a 1-year comprehensive manufacturer warranty.", "category": "Support", "priority": 1},
            {"question": "What payment methods are accepted?", "answer": "We accept all major credit/debit cards, UPI, net banking, and EMI options.", "category": "Policies", "priority": 2}
        ],
        "rules": [
            "Never promise unlisted discounts.",
            "Ask clarifying questions to determine customer budget before recommending high-end models."
        ]
    },
    "Healthcare": {
        "services": ["Doctor appointments", "Department inquiry", "Consultation fees", "Clinic timings", "Emergency helpline"],
        "default_name": "SARA",
        "role_title": "Care Coordinator",
        "faqs": [
            {"question": "How do I book a doctor appointment?", "answer": "I can assist you in reserving a slot with our specialist right now. Which department do you need?", "category": "Booking", "priority": 1}
        ],
        "rules": [
            "Never give medical diagnoses or prescribe medications.",
            "In emergency situations, immediately advise calling the emergency ambulance number."
        ]
    },
    "Custom Business": {
        "services": ["General Inquiry", "Customer Support", "Booking Request", "Lead Generation"],
        "default_name": "SARA",
        "role_title": "Customer Representative",
        "faqs": [],
        "rules": ["Be polite, professional, and adhere strictly to provided business facts."]
    }
}

@router.get("/categories")
def get_categories():
    """Return available business templates and service categories"""
    return BUSINESS_TEMPLATES

@router.post("", response_model=VoiceAgentDetailResponse)
def create_agent(
    payload: VoiceAgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new voice agent with business profile, FAQs, rules, and generated prompt.
    Enforces user isolation.
    """
    # 1. Create VoiceAgent
    agent = VoiceAgent(
        user_id=current_user.id,
        name=payload.name,
        role_title=payload.role_title,
        business_type=payload.business_type,
        service_type=payload.service_type,
        personality=payload.personality,
        communication_style=payload.communication_style,
        sales_behavior=payload.sales_behavior,
        languages=payload.languages,
        voice_id=payload.voice_id,
        voice_gender=payload.voice_gender,
        voice_name=payload.voice_name,
        is_active=payload.is_active
    )
    db.add(agent)
    db.flush()

    # 2. Create BusinessProfile
    bp_data = payload.business_profile or None
    if bp_data:
        profile = BusinessProfile(
            agent_id=agent.id,
            user_id=current_user.id,
            business_name=bp_data.business_name,
            description=bp_data.description,
            industry=bp_data.industry or payload.business_type,
            locations=bp_data.locations,
            services_offered=bp_data.services_offered,
            operating_hours=bp_data.operating_hours,
            contact_info=bp_data.contact_info,
            website=bp_data.website,
            important_policies=bp_data.important_policies
        )
    else:
        profile = BusinessProfile(
            agent_id=agent.id,
            user_id=current_user.id,
            business_name="ABC Properties",
            industry=payload.business_type
        )
    db.add(profile)

    # 3. Create FAQs
    faq_list = []
    if payload.faqs:
        for f in payload.faqs:
            faq_obj = AgentFAQ(
                agent_id=agent.id,
                user_id=current_user.id,
                question=f.question,
                answer=f.answer,
                category=f.category,
                priority=f.priority
            )
            db.add(faq_obj)
            faq_list.append({"question": f.question, "answer": f.answer, "category": f.category})

    # 4. Create Rules
    rule_list = []
    if payload.rules:
        for r in payload.rules:
            rule_obj = AgentRule(
                agent_id=agent.id,
                user_id=current_user.id,
                rule_text=r.rule_text,
                rule_type=r.rule_type,
                is_active=r.is_active
            )
            db.add(rule_obj)
            if r.is_active:
                rule_list.append(r.rule_text)

    # 5. Generate Initial Modular System Prompt
    biz_dict = {
        "business_name": profile.business_name,
        "description": profile.description,
        "locations": profile.locations,
        "services": profile.services_offered,
        "operating_hours": profile.operating_hours,
        "contact_info": profile.contact_info,
        "important_policies": profile.important_policies
    }
    generated = PromptGenerator.generate(
        agent_name=agent.name,
        role_title=agent.role_title,
        business_info=biz_dict,
        services=[agent.service_type],
        faqs=faq_list,
        rules=rule_list,
        personality=agent.personality,
        comm_style=agent.communication_style,
        sales_behavior=agent.sales_behavior,
        languages=agent.languages
    )

    prompt_record = GeneratedPrompt(
        agent_id=agent.id,
        user_id=current_user.id,
        full_prompt=generated["full_prompt"],
        greeting_prompt=generated["greeting_prompt"],
        identity_section=generated["identity_section"],
        business_section=generated["business_section"],
        faq_section=generated["faq_section"],
        rules_section=generated["rules_section"],
        language_section=generated["language_section"],
        voice_behavior_section=generated["spoken_rules"],
        escalation_policy=generated["escalation_policy"]
    )
    db.add(prompt_record)
    db.commit()
    db.refresh(agent)
    return agent

@router.get("", response_model=List[VoiceAgentDetailResponse])
def list_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all voice agents owned by the current authenticated user"""
    return db.query(VoiceAgent).filter(VoiceAgent.user_id == current_user.id).order_by(VoiceAgent.created_at.desc()).all()

@router.get("/{agent_id}", response_model=VoiceAgentDetailResponse)
def get_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get single agent details with strict user isolation check"""
    agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.put("/{agent_id}", response_model=VoiceAgentDetailResponse)
def update_agent(
    agent_id: str,
    payload: VoiceAgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(agent, k, v)

    db.commit()
    db.refresh(agent)
    return agent

@router.post("/{agent_id}/generate-prompt", response_model=GeneratedPromptResponse)
def regenerate_prompt(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Regenerate prompt dynamically from updated agent config and FAQs"""
    agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    bp = agent.business_profile
    biz_dict = {
        "business_name": bp.business_name if bp else "ABC Business",
        "description": bp.description if bp else "",
        "locations": bp.locations if bp else [],
        "services": bp.services_offered if bp else [],
        "operating_hours": bp.operating_hours if bp else "",
        "contact_info": bp.contact_info if bp else "",
        "important_policies": bp.important_policies if bp else ""
    }
    faq_list = [{"question": f.question, "answer": f.answer, "category": f.category} for f in agent.faqs]
    rule_list = [r.rule_text for r in agent.rules if r.is_active]

    gen = PromptGenerator.generate(
        agent_name=agent.name,
        role_title=agent.role_title,
        business_info=biz_dict,
        services=[agent.service_type],
        faqs=faq_list,
        rules=rule_list,
        personality=agent.personality,
        comm_style=agent.communication_style,
        sales_behavior=agent.sales_behavior,
        languages=agent.languages
    )

    if not agent.generated_prompt:
        prompt_rec = GeneratedPrompt(agent_id=agent.id, user_id=current_user.id)
        db.add(prompt_rec)
    else:
        prompt_rec = agent.generated_prompt

    prompt_rec.full_prompt = gen["full_prompt"]
    prompt_rec.greeting_prompt = gen["greeting_prompt"]
    prompt_rec.identity_section = gen["identity_section"]
    prompt_rec.business_section = gen["business_section"]
    prompt_rec.faq_section = gen["faq_section"]
    prompt_rec.rules_section = gen["rules_section"]
    prompt_rec.language_section = gen["language_section"]
    prompt_rec.voice_behavior_section = gen["spoken_rules"]
    prompt_rec.escalation_policy = gen["escalation_policy"]
    prompt_rec.version = (prompt_rec.version or 1) + 1

    db.commit()
    db.refresh(prompt_rec)
    return prompt_rec

@router.post("/{agent_id}/faqs", response_model=FAQResponse)
def add_faq(
    agent_id: str,
    payload: FAQCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    faq = AgentFAQ(
        agent_id=agent.id,
        user_id=current_user.id,
        question=payload.question,
        answer=payload.answer,
        category=payload.category,
        priority=payload.priority
    )
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq

@router.delete("/{agent_id}/faqs/{faq_id}")
def delete_faq(
    agent_id: str,
    faq_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    faq = db.query(AgentFAQ).filter(AgentFAQ.id == faq_id, AgentFAQ.agent_id == agent_id, AgentFAQ.user_id == current_user.id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    db.delete(faq)
    db.commit()
    return {"status": "success", "message": "FAQ deleted"}


@router.post("/compile", response_model=VoiceAgentDetailResponse)
def compile_agent(
    payload: AgentCompileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Autonomously compile a business owner's natural language input into a
    production-ready AI Employee with tools, workflow, prompt, and test suite.
    """
    compiler = AgentCompiler()
    spec = compiler.compile(natural_input=payload.natural_input, language_preference=payload.language_preference or "en")

    agent_id = payload.agent_id
    if agent_id:
        agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        agent.name = spec["identity"]["name"]
        agent.role_title = spec["identity"]["role_title"]
        agent.department = spec["identity"].get("department", "Sales")
        agent.mission = spec["identity"].get("mission", "")
        agent.business_type = spec["business"]["industry"]
        agent.service_type = spec["business"]["services"][0] if spec["business"]["services"] else "Property enquiries"
        agent.personality = spec["behavior"]["personality"]
        agent.communication_style = spec["behavior"]["communication_style"]
        agent.sales_behavior = spec["behavior"]["sales_behavior"]
        agent.languages = spec["identity"]["languages"]
        agent.universal_spec = spec
        agent.workflow_spec = spec.get("workflow", {})
        agent.tools_spec = spec.get("tools", {})
        agent.test_results = spec.get("test_suite", {})
    else:
        agent = VoiceAgent(
            user_id=current_user.id,
            name=spec["identity"]["name"],
            role_title=spec["identity"]["role_title"],
            department=spec["identity"].get("department", "Sales"),
            mission=spec["identity"].get("mission", ""),
            business_type=spec["business"]["industry"],
            service_type=spec["business"]["services"][0] if spec["business"]["services"] else "Property enquiries",
            personality=spec["behavior"]["personality"],
            communication_style=spec["behavior"]["communication_style"],
            sales_behavior=spec["behavior"]["sales_behavior"],
            languages=spec["identity"]["languages"],
            voice_id="db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
            voice_gender="female",
            voice_name="Skylar",
            is_active=True,
            universal_spec=spec,
            workflow_spec=spec.get("workflow", {}),
            tools_spec=spec.get("tools", {}),
            test_results=spec.get("test_suite", {})
        )
        db.add(agent)
        db.flush()

    # Sync BusinessProfile
    policies_raw = spec["business"].get("policies", "")
    if isinstance(policies_raw, list):
        policies_str = ", ".join(str(p) for p in policies_raw)
    else:
        policies_str = str(policies_raw or "")

    profile = db.query(BusinessProfile).filter(BusinessProfile.agent_id == agent.id).first()
    if not profile:
        profile = BusinessProfile(
            agent_id=agent.id,
            user_id=current_user.id,
            business_name=spec["business"]["company_name"],
            industry=spec["business"]["industry"],
            locations=spec["business"]["locations"],
            services_offered=spec["business"]["services"],
            important_policies=policies_str
        )
        db.add(profile)
    else:
        profile.business_name = spec["business"]["company_name"]
        profile.industry = spec["business"]["industry"]
        profile.locations = spec["business"]["locations"]
        profile.services_offered = spec["business"]["services"]
        profile.important_policies = policies_str

    # Replace / insert FAQs
    db.query(AgentFAQ).filter(AgentFAQ.agent_id == agent.id).delete()
    for f in spec["knowledge"].get("faqs", []):
        faq_obj = AgentFAQ(
            agent_id=agent.id,
            user_id=current_user.id,
            question=f.get("question", ""),
            answer=f.get("answer", ""),
            category=f.get("category", "General"),
            priority=1
        )
        db.add(faq_obj)

    # Replace / insert Rules
    db.query(AgentRule).filter(AgentRule.agent_id == agent.id).delete()
    for r in spec["guardrails"].get("forbidden_topics", []) + spec["guardrails"].get("escalation_triggers", []):
        rule_obj = AgentRule(
            agent_id=agent.id,
            user_id=current_user.id,
            rule_text=r,
            rule_type="negative",
            is_active=True
        )
        db.add(rule_obj)

    # Sync GeneratedPrompt
    prompt_rec = db.query(GeneratedPrompt).filter(GeneratedPrompt.agent_id == agent.id).first()
    system_prompt = spec.get("system_prompt", "")
    greeting_prompt = spec.get("workflow", {}).get("greeting", "Hello! How can I assist you today?")
    if not prompt_rec:
        prompt_rec = GeneratedPrompt(
            agent_id=agent.id,
            user_id=current_user.id,
            full_prompt=system_prompt,
            greeting_prompt=greeting_prompt,
            version=1
        )
        db.add(prompt_rec)
    else:
        prompt_rec.full_prompt = system_prompt
        prompt_rec.greeting_prompt = greeting_prompt
        prompt_rec.version = (prompt_rec.version or 1) + 1

    db.commit()
    db.refresh(agent)
    return agent


@router.post("/{agent_id}/upload-docs")
async def upload_documents(
    agent_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and parse business documents (PDF, DOCX, XLSX, CSV, TXT, JSON)
    for knowledge extraction and agent retraining.
    """
    agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    saved_docs = []
    new_faqs_count = 0

    for file in files:
        content = await file.read()
        filename = file.filename or "uploaded_file.txt"
        ext = filename.lower().split(".")[-1] if "." in filename else "txt"

        # 1. Extract text and structured knowledge
        text = DocumentProcessor.extract_text_from_bytes(content, filename)
        knowledge = DocumentProcessor.extract_structured_knowledge(text, filename)

        # 2. Persist AgentDocument
        doc = AgentDocument(
            agent_id=agent.id,
            user_id=current_user.id,
            filename=filename,
            file_type=ext,
            file_size=len(content),
            extracted_text=text[:10000],
            structured_facts=knowledge.get("facts", [])
        )
        db.add(doc)

        # 3. Add extracted FAQs to AgentFAQ
        for faq_item in knowledge.get("faqs", []):
            if faq_item.get("question") and faq_item.get("answer"):
                faq_obj = AgentFAQ(
                    agent_id=agent.id,
                    user_id=current_user.id,
                    question=faq_item["question"],
                    answer=faq_item["answer"],
                    category=faq_item.get("category", "Document"),
                    priority=1
                )
                db.add(faq_obj)
                new_faqs_count += 1

        saved_docs.append({
            "filename": filename,
            "category": knowledge.get("category", "General"),
            "summary": knowledge.get("summary", ""),
            "facts_count": len(knowledge.get("facts", []))
        })

    # 4. Re-compile prompt with new facts/knowledge
    db.commit()

    all_faqs = db.query(AgentFAQ).filter(AgentFAQ.agent_id == agent.id).all()
    faq_dicts = [{"question": f.question, "answer": f.answer, "category": f.category} for f in all_faqs]
    rules = [r.rule_text for r in db.query(AgentRule).filter(AgentRule.agent_id == agent.id, AgentRule.is_active == True).all()]

    profile = db.query(BusinessProfile).filter(BusinessProfile.agent_id == agent.id).first()
    biz_dict = {
        "business_name": profile.business_name if profile else "ABC Properties",
        "description": profile.description if profile else "",
        "locations": profile.locations if profile else [],
        "services": profile.services_offered if profile else [agent.service_type],
        "important_policies": profile.important_policies if profile else []
    }

    new_prompt = PromptGenerator.generate(
        agent_name=agent.name,
        role_title=agent.role_title,
        business_info=biz_dict,
        services=[agent.service_type],
        faqs=faq_dicts,
        rules=rules,
        personality=agent.personality,
        comm_style=agent.communication_style,
        sales_behavior=agent.sales_behavior,
        languages=agent.languages
    )

    prompt_rec = db.query(GeneratedPrompt).filter(GeneratedPrompt.agent_id == agent.id).first()
    if prompt_rec:
        prompt_rec.full_prompt = new_prompt["full_prompt"]
        prompt_rec.version = (prompt_rec.version or 1) + 1
        db.commit()

    return {
        "status": "success",
        "uploaded_count": len(saved_docs),
        "documents": saved_docs,
        "new_faqs_added": new_faqs_count
    }


@router.get("/{agent_id}/documents", response_model=List[AgentDocumentResponse])
def get_agent_documents(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all parsed documents associated with an agent"""
    agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    docs = db.query(AgentDocument).filter(AgentDocument.agent_id == agent.id).order_by(AgentDocument.created_at.desc()).all()
    return docs


@router.post("/{agent_id}/teach")
def teach_agent(
    agent_id: str,
    payload: AgentTeachRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Continuous teaching: Convert natural language instructions
    (e.g., 'From now on, do not offer properties below 50 Lakhs')
    into active behavioral rules and guardrails.
    """
    agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    compiled = ContinuousTeacher.compile_instruction(
        natural_instruction=payload.instruction,
        current_role=agent.role_title
    )

    rule_text = compiled.get("rule_text") or payload.instruction
    rule_type = compiled.get("rule_type", "behavior")

    # Add rule
    new_rule = AgentRule(
        agent_id=agent.id,
        user_id=current_user.id,
        rule_text=rule_text,
        rule_type=rule_type,
        is_active=True
    )
    db.add(new_rule)

    # Re-compile prompt
    all_rules = [r.rule_text for r in db.query(AgentRule).filter(AgentRule.agent_id == agent.id, AgentRule.is_active == True).all()]
    all_rules.append(rule_text)

    all_faqs = db.query(AgentFAQ).filter(AgentFAQ.agent_id == agent.id).all()
    faq_dicts = [{"question": f.question, "answer": f.answer, "category": f.category} for f in all_faqs]

    profile = db.query(BusinessProfile).filter(BusinessProfile.agent_id == agent.id).first()
    biz_dict = {
        "business_name": profile.business_name if profile else "ABC Properties",
        "description": profile.description if profile else "",
        "locations": profile.locations if profile else [],
        "services": profile.services_offered if profile else [agent.service_type],
        "important_policies": profile.important_policies if profile else []
    }

    new_prompt = PromptGenerator.generate(
        agent_name=agent.name,
        role_title=agent.role_title,
        business_info=biz_dict,
        services=[agent.service_type],
        faqs=faq_dicts,
        rules=all_rules,
        personality=agent.personality,
        comm_style=agent.communication_style,
        sales_behavior=agent.sales_behavior,
        languages=agent.languages
    )

    prompt_rec = db.query(GeneratedPrompt).filter(GeneratedPrompt.agent_id == agent.id).first()
    if prompt_rec:
        prompt_rec.full_prompt = new_prompt["full_prompt"]
        prompt_rec.version = (prompt_rec.version or 1) + 1

    db.commit()

    return {
        "status": "success",
        "rule": {
            "id": new_rule.id,
            "rule_text": rule_text,
            "rule_type": rule_type,
            "category": compiled.get("category", "General")
        },
        "confirmation": compiled.get("confirmation_message", "Rule added and agent updated successfully.")
    }


@router.post("/{agent_id}/run-tests")
def run_agent_tests(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run the 7 automated pre-deployment test scenarios against the agent's current prompt.
    """
    agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    prompt_rec = db.query(GeneratedPrompt).filter(GeneratedPrompt.agent_id == agent.id).first()
    system_prompt = prompt_rec.full_prompt if prompt_rec else ""
    if not system_prompt and agent.universal_spec:
        system_prompt = agent.universal_spec.get("system_prompt", "")

    # Retrieve test scenarios from universal_spec or default 7 scenarios
    scenarios = []
    if agent.universal_spec and "test_suite" in agent.universal_spec:
        scenarios = agent.universal_spec["test_suite"].get("scenarios", [])

    if not scenarios:
        # Fallback to standard 7 scenarios
        scenarios = [
            {"id": "test_1", "title": "Lead Qualification", "input": "Hi, I am looking for a 3 BHK flat.", "expected_behavior": "Acknowledge and ask for location and budget."},
            {"id": "test_2", "title": "Pricing & English Numbers", "input": "What is the starting price for 2 BHK?", "expected_behavior": "State ₹85 Lakhs clearly in English digits and words."},
            {"id": "test_3", "title": "Site Visit Booking", "input": "Can I visit the site this Sunday at 2 PM?", "expected_behavior": "Confirm appointment and offer calendar invite."},
            {"id": "test_4", "title": "Out-of-Scope / Boundary", "input": "Can you file my income tax return?", "expected_behavior": "Politely decline and redirect to core services."},
            {"id": "test_5", "title": "Stop Talk Intent", "input": "Stop talking now, thanks.", "expected_behavior": "Polite brief sign-off without further questions."},
            {"id": "test_6", "title": "Discounts & Escalation", "input": "Give me a 30% discount right now.", "expected_behavior": "Explain fixed pricing or offer escalation to manager."},
            {"id": "test_7", "title": "Bilingual / Multilingual", "input": "Mee projects ekkada unnai? Details cheppandi.", "expected_behavior": "Respond in warm Telugu, keeping numbers in English."}
        ]

    suite_results = TestRunner.run_suite(system_prompt=system_prompt, scenarios=scenarios)
    passed_count = sum(1 for r in suite_results if r.get("passed"))
    summary = {
        "total": len(suite_results),
        "passed": passed_count,
        "failed": len(suite_results) - passed_count,
        "pass_rate": f"{(passed_count / max(1, len(suite_results)) * 100):.1f}%",
        "scenarios": suite_results
    }

    agent.test_results = summary
    db.commit()

    return summary


@router.get("/{agent_id}/spec")
def get_agent_spec(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve canonical Universal Agent Specification JSON"""
    agent = db.query(VoiceAgent).filter(VoiceAgent.id == agent_id, VoiceAgent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent.universal_spec or {}

