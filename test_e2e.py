import sys
import asyncio
import json
import time

# Ensure Windows terminal outputs UTF-8 (for Indian rupee sign and Telugu/Hindi characters)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient
from server.main import app
from server.database import SessionLocal
from server.models import VoiceAgent, LatencyMetric

def run_e2e_tests():
    print("==================================================")
    print("     SARA REAL-TIME AI VOICE AGENT E2E TESTS     ")
    print("==================================================")

    client = TestClient(app)

    # 1. Test Health Endpoint
    print("\n[TEST 1] Testing /api/health...")
    resp = client.get("/api/health")
    print("Status:", resp.status_code)
    print("Response:", resp.json())
    assert resp.status_code == 200
    assert resp.json().get("status") == "healthy"
    print(">> Health check PASSED!")

    # 2. Test Business Templates / Categories
    print("\n[TEST 2] Testing /api/agents/categories...")
    resp = client.get("/api/agents/categories")
    assert resp.status_code == 200
    cats = resp.json()
    print("Categories found:", list(cats.keys()))
    assert "Real Estate" in cats
    assert "College / University" in cats
    print(">> Categories check PASSED!")

    # 3. Test Agent Listing (User Isolation)
    print("\n[TEST 3] Testing /api/agents...")
    resp = client.get("/api/agents")
    assert resp.status_code == 200
    agents = resp.json()
    print(f"User agents found: {len(agents)}")
    assert len(agents) > 0
    # Pick Real Estate agent for property testing
    agent = next((a for a in agents if a.get("business_type") == "Real Estate"), agents[0])
    agent_id = agent["id"]
    print(f">> Agent loaded: {agent['name']} ({agent['business_type']}), ID: {agent_id}")

    # 4. Test Cartesia Live Voice Preview
    print("\n[TEST 4] Testing /api/voices/preview with Cartesia...")
    voice_id = agent["voice_id"]
    resp = client.get(f"/api/voices/preview/{voice_id}?text=Namaste! Welcome to SARA.")
    print("Preview Status:", resp.status_code)
    print("Audio bytes received:", len(resp.content))
    print("TTS Latency header (ms):", resp.headers.get("x-tts-latency-ms"))
    assert resp.status_code == 200
    assert len(resp.content) > 1000
    print(">> Cartesia voice preview PASSED!")

    # 5. Test Real-Time WebSocket Voice Pipeline
    print("\n[TEST 5] Testing Real-Time Voice WebSocket Session...")
    with client.websocket_connect(f"/ws/voice/{agent_id}") as ws:
        # Step 5a: Receive session.started event
        start_msg = ws.receive_json()
        print("WS Received:", start_msg.get("type"), f"(Agent: {start_msg.get('agent_name')})")
        assert start_msg.get("type") == "session.started"

        # Step 5b: Receive greeting audio
        greet_audio = ws.receive_json()
        print("WS Received:", greet_audio.get("type"), f"(Greeting Audio Bytes: {len(greet_audio.get('audio', ''))})")
        assert greet_audio.get("type") == "tts.audio"

        # Step 5c: Send User Question in English
        print("\n--- Sending Turn 1: English Property Query ---")
        ws.send_json({
            "type": "text.input",
            "text": "What is the starting price for a 2 BHK?"
        })

        # Receive state event
        state_ev = ws.receive_json()
        print("State:", state_ev.get("stage"), f"| Lang: {state_ev.get('language')} | Intent: {state_ev.get('intent')}")
        assert state_ev.get("language") == "en"
        assert state_ev.get("intent") == "pricing_question"

        # Receive streaming events
        tokens = []
        audio_chunks = 0
        turn_metrics = None

        while True:
            ev = ws.receive_json()
            ev_type = ev.get("type")
            if ev_type == "llm.token":
                tokens.append(ev.get("token"))
            elif ev_type == "tts.audio":
                audio_chunks += 1
            elif ev_type == "turn.completed":
                turn_metrics = ev.get("metrics")
                break

        full_reply = "".join(tokens).strip()
        print(f"SARA Response ({audio_chunks} audio chunks):", full_reply)
        print("Actual Measured Latencies:", turn_metrics)
        assert turn_metrics is not None
        assert turn_metrics["time_to_first_audio_ms"] > 0
        assert "85" in full_reply or "Lakh" in full_reply or "price" in full_reply.lower()
        print(">> Turn 1 PASSED!")

        # Step 5d: Send User Question in Telugu (Code-Switching)
        print("\n--- Sending Turn 2: Telugu Multilingual Code-Switching ---")
        ws.send_json({
            "type": "text.input",
            "text": "Hyderabad lo 2 BHK available unda?"
        })

        state_ev = ws.receive_json()
        print("State:", state_ev.get("stage"), f"| Lang: {state_ev.get('language')} | Intent: {state_ev.get('intent')}")
        assert state_ev.get("language") == "te"

        tokens = []
        audio_chunks = 0
        while True:
            ev = ws.receive_json()
            ev_type = ev.get("type")
            if ev_type == "llm.token":
                tokens.append(ev.get("token"))
            elif ev_type == "tts.audio":
                audio_chunks += 1
            elif ev_type == "turn.completed":
                break

        print(f"SARA Telugu Response ({audio_chunks} audio chunks):", "".join(tokens).strip())
        print(">> Turn 2 Multilingual PASSED!")

        # Step 5e: Test Barge-In / Interruption
        print("\n--- Sending Turn 3: Interruption / Barge-In ---")
        ws.send_json({
            "type": "user.interrupt"
        })
        interrupt_ev = ws.receive_json()
        print("Interruption event:", interrupt_ev.get("type"), f"({interrupt_ev.get('message')})")
        assert interrupt_ev.get("type") == "agent.interrupted"
        print(">> Interruption / Barge-in PASSED!")

    # 6. Verify Database Persistence of Metrics
    print("\n[TEST 6] Verifying Latency Metrics in Neon PostgreSQL...")
    db = SessionLocal()
    metrics = db.query(LatencyMetric).filter(LatencyMetric.session_id == start_msg.get("session_id")).all()
    print(f"Persisted turn metrics in Neon DB: {len(metrics)}")
    assert len(metrics) > 0
    for m in metrics:
        print(f"Turn #{m.turn_index}: LLM TTFT={m.llm_first_token_ms}ms, TTS First Audio={m.tts_first_audio_ms}ms, TTFA={m.time_to_first_audio_ms}ms, Total={m.total_response_ms}ms")
    db.close()
    print(">> Database persistence PASSED!")

    print("\n==================================================")
    print("  ALL E2E ACCEPTANCE TESTS COMPLETED SUCCESSFULLY ")
    print("==================================================")

if __name__ == "__main__":
    run_e2e_tests()
