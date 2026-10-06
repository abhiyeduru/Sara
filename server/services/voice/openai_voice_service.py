"""
SARA AI — OpenAI Voice Intelligence Service
Official OpenAI API integration supporting streaming token generation,
tool execution (CRM, appointments, escalation, end call),
and prompt layering with tenant-scoped knowledge retrieval.
"""
import asyncio
import json
import logging
import ssl
import time
from typing import AsyncGenerator, Dict, Any, Optional, List, Tuple
import certifi
import httpx
from openai import AsyncOpenAI
from server.config import settings

logger = logging.getLogger("sara.voice.openai")

# Available tools schema for conversational voice bot
SARA_VOICE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_lead",
            "description": "Capture a qualified lead or customer inquiry into the CRM.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Customer's full name"},
                    "phone": {"type": "string", "description": "Phone number with country code"},
                    "email": {"type": "string", "description": "Email address if provided"},
                    "interest": {"type": "string", "description": "Customer requirement or property type (e.g., 2 BHK Gachibowli)"},
                    "budget": {"type": "string", "description": "Customer stated budget (e.g., 90 Lakhs)"},
                    "notes": {"type": "string", "description": "Any specific preferences or questions"}
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_appointment",
            "description": "Schedule a site visit, in-person consultation, or scheduled follow-up call.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string", "description": "Name of the customer"},
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD or readable format (e.g., Saturday this week)"},
                    "time": {"type": "string", "description": "Preferred time slot (e.g., 11:00 AM)"},
                    "appointment_type": {"type": "string", "enum": ["site_visit", "consultation", "callback"], "description": "Type of appointment"},
                    "notes": {"type": "string", "description": "Location or special requirements"}
                },
                "required": ["customer_name", "date", "time"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "transfer_to_human",
            "description": "Transfer the caller to a senior human executive or supervisor when requested or required.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Why the transfer is requested"},
                    "urgency": {"type": "string", "enum": ["low", "medium", "high"], "description": "Priority level"}
                },
                "required": ["reason"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "end_call",
            "description": "Gracefully finish the conversation and end the call when all questions are answered or customer says goodbye.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Reason for ending (e.g., customer_satisfied, completed, not_interested)"}
                }
            }
        }
    }
]


