"""
SARA AI — Twilio Call Recording Handler
Receives recording callbacks, updates media URLs, and triggers intelligence.
"""
import logging
from sqlalchemy.orm import Session
from server.models import Call
from .voice_events import voice_events_bus

logger = logging.getLogger("sara.voice.recording")


class RecordingService:
    @staticmethod
    def handle_recording_callback(
        db: Session,
        call_id: str,
        recording_url: str,
        recording_sid: str,
        duration: int = 0
    ) -> bool:
        """
        Record the Twilio recording MP3 URL on the call and broadcast event.
        """
        call = db.query(Call).filter(Call.id == call_id).first()
        if not call:
            logger.warning(f"Recording received for unknown call_id: {call_id}")
            return False

        # Twilio recording URL typically needs .mp3 suffix for direct playback
        media_url = recording_url if recording_url.endswith(".mp3") else f"{recording_url}.mp3"
        call.recording_url = media_url
        if duration and (not call.duration_seconds or call.duration_seconds == 0):
            call.duration_seconds = duration

        db.commit()

        voice_events_bus.publish(call_id, "call.recording_ready", {
            "recording_url": media_url,
            "recording_sid": recording_sid,
            "duration": duration,
        })
        logger.info(f"🎙️ [Call {call_id}] Recording saved: {media_url}")
        return True
