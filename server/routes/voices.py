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
