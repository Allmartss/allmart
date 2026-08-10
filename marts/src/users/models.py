from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON
from sqlalchemy.orm import declarative_base
from datetime import datetime
import bcrypt

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Per-user trading preferences
    default_capital = Column(Float, default=10000.0)
    risk_per_trade = Column(Float, default=1.0)
    max_drawdown = Column(Float, default=10.0)
    preferred_tickers = Column(JSON, default=["SPX"])
    notification_preferences = Column(JSON, default={"email": True, "whatsapp": True, "telegram": True})
    
    # Broker keys (encrypted in production)
    alpaca_api_key = Column(String(255), nullable=True)
    alpaca_secret_key = Column(String(255), nullable=True)

    def verify_password(self, plain_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode('utf-8'), self.hashed_password.encode('utf-8'))

    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')