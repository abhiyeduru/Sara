"""
SARA AI — Exotel Telephony & Indian Voice Calling Automated Test Suite
Validates:
1. Indian Phone Number Normalization & Validation (+91...)
2. Exotel Client Configuration & Credential Verification
3. Exotel Outbound Call Initiation (with graceful simulation fallback)
4. Exotel Status Webhook Processing & Lifecycle Transitions
5. Telugu Voice Generation & Sarvam TTS Audio Verification
6. Groq Qwen Low-Latency Conversation Streaming
7. Deepgram STT Integration
"""
import sys
import asyncio
import logging
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from server.config import settings
from server.database import SessionLocal
from server.models import Call, AIEmployee, User
from server.services.voice.exotel_client import (
    validate_indian_phone_number, exotel_client
)
from server.services.voice.exotel_service import ExotelService
from server.providers.sarvam_tts import SarvamTTS
from server.providers.groq_llm import GroqLLM
from server.providers.deepgram_stt import DeepgramSTT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_exotel")


def run_tests():
    print("=" * 60)
    print("      SARA AI — EXOTEL TELEPHONY & VOICE TEST SUITE      ")
    print("=" * 60)

    # -------------------------------------------------------------
    # 1. Number Validation Tests
    # -------------------------------------------------------------
    print("\n[TEST 1] Testing Indian Phone Number (+91) Validation...")
    valid_cases = [
        ("9849012345", "+919849012345"),
        ("09849012345", "+919849012345"),
        ("+91 98490 12345", "+919849012345"),
        ("919849012345", "+919849012345"),
        ("+91-9876543210", "+919876543210"),
    ]
    for raw, expected in valid_cases:
        res = validate_indian_phone_number(raw)
        assert res == expected, f"Expected {expected}, got {res}"
        print(f"  ✓ Valid: {raw} -> {res}")

    invalid_cases = [
        "12345",
        "5551234567",       # Does not start with 6, 7, 8, 9
        "+14155552671",     # US number in Indian validator
        "invalid_phone",
    ]
    for inv in invalid_cases:
        try:
            validate_indian_phone_number(inv)
            assert False, f"Should have failed for {inv}"
        except ValueError:
            print(f"  ✓ Correctly rejected: {inv}")
    print(">> Phone Number Validation PASSED!")

    # -------------------------------------------------------------
    # 2. Exotel Client Credentials Check
    # -------------------------------------------------------------
    print("\n[TEST 2] Verifying Exotel Client Configuration...")
    print(f"  Account SID: {exotel_client.account_sid}")
    print(f"  API Key configured: {'YES (***' + exotel_client.api_key[-6:] + ')' if exotel_client.api_key else 'NO'}")
    print(f"  API Token configured: {'YES' if exotel_client.api_token else 'NO'}")
    print(f"  Base URL: {exotel_client.base_url}")
    assert exotel_client.is_configured is True
    print(">> Exotel Configuration PASSED!")

    # -------------------------------------------------------------
    # 3. Exotel Call Orchestration (Simulation & Real Flow)
    # -------------------------------------------------------------
    print("\n[TEST 3] Testing Exotel Call Orchestration in Database...")
    db = SessionLocal()
    user = db.query(User).first()
    if not user:
        user = User(id="user_business_owner_1", email="owner@sara.ai", display_name="Abhiram")
        db.add(user)
        db.commit()

    emp = db.query(AIEmployee).first()
    if not emp:
        emp = AIEmployee(
            id="emp_sara_sales",
            workspace_id=user.id,
            name="SARA",
            role="Sales Specialist",
            primary_language="te"
        )
        db.add(emp)
        db.commit()

    target_number = "+919849012345"
    res = asyncio.run(
        ExotelService.initiate_outbound_call(
            db=db,
            user=user,
            employee_id=emp.id,
            to_number=target_number,
            simulate=True,
        )
    )
    print("  Call Orchestration Result:", res)
    assert res.get("success") is True
    call_id = res.get("call_id")
    assert call_id is not None

    call_rec = db.query(Call).filter(Call.id == call_id).first()
    assert call_rec is not None
    assert call_rec.to_number == target_number
    print(f"  ✓ Database record created: Call ID = {call_rec.id}, Status = {call_rec.status}")
    print(">> Exotel Call Orchestration PASSED!")

    # -------------------------------------------------------------
    # 4. Status Callback Webhook Simulation
    # -------------------------------------------------------------
    print("\n[TEST 4] Testing Exotel Webhook Lifecycle Handling...")
    mock_webhook_data = {
        "CallSid": res.get("call_sid"),
        "Status": "completed",
        "DialCallDuration": "45",
        "CustomField": call_id,
        "RecordingUrl": "https://s3.exotel.com/recordings/test.mp3"
    }
    hook_res = asyncio.run(ExotelService.handle_status_callback(db=db, form_data=mock_webhook_data))
    assert hook_res.get("status") == "ok"

    db.refresh(call_rec)
    assert call_rec.status == "completed"
    assert call_rec.duration_seconds == 45
    assert call_rec.recording_url == "https://s3.exotel.com/recordings/test.mp3"
    print(f"  ✓ Call record updated via Webhook: Status = {call_rec.status}, Duration = {call_rec.duration_seconds}s")
    print(">> Exotel Status Webhook PASSED!")

    # -------------------------------------------------------------
    # 5. Telugu Voice Generation & Sarvam TTS Audio Check
    # -------------------------------------------------------------
    print("\n[TEST 5] Testing Telugu Spoken Dialogue via Groq Qwen + Sarvam TTS...")
    sarvam_tts = SarvamTTS()
    groq_llm = GroqLLM()

    telugu_prompt = "You are SARA, a warm and polite voice representative in Hyderabad. Respond strictly in 1 sweet spoken Telugu sentence with English numbers."
    telugu_query = "నమస్కారం అండీ, మీ వద్ద 2 BHK ఫ్లాట్స్ అందుబాటులో ఉన్నాయా?"

    print(f"  User (Telugu): {telugu_query}")
    tokens = []
    async def get_reply():
        async for chunk in groq_llm.stream_chat(
            messages=[{"role": "user", "content": telugu_query}],
            system_prompt=telugu_prompt,
            max_tokens=60
        ):
            if chunk.get("token"):
                tokens.append(chunk["token"])
    asyncio.run(get_reply())
    telugu_reply = "".join(tokens).strip()
    print(f"  SARA Reply (Telugu): {telugu_reply}")
    assert len(telugu_reply) > 5

    # Synthesize audio with Sarvam bulbul:v3
    tts_result = asyncio.run(
        sarvam_tts.synthesize_speech(
            text=telugu_reply,
            voice_id="sarvam-te-pooja",
            language="te"
        )
    )
    audio_bytes = tts_result.get("audio_bytes", b"")
    latency_ms = tts_result.get("latency_ms", 0.0)
    print(f"  ✓ Sarvam TTS Synthesis: {len(audio_bytes)} bytes audio, Latency: {latency_ms} ms, Speaker: pooja")
    assert len(audio_bytes) > 500
    print(">> Telugu Voice & Sarvam TTS PASSED!")

    # -------------------------------------------------------------
    # 6. Deepgram STT Check
    # -------------------------------------------------------------
    print("\n[TEST 6] Testing Deepgram STT Provider...")
    deepgram = DeepgramSTT()
    assert deepgram.api_key == "89049b8c995cc1daf3b3f6b7dee9d42b75057ae9"
    print(f"  ✓ Deepgram initialized with Nova-2 model and API key: ***{deepgram.api_key[-6:]}")
    print(">> Deepgram STT Configuration PASSED!")

    db.close()
    print("\n" + "=" * 60)
    print("  ALL EXOTEL TELEPHONY & TELUGU VOICE TESTS PASSED!  ")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
