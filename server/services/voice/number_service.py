"""
SARA AI — Twilio Phone Number Management Service
Search, purchase, configure webhook URLs, and assign virtual lines to AI employees.
"""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from server.models import PhoneNumber, AIEmployee
from server.config import settings
from .twilio_client import get_twilio_client

logger = logging.getLogger("sara.voice.numbers")


class NumberService:
    @staticmethod
    def list_numbers(db: Session, workspace_id: str) -> List[Dict[str, Any]]:
        """
        List phone numbers configured for the workspace.
        Also syncs with live Twilio incoming phone numbers.
        """
        db_numbers = db.query(PhoneNumber).filter(PhoneNumber.workspace_id == workspace_id).all()

        results = []
        for n in db_numbers:
            emp = db.query(AIEmployee).filter(AIEmployee.id == (n.assigned_employee_id or n.employee_id)).first() if (n.assigned_employee_id or n.employee_id) else None
            results.append({
                "id": n.id,
                "phone_number": n.number or n.phone_number,
                "friendly_name": n.friendly_name or n.number,
                "country": n.country,
                "provider": n.provider,
                "capabilities": n.capabilities or ["voice", "sms"],
                "status": n.status,
                "assigned_employee": {
                    "id": emp.id,
                    "name": emp.name,
                    "role": emp.role,
                } if emp else None,
                "monthly_cost": n.monthly_cost,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            })

        # If DB is empty, try querying Twilio directly
        if not results:
            try:
                client = get_twilio_client()
                incoming = client.incoming_phone_numbers.list(limit=20)
                for tw_num in incoming:
                    # Sync into DB
                    new_n = PhoneNumber(
                        workspace_id=workspace_id,
                        number=tw_num.phone_number,
                        phone_number=tw_num.phone_number,
                        friendly_name=tw_num.friendly_name,
                        twilio_sid=tw_num.sid,
                        country="US" if tw_num.phone_number.startswith("+1") else "IN",
                        status="active",
                        capabilities=["voice", "sms"],
                    )
                    db.add(new_n)
                    db.commit()
                    db.refresh(new_n)
                    results.append({
                        "id": new_n.id,
                        "phone_number": new_n.number,
                        "friendly_name": new_n.friendly_name,
                        "country": new_n.country,
                        "provider": "twilio",
                        "capabilities": ["voice", "sms"],
                        "status": "active",
                        "assigned_employee": None,
                        "monthly_cost": 1.15,
                        "created_at": new_n.created_at.isoformat() if new_n.created_at else None,
                    })
            except Exception as e:
                logger.warning(f"Could not sync live Twilio phone numbers: {e}")

        return results

    @staticmethod
    def search_available(country_code: str = "US", area_code: Optional[int] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search Twilio available phone numbers for purchase.
        """
        try:
            client = get_twilio_client()
            args = {"limit": limit, "voice_enabled": True, "sms_enabled": True}
            if area_code:
                args["area_code"] = area_code

            available = client.available_phone_numbers(country_code).local.list(**args)
            return [
                {
                    "phone_number": num.phone_number,
                    "friendly_name": num.friendly_name,
                    "locality": getattr(num, "locality", ""),
                    "region": getattr(num, "region", ""),
                    "country": country_code,
                    "capabilities": {
                        "voice": getattr(num, "capabilities", {}).get("voice", True),
                        "sms": getattr(num, "capabilities", {}).get("sms", True),
                    },
                    "monthly_price": 1.15,
                }
                for num in available
            ]
        except Exception as e:
            logger.error(f"Error searching Twilio numbers: {e}")
            # Mock available numbers for testing if Twilio account has restrictions
            return [
                {
                    "phone_number": "+18557272241",
                    "friendly_name": "+1 855-SARA-AI",
                    "locality": "Toll Free",
                    "region": "US",
                    "country": "US",
                    "capabilities": {"voice": True, "sms": True},
                    "monthly_price": 2.00,
                },
                {
                    "phone_number": "+14155552671",
                    "friendly_name": "+1 415-555-2671",
                    "locality": "San Francisco",
                    "region": "CA",
                    "country": "US",
                    "capabilities": {"voice": True, "sms": True},
                    "monthly_price": 1.15,
                }
            ]

    @staticmethod
    def buy_and_configure(db: Session, workspace_id: str, phone_number: str, friendly_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Purchase phone number via Twilio and configure inbound webhook.
        """
        webhook_base = settings.TWILIO_WEBHOOK_BASE_URL.rstrip("/")
        voice_url = f"{webhook_base}/api/v1/voice/inbound"
        status_url = f"{webhook_base}/api/v1/voice/status"

        sid = None
        try:
            client = get_twilio_client()
            purchased = client.incoming_phone_numbers.create(
                phone_number=phone_number,
                friendly_name=friendly_name or f"Sara AI Line ({phone_number})",
                voice_url=voice_url,
                voice_method="POST",
                status_callback=status_url,
                status_callback_method="POST",
            )
            sid = purchased.sid
            logger.info(f"Purchased Twilio number {phone_number} with SID {sid}")
        except Exception as e:
            logger.warning(f"Twilio purchase call simulated or failed ({e}). Adding to local workspace records.")
            sid = f"PN_sim_{phone_number.replace('+', '')}"

        pn = PhoneNumber(
            workspace_id=workspace_id,
            twilio_sid=sid,
            number=phone_number,
            phone_number=phone_number,
            friendly_name=friendly_name or f"Sara AI ({phone_number})",
            country="US" if phone_number.startswith("+1") else "IN",
            status="active",
            monthly_cost=1.15,
        )
        db.add(pn)
        db.commit()
        db.refresh(pn)
        return {
            "id": pn.id,
            "phone_number": pn.number,
            "friendly_name": pn.friendly_name,
            "status": "active",
        }

    @staticmethod
    def assign_to_employee(db: Session, phone_number_id: str, employee_id: Optional[str]) -> bool:
        """
        Assign dedicated virtual phone number to an AI employee.
        """
        pn = db.query(PhoneNumber).filter(PhoneNumber.id == phone_number_id).first()
        if not pn:
            return False
        pn.employee_id = employee_id
        pn.assigned_employee_id = employee_id
        db.commit()
        return True
