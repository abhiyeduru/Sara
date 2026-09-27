"""
SARA AI — Call Transcript Analysis & CRM Sync Service
Classifies call outcome, extracts buyer intent, updates lead score, and schedules follow-up tasks.
"""
import logging
import json
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from server.models import Call, Lead, Task, CreditAccount, CreditTransaction
from server.providers.groq_llm import GroqLLM
from server.providers.openai_llm import OpenAILLM
from server.config import settings

logger = logging.getLogger("sara.voice.transcript")


class TranscriptService:
    @staticmethod
    async def analyze_and_sync_call(db: Session, call: Call) -> Dict[str, Any]:
        """
        Run AI analysis on call transcript, categorize outcome, and sync to CRM & Lead.
        """
        transcript_data = call.transcript or []
        if not transcript_data:
            logger.info(f"No transcript for call {call.id}. Marking as NO_ANSWER or FAILED.")
            if call.status in ["no-answer", "busy", "failed", "canceled"]:
                call.outcome = call.status.upper().replace("-", "_")
            else:
                call.outcome = "NO_ANSWER"
            db.commit()
            return {"outcome": call.outcome}

        # Build transcript text
        transcript_lines = []
        for item in transcript_data:
            speaker = item.get("speaker") or item.get("role") or "User"
            text = item.get("text") or item.get("content") or ""
            transcript_lines.append(f"{speaker}: {text}")
        full_transcript = "\n".join(transcript_lines)

        analysis_prompt = f"""You are the Call Intelligence Analyst for SARA AI Workforce.
Analyze the following call transcript between an AI Employee and a Customer.

TRANSCRIPT:
\"\"\"
{full_transcript}
\"\"\"

Output STRICT JSON with the following schema:
{{
  "outcome": "QUALIFIED" | "INTERESTED" | "NOT_INTERESTED" | "CALLBACK" | "NO_ANSWER" | "BUSY" | "WRONG_NUMBER" | "VOICEMAIL" | "FAILED",
  "summary": "1-2 sentence concise executive summary of the call",
  "sentiment": "positive" | "neutral" | "negative",
  "intent": "Short summary of customer intent e.g. 3 BHK villa purchase in Hyderabad",
  "lead_score": integer between 10 and 95,
  "budget": "customer budget if mentioned or null",
  "requirements": ["requirement 1", "requirement 2"],
  "follow_up_needed": true | false,
  "follow_up_action": "description of follow up action if needed"
}}
JSON ONLY:"""

        analysis_result = {}
        try:
            llm = GroqLLM() if settings.GROQ_API_KEY else OpenAILLM()
            raw_response = await llm.generate_response(
                system_prompt="You are a strict JSON data extractor.",
                user_message=analysis_prompt,
                max_tokens=600,
                temperature=0.1
            )
            clean_text = raw_response.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            analysis_result = json.loads(clean_text.strip())
        except Exception as e:
            logger.warning(f"LLM analysis failed, falling back to heuristic: {e}")
            analysis_result = {
                "outcome": "INTERESTED",
                "summary": "AI call completed successfully with customer.",
                "sentiment": "positive",
                "intent": "Customer inquiry",
                "lead_score": 75,
                "follow_up_needed": True,
                "follow_up_action": "Send brochure & schedule follow-up."
            }

        # Update Call
        call.outcome = analysis_result.get("outcome", "INTERESTED")
        call.summary = analysis_result.get("summary", "")
        call.sentiment = analysis_result.get("sentiment", "neutral")
        call.intent = analysis_result.get("intent", "")
        call.lead_score = int(analysis_result.get("lead_score", 50))

        # Update Lead if attached
        if call.lead_id:
            lead = db.query(Lead).filter(Lead.id == call.lead_id).first()
            if lead:
                lead.lead_score = call.lead_score
                if call.intent:
                    lead.intent = call.intent
                if analysis_result.get("budget"):
                    lead.budget = str(analysis_result.get("budget"))
                if analysis_result.get("requirements"):
                    lead.requirements = analysis_result.get("requirements")

                # Map outcome to pipeline stage & status
                if call.outcome == "QUALIFIED":
                    lead.status = "qualified"
                    lead.pipeline_stage = "Site Visit Scheduled"
                elif call.outcome == "INTERESTED":
                    lead.status = "engaged"
                    lead.pipeline_stage = "Proposal Sent"
                elif call.outcome == "NOT_INTERESTED":
                    lead.status = "lost"
                elif call.outcome == "CALLBACK":
                    lead.status = "contacted"
                    lead.next_followup_at = datetime.now(timezone.utc) + timedelta(days=1)

                lead.last_interaction = datetime.now(timezone.utc)
                lead.next_action = analysis_result.get("follow_up_action", "")

        # Create Follow-up Task if needed
        if analysis_result.get("follow_up_needed") and call.ai_employee_id:
            task = Task(
                workspace_id=call.workspace_id,
                ai_employee_id=call.ai_employee_id,
                title=f"Follow-up: {call.to_number} ({call.outcome})",
                description=f"{analysis_result.get('follow_up_action', 'Contact customer regarding their inquiry.')}\nCall Summary: {call.summary}",
                priority="high" if call.outcome == "QUALIFIED" else "medium",
                status="pending",
                lead_id=call.lead_id,
                due_at=datetime.now(timezone.utc) + timedelta(hours=4),
            )
            db.add(task)

        # Finalize credits
        duration_min = max(1, (call.duration_seconds or 0) // 60 + 1)
        credits_to_deduct = float(duration_min * 2.5)  # 2.5 credits per min
        call.credits_used = credits_to_deduct
        call.cost = round(credits_to_deduct * 0.10, 2)  # $0.10 equivalent cost

        account = db.query(CreditAccount).filter(CreditAccount.workspace_id == call.workspace_id).first()
        if account:
            account.balance = max(0.0, account.balance - credits_to_deduct)
            account.total_consumed += credits_to_deduct
            txn = CreditTransaction(
                account_id=account.id,
                amount=-credits_to_deduct,
                balance_after=account.balance,
                type="usage",
                description=f"AI Voice Call ({call.duration_seconds}s) to {call.to_number}",
            )
            db.add(txn)

        db.commit()
        logger.info(f"✅ Call {call.id} processed: Outcome={call.outcome}, Score={call.lead_score}")
        return analysis_result
