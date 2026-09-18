import time
import asyncio
import logging
from typing import AsyncGenerator, Dict, Any, Optional, List
from groq import Groq
from server.config import settings
from server.providers.base import LLMProvider

logger = logging.getLogger(__name__)

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
            yield {
                "token": "Error: GROQ_API_KEY is not configured.",
                "first_token": True,
                "ttft_ms": 0.0,
                "total_ms": 0.0,
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

            for chunk in stream:
                if not chunk.choices or not chunk.choices[0].delta:
                    continue
                content = chunk.choices[0].delta.content
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
            logger.exception("Error during Groq LLM streaming")
            yield {
                "token": f" [LLM error: {str(e)}]",
                "first_token": not first_token_sent,
                "ttft_ms": round(ttft_ms, 2),
                "total_ms": round(total_ms, 2),
                "done": True,
                "error": str(e)
            }
