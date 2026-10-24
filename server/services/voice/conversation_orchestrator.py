"""
SARA AI — Real-Time Conversation Orchestrator & State Machine
Coordinates Deepgram STT, OpenAI Intelligence, Cartesia Sonic TTS,
Barge-in / Speech Interruption, Tool Execution, and Latency Telemetry.
"""
import asyncio
import base64
import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Callable
from sqlalchemy.orm import Session

from server.config import settings
from server.models import (
    Call, AIEmployee, KnowledgeSource, KnowledgeDocument, Lead, Customer,
    ConversationSession, SessionMessage, LatencyMetric, CallEvent,
    Workspace, BusinessProfile, WorkspaceMember
)
from server.engine.chunker import SentenceChunker
from server.engine.normalizer import normalize_numbers_to_english, clean_for_speech
from server.services.voice.deepgram_service import DeepgramSTTService
from server.services.voice.audio_codec_service import AudioCodecService
from server.providers.sarvam_tts import SarvamTTS
from server.services.voice.cartesia_service import CartesiaTTSService
from server.providers.gemini_llm import GeminiLLM

logger = logging.getLogger("sara.voice.orchestrator")


class ConversationState:
    IDLE = "IDLE"
    LISTENING = "LISTENING"
    TRANSCRIBING = "TRANSCRIBING"
    THINKING = "THINKING"
    TOOL_EXECUTION = "TOOL_EXECUTION"
    SPEAKING = "SPEAKING"
    INTERRUPTED = "INTERRUPTED"
    ESCALATING = "ESCALATING"
    ENDING = "ENDING"
    ENDED = "ENDED"
    ERROR = "ERROR"


