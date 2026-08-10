"""
Macro / economic data utility.

• Treasury yields, VIX, Dollar Index, Gold, Oil — via yfinance (no API key needed).
• FRED economic series (CPI, GDP, unemployment, Fed Funds Rate, etc.) — via FRED REST API.
  Requires a FREE FRED API key: https://fred.stlouisfed.org/docs/api/api_key.html
  Set env var:  FRED_API_KEY=your_key

OpenBB Platform is used as the router when installed; falls back to direct library
calls so the backend keeps working regardless.
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timedelta
from loguru import logger

import requests
import yfinance as yf

# ── in-process cache ────────────────────────────────────────────────────────
_CACHE: dict = {}
_TTL_LIVE    = 300     # 5 min  – prices / yields
_TTL_MACRO   = 3600    # 1 h    – economic snapshot
_TTL_HISTORY = 7200    # 2 h    – historical series
_TTL_FRED    = 3600    # 1 h    – FRED observations


def _get(key: str, ttl: int):
    e = _CACHE.get(key)
    return e["data"] if (e and time.time() - e["ts"] < ttl) else None


def _set(key: str, data):
    _CACHE[key] = {"data": data, "ts": time.time()}


# ── OpenBB optional ─────────────────────────────────────────────────────────
_OBB_AVAILABLE = False
try:
    from openbb import obb  # type: ignore
    _OBB_AVAILABLE = True
    logger.info("OpenBB Platform loaded ✓")
except Exception:
    logger.info("OpenBB not available — using direct yfinance/FRED fallback")


# ═══════════════════════════════════════════════════════════════════════════
#  SECTION 1 — Treasury Yield Curve  (yfinance, no key)
# ═══════════════════════════════════════════════════════════════════════════

_YIELD_TICKERS: dict[str, str] = {
    "13W": "^IRX",
    "5Y":  "^FVX",
    "10Y": "^TNX",
    "30Y": "^TYX",
}

# Additional maturities OpenBB/FRED can fill when key is present
_FRED_YIELD_SERIES: dict[str, str] = {
    "1M":  "DGS1MO",
    "3M":  "DGS3MO",
    "6M":  "DGS6MO",
    "1Y":  "DGS1",
    "2Y":  "DGS2",
    "5Y":  "DGS5",
    "10Y": "DGS10",
    "20Y": "DGS20",
    "30Y": "DGS30",
}


def get_yield_curve() -> dict:
    """
    Treasury yield curve snapshot.
    13W / 5Y / 10Y / 30Y always available (yfinance).
    Full curve (1M-30Y) available when FRED_API_KEY is set.
    """
    cached = _get("yield_curve", _TTL_LIVE)
    if cached:
        return cached

    curve: dict = {}

    # Always-available via yfinance
    for label, ticker in _YIELD_TICKERS.items():
        try:
            info = yf.Ticker(ticker).fast_info
            price = getattr(info, "last_price", None)
            curve[label] = {"value": round(price, 4) if price else None, "source": "yfinance"}
        except Exception as exc:
            logger.warning(f"yfinance yield {ticker}: {exc}")
            curve[label] = {"value": None, "source": "yfinance"}

    # Supplement with FRED when key is available
    fred_key = os.getenv("FRED_API_KEY", "")
    if fred_key:
        for label, series_id in _FRED_YIELD_SERIES.items():
            if label in curve and curve[label]["value"] is not None:
                continue  # already have it
            try:
                obs = _fred_fetch(series_id, limit=1, api_key=fred_key)
                if obs:
                    curve[label] = {"value": obs[0]["value"], "source": "fred"}
            except Exception:
                pass

    result = {
        "curve": curve,
        "inverted": _is_inverted(curve),
        "note": "Full curve (1M-30Y) available with FRED_API_KEY env var" if not fred_key else None,
    }
    _set("yield_curve", result)
    return result


def _is_inverted(curve: dict) -> bool:
    try:
        v2  = curve.get("2Y",  {}).get("value") or curve.get("13W", {}).get("value")
        v10 = curve.get("10Y", {}).get("value")
        return bool(v2 and v10 and float(v2) > float(v10))
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════════════════
#  SECTION 2 — Market / Risk Indicators  (yfinance, no key)
# ═══════════════════════════════════════════════════════════════════════════

_MARKET_TICKERS: dict[str, tuple[str, str]] = {
    # slug             ticker        label
    "vix":           ("^VIX",       "CBOE Volatility Index (VIX)"),
    "usd_index":     ("DX-Y.NYB",   "US Dollar Index (DXY)"),
    "sp500":         ("^GSPC",      "S&P 500"),
    "nasdaq":        ("^IXIC",      "NASDAQ Composite"),
    "dow":           ("^DJI",       "Dow Jones Industrial"),
    "russell2000":   ("^RUT",       "Russell 2000"),
    "gold":          ("GC=F",       "Gold Futures (USD/oz)"),
    "oil_wti":       ("CL=F",       "WTI Crude Oil Futures"),
    "oil_brent":     ("BZ=F",       "Brent Crude Oil Futures"),
    "nat_gas":       ("NG=F",       "Natural Gas Futures"),
    "silver":        ("SI=F",       "Silver Futures (USD/oz)"),
    "copper":        ("HG=F",       "Copper Futures"),
    "btc":           ("BTC-USD",    "Bitcoin / USD"),
    "eth":           ("ETH-USD",    "Ethereum / USD"),
    "treasury_10y":  ("^TNX",       "10-Year Treasury Yield"),
    "treasury_30y":  ("^TYX",       "30-Year Treasury Yield"),
}


def get_market_indicators() -> dict:
    """
    Live snapshot of risk indicators, major indices, commodities, and crypto.
    No API key required.
    """
    cached = _get("market_indicators", _TTL_LIVE)
    if cached:
        return cached

    result: dict = {}
    for slug, (ticker, label) in _MARKET_TICKERS.items():
        try:
            info = yf.Ticker(ticker).fast_info
            price = getattr(info, "last_price", None)
            prev  = getattr(info, "previous_close", None)
            pct   = round(((price - prev) / prev) * 100, 3) if price and prev else None
            result[slug] = {
                "label":      label,
                "value":      round(price, 4) if price else None,
                "prev_close": round(prev, 4)  if prev  else None,
                "pct_change": pct,
                "ticker":     ticker,
            }
        except Exception as exc:
            logger.warning(f"market indicator {ticker}: {exc}")
            result[slug] = {"label": label, "value": None, "error": str(exc)}

    _set("market_indicators", result)
    return result


def get_historical_ohlcv(symbol: str, days: int = 90) -> dict:
    """
    OHLCV history for any equity / ETF / index via yfinance.
    No API key required.
    """
    cache_key = f"ohlcv_{symbol}_{days}"
    cached = _get(cache_key, _TTL_HISTORY)
    if cached:
        return cached

    if _OBB_AVAILABLE:
        try:
            start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            r = obb.equity.price.historical(symbol, start_date=start, provider="yfinance")
            df = r.to_df().reset_index()
            records = [
                {
                    "date":   str(row.get("date", ""))[:10],
                    "open":   float(row["open"]),
                    "high":   float(row["high"]),
                    "low":    float(row["low"]),
                    "close":  float(row["close"]),
                    "volume": int(row.get("volume", 0)),
                }
                for _, row in df.iterrows()
            ]
            result = {"symbol": symbol, "days": days, "data": records, "source": "openbb/yfinance"}
            _set(cache_key, result)
            return result
        except Exception as exc:
            logger.warning(f"OpenBB OHLCV {symbol}: {exc} — falling back to direct yfinance")

    # direct yfinance fallback
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period=f"{days}d")
    records = [
        {
            "date":   str(idx.date()),
            "open":   round(row["Open"], 4),
            "high":   round(row["High"], 4),
            "low":    round(row["Low"], 4),
            "close":  round(row["Close"], 4),
            "volume": int(row["Volume"]),
        }
        for idx, row in hist.iterrows()
    ]
    result = {"symbol": symbol, "days": days, "data": records, "source": "yfinance"}
    _set(cache_key, result)
    return result


# ═══════════════════════════════════════════════════════════════════════════
#  SECTION 3 — FRED Economic Series  (requires free FRED_API_KEY)
# ═══════════════════════════════════════════════════════════════════════════

FRED_SERIES: dict[str, tuple[str, str, str]] = {
    "fed_rate":     ("FEDFUNDS",  "Federal Funds Rate",          "%"),
    "cpi":          ("CPIAUCSL",  "CPI – Urban Consumers",       "index"),
    "core_cpi":     ("CPILFESL",  "Core CPI (ex food & energy)", "index"),
    "gdp":          ("GDP",       "US GDP",                      "B $"),
    "unemployment": ("UNRATE",    "Unemployment Rate",           "%"),
    "yield_spread": ("T10Y2Y",    "Yield Spread (10Y–2Y)",       "%"),
    "m2_supply":    ("M2SL",      "M2 Money Supply",             "B $"),
    "retail_sales": ("RSAFS",     "Retail Sales",                "M $"),
    "pce":          ("PCE",       "Personal Consumption",        "B $"),
    "industrial":   ("INDPRO",    "Industrial Production Index", "index"),
}

_FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


def _fred_fetch(series_id: str, limit: int = 24, api_key: str = "") -> list[dict]:
    if not api_key:
        api_key = os.getenv("FRED_API_KEY", "")
    if not api_key:
        raise ValueError("FRED_API_KEY env var not set. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html")
    resp = requests.get(_FRED_BASE, params={
        "series_id": series_id,
        "sort_order": "desc",
        "limit": limit,
        "file_type": "json",
        "api_key": api_key,
    }, timeout=12)
    resp.raise_for_status()
    return [
        {"date": o["date"], "value": float(o["value"])}
        for o in resp.json().get("observations", [])
        if o.get("value") not in (".", None, "")
    ]


def _fred_key_set() -> bool:
    return bool(os.getenv("FRED_API_KEY", ""))


def get_macro_overview() -> dict:
    """
    Latest FRED economic values.  Requires FRED_API_KEY env var.
    """
    cached = _get("macro_overview", _TTL_MACRO)
    if cached:
        return cached

    if not _fred_key_set():
        return {
            "_error": "FRED_API_KEY not set",
            "_help": "Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html and set it as FRED_API_KEY in your environment secrets.",
            **{
                slug: {"label": label, "unit": unit, "value": None, "requires_key": True}
                for slug, (_, label, unit) in FRED_SERIES.items()
            },
        }

    result: dict = {}
    for slug, (series_id, label, unit) in FRED_SERIES.items():
        try:
            obs = _fred_fetch(series_id, limit=2)
            obs = list(reversed(obs))  # [older, latest]
            latest = obs[-1]
            prev   = obs[-2] if len(obs) > 1 else None
            change = round(latest["value"] - prev["value"], 4) if prev else None
            result[slug] = {
                "label":      label,
                "unit":       unit,
                "value":      latest["value"],
                "date":       latest["date"],
                "prev_value": prev["value"] if prev else None,
                "change":     change,
                "pct_change": round((change / prev["value"]) * 100, 3) if change and prev and prev["value"] else None,
            }
        except Exception as exc:
            logger.warning(f"FRED {series_id}: {exc}")
            result[slug] = {"label": label, "unit": unit, "value": None, "error": str(exc)}

    _set("macro_overview", result)
    return result


def get_series_history(slug: str, periods: int = 24) -> dict:
    """Historical FRED observations for one series. Requires FRED_API_KEY."""
    if slug not in FRED_SERIES:
        raise ValueError(f"Unknown slug '{slug}'. Available: {list(FRED_SERIES.keys())}")
    if not _fred_key_set():
        raise ValueError("FRED_API_KEY not set. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html")

    series_id, label, unit = FRED_SERIES[slug]
    cache_key = f"fred_hist_{slug}_{periods}"
    cached = _get(cache_key, _TTL_FRED)
    if cached:
        return cached

    obs = list(reversed(_fred_fetch(series_id, limit=periods)))
    result = {"slug": slug, "series_id": series_id, "label": label, "unit": unit, "data": obs}
    _set(cache_key, result)
    return result


# ── helpers ─────────────────────────────────────────────────────────────────

def available_series() -> list[dict]:
    return [
        {"slug": slug, "series_id": series_id, "label": label, "unit": unit, "requires_key": True}
        for slug, (series_id, label, unit) in FRED_SERIES.items()
    ]


def available_indicators() -> list[dict]:
    return [
        {"slug": slug, "ticker": ticker, "label": label, "requires_key": False}
        for slug, (ticker, label) in _MARKET_TICKERS.items()
    ]
