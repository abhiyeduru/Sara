"""
SARA AI — Twilio Client Wrapper
Maintains secure server-side connection to Twilio Voice API.
"""
import logging
from typing import Optional
from twilio.rest import Client
from server.config import settings

logger = logging.getLogger("sara.voice.twilio")

_cached_client: Optional[Client] = None

def get_twilio_client() -> Client:
    """
    Get or initialize the authenticated Twilio client.
    Supports either API Key/Secret or Account SID/Auth Token.
    """
    global _cached_client
    if _cached_client is not None:
        return _cached_client

    account_sid = settings.TWILIO_ACCOUNT_SID
    auth_token = settings.TWILIO_AUTH_TOKEN
    api_key = settings.TWILIO_API_KEY
    api_secret = settings.TWILIO_API_SECRET

    if not account_sid:
        raise ValueError("TWILIO_ACCOUNT_SID is not set in environment or .env file.")

    if api_key and api_secret:
        logger.info("Initializing Twilio client using API Key/Secret.")
        _cached_client = Client(api_key, api_secret, account_sid=account_sid)
    elif auth_token:
        logger.info("Initializing Twilio client using Account SID and Auth Token.")
        _cached_client = Client(account_sid, auth_token)
    else:
        raise ValueError("Neither TWILIO_AUTH_TOKEN nor TWILIO_API_KEY/SECRET is provided.")

    return _cached_client


def get_default_from_number(client: Optional[Client] = None) -> str:
    """
    Get configured default phone number or fetch the first active incoming phone number.
    """
    if settings.TWILIO_PHONE_NUMBER:
        return settings.TWILIO_PHONE_NUMBER

    try:
        c = client or get_twilio_client()
        numbers = c.incoming_phone_numbers.list(limit=1)
        if numbers:
            return numbers[0].phone_number
        # Check verified outgoing caller IDs
        caller_ids = c.outgoing_caller_ids.list(limit=1)
        if caller_ids:
            return caller_ids[0].phone_number
    except Exception as e:
        logger.warning(f"Could not automatically fetch Twilio phone numbers: {e}")

    # Fallback placeholder for testing/dry-run
    return "+15005550006"
