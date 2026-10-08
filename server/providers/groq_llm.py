import time
import asyncio
import logging
from typing import AsyncGenerator, Dict, Any, Optional, List
from groq import Groq
from server.config import settings
from server.providers.base import LLMProvider

logger = logging.getLogger(__name__)

def generate_grounded_offline_reply(user_query: str, system_prompt: Optional[str] = None) -> str:
    """Generate concise (5-15 words) grounded responses when LLM is temporarily unavailable"""
    q = (user_query or "").lower().strip()
    sp = (system_prompt or "").lower()
    is_telugu = any(ch in q for ch in ["హ", "ల", "న", "ద", "ర", "మ", "క", "య", "ం", "ు", "ి"]) or any(t in q for t in ["andi", "garu", "cheppandi", "enti", "unda", "unnara", "namaste", "namaskaram", "hello"]) or ("telugu" in sp or "te" in sp)

    if "site visit" in q or "visit" in q:
        return "తప్పకుండా, ఈ weekend ఉచిత site visit ప్లాన్ చేద్దామా?" if is_telugu else "Sure! We can arrange a free site visit this weekend."

    if any(t in q for t in ["price", "cost", "budget", "entha", "rate"]):
        return "Shankarpally villa plots ₹20 లక్షల నుండి ఉన్నాయి. మీ బడ్జెట్ ఎంతండి?" if is_telugu else "Shankarpally plots start from ₹20 Lakhs. What is your budget?"

    if any(t in q for t in ["hello", "hi", "హలో", "who", "evaru", "cheppandi"]):
        return "హలో అండి! ABC Properties నుండి మాట్లాడుతున్నాను. మీ requirement చెప్పండి." if is_telugu else "Hello! Calling from ABC Properties. What property are you looking for?"

    if is_telugu:
        return "అవునండి, నేను వింటున్నాను. మీ requirement గురించి చెప్పండి."
    return "Yes, I am listening. What type of property are you looking for?"

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

