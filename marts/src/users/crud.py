from sqlalchemy.orm import Session
from src.database.models import User
from src.users.schemas import UserCreate, UserUpdate
from loguru import logger


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user: UserCreate):
    # Check if user already exists
    if get_user_by_email(db, user.email):
        raise ValueError("Email already registered")

    hashed_pw = User.hash_password(user.password)

    db_user = User(
        email=user.email,
        hashed_password=hashed_pw,
        full_name=user.full_name,
        is_active=True,          # Changed to True for better UX
        is_admin=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    logger.info(f"New user created: {user.email}")
    return db_user


def update_user(db: Session, user_id: int, update_data: UserUpdate):
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        if hasattr(user, key):
            setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


def get_all_users(db: Session):
    return db.query(User).all()


def verify_user_email(db: Session, user_id: int):
    """Mark user as email verified"""
    user = get_user_by_id(db, user_id)
    if user:
        user.is_mail_verified = True
        db.commit()
        db.refresh(user)
    return user