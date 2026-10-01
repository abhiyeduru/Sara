"""
SARA AI — Exotel Telephony Webhooks
Receives and processes Exotel status callbacks and Passthru Applet requests.
"""
import logging
from fastapi import APIRouter, Request, Depends, Response
from sqlalchemy.orm import Session
from server.database import get_db
from server.services.voice.exotel_service import ExotelService

logger = logging.getLogger("sara.api.exotel_webhooks")

router = APIRouter(prefix="/api/webhooks/exotel", tags=["Exotel Webhooks"])


@router.post("/status")
@router.get("/status")
async def exotel_status_callback(request: Request, db: Session = Depends(get_db)):
    """
    Exotel status callback endpoint.
    Called when call state changes (initiated, ringing, in-progress, completed, failed).
    """
    if request.method == "POST":
        form_data = await request.form()
        data = dict(form_data)
    else:
        data = dict(request.query_params)

    logger.info(f"Received Exotel status webhook: {data}")
    result = await ExotelService.handle_status_callback(db=db, form_data=data)
    return result


@router.post("/passthru")
@router.get("/passthru")
async def exotel_passthru(request: Request, db: Session = Depends(get_db)):
    """
    Exotel Passthru Applet callback endpoint.
    Returns HTTP 200 with Exotel passthru response.
    """
    if request.method == "POST":
        data = dict(await request.form())
    else:
        data = dict(request.query_params)

    logger.info(f"Received Exotel passthru request: {data}")

    # Exotel Passthru expects a plain 200 OK or XML action
    xml_response = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Connecting to SARA AI Voice Workforce.</Say>
</Response>"""
    return Response(content=xml_response, media_type="application/xml")