class OpenAIVoiceService:
    """
    OpenAI Intelligence Engine for Sara AI Voice Agents.
    Supports real-time token streaming, tool call extraction, and prompt safety policies.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.model = model or settings.OPENAI_MODEL or "gpt-4o-mini"
        self._is_cancelled = False

        http_client = httpx.AsyncClient(
            verify=certifi.where(),
            timeout=20.0,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
        self.client = AsyncOpenAI(api_key=self.api_key, http_client=http_client, max_retries=1) if self.api_key else None

    def cancel(self) -> None:
        """Cancel current streaming generation on user barge-in."""
        self._is_cancelled = True

    def reset_cancellation(self) -> None:
        self._is_cancelled = False

    async def stream_conversation_turn(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 250,
        enable_tools: bool = True
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream conversational turn tokens and detect function/tool calls.
        Yields dicts with:
        - {"type": "token", "token": str, "ttft_ms": float, "first_token": bool}
        - {"type": "tool_call", "name": str, "arguments": dict}
        - {"type": "done", "total_tokens": int, "total_ms": float}
        """
        self.reset_cancellation()
        start_time = time.perf_counter()
        first_token_sent = False
        ttft_ms = 0.0

        if not self.client:
            logger.error("OpenAI client not configured.")
            yield {"type": "error", "message": "OpenAI API key missing."}
            return

        chat_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            chat_messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        tool_calls_accumulator: Dict[int, Dict[str, Any]] = {}

        try:
            kwargs: Dict[str, Any] = {
                "model": self.model,
                "messages": chat_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,
            }
            if enable_tools:
                kwargs["tools"] = SARA_VOICE_TOOLS
                kwargs["tool_choice"] = "auto"

            stream = await self.client.chat.completions.create(**kwargs)

            async for chunk in stream:
                if self._is_cancelled:
                    logger.info("OpenAI turn stream aborted due to user interruption")
                    break

                if not chunk.choices or len(chunk.choices) == 0:
                    continue

                delta = chunk.choices[0].delta

                # Accumulate tool calls if any
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_accumulator:
                            tool_calls_accumulator[idx] = {"name": "", "arguments": ""}
                        if tc.function:
                            if tc.function.name:
                                tool_calls_accumulator[idx]["name"] += tc.function.name
                            if tc.function.arguments:
                                tool_calls_accumulator[idx]["arguments"] += tc.function.arguments

                # Stream standard text tokens
                content = getattr(delta, "content", None)
                if content:
                    is_first = False
                    if not first_token_sent:
                        first_token_sent = True
                        ttft_ms = (time.perf_counter() - start_time) * 1000
                        is_first = True

                    yield {
                        "type": "token",
                        "token": content,
                        "ttft_ms": round(ttft_ms, 2),
                        "first_token": is_first
                    }

            # If tool calls were generated, yield parsed tool calls
            for idx, tc_data in tool_calls_accumulator.items():
                fn_name = tc_data.get("name")
                args_str = tc_data.get("arguments", "{}")
                try:
                    args = json.loads(args_str)
                except Exception:
                    args = {"raw": args_str}

                yield {
                    "type": "tool_call",
                    "name": fn_name,
                    "arguments": args
                }

            total_ms = (time.perf_counter() - start_time) * 1000
            yield {
                "type": "done",
                "ttft_ms": round(ttft_ms, 2),
                "total_ms": round(total_ms, 2)
            }

        except Exception as e:
            err_msg = str(e)
            logger.warning(f"OpenAI completion error: {err_msg}")
            # If OpenAI credit quota is exhausted, yield clear error
            if "insufficient_quota" in err_msg or "credit_balance_exhausted" in err_msg or "429" in err_msg:
                yield {
                    "type": "error",
                    "code": "insufficient_quota",
                    "message": "OpenAI account has insufficient credit quota. Please add credits or update OPENAI_API_KEY."
                }
            else:
                yield {"type": "error", "code": "api_error", "message": err_msg}

    async def generate_call_summary(self, transcript_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate structured call summary, sentiment, outcome, and extracted lead data
        after a conversation concludes.
        """
        if not self.client or not transcript_items:
            return {
                "summary": "Call completed.",
                "sentiment": "Neutral",
                "intent": "General Inquiry",
                "outcome": "Inquiry Addressed",
                "lead_quality": 3,
                "action_items": []
            }

        convo_text = "\n".join([f"{item.get('speaker', 'Unknown')}: {item.get('text', '')}" for item in transcript_items])
        prompt = (
            "Analyze the following call transcript and produce a structured JSON report with keys:\n"
            "- summary: A 2-3 sentence executive summary\n"
            "- intent: Primary customer intent\n"
            "- outcome: Outcome of the call\n"
            "- sentiment: Customer sentiment (Positive, Neutral, or Negative)\n"
            "- lead_quality: Integer rating from 1 to 5\n"
            "- extracted_requirements: Budget, location, BHK, timeline\n"
            "- action_items: List of next follow-up tasks\n\n"
            f"Transcript:\n{convo_text}"
        )

        try:
            resp = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional call intelligence analyzer. Output valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            content = resp.choices[0].message.content or "{}"
            return json.loads(content)
        except Exception as e:
            logger.warning(f"Could not generate call summary via OpenAI: {e}. Falling back to Groq...")
            try:
                from server.providers.groq_llm import GroqLLM
                groq_llm = GroqLLM()
                if groq_llm.client:
                    loop = asyncio.get_running_loop()
                    def run_groq():
                        return groq_llm.client.chat.completions.create(
                            model=groq_llm.model,
                            messages=[
                                {"role": "system", "content": "You are a professional call intelligence analyzer. Output valid JSON only with keys: summary, sentiment, intent, outcome, lead_quality, extracted_requirements, action_items."},
                                {"role": "user", "content": prompt}
                            ],
                            temperature=0.2,
                            max_tokens=400,
                            response_format={"type": "json_object"}
                        )
                    g_resp = await loop.run_in_executor(None, run_groq)
                    g_text = g_resp.choices[0].message.content or "{}"
                    return json.loads(g_text)
            except Exception as ge:
                logger.warning(f"Groq summary fallback failed: {ge}")

            return {
                "summary": f"Completed conversation ({len(transcript_items)} turns).",
                "sentiment": "Positive",
                "intent": "Customer Inquiry",
                "outcome": "Engaged",
                "lead_quality": 4,
                "action_items": ["Send brochure", "Schedule follow-up"]
            }
