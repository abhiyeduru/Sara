import re
import json
import logging
from typing import Dict, Any, Optional
from server.providers.groq_llm import GroqLLM

logger = logging.getLogger(__name__)

class ContinuousTeacher:
    """
    Parses natural language teaching instructions from the business owner
    (e.g. 'From now on, don't offer properties below ₹50 lakhs',
          'Whenever a customer asks for a discount above 10%, send it to the sales manager')
    and compiles them into active business rules and workflow modifications.
    """

    @staticmethod
    def compile_instruction(natural_instruction: str, current_role: str = "Real Estate Agent") -> Dict[str, Any]:
        """Convert natural language instruction into a structured business rule or workflow action"""
        llm = GroqLLM()

        system_prompt = """You are the Saadhyam AI Continuous Teaching Engine.
Convert natural owner instructions into a precise structured rule or workflow modification.
Output valid JSON only with no markdown or think tags."""

        user_prompt = f"""Owner Instruction:
\"\"\"
{natural_instruction}
\"\"\"
Target Agent Role: {current_role}

Output strictly JSON:
{{
  "type": "business_rule | workflow_modification | permission_rule",
  "rule_text": "Clean, authoritative rule statement (e.g. Do not recommend properties priced below 50 Lakhs)",
  "rule_type": "behavior | restriction | safety | compliance",
  "category": "Pricing | Boundary | Approval | Operational",
  "workflow_condition": "e.g. Customer asks for discount > 10% (if applicable, else null)",
  "workflow_action": "e.g. Escalate to sales manager for approval (if applicable, else null)",
  "confirmation_message": "Friendly confirmation to the business owner explaining what was updated"
}}"""

        try:
            res = llm.client.chat.completions.create(
                model=llm.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=400
            )
            raw = res.choices[0].message.content.strip()
            if "<think>" in raw and "</think>" in raw:
                raw = raw.split("</think>")[-1].strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw)

            return json.loads(raw)
        except Exception as e:
            logger.warning(f"ContinuousTeacher fallback: {e}")
            clean = natural_instruction.replace("From now on,", "").replace("from now on,", "").strip()
            return {
                "type": "business_rule",
                "rule_text": clean,
                "rule_type": "restriction" if "don't" in clean.lower() or "never" in clean.lower() else "behavior",
                "category": "Operational",
                "workflow_condition": None,
                "workflow_action": None,
                "confirmation_message": f"Rule updated: '{clean}'"
            }
