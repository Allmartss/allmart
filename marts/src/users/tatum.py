"""
Tatum blockchain monitoring service.

Priority chain map:
  crypto_btc  → BTC
  crypto_eth  → ETH
  crypto_usdt → TRON  (USDT-TRC20 lives on Tron)

Webhook flow:
  1. User submits deposit → POST /wallet/deposit
  2. Backend calls subscribe_address() → Tatum monitors the address
  3. Tatum fires POST /api/tatum/webhook when a tx arrives
  4. Backend matches the tx to a pending deposit by address + time window
  5. mempool=True  → status "pending_confirmation", notify user
  6. mempool=False → auto-approve, credit balance, notify user
"""
import os
import httpx
from loguru import logger
from typing import Optional

TATUM_BASE = "https://api.tatum.io/v3"

CHAIN_MAP: dict[str, str] = {
    "crypto_btc":  "BTC",
    "crypto_eth":  "ETH",
    "crypto_usdt": "TRON",
}

# Minimum confirmations before auto-approve per chain
MIN_CONFIRMATIONS: dict[str, int] = {
    "BTC":  1,   # we rely on mempool=False from Tatum
    "ETH":  1,
    "TRON": 1,
}


def is_configured() -> bool:
    return bool(os.getenv("TATUM_API_KEY", "").strip())


def _headers() -> dict:
    key = os.getenv("TATUM_API_KEY", "").strip()
    if not key:
        raise EnvironmentError("TATUM_API_KEY is not set")
    return {"x-api-key": key, "Content-Type": "application/json"}


def ping() -> dict:
    """Verify the API key is valid — used in admin health check."""
    if not is_configured():
        return {"status": "not_configured", "message": "TATUM_API_KEY not set"}
    try:
        resp = httpx.get(
            f"{TATUM_BASE}/subscription?pageSize=1",
            headers=_headers(),
            timeout=6.0,
        )
        if resp.status_code in (200, 204):
            return {"status": "OK", "message": "Tatum API key valid"}
        return {"status": "ERROR", "message": f"HTTP {resp.status_code}: {resp.text[:120]}"}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)[:120]}


def subscribe_address(chain: str, address: str, webhook_url: str) -> Optional[str]:
    """
    Register an ADDRESS_TRANSACTION subscription on Tatum.
    Returns the subscription ID or None if Tatum is not configured / request fails.
    """
    if not is_configured():
        logger.info("Tatum not configured — skipping subscription")
        return None
    try:
        resp = httpx.post(
            f"{TATUM_BASE}/subscription",
            headers=_headers(),
            json={
                "type": "ADDRESS_TRANSACTION",
                "attr": {
                    "address": address,
                    "chain":   chain,
                    "url":     webhook_url,
                },
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        sub_id = resp.json().get("id")
        logger.info(f"Tatum subscribed {chain}:{address[:12]}… → {sub_id}")
        return sub_id
    except Exception as e:
        logger.warning(f"Tatum subscribe failed for {chain}:{address[:12]}…: {e}")
        return None


def unsubscribe(subscription_id: str) -> bool:
    """Cancel a Tatum address subscription."""
    if not is_configured():
        return False
    try:
        resp = httpx.delete(
            f"{TATUM_BASE}/subscription/{subscription_id}",
            headers=_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()
        logger.info(f"Tatum unsubscribed {subscription_id}")
        return True
    except Exception as e:
        logger.warning(f"Tatum unsubscribe {subscription_id} failed: {e}")
        return False


def list_subscriptions(page: int = 0, page_size: int = 50) -> list:
    """List active Tatum subscriptions (admin use)."""
    if not is_configured():
        return []
    try:
        resp = httpx.get(
            f"{TATUM_BASE}/subscription?pageSize={page_size}&offset={page * page_size}",
            headers=_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json() if isinstance(resp.json(), list) else []
    except Exception as e:
        logger.warning(f"Tatum list_subscriptions failed: {e}")
        return []


def build_webhook_url() -> str:
    """Build the publicly accessible webhook URL for this Replit deployment."""
    domain = os.getenv("REPLIT_DEV_DOMAIN", "").strip()
    if domain:
        return f"https://{domain}/api/tatum/webhook"
    app_url = os.getenv("APP_URL", "").strip().rstrip("/")
    if app_url:
        return f"{app_url}/api/tatum/webhook"
    return ""
