"""
SARA AI — Exotel Telephony Client
Maintains secure server-side connection to Exotel Voice API for Indian (+91) telephony.
"""
import re
import logging
import httpx
from typing import Dict, Any, Optional
from server.config import settings

logger = logging.getLogger("sara.voice.exotel_client")


def validate_indian_phone_number(number: str) -> str:
    """
    Validates and normalizes Indian mobile/landline numbers.
    Accepts:
      - 10 digits starting with 6, 7, 8, 9 (e.g. 9876543210)
      - with leading 0 (e.g. 09876543210)
      - with +91 (e.g. +919876543210 or +91 98765 43210)
    Returns normalized E.164 format: '+919876543210' or raises ValueError.
    """
    clean = re.sub(r"[\s\-\(\)]", "", number.strip())
    
    # +91 prefix
    if clean.startswith("+91"):
        digits = clean[3:]
    elif clean.startswith("91") and len(clean) == 12:
        digits = clean[2:]
    elif clean.startswith("0") and len(clean) == 11:
        digits = clean[1:]
    elif len(clean) == 10:
        digits = clean
    else:
        raise ValueError(f"Invalid Indian phone number format: {number}. Must be 10 digits or start with +91.")

    if not re.match(r"^[6-9]\d{9}$", digits):
        raise ValueError(f"Invalid Indian mobile number: {number}. Must begin with 6, 7, 8, or 9.")

    return f"+91{digits}"


class ExotelClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_token: Optional[str] = None,
        account_sid: Optional[str] = None,
        subdomain: Optional[str] = None,
        caller_id: Optional[str] = None,
    ):
        self._api_key = api_key
        self._api_token = api_token
        self._account_sid = account_sid
        self._subdomain = subdomain
        self._caller_id = caller_id

    @property
    def api_key(self) -> str:
        return self._api_key or settings.EXOTEL_API_KEY

    @property
    def api_token(self) -> str:
        return self._api_token or settings.EXOTEL_API_TOKEN

    @property
    def account_sid(self) -> str:
        return self._account_sid or settings.EXOTEL_ACCOUNT_SID or "mentneo4"

    @property
    def subdomain(self) -> str:
        return self._subdomain or settings.EXOTEL_SUBDOMAIN or "api.exotel.com"

    @property
    def caller_id(self) -> str:
        return self._caller_id or settings.EXOTEL_CALLER_ID or "08047288405"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_token)

    @property
    def base_url(self) -> str:
        # Standard Exotel endpoint
        return f"https://{self.subdomain}/v1/Accounts/{self.account_sid}"

    async def initiate_call(
        self,
        to_number: str,
        from_number: Optional[str] = None,
        callback_url: Optional[str] = None,
        status_callback_url: Optional[str] = None,
        custom_field: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Initiate an outbound call via Exotel connect API.
        POST /v1/Accounts/{AccountSid}/Calls/connect.json
        """
        normalized_to = validate_indian_phone_number(to_number)
        caller_phone = from_number or self.caller_id or normalized_to

        if not self.is_configured:
            # Simulation / Demo fallback when credentials not provided
            return {
                "success": False,
                "simulated": True,
                "message": "Exotel credentials not configured in environment.",
                "call_sid": f"exo_sim_{custom_field or 'test'}",
                "to": normalized_to,
                "status": "simulated"
            }

        url = f"{self.base_url}/Calls/connect.json"
        
        # Exotel expects From, To, CallerId
        payload = {
            "From": caller_phone,
            "To": normalized_to,
            "CallerId": caller_phone,
        }
        if callback_url:
            payload["Url"] = callback_url
        if status_callback_url:
            payload["StatusCallback"] = status_callback_url
        if custom_field:
            payload["CustomField"] = custom_field

        logger.info(f"Initiating Exotel call to {normalized_to} via {self.base_url}")

        auth = (self.api_key, self.api_token)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, auth=auth, data=payload)

            if res.status_code in (200, 201):
                data = res.json()
                call_info = data.get("Call", {})
                return {
                    "success": True,
                    "simulated": False,
                    "call_sid": call_info.get("Sid") or data.get("Sid"),
                    "status": call_info.get("Status", "initiated"),
                    "to": normalized_to,
                    "raw": data
                }
            else:
                logger.warning(f"Exotel call failed ({res.status_code}): {res.text}")
                return {
                    "success": False,
                    "simulated": False,
                    "error_code": res.status_code,
                    "message": f"Exotel API response ({res.status_code}): {res.text[:200]}",
                    "raw": res.text
                }
        except Exception as e:
            logger.exception(f"Exotel initiate call error: {e}")
            return {
                "success": False,
                "simulated": False,
                "error": str(e),
                "message": f"Network error connecting to Exotel: {str(e)}"
            }

    async def get_call_details(self, call_sid: str) -> Dict[str, Any]:
        """
        Fetch details of an active or past call.
        """
        if not self.is_configured or call_sid.startswith("exo_sim_"):
            return {
                "call_sid": call_sid,
                "status": "completed",
                "simulated": True
            }

        url = f"{self.base_url}/Calls/{call_sid}.json"
        auth = (self.api_key, self.api_token)
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, auth=auth)
            if res.status_code == 200:
                return res.json().get("Call", {})
            return {"error": res.text, "status_code": res.status_code}
        except Exception as e:
            return {"error": str(e)}

    async def hangup_call(self, call_sid: str) -> bool:
        """
        Hangup an in-progress call.
        """
        if not self.is_configured or call_sid.startswith("exo_sim_"):
            return True

        url = f"{self.base_url}/Calls/{call_sid}.json"
        auth = (self.api_key, self.api_token)
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(url, auth=auth, data={"Status": "completed"})
            return res.status_code in (200, 204)
        except Exception as e:
            logger.error(f"Error hanging up Exotel call: {e}")
            return False


# Singleton client
exotel_client = ExotelClient()
