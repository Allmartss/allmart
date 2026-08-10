from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str]
    is_active: bool
    is_mail_verified: bool
    is_admin: bool
    default_capital: float
    risk_per_trade: float
    max_drawdown: float
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    default_capital: Optional[float] = None
    risk_per_trade: Optional[float] = None
    max_drawdown: Optional[float] = None
    notification_preferences: Optional[Dict] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None