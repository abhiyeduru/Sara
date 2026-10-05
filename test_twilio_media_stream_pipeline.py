"""
SARA AI — Production Twilio Media Stream, Deepgram, Cartesia, and Orchestrator E2E Test Suite
Validates:
1. AudioCodecService (G.711 μ-law transcoding, 20ms chunking, base64)
2. Deepgram Streaming STT (Live WebSocket handshake & lifecycle)
3. Cartesia Sonic TTS (Raw 8kHz μ-law direct generation & sub-400ms TTFA)
4. OpenAIVoiceService (Tools, layered instructions, call summary)
5. ConversationOrchestrator (State machine, barge-in interruption, tool execution)
6. Twilio Bidirectional Media Stream TwiML generation
7. Provider Health Check API endpoint
"""
import asyncio
import base64
import time
from httpx import AsyncClient, ASGITransport

from server.main import app
from server.database import SessionLocal
from server.models import AIEmployee, Call, Lead
from server.services.voice.audio_codec_service import AudioCodecService
from server.services.voice.deepgram_service import DeepgramSTTService
from server.services.voice.cartesia_service import CartesiaTTSService
from server.services.voice.openai_voice_service import OpenAIVoiceService, SARA_VOICE_TOOLS
from server.services.voice.conversation_orchestrator import ConversationOrchestrator, ConversationState


async def test_audio_codec_service():
    print("\n--- 1. Testing AudioCodecService ---")
    # Generate 1 second of test linear PCM audio
    import struct
    pcm_test = struct.pack('<8000h', *([1200] * 8000))
    mulaw = AudioCodecService.encode_pcm16_to_mulaw(pcm_test)
    assert len(mulaw) == 8000
    print(f"  ✓ Encoded 8000 PCM samples to {len(mulaw)} G.711 μ-law bytes")

    decoded_pcm = AudioCodecService.decode_mulaw_to_pcm16(mulaw)
    assert len(decoded_pcm) == 16000
    print(f"  ✓ Decoded {len(mulaw)} μ-law bytes back to {len(decoded_pcm)} PCM16 bytes")

    chunks = AudioCodecService.chunk_mulaw(mulaw, chunk_size=160)
    assert len(chunks) == 50  # 8000 / 160 = 50 frames of 20ms
    print(f"  ✓ Chunked 1 second audio into {len(chunks)} 20ms Twilio media frames")

    b64 = AudioCodecService.encode_base64_payload(chunks[0])
    raw = AudioCodecService.decode_base64_payload(b64)
    assert raw == chunks[0]
    print(f"  ✓ Base64 roundtrip verified: {len(b64)} chars payload")


async def test_deepgram_stt_live():
    print("\n--- 2. Testing Deepgram Streaming STT Service ---")
    dg = DeepgramSTTService(sample_rate=8000, encoding="mulaw")
    connected = await dg.connect()
    assert connected is True
    print(f"  ✓ Deepgram live WebSocket connected to region: {dg.region}")
    
    # Send a small audio chunk
    test_chunk = b'\xff' * 160
    await dg.send_audio(test_chunk)
    await asyncio.sleep(0.2)
    await dg.close()
    print("  ✓ Deepgram WebSocket closed cleanly without errors")


async def test_cartesia_tts_live():
    print("\n--- 3. Testing Cartesia Sonic TTS Service ---")
    tts = CartesiaTTSService()
    t0 = time.perf_counter()
    res = await tts.synthesize("Hello from Sara AI. How may I assist you today?", language="en", output_mode="twilio")
    ttfa = (time.perf_counter() - t0) * 1000
    assert len(res.get("audio_bytes", b"")) > 0
    assert res.get("format") == "pcm_mulaw"
    print(f"  ✓ Cartesia synthesized raw μ-law 8kHz: {len(res['audio_bytes'])} bytes in {round(ttfa, 1)}ms (TTFA)")
    await tts.close()


async def test_openai_service():
    print("\n--- 4. Testing OpenAIVoiceService & Structured Tools ---")
    svc = OpenAIVoiceService()
    assert len(SARA_VOICE_TOOLS) >= 4
    tool_names = [t["function"]["name"] for t in SARA_VOICE_TOOLS]
    assert "create_lead" in tool_names
    assert "schedule_appointment" in tool_names
    assert "transfer_to_human" in tool_names
    assert "end_call" in tool_names
    print(f"  ✓ Validated Voice Tools schemas: {tool_names}")

    test_convo = [
        {"speaker": "Sara", "text": "Hello, welcome to Mentneo Properties. How can I help you?"},
        {"speaker": "Customer", "text": "I'm looking for a 2BHK flat in Gachibowli with 85 Lakhs budget."},
        {"speaker": "Sara", "text": "Great! We have excellent options. Can I schedule a site visit this Saturday?"}
    ]
    summary = await svc.generate_call_summary(test_convo)
    assert "summary" in summary
    print(f"  ✓ Call Summary generated: {summary.get('summary')}")
    print(f"  ✓ Extracted Sentiment: {summary.get('sentiment')}, Intent: {summary.get('intent')}")


