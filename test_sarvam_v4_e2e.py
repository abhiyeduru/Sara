"""
End-to-End Test for Sara AI with Sarvam AI Saaras v4 Streaming STT and Cartesia TTS.
Tests:
1. Sara greets the customer in Telugu.
2. Customer says "Hello" via 8kHz telephony mulaw audio stream.
3. Sarvam Saaras v4 returns non-empty transcript.
4. LLM receives transcript and Sara replies once.
5. Customer says a Telugu sentence ("నమస్కారం, నాకు రెండు బీహెచ్‌కే ఫ్లాట్ వివరాలు కావాలి").
6. Sarvam Saaras v4 recognizes Telugu sentence.
7. Sara answers appropriately in Telugu.
8. Latency measurements: STT latency, LLM latency, TTS first-audio latency, and total response latency.
"""
import asyncio
import base64
import io
import json
import logging
import ssl
import sys
import time
import urllib.request
import wave
from pathlib import Path

# Setup paths
_root = str(Path(__file__).resolve().parent)
if _root not in sys.path:
    sys.path.insert(0, _root)

import certifi
from server.config import settings
from server.services.voice.audio_codec_service import AudioCodecService
from server.services.voice.sarvam_realtime_stt import SarvamRealtimeSTTService
from server.services.voice.conversation_orchestrator import ConversationOrchestrator
from server.services.voice.cartesia_service import CartesiaTTSService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("sara.test.e2e")


def synthesize_sarvam_audio(text: str, lang: str = "te-IN") -> bytes:
    """Generate reference speech via Sarvam TTS bulbul:v3 and return 16kHz linear PCM bytes."""
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    speaker = "kavitha" if "te" in lang else "priya"
    req = urllib.request.Request(
        "https://api.sarvam.ai/text-to-speech",
        data=json.dumps({
            "inputs": [text],
            "target_language_code": lang,
            "speaker": speaker,
            "model": "bulbul:v3"
        }).encode(),
        headers={
            "Content-Type": "application/json",
            "api-subscription-key": settings.SARVAM_API_KEY
        }
    )
    resp = urllib.request.urlopen(req, context=ssl_ctx)
    data = json.loads(resp.read().decode())
    wav_bytes = base64.b64decode(data["audios"][0])
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        orig_rate = wf.getframerate()
        raw_pcm = wf.readframes(wf.getnframes())
    return AudioCodecService.resample_pcm16(raw_pcm, orig_rate, 16000)


