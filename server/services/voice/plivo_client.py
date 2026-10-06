"""
SARA AI — Plivo Telephony Client
Maintains secure server-side connection to Plivo Voice API for Indian (+91) and global telephony.
"""
import re
import logging
from typing import Dict, Any, Optional, List
import plivo
from server.config import settings

logger = logging.getLogger("sara.voice.plivo_client")


def normalize_plivo_phone_number(number: str) -> str:
    """
    Standardize raw phone numbers for Plivo Voice API.
    Plivo accepts digits (e.g. 918065522007) or E.164 (+918065522007).
    Converts 10-digit Indian numbers starting with 6-9 to 91XXXXXXXXXX.
    """
    if not number:
        return ""
    clean = re.sub(r"[\s\-\(\)\.]", "", str(number).strip())
    if clean.startswith("+"):
        clean = clean[1:]
    # If 10 digits starting with 6-9 (Indian mobile), prefix with 91
    if len(clean) == 10 and clean[0] in "6789":
        clean = f"91{clean}"
    # If starts with leading 0 and has 11 digits (e.g. 08065522007 or 09849012345)
    elif clean.startswith("0") and len(clean) == 11:
        clean = f"91{clean[1:]}"
    return clean


class PlivoClient:
    """
    Plivo REST Client Wrapper providing high-level telephony helpers:
    - Outbound call initiation
    - Call hangup / termination
    - Phone number listing & inspection
    - Account balance & identity verification
    """

    def __init__(
        self,
        auth_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        caller_id: Optional[str] = None,
    ):
        self._auth_id = auth_id
        self._auth_token = auth_token
        self._caller_id = caller_id
        self._client: Optional[plivo.RestClient] = None

    @property
    def auth_id(self) -> str:
        return self._auth_id or settings.PLIVO_AUTH_ID

    @property
    def auth_token(self) -> str:
        return self._auth_token or settings.PLIVO_AUTH_TOKEN

    @property
    def caller_id(self) -> str:
        raw = self._caller_id or settings.PLIVO_PHONE_NUMBER or "+918065522007"
        return normalize_plivo_phone_number(raw)

    @property
    def is_configured(self) -> bool:
        return bool(self.auth_id and self.auth_token)

    def get_client(self) -> plivo.RestClient:
        if not self.is_configured:
            raise ValueError("Plivo credentials (PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN) are not set in environment.")
        if self._client is None:
            self._client = plivo.RestClient(auth_id=self.auth_id, auth_token=self.auth_token)
        return self._client

    def initiate_call(
        self,
        to_number: str,
        from_number: Optional[str] = None,
        answer_url: Optional[str] = None,
        hangup_url: Optional[str] = None,
        ring_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Initiate an outbound call via Plivo Voice API.
        """
        client = self.get_client()
        clean_to = normalize_plivo_phone_number(to_number)
        clean_from = normalize_plivo_phone_number(from_number) if from_number else self.caller_id

        if not clean_to:
            raise ValueError(f"Invalid destination phone number: {to_number}")

        kwargs: Dict[str, Any] = {
            "from_": clean_from,
            "to_": clean_to,
            "answer_url": answer_url,
            "answer_method": "POST",
        }
        if hangup_url:
            kwargs["hangup_url"] = hangup_url
            kwargs["hangup_method"] = "POST"
        if ring_url:
            kwargs["ring_url"] = ring_url
            kwargs["ring_method"] = "POST"

        logger.info(f"Plivo: Initiating outbound call from {clean_from} -> {clean_to} (answer_url={answer_url})")
        resp = client.calls.create(**kwargs)

        request_uuid = getattr(resp, "request_uuid", None)
        message = getattr(resp, "message", "call initiated")
        api_id = getattr(resp, "api_id", None)

        return {
            "success": True,
            "request_uuid": request_uuid,
            "call_uuid": request_uuid,
            "api_id": api_id,
            "message": message,
            "to": clean_to,
            "from": clean_from,
        }

    def hangup_call(self, call_uuid: str) -> Dict[str, Any]:
        """Hang up an active call by UUID."""
        client = self.get_client()
        clean_uuid = call_uuid.replace("plv_", "").replace("exo_", "").replace("CA_", "")
        try:
            client.calls.delete(clean_uuid)
            logger.info(f"Plivo: Terminated call {clean_uuid}")
            return {"success": True, "call_uuid": clean_uuid}
        except Exception as e:
            logger.warning(f"Plivo hangup failed for {clean_uuid}: {e}")
            return {"success": False, "error": str(e)}

    def record_call(self, call_uuid: str, callback_url: Optional[str] = None) -> Dict[str, Any]:
        """Start carrier-level call recording on Plivo."""
        client = self.get_client()
        clean_uuid = call_uuid.replace("plv_", "").replace("exo_", "").replace("CA_", "")
        try:
            kwargs = {"file_format": "mp3"}
            if callback_url:
                kwargs["callback_url"] = callback_url
                kwargs["callback_method"] = "POST"
            resp = client.calls.record(clean_uuid, **kwargs)
            rec_url = getattr(resp, "url", None)
            logger.info(f"🎙️ Plivo: Started recording call {clean_uuid} (url={rec_url})")
            return {"success": True, "call_uuid": clean_uuid, "recording_url": rec_url}
        except Exception as e:
            logger.debug(f"Plivo recording start notice for {clean_uuid}: {e}")
            return {"success": False, "error": str(e)}

    def stop_recording_call(self, call_uuid: str) -> Dict[str, Any]:
        """Stop carrier-level call recording on Plivo."""
        client = self.get_client()
        clean_uuid = call_uuid.replace("plv_", "").replace("exo_", "").replace("CA_", "")
        try:
            client.calls.record_stop(clean_uuid)
            logger.info(f"🎙️ Plivo: Stopped recording call {clean_uuid}")
            return {"success": True, "call_uuid": clean_uuid}
        except Exception as e:
            logger.debug(f"Plivo recording stop notice for {clean_uuid}: {e}")
            return {"success": False, "error": str(e)}

    def list_numbers(self) -> List[Dict[str, Any]]:
        """List all active numbers on this Plivo account."""
        if not self.is_configured:
            return []
        try:
            client = self.get_client()
            nums = client.numbers.list()
            results = []
            for n in nums:
                results.append({
                    "number": getattr(n, "number", ""),
                    "alias": getattr(n, "alias", ""),
                    "carrier": getattr(n, "carrier", "Plivo"),
                    "city": getattr(n, "city", ""),
                    "country": getattr(n, "country", "India"),
                    "voice_enabled": getattr(n, "voice_enabled", True),
                    "active": getattr(n, "active", True),
                    "application": getattr(n, "application", ""),
                })
            return results
        except Exception as e:
            logger.error(f"Error fetching Plivo numbers: {e}")
            return []

    def get_account_summary(self) -> Dict[str, Any]:
        """Fetch Plivo account balance and profile details."""
        if not self.is_configured:
            return {"configured": False}
        try:
            client = self.get_client()
            acc = client.account.get()
            return {
                "configured": True,
                "auth_id": self.auth_id,
                "name": getattr(acc, "name", ""),
                "billing_mode": getattr(acc, "billing_mode", "prepaid"),
                "cash_credits": getattr(acc, "cash_credits", "0.00"),
                "account_type": getattr(acc, "account_type", "standard"),
                "default_phone": self.caller_id,
            }
        except Exception as e:
            logger.error(f"Error fetching Plivo account summary: {e}")
            return {"configured": True, "error": str(e), "auth_id": self.auth_id}


plivo_client = PlivoClient()
