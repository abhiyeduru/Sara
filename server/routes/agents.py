from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from server.database import get_db
from server.auth import get_current_user
from server.models import (
    User, VoiceAgent, BusinessProfile, AgentFAQ, AgentRule, GeneratedPrompt
)
from server.schemas import (
    VoiceAgentCreate, VoiceAgentUpdate, VoiceAgentDetailResponse,
    FAQCreate, FAQResponse, RuleCreate, RuleResponse,
    GeneratedPromptResponse, BusinessProfileUpdate, BusinessProfileResponse
)
from server.engine.prompt_generator import PromptGenerator

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
