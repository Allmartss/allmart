import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env", override=False)

class Config:
    OPENAI_API_KEY = os.getenv("MARTS_OPENAI_API_KEY", "").strip()
    JWT_SECRET_KEY = os.getenv("MARTS_JWT_SECRET", "").strip()
    DATABASE_URL = (
        os.getenv("MARTS_DATABASE_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )
    REDIS_URL = os.getenv("MARTS_REDIS_URL", "redis://localhost:6379/0")

    # Default user settings
    DEFAULT_CAPITAL = 10000.0
    DEFAULT_RISK_PERCENT = 9.0
    DEFAULT_MAX_DRAWDOWN = 90.0

config = Config()