import os
from dotenv import load_dotenv
from loguru import logger
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"), override=False)

# Marts owns its database configuration. DATABASE_URL is only a fallback for
# environments where a dedicated Marts connection is not available.
MARTS_DATABASE_URL = os.getenv("MARTS_DATABASE_URL", "").strip()
FALLBACK_DB_URL = os.getenv("DATABASE_URL", "").strip()

# Kept as a compatibility export for the extracted route module. It stays empty
# so health/admin diagnostics never mislabel the Marts database as Supabase.
SUPABASE_DB_URL = ""
supabase_client = None

# ── Resolve which PostgreSQL URL to use ──────────────────────────────────────
def _resolve_database_url() -> str:
    """
    Priority:
      1. MARTS_DATABASE_URL — dedicated Marts PostgreSQL connection string
      2. DATABASE_URL       — fallback PostgreSQL connection string
    """
    if MARTS_DATABASE_URL:
        logger.info("Database → dedicated Marts PostgreSQL (MARTS_DATABASE_URL)")
        return MARTS_DATABASE_URL

    logger.info("Database → fallback PostgreSQL (DATABASE_URL)")
    if FALLBACK_DB_URL:
        return FALLBACK_DB_URL

    raise RuntimeError(
        "MARTS_DATABASE_URL is not set and DATABASE_URL is unavailable. "
        "Configure a PostgreSQL connection before starting Marts."
    )


DATABASE_URL = _resolve_database_url()

# ── SQLAlchemy engine ─────────────────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Returns True if the database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("DB connection check failed — {}", exc)
        return False
