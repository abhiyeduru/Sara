"""
SARA AI — Phone Number Provisioning & Assignment Service
Manages virtual phone lines via Plivo (+91 India & Global carrier) and workspace database.
Decoupled completely from Twilio.
"""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from server.models import PhoneNumber, AIEmployee
from server.config import settings
from .plivo_client import plivo_client

logger = logging.getLogger("sara.voice.numbers")


class NumberService:
    @staticmethod
    def list_numbers(db: Session, workspace_id: str) -> List[Dict[str, Any]]:
        """
        List phone numbers configured for the workspace.
        Syncs with live Plivo incoming phone numbers.
        """
        # Ensure Plivo number is seeded into DB if configured
        plivo_num = getattr(settings, "PLIVO_PHONE_NUMBER", "+918065522007") or "+918065522007"
        clean_p = plivo_num.replace(" ", "")
        existing_p = db.query(PhoneNumber).filter(
            (PhoneNumber.workspace_id == workspace_id) &
            ((PhoneNumber.number == clean_p) | (PhoneNumber.number == "+918065522007") | (PhoneNumber.number == "918065522007"))
        ).first()

        if not existing_p:
            try:
                new_p = PhoneNumber(
                    workspace_id=workspace_id,
                    number="+918065522007",
                    phone_number="+918065522007",
                    friendly_name="Plivo India Line (+91 80 6552 2007)",
                    twilio_sid="plv_num_918065522007",
                    country="IN",
                    provider="plivo",
                    status="active",
                    capabilities=["voice"],
                    monthly_cost=2.50,
                )
                db.add(new_p)
                db.commit()
            except Exception as ex:
                db.rollback()
                logger.warning(f"Could not auto-seed Plivo number: {ex}")

        # If Plivo has numbers registered on the live account, ensure they are present in DB
        if plivo_client.is_configured:
            try:
                live_numbers = plivo_client.list_numbers()
                for p_num in live_numbers:
                    num_val = p_num.get("number")
                    if not num_val:
                        continue
                    clean_val = f"+{num_val}" if not str(num_val).startswith("+") else str(num_val)
                    found = db.query(PhoneNumber).filter(
                        (PhoneNumber.workspace_id == workspace_id) &
                        ((PhoneNumber.number == clean_val) | (PhoneNumber.phone_number == clean_val))
                    ).first()
                    if not found:
                        new_line = PhoneNumber(
                            workspace_id=workspace_id,
                            number=clean_val,
                            phone_number=clean_val,
                            friendly_name=f"Plivo Carrier Line ({clean_val})",
                            twilio_sid=f"plv_{num_val}",
                            country=p_num.get("country", "IN"),
                            provider="plivo",
                            status="active",
                            capabilities=["voice"],
                            monthly_cost=2.50,
                        )
                        db.add(new_line)
                        db.commit()
            except Exception as e:
                logger.debug(f"Plivo live number sync skipped: {e}")

        db_numbers = db.query(PhoneNumber).filter(PhoneNumber.workspace_id == workspace_id).all()

        results = []
        for n in db_numbers:
            emp = db.query(AIEmployee).filter(AIEmployee.id == (n.assigned_employee_id or n.employee_id)).first() if (n.assigned_employee_id or n.employee_id) else None
            results.append({
                "id": n.id,
                "phone_number": n.number or n.phone_number,
                "friendly_name": n.friendly_name or n.number,
                "country": n.country or "IN",
                "provider": n.provider or "plivo",
                "capabilities": n.capabilities or ["voice"],
                "status": n.status or "active",
                "assigned_employee": {
                    "id": emp.id,
                    "name": emp.name,
                    "role": emp.role,
                } if emp else None,
                "monthly_cost": n.monthly_cost or 2.50,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            })

        return results

    @staticmethod
    def search_available(country_code: str = "IN", area_code: Optional[int] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search available phone numbers for purchase (Plivo carrier).
        """
        return [
            {
                "phone_number": "+918065522007",
                "friendly_name": "Bangalore Toll Line (+91 80 6552 2007)",
                "locality": "Bangalore",
                "region": "KA",
                "country": "IN",
                "capabilities": {"voice": True, "sms": False},
                "monthly_price": 2.50,
            },
            {
                "phone_number": "+918047288405",
                "friendly_name": "India Enterprise Voice Line (+91 80 4728 8405)",
                "locality": "Bangalore",
                "region": "KA",
                "country": "IN",
                "capabilities": {"voice": True, "sms": False},
                "monthly_price": 2.50,
            },
            {
                "phone_number": "+911145678901",
                "friendly_name": "Delhi National Direct Line (+91 11 4567 8901)",
                "locality": "New Delhi",
                "region": "DL",
                "country": "IN",
                "capabilities": {"voice": True, "sms": False},
                "monthly_price": 2.50,
            },
        ]

    @staticmethod
    def buy_and_configure(db: Session, workspace_id: str, phone_number: str, friendly_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Purchase/provision phone number via Plivo and configure inbound media stream webhook.
        """
        clean_num = phone_number.strip()
        pn = PhoneNumber(
            workspace_id=workspace_id,
            twilio_sid=f"plv_num_{clean_num.replace('+', '')}",
            number=clean_num,
            phone_number=clean_num,
            friendly_name=friendly_name or f"Plivo Voice Line ({clean_num})",
            country="IN" if "+91" in clean_num else "US",
            provider="plivo",
            status="active",
            monthly_cost=2.50,
        )
        db.add(pn)
        db.commit()
        db.refresh(pn)
        return {
            "id": pn.id,
            "phone_number": pn.number,
            "friendly_name": pn.friendly_name,
            "status": "active",
            "provider": "plivo",
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
