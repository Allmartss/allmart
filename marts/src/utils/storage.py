"""
Storage utility: upload images/files to Marts-scoped S3-compatible storage or
the local fallback.
"""

import os
import uuid
import base64
from pathlib import Path
from loguru import logger

# ── Marts-scoped S3-compatible credentials ───────────────────────────────────
S3_KEY_ID     = os.getenv("MARTS_FILE_ACCESS_KEY_ID", "").strip()
S3_ACCESS_KEY = os.getenv("MARTS_FILE_SECRET_ACCESS_KEY", "").strip()
S3_ENDPOINT   = os.getenv("MARTS_FILE_ENDPOINT_URL", "").strip()
S3_REGION     = os.getenv("MARTS_FILE_REGION", "auto").strip()
S3_BUCKET     = os.getenv("MARTS_FILE_BUCKET", "").strip()
BUCKET        = S3_BUCKET
FOLDER        = os.getenv("MARTS_STORAGE_FOLDER", "marts").strip()

LOCAL_UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"
LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# ── Availability checks ────────────────────────────────────────────────────────

def _s3_available() -> bool:
    return bool(S3_KEY_ID and S3_ACCESS_KEY and S3_ENDPOINT)


# ── S3-compatible upload (boto3) ───────────────────────────────────────────────

def _upload_s3(content: bytes, fname: str, mime: str) -> str | None:
    """Upload via boto3 S3-compatible API. Returns public URL or None on failure."""
    try:
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            region_name=S3_REGION or "auto",
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=S3_KEY_ID,
            aws_secret_access_key=S3_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )

        key = f"{FOLDER}/{fname}"
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=content,
            ContentType=mime,
        )

        # Build public URL
        endpoint = S3_ENDPOINT.rstrip("/")
        public_url = f"{endpoint}/{S3_BUCKET}/{key}"
        logger.info(f"Uploaded via S3 API: {public_url}")
        return public_url

    except ImportError:
        logger.warning("boto3 not installed — S3 upload unavailable")
        return None
    except Exception as exc:
        logger.warning(f"S3 upload failed: {exc}")
        return None


# ── Public API ─────────────────────────────────────────────────────────────────

def upload_image(content: bytes, mime: str = "image/jpeg", filename: str | None = None) -> str:
    """
    Upload raw image bytes. Returns a public URL string.

    Priority:
      1. Marts S3-compatible storage when all Marts file settings are set
      2. Local /uploads/ folder
    """
    ext  = _ext_from_mime(mime)
    fname = filename or f"{uuid.uuid4().hex}{ext}"

    if _s3_available():
        url = _upload_s3(content, fname, mime)
        if url:
            return url
        logger.warning("Marts S3 upload failed — saving locally")

    return _save_local(content, fname)


def upload_image_from_base64(data_url_or_b64: str, mime: str = "image/jpeg", filename: str | None = None) -> str:
    """
    Accept either a data-URL (data:image/...;base64,...) or a raw base64 string.
    Returns a public/relative URL.
    """
    if data_url_or_b64.startswith("data:"):
        header, b64part = data_url_or_b64.split(",", 1)
        detected_mime = header.split(":")[1].split(";")[0]
        mime = detected_mime or mime
        raw = base64.b64decode(b64part)
    else:
        raw = base64.b64decode(data_url_or_b64)

    return upload_image(raw, mime=mime, filename=filename)


def _save_local(content: bytes, fname: str) -> str:
    dest = LOCAL_UPLOADS_DIR / fname
    dest.write_bytes(content)
    logger.info(f"Saved image locally: {dest}")
    return f"/uploads/{fname}"


def _ext_from_mime(mime: str) -> str:
    mapping = {
        "image/jpeg":   ".jpg",
        "image/jpg":    ".jpg",
        "image/png":    ".png",
        "image/gif":    ".gif",
        "image/webp":   ".webp",
        "image/svg+xml": ".svg",
        "application/pdf": ".pdf",
    }
    return mapping.get(mime.lower(), ".jpg")
