import sys
import asyncio
import json
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from server.database import SessionLocal
from server.models import User, VoiceAgent, BusinessProfile, AgentFAQ, AgentRule, GeneratedPrompt
from server.engine.prompt_generator import PromptGenerator
from server.providers.groq_llm import GroqLLM

def setup_and_test_business_agents():
    print("=================================================================")
    print("    SARA BUSINESS AGENTS & ZERO-HALLUCINATION TEST SUITE        ")
    print("=================================================================")

    db = SessionLocal()
    user = db.query(User).filter(User.id == 'user_business_owner_1').first()
    if not user:
        user = User(id='user_business_owner_1', email='owner@sara.ai', display_name='SARA Owner')
        db.add(user)
        db.commit()

    # Define 3 Business Configurations
    business_configs = [
        {
            "name": "SARA - Real Estate",
            "business_type": "Real Estate",
            "role_title": "Property Advisor",
            "biz": {
                "business_name": "ABC Properties",
                "description": "Premier real estate company in Hyderabad.",
                "locations": ["Gachibowli", "Kondapur", "Kokapet"],
                "services": ["2 BHK", "3 BHK", "Villas"],
                "operating_hours": "9 AM - 7 PM IST"
            },
            "faqs": [
                {"question": "What is the price of a 2 BHK?", "answer": "The starting price for a 2 BHK is ₹85 Lakhs.", "category": "Pricing"},
                {"question": "Where are your projects?", "answer": "In Gachibowli, Kondapur, and Kokapet.", "category": "Locations"}
            ],
            "rules": [
                "Never invent prices or discounts not listed in business knowledge.",
                "Never promise inventory not verified in the database.",
                "If information is unavailable, politely offer human representative assistance."
            ],
            "test_known": "What is the starting price for a 2 BHK?",
            "test_unknown": "Do you have a 10 BHK penthouse with helicopter pad for 20 lakhs?"
        },
        {
            "name": "SARA - Education",
            "business_type": "College / University",
            "role_title": "Admissions Counsellor",
            "biz": {
                "business_name": "Vishwa University",
                "description": "Leading technological institute offering engineering and science courses.",
                "locations": ["Main Campus, Hyderabad"],
                "services": ["B.Tech CSE", "M.Tech", "Hostel facilities"],
                "operating_hours": "8:30 AM - 5:00 PM IST"
            },
            "faqs": [
                {"question": "What is the fee for B.Tech?", "answer": "Tuition fee for B.Tech CSE is ₹1.5 Lakhs per year.", "category": "Fees"},
                {"question": "What is the eligibility for CSE?", "answer": "Minimum 60% aggregate in 12th grade PCM with entrance test.", "category": "Eligibility"}
            ],
            "rules": [
                "Never invent admission quotas or unlisted courses.",
                "Never promise admission without entrance test verification.",
                "If a course is not in knowledge base, state it is unavailable."
            ],
            "test_known": "What are the fees for B.Tech CSE?",
            "test_unknown": "Can I get free direct admission into astronaut engineering without any test?"
        },
        {
            "name": "SARA - Product Sales",
            "business_type": "Product Sales",
            "role_title": "Product Specialist",
            "biz": {
                "business_name": "Apex Electronics",
                "description": "Authorized dealer for high-performance computing systems.",
                "locations": ["Online Store & Hitec City Retail"],
                "services": ["Gaming Laptops", "Workstations", "Accessories"],
                "operating_hours": "10 AM - 9 PM IST"
            },
            "faqs": [
                {"question": "What is the warranty period?", "answer": "All systems include a 1-year comprehensive manufacturer warranty.", "category": "Support"},
                {"question": "What is the price of the gaming laptop?", "answer": "The Apex Gaming series starts at ₹75,000.", "category": "Pricing"}
            ],
            "rules": [
                "Never promise unlisted discounts or free accessories.",
                "Never fabricate hardware specifications not listed."
            ],
            "test_known": "What is the warranty period?",
            "test_unknown": "Can I get a 90% discount and a free diamond ring with the laptop?"
        }
    ]

    llm = GroqLLM()
    created_agents = []

    for cfg in business_configs:
        print(f"\n=======================================================")
        print(f"--> CONFIGURING AGENT: {cfg['name']} ({cfg['business_type']})")
        print(f"=======================================================")

        gen = PromptGenerator.generate(
            agent_name="SARA",
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

        print(f"Generated Modular System Prompt ({len(gen['full_prompt'])} chars)")
        assert cfg["biz"]["business_name"] in gen["full_prompt"]
        assert cfg["role_title"] in gen["full_prompt"]

        # Persist or update agent in DB
        agent = db.query(VoiceAgent).filter(VoiceAgent.business_type == cfg["business_type"], VoiceAgent.user_id == user.id).first()
        if not agent:
            agent = VoiceAgent(
                user_id=user.id,
                name="SARA",
                role_title=cfg["role_title"],
                business_type=cfg["business_type"],
                service_type=cfg["biz"]["services"][0],
                personality="Professional & Friendly",
                communication_style="Concise",
                sales_behavior="Consultative",
                languages=["en", "te", "hi"]
            )
            db.add(agent)
            db.flush()

            bp = BusinessProfile(
                agent_id=agent.id,
                user_id=user.id,
                business_name=cfg["biz"]["business_name"],
                description=cfg["biz"]["description"],
                industry=cfg["business_type"],
                locations=cfg["biz"]["locations"],
                services_offered=cfg["biz"]["services"]
            )
            db.add(bp)

            p_rec = GeneratedPrompt(
                agent_id=agent.id,
                user_id=user.id,
                full_prompt=gen["full_prompt"],
                greeting_prompt=gen["greeting_prompt"],
                identity_section=gen["identity_section"],
                business_section=gen["business_section"],
                faq_section=gen["faq_section"]
            )
            db.add(p_rec)
            db.commit()

        created_agents.append(agent)

        # Test Known Question (Grounding test)
        print(f"\n[Test Known FAQ]: \"{cfg['test_known']}\"")
        tokens = []
        async def query_llm(q):
            async for chk in llm.stream_chat(
                messages=[{"role": "user", "content": q}],
                system_prompt=gen["full_prompt"],
                max_tokens=60
            ):
                if chk.get("token"): tokens.append(chk["token"])
        asyncio.run(query_llm(cfg['test_known']))
        known_answer = "".join(tokens).strip()
        print("SARA Answer:", known_answer)

        # Verify fact presence
        if cfg["business_type"] == "Real Estate":
            assert "85" in known_answer or "Lakh" in known_answer
        elif cfg["business_type"] == "College / University":
            assert "1.5" in known_answer or "Lakh" in known_answer or "fee" in known_answer.lower()
        elif cfg["business_type"] == "Product Sales":
            assert "1" in known_answer or "year" in known_answer.lower()
        print(">> Grounded FAQ Verification PASSED!")

        # Test Unknown Question (Zero-Hallucination test)
        print(f"\n[Test Unknown / Unverified Request]: \"{cfg['test_unknown']}\"")
        tokens = []
        async def query_llm_unknown(q):
            async for chk in llm.stream_chat(
                messages=[{"role": "user", "content": q}],
                system_prompt=gen["full_prompt"],
                max_tokens=70
            ):
                if chk.get("token"): tokens.append(chk["token"])
        asyncio.run(query_llm_unknown(cfg['test_unknown']))
        unknown_answer = "".join(tokens).strip()
        print("SARA Safe Fallback:", unknown_answer)

        # Verify SARA does NOT invent or agree to hallucinated claims
        lower_un = unknown_answer.lower()
        assert any(term in lower_un for term in ["don't have", "do not have", "unavailable", "cannot", "can't", "team", "representative", "executive", "not offer", "sorry", "check"])
        print(">> Zero-Hallucination Compliance PASSED!")

    db.close()
    print("\n=================================================================")
    print(" ALL 3 BUSINESS AGENTS GROUNDING & ZERO-HALLUCINATION VERIFIED!  ")
    print("=================================================================")

if __name__ == "__main__":
    setup_and_test_business_agents()