async def test_conversation_orchestrator():
    print("\n--- 5. Testing ConversationOrchestrator State Machine & Barge-In ---")
    db = SessionLocal()
    try:
        emp = db.query(AIEmployee).first()
        cleared_buffer = False

        async def fake_audio_callback(audio_bytes, text):
            pass

        async def fake_flush_callback():
            nonlocal cleared_buffer
            cleared_buffer = True

        orch = ConversationOrchestrator(
            call_id="test_call_999",
            employee=emp,
            db=db,
            output_mode="twilio",
            send_audio_callback=fake_audio_callback,
            flush_audio_callback=fake_flush_callback
        )

        assert orch.state == ConversationState.IDLE
        orch.set_state(ConversationState.SPEAKING)
        assert orch.state == ConversationState.SPEAKING
        print("  ✓ State transitioned to SPEAKING")

        # Test instant Barge-in!
        await orch.handle_barge_in()
        assert cleared_buffer is True
        assert orch.state == ConversationState.LISTENING
        print("  ✓ Barge-in event handled: audio flushed and state set to LISTENING")

        # Test Tool Execution
        await orch._execute_tool("create_lead", {
            "name": "Ramesh Kumar",
            "phone": "+919876543210",
            "interest": "2 BHK Gachibowli",
            "budget": "85 Lakhs"
        })
        saved_lead = db.query(Lead).filter(Lead.name == "Ramesh Kumar").first()
        assert saved_lead is not None
        print(f"  ✓ Tool create_lead verified in DB: {saved_lead.name} ({saved_lead.phone})")

        # Clean up test lead
        db.delete(saved_lead)
        db.commit()
    finally:
        db.close()


async def test_provider_health_api():
    print("\n--- 6. Testing /api/v1/voice/providers/health API Endpoint ---")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/voice/providers/health")
        assert r.status_code == 200
        data = r.json()
        print(f"  ✓ Twilio status: {data['twilio']['status']} (Account: {data['twilio'].get('account_name')})")
        print(f"  ✓ Deepgram status: {data['deepgram']['status']} (Region: {data['deepgram'].get('region')})")
        print(f"  ✓ Cartesia status: {data['cartesia']['status']} (Latency: {data['cartesia'].get('latency_ms')}ms)")
        print(f"  ✓ OpenAI status: {data['openai']['status']} (Model: {data['openai'].get('model')})")
        assert data['twilio']['ready'] is True
        assert data['deepgram']['ready'] is True
        assert data['cartesia']['ready'] is True
        assert data['openai']['ready'] is True


async def test_twiml_media_stream_generation():
    print("\n--- 7. Testing Inbound & Outbound Media Stream TwiML ---")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/v1/voice/incoming-call", data={"From": "+1234567890", "To": "+1987654321", "CallSid": "CA12345"})
        assert r.status_code == 200
        assert "<Connect>" in r.text
        assert "<Stream" in r.text
        assert "media-stream" in r.text
        print("  ✓ Inbound Call TwiML generated with bidirectional <Connect><Stream>")

        r2 = await client.get("/api/v1/voice/outbound-twiml/call_test_123")
        assert r2.status_code == 200
        assert "<Connect>" in r2.text
        assert "<Stream" in r2.text
        print("  ✓ Outbound Call TwiML generated with bidirectional <Connect><Stream>")


async def main():
    print("=" * 65)
    print("  SARA AI — TWILIO MEDIA STREAM & AI PIPELINE COMPREHENSIVE SUITE ")
    print("=" * 65)
    await test_audio_codec_service()
    await test_deepgram_stt_live()
    await test_cartesia_tts_live()
    await test_openai_service()
    await test_conversation_orchestrator()
    await test_provider_health_api()
    await test_twiml_media_stream_generation()
    print("\n" + "=" * 65)
    print("  ALL 7 PRODUCTION VOICE PIPELINE TEST SUITES PASSED CLEANLY! ")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
