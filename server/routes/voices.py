import httpx
from fastapi import APIRouter, Query, Response, HTTPException
from typing import List, Optional, Dict, Any
from server.config import settings
from server.providers.cartesia_tts import CartesiaTTS
from server.providers.sarvam_tts import SarvamTTS, SARVAM_VOICES

router = APIRouter(prefix="/api/voices", tags=["Voices"])
cartesia_tts = CartesiaTTS()
sarvam_tts = SarvamTTS()


@router.get("")
def get_voices(
    provider: Optional[str] = Query(None, description="sarvam or cartesia"),
    gender: Optional[str] = Query(None, description="male or female"),
    language: Optional[str] = Query(None, description="te, en, hi")
):
    """
    List available voices from Sarvam AI (native Indian multilingual)
    and curated Cartesia neural voices.
    """
    voices = []

    # 1. Sarvam AI Voices (Primary for native Telugu, Hindi, Indian English)
    if not provider or provider == "sarvam":
        for v in SARVAM_VOICES:
            if gender and v.get("gender") != gender:
                continue
            if language and v.get("language") != language:
                continue
            voices.append({
                "id": v["id"],
                "name": v["name"],
                "gender": v.get("gender", "female"),
                "style": v.get("style", "Natural & Conversational"),
                "language": v.get("language", "te"),
                "language_name": v.get("language_name", "Telugu"),
                "provider": "sarvam",
                "description": v.get("description", "")
            })

    # 2. Cartesia Voices
    if not provider or provider == "cartesia":
        c_voices = cartesia_tts.list_voices(gender=gender)
        for cv in c_voices:
            if language and cv.get("language") != language:
                continue
            voices.append({
                "id": cv["id"],
                "name": cv["name"],
                "gender": cv.get("gender", "female"),
                "style": cv.get("style", "Neural Conversational"),
                "language": cv.get("language", "en"),
                "language_name": "Telugu" if cv.get("language") == "te" else "English",
                "provider": "cartesia",
                "description": cv.get("description", "")
            })

    return voices


@router.get("/cartesia")
async def fetch_cartesia_library(
    search: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Live search and import from Cartesia's global voice library (900+ voices).
    """
    if not settings.CARTESIA_API_KEY:
        raise HTTPException(400, "CARTESIA_API_KEY not configured")

    headers = {
        "X-API-Key": settings.CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get("https://api.cartesia.ai/voices", headers=headers)
            if r.status_code != 200:
                raise HTTPException(r.status_code, f"Cartesia API error: {r.text}")
            all_voices = r.json()

            filtered = []
            for v in all_voices:
                v_name = v.get("name", "")
                v_lang = v.get("language", "")
                v_gender = v.get("gender", "")

                if language and v_lang != language:
                    continue
                if gender and v_gender != gender:
                    continue
                if search and search.lower() not in v_name.lower() and search.lower() not in v.get("description", "").lower():
                    continue

                filtered.append({
                    "id": v.get("id"),
                    "name": v_name,
                    "language": v_lang,
                    "gender": v_gender or "female",
                    "description": v.get("description", ""),
                    "provider": "cartesia"
                })
                if len(filtered) >= limit:
                    break

            return {"total": len(all_voices), "count": len(filtered), "data": filtered}
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch Cartesia voices: {e}")


@router.get("/preview/{voice_id}")
async def preview_voice(
    voice_id: str,
    text: Optional[str] = Query(None),
    language: Optional[str] = Query("te")
):
    """
    Synthesize audio sample for preview.
    Uses Sarvam AI for sarvam-* voices, Cartesia for Cartesia UUID voices.
    """
    # 1. Sarvam Voice Preview
    if voice_id.startswith("sarvam-"):
        sample_text = text
        if not sample_text:
            for v in SARVAM_VOICES:
                if v["id"] == voice_id and v.get("sample_text"):
                    sample_text = v["sample_text"]
                    break
        if not sample_text:
            sample_text = "నమస్కారం అండీ! నేను సారా. ఏబీసీ ప్రాపర్టీస్‌కి స్వాగతం, మీకు ఏ విధంగా సహాయపడగలను?"

        res = await sarvam_tts.synthesize_speech(text=sample_text, voice_id=voice_id, language=language)
        if not res.get("audio_bytes"):
            raise HTTPException(status_code=500, detail=res.get("error", "Failed to generate Sarvam voice preview"))

        return Response(
            content=res["audio_bytes"],
            media_type="audio/wav",
            headers={
                "X-TTS-Latency-MS": str(res.get("latency_ms", 0)),
                "Content-Disposition": f"inline; filename=preview-{voice_id}.wav"
            }
        )

    # 2. Cartesia Voice Preview
    default_text = text or "Hello! I am SARA, your real-time AI voice representative. How can I help you today?"
    if (language == "te" or "te" in voice_id.lower()) and not text:
        default_text = "నమస్కారం అండీ! నేను సారా మీ తెలుగు వాయిస్ అసిస్టెంట్ ని."
        language = "te"

    res = await cartesia_tts.synthesize_speech(text=default_text, voice_id=voice_id, language=language)
    if not res.get("audio_bytes"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to generate Cartesia preview audio"))

    return Response(
        content=res["audio_bytes"],
        media_type="audio/wav",
        headers={
            "X-TTS-Latency-MS": str(res.get("latency_ms", 0)),
            "Content-Disposition": f"inline; filename=preview-{voice_id}.wav"
        }
    )
