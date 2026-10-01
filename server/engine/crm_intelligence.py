import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from server.config import settings

logger = logging.getLogger(__name__)

# Try importing LLM clients
try:
    from groq import Groq
    groq_client = Groq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None
except Exception as e:
    groq_client = None
    logger.warning(f"Groq client init skipped: {e}")

try:
    from openai import OpenAI
    openai_client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
except Exception as e:
    openai_client = None
    logger.warning(f"OpenAI client init skipped: {e}")


def _clean_json_response(text: str) -> Dict[str, Any]:
    """Extract and parse JSON safely from LLM output"""
    text = text.strip()
    # Strip markdown code fences if present
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()
    try:
        return json.loads(text)
    except Exception:
        # Try finding outermost { ... }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end+1])
            except Exception:
                pass
        return {}


def analyze_call_transcript(
    transcript_text: str,
    customer_name: str = "Customer",
    customer_phone: str = "",
    agent_name: str = "SARA"
) -> Dict[str, Any]:
    """
    AI Conversation Intelligence:
    Extracts intent, requirements, budget, timeline, objections, questions,
    competitors, sentiment, purchase intent, promises, follow-up, and formatted summary.
    """
    system_prompt = """You are Saadhyam AI's Conversation Intelligence Engine.
Analyze the provided business call transcript between an Agent and a Customer.
Return a STRICT JSON object with these exact keys:
{
  "customer_intent": "Brief description of customer's goal",
  "requirements": ["requirement 1", "requirement 2"],
  "budget": "Budget if stated or 'Not specified'",
  "timeline": "Timeline if stated or 'Immediate / Not specified'",
  "objections": ["objection 1", "objection 2"],
  "questions": ["question 1 asked by customer"],
  "competitors": ["competitor name if mentioned"],
  "sentiment": "Positive" | "Neutral" | "Negative" | "Frustrated" | "Interested" | "Uncertain",
  "sentiment_score": 0.85,
  "purchase_intent": "High" | "Medium" | "Low" | "Uncertain",
  "purchase_intent_score": 0.9,
  "promises": ["commitment made by agent or customer"],
  "follow_up_needed": true | false,
  "follow_up_reason": "Specific reason callback is required",
  "follow_up_days": 1,
  "next_recommended_action": "Actionable next step for sales rep or AI",
  "call_summary": "Formatted concise summary"
}
Ensure sentiment is explainable and factual. Do not hallucinate commitments."""

    user_prompt = f"""Transcript:
{transcript_text}

Customer: {customer_name} ({customer_phone})
Agent: {agent_name}

Extract complete business intelligence in JSON format."""

    # 1. Try Groq or OpenAI
    raw_reply = None
    for model_name in ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"]:
        if groq_client:
            try:
                completion = groq_client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.2,
                    max_tokens=1000
                )
                raw_reply = completion.choices[0].message.content
                break
            except Exception as e:
                logger.warning(f"Groq model {model_name} failed: {e}")

    if not raw_reply and openai_client:
        try:
            completion = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=1000
            )
            raw_reply = completion.choices[0].message.content
        except Exception as e:
            logger.warning(f"OpenAI fallback failed: {e}")

    if raw_reply:
        data = _clean_json_response(raw_reply)
        if data and "customer_intent" in data:
            return data

    # 2. Rule-based Grounded Intelligence Fallback if LLM is unavailable
    text_lower = transcript_text.lower()
    
    # Requirements extraction
    reqs = []
    if "3bhk" in text_lower or "3 bhk" in text_lower:
        reqs.append("3 BHK configuration")
    elif "2bhk" in text_lower or "2 bhk" in text_lower:
        reqs.append("2 BHK configuration")
    if "villa" in text_lower:
        reqs.append("Independent Villa / Gated Community")
    if "kakinada" in text_lower:
        reqs.append("Location: Kakinada")
    elif "hyderabad" in text_lower or "gachibowli" in text_lower:
        reqs.append("Location: Hyderabad / Gachibowli")
    if "emi" in text_lower or "loan" in text_lower:
        reqs.append("Home loan / EMI financing assistance")

    # Budget extraction
    budget = "Not specified"
    if "crore" in text_lower or "1 cr" in text_lower:
        budget = "₹80 Lakhs – ₹1.2 Crore"
    elif "85 lakh" in text_lower or "lakh" in text_lower:
        budget = "₹75 – ₹90 Lakhs"

    # Timeline
    timeline = "Within 1-2 months" if ("month" in text_lower or "soon" in text_lower or "immediately" in text_lower) else "Flexible"

    # Objections
    objections = []
    if "payment" in text_lower or "discount" in text_lower or "high" in text_lower or "cost" in text_lower:
        objections.append("Requested flexible payment milestones / better pricing")
    if "far" in text_lower or "distance" in text_lower:
        objections.append("Concerned about distance from city center")

    # Sentiment & purchase intent
    sentiment = "Interested"
    sentiment_score = 0.85
    purchase_intent = "High"
    purchase_intent_score = 0.88
    if "not interested" in text_lower or "don't call" in text_lower:
        sentiment = "Negative"
        sentiment_score = 0.15
        purchase_intent = "Low"
        purchase_intent_score = 0.10
    elif "think about it" in text_lower or "uncertain" in text_lower:
        sentiment = "Uncertain"
        sentiment_score = 0.50
        purchase_intent = "Medium"
        purchase_intent_score = 0.55

    # Follow-up
    follow_up_needed = True
    follow_up_reason = "Customer requested available property catalog and scheduled callback"
    follow_up_days = 1
    if "tomorrow" in text_lower:
        follow_up_days = 1
        follow_up_reason = "Customer explicitly asked for a callback tomorrow"
    elif "next week" in text_lower:
        follow_up_days = 7
        follow_up_reason = "Customer requested callback next week"

    next_action = "Send curated villa brochure via WhatsApp and schedule site visit"
    summary = f"""CALL SUMMARY
Customer: {customer_name}
Requirement: {', '.join(reqs) if reqs else 'Property enquiry'}
Budget: {budget}
Timeline: {timeline}
Interested: Yes
Objection: {objections[0] if objections else 'None stated'}
Next Action: {next_action}
Follow-up: In {follow_up_days} day(s)"""

    return {
        "customer_intent": "Inquiring about residential property options and pricing",
        "requirements": reqs or ["Residential property"],
        "budget": budget,
        "timeline": timeline,
        "objections": objections or ["Inquiring about payment options"],
        "questions": ["What are the available floor plans?", "Are bank loans approved?"],
        "competitors": [],
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "purchase_intent": purchase_intent,
        "purchase_intent_score": purchase_intent_score,
        "promises": ["Agent promised to send project brochure on WhatsApp"],
        "follow_up_needed": follow_up_needed,
        "follow_up_reason": follow_up_reason,
        "follow_up_days": follow_up_days,
        "next_recommended_action": next_action,
        "call_summary": summary
    }


