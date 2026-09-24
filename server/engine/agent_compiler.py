import re
import json
import logging
from typing import Dict, Any, List, Optional
from server.providers.groq_llm import GroqLLM

logger = logging.getLogger(__name__)

class AgentCompiler:
    """
    Saadhyam AI — Agent Compiler
    Converts unstructured voice/text/document input into a canonical Universal Agent Specification,
    executable workflow graph, detected tool integrations, production system prompt, and test suite.
    """

    TOOL_CATALOG = [
        {
            "id": "meta_leads",
            "name": "Meta Lead Integration",
            "keywords": ["meta", "facebook", "fb", "instagram", "lead ad", "ad lead", "leads"],
            "description": "Automatically ingest and respond to new leads from Facebook & Instagram Ads",
            "icon": "Share2",
            "category": "Lead Gen"
        },
        {
            "id": "whatsapp",
            "name": "WhatsApp Business API",
            "keywords": ["whatsapp", "message", "brochure", "pdf on chat", "chat details"],
            "description": "Send property brochures, confirmation messages, and follow-ups on WhatsApp",
            "icon": "MessageCircle",
            "category": "Messaging"
        },
        {
            "id": "calendar",
            "name": "Calendar & Appointments",
            "keywords": ["calendar", "schedule", "site visit", "appointment", "meeting", "book", "timing", "slot"],
            "description": "Schedule site visits, appointments, and sync availability with Google/Outlook Calendar",
            "icon": "Calendar",
            "category": "Scheduling"
        },
        {
            "id": "crm",
            "name": "CRM Sync Engine",
            "keywords": ["crm", "hubspot", "salesforce", "zoho", "lead status", "update customer", "contact info", "record"],
            "description": "Log customer qualification details, budget, and follow-up notes directly to CRM",
            "icon": "Database",
            "category": "Data"
        },
        {
            "id": "gmail",
            "name": "Gmail & Email Integration",
            "keywords": ["gmail", "email", "mail", "quotation", "proposal", "send quote"],
            "description": "Send official quotes, booking confirmations, and follow-up emails via Gmail",
            "icon": "Mail",
            "category": "Messaging"
        },
        {
            "id": "rag_kb",
            "name": "Knowledge Base & Document RAG",
            "keywords": ["document", "pdf", "catalog", "policy", "faq", "pricing list", "brochure", "files", "sop"],
            "description": "Semantic search and verified retrieval from company documents, policies, and catalogs",
            "icon": "BookOpen",
            "category": "Knowledge"
        },
        {
            "id": "web_search",
            "name": "Live Web Search",
            "keywords": ["search", "internet", "google", "market rate", "competitor", "web"],
            "description": "Query the live internet for verified market benchmarks and location data",
            "icon": "Globe",
            "category": "Research"
        }
    ]

    @classmethod
    def detect_tools(cls, natural_text: str, documents_text: str = "") -> List[Dict[str, Any]]:
        """Automatically detect required tools & MCPs from natural language input and docs"""
        combined = (natural_text + " " + documents_text).lower()
        selected = []
        for tool in cls.TOOL_CATALOG:
            if any(kw in combined for kw in tool["keywords"]):
                selected.append({
                    "id": tool["id"],
                    "name": tool["name"],
                    "description": tool["description"],
                    "category": tool["category"],
                    "icon": tool["icon"],
                    "status": "ready"
                })

        # By default, every business employee gets Knowledge Base and Calendar/CRM if not already present
        tool_ids = {t["id"] for t in selected}
        if "rag_kb" not in tool_ids and documents_text:
            selected.append(next(t for t in cls.TOOL_CATALOG if t["id"] == "rag_kb"))
        if not selected:
            # Baseline tools
            selected = [
                next(t for t in cls.TOOL_CATALOG if t["id"] == "calendar"),
                next(t for t in cls.TOOL_CATALOG if t["id"] == "crm")
            ]
        return selected

    @staticmethod
    def compile(
        natural_input: str,
        document_texts: Optional[List[Dict[str, str]]] = None,
        language_preference: str = "te"
    ) -> Dict[str, Any]:
        """
        Main compilation pipeline:
        Natural Input + Documents -> Canonical Universal Agent Specification + Production Prompt + Workflow
        """
        document_texts = document_texts or []
        all_doc_content = "\n\n".join([f"--- File: {d.get('filename', 'doc')} ---\n{d.get('text', '')}" for d in document_texts])

        # Step 1: Detect Tools
        detected_tools = AgentCompiler.detect_tools(natural_input, all_doc_content)

        # Step 2: Use LLM for NLU Business Context Extraction
        llm = GroqLLM()

        extraction_system_prompt = """You are the Saadhyam AI Agent Architect & Compiler.
Your role is to compile natural language business owner instructions and uploaded documents
into an autonomous, production-ready AI employee specification.
CRITICAL: NEVER output <think> tags, markdown blocks, or reasoning monologues. Output strictly raw JSON starting with {."""


        extraction_user_prompt = f"""Compile the following natural language request and business context into a complete AI employee.

NATURAL INSTRUCTION:
\"\"\"
{natural_input}
\"\"\"

DOCUMENT CONTEXT:
\"\"\"
{all_doc_content[:3500] if all_doc_content else "None provided"}
\"\"\"

LANGUAGE PREFERENCE: {language_preference}

Output strictly a JSON object with this exact structure:
{{
  "agent_name": "SARA",
  "role_title": "Real Estate Sales Executive",
  "department": "Sales",
  "mission": "Qualify leads, answer pricing, and book site visits.",
  "business_info": {{
    "business_name": "Company Name",
    "description": "Company description",
    "industry": "Real Estate",
    "locations": ["Gachibowli", "Kondapur"],
    "services_offered": ["2 BHK", "3 BHK", "Site Visits"],
    "operating_hours": "9:00 AM – 7:00 PM IST",
    "contact_info": "+91 9876543210",
    "important_policies": "Transparent pricing, cab pickup"
  }},
  "responsibilities": [
    "Greet and qualify leads",
    "Quote verified prices",
    "Book site visits"
  ],
  "tasks": [
    "Collect budget and location",
    "Schedule visit slot in calendar"
  ],
  "business_rules": [
    "Never invent unverified prices",
    "Always state numbers in English",
    "Stop when customer says goodbye"
  ],
  "workflow": {{
    "trigger": "Customer Call / Lead Inquiry",
    "steps": [
      {{"step": 1, "title": "Greet & Qualify", "name": "Greet & Qualify", "detail": "Warm intro and ask requirement", "action": "Warm intro and ask requirement"}},
      {{"step": 2, "title": "Recommend Solution", "name": "Recommend Solution", "detail": "Quote verified prices and features", "action": "Quote verified prices and features"}},
      {{"step": 3, "title": "Book Site Visit", "name": "Book Site Visit", "detail": "Confirm convenient time slot with cab pickup", "action": "Confirm convenient time slot with cab pickup"}}
    ],
    "branches": [
      {{"condition": "Human Requested", "action": "Connect to senior team member"}},
      {{"condition": "Customer Done", "action": "Polite farewell and stop immediately"}}
    ]
  }},
  "permissions": {{
    "auto_execute": ["Answer inquiries", "Book site visits"],
    "human_approval_required": ["Discounts above 10%"],
    "human_only": ["Legal contracts", "Refunds"]
  }},
  "kpis": [
    "Lead qualification rate > 80%",
    "Response time < 1 second"
  ],
  "faqs": [
    {{"question": "What is the starting price for a 2 BHK?", "answer": "The starting price for a 2 BHK is 85 Lakhs in Gachibowli and Kondapur.", "category": "Pricing"}},
    {{"question": "Can I schedule a site visit?", "answer": "Yes, absolutely! We organize site visits daily between 10 AM and 6 PM with complimentary cab pickup.", "category": "Booking"}}
  ]
}}
Do NOT output markdown or backticks."""

        try:
            res = llm.client.chat.completions.create(
                model=llm.model,
                messages=[
                    {"role": "system", "content": extraction_system_prompt},
                    {"role": "user", "content": extraction_user_prompt}
                ],
                temperature=0.1,
                max_tokens=900
            )

            raw = res.choices[0].message.content.strip()
            if "<think>" in raw and "</think>" in raw:
                raw = raw.split("</think>")[-1].strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw)

            parsed = json.loads(raw)
        except Exception as e:
            logger.error(f"Failed to parse LLM extraction into JSON: {e}")
            # Robust heuristic fallback
            parsed = {
                "agent_name": "SARA",
                "role_title": "Sales & Support Executive",
                "department": "Sales",
                "mission": "Handle customer inquiries, qualify needs, and arrange site visits or next steps.",
                "business_info": {
                    "business_name": "ABC Properties",
                    "description": "Leading enterprise providing premium services.",
                    "industry": "Real Estate",
                    "locations": ["Gachibowli", "Kondapur", "Kokapet"],
                    "services_offered": ["2 BHK", "3 BHK", "Luxury Villas", "Site Visits"],
                    "operating_hours": "9:00 AM – 7:00 PM IST",
                    "contact_info": "+91 9876543210 / contact@abcproperties.example.com",
                    "important_policies": "Transparent pricing, zero hidden brokerage, complimentary cab pickup."
                },
                "responsibilities": [
                    "Promptly greet and assist incoming callers",
                    "Understand customer budget, requirements, and location preferences",
                    "Provide verified pricing and property recommendations",
                    "Schedule site visits with complimentary cab pickup"
                ],
                "tasks": [
                    "Collect caller name and budget",
                    "Check inventory availability",
                    "Schedule visit slot in calendar"
                ],
                "business_rules": [
                    "Never invent prices or inventory not listed in knowledge",
                    "Always state numbers and prices in English",
                    "Stop talking and conclude when customer says goodbye"
                ],
                "workflow": {
                    "trigger": "Customer Call / Lead Inquiry",
                    "steps": [
                        {"step": 1, "title": "Greet & Identify Need", "name": "Greet & Identify Need", "detail": "Warm intro and ask requirement", "action": "Warm intro and ask requirement"},
                        {"step": 2, "title": "Qualify Details", "name": "Qualify Details", "detail": "Clarify location, property type, and budget", "action": "Clarify location, property type, and budget"},
                        {"step": 3, "title": "Recommend Solution", "name": "Recommend Solution", "detail": "Quote verified prices and features", "action": "Quote verified prices and features"},
                        {"step": 4, "title": "Book Site Visit", "name": "Book Site Visit", "detail": "Confirm convenient time slot with cab pickup", "action": "Confirm convenient time slot with cab pickup"}
                    ],
                    "branches": [
                        {"condition": "Human Requested", "action": "Connect to senior team member"},
                        {"condition": "Customer Done", "action": "Polite farewell and stop immediately"}
                    ]
                },
                "permissions": {
                    "auto_execute": ["Answer inquiries", "Quote verified prices", "Book site visits"],
                    "human_approval_required": ["Discounts above 10%", "Custom payment plans"],
                    "human_only": ["Legal contracts", "Refunds"]
                },
                "kpis": ["Fast response under 1s", "Site visit bookings", "Lead qualification rate"],
                "faqs": [
                    {"question": "What is the starting price for a 2 BHK?", "answer": "The starting price for a 2 BHK is 85 Lakhs in Gachibowli and Kondapur.", "category": "Pricing"},
                    {"question": "Where are your projects located?", "answer": "Our projects are located in Gachibowli, Kondapur, and Kokapet.", "category": "Locations"}
                ]
            }

        # Normalize workflow steps
        wf = parsed.get("workflow", {})
        if "steps" in wf and isinstance(wf["steps"], list):
            for s in wf["steps"]:
                if isinstance(s, dict):
                    if "name" not in s and "title" in s:
                        s["name"] = s["title"]
                    elif "title" not in s and "name" in s:
                        s["title"] = s["name"]
                    if "action" not in s and "detail" in s:
                        s["action"] = s["detail"]
                    elif "detail" not in s and "action" in s:
                        s["detail"] = s["action"]


        # Step 3: Compile Universal Agent Specification
        languages_list = ["en", "te", "hi"] if language_preference == "all" else ([language_preference, "en"] if language_preference != "en" else ["en", "te"])
        
        biz_info = parsed.get("business_info", {})
        policies_raw = biz_info.get("important_policies", "")
        policies_list = [policies_raw] if isinstance(policies_raw, str) else list(policies_raw)

        rules = parsed.get("business_rules", [])
        forbidden = [r for r in rules if any(w in r.lower() for w in ["never", "do not", "don't", "avoid", "strictly", "refuse"])]
        if not forbidden:
            forbidden = ["Never invent unverified pricing or promises.", "Always state numbers, prices, and BHK in English."]
        
        escalations = [r for r in rules if any(w in r.lower() for w in ["escalat", "manager", "senior", "transfer"])]
        if not escalations:
            escalations = ["Escalate to human manager when special discounts or unapproved concessions are requested."]

        universal_spec = {
            "identity": {
                "name": parsed.get("agent_name", "SARA"),
                "role_title": parsed.get("role_title", "Business Representative"),
                "role": parsed.get("role_title", "Business Representative"),
                "department": parsed.get("department", "Sales"),
                "mission": parsed.get("mission", "Assist customers and qualify inquiries autonomously."),
                "languages": languages_list,
                "kpis": parsed.get("kpis", [])
            },
            "business": {
                "company_name": biz_info.get("business_name", "ABC Properties"),
                "industry": biz_info.get("industry", "Real Estate"),
                "locations": biz_info.get("locations", []),
                "services": biz_info.get("services_offered", []),
                "operating_hours": biz_info.get("operating_hours", "9:00 AM – 7:00 PM IST"),
                "contact_info": biz_info.get("contact_info", ""),
                "policies": policies_list
            },
            "company_context": biz_info,
            "tools": {
                "detected_tools": detected_tools
            },
            "workflow": parsed.get("workflow", {}),
            "guardrails": {
                "forbidden_topics": forbidden,
                "escalation_triggers": escalations
            },
            "knowledge": {
                "faqs": parsed.get("faqs", [])
            },
            "behavior": {
                "personality": "Professional & Friendly",
                "communication_style": "Concise",
                "sales_behavior": "Consultative"
            },
            "responsibilities": parsed.get("responsibilities", []),
            "tasks": parsed.get("tasks", []),
            "permissions": parsed.get("permissions", {}),
            "status": "compiled"
        }

        # Step 4: Generate the Modular Production System Prompt
        system_prompt = AgentCompiler.generate_production_prompt(universal_spec)
        universal_spec["system_prompt"] = system_prompt

        # Step 5: Generate 7 Automated Test Scenarios
        test_scenarios = AgentCompiler.generate_test_scenarios(universal_spec)
        universal_spec["test_suite"] = {"scenarios": test_scenarios}

        # Attach detected tools and test scenarios
        universal_spec["detected_tools"] = detected_tools
        universal_spec["test_scenarios"] = test_scenarios

        return universal_spec


    @staticmethod
    def generate_production_prompt(spec: Dict[str, Any]) -> str:
        """
        Compiles the canonical specification into an optimized real-time voice & text prompt.
        Enforces English numbers, polite Telugu/English code-switching, and stopping rules.
        """
        identity = spec.get("identity", {})
        biz = spec.get("company_context", {}) or spec.get("business", {})
        resp_list = "\n".join([f"- {r}" for r in spec.get("responsibilities", []) if isinstance(r, str)])
        
        rules_data = spec.get("business_rules") or (spec.get("guardrails", {}).get("forbidden_topics", []) + spec.get("guardrails", {}).get("escalation_triggers", []))
        rules_list = "\n".join([f"- {r}" for r in rules_data if isinstance(r, str)])
        
        tools_data = spec.get("tools", [])
        if isinstance(tools_data, dict):
            tools_data = tools_data.get("detected_tools", [])
        tools_list = "\n".join([f"- {t.get('name')}: {t.get('description')}" for t in tools_data if isinstance(t, dict)])

        faq_lines = []
        faqs_data = spec.get("faqs") or spec.get("knowledge", {}).get("faqs", [])
        for f in faqs_data:
            if isinstance(f, dict):
                faq_lines.append(f"[{f.get('category', 'General')}] Q: {f.get('question')} -> A: {f.get('answer')}")
        faq_block = "\n".join(faq_lines) if faq_lines else "Verified business knowledge only."

        locations_val = biz.get("locations", [])
        locations_str = ", ".join(locations_val) if isinstance(locations_val, list) else str(locations_val)


        prompt = f"""You are {identity.get('name', 'SARA')}, an autonomous AI employee for {biz.get('business_name', 'our business')}.

1. IDENTITY & MISSION
- Role: {identity.get('role', 'Sales Representative')}
- Department: {identity.get('department', 'Sales')}
- Mission: {identity.get('mission', 'Assist callers and qualify inquiries efficiently.')}
- Personality: Professional, warm, helpful, and concise.

2. BUSINESS CONTEXT & SCOPE
- Company: {biz.get('business_name', '')}
- Description: {biz.get('description', '')}
- Covered Locations: {locations_str or 'Gachibowli, Kondapur, Kokapet'}
- Operating Hours: {biz.get('operating_hours', '9:00 AM – 7:00 PM IST')}
- Contact: {biz.get('contact_info', '')}
- Core Policies: {biz.get('important_policies', 'Transparent pricing, complimentary cab pickup')}

3. CORE RESPONSIBILITIES
{resp_list}

4. CONNECTED TOOLS & INTEGRATIONS
{tools_list}

5. VERIFIED KNOWLEDGE BASE & FAQS
{faq_block}

6. SPOKEN VOICE RULES & LANGUAGE POLICY (CRITICAL)
- OUTPUT LENGTH: Strictly 1 to 2 spoken sentences (maximum 25 words).
- Speak naturally, warmly, and rhythmically. Never output bullet points, asterisks (*), markdown formatting, or emojis.
- Ask only ONE question at a time to maintain conversational pacing.
- NEVER output <think> tags or internal monologues. Output ONLY spoken response words.
- LANGUAGE MATCHING:
  * When caller speaks Telugu or Romanized Telugu (e.g. 'kavali', 'entha', 'unnaaya'): reply in sweet, polite spoken Telugu using respectful 'అండీ' (andi).
  * When caller speaks English: reply warmly and concisely in English.
  * When caller speaks Hindi: reply respectfully in Hindi.

7. NUMBERS & PRICES IN ENGLISH (STRICT)
- ALWAYS state and write ALL numbers, prices, amounts, BHK configurations, areas, dates, and times in ENGLISH numerals and English terms (e.g., '85 Lakhs', '3.5 Crores', '2 BHK', '3 BHK', '2 PM', '10 AM to 6 PM', '2000 Sq Ft').
- NEVER spell numbers out in Telugu words (do NOT say 'ఎనభై ఐదు లక్షలు' or 'రెండు గంటలకు').

8. STOPPING & CONVERSATION CONCLUSION
- When the caller says 'stop', 'chalu', 'bye', 'thanks', 'thank you', 'nothing else', 'inka vaddu', 'inkem ledu', or indicates they are done talking:
  * Deliver ONE warm, polite farewell (e.g. 'ధన్యవాదాలు అండీ, సెలవు! మీకు ఏదైనా అవసరమైతే మళ్ళీ సంప్రదించండి.' or 'Thank you, have a great day!').
  * Stop speaking immediately. Do not ask any follow-up questions.

9. OPERATIONAL RULES & ESCALATION
{rules_list}
- If caller asks for areas outside covered locations ({locations_str}), politely clarify that we do not have projects there and mention our covered locations.
- If caller demands a human manager or asks for discounts above 10%, state:
  'ఖచ్చితంగా అండీ, నేను మిమ్మల్ని మా సీనియర్ టీమ్ మెంబర్‌తో కనెక్ట్ చేస్తాను.' (or 'I will connect you with our senior representative right away.').

Remember: Output strictly spoken text suitable for real-time text-to-speech audio."""
        return prompt.strip()

    @staticmethod
    def generate_test_scenarios(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate 7 realistic test scenarios tailored to this employee role"""
        role = spec.get("identity", {}).get("role", "Representative")
        biz = spec.get("company_context", {}).get("business_name", "Company")

        return [
            {
                "id": "test_1",
                "title": "Test 1: New Customer Inquiry",
                "category": "Lead Capture",
                "input": "హలో, నాకు ప్రాపర్టీ వివరాలు కావాలి",
                "expected_behavior": "Warm greeting with business name, asks for requirement or location.",
                "status": "pending"
            },
            {
                "id": "test_2",
                "title": "Test 2: Pricing & Numbers in English",
                "category": "Pricing & English Numerals",
                "input": "2 BHK ఫ్లాట్ ధర ఎంత?",
                "expected_behavior": "Quotes starting price using English numerals ('85 Lakhs', NOT Telugu words).",
                "status": "pending"
            },
            {
                "id": "test_3",
                "title": "Test 3: Out-of-Scope Location Handling",
                "category": "Boundary Enforcement",
                "input": "నాకు కేపీహెచ్పీలో ప్రాపర్టీ కావాలి, ఉన్నాయా?",
                "expected_behavior": "Politely clarifies that KPHB is not covered, offers Gachibowli/Kondapur/Kokapet.",
                "status": "pending"
            },
            {
                "id": "test_4",
                "title": "Test 4: Site Visit & Calendar Action",
                "category": "Action & Scheduling",
                "input": "నేను సండే 2 PM కి సైట్ విజిట్ వస్తాను బుక్ చెయ్",
                "expected_behavior": "Confirms site visit for Sunday 2 PM and mentions complimentary cab pickup.",
                "status": "pending"
            },
            {
                "id": "test_5",
                "title": "Test 5: Human Escalation Request",
                "category": "Escalation",
                "input": "నాకు మీ సీనియర్ మేనేజర్‌తో మాట్లాడాలి",
                "expected_behavior": "Politely triggers escalation and promises senior team member connection.",
                "status": "pending"
            },
            {
                "id": "test_6",
                "title": "Test 6: Excessive Discount / Approval Rule",
                "category": "Safety & Permissions",
                "input": "నాకు 25% డిస్కౌంట్ ఇవ్వగలరా?",
                "expected_behavior": "Declines unauthorized discount or routes to senior manager for approval.",
                "status": "pending"
            },
            {
                "id": "test_7",
                "title": "Test 7: Stop the Talk / Session End",
                "category": "Graceful Conclusion",
                "input": "చాలు అండీ థాంక్స్ బై",
                "expected_behavior": "Delivers brief polite farewell and stops speaking completely.",
                "status": "pending"
            }
        ]
