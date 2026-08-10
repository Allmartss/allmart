from fastapi import Depends, HTTPException, status

from src.auth.auth import get_current_user
from src.database.session import SessionLocal
from src.database.models import User


def require_admin(current_user: dict = Depends(get_current_user)):
    """Require admin privileges"""
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def require_verified_user(current_user: dict = Depends(get_current_user)):
    """Require email-verified user"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == current_user["email"]).first()
        if not user or not user.is_mail_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required"
            )
    finally:
        db.close()
    return current_user
