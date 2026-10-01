"""
SARA AI — /api/v1/phone-numbers router (Twilio Virtual Phone Lines)
Search, purchase, view, and assign phone numbers to AI employees.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import PhoneNumber, User
from server.services.voice.number_service import NumberService

logger = logging.getLogger("sara.api.phone_numbers")
router = APIRouter(prefix="/api/v1/phone-numbers", tags=["Phone Numbers"])


class BuyNumberRequest(BaseModel):
    phone_number: str
    friendly_name: Optional[str] = None


class AssignNumberRequest(BaseModel):
    phone_number_id: str
    employee_id: Optional[str] = None


@router.get("")
async def list_phone_numbers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all configured virtual phone lines for this workspace."""
    numbers = NumberService.list_numbers(db, user.id)
    return {"data": numbers, "total": len(numbers)}


@router.get("/search")
async def search_available_numbers(
    country: str = Query("US", min_length=2, max_length=2),
    area_code: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=30),
    user: User = Depends(get_current_user),
):
    """Search available Twilio numbers available for immediate purchase."""
    available = NumberService.search_available(country_code=country, area_code=area_code, limit=limit)
    return {"data": available, "total": len(available)}


@router.post("/buy", status_code=201)
async def buy_phone_number(
    body: BuyNumberRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Purchase a Twilio number and configure Sara AI webhook routing."""
    res = NumberService.buy_and_configure(
        db=db,
        workspace_id=user.id,
        phone_number=body.phone_number,
        friendly_name=body.friendly_name,
    )
    return res


@router.post("/assign")
async def assign_phone_number(
    body: AssignNumberRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Assign phone number to an AI employee."""
    success = NumberService.assign_to_employee(
        db=db,
        phone_number_id=body.phone_number_id,
        employee_id=body.employee_id,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Phone number not found.")
    return {"status": "assigned", "phone_number_id": body.phone_number_id, "employee_id": body.employee_id}


@router.delete("/{number_id}")
async def delete_phone_number(
    number_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove phone number from workspace."""
    num = db.query(PhoneNumber).filter(
        PhoneNumber.id == number_id,
        PhoneNumber.workspace_id == user.id
    ).first()
    if not num:
        raise HTTPException(status_code=404, detail="Phone number not found.")
    db.delete(num)
    db.commit()
    return {"status": "deleted", "id": number_id}
