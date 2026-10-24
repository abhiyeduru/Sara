"""
SARA AI — Google Gemini LLM Provider
Ultra-low latency streaming conversational intelligence powered by Google Gemini.
Supports gemini-flash-latest / gemini-flash-lite-latest with system instructions and SSE streaming.
"""
import time
import json
import logging
import asyncio
from typing import AsyncGenerator, Dict, Any, Optional, List
import requests
import httpx
from server.config import settings
from server.providers.base import LLMProvider

logger = logging.getLogger("sara.providers.gemini")


def generate_grounded_offline_reply(user_query: str, system_prompt: Optional[str] = None) -> str:
    """Generate concise grounded responses when LLM is temporarily unavailable or rate-limited."""
    q = (user_query or "").lower().strip()
    sp = (system_prompt or "").lower()
    is_telugu = any(ch in q for ch in ["హ", "ల", "న", "ద", "ర", "మ", "క", "య", "ం", "ు", "ి", "్", "ా", "ె", "ే", "ొ", "ో", "బ", "ప", "ట", "డ"]) or any(t in q for t in ["andi", "garu", "cheppandi", "enti", "unda", "unnara", "namaste", "namaskaram", "hello", "sara"]) or ("telugu" in sp or "te" in sp)

    # Check caller title accurately from prompt directives, avoiding matching assistant gender
    title = "సార్"
    if 'required caller title: "మేడం"' in sp or 'caller gender: female' in sp:
        title = "మేడం"
    elif 'required caller title: "సార్"' in sp or 'caller gender: male' in sp:
        title = "సార్"
    elif "మేడం" in sp and "సార్" not in sp:
        title = "మేడం"

    # User explicitly corrects gender in speech
    if any(k in q for k in ["మేడం కాదు", "madam కాదు", "sir నేను", "సార్ నేను", "నేను సార్", "సర్ నేను"]):
        return "క్షమించండి సార్, తప్పకుండా సార్. చెప్పండి, నేను వింటున్నాను."
    if any(k in q for k in ["సార్ కాదు", "sir కాదు", "మేడం నేను", "నేను మేడం", "మేడం ని"]):
        return "క్షమించండి మేడం, తప్పకుండా మేడం. చెప్పండి, నేను వింటున్నాను."

    # Dynamically extract business profile from system_prompt
    import re
    biz_match = re.search(r"Business Name:\s*([^\n\r]+)", sp, re.IGNORECASE) or re.search(r"representing\s*([^\n\r.]+)", sp, re.IGNORECASE)
    biz_name = biz_match.group(1).strip() if biz_match else "our business"

    services_match = re.search(r"Products & Services Offered[^:]*:\s*([^\n\r]+)", sp, re.IGNORECASE)
    services_str = services_match.group(1).strip() if services_match else ""

    locations_match = re.search(r"Service Areas / Locations:\s*([^\n\r]+)", sp, re.IGNORECASE)
    locations_str = locations_match.group(1).strip() if locations_match else ""

    hours_match = re.search(r"Operating Hours:\s*([^\n\r]+)", sp, re.IGNORECASE)
    operating_hours = hours_match.group(1).strip() if hours_match else "09:00 AM to 08:00 PM"

    # 1. Office Hours / Timings / Schedule
    if any(t in q for t in ["టైమ్", "టైమింగ్", "సమయం", "ఎప్పుడు", "time", "timing", "hours", "schedule", "work hours", "working days", "ఆఫీస్"]):
        return f"మా పని వేళలు {operating_hours} వరకు అందుబాటులో ఉంటాయి {title}. మీకు ఏ సమయం అనుకూలంగా ఉంటుంది?" if is_telugu else f"Our business hours are {operating_hours}. What time works best for you?"

    # 2. Location / Address / Distance
    if any(t in q for t in ["లొకేషన్", "ఎక్కడ", "అడ్రస్", "ప్లేస్", "ప్రాంతం", "location", "address", "where", "area", "place"]):
        loc_display = locations_str or "మా బ్రాంచ్ కార్యాలయం"
        return f"మా సేవలు మరియు కార్యాలయం {loc_display} పరిధిలో అందుబాటులో ఉన్నాయి {title}." if is_telugu else f"Our office and services are located in {locations_str or 'our prime center'}."

    # 3. Appointments / Consultations / Meetings
    if any(t in q for t in ["విజిట్", "కలవడం", "మీటింగ్", "అపాయింట్", "రావడం", "visit", "meeting", "appointment", "consultation"]):
        return f"తప్పకుండా {title}, మా టీమ్‌తో కన్సల్టేషన్ లేదా అపాయింట్‌మెంట్ ఏర్పాటు చేస్తాము. మీకు ఎప్పుడు అనుకూలంగా ఉంటుంది {title}?" if is_telugu else "Certainly! We can schedule a dedicated appointment or consultation. What day and time suits you best?"

    # 4. Offers / Discounts / Deals
    if any(t in q for t in ["ఆఫర్", "డిస్కౌంట్", "తగ్గింపు", "offer", "discount", "deal", "concession"]):
        return f"అవును {title}, ప్రస్తుతం మా వద్ద ప్రత్యేక ప్యాకేజీలు మరియు ఆఫర్లు అందుబాటులో ఉన్నాయి {title}!" if is_telugu else "Yes! We currently have attractive packages and special introductory offers available."

    # 5. Pricing / Budget / Cost / Offerings
    if any(t in q for t in ["price", "cost", "budget", "entha", "rate", "ధర", "బడ్జెట్", "ఎంత", "ఖరీదు", "సర్వీస్", "సేవలు"]):
        if services_str:
            return f"మా వద్ద {services_str} అందుబాటులో ఉన్నాయి {title}. మీ అవసరానికి తగిన వివరాలు ఇప్పుడే పంచుకుంటాను." if is_telugu else f"We offer {services_str}. I would be glad to share complete package details based on your requirement."
        return f"మా వద్ద అనుకూలమైన ధరలు మరియు ప్యాకేజీలు అందుబాటులో ఉన్నాయి {title}. మీ అవసరం గురించి మరింత వివరంగా చెప్తారా?" if is_telugu else "We have tailored packages at attractive pricing. Could you share more about your exact requirement?"

    # 6. Reason for Calling / "Why did you call?"
    if any(t in q for t in ["ఎందుకు కాల్", "ఎందుకు ఫోన్", "దేనికి", "why call", "why did you call", "calling"]):
        return f"మీరు మా {biz_name} సేవల గురించి విచారించారు కదా {title}, ఆ వివరాలు తెలియజేయడానికే కాల్ చేశాను!" if is_telugu else f"I called to share details regarding your enquiry about {biz_name}."

    # 7. Greetings / Identity
    if any(t in q for t in ["hello", "hi", "హలో", "నమస్కారం", "who", "evaru", "ఎవరు", "సారా", "sara", "చెప్పండి"]):
        return f"నమస్కారం {title}! నేను {biz_name} నుండి మాట్లాడుతున్నాను. మీకు ఏ విధంగా సహాయం చేయగలను?" if is_telugu else f"Hello! This is calling from {biz_name}. How can I assist you today?"

    # 8. Payment / Banking / Next Steps
    if any(t in q for t in ["పేమెంట్", "payment", "డబ్బులు", "pay", "బుకింగ్", "booking", "చేరడం"]):
        return f"అవును {title}, అన్ని రకాల సులభమైన పేమెంట్ పద్ధతులు మరియు ఆన్‌లైన్ సదుపాయం అందుబాటులో ఉంది." if is_telugu else "Yes, convenient payment options and easy booking are readily available."

    # 9. Audibility / "Are you listening?"
    if any(t in q for t in ["వినపడటం", "వినటం", "వినిపించ", "వింటున్నారా", "విను", "వినండి", "ఆగండి", "ఆగు", "నిమిషం", "ఒక్క నిమిషం", "మాట", "listen", "hear", "wait", "hold"]):
        return f"హలో {title}! నేను వింటున్నాను, చెప్పండి {title}." if is_telugu else f"Hello! Yes, I am listening, please go ahead."

    # 10. Affirmative / Working / Okay / Thanks
    if any(t in q for t in ["వర్క్", "work", "అవుతుంది", "ok", "సరే", "బాగుంది", "థాంక్స్", "ధన్యవాదాలు"]):
        return f"చాలా సంతోషం {title}! ఇంకా మీకు దీని గురించి ఏమైనా సందేహాలు ఉన్నాయా?" if is_telugu else "Great! Do you have any other questions I can help with?"

    if is_telugu:
        return f"ఖచ్చితంగా {title}, నేను పూర్తి సహాయం చేస్తాను. మీ వివరాలు చెప్పండి."
    return "Certainly! Please let me know how I can assist you."


