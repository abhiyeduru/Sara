import sys
import asyncio
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from server.database import SessionLocal
from server.models import VoiceAgent
from server.providers.groq_llm import GroqLLM
from server.providers.cartesia_tts import CartesiaTTS

def test_multilingual():
    print("==========================================================")
    print("      SARA MULTILINGUAL VOICE & CODE-SWITCHING TEST       ")
    print("==========================================================")

    db = SessionLocal()
    agent = db.query(VoiceAgent).filter(VoiceAgent.business_type == "Real Estate").first()
    system_prompt = agent.generated_prompt.full_prompt
    db.close()

    llm = GroqLLM()
    tts = CartesiaTTS()

    tests = [
        {"lang": "English", "input": "What is the starting price for a 2 BHK?"},
        {"lang": "Telugu", "input": "Hyderabad lo 2 BHK available unda?"},
        {"lang": "Hindi", "input": "2 BHK ki starting price kitni hai?"},
        {"lang": "Code-Switching (Te+En)", "input": "Gachibowli lo site visit arrange cheyyagalara tomorrow?"}
    ]

    for t in tests:
        print(f"\n--- Testing {t['lang']} ---")
        print(f"Caller: \"{t['input']}\"")

        tokens = []
        async def run_turn():
            async for chk in llm.stream_chat(
                messages=[{"role": "user", "content": t['input']}],
                system_prompt=system_prompt,
                max_tokens=60
            ):
                if chk.get("token"): tokens.append(chk["token"])
        asyncio.run(run_turn())
        reply = "".join(tokens).strip()
        print(f"SARA Reply ({t['lang']}): \"{reply}\"")

        # Synthesize audio with Cartesia
        async def run_tts():
            return await tts.synthesize_speech(text=reply, voice_id=agent.voice_id)
        tts_res = asyncio.run(run_tts())
        print(f"Cartesia Voice Synthesized: {len(tts_res.get('audio_bytes', b''))} bytes, Latency: {tts_res.get('latency_ms')} ms")
        assert len(tts_res.get("audio_bytes", b"")) > 1000
        print(f">> {t['lang']} Voice Test PASSED!")

    print("\n==========================================================")
    print("  ALL MULTILINGUAL & CODE-SWITCHING VOICE TESTS PASSED!   ")
    print("==========================================================")

if __name__ == "__main__":
    test_multilingual()
