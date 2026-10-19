from fastapi import APIRouter, Query, Response, HTTPException
from typing import List, Optional, Dict, Any
from server.config import settings
from server.providers.sarvam_tts import SarvamTTS, SARVAM_VOICES
from server.providers.cartesia_tts import CartesiaTTSProvider, POPULAR_VOICES

router = APIRouter(prefix="/api/voices", tags=["Voices"])
sarvam_tts = SarvamTTS()
cartesia_tts = CartesiaTTSProvider()

ALL_VOICES = POPULAR_VOICES + [v for v in SARVAM_VOICES if v["id"] not in [pv["id"] for pv in POPULAR_VOICES]]


@router.get("")
def get_voices(
    provider: Optional[str] = Query(None, description="cartesia or sarvam"),
    gender: Optional[str] = Query(None, description="male or female"),
    language: Optional[str] = Query(None, description="te, en, hi")
):
    """
    List available voices with Cartesia primary & alternative Telugu voices at the top.
    """
    voices = []
    for v in ALL_VOICES:
        if provider and v.get("provider", "cartesia" if "-" in v["id"] else "sarvam") != provider:
            continue
        if gender and v.get("gender") != gender:
            continue
        if language and v.get("language") != language:
            continue
        voices.append({
            "id": v["id"],
            "name": v["name"],
            "gender": v.get("gender", "female"),
            "style": v.get("style", "Sweet & Natural"),
            "language": v.get("language", "te"),
            "language_name": v.get("language_name", "Telugu"),
            "provider": v.get("provider", "cartesia" if "-" in v["id"] else "sarvam"),
            "description": v.get("description", "")
        })
    return voices


@router.get("/cartesia")
async def fetch_cartesia_library():
    """
    Cartesia voices library.
    """
    return {"total": len(POPULAR_VOICES), "count": len(POPULAR_VOICES), "data": POPULAR_VOICES}


@router.get("/preview/{voice_id}")
async def preview_voice(
    voice_id: str,
    text: Optional[str] = Query(None),
    language: Optional[str] = Query("te")
):
    """
    Synthesize audio sample for preview using Cartesia or Sarvam AI.
    """
    sample_text = text
    if not sample_text:
        for v in ALL_VOICES:
            if v["id"] == voice_id and v.get("sample_text"):
                sample_text = v["sample_text"]
                break
    if not sample_text:
        sample_text = "హలో! నమస్కారం. నేను సారా మాట్లాడుతున్నాను. మీరు ఇప్పుడు ఒక నిమిషం మాట్లాడగలరా?"

    is_cartesia = "-" in voice_id and len(voice_id) > 20
    if is_cartesia or voice_id in [pv["id"] for pv in POPULAR_VOICES]:
        try:
            res = await cartesia_tts.synthesize_speech(
                text=sample_text,
                voice_id=voice_id,
                language=language or "te",
                output_mode="browser"
            )
            if res.get("audio_bytes"):
                return Response(
                    content=res["audio_bytes"],
                    media_type="audio/wav",
                    headers={
                        "X-TTS-Latency-MS": str(res.get("latency_ms", 0)),
                        "Content-Disposition": f"inline; filename=preview-{voice_id}.wav"
                    }
                )
        except Exception as e:
            pass

    # Fallback / Sarvam synthesis
    res = await sarvam_tts.synthesize_speech(text=sample_text, voice_id=voice_id, language=language)
    if not res.get("audio_bytes"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to generate voice preview"))

    return Response(
        content=res["audio_bytes"],
        media_type="audio/wav",
        headers={
            "X-TTS-Latency-MS": str(res.get("latency_ms", 0)),
            "Content-Disposition": f"inline; filename=preview-{voice_id}.wav"
        }
    )


