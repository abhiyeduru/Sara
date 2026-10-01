import time
import asyncio
import logging
from typing import AsyncGenerator, Dict, Any, Optional, List
from openai import AsyncOpenAI
from server.config import settings
from server.providers.base import LLMProvider
from server.providers.groq_llm import GroqLLM

logger = logging.getLogger(__name__)

class OpenAILLM(LLMProvider):
    """
    OpenAI LLM provider streaming GPT-4o-mini / GPT-4o tokens.
    Seamlessly falls back to Groq if OpenAI account runs out of credits (HTTP 429).
    """
    _openai_exhausted: bool = True
    _last_openai_check: float = 0.0

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.model = model or settings.OPENAI_MODEL or "gpt-4o-mini"
        self.client = AsyncOpenAI(api_key=self.api_key, max_retries=0) if self.api_key else None
        self.fallback_llm = GroqLLM()

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.5,
        max_tokens: int = 100
    ) -> AsyncGenerator[Dict[str, Any], None]:
        start_time = time.perf_counter()
        first_token_sent = False
        ttft_ms = 0.0

        # Fast Circuit Breaker: If OpenAI credits are exhausted, go directly to Groq (saving ~400ms TTFT)
        if OpenAILLM._openai_exhausted and (time.time() - OpenAILLM._last_openai_check < 300):
            async for chunk in self.fallback_llm.stream_chat(messages, system_prompt, temperature, max_tokens):
                yield chunk
            return

        if not self.client:
            logger.info("OpenAI API key not set, using Groq LLM directly")
            async for chunk in self.fallback_llm.stream_chat(messages, system_prompt, temperature, max_tokens):
                yield chunk
            return

        chat_messages = []
        if system_prompt:
            chat_messages.append({"role": "system", "content": system_prompt})
        for msg in messages:
            chat_messages.append({"role": msg["role"], "content": msg["content"]})

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=chat_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )

            async for chunk in stream:
                if not chunk.choices or len(chunk.choices) == 0:
                    continue
                delta = chunk.choices[0].delta
                content = getattr(delta, "content", None)
                if content:
                    is_first = False
                    if not first_token_sent:
                        first_token_sent = True
                        ttft_ms = (time.perf_counter() - start_time) * 1000
                        is_first = True

                    yield {
                        "token": content,
                        "first_token": is_first,
                        "ttft_ms": round(ttft_ms, 2),
                        "done": False,
                        "provider": "openai"
                    }

            total_ms = (time.perf_counter() - start_time) * 1000
            yield {
                "token": "",
                "first_token": False,
                "ttft_ms": round(ttft_ms, 2),
                "total_ms": round(total_ms, 2),
                "done": True,
                "provider": "openai"
            }

        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "insufficient_quota" in err_str or "credit_balance_exhausted" in err_str:
                OpenAILLM._openai_exhausted = True
                OpenAILLM._last_openai_check = time.time()
                logger.info("OpenAI credits exhausted. Circuit breaker engaged: routing directly to ultra-low-latency Groq LLM.")
            else:
                logger.warning(f"OpenAI error ({e}). Activating Groq LLM fallback...")
            # Fall back seamlessly to Groq so user speech is always answered immediately
            async for chunk in self.fallback_llm.stream_chat(messages, system_prompt, temperature, max_tokens):
                yield chunk
