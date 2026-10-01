import time
import re
import logging
from typing import Dict, Any, List, Optional
from server.providers.groq_llm import GroqLLM
from server.providers.cartesia_tts import CartesiaTTS
from server.providers.sarvam_stt import SarvamSTT
from server.engine.chunker import SentenceChunker

logger = logging.getLogger(__name__)

STAGE_TRANSITIONS = {
    "GREETING": ["DISCOVERY", "FAQ", "INFORMATION"],
    "DISCOVERY": ["QUALIFICATION", "INFORMATION", "FAQ"],
    "QUALIFICATION": ["ACTION", "INFORMATION", "OBJECTION"],
    "INFORMATION": ["QUALIFICATION", "ACTION", "FAQ", "CLOSING"],
    "FAQ": ["DISCOVERY", "QUALIFICATION", "ACTION", "CLOSING"],
    "OBJECTION": ["QUALIFICATION", "ACTION", "ESCALATION"],
    "ACTION": ["CONFIRMATION", "CLOSING"],
    "CONFIRMATION": ["CLOSING"],
    "CLOSING": ["GREETING"],
    "ESCALATION": ["CLOSING"]
}

class ConversationManager:
    """
    Stateful manager for a voice session. Orchestrates:
    - Intent and Language Detection
    - Turn State Machine (stages, slot filling)
    - Low-latency LLM streaming & phrase chunking to Cartesia TTS
    - Live Latency instrumentation (STT, LLM-TTFT, TTS-TTFA, TTFA, Total)
    - Interruption / Barge-in handling
    """
    def __init__(
        self,
        session_id: str,
        system_prompt: str,
        greeting_prompt: str,
        faqs: Optional[List[Dict[str, Any]]] = None,
        voice_id: Optional[str] = None,
        llm_provider: Optional[GroqLLM] = None,
        tts_provider: Optional[CartesiaTTS] = None,
        stt_provider: Optional[SarvamSTT] = None,
        initial_language: str = "en"
    ):
        self.session_id = session_id
        self.system_prompt = system_prompt
        self.greeting_prompt = greeting_prompt
        self.faqs = faqs or []
        self.voice_id = voice_id or "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"

        self.llm = llm_provider or GroqLLM()
        self.tts = tts_provider or CartesiaTTS()
        self.stt = stt_provider or SarvamSTT()

        # Session state
        self.stage = "GREETING"
        self.active_language = initial_language or "en"
        self.current_intent = "general"
        self.collected_fields: Dict[str, Any] = {}
        self.escalation_required = False
        self.messages: List[Dict[str, str]] = []
        self.turn_index = 0
        self.is_interrupted = False

    def detect_language(self, text: str) -> str:
        """
        Detect whether transcript is English, Telugu, or Hindi.
        Checks Telugu/Devanagari unicode blocks and common transliterated words.
        """
        # Telugu unicode range: \u0c00-\u0c7f
        if re.search(r'[\u0C00-\u0C7F]', text):
            return "te"
        # Hindi/Devanagari unicode range: \u0900-\u097f
        if re.search(r'[\u0900-\u097F]', text):
            return "hi"

        # Check common romanized Telugu words & conversational markers
        telugu_words = {
            "enti", "ela", "unnaya", "unnayi", "unnayyi", "unda", "namaskaram", "kavali",
            "cheppandi", "cheyyandi", "entha", "ekkada", "avunu", "ledu", "andi", "mee",
            "nenu", "telugu", "telugulo", "swagatham", "illu", "flat", "flats", "chudali", "konali",
            "dabbulu", "roju", "repu", "eppudu", "gurinchi", "mari", "kani", "lo", "tho", "kosam",
            "nuvvu", "meeru", "matladu", "matladandi", "artham", "kaatla", "kaavatledu", "cheppu",
            "chudu", "baga", "inkenti", "emiti", "dhara", "viluva", "kharchu", "samacharam", "manchi"
        }
        # Check common romanized Hindi words
        hindi_words = {
            "namaste", "kaise", "kya", "karna", "hai", "kitna", "batao", "chahiye", "haan",
            "nahin", "hoga", "bolo", "samajh", "aaya", "aayi", "accha", "theek"
        }

        lower_tokens = set(re.findall(r'\b\w+\b', text.lower()))
        if lower_tokens & telugu_words:
            return "te"
        if lower_tokens & hindi_words:
            return "hi"

        # If user explicitly asks to speak in Telugu or English
        if any(w in text.lower() for w in ["telugu", "telugulo", "telugu lo"]):
            return "te"

        # If agent is natively in Telugu mode, stay in Telugu unless English intent is unambiguous
        if self.active_language == "te" and not any(phrase in text.lower() for phrase in ["what is", "how much", "can you", "where is", "tell me", "i want to know"]):
            return "te"

        return "en"

    def detect_intent(self, text: str) -> str:
        """
        Fast rule-based intent categorizer with semantic fallbacks and bilingual keywords.
        """
        lower = text.lower()
        if any(w in lower for w in ["human", "agent", "representative", "person", "manager", "support executive", "మాట్లాడాలి", "ప్రతినిధి"]):
            return "human_agent_request"
        if any(w in lower for w in ["price", "cost", "pricing", "rate", "fee", "fees", "kitna", "entha", "budget", "dhara", "ధర", "ఎంత", "రేటు", "ఖరీదు", "బడ్జెట్"]):
            return "pricing_question"
        if any(w in lower for w in ["bhk", "flat", "villa", "plot", "property", "location", "gachibowli", "kondapur", "kokapet", "విల్లా", "ఫ్లాట్", "ఇల్లు", "స్క్వేర్ ఫీట్", "sq ft", "sft", "2000"]):
            return "property_inquiry"
        if any(w in lower for w in ["admission", "course", "b.tech", "btech", "cse", "college", "hostel", "scholarship", "ఫీజు"]):
            return "admission_question"
        if any(w in lower for w in ["visit", "site visit", "book", "appointment", "schedule", "tomorrow", "arrange", "సైట్ విజిట్", "చూడాలి", "విజిట్"]):
            return "booking_request"
        closing_keywords = [
            "bye", "goodbye", "thanks", "thank you", "that's all", "thats all", "nothing else",
            "stop", "stop talking", "stop the talk", "chalu", "chalu andi", "inka chalu",
            "inkem ledu", "inka ledu", "inka vaddu", "vaddu", "dhanyavadalu", "ధన్యవాదాలు",
            "సెలవు", "ఆపు", "చాలు", "ఇంకేం లేదు", "ఇంకా చాలు", "వద్దు", "డిస్కనెక్ట్",
            "disconnect", "cut the call", "end call", "cut chey", "call disconnect"
        ]
        if any(w in lower for w in closing_keywords):
            return "closing"
        return "general_question"

    def extract_slots(self, text: str):
        """
        Extract property type, budget, location, or name into collected_fields.
        """
        lower = text.lower()
        # Property type
        bhk_match = re.search(r'([1-5]\s*bhk|villa|plot)', lower)
        if bhk_match:
            self.collected_fields["property_type"] = bhk_match.group(1).upper()

        # Location
        for loc in ["gachibowli", "kondapur", "kokapet", "madhapur", "hyderabad", "hitec city"]:
            if loc in lower:
                self.collected_fields["location"] = loc.title()

        # Budget
        budget_match = re.search(r'(around\s+)?(\d+\s*(?:crore|cr|lakh|lakhs|k))', lower)
        if budget_match:
            self.collected_fields["budget"] = budget_match.group(2)

    def advance_stage(self, intent: str):
        """
        Advance state machine according to user intent.
        """
        if intent == "human_agent_request":
            self.stage = "ESCALATION"
            self.escalation_required = True
        elif intent == "booking_request":
            self.stage = "ACTION"
        elif intent in ["pricing_question", "property_inquiry", "admission_question"]:
            if self.stage in ["GREETING", "DISCOVERY"]:
                self.stage = "QUALIFICATION"
            else:
                self.stage = "INFORMATION"
        elif intent == "closing":
            self.stage = "CLOSING"

    def interrupt(self):
        """
        Barge-in signal: mark current turn as interrupted so streaming immediately terminates.
        """
        self.is_interrupted = True
        logger.info(f"Session {self.session_id} received interruption signal")
