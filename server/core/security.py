"""
SARA AI — Security utilities
JWT creation/verification + Firebase token validation.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
import httpx
from jose import JWTError, jwt
from fastapi import HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

logger = logging.getLogger("sara.security")
security = HTTPBearer(auto_error=False)


def _get_settings():
    from server.core.config import settings
    return settings


def create_access_token(data: dict, expires_minutes: Optional[int] = None) -> str:
    s = _get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or s.JWT_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    s = _get_settings()
    try:
        return jwt.decode(token, s.JWT_SECRET, algorithms=[s.JWT_ALGORITHM])
    except JWTError:
        return None


async def verify_firebase_token(id_token: str) -> Optional[dict]:
    s = _get_settings()
    if not s.FIREBASE_API_KEY:
        return {"uid": "demo-user-123", "email": "user@sara.ai", "display_name": "Demo User"}
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={s.FIREBASE_API_KEY}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, json={"idToken": id_token})
            if resp.status_code == 200:
                users = resp.json().get("users", [])
                if users:
                    u = users[0]
                    return {
                        "uid": u.get("localId"),
                        "email": u.get("email", ""),
                        "display_name": u.get("displayName", ""),
                    }
    except Exception as e:
        logger.warning(f"Firebase token verification error: {e}")
    return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(lambda: next(__import__('server.database', fromlist=['get_db']).get_db()))
):
    """
    FastAPI dependency: authenticate user from Bearer token (Firebase JWT or internal JWT).
    Falls back to a dev user when no valid token is provided.
    """
    from server.models import User

    token = credentials.credentials if credentials else None
    user_info = None

    if token:
        # Try internal JWT first (faster, no network)
        payload = decode_access_token(token)
        if payload:
            user_info = {
                "uid": payload.get("sub"),
                "email": payload.get("email", ""),
                "display_name": payload.get("name", ""),
            }
        else:
            # Try Firebase
            user_info = await verify_firebase_token(token)

    if not user_info:
        user_info = {
            "uid": "user_business_owner_1",
            "email": "owner@sara.ai",
            "display_name": "SARA Business Owner",
        }

    uid = user_info["uid"]
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        user = User(
            id=uid,
            email=user_info.get("email"),
            display_name=user_info.get("display_name", "User"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