class ConversationOrchestrator:
    """
    Core conversational voice engine for a live call or simulation.
    Orchestrates the entire streaming audio and turn pipeline.
    """

    def __init__(
        self,
        call_id: str,
        employee: Optional[AIEmployee] = None,
        db: Optional[Session] = None,
        output_mode: str = "twilio",  # 'twilio' (raw 8kHz mulaw) or 'browser' (24kHz WAV)
        send_audio_callback: Optional[Callable[[bytes, str], Any]] = None,
        flush_audio_callback: Optional[Callable[[], Any]] = None,
        send_event_callback: Optional[Callable[[Dict[str, Any]], Any]] = None,
        trigger_hangup_callback: Optional[Callable[[float], Any]] = None,
    ):
        self.call_id = call_id
        self.employee = employee
        self.db = db
        self.output_mode = output_mode

        # Callbacks for streaming output back to WebSocket
        self.send_audio_callback = send_audio_callback
        self.flush_audio_callback = flush_audio_callback
        self.send_event_callback = send_event_callback
        self.trigger_hangup_callback = trigger_hangup_callback

        # Conversation State
        self.state = ConversationState.IDLE
        self.is_active = True
        self.messages: List[Dict[str, str]] = []
        self.transcript_history: List[Dict[str, Any]] = []

        # Turn & Deduplication
        self.turn_index = 0
        self.last_user_text = ""
        self.last_user_time = 0.0

        # Services & Voice Configuration
        raw_vid = str(employee.voice_id if employee and employee.voice_id else "").strip()
        if raw_vid:
            self.voice_id = raw_vid
        else:
            self.voice_id = getattr(settings, "DEFAULT_VOICE_ID", "07bc462a-c644-49f1-baf7-82d5599131be")

        if employee and employee.voice_language and employee.voice_language != "en":
            self.language = employee.voice_language
        elif employee and employee.languages and "te" in employee.languages:
            self.language = "te"
        else:
            self.language = (employee.voice_language if employee else None) or "te"

        raw_speed = getattr(employee, "voice_speed", None)
        self.speed = max(float(raw_speed), 1.22) if (raw_speed and float(raw_speed) > 1.0) else 1.22

        self.cartesia_tts = CartesiaTTSService()
        self.sarvam_tts = SarvamTTS()
        self.primary_tts = (getattr(settings, "PRIMARY_TTS", "cartesia") or "cartesia").lower()
        self.gemini_service = GeminiLLM()

        self.active_turn_task: Optional[asyncio.Task] = None
        self.speaking_start_time: float = 0.0
        self.is_speaking: bool = False
        self.greeting_in_progress: bool = False
        self.current_speaking_text: str = ""
        self.last_assistant_speech_text: str = ""
        self.last_assistant_speech_end_time: float = 0.0
        self.primary_llm: str = (getattr(settings, "PRIMARY_LLM", "gemini") or "gemini").lower()
        self.caller_gender: str = "unknown"
        self.caller_title: str = "సార్"
        self._system_prompt: Optional[str] = None
        # Initialize caller gender & prompt asynchronously so call connects in < 50ms!
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._async_init_context())
        except RuntimeError:
            pass

    async def _async_init_context(self) -> None:
        """Asynchronously load caller gender and system prompt in background without blocking call pickup."""
        try:
            self._init_caller_gender()
            self._system_prompt = self._compile_system_prompt()
        except Exception as e:
            logger.warning(f"[Call {self.call_id}] Background context init notice: {e}")

    @property
    def system_prompt(self) -> str:
        """Return compiled system prompt or fast fallback while background compilation finishes."""
        if not self._system_prompt:
            self._system_prompt = self._compile_system_prompt()
        return self._system_prompt

    def _init_caller_gender(self) -> None:
        """Inspect Lead or Customer name in DB to pre-classify caller gender if available."""
        name = ""
        if self.db and self.call_id:
            try:
                call = self.db.query(Call).filter(Call.id == self.call_id).first()
                if call:
                    if call.lead_id:
                        lead = self.db.query(Lead).filter(Lead.id == call.lead_id).first()
                        if lead and lead.name:
                            name = lead.name.strip()
                    if not name and call.customer_id:
                        cust = self.db.query(Customer).filter(Customer.id == call.customer_id).first()
                        if cust and cust.name and not cust.name.lower().startswith("customer"):
                            name = cust.name.strip()
            except Exception:
                pass
        if name:
            self.detect_gender_from_name(name)

    def detect_gender_from_name(self, name: str) -> None:
        """Check if caller's name strongly indicates male or female gender."""
        if not name:
            return
        n_lower = name.lower()
        female_names = [
            "sunitha", "priya", "anitha", "lakshmi", "bhavani", "swathi", "divya", "sneha",
            "kavitha", "sandhya", "sravani", "deepika", "shravani", "lavanya", "padma",
            "radha", "ramya", "sindhu", "sirisha", "geetha", "swapna", "madhuri", "sowmya",
            "pooja", "shreya", "harika", "keerthi", "ananya", "vani", "sailaja", "kalyani",
            "archana", "manasa", "jyothi", "usha", "rekha", "devi", "kumari", "rani", "madhavi"
        ]
        male_names = [
            "abhi", "abhiram", "rajesh", "suresh", "ramesh", "kiran", "venkat", "venkatesh",
            "prasad", "naresh", "mahesh", "srinivas", "ravi", "chaitanya", "sai", "pavan",
            "kalyan", "shiva", "siva", "krishna", "vijay", "anand", "naveen", "ajay", "rahul",
            "praveen", "rohit", "manoj", "sandeep", "vikram", "surya", "harish", "karthik",
            "kumar", "reddy", "rao", "varma", "raju", "babu"
        ]
        for fn in female_names:
            if fn in n_lower:
                self.update_caller_gender("female", "మేడం")
                return
        for mn in male_names:
            if mn in n_lower:
                self.update_caller_gender("male", "సార్")
                return

    def update_caller_gender(self, gender: str, title: Optional[str] = None) -> None:
        """Dynamically update caller gender and title, recompiling system prompt."""
        if gender not in ["male", "female", "unknown"]:
            return
        new_title = title or ("మేడం" if gender == "female" else ("సార్" if gender == "male" else ""))
        if self.caller_gender == gender and self.caller_title == new_title:
            return
        prev_gender = self.caller_gender
        self.caller_gender = gender
        self.caller_title = new_title
        self._system_prompt = self._compile_system_prompt()
        logger.info(f"[Call {self.call_id}] 👤 Caller Gender updated: {prev_gender} -> {gender} (Title: '{self.caller_title}')")

    def adapt_honorific_to_caller(self, text: str) -> str:
        """
        Dynamically adapt honorifics in speech:
        - If female: Replace 'అండీ' and repetitive patterns with 'మేడం'
        - If male: Replace 'అండీ' and repetitive patterns with 'సార్'
        - If unknown: Remove repeated 'అండీ' spam, keeping speech sweet and natural.
        Prevents multiple repetitive honorifics in the same sentence.
        """
        if not text:
            return ""
        import re
        title = self.caller_title

        if not title:
            text = re.sub(r'[\s,]*(అండీ|అండి|ఆండీ)', '', text)
            text = re.sub(r'\s+([,!?\.])', r'\1', text)
            return re.sub(r'\s+', ' ', text).strip()

        replacements = [
            (r'సరేనండీ|సరేనండి|సరే అండీ|సరే అండి', f'సరే {title}'),
            (r'అవునండీ|అవునండి|అవును అండీ|అవును అండి', f'అవును {title}'),
            (r'కాదండీ|కాదండి', f'కాదు {title}'),
            (r'నిజమేనండీ|నిజమేనండి', f'నిజమే {title}'),
            (r'వద్దండీ|వద్దు అండీ|వద్దు అండి', f'వద్దు {title}'),
            (r'ధన్యవాదాలు అండీ|ధన్యవాదాలు అండి', f'ధన్యవాదాలు {title}'),
            (r'నమస్కారం అండీ|నమస్కారం అండి', f'నమస్కారం {title}'),
            (r'హలో అండీ|హలో అండి', f'హలో {title}'),
            (r'చెప్పండి అండీ|చెప్పండి అండి', f'చెప్పండి {title}'),
            (r'చూపిస్తానండీ|చూపిస్తానండి', f'చూపిస్తాను {title}'),
            (r'ఉన్నాయండీ|ఉన్నాయండి', f'ఉన్నాయి {title}'),
            (r'చెప్తానండీ|చెప్తానండి', f'చెప్తాను {title}'),
            (r'లేదండీ|లేదండి', f'లేదు {title}'),
            (r'చేస్తానండీ|చేస్తానండి', f'చేస్తాను {title}'),
            (r'కదండీ|కదా అండీ|కదండి', f'కదా {title}'),
            (r'(?<![ఁ-౿])(అండీ|అండి|ఆండీ)(?![ఁ-౿])', title),
        ]
        for pat, rep in replacements:
            text = re.sub(pat, rep, text)

        parts = text.split(title)
        if len(parts) > 2:
            text = parts[0] + title + "".join(parts[1:])

        text = re.sub(rf'({re.escape(title)}\s*)+', f'{title} ', text)
        text = re.sub(r'\s+([,!?\.])', r'\1', text)
        return re.sub(r'\s+', ' ', text).strip()

    def _resolve_business_context(self) -> Dict[str, Any]:
        """Dynamically resolve business profile, user customizations, script stages, and lead context."""
        if getattr(self, "_cached_ctx", None) is not None:
            return self._cached_ctx

        emp_name = self.employee.name if self.employee else "Sara"
        role = self.employee.role if self.employee and self.employee.role else "Business & Client Advisory Specialist"
        dept = self.employee.department if self.employee and self.employee.department else "Customer Service"
        mission = self.employee.mission if self.employee and self.employee.mission else "Assist callers with warmth, understand their requirements, explain offerings, and guide them to the next steps."

        biz_name = "our business"
        biz_desc = "Providing dedicated products, services, and consultation for our valued clients."
        biz_industry = "General Business & Services"
        locations_str = ""
        services_str = ""
        policies_str = "Transparent pricing, dedicated service, verified customer support."
        calling_instruction = ""
        knowledge_context = ""
        operating_hours = "09:00 AM – 09:00 PM IST"
        policy_questions: List[str] = []
        policy_intro = ""
        policy_offer = ""
        custom_opening_line = ""
        script_steps: List[Dict[str, Any]] = []

        if self.db:
            try:
                ws = None
                # 1. Resolve workspace from call first
                if self.call_id:
                    call = self.db.query(Call).filter(
                        (Call.id == self.call_id) | 
                        (Call.twilio_call_sid == self.call_id)
                    ).first()
                    if call and getattr(call, "workspace_id", None):
                        candidate = self.db.query(Workspace).filter(Workspace.id == call.workspace_id).first()
                        if candidate:
                            ws = candidate

                # 2. If no ws or ws lacks business_profile, check employee workspace_id
                if (not ws or not (ws.settings and isinstance(ws.settings, dict) and ws.settings.get("business_profile"))) and self.employee and self.employee.workspace_id:
                    candidate = self.db.query(Workspace).filter(Workspace.id == self.employee.workspace_id).first()
                    if candidate and candidate.settings and isinstance(candidate.settings, dict) and candidate.settings.get("business_profile"):
                        ws = candidate
                    else:
                        wm = self.db.query(WorkspaceMember).filter(WorkspaceMember.user_id == self.employee.workspace_id).first()
                        if wm:
                            ws = self.db.query(Workspace).filter(Workspace.id == wm.workspace_id).first()

                # 3. Fallback: single fast limit(1) workspace
                if not ws:
                    ws = self.db.query(Workspace).first()

                if ws:
                    if ws.name and ws.name != "Workspace":
                        biz_name = ws.name
                    # Check ws.settings['business_profile']
                    settings_dict = ws.settings if isinstance(ws.settings, dict) else {}
                    bp_settings = settings_dict.get("business_profile") or {}
                    if bp_settings:
                        biz_name = bp_settings.get("business_name") or biz_name
                        biz_industry = bp_settings.get("industry") or biz_industry
                        calling_instruction = bp_settings.get("calling_instruction") or ""
                        operating_hours = bp_settings.get("operating_hours") or operating_hours
                        if bp_settings.get("locations"):
                            locs = bp_settings["locations"]
                            locations_str = ", ".join(locs) if isinstance(locs, list) else str(locs)
                        if bp_settings.get("products_services"):
                            prods = bp_settings["products_services"]
                            if isinstance(prods, list):
                                parts = []
                                for p in prods:
                                    if isinstance(p, dict):
                                        p_name = p.get('name') or p.get('service_name') or ''
                                        p_price = p.get('price') or p.get('pricing') or ''
                                        parts.append(f"{p_name} ({p_price})" if p_price else p_name)
                                    else:
                                        parts.append(str(p))
                                services_str = "; ".join(filter(None, parts))
                            else:
                                services_str = str(prods)
                        pol = bp_settings.get("policy") or {}
                        if isinstance(pol, dict):
                            policy_intro = pol.get("intro") or ""
                            policy_offer = pol.get("offer") or ""
                            qs = pol.get("questions") or []
                            policy_questions = qs if isinstance(qs, list) else [str(qs)]
                            if pol.get("guardrails"):
                                gr = pol["guardrails"]
                                policies_str = ", ".join(gr) if isinstance(gr, list) else str(gr)

                # 4. Check BusinessProfile table
                bp = None
                if ws:
                    bp = self.db.query(BusinessProfile).filter(BusinessProfile.user_id == ws.id).first()
                if not bp and self.employee:
                    bp = self.db.query(BusinessProfile).filter(
                        (BusinessProfile.user_id == self.employee.workspace_id) |
                        (BusinessProfile.business_name == biz_name)
                    ).first()

                if bp:
                    biz_name = bp.business_name or biz_name
                    biz_desc = bp.description or biz_desc
                    biz_industry = bp.industry or biz_industry
                    if bp.locations and not locations_str:
                        locations_str = ", ".join(bp.locations) if isinstance(bp.locations, list) else str(bp.locations)
                    if bp.services_offered and not services_str:
                        services_str = ", ".join(bp.services_offered) if isinstance(bp.services_offered, list) else str(bp.services_offered)
                    if bp.important_policies:
                        policies_str = bp.important_policies

                # 5. Extract script stages & custom steps from self.employee.universal_spec
                if self.employee and self.employee.universal_spec and isinstance(self.employee.universal_spec, dict):
                    spec = self.employee.universal_spec
                    cs = spec.get("call_script") or {}
                    if isinstance(cs, dict):
                        custom_opening_line = cs.get("opening_line") or custom_opening_line
                        if cs.get("steps") and isinstance(cs["steps"], list):
                            script_steps = cs["steps"]
                    if not script_steps and spec.get("script_stages") and isinstance(spec["script_stages"], list):
                        script_steps = spec["script_stages"]
                    if not calling_instruction and spec.get("calling_instruction"):
                        calling_instruction = spec.get("calling_instruction")

                # 6. Check Knowledge Sources
                if ws or self.employee:
                    filter_cond = []
                    if ws:
                        filter_cond.append(KnowledgeSource.workspace_id == ws.id)
                    if self.employee:
                        filter_cond.append(KnowledgeSource.employee_id == self.employee.id)
                    from sqlalchemy import or_
                    ks_list = self.db.query(KnowledgeSource).filter(or_(*filter_cond)).limit(5).all()
                    if ks_list:
                        snippets = [f"[{ks.name}]:\n{ks.extracted_text.strip()}" for ks in ks_list if ks.extracted_text]
                        if snippets:
                            knowledge_context = "\nVERIFIED BUSINESS OFFERINGS & FAQ:\n" + "\n\n".join(snippets)

            except Exception as e:
                logger.warning(f"Error resolving business context: {e}")

        self._cached_ctx = {
            "emp_name": emp_name,
            "role": role,
            "dept": dept,
            "mission": mission,
            "biz_name": biz_name,
            "biz_desc": biz_desc,
            "biz_industry": biz_industry,
            "locations_str": locations_str,
            "services_str": services_str or "Comprehensive professional services and customer consultation",
            "policies_str": policies_str,
            "calling_instruction": calling_instruction,
            "knowledge_context": knowledge_context,
            "operating_hours": operating_hours,
            "policy_questions": policy_questions,
            "policy_intro": policy_intro,
            "policy_offer": policy_offer,
            "custom_opening_line": custom_opening_line,
            "script_steps": script_steps
        }
        return self._cached_ctx

    def get_initial_greeting(self) -> str:
        """Construct warm, respectful, concise initial greeting for ANY business type."""
        ctx = self._resolve_business_context()
        emp_name = ctx["emp_name"]
        biz_name = ctx["biz_name"]
        lang = (self.language or "te").lower()
        title = self.caller_title or "సార్"
        custom_opening = ctx.get("custom_opening_line") or ""
        lead_name = ""

        if self.db and self.call_id:
            try:
                call = self.db.query(Call).filter(
                    (Call.id == self.call_id) |
                    (Call.twilio_call_sid == self.call_id)
                ).first()
                if call:
                    if call.lead_id:
                        lead = self.db.query(Lead).filter(Lead.id == call.lead_id).first()
                        if lead and lead.name:
                            lead_name = lead.name.strip()
                    if not lead_name and call.customer_id:
                        cust = self.db.query(Customer).filter(Customer.id == call.customer_id).first()
                        if cust and cust.name and not cust.name.lower().startswith("customer"):
                            lead_name = cust.name.strip()
                    if not lead_name and (call.to_number or call.phone_number):
                        num = call.to_number or call.phone_number
                        lead = self.db.query(Lead).filter((Lead.phone == num) | (Lead.phone.endswith(num[-10:]))).first()
                        if lead and lead.name:
                            lead_name = lead.name.strip()
            except Exception:
                pass

        # 1. If user defined a custom opening line in script/universal_spec/business_profile, honor it first!
        if custom_opening and custom_opening.strip():
            greeting = custom_opening.strip()
            greeting = greeting.replace("{Lead Name}", lead_name or "").replace("{Name}", lead_name or "")
            greeting = greeting.replace("{Business Name}", biz_name).replace("{Company}", biz_name)
            greeting = greeting.replace("{Preferred Timing}", "మీకు ఎప్పుడు వీలవుతుంది?")
            import re
            greeting = re.sub(r'\{[^}]+\}', '', greeting).strip()
            if greeting:
                return self.adapt_honorific_to_caller(greeting)

        # 2. Default opening for Telugu: Saadhyam AI / Dynamic Business
        if lang in ["te", "telugu"]:
            return f"నమస్కారం అండి! నేను సారా మాట్లాడుతున్నాను, {biz_name} తరఫున. మీ వ్యాపారానికి సంబంధించిన ఒక చిన్న విషయం మాట్లాడటానికి కాల్ చేశాను అండి. ఇప్పుడు ఒక నిమిషం మాట్లాడటం వీలవుతుందా?"

        elif lang in ["hi", "hindi"]:
            if lead_name and lead_name.lower() != "customer":
                return f"नमस्ते {lead_name} जी! मैं {biz_name} से {emp_name} बात कर रही हूँ, मैं आपकी क्या सहायता कर सकती हूँ?"
            return f"नमस्ते जी! मैं {biz_name} से {emp_name} बात कर रही हूँ, मैं आपकी क्या सहायता कर सकती हूँ?"
        else:
            if lead_name and lead_name.lower() != "customer":
                return f"Hello {lead_name}! This is {emp_name} calling from {biz_name}. How can I assist you today?"
            return f"Hello! This is {emp_name} from {biz_name}. How can I assist you today?"

    def set_state(self, new_state: str) -> None:
        """Explicit state transition with event logging."""
        prev = self.state
        self.state = new_state
        logger.debug(f"[Call {self.call_id}] State: {prev} -> {new_state}")
        if self.send_event_callback:
            try:
                res = self.send_event_callback({
                    "type": "state_change",
                    "previous_state": prev,
                    "state": new_state,
                    "timestamp": time.time()
                })
                if asyncio.iscoroutine(res):
                    asyncio.create_task(res)
            except Exception:
                pass

    def _compile_system_prompt(self) -> str:
        # Dynamic business and script context from workspace/employee customization
        ctx = self._resolve_business_context()
        emp_name = ctx.get("emp_name") or "సారా"
        biz_name = ctx.get("biz_name") or "Saadhyam AI"
        biz_desc = ctx.get("biz_desc") or "AI Voice Assistant for businesses"
        services_str = ctx.get("services_str") or "AI Voice Assistant, Call automation, Lead follow-ups"
        locations_str = ctx.get("locations_str") or "India"
        calling_inst = ctx.get("calling_instruction") or ""
        knowledge = ctx.get("knowledge_context") or ""
        script_steps = ctx.get("script_steps") or []

        # Build dynamic script steps section if user configured custom steps
        steps_prompt = ""
        if script_steps and isinstance(script_steps, list):
            steps_prompt = "## సంభాషణ దశలు (CUSTOM CONVERSATION FLOW):\n"
            for idx, s in enumerate(script_steps, 1):
                if isinstance(s, dict):
                    t = s.get("title") or f"దశ {idx}"
                    c = s.get("content") or s.get("text") or ""
                    steps_prompt += f"దశ {idx} - {t}: {c}\n"
                elif isinstance(s, str):
                    steps_prompt += f"దశ {idx}: {s}\n"
        else:
            steps_prompt = """## 2. సంభాషణ దశలు (CONVERSATION FLOW):
దశ 1: కాల్ ప్రారంభం & సమ్మతి:
కస్టమర్ మాట్లాడటానికి అంగీకరిస్తే ధన్యవాదాలు చెప్పి, వారి వ్యాపారం గురించి అడగాలి.
దశ 2: వ్యాపార సమస్యను గుర్తించడం:
కాల్స్ చేయడం లేదా లీడ్స్ ఫాలో అప్ చేయడంలో ఏమైనా ఇబ్బందులు ఉన్నాయా అడగాలి.
దశ 3: సేవల గురించి వివరించడం:
మా సేవలు వారి వ్యాపారానికి ఎలా ఉపయోగపడతాయో క్లుప్తంగా చెప్పాలి.
దశ 4: అవసరాలు & క్వాలిఫికేషన్ (ఒక్కొక్కటిగా అడగాలి):
రోజుకు ఎన్ని కాల్స్, ప్రధాన ఉపయోగం, నిర్ణయం తీసుకునే వ్యక్తి వివరాలు తెలుసుకోవాలి.
దశ 5: డెమో ఏర్పాటు & ముగింపు:
ఆసక్తి ఉంటే ఒక చిన్న డెమో ఏర్పాటు చేయడానికి అనువైన సమయం అడగాలి."""

        custom_instructions_block = f"\n## కస్టమర్ నిర్దిష్ట సూచనలు (CALLING INSTRUCTIONS):\n{calling_inst}\n" if calling_inst else ""
        knowledge_block = f"\n## ధృవీకరించిన వ్యాపార సమాచారం (KNOWLEDGE BASE):\n{knowledge}\n" if knowledge else ""

        base_prompt = f"""# సారా ఏఐ — కస్టమర్ కాలింగ్ మరియు లీడ్ క్వాలిఫికేషన్ సిస్టమ్ ({biz_name})

## 1. సారా యొక్క ప్రధాన లక్ష్యం
నువ్వు {emp_name}. {biz_name} తరఫున కస్టమర్లతో మాట్లాడే స్నేహపూర్వక వాయిస్ అసిస్టెంట్వి.
- సంస్థ/వ్యాపారం: {biz_name}
- వివరణ: {biz_desc}
- ఉత్పత్తులు & సేవలు: {services_str}
- ప్రాంతాలు: {locations_str}

నీ ప్రధాన బాధ్యతలు:
- కస్టమర్లతో సహజంగా, మర్యాదగా మాట్లాడాలి.
- వారి వ్యాపార అవసరాలను గుర్తించాలి.
- {biz_name} సేవలు వారి వ్యాపారానికి ఎలా సహాయపడతాయో వివరించాలి.
- కస్టమర్ అడిగే సందేహాలకు సూటిగా, స్పష్టంగా సమాధానం ఇవ్వాలి.
- ఆసక్తి ఉన్న కస్టమర్లకు డెమో ఏర్పాటు చేయాలి లేదా సేల్స్ టీమ్కు లీడ్ను అందించాలి.
- నువ్వు ఒక రోబోట్లా మాట్లాడకూడదు. అనుభవం ఉన్న తెలుగు సేల్స్ ఎగ్జిక్యూటివ్లా సహజంగా, మర్యాదగా మాట్లాడాలి.
- ఎల్లప్పుడూ కేవలం 1 నుండి 2 చిన్న వాక్యాల్లో (గరిష్టంగా 20 పదాలు) మాత్రమే సమాధానం చెప్పాలి.
{custom_instructions_block}{knowledge_block}
{steps_prompt}

## 3. మాట్లాడే విధానం & అత్యంత ముఖ్యమైన నిబంధనలు (CRITICAL RULES):
- సంభాషణ స్పీడ్: ఫోన్‌లో ఎదుటి మనిషితో మాట్లాడుతున్నట్లుగా వెంటనే సమాధానం ఇవ్వాలి.
- అవుట్‌పుట్ పొడవు: ఎల్లప్పుడూ కేవలం 1 నుండి 2 వాక్యాలు (20 పదాల లోపు) మాత్రమే ఉండాలి. లెంథీ ప్యారాలు అస్సలు మాట్లాడకూడదు.
- ఒకేసారి ఒక ప్రశ్న మాత్రమే అడగాలి.
- ఎదుటి వ్యక్తి చెప్పేది శ్రద్ధగా వినాలి. పదే పదే ఒకే విషయాన్ని అడగకూడదు.
- [END_CALL] ను కస్టమర్ కాల్ కట్ చేయమని చెప్పినప్పుడు మాత్రమే ఉపయోగించాలి.
"""
        return base_prompt


    async def handle_barge_in(self) -> None:
        """
        Executed when caller speech is detected during assistant playback or turn generation.
        Stops current speaking turn, cancels ongoing generation/synthesis, flushes audio queue, and transitions to LISTENING.
        """
        if getattr(self, "greeting_in_progress", False):
            self.greeting_in_progress = False
            logger.info(f"[Call {self.call_id}] 🛑 Customer interrupted during greeting -> clearing greeting and listening")

        is_active = self.is_speaking or (self.state == ConversationState.SPEAKING) or getattr(self, "greeting_in_progress", False)
        if not is_active:
            return

        logger.info(f"[Call {self.call_id}] 🛑 Barge-in confirmed -> interrupting assistant turn immediately")
        self.set_state(ConversationState.INTERRUPTED)
        self.is_speaking = False
        self.current_speaking_text = ""

        # Cancel any active turn task unconditionally so it does not continue synthesizing or speaking
        if self.active_turn_task and not self.active_turn_task.done():
            self.active_turn_task.cancel()

        # Flush buffered audio in carrier queue
        if self.flush_audio_callback:
            try:
                res = self.flush_audio_callback()
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.warning(f"[Call {self.call_id}] Error in flush_audio_callback: {e}")

        self.set_state(ConversationState.LISTENING)

    async def handle_user_utterance(self, text: str, confidence: float = 0.95, detected_lang: str = "en") -> None:
        """
        Process completed customer utterance, generate streaming response,
        synthesize TTS chunks, and stream audio to Plivo or browser.
        """
        clean_text = text.strip()
        if not clean_text:
            return

        # Deduplication & acoustic echo guard: ignore ONLY if user utterance is a verbatim echo of assistant speech
        now = time.time()
        import re
        if self.last_assistant_speech_text and (time.perf_counter() - self.last_assistant_speech_end_time < 1.0):
            curr_words = set(re.findall(r"\w+", self.last_assistant_speech_text.lower()))
            user_words = [w for w in re.findall(r"\w+", clean_text.lower()) if len(w) > 1]
            # Only suppress if long phrase (>= 4 words) completely contained in what assistant just said
            if len(user_words) >= 4 and set(user_words).issubset(curr_words):
                logger.info(f"[Call {self.call_id}] Discarded verbatim post-speech acoustic echo: '{clean_text}'")
                return

        if (now - self.last_user_time < 0.8) and (clean_text.lower() == self.last_user_text.lower()):
            logger.debug(f"[Call {self.call_id}] Discarding duplicate utterance: '{clean_text}'")
            return

        # If greeting is in progress, interrupt it immediately and process customer utterance
        if getattr(self, "greeting_in_progress", False):
            logger.info(f"[Call {self.call_id}] 🛑 Customer spoke '{clean_text}' during greeting -> halting greeting and processing customer turn immediately!")
            self.greeting_in_progress = False

        # Unconditionally cancel any previous turn task (whether THINKING or SPEAKING)
        # to prevent concurrent turns from running in parallel and delaying responses!
        if self.active_turn_task and not self.active_turn_task.done():
            logger.info(f"[Call {self.call_id}] 🛑 Cancelling prior active turn task for new customer utterance: '{clean_text}'")
            self.active_turn_task.cancel()

        if self.is_speaking or getattr(self, "greeting_in_progress", False):
            if self.flush_audio_callback:
                try:
                    res = self.flush_audio_callback()
                    if asyncio.iscoroutine(res):
                        await res
                except Exception:
                    pass
        self.is_speaking = False

        prev_user_time = self.last_user_time
        self.last_user_text = clean_text
        self.last_user_time = now
        self.turn_index += 1
        turn_start_time = time.perf_counter()

        logger.info(f"[Call {self.call_id}] Customer (Turn {self.turn_index}): {clean_text}")

        # Check for explicit customer demand to end the call immediately:
        # e.g., "కాల్ కట్ చేయండి", "ఫోన్ పెట్టేయండి", "cut the call", "hang up"
        explicit_hangup_triggers = [
            "కాల్ కట్ చేయండి", "ఫోన్ పెట్టేయండి", "కాల్ పెట్టేయండి", "కట్ చేయండి",
            "ఫోన్ కట్ చేయండి", "ఇక కాల్ చేయకండి", "నాకు కాల్ చేయవద్దు",
            "cut the call", "cut call", "disconnect the call", "please hang up", "hang up the call"
        ]
        clean_lower = clean_text.lower()
        is_hangup_intent = any(ht in clean_lower for ht in explicit_hangup_triggers)
        self.explicit_hangup_requested = is_hangup_intent

        # Check for explicit gender self-identification or title clues in user speech
        # Check negations first (e.g. "madam కాదు", "not madam", "sir నేను")
        if any(neg in clean_lower for neg in ["మేడం కాదు", "మేడం కాదండి", "madam కాదు", "madam kaadu", "not madam", "not lady", "లేడీ కాదు"]):
            self.update_caller_gender("male", "సార్")
        elif any(neg in clean_lower for neg in ["సార్ కాదు", "సార్ కాదండి", "sir కాదు", "sir kaadu", "not sir", "not gentleman", "జెంట్స్ కాదు"]):
            self.update_caller_gender("female", "మేడం")
        elif any(w in clean_lower for w in ["సార్ అని", "సార్ నేను", "సర్ నేను", "నేను సార్", "అబ్బాయి", "boy", "sir", "gentleman", "man"]):
            self.update_caller_gender("male", "సార్")
        elif any(w in clean_lower for w in ["మేడం అని", "మేడం నేను", "నేను మేడం", "అమ్మాయి", "girl", "madam", "lady", "women", "woman"]):
            self.update_caller_gender("female", "మేడం")

        if is_hangup_intent:
            logger.info(f"[Call {self.call_id}] 🛑 Customer explicitly requested call termination ('{clean_text}'). Saying polite farewell...")
            title = self.caller_title or "సార్"
            farewell_text = f"సరే {title}, అలాగే. మీ సమయానికి ధన్యవాదాలు, నమస్కారం!"
            self.messages.append({"role": "user", "content": clean_text})
            self.messages.append({"role": "assistant", "content": farewell_text})
            self.transcript_history.append({
                "speaker": "customer", "role": "user", "text": clean_text,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            self.transcript_history.append({
                "speaker": self.employee.name if self.employee else "Sara",
                "role": "assistant", "text": farewell_text,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            if self.send_event_callback:
                try:
                    res = self.send_event_callback({
                        "type": "transcript",
                        "speaker": self.employee.name if self.employee else "Sara",
                        "role": "assistant",
                        "text": farewell_text,
                        "timestamp": time.time()
                    })
                    if asyncio.iscoroutine(res):
                        await res
                except Exception:
                    pass

            await self._synthesize_and_send_chunk(farewell_text, turn_start_time, True)
            if self.trigger_hangup_callback:
                asyncio.create_task(self.trigger_hangup_callback(12.0))
            return

        # Record customer message - consolidate if user continued phrase within 2.5s
        is_consolidated = False
        if self.messages and self.messages[-1]["role"] == "user" and (now - prev_user_time < 2.5):
            prev_content = self.messages[-1]["content"]
            # Append if previous fragment was conversational (< 20 words) and not duplicate
            if len(prev_content.split()) <= 20 and clean_text.lower() not in prev_content.lower():
                self.messages[-1]["content"] = f"{prev_content} {clean_text}".strip()
                clean_text = self.messages[-1]["content"]
                is_consolidated = True
            else:
                self.messages[-1]["content"] = clean_text
                is_consolidated = True
            logger.info(f"[Call {self.call_id}] Consolidated user utterance into: '{clean_text}'")
        else:
            self.messages.append({"role": "user", "content": clean_text})

        # Keep transcript history clean: update last entry if consolidated, else append
        if is_consolidated and self.transcript_history and self.transcript_history[-1].get("role") == "user":
            self.transcript_history[-1]["text"] = clean_text
            self.transcript_history[-1]["timestamp"] = datetime.now(timezone.utc).isoformat()
        else:
            self.transcript_history.append({
                "speaker": "customer",
                "role": "user",
                "text": clean_text,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        if self.send_event_callback:
            try:
                res = self.send_event_callback({
                    "type": "transcript",
                    "speaker": "customer",
                    "role": "user",
                    "text": clean_text,
                    "confidence": confidence,
                    "timestamp": time.time()
                })
                if asyncio.iscoroutine(res):
                    asyncio.create_task(res)
            except Exception:
                pass

        # Launch single agent turn task immediately!
        self.active_turn_task = asyncio.create_task(
            self._execute_agent_turn(clean_text, turn_start_time)
        )

    async def _execute_agent_turn(self, user_text: str, turn_start_time: float) -> None:
        """Execute LLM streaming, phrase chunking, pipelined TTS prefetch, and audio dispatch."""
        self.set_state(ConversationState.THINKING)
        self.turn_first_audio_time: Optional[float] = None
        # Fast 2-word first chunk for instant sub-700ms Time-To-First-Audio!
        chunker = SentenceChunker(min_chunk_words=2, max_chunk_words=14)

        full_reply_tokens: List[str] = []
        first_token_time: Optional[float] = None
        first_audio_time: Optional[float] = None
        llm_first_token_ms = 0.0
        tts_first_audio_ms = 0.0

        phrase_queue: asyncio.Queue = asyncio.Queue()
        tts_worker_task: Optional[asyncio.Task] = None

        async def _prefetch_chunk(text: str) -> Tuple[bytes, str]:
            """Synthesize audio in background concurrently as soon as LLM yields phrase."""
            if not text or not text.strip() or (self.state == ConversationState.INTERRUPTED and self.is_speaking):
                return b"", text
            clean_speech = text.replace("[END_CALL]", "").replace("[end_call]", "").strip()
            clean_speech = self.adapt_honorific_to_caller(clean_speech)
            if not clean_speech:
                return b"", text

            cleaned = clean_for_speech(clean_speech)
            normalized = normalize_numbers_to_english(cleaned)
            if not normalized.strip():
                return b"", text

            synth_res = await self._synthesize_chunk_audio(normalized)
            audio_bytes = synth_res.get("audio_bytes", b"") if synth_res else b""
            return audio_bytes, normalized

        async def _tts_worker():
            nonlocal first_audio_time
            while True:
                item = await phrase_queue.get()
                if item is None:
                    phrase_queue.task_done()
                    break
                if self.state == ConversationState.INTERRUPTED and self.is_speaking:
                    phrase_queue.task_done()
                    break
                try:
                    if isinstance(item, asyncio.Task):
                        audio_bytes, normalized = await item
                    else:
                        audio_bytes, normalized = await _prefetch_chunk(item)

                    if audio_bytes and self.send_audio_callback and not (self.state == ConversationState.INTERRUPTED and self.is_speaking):
                        self.set_state(ConversationState.SPEAKING)
                        self.speaking_start_time = time.perf_counter()
                        self.is_speaking = True
                        self.current_speaking_text = normalized
                        if getattr(self, "turn_first_audio_time", None) is None:
                            self.turn_first_audio_time = time.perf_counter()
                        if first_audio_time is None:
                            first_audio_time = time.perf_counter()

                        if asyncio.iscoroutinefunction(self.send_audio_callback):
                            await self.send_audio_callback(audio_bytes, normalized)
                        else:
                            self.send_audio_callback(audio_bytes, normalized)
                except Exception as ex:
                    logger.warning(f"Error in pipelined TTS worker chunk: {ex}")
                finally:
                    phrase_queue.task_done()

        tts_worker_task = asyncio.create_task(_tts_worker())

        try:
            # Keep prompt compact (last 4 messages) for sub-700ms instant LLM first-token generation
            recent_messages = self.messages[-4:] if len(self.messages) > 4 else self.messages

            if self.primary_llm == "gemini":
                # Primary: Google Gemini LLM streaming
                async for gchunk in self.gemini_service.stream_chat(
                    messages=recent_messages,
                    system_prompt=self.system_prompt,
                    temperature=0.3,
                    max_tokens=65
                ):
                    if self.state == ConversationState.INTERRUPTED:
                        break
                    tok = gchunk.get("token", "")
                    if tok:
                        if gchunk.get("first_token"):
                            first_token_time = time.perf_counter()
                            llm_first_token_ms = (first_token_time - turn_start_time) * 1000
                            if self.send_event_callback:
                                try:
                                    res = self.send_event_callback({
                                        "type": "llm_first_token",
                                        "ttft_ms": round(llm_first_token_ms, 2)
                                    })
                                    if asyncio.iscoroutine(res):
                                        await res
                                except Exception:
                                    pass

                        full_reply_tokens.append(tok)
                        phrases = chunker.process_token(tok)
                        for phrase in phrases:
                            if self.state == ConversationState.INTERRUPTED:
                                break
                            synth_task = asyncio.create_task(_prefetch_chunk(phrase))
                            await phrase_queue.put(synth_task)

            else:
                # Fallback: Gemini LLM streaming
                async for gchunk in self.gemini_service.stream_chat(
                    messages=recent_messages,
                    system_prompt=self.system_prompt,
                    temperature=0.3,
                    max_tokens=65
                ):
                    if self.state == ConversationState.INTERRUPTED:
                        break
                    tok = gchunk.get("token", "")
                    if tok:
                        if gchunk.get("first_token"):
                            first_token_time = time.perf_counter()
                            llm_first_token_ms = (first_token_time - turn_start_time) * 1000
                            if self.send_event_callback:
                                try:
                                    res = self.send_event_callback({
                                        "type": "llm_first_token",
                                        "ttft_ms": round(llm_first_token_ms, 2)
                                    })
                                    if asyncio.iscoroutine(res):
                                        await res
                                except Exception:
                                    pass

                        full_reply_tokens.append(tok)
                        phrases = chunker.process_token(tok)
                        for phrase in phrases:
                            if self.state == ConversationState.INTERRUPTED:
                                break
                            synth_task = asyncio.create_task(_prefetch_chunk(phrase))
                            await phrase_queue.put(synth_task)

            # Flush any remaining tokens in chunker
            if not (self.state == ConversationState.INTERRUPTED and self.is_speaking):
                remaining_phrases = chunker.flush()
                for p in remaining_phrases:
                    synth_task = asyncio.create_task(_prefetch_chunk(p))
                    await phrase_queue.put(synth_task)

            # Fallback if no tokens generated
            if not full_reply_tokens and not (self.state == ConversationState.INTERRUPTED and self.is_speaking):
                title = self.caller_title or "సార్"
                fallback_msg = f"అవును {title}, నేను వింటున్నాను, చెప్పండి {title}." if self.language in ["te", "telugu"] else "Yes, I am listening, please go ahead."
                fallback_msg = self.adapt_honorific_to_caller(fallback_msg)
                full_reply_tokens.append(fallback_msg)
                synth_task = asyncio.create_task(_prefetch_chunk(fallback_msg))
                await phrase_queue.put(synth_task)

            # Signal worker that all phrases have been queued and wait for completion
            await phrase_queue.put(None)
            if tts_worker_task:
                await tts_worker_task

            # Finalize turn & autonomously execute Google Hub MCP commands
            raw_turn_text = "".join(full_reply_tokens).strip()
            from server.services.mcp.google_hub_mcp import parse_and_execute_inline_commands
            ws_id = self.employee.workspace_id if self.employee else "workspace_default_1"
            u_id = self.employee.created_by if self.employee else "user_demo_owner"

            clean_cmd_text, executed_tools = parse_and_execute_inline_commands(
                text=raw_turn_text,
                db=self.db,
                user_id=u_id,
                workspace_id=ws_id
            )

            for tool_item in executed_tools:
                if self.send_event_callback:
                    try:
                        ev_res = self.send_event_callback({
                            "type": "mcp.command_executed",
                            "tool": tool_item["tool"],
                            "status": tool_item["status"],
                            "summary": tool_item["summary"],
                            "result": tool_item["result"],
                            "hub": "Google Workspace Hub MCP"
                        })
                        if asyncio.iscoroutine(ev_res):
                            await ev_res
                    except Exception:
                        pass

            complete_text = normalize_numbers_to_english(clean_cmd_text if clean_cmd_text else raw_turn_text)
            complete_text = self.adapt_honorific_to_caller(complete_text)
            should_disconnect = bool(getattr(self, "explicit_hangup_requested", False))
            if "[END_CALL]" in complete_text or "[end_call]" in complete_text.lower():
                complete_text = complete_text.replace("[END_CALL]", "").replace("[end_call]", "").strip()

            if complete_text:
                self.messages.append({"role": "assistant", "content": complete_text})
                self.transcript_history.append({
                    "speaker": self.employee.name if self.employee else "Sara",
                    "role": "assistant",
                    "text": complete_text,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

                if self.send_event_callback:
                    try:
                        res = self.send_event_callback({
                            "type": "transcript",
                            "speaker": self.employee.name if self.employee else "Sara",
                            "role": "assistant",
                            "text": complete_text,
                            "timestamp": time.time()
                        })
                        if asyncio.iscoroutine(res):
                            await res
                    except Exception:
                        pass

            if should_disconnect and self.trigger_hangup_callback:
                asyncio.create_task(self.trigger_hangup_callback(12.0))

            # Telemetry persistence
            turn_end_time = time.perf_counter()
            total_turn_ms = (turn_end_time - turn_start_time) * 1000
            actual_first_audio = self.turn_first_audio_time or first_audio_time
            ttfa_ms = ((actual_first_audio - turn_start_time) * 1000) if actual_first_audio else total_turn_ms

            logger.info(
                f"[Call {self.call_id}] Turn {self.turn_index} finished: "
                f"TTFT={round(llm_first_token_ms, 1)}ms | TTFA={round(ttfa_ms, 1)}ms | Total={round(total_turn_ms, 1)}ms"
            )

            # Persist LatencyMetric to DB
            if self.db:
                try:
                    metric = LatencyMetric(
                        session_id=self.call_id,
                        turn_index=self.turn_index,
                        llm_first_token_ms=round(llm_first_token_ms, 2),
                        time_to_first_audio_ms=round(ttfa_ms, 2),
                        total_response_ms=round(total_turn_ms, 2)
                    )
                    self.db.add(metric)
                    self.db.commit()
                except Exception as e:
                    self.db.rollback()
                    logger.debug(f"Could not persist LatencyMetric: {e}")

            if self.state not in [ConversationState.ENDING, ConversationState.ENDED]:
                self.last_assistant_speech_text = complete_text or self.current_speaking_text
                self.last_assistant_speech_end_time = time.perf_counter()
                self.is_speaking = False
                self.current_speaking_text = ""
                self.set_state(ConversationState.LISTENING)

        except asyncio.CancelledError:
            self.last_assistant_speech_text = self.current_speaking_text
            self.last_assistant_speech_end_time = time.perf_counter()
            self.is_speaking = False
            self.current_speaking_text = ""
            logger.info(f"[Call {self.call_id}] Turn task cancelled due to barge-in.")
        except Exception as e:
            self.is_speaking = False
            logger.error(f"[Call {self.call_id}] Error in agent turn: {e}", exc_info=True)
            self.set_state(ConversationState.LISTENING)
        finally:
            if tts_worker_task and not tts_worker_task.done():
                tts_worker_task.cancel()

    async def _synthesize_chunk_audio(self, text: str) -> Optional[Dict[str, Any]]:
        """Synthesize chunk using sweetest Indic TTS (Sarvam Bulbul 'suhani' or Cartesia)."""
        primary_tts = getattr(settings, "PRIMARY_TTS", "cartesia").lower()
        target_vid = self.voice_id or getattr(settings, "DEFAULT_VOICE_ID", "07bc462a-c644-49f1-baf7-82d5599131be")
        from server.services.voice.cartesia_service import CartesiaTTSService
        is_cartesia_quota_exhausted = getattr(CartesiaTTSService, "_cartesia_quota_exhausted", False)
        use_sarvam = (
            primary_tts == "sarvam"
            or is_cartesia_quota_exhausted
            or str(target_vid).startswith("sarvam-")
        )

        synth_res = None
        if use_sarvam:
            # 1. Direct Sarvam Bulbul:v3 synthesis with sweet melodic 'suhani'
            try:
                sarvam_vid = target_vid if str(target_vid).startswith("sarvam-") else "sarvam-te-suhani"
                res = await self.sarvam_tts.synthesize_speech(
                    text=text,
                    voice_id=sarvam_vid,
                    language=self.language or "te",
                    pitch=0.12,
                    pace=1.12
                )
                if res.get("audio_bytes"):
                    raw_audio = res["audio_bytes"]
                    if self.output_mode in ("twilio", "plivo"):
                        source_rate = res.get("sample_rate", 22050)
                        mulaw_bytes = AudioCodecService.convert_cartesia_to_twilio(raw_audio, source_format="wav", source_rate=source_rate)
                        synth_res = {"audio_bytes": mulaw_bytes}
                    else:
                        synth_res = {"audio_bytes": raw_audio}
            except Exception as e:
                logger.warning(f"Sarvam direct TTS notice: {e}")

            if not synth_res or not synth_res.get("audio_bytes"):
                # Fallback to Cartesia if Sarvam is unavailable
                try:
                    res = await self.cartesia_tts.synthesize(
                        text=text,
                        voice_id=getattr(settings, "CARTESIA_PRIMARY_VOICE_ID", "cf061d8b-a752-4865-81a2-57570a6e0565"),
                        language=self.language or "te",
                        output_mode=self.output_mode,
                        speed=self.speed
                    )
                    if res.get("audio_bytes"):
                        synth_res = res
                except Exception as e:
                    logger.warning(f"Cartesia fallback notice: {e}")
        else:
            # Primary Cartesia with Sarvam fallback
            try:
                res = await self.cartesia_tts.synthesize(
                    text=text,
                    voice_id=target_vid,
                    language=self.language or "te",
                    output_mode=self.output_mode,
                    speed=self.speed
                )
                if res.get("audio_bytes"):
                    synth_res = res
            except Exception as e:
                logger.warning(f"Cartesia primary notice: {e}")

            if not synth_res or not synth_res.get("audio_bytes"):
                try:
                    res = await self.sarvam_tts.synthesize_speech(
                        text=text,
                        voice_id="sarvam-te-suhani",
                        language=self.language or "te",
                        pitch=0.12,
                        pace=1.00
                    )
                    if res.get("audio_bytes"):
                        raw_audio = res["audio_bytes"]
                        if self.output_mode in ("twilio", "plivo"):
                            source_rate = res.get("sample_rate", 22050)
                            mulaw_bytes = AudioCodecService.convert_cartesia_to_twilio(raw_audio, source_format="wav", source_rate=source_rate)
                            synth_res = {"audio_bytes": mulaw_bytes}
                        else:
                            synth_res = {"audio_bytes": raw_audio}
                except Exception as e:
                    logger.warning(f"Sarvam fallback notice: {e}")

        return synth_res

    async def _synthesize_and_send_chunk(self, text_chunk: str, turn_start_time: float, is_first: bool) -> None:
        """Synthesize text chunk via sweetest Indic TTS and push directly to audio callback."""
        if not text_chunk or not text_chunk.strip() or self.state == ConversationState.INTERRUPTED:
            return

        text_chunk = self.adapt_honorific_to_caller(text_chunk.strip())
        cleaned = clean_for_speech(text_chunk)
        normalized = normalize_numbers_to_english(cleaned)
        if not normalized.strip():
            return

        self.set_state(ConversationState.SPEAKING)
        self.speaking_start_time = time.perf_counter()
        self.is_speaking = True
        self.current_speaking_text = normalized

        synth_res = await self._synthesize_chunk_audio(normalized)

        audio_bytes = synth_res.get("audio_bytes", b"") if synth_res else b""
        if audio_bytes and self.send_audio_callback and self.state != ConversationState.INTERRUPTED:
            if getattr(self, "turn_first_audio_time", None) is None:
                self.turn_first_audio_time = time.perf_counter()
            if asyncio.iscoroutinefunction(self.send_audio_callback):
                await self.send_audio_callback(audio_bytes, normalized)
            else:
                self.send_audio_callback(audio_bytes, normalized)

    async def _execute_tool(self, tool_name: str, args: Dict[str, Any]) -> None:
        """Execute structured business tool inside DB within tenant scope using Google Hub MCP."""
        logger.info(f"[Call {self.call_id}] Executing tool '{tool_name}' with args: {args}")

        ws_id = self.employee.workspace_id if self.employee else "workspace_default_1"
        u_id = self.employee.created_by if self.employee else "user_demo_owner"

        try:
            from server.services.mcp.google_hub_mcp import google_hub_mcp
            res = await google_hub_mcp.execute_tool(
                tool_name=tool_name,
                args=args,
                db=self.db,
                user_id=u_id,
                workspace_id=ws_id
            )
            logger.info(f"[Call {self.call_id}] Google Hub MCP tool '{tool_name}' result: {res}")

            if self.send_event_callback:
                try:
                    cb_res = self.send_event_callback({
                        "type": "mcp.command_executed",
                        "tool": tool_name,
                        "status": "success" if res.get("success") else "failed",
                        "summary": res.get("confirmation_message") or f"Executed {tool_name}",
                        "result": res,
                        "hub": "Google Workspace Hub MCP"
                    })
                    if asyncio.iscoroutine(cb_res):
                        await cb_res
                except Exception:
                    pass

            if tool_name == "transfer_to_human":
                self.set_state(ConversationState.ESCALATING)
                logger.info(f"Escalating call to human executive. Reason: {args.get('reason')}")
            elif tool_name == "end_call":
                self.set_state(ConversationState.ENDING)
                logger.info(f"End call requested. Reason: {args.get('reason')}")

        except Exception as e:
            if self.db:
                self.db.rollback()
            logger.error(f"Error executing tool {tool_name}: {e}")

    async def end_conversation(self) -> Dict[str, Any]:
        """Wrap up conversation, generate AI call summary, and persist final records."""
        self.set_state(ConversationState.ENDED)
        self.is_active = False

        if self.active_turn_task and not self.active_turn_task.done():
            self.active_turn_task.cancel()

        # Generate summary
        summary_data = await self.gemini_service.generate_call_summary(self.transcript_history)

        # Update Call record if DB is attached
        if self.db:
            try:
                call_record = self.db.query(Call).filter(Call.id == self.call_id).first()
                if call_record:
                    call_record.status = "completed"
                    call_record.summary = summary_data.get("summary", "Call completed.")
                    call_record.sentiment = summary_data.get("sentiment", "Neutral")
                    call_record.transcript = self.transcript_history
                    self.db.commit()
            except Exception as e:
                self.db.rollback()
                logger.warning(f"Could not persist final call summary: {e}")

        return summary_data