class GeminiLLM(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or getattr(settings, "GEMINI_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
        self.model = model or getattr(settings, "GEMINI_MODEL", "gemini-3.6-flash")
        # Ensure model name does not repeat models/ prefix
        if self.model.startswith("models/"):
            self.model = self.model[len("models/"):]
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(6.0, connect=3.0),
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=50, keepalive_expiry=60.0),
                http2=False
            )
        return self._client

    def _format_gemini_payload(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 180,
        temperature: float = 0.6,
        model_name: str = "gemini-3.6-flash"
    ) -> Dict[str, Any]:
        """Convert chat messages into Google Gemini API request format."""
        contents = []
        for msg in messages:
            role = "model" if msg.get("role") in ["assistant", "model"] else "user"
            text = msg.get("content", "").strip()
            if text:
                contents.append({
                    "role": role,
                    "parts": [{"text": text}]
                })

        # Gemini requires at least one content entry
        if not contents:
            contents = [{"role": "user", "parts": [{"text": "Hello"}]}]

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            }
        }

        # Disable thinking overhead on models that support it (2.5 & 3.x)
        if any(v in model_name for v in ["gemini-3", "gemini-2.5"]):
            payload["generationConfig"]["thinkingConfig"] = {
                "thinkingBudget": 0
            }

        if system_prompt:
            payload["system_instruction"] = {
                "parts": [{"text": system_prompt}]
            }

        return payload

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.6,
        max_tokens: int = 180
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream chat tokens from Google Gemini via Server-Sent Events (SSE).
        Yields chunks with: {'token': str, 'first_token': bool, 'ttft_ms': float, 'done': bool}
        """
        start_time = time.perf_counter()
        first_token_sent = False
        ttft_ms = 0.0

        if not self.api_key:
            logger.warning("Gemini API key missing. Using grounded offline response.")
            user_text = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
            reply = generate_grounded_offline_reply(user_text, system_prompt)
            yield {
                "token": reply,
                "first_token": True,
                "ttft_ms": 10.0,
                "done": True
            }
            return

        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key
        }

        # For ultra-low latency conversational Telugu (<400ms response time),
        # prioritize Sarvam 105B streaming conversational LLM first, followed by Gemini
        sarvam_key = getattr(settings, "SARVAM_API_KEY", None)
        client = await self._get_client()
        succeeded = False

        if sarvam_key:
            try:
                s_messages = []
                if system_prompt:
                    s_messages.append({"role": "system", "content": system_prompt})
                s_messages.extend(messages)
                s_payload = {
                    "model": "sarvam-105b-conversations",
                    "messages": s_messages,
                    "max_tokens": max_tokens or 45,
                    "temperature": temperature or 0.3,
                    "stream": True
                }
                s_headers = {
                    "api-subscription-key": sarvam_key,
                    "Content-Type": "application/json"
                }
                async with client.stream(
                    "POST",
                    "https://api.sarvam.ai/v1/chat/completions",
                    headers=s_headers,
                    json=s_payload,
                    timeout=httpx.Timeout(6.0, connect=3.0)
                ) as s_resp:
                    if s_resp.status_code == 200:
                        async for s_line in s_resp.aiter_lines():
                            if s_line.startswith("data: "):
                                s_chunk = s_line[6:].strip()
                                if s_chunk == "[DONE]":
                                    break
                                try:
                                    s_data = json.loads(s_chunk)
                                    s_delta = s_data["choices"][0]["delta"].get("content", "")
                                    if s_delta:
                                        is_first = False
                                        if not first_token_sent:
                                            first_token_sent = True
                                            ttft_ms = (time.perf_counter() - start_time) * 1000
                                            is_first = True
                                        yield {
                                            "token": s_delta,
                                            "first_token": is_first,
                                            "ttft_ms": round(ttft_ms, 2),
                                            "done": False
                                        }
                                        succeeded = True
                                except Exception:
                                    continue
                        if succeeded:
                            total_ms = (time.perf_counter() - start_time) * 1000
                            yield {
                                "token": "",
                                "first_token": False,
                                "ttft_ms": round(ttft_ms, 2),
                                "total_ms": round(total_ms, 2),
                                "done": True
                            }
                            return
            except Exception as sarvam_err:
                logger.warning(f"Sarvam 105B streaming notice: {sarvam_err}. Falling back to Gemini...")

        # Fallback to Google Gemini
        models_to_try = [self.model]
        for alt in ["gemini-3.6-flash", "gemini-3-flash-preview"]:
            if alt not in models_to_try:
                models_to_try.append(alt)

        for current_model in models_to_try[:2]:
            payload = self._format_gemini_payload(
                messages=messages,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                model_name=current_model
            )
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:streamGenerateContent?alt=sse"
            model_yielded_token = False
            try:
                async with client.stream("POST", url, headers=headers, json=payload, timeout=httpx.Timeout(5.0, connect=2.0)) as resp:
                    if resp.status_code == 429:
                        logger.warning(f"Gemini {current_model} returned 429 rate limit. Trying next model...")
                        continue
                    if resp.status_code != 200:
                        logger.warning(f"Gemini {current_model} returned status {resp.status_code}. Trying alternative...")
                        continue

                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            raw_data = line[6:].strip()
                            if not raw_data:
                                continue
                            try:
                                parsed = json.loads(raw_data)
                                candidates = parsed.get("candidates", [])
                                if candidates and "content" in candidates[0]:
                                    parts = candidates[0]["content"].get("parts", [])
                                    for p in parts:
                                        token_text = p.get("text", "")
                                        if token_text:
                                            model_yielded_token = True
                                            is_first = False
                                            if not first_token_sent:
                                                first_token_sent = True
                                                ttft_ms = (time.perf_counter() - start_time) * 1000
                                                is_first = True

                                            yield {
                                                "token": token_text,
                                                "first_token": is_first,
                                                "ttft_ms": round(ttft_ms, 2),
                                                "done": False
                                            }
                            except Exception:
                                continue

                    if model_yielded_token:
                        total_ms = (time.perf_counter() - start_time) * 1000
                        yield {
                            "token": "",
                            "first_token": False,
                            "ttft_ms": round(ttft_ms, 2),
                            "total_ms": round(total_ms, 2),
                            "done": True
                        }
                        succeeded = True
                        break
                    else:
                        logger.warning(f"Gemini {current_model} produced no text tokens. Trying alternative...")

            except Exception as stream_err:
                logger.warning(f"Error reading Gemini stream for {current_model} ({stream_err}). Trying fallback...")
                continue

        if not succeeded:
            # Secondary dynamic fallback: Sarvam 105B Indic LLM
            sarvam_key = getattr(settings, "SARVAM_API_KEY", None)
            if sarvam_key:
                try:
                    s_messages = []
                    if system_prompt:
                        s_messages.append({"role": "system", "content": system_prompt})
                    s_messages.extend(messages)
                    s_resp = await client.post(
                        "https://api.sarvam.ai/v1/chat/completions",
                        headers={"api-subscription-key": sarvam_key, "Content-Type": "application/json"},
                        json={
                            "model": "sarvam-105b",
                            "messages": s_messages,
                            "reasoning_effort": None,
                            "max_tokens": max_tokens,
                            "temperature": temperature
                        },
                        timeout=httpx.Timeout(3.5, connect=1.5)
                    )
                    if s_resp.status_code == 200:
                        s_data = s_resp.json()
                        s_ans = (s_data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
                        if s_ans:
                            logger.info(f"Dynamic fallback answered via Sarvam-105B: {s_ans[:50]}...")
                            yield {
                                "token": s_ans,
                                "first_token": not first_token_sent,
                                "ttft_ms": round((time.perf_counter() - start_time) * 1000, 2),
                                "total_ms": round((time.perf_counter() - start_time) * 1000, 2),
                                "done": True
                            }
                            succeeded = True
                except Exception as s_err:
                    logger.warning(f"Sarvam LLM fallback error: {s_err}")

        if not succeeded:
            # Fallback to grounded reply
            user_text = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
            fallback = generate_grounded_offline_reply(user_text, system_prompt)
            yield {
                "token": fallback,
                "first_token": not first_token_sent,
                "ttft_ms": round(ttft_ms or 50.0, 2),
                "total_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "done": True
            }

    async def generate_response(
        self,
        *args,
        system_prompt: Optional[str] = None,
        user_message: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        max_tokens: int = 250,
        temperature: float = 0.3,
        **kwargs
    ) -> str:
        """Generate non-streaming text response from Gemini supporting flexible calling signatures."""
        actual_sys_prompt = system_prompt
        actual_messages = messages or []

        if len(args) == 2:
            if isinstance(args[0], list):
                actual_messages = args[0]
                actual_sys_prompt = str(args[1])
            else:
                actual_sys_prompt = str(args[0])
                actual_messages = [{"role": "user", "content": str(args[1])}]
        elif len(args) == 1:
            if isinstance(args[0], list):
                actual_messages = args[0]
            elif isinstance(args[0], str):
                actual_messages = [{"role": "user", "content": args[0]}]

        if user_message and not actual_messages:
            actual_messages = [{"role": "user", "content": user_message}]

        tokens: List[str] = []
        async for chunk in self.stream_chat(
            messages=actual_messages,
            system_prompt=actual_sys_prompt,
            temperature=temperature,
            max_tokens=max_tokens
        ):
            tok = chunk.get("token", "")
            if tok:
                tokens.append(tok)
        return "".join(tokens).strip()

    async def generate_call_summary(self, transcript_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate structured call summary, sentiment, and action items using Gemini."""
        if not transcript_history:
            return {
                "summary": "Short call with no conversation recorded.",
                "sentiment": "Neutral",
                "intent": "Unknown",
                "action_items": []
            }

        lines = [f"{t.get('speaker', t.get('role', 'Speaker'))}: {t.get('text', '')}" for t in transcript_history if t.get('text')]
        conversation_text = "\n".join(lines)

        prompt = (
            "Analyze this real estate voice call transcript and respond with valid JSON containing:\n"
            "- summary: A concise 2-sentence summary of the conversation\n"
            "- sentiment: Positive, Neutral, or Negative\n"
            "- intent: Buying, Investment, Inquiry, or Not Interested\n"
            "- action_items: list of strings (next steps)\n\n"
            f"Transcript:\n{conversation_text}\n\nRespond ONLY with valid JSON."
        )

        try:
            resp = await self.generate_response(
                system_prompt="You are an AI assistant summarizing business voice calls. Output JSON only.",
                user_message=prompt,
                max_tokens=250,
                temperature=0.2
            )
            import re
            m = re.search(r"\{.*\}", resp, re.DOTALL)
            if m:
                return json.loads(m.group(0))
        except Exception as e:
            logger.warning(f"Error generating call summary with Gemini: {e}")

        return {
            "summary": "Customer engaged in discussion regarding properties.",
            "sentiment": "Positive",
            "intent": "Property Inquiry",
            "action_items": ["Follow up on WhatsApp with property details"]
        }
