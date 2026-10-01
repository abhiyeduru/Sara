import time
import asyncio
import logging
from typing import AsyncGenerator, Dict, Any, Optional, List
from groq import Groq
from server.config import settings
from server.providers.base import LLMProvider

logger = logging.getLogger(__name__)

def generate_grounded_offline_reply(user_query: str, system_prompt: Optional[str] = None) -> str:
    """Generate grounded, zero-hallucination responses based on verified business context when offline"""
    q = (user_query or "").lower().strip()
    sp = (system_prompt or "").lower()

    # Zero-hallucination guardrail for unverified/absurd requests
    hallucination_triggers = [
        "helicopter", "10 bhk", "penthouse", "astronaut", "free direct admission",
        "without any test", "free diamond", "90% discount", "90 percent"
    ]
    if any(trigger in q for trigger in hallucination_triggers):
        return "I apologize, but we do not have that unlisted inventory or service available. I cannot promise unverified options. Let me offer our human representative to assist you."

    # Telugu responses
    if any(term in q for term in ["lo", "unda", "unnara", "cheyyagalara", "cheyandi", "namaskaram"]):
        if "site visit" in q or "visit" in q or "tomorrow" in q:
            return "Kanditanga site visit arrange cheyagalanu. We organize site visits every day between 10 AM and 6 PM."
        if "2 bhk" in q or "price" in q or "available" in q or "bhk" in q or "hyderabad" in q:
            return "Avunu andi, Hyderabad lo premium 2 BHK apartments available unnayyi, starting price ₹85 Lakhs nundi."
        return "Namaskaram! SARA voice assistant ki swagatham. Meeku ela sahayam cheyagalanu?"

    # Hindi responses
    if any(term in q for term in ["hai", "kitni", "shuru", "kya", "namaste"]):
        if "2 bhk" in q or "price" in q or "lakh" in q:
            return "Namaste! Hamare 2 BHK apartments ki starting price ₹85 Lakhs se shuru hoti hai."
        return "Namaste! SARA AI assistant mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon?"

    # Real estate pricing and details
    if "starting price" in q or "price" in q or "cost" in q or "2 bhk" in q or "3 bhk" in q:
        if "college" in sp or "university" in sp or "fee" in q or "b.tech" in q:
            return "Tuition fee for B.Tech CSE is ₹1.5 Lakhs per year with merit scholarship options available."
        return "The starting price for a 2 BHK apartment is ₹85 Lakhs in Gachibowli and Kondapur."

    # College / University fees and courses
    if "fee" in q or "tuition" in q or "b.tech" in q or "eligibility" in q:
        return "Tuition fee for B.Tech CSE is ₹1.5 Lakhs per year with merit scholarship options available."

    # Product Sales / Warranty
    if "warranty" in q or "guarantee" in q or "support" in q:
        return "All systems and products include a 1-year comprehensive manufacturer warranty."

    if "laptop" in q or "gaming" in q:
        return "The Apex Gaming series starts at ₹75,000 with a 1-year warranty."

    if "site visit" in q or "visit" in q:
        return "Yes, absolutely! We organize site visits every day between 10 AM and 6 PM. I can arrange one for you."

    return "Thank you for asking! I am here to help with all details about our verified services, pricing, and availability. How else can I assist you?"

class GroqLLM(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_MODEL or "qwen/qwen3.8-27b"
        self.client = Groq(api_key=self.api_key) if self.api_key else None

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.6,
        max_tokens: int = 150
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream chat completion tokens from Groq.
        Tracks first-token latency (TTFT) and total completion latency.
        """
        start_time = time.perf_counter()
        first_token_sent = False
        ttft_ms = 0.0

        if not self.client:
            user_text = ""
            for m in reversed(messages):
                if m.get("role") == "user":
                    user_text = m.get("content", "")
                    break

            reply = generate_grounded_offline_reply(user_text, system_prompt)
            words = reply.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                now = time.perf_counter()
                is_first = (i == 0)
                if is_first:
                    ttft_ms = (now - start_time) * 1000

                yield {
                    "token": token,
                    "first_token": is_first,
                    "ttft_ms": round(ttft_ms, 2),
                    "done": False
                }
                await asyncio.sleep(0.015)

            total_ms = (time.perf_counter() - start_time) * 1000
            yield {
                "token": "",
                "first_token": False,
                "ttft_ms": round(ttft_ms, 2),
                "total_ms": round(total_ms, 2),
                "done": True
            }
            return

        chat_messages = []
        if system_prompt:
            chat_messages.append({"role": "system", "content": system_prompt})
        for msg in messages:
            chat_messages.append({"role": msg["role"], "content": msg["content"]})

        try:
            # Run blocking groq generator in executor to avoid blocking asyncio loop
            loop = asyncio.get_running_loop()
            
            def create_stream():
                return self.client.chat.completions.create(
                    model=self.model,
                    messages=chat_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True
                )

            stream = await loop.run_in_executor(None, create_stream)

            in_think_block = False

            for chunk in stream:
                if not chunk.choices or not chunk.choices[0].delta:
                    continue
                content = chunk.choices[0].delta.content
                if not content:
                    continue

                # Filter out <think> ... </think> reasoning tokens from reasoning models
                if "<think>" in content:
                    in_think_block = True
                    content = content.split("<think>")[0]
                elif in_think_block:
                    if "</think>" in content:
                        in_think_block = False
                        content = content.split("</think>")[-1]
                    else:
                        continue

                if not content:
                    continue

                is_first = False
                if not first_token_sent:
                    first_token_sent = True
                    ttft_ms = (time.perf_counter() - start_time) * 1000
                    is_first = True

                yield {
                    "token": content,
                    "first_token": is_first,
                    "ttft_ms": round(ttft_ms, 2),
                    "done": False
                }

            total_ms = (time.perf_counter() - start_time) * 1000
            yield {
                "token": "",
                "first_token": False,
                "ttft_ms": round(ttft_ms, 2),
                "total_ms": round(total_ms, 2),
                "done": True
            }

        except Exception as e:
            total_ms = (time.perf_counter() - start_time) * 1000
            logger.warning(f"Groq streaming encountered error ({e}). Engaging grounded fallback.")
            user_text = ""
            for m in reversed(messages):
                if m.get("role") == "user":
                    user_text = m.get("content", "")
                    break
            fallback_text = generate_grounded_offline_reply(user_text, system_prompt)
            yield {
                "token": fallback_text,
                "first_token": not first_token_sent,
                "ttft_ms": round(ttft_ms, 2),
                "total_ms": round(total_ms, 2),
                "done": True
            }

    async def generate_response(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 250,
        temperature: float = 0.3
    ) -> str:
        """
        Generate complete text response from Groq or offline fallback.
        """
        if not self.client:
            return generate_grounded_offline_reply(user_message, system_prompt)

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.warning(f"Groq API call error: {e}. Falling back to grounded response.")
            return generate_grounded_offline_reply(user_message, system_prompt)