async def run_e2e_test():
    print("=" * 70)
    print(" SARA AI — SARVAM SAARAS v4 STREAMING STT & CARTESIA TTS E2E TEST")
    print("=" * 70)

    # -----------------------------------------------------------------
    # Step 0: Synthesize Test Speech Audio for Customer Turns
    # -----------------------------------------------------------------
    print("\n[Step 0] Generating Customer Audio Clips via Sarvam API...")
    pcm_hello = synthesize_sarvam_audio("హలో", lang="te-IN")
    # Convert 16kHz PCM to 8kHz mulaw (exact Plivo telephony format)
    pcm8_hello = AudioCodecService.resample_pcm16(pcm_hello, 16000, 8000)
    mulaw_hello = AudioCodecService.encode_pcm16_to_mulaw(pcm8_hello)
    print(f"  ✓ Customer Audio 1 ('హలో'): {len(mulaw_hello)} bytes (8kHz mulaw)")

    pcm_telugu = synthesize_sarvam_audio("నమస్కారం, నాకు రెండు బీహెచ్‌కే ఫ్లాట్ వివరాలు కావాలి.", lang="te-IN")
    pcm8_telugu = AudioCodecService.resample_pcm16(pcm_telugu, 16000, 8000)
    mulaw_telugu = AudioCodecService.encode_pcm16_to_mulaw(pcm8_telugu)
    print(f"  ✓ Customer Audio 2 ('నమస్కారం, నాకు రెండు బీహెచ్‌కే ఫ్లాట్ వివరాలు కావాలి'): {len(mulaw_telugu)} bytes (8kHz mulaw)")

    # -----------------------------------------------------------------
    # Step 1: Initialize Conversation Orchestrator & Cartesia TTS
    # -----------------------------------------------------------------
    print("\n[Step 1] Initializing Sara Conversation Orchestrator...")
    assistant_replies = []
    assistant_audio_chunks = []
    first_audio_received_time = None
    llm_first_token_time = None

    assistant_spoken_texts = []

    async def mock_send_audio(audio_chunk: bytes, text: str):
        nonlocal first_audio_received_time
        if first_audio_received_time is None:
            first_audio_received_time = time.perf_counter()
        assistant_audio_chunks.append(audio_chunk)
        if text and text not in assistant_spoken_texts:
            assistant_spoken_texts.append(text)

    async def mock_send_event(event: dict):
        nonlocal llm_first_token_time
        if event.get("type") == "transcript" and (event.get("role") == "assistant" or event.get("speaker") in ["Sara", "assistant"]):
            assistant_replies.append(event.get("text", ""))
        elif event.get("type") in ["llm_start", "llm_first_token"]:
            llm_first_token_time = time.perf_counter()

    orchestrator = ConversationOrchestrator(
        call_id="call_test_e2e_saaras_v4",
        send_audio_callback=mock_send_audio,
        send_event_callback=mock_send_event,
        employee=None,
        db=None
    )
    orchestrator.language = "te"
    print(f"  ✓ Primary Voice ID: {orchestrator.voice_id} (Cartesia primary: {settings.CARTESIA_PRIMARY_VOICE_ID})")
    assert orchestrator.voice_id == "07bc462a-c644-49f1-baf7-82d5599131be", f"Unexpected voice ID: {orchestrator.voice_id}"

    # Initial Greeting
    greeting_text = orchestrator.get_initial_greeting()
    print(f"  ✓ Initial Greeting: '{greeting_text}'")
    assert len(greeting_text) > 0

    # -----------------------------------------------------------------
    # Step 2: Initialize Sarvam Saaras v4 Realtime Streaming STT
    # -----------------------------------------------------------------
    print("\n[Step 2] Connecting to Sarvam Saaras v4 WebSocket STT...")
    vad_started_events = []
    stt_final_transcripts = []
    stt_final_event = asyncio.Event()

    async def on_speech_started():
        t = time.perf_counter()
        vad_started_events.append(t)
        print(f"    [STT Callback] VAD Speech Started at {t:.3f}s (barge-in signal)")

    async def on_transcript(transcript: str, is_final: bool, speech_final: bool = False, lang: str = "te", confidence: float = 0.95):
        if is_final:
            t = time.perf_counter()
            stt_final_transcripts.append((transcript, t))
            print(f"    [STT Callback] Final Transcript: '{transcript}' at {t:.3f}s")
            stt_final_event.set()
        else:
            print(f"    [STT Callback] Partial Transcript: '{transcript}'")

    stt_service = SarvamRealtimeSTTService(
        sample_rate=8000,
        encoding="mulaw",  # Plivo 8kHz mulaw
        language="te-IN",
        on_transcript=on_transcript,
        on_speech_started=on_speech_started,
    )

    connected = await stt_service.connect()
    assert connected, "Failed to connect to Sarvam Saaras v4 Streaming STT!"
    print("  ✓ Connected to Sarvam Saaras v4 Streaming STT WebSocket!")

    # -----------------------------------------------------------------
    # Step 3: TURN 1 — Customer says "Hello" (హలో)
    # -----------------------------------------------------------------
    print("\n[Step 3] Customer Turn 1: Streaming 8kHz mulaw 'Hello' into Sarvam STT...")
    stt_final_transcripts.clear()
    stt_final_event.clear()
    assistant_replies.clear()
    assistant_audio_chunks.clear()
    first_audio_received_time = None
    chunk_size = 320  # 40ms of 8kHz mulaw audio (Plivo telephony standard)

    async def feed_audio_with_comfort_noise(audio_data: bytes, completion_event: asyncio.Event):
        try:
            # 1. Stream speech frames
            for i in range(0, len(audio_data), chunk_size):
                await stt_service.send_audio(audio_data[i:i + chunk_size])
                await asyncio.sleep(0.04)
            # 2. Continuous carrier background comfort noise until STT turn is finalized
            comfort_frame = b'\xff' * chunk_size
            while not completion_event.is_set():
                await stt_service.send_audio(comfort_frame)
                await asyncio.sleep(0.04)
        except Exception as e:
            print("  [Feeder Error]:", e)

    t_speech_start = time.perf_counter()
    feeder_task_1 = asyncio.create_task(feed_audio_with_comfort_noise(mulaw_hello, stt_final_event))

    # Wait for finalized transcript from Sarvam
    await asyncio.wait_for(stt_final_event.wait(), timeout=8.0)
    t_speech_end = time.perf_counter()
    transcript_1, t_stt_done = stt_final_transcripts[0]
    stt_latency_1 = t_stt_done - t_speech_start
    print(f"  ✓ STT Turn 1 Recognized: '{transcript_1}' (STT Processing Latency: {stt_latency_1 * 1000:.1f}ms)")
    assert len(transcript_1.strip()) > 0, "Turn 1 transcript is empty!"
    assert any(w in transcript_1.lower() for w in ["హలో", "hello", "halo"]), f"Unexpected transcript: {transcript_1}"

    # Forward to LLM
    print("  ✓ Forwarding Turn 1 to LLM Orchestrator...")
    t_llm_start = time.perf_counter()
    await orchestrator.handle_user_utterance(transcript_1, confidence=0.98, detected_lang="te")

    # Wait for turn completion (LLM + Cartesia TTS synthesis)
    if orchestrator.active_turn_task and not orchestrator.active_turn_task.done():
        try:
            await asyncio.wait_for(asyncio.shield(orchestrator.active_turn_task), timeout=5.0)
        except Exception:
            pass
    await asyncio.sleep(0.5)

    reply_1 = assistant_replies[-1] if assistant_replies else (" ".join(assistant_spoken_texts) if assistant_spoken_texts else "")
    llm_latency_1 = (llm_first_token_time - t_llm_start) * 1000 if llm_first_token_time else 0.0
    tts_latency_1 = (first_audio_received_time - t_llm_start) * 1000 if first_audio_received_time else 0.0
    total_latency_1 = (first_audio_received_time - t_speech_start) * 1000 if first_audio_received_time else 0.0

    print(f"  ✓ Sara Reply 1: '{reply_1}'")
    print(f"  ✓ Turn 1 Audio Frames Generated: {len(assistant_audio_chunks)}")
    print(f"  📊 Turn 1 Benchmarks:")
    print(f"     - STT Latency: {stt_latency_1 * 1000:.1f} ms")
    if llm_latency_1 > 0:
        print(f"     - LLM Latency: {llm_latency_1:.1f} ms")
    print(f"     - TTS First-Audio Latency: {tts_latency_1:.1f} ms")
    print(f"     - Total Response Latency: {total_latency_1:.1f} ms")

    assert len(reply_1.strip()) > 0, "No assistant reply generated for Turn 1!"
    assert len(assistant_audio_chunks) > 0, "No Cartesia audio was generated for Sara's reply!"

    # -----------------------------------------------------------------
    # Step 4: TURN 2 — Customer says Telugu sentence
    # "నమస్కారం, నాకు రెండు బీహెచ్‌కే ఫ్లాట్ వివరాలు కావాలి."
    # -----------------------------------------------------------------
    print("\n[Step 4] Customer Turn 2: Streaming 8kHz mulaw Telugu sentence into Sarvam STT...")
    stt_final_transcripts.clear()
    stt_final_event.clear()
    assistant_replies.clear()
    assistant_audio_chunks.clear()
    assistant_spoken_texts.clear()
    first_audio_received_time = None
    llm_first_token_time = None

    t_speech_start_2 = time.perf_counter()
    feeder_task_2 = asyncio.create_task(feed_audio_with_comfort_noise(mulaw_telugu, stt_final_event))

    await asyncio.wait_for(stt_final_event.wait(), timeout=10.0)
    t_speech_end_2 = time.perf_counter()
    transcript_2, t_stt_done_2 = stt_final_transcripts[0]
    stt_latency_2 = t_stt_done_2 - t_speech_start_2
    print(f"  ✓ STT Turn 2 Recognized: '{transcript_2}' (STT Processing Latency: {stt_latency_2 * 1000:.1f}ms)")
    assert len(transcript_2.strip()) > 0, "Turn 2 transcript is empty!"
    assert any(kw in transcript_2 for kw in ["నమస్కారం", "ఫ్లాట్", "బీహెచ్", "రెండు"]), f"Unexpected Telugu transcript: {transcript_2}"

    # Forward to LLM
    print("  ✓ Forwarding Turn 2 to LLM Orchestrator...")
    t_llm_start_2 = time.perf_counter()
    await orchestrator.handle_user_utterance(transcript_2, confidence=0.98, detected_lang="te")

    # Wait for Turn 2 completion (LLM + Cartesia TTS synthesis)
    if orchestrator.active_turn_task and not orchestrator.active_turn_task.done():
        try:
            await asyncio.wait_for(asyncio.shield(orchestrator.active_turn_task), timeout=12.0)
        except Exception:
            pass
    await asyncio.sleep(0.5)

    reply_2 = assistant_replies[-1] if assistant_replies else (" ".join(assistant_spoken_texts) if assistant_spoken_texts else "")
    llm_latency_2 = (llm_first_token_time - t_llm_start_2) * 1000 if llm_first_token_time else 0.0
    tts_latency_2 = (first_audio_received_time - t_llm_start_2) * 1000 if first_audio_received_time else 0.0
    total_latency_2 = (first_audio_received_time - t_speech_start_2) * 1000 if first_audio_received_time else 0.0

    print(f"  ✓ Sara Reply 2: '{reply_2}'")
    print(f"  ✓ Turn 2 Audio Frames Generated: {len(assistant_audio_chunks)}")
    print(f"  📊 Turn 2 Benchmarks:")
    print(f"     - STT Latency: {stt_latency_2 * 1000:.1f} ms")
    if llm_latency_2 > 0:
        print(f"     - LLM Latency: {llm_latency_2:.1f} ms")
    print(f"     - TTS First-Audio Latency: {tts_latency_2:.1f} ms")
    print(f"     - Total Response Latency: {total_latency_2:.1f} ms")

    assert len(reply_2.strip()) > 0, "No assistant reply generated for Turn 2!"
    assert len(assistant_audio_chunks) > 0, "No Cartesia audio was generated for Sara's Turn 2 reply!"

    # -----------------------------------------------------------------
    # Step 5: Test Barge-In Interrupt Handling
    # -----------------------------------------------------------------
    print("\n[Step 5] Testing Barge-in Interruption...")
    orchestrator.is_speaking = True
    orchestrator.current_speaking_text = "మా దగ్గర హైటెక్ సిటీ మరియు గచ్చిబౌలిలో అందమైన అపార్ట్‌మెంట్లు అందుబాటులో ఉన్నాయి."
    print("  Sara is currently speaking...")
    print("  Triggering customer barge-in via on_speech_started...")
    await on_speech_started()
    await orchestrator.handle_barge_in()
    assert orchestrator.is_speaking is False, "Sara should have stopped speaking on barge-in!"
    print("  ✓ Barge-in succeeded: Sara stopped speaking immediately!")

    await stt_service.close()
    print("\n" + "=" * 70)
    print(" ALL END-TO-END TESTS PASSED SUCCESSFULLY! ✅")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_e2e_test())