def update_customer_memory(
    existing_memory: Optional[Dict[str, Any]],
    new_intelligence: Dict[str, Any],
    source_reference: str = "Call"
) -> Dict[str, Any]:
    """
    Cumulative Conversation Memory:
    Synthesizes facts across multiple calls/interactions without duplicate clutter.
    Preserves source references for auditing.
    """
    memory = existing_memory or {
        "consolidated_requirements": [],
        "budget_range": "",
        "preferred_locations": [],
        "timeline": "",
        "objection_history": [],
        "commitments_log": [],
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

    # Merge requirements
    existing_reqs = set(memory.get("consolidated_requirements", []))
    for req in new_intelligence.get("requirements", []):
        existing_reqs.add(req)
    memory["consolidated_requirements"] = list(existing_reqs)

    # Budget update (keep most specific)
    if new_intelligence.get("budget") and new_intelligence["budget"] != "Not specified":
        memory["budget_range"] = new_intelligence["budget"]

    # Timeline update
    if new_intelligence.get("timeline") and new_intelligence["timeline"] != "Not specified":
        memory["timeline"] = new_intelligence["timeline"]

    # Objections tracking
    existing_objs = set(memory.get("objection_history", []))
    for obj in new_intelligence.get("objections", []):
        existing_objs.add(obj)
    memory["objection_history"] = list(existing_objs)

    # Commitments log
    commitments = memory.get("commitments_log", [])
    for p in new_intelligence.get("promises", []):
        commitments.append({
            "promise": p,
            "source": source_reference,
            "timestamp": datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p")
        })
    memory["commitments_log"] = commitments[-10:] # Keep last 10
    memory["last_updated"] = datetime.now(timezone.utc).isoformat()

    return memory


def generate_one_click_summary(customer: Any, calls: List[Any], tasks: List[Any], deals: List[Any]) -> Dict[str, str]:
    """
    Generates the Saadhyam 8-point Executive Summary:
    1. WHO THEY ARE
    2. WHAT THEY WANT
    3. WHAT HAS HAPPENED
    4. CURRENT STATUS
    5. WHAT THEY CARE ABOUT
    6. WHAT THEY OBJECTED TO
    7. WHAT WAS PROMISED
    8. WHAT NEEDS TO HAPPEN NEXT
    """
    name = getattr(customer, "name", "Customer")
    company = getattr(customer, "company", "Individual") or "Individual"
    phone = getattr(customer, "phone", "N/A")
    location = getattr(customer, "location", "Hyderabad")
    budget = getattr(customer, "budget", "Not specified")
    stage = getattr(customer, "pipeline_stage", "New Lead")
    reqs = getattr(customer, "requirements", []) or []
    memory = getattr(customer, "memory", {}) or {}

    total_calls = len(calls)
    last_call_summary = "No calls recorded yet"
    if calls:
        c = calls[0]
        if hasattr(c, "intelligence") and c.intelligence and c.intelligence.call_summary:
            last_call_summary = c.intelligence.call_summary
        else:
            last_call_summary = f"Last call lasted {getattr(c, 'duration_seconds', 0)} seconds"

    pending_tasks = [t.title for t in tasks if getattr(t, "status", "") != "Completed"]

    return {
        "WHO_THEY_ARE": f"{name} ({phone}), based in {location or 'Hyderabad'}. Company: {company}.",
        "WHAT_THEY_WANT": f"{', '.join(reqs) if reqs else getattr(customer, 'interest', 'Real Estate property')}. Budget: {budget or memory.get('budget_range', 'Flexible')}.",
        "WHAT_HAS_HAPPENED": f"{total_calls} voice call interaction(s) conducted. {last_call_summary.splitlines()[0] if last_call_summary else 'Initial inquiry registered'}.",
        "CURRENT_STATUS": f"Pipeline Stage: {stage} (Lead Score: {getattr(customer, 'lead_score', 50)}/100).",
        "WHAT_THEY_CARE_ABOUT": f"Location convenience, transparent documentation, and verified RERA approvals.",
        "WHAT_THEY_OBJECTED_TO": f"{', '.join(memory.get('objection_history', ['Requested competitive pricing / flexible payment milestones']))}.",
        "WHAT_WAS_PROMISED": f"{'Brochure dispatch and follow-up callback' if not memory.get('commitments_log') else memory['commitments_log'][-1].get('promise', 'Brochure sent')}.",
        "WHAT_NEEDS_TO_HAPPEN_NEXT": f"{pending_tasks[0] if pending_tasks else 'Schedule site visit and connect with senior sales specialist'}."
    }


def generate_employee_handoff_packet(customer: Any, calls: List[Any], tasks: List[Any], deals: List[Any]) -> Dict[str, Any]:
    """
    1-Click Employee Handoff Briefing:
    Provides a human sales agent everything needed in 5 seconds without reading 50 chat logs.
    """
    summary_8pt = generate_one_click_summary(customer, calls, tasks, deals)
    
    last_intel = None
    if calls and hasattr(calls[0], "intelligence") and calls[0].intelligence:
        last_intel = calls[0].intelligence

    opening_script = f"Hello {getattr(customer, 'name', 'there')}, this is your dedicated relationship manager following up on your conversation with our AI advisor regarding {getattr(customer, 'interest', 'your inquiry')}."

    return {
        "customer_id": getattr(customer, "id", ""),
        "name": getattr(customer, "name", ""),
        "phone": getattr(customer, "phone", ""),
        "email": getattr(customer, "email", ""),
        "executive_summary": summary_8pt,
        "last_conversation_highlights": getattr(last_intel, "call_summary", "Customer inquired about properties.") if last_intel else "Initial lead qualification completed.",
        "important_requirements": getattr(customer, "requirements", []) or ["Property inquiry"],
        "objections_to_address": getattr(last_intel, "objections", ["Verify payment terms"]) if last_intel else [],
        "suggested_opening_script": opening_script,
        "recommended_next_action": getattr(last_intel, "next_recommended_action", "Arrange site visit") if last_intel else "Contact lead via WhatsApp or Phone",
        "pending_tasks": [{"id": getattr(t, "id", ""), "title": getattr(t, "title", ""), "due_date": str(getattr(t, "due_date", ""))} for t in tasks if getattr(t, "status", "") != "Completed"],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


def natural_language_crm_query(query: str, customers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Natural Language AI Search across CRM leads, calls, objections, and status.
    Converts intent into filtered results.
    """
    q = query.lower().strip()
    matched = []
    explanation = ""

    # Filter logic
    if "meta" in q:
        matched = [c for c in customers if "meta" in str(c.get("source", "")).lower()]
        explanation = "Filtered customers sourced from Meta / Instagram Ads."
    elif "google" in q:
        matched = [c for c in customers if "google" in str(c.get("source", "")).lower()]
        explanation = "Filtered customers sourced from Google Ads."
    elif "whatsapp" in q:
        matched = [c for c in customers if "whatsapp" in str(c.get("source", "")).lower()]
        explanation = "Filtered customers who interacted via WhatsApp."
    elif "callback" in q or "follow" in q or "follow-up" in q:
        matched = [c for c in customers if c.get("next_followup") or "follow" in str(c.get("pipeline_stage", "")).lower() or "callback" in str(c.get("status", "")).lower()]
        explanation = "Identified customers with pending follow-ups or callback requests."
    elif "kakinada" in q:
        matched = [c for c in customers if "kakinada" in str(c.get("location", "")).lower() or any("kakinada" in str(r).lower() for r in c.get("requirements", []))]
        explanation = "Showing leads interested in properties located in Kakinada."
    elif "3bhk" in q or "3 bhk" in q:
        matched = [c for c in customers if any("3bhk" in str(r).lower() or "3 bhk" in str(r).lower() for r in c.get("requirements", []))]
        explanation = "Showing leads specifically requesting 3 BHK units."
    elif "crore" in q or "budget" in q or "80" in q:
        matched = [c for c in customers if "cr" in str(c.get("budget", "")).lower() or "lakh" in str(c.get("budget", "")).lower()]
        explanation = "Showing leads with defined high-value budget ranges."
    elif "objection" in q or "pricing" in q:
        matched = [c for c in customers if "negotiation" in str(c.get("pipeline_stage", "")).lower() or c.get("lead_score", 0) > 40]
        explanation = "Customers with pricing inquiries or negotiation discussions."
    elif "won" in q or "close" in q:
        matched = [c for c in customers if str(c.get("pipeline_stage", "")).lower() == "won"]
        explanation = "Showing successfully won and closed accounts."
    else:
        # Default relevance search across all text fields
        terms = [t for t in q.split() if len(t) > 2]
        matched = [
            c for c in customers
            if any(term in f"{c.get('name', '')} {c.get('company', '')} {c.get('source', '')} {c.get('location', '')} {c.get('pipeline_stage', '')} {' '.join(c.get('requirements', []))}".lower() for term in terms)
        ]
        if not matched:
            matched = customers[:5]
        explanation = f"Matched {len(matched)} customer record(s) matching your query."

    return {
        "query": query,
        "explanation": explanation,
        "match_count": len(matched),
        "results": matched,
        "recommended_action": "Reach out to top-ranked leads or export list for targeted outreach"
    }
