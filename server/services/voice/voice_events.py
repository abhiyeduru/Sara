"""
SARA AI — Voice Call Event Bus & Dispatcher
Powers real-time Live Calls UI and audits lifecycle events.
"""
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Callable
from server.database import SessionLocal
from server.models import CallEvent

logger = logging.getLogger("sara.voice.events")


class VoiceEventBus:
    def __init__(self):
        self._listeners: List[Callable[[Dict[str, Any]], None]] = []

    def subscribe(self, callback: Callable[[Dict[str, Any]], None]):
        self._listeners.append(callback)

    def unsubscribe(self, callback: Callable[[Dict[str, Any]], None]):
        if callback in self._listeners:
            self._listeners.remove(callback)

    def publish(self, call_id: str, event_type: str, metadata: Dict[str, Any] = None):
        """
        Record event to database and broadcast to real-time subscribers.
        """
        now = datetime.now(timezone.utc)
        payload = {
            "call_id": call_id,
            "event_type": event_type,
            "timestamp": now.isoformat(),
            "metadata": metadata or {},
        }

        # 1. Persist to DB
        try:
            db = SessionLocal()
            try:
                ev = CallEvent(
                    call_id=call_id,
                    event_type=event_type,
                    timestamp=now,
                    event_metadata=metadata or {},
                )
                db.add(ev)
                db.commit()
            except Exception as e:
                logger.error(f"Error persisting call event {event_type} for call {call_id}: {e}")
                db.rollback()
            finally:
                db.close()
        except Exception as e:
            logger.error(f"DB session error for voice event {event_type}: {e}")

        # 2. Notify subscribers
        for listener in self._listeners:
            try:
                listener(payload)
            except Exception as e:
                logger.error(f"Error dispatching event to listener: {e}")

        logger.info(f"📞 [Call {call_id[:8]}] Event: {event_type} | {metadata}")


voice_events_bus = VoiceEventBus()
