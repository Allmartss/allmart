import secrets
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from src.database.models import APIKey, User
from loguru import logger


def generate_api_key() -> str:
    return secrets.token_hex(32)  # 64-character secure key


def create_api_key(db: Session, user_id: int, key_name: str, expires_days: int = 365):
    api_key_str = generate_api_key()

    new_key = APIKey(
        user_id=user_id,
        key_name=key_name,
        api_key=api_key_str,
        expires_at=datetime.utcnow() + timedelta(days=expires_days),
        allowed_scopes=["read:status", "read:analysis", "write:trade"]  # Example scopes
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)

    logger.info(f"New API key created for user {user_id}: {key_name}")
    return new_key


def get_user_by_api_key(db: Session, api_key: str):
    key_obj = db.query(APIKey).filter(
        APIKey.api_key == api_key,
        APIKey.is_active == True
    ).first()

    if not key_obj:
        return None

    # Check expiration
    if key_obj.expires_at and key_obj.expires_at < datetime.utcnow():
        return None

    # Update last used timestamp
    key_obj.last_used_at = datetime.utcnow()
    db.commit()

    # Return full user object
    user = db.query(User).filter(User.id == key_obj.user_id).first()
    return user


def revoke_api_key(db: Session, api_key: str, user_id: int = None):
    query = db.query(APIKey).filter(APIKey.api_key == api_key)
    if user_id:
        query = query.filter(APIKey.user_id == user_id)

    key_obj = query.first()
    if key_obj:
        key_obj.is_active = False
        db.commit()
        logger.info(f"API key revoked: {api_key[:8]}...")
        return True
    return False