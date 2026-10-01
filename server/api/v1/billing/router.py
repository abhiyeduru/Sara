"""SARA AI — /api/v1/billing router"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel

from server.database import get_db
from server.auth import get_current_user
from server.models import CreditAccount, CreditTransaction, UsageEvent, User

logger = logging.getLogger("sara.api.billing")
router = APIRouter(prefix="/api/v1/billing", tags=["Billing"])


def _get_user_account(db: Session, user: User) -> CreditAccount:
    from server.models import WorkspaceMember
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    ws_id = member.workspace_id if member else user.id

    account = db.query(CreditAccount).filter(CreditAccount.workspace_id == ws_id).first()
    if not account:
        account = db.query(CreditAccount).filter(CreditAccount.workspace_id == user.id).first()
    if not account:
        account = CreditAccount(
            workspace_id=ws_id,
            balance=1000.0,
            total_purchased=1000.0,
            plan="growth",
        )
        db.add(account)
        db.commit()
        db.refresh(account)
    return account


@router.get("/account")
@router.get("/balance")
async def get_billing_account(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get credit balance and subscription info."""
    account = _get_user_account(db, user)

    return {
        "id": account.id,
        "balance": account.balance,
        "minutes": round(account.balance / 2.5, 1),
        "total_purchased": account.total_purchased,
        "total_consumed": account.total_consumed,
        "currency": account.currency,
        "plan": account.plan,
        "updated_at": account.updated_at.isoformat() if account.updated_at else None,
    }


@router.get("/transactions")
async def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = _get_user_account(db, user)

    total = db.query(CreditTransaction).filter(CreditTransaction.account_id == account.id).count()
    txns = db.query(CreditTransaction).filter(
        CreditTransaction.account_id == account.id
    ).order_by(CreditTransaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "data": [{
            "id": t.id,
            "type": t.type,
            "amount": t.amount,
            "balance_after": t.balance_after,
            "description": t.description,
            "reference": t.reference,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        } for t in txns],
    }


@router.post("/topup")
async def topup_credits(
    amount: float = Body(..., embed=True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add credits to account (simulate payment success)."""
    if amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    account = _get_user_account(db, user)

    account.balance += amount
    account.total_purchased += amount

    txn = CreditTransaction(
        account_id=account.id,
        type="topup",
        amount=amount,
        balance_after=account.balance,
        description=f"Credit top-up — ₹{amount:,.0f} (+{round(amount/2.5, 1)} minutes)",
    )
    db.add(txn)
    db.commit()
    return {"message": f"₹{amount:,.0f} added to account", "new_balance": account.balance, "new_minutes": round(account.balance / 2.5, 1)}


@router.get("/usage")
async def usage_breakdown(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Recent usage events for billing breakdown."""
    events = db.query(UsageEvent).filter(
        UsageEvent.workspace_id == user.id
    ).order_by(UsageEvent.created_at.desc()).limit(limit).all()

    return {"data": [{
        "id": e.id,
        "event_type": e.event_type,
        "quantity": e.quantity,
        "unit_cost": e.unit_cost,
        "total_cost": e.total_cost,
        "reference_id": e.reference_id,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    } for e in events]}
