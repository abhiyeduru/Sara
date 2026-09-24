from fastapi import APIRouter, Query, Response, HTTPException
from typing import List, Optional
from server.providers.cartesia_tts import CartesiaTTS
from server.schemas import VoiceItemResponse

router = APIRouter(prefix="/api/voices", tags=["Voices"])
tts = CartesiaTTS()

@router.get("", response_model=List[VoiceItemResponse])
def get_voices(gender: Optional[str] = Query(None, description="male or female")):
    """List available Cartesia neural voices with characteristics"""
    voices = tts.list_voices(gender=gender)
    return voices

@router.get("/preview/{voice_id}")
async def preview_voice(
    voice_id: str,
    text: Optional[str] = Query("Hello! I am SARA, your real-time AI voice representative. How can I help you today?"),
    language: Optional[str] = Query("en")
):
    """
    Synthesize live audio sample for voice selection preview.
    Returns real audio/wav bytes directly.
    """
    is_te = (language == "te") or ("te" in voice_id.lower()) or (voice_id in ["3a8e6fea-81e5-4d4d-8755-86093146cdb8", "330c4fa0-1da3-4c55-8e97-951bfd724e20", "07bc462a-c644-49f1-baf7-82d5599131be"])
    if is_te and (text.startswith("Hello!") or text.startswith("Namaste!")):
        text = "నమస్కారం అండీ! నేను సారా మీ తెలుగు వాయిస్ అసిస్టెంట్ ని. మీకు ఏ విధంగా సహాయపడగలను?"
        language = "te"

    res = await tts.synthesize_speech(text=text, voice_id=voice_id, language=language)
    if not res.get("audio_bytes"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to generate preview audio"))

    return Response(
        content=res["audio_bytes"],
        media_type="audio/wav",
        headers={
            "X-TTS-Latency-MS": str(res.get("latency_ms", 0)),
            "Content-Disposition": f"inline; filename=preview-{voice_id}.wav"
        }
    )
