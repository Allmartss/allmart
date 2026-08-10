from sqlalchemy.orm import Session
from src.database.session import SessionLocal
from src.users.models import User
import bcrypt
import os
from loguru import logger

def setup_admin():
    db: Session = SessionLocal()
    admin_email = "admin@finevent.ai"
    
    existing = db.query(User).filter(User.email == admin_email).first()
    if existing:
        logger.info("Admin user already exists")
        db.close()
        return

    default_password = "AdminChangeMe123!"   # Change this immediately after first login
    hashed = User.hash_password(default_password)

    admin = User(
        email=admin_email,
        hashed_password=hashed,
        full_name="System Administrator",
        is_active=True,
        is_admin=True,
        default_capital=50000.0,
        risk_per_trade=0.5,
        max_drawdown=8.0
    )
    
    db.add(admin)
    db.commit()
    db.refresh(admin)
    
    logger.success(f"✅ Admin user created!")
    logger.warning(f"Admin Email: {admin_email}")
    logger.warning(f"Admin Password: {default_password}  ← CHANGE THIS IMMEDIATELY!")
    logger.info("Login at /admin or Streamlit admin dashboard on port 8502")
    
    db.close()

if __name__ == "__main__":
    setup_admin()