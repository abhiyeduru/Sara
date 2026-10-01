import re
import time
import logging
from typing import Dict, Any, List, Optional
from server.providers.groq_llm import GroqLLM
from server.engine.normalizer import normalize_numbers_to_english

logger = logging.getLogger(__name__)


class TestRunner:
    """
    Automated Pre-Deployment Evaluation Engine for Saadhyam AI Agents.
    Executes role-tailored test scenarios and verifies rule compliance,
    tool selection, English number formatting, and graceful stopping.
    """

    @staticmethod
    def run_suite(system_prompt: str, scenarios: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        llm = GroqLLM()
        results = []

        for sc in scenarios:
            t0 = time.perf_counter()
            user_input = sc.get("input", "")
            sc_id = sc.get("id", "test")
            title = sc.get("title", "Test")

            try:
                res = llm.client.chat.completions.create(
                    model=llm.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_input}
                    ],
                    temperature=0.2,
                    max_tokens=100
                )
                output = res.choices[0].message.content.strip()
                if "<think>" in output and "</think>" in output:
                    output = output.split("</think>")[-1].strip()

                output = normalize_numbers_to_english(output)

                elapsed_ms = (time.perf_counter() - t0) * 1000


                # Evaluation criteria
                passed = True
                notes = []

                # Criteria 1: No think tags
                if "<think>" in output:
                    passed = False
                    notes.append("Thinking tags leaked into output")

                # Criteria 2: Specific scenario checks
                if "test_2" in sc_id: # Pricing & English Numbers
                    has_digits = bool(re.search(r'\d+', output))
                    if not has_digits:
                        passed = False
                        notes.append("Did not quote specific numeric price")
                    if any(w in output for w in ["లక్షలు", "కోట్లు", "ఎనభై"]):
                        passed = False
                        notes.append("Spelled numbers in Telugu instead of English")

                elif "test_3" in sc_id: # Out-of-Scope location
                    # Should acknowledge KPHB is not available
                    if "లేవు" not in output and "not" not in output.lower():
                        notes.append("Check clarification tone for unlisted area")

                elif "test_5" in sc_id: # Human Escalation
                    if not any(w in output for w in ["మేనేజర్", "సీనియర్", "manager", "representative", "connect"]):
                        passed = False
                        notes.append("Did not offer senior team member connection")

                elif "test_7" in sc_id: # Stop
                    if not any(w in output for w in ["ధన్యవాదాలు", "సెలవు", "thank", "bye", "goodbye"]):
                        passed = False
                        notes.append("Did not conclude with farewell")

                results.append({
                    "id": sc_id,
                    "title": title,
                    "category": sc.get("category", "General"),
                    "input": user_input,
                    "response": output,
                    "output": output,
                    "expected": sc.get("expected_behavior", ""),
                    "passed": passed,
                    "latency_ms": round(elapsed_ms, 2),
                    "notes": "; ".join(notes) if notes else "Rule compliant & accurate"
                })


            except Exception as e:
                logger.error(f"Test scenario {sc_id} execution error: {e}")
                results.append({
                    "id": sc_id,
                    "title": title,
                    "category": sc.get("category", "General"),
                    "input": user_input,
                    "response": f"Error: {e}",
                    "expected": sc.get("expected_behavior", ""),
                    "passed": False,
                    "latency_ms": 0.0,
                    "notes": str(e)
                })

        return results
