"""Live market data fetcher — crypto, FX, stock indexes, metals, datetime context."""
import time
import requests
from datetime import datetime, timezone, timedelta
from loguru import logger

_CACHE: dict = {}
_TTL_PRICE   = 60    # seconds for price data
_TTL_DETAIL  = 120   # seconds for detailed coin data
_TTL_FX      = 120   # forex rates
_TTL_INDEX   = 120   # stock index prices

_PAIR_TO_CG: dict[str, str] = {
    "BTC/USDT":  "bitcoin",      "BTC":  "bitcoin",
    "ETH/USDT":  "ethereum",     "ETH":  "ethereum",
    "BNB/USDT":  "binancecoin",  "BNB":  "binancecoin",
    "SOL/USDT":  "solana",       "SOL":  "solana",
    "XRP/USDT":  "ripple",       "XRP":  "ripple",
    "DOGE/USDT": "dogecoin",     "DOGE": "dogecoin",
    "ADA/USDT":  "cardano",      "ADA":  "cardano",
    "AVAX/USDT": "avalanche-2",  "AVAX": "avalanche-2",
    "LINK/USDT": "chainlink",    "LINK": "chainlink",
    "DOT/USDT":  "polkadot",     "DOT":  "polkadot",
    "UNI/USDT":  "uniswap",      "UNI":  "uniswap",
    "MATIC/USDT":"matic-network","MATIC":"matic-network",
    "LTC/USDT":  "litecoin",     "LTC":  "litecoin",
    "XLM/USDT":  "stellar",      "XLM":  "stellar",
}

_TOP_IDS = "bitcoin,ethereum,binancecoin,solana,ripple,dogecoin,cardano,avalanche-2,chainlink,polkadot"

_BINANCE_SYMS: dict[str, str] = {
    "bitcoin":      "BTCUSDT",  "ethereum":    "ETHUSDT",   "binancecoin": "BNBUSDT",
    "solana":       "SOLUSDT",  "ripple":      "XRPUSDT",   "cardano":     "ADAUSDT",
    "dogecoin":     "DOGEUSDT", "polkadot":    "DOTUSDT",   "chainlink":   "LINKUSDT",
    "avalanche-2":  "AVAXUSDT", "matic-network":"MATICUSDT","litecoin":    "LTCUSDT",
    "uniswap":      "UNIUSDT",  "stellar":     "XLMUSDT",
}

# ── Cache helpers ─────────────────────────────────────────────────────────────

def _ts() -> float:
    return time.time()

def _cached(key: str, ttl: int):
    entry = _CACHE.get(key)
    if entry and _ts() - entry["ts"] < ttl:
        return entry["data"]
    return None

def _store(key: str, data):
    _CACHE[key] = {"data": data, "ts": _ts()}
    return data


# ── Date/Time context ─────────────────────────────────────────────────────────

def get_datetime_context() -> str:
    """Returns current UTC datetime + active trading sessions as a formatted string."""
    now_utc = datetime.now(timezone.utc)
    now_ny  = now_utc - timedelta(hours=4)   # EDT (UTC-4)
    now_lon = now_utc + timedelta(hours=1)   # BST (UTC+1)
    now_tok = now_utc + timedelta(hours=9)   # JST (UTC+9)

    # Market sessions (approximate open hours in UTC)
    hour = now_utc.hour
    sessions = []
    # Tokyo: 00:00–06:00 UTC
    if 0 <= hour < 6:
        sessions.append("Tokyo (OPEN)")
    else:
        sessions.append("Tokyo (closed)")
    # London: 07:00–16:00 UTC
    if 7 <= hour < 16:
        sessions.append("London (OPEN)")
    else:
        sessions.append("London (closed)")
    # New York: 12:00–21:00 UTC
    if 12 <= hour < 21:
        sessions.append("New York (OPEN)")
    else:
        sessions.append("New York (closed)")

    day_name = now_utc.strftime("%A")
    is_weekend = now_utc.weekday() >= 5

    lines = [
        "━━━ DATE & TIME ━━━",
        f"UTC:       {now_utc.strftime('%Y-%m-%d %H:%M')} UTC",
        f"New York:  {now_ny.strftime('%Y-%m-%d %H:%M')} EDT",
        f"London:    {now_lon.strftime('%Y-%m-%d %H:%M')} BST",
        f"Tokyo:     {now_tok.strftime('%Y-%m-%d %H:%M')} JST",
        f"Day:       {day_name}" + (" (Weekend — stock markets closed)" if is_weekend else ""),
        f"Sessions:  {' | '.join(sessions)}",
        "━━━━━━━━━━━━━━━━━━━",
    ]
    return "\n".join(lines)


# ── FX / Forex rates ──────────────────────────────────────────────────────────

_FX_PAIRS = {
    "EUR": "Euro",
    "GBP": "British Pound",
    "JPY": "Japanese Yen",
    "AUD": "Australian Dollar",
    "CHF": "Swiss Franc",
    "CAD": "Canadian Dollar",
    "CNY": "Chinese Yuan",
    "SGD": "Singapore Dollar",
    "HKD": "Hong Kong Dollar",
    "MXN": "Mexican Peso",
}

def get_fx_rates() -> dict:
    """Returns FX rates vs USD via frankfurter.app (free, no key). Cached 2 min."""
    hit = _cached("fx", _TTL_FX)
    if hit:
        return hit
    try:
        pairs = ",".join(_FX_PAIRS.keys())
        r = requests.get(
            f"https://api.frankfurter.app/latest?from=USD&to={pairs}",
            timeout=6,
        )
        if r.status_code == 200:
            data = r.json()
            rates = data.get("rates", {})
            result = {
                "date": data.get("date", ""),
                "base": "USD",
                "rates": {k: {"rate": v, "name": _FX_PAIRS.get(k, k)} for k, v in rates.items()},
            }
            return _store("fx", result)
    except Exception as e:
        logger.warning(f"FX rates fetch failed: {e}")
    return _cached("fx", 9999) or {}


def get_fx_context() -> str:
    """Formatted FX block for AI system prompt."""
    data = get_fx_rates()
    if not data or not data.get("rates"):
        return ""
    lines = [f"━━━ FX RATES (USD base, {data.get('date', 'live')}) ━━━"]
    for code, info in data["rates"].items():
        r = info["rate"]
        if code == "JPY":
            lines.append(f"  USD/{code}: {r:.2f}  ({info['name']})")
        else:
            # Invert so we show how many USD 1 unit costs
            inv = round(1 / r, 5) if r else 0
            lines.append(f"  {code}/USD: {inv:.5f}  ({info['name']})")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)


# ── Stock indexes ─────────────────────────────────────────────────────────────

_INDEX_TICKERS = {
    "^GSPC":  "S&P 500",
    "^DJI":   "Dow Jones",
    "^IXIC":  "NASDAQ",
    "^FTSE":  "FTSE 100",
    "^N225":  "Nikkei 225",
    "^HSI":   "Hang Seng",
    "^GDAXI": "DAX",
    "^FCHI":  "CAC 40",
}

def get_stock_indexes() -> dict:
    """Fetch major stock index prices via yfinance. Cached 2 min."""
    hit = _cached("indexes", _TTL_INDEX)
    if hit:
        return hit
    try:
        import yfinance as yf
        result = {}
        tickers_str = " ".join(_INDEX_TICKERS.keys())
        data = yf.download(
            tickers_str,
            period="2d",
            interval="1d",
            progress=False,
            auto_adjust=True,
        )
        closes = data.get("Close", {})
        for ticker, name in _INDEX_TICKERS.items():
            try:
                col = closes.get(ticker) if isinstance(closes, dict) else (
                    closes[ticker] if hasattr(closes, '__getitem__') else None
                )
                if col is not None:
                    vals = col.dropna()
                    if len(vals) >= 2:
                        prev  = float(vals.iloc[-2])
                        curr  = float(vals.iloc[-1])
                        chg_p = ((curr - prev) / prev * 100) if prev else 0
                        result[ticker] = {
                            "name":    name,
                            "price":   round(curr, 2),
                            "change":  round(chg_p, 2),
                            "prev":    round(prev, 2),
                        }
                    elif len(vals) == 1:
                        result[ticker] = {
                            "name":  name,
                            "price": round(float(vals.iloc[-1]), 2),
                            "change": 0,
                            "prev":   0,
                        }
            except Exception:
                pass
        if result:
            return _store("indexes", result)
    except Exception as e:
        logger.warning(f"Stock index fetch failed: {e}")
    return _cached("indexes", 9999) or {}


def get_indexes_context() -> str:
    """Formatted stock index block for AI system prompt."""
    data = get_stock_indexes()
    if not data:
        return ""
    lines = ["━━━ STOCK INDEXES ━━━"]
    for ticker, info in data.items():
        chg  = info.get("change", 0)
        sign = "+" if chg >= 0 else ""
        arrow = "▲" if chg >= 0 else "▼"
        lines.append(
            f"  {info['name']:14s}  ${info['price']:>10,.2f}  {sign}{chg:.2f}% {arrow}"
        )
    lines.append("━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)


# ── Commodities: Gold, Silver, Oil ────────────────────────────────────────────

_COMMODITY_TICKERS = {
    "GC=F": {"name": "Gold",       "symbol": "XAU/USD", "unit": "oz"},
    "SI=F": {"name": "Silver",     "symbol": "XAG/USD", "unit": "oz"},
    "CL=F": {"name": "WTI Crude",  "symbol": "WTI/USD", "unit": "bbl"},
    "BZ=F": {"name": "Brent Crude","symbol": "BRENT",   "unit": "bbl"},
}

def get_commodities() -> dict:
    """Fetch live Gold, Silver, WTI Oil, Brent Oil prices via yfinance futures. Cached 2 min."""
    hit = _cached("commodities", 120)
    if hit:
        return hit
    result = {}
    try:
        import yfinance as yf
        for ticker, meta in _COMMODITY_TICKERS.items():
            try:
                t = yf.Ticker(ticker)
                hist = t.history(period="5d", interval="1d", auto_adjust=True)
                if hist is not None and len(hist) >= 2:
                    closes = hist["Close"].dropna()
                    if len(closes) >= 2:
                        curr = float(closes.iloc[-1])
                        prev = float(closes.iloc[-2])
                        chg  = ((curr - prev) / prev * 100) if prev else 0
                        result[ticker] = {**meta, "price": round(curr, 2), "change": round(chg, 2), "prev": round(prev, 2)}
                        continue
                # Fallback: fast_info
                fi   = t.fast_info
                curr = getattr(fi, "last_price", None) or getattr(fi, "regular_market_price", None)
                prev = getattr(fi, "previous_close", None) or curr
                if curr:
                    chg = ((curr - prev) / prev * 100) if prev else 0
                    result[ticker] = {**meta, "price": round(curr, 2), "change": round(chg, 2), "prev": round(prev, 2)}
            except Exception as te:
                logger.warning(f"Commodity {ticker} fetch failed: {te}")
    except Exception as e:
        logger.warning(f"Commodities import failed: {e}")
    if result:
        return _store("commodities", result)
    return _cached("commodities", 9999) or {}


def get_commodities_context() -> str:
    """Formatted commodities block for AI system prompt."""
    data = get_commodities()
    if not data:
        return ""
    lines = ["━━━ COMMODITIES ━━━"]
    for ticker, info in data.items():
        chg   = info.get("change", 0)
        sign  = "+" if chg >= 0 else ""
        arrow = "▲" if chg >= 0 else "▼"
        lines.append(
            f"  {info['symbol']:9s}  ${info['price']:>10,.2f}/{info['unit']}  {sign}{chg:.2f}% {arrow}"
        )
    lines.append("━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)


# ── Crypto snapshot ───────────────────────────────────────────────────────────

def get_top_snapshot() -> dict:
    """
    Returns {cg_id: {usd, usd_24h_change, usd_24h_vol, usd_market_cap}} for top assets.
    Tries Binance.US 24hr ticker first (faster/no rate limit), falls back to CoinGecko.
    """
    hit = _cached("top", _TTL_PRICE)
    if hit:
        return hit

    result = {}

    # Primary: Binance.US 24hr ticker batch
    try:
        r = requests.get("https://api.binance.us/api/v3/ticker/24hr", timeout=6)
        if r.status_code == 200:
            tickers = {item["symbol"]: item for item in r.json()}
            for cg_id, sym in _BINANCE_SYMS.items():
                item = tickers.get(sym, {})
                price = float(item.get("lastPrice", 0) or 0)
                chg   = float(item.get("priceChangePercent", 0) or 0)
                vol   = float(item.get("quoteVolume", 0) or 0)
                if price > 0:
                    result[cg_id] = {
                        "usd":             round(price, 8),
                        "usd_24h_change":  round(chg, 4),
                        "usd_24h_vol":     round(vol, 2),
                        "usd_high_24h":    float(item.get("highPrice", 0) or 0),
                        "usd_low_24h":     float(item.get("lowPrice",  0) or 0),
                    }
    except Exception as e:
        logger.warning(f"Binance.US snapshot failed: {e}")

    # Fallback / supplement: CoinGecko simple/price
    if not result:
        try:
            r = requests.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids":                _TOP_IDS,
                    "vs_currencies":      "usd",
                    "include_24hr_change":"true",
                    "include_24hr_vol":   "true",
                    "include_market_cap": "true",
                },
                timeout=8,
            )
            if r.status_code == 200:
                for cg_id, d in r.json().items():
                    result[cg_id] = {
                        "usd":            d.get("usd", 0),
                        "usd_24h_change": d.get("usd_24h_change", 0),
                        "usd_24h_vol":    d.get("usd_24h_vol", 0),
                        "usd_market_cap": d.get("usd_market_cap", 0),
                    }
        except Exception as e:
            logger.warning(f"CoinGecko top snapshot failed: {e}")

    if result:
        _store("top", result)
    else:
        result = _cached("top", 9999) or {}

    return result


def get_pair_detail(pair: str) -> dict:
    """Returns detailed market data for a single pair via CoinGecko /coins/{id}."""
    base   = pair.split("/")[0].upper()
    cg_id  = _PAIR_TO_CG.get(pair.upper()) or _PAIR_TO_CG.get(base)
    if not cg_id:
        return {}

    key = f"detail_{cg_id}"
    hit = _cached(key, _TTL_DETAIL)
    if hit:
        return hit

    try:
        r = requests.get(
            f"https://api.coingecko.com/api/v3/coins/{cg_id}",
            params={"localization": "false", "tickers": "false",
                    "community_data": "false", "developer_data": "false"},
            timeout=10,
        )
        if r.status_code == 200:
            raw  = r.json()
            mkt  = raw.get("market_data", {})
            data = {
                "name":             raw.get("name", cg_id),
                "symbol":           raw.get("symbol", base).upper(),
                "price_usd":        mkt.get("current_price", {}).get("usd", 0),
                "change_24h":       mkt.get("price_change_percentage_24h", 0),
                "change_7d":        mkt.get("price_change_percentage_7d",  0),
                "change_30d":       mkt.get("price_change_percentage_30d", 0),
                "high_24h":         mkt.get("high_24h", {}).get("usd", 0),
                "low_24h":          mkt.get("low_24h",  {}).get("usd", 0),
                "volume_24h":       mkt.get("total_volume",  {}).get("usd", 0),
                "market_cap":       mkt.get("market_cap",    {}).get("usd", 0),
                "market_cap_rank":  raw.get("market_cap_rank"),
                "circulating":      mkt.get("circulating_supply", 0),
                "total_supply":     mkt.get("total_supply", 0),
                "ath":              mkt.get("ath",  {}).get("usd", 0),
                "ath_change_pct":   mkt.get("ath_change_percentage", {}).get("usd", 0),
                "atl":              mkt.get("atl",  {}).get("usd", 0),
            }
            return _store(key, data)
    except Exception as e:
        logger.warning(f"CoinGecko detail failed ({pair}): {e}")

    return _cached(key, 9999) or {}


# ── Full context builder ──────────────────────────────────────────────────────

def build_market_context(
    pair: str,
    price: float = 0,
    change_24h: float = 0,
    high_24h: float = 0,
    low_24h: float = 0,
    volume_24h: float = 0,
) -> str:
    """
    Builds the live-market-data block injected into Fin's system prompt.
    Merges caller-supplied values (from frontend) with fetched detail data.
    Always includes: datetime, FX rates, stock indexes, crypto snapshot.
    """
    sections = []

    # ── Date/time ──
    try:
        sections.append(get_datetime_context())
    except Exception:
        pass

    # ── Specific pair ──
    lines = ["━━━ LIVE MARKET DATA ━━━"]
    lines.append(f"Asset: {pair}")

    # Map frontend pair names → commodity futures keys
    _COMMODITY_MAP = {
        "XAU/USD": "GC=F",
        "XAG/USD": "SI=F",
        "OIL/WTI": "CL=F",
        "WTI/USD": "CL=F",
        "BRENT":   "BZ=F",
        "XBR/USD": "BZ=F",
    }
    commodity_key = _COMMODITY_MAP.get(pair.upper())

    try:
        detail = get_pair_detail(pair)
    except Exception:
        detail = {}

    # If this is a commodity pair, enrich with live futures data
    commodity_live: dict = {}
    if commodity_key:
        try:
            comms = get_commodities()
            commodity_live = comms.get(commodity_key, {})
        except Exception:
            pass

    p     = price      or commodity_live.get("price",  0) or detail.get("price_usd",  0)
    chg24 = change_24h or commodity_live.get("change", 0) or detail.get("change_24h", 0)
    hi    = high_24h   or detail.get("high_24h",   0)
    lo    = low_24h    or detail.get("low_24h",    0)
    vol   = volume_24h or detail.get("volume_24h", 0)

    if commodity_live:
        unit = commodity_live.get("unit", "")
        name = commodity_live.get("name", "")
        prev = commodity_live.get("prev", 0)
        if name:
            lines.append(f"Name:         {name}")
        if unit:
            lines.append(f"Unit:         per {unit}")
        if prev > 0:
            lines.append(f"Prev Close:   ${prev:,.2f}")

    if p > 0:
        lines.append(f"Price (USD):  ${p:,.4f}" if p < 1 else f"Price (USD):  ${p:,.2f}")
    if chg24 != 0:
        sign = "+" if chg24 >= 0 else ""
        lines.append(f"24h Change:   {sign}{chg24:.2f}%  {'▲' if chg24 >= 0 else '▼'}")
    if hi > 0:
        lines.append(f"24h High:     ${hi:,.2f}")
    if lo > 0:
        lines.append(f"24h Low:      ${lo:,.2f}")
    if vol > 0:
        vol_b = vol / 1_000_000_000
        vol_m = vol / 1_000_000
        lines.append(f"24h Volume:   ${vol_b:.2f}B" if vol_b >= 1 else f"24h Volume:   ${vol_m:.1f}M")
    if detail:
        mc = detail.get("market_cap", 0)
        if mc > 0:
            lines.append(f"Market Cap:   ${mc/1_000_000_000:.2f}B")
        if detail.get("market_cap_rank"):
            lines.append(f"CMC Rank:     #{detail['market_cap_rank']}")
        chg7 = detail.get("change_7d")
        if chg7 is not None:
            sign = "+" if chg7 >= 0 else ""
            lines.append(f"7d Change:    {sign}{chg7:.2f}%")
        ath = detail.get("ath", 0)
        if ath > 0:
            lines.append(f"ATH:          ${ath:,.2f}  ({detail.get('ath_change_pct', 0):.1f}% from ATH)")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
    sections.append("\n".join(lines))

    # ── Crypto snapshot ──
    try:
        snap = get_top_snapshot()
        if snap:
            snap_lines = ["Top Crypto Snapshot:"]
            labels = [
                ("bitcoin","BTC"),("ethereum","ETH"),("solana","SOL"),
                ("binancecoin","BNB"),("ripple","XRP"),("dogecoin","DOGE"),
            ]
            for cg_id, sym in labels:
                d = snap.get(cg_id, {})
                sp = d.get("usd", 0)
                sc = d.get("usd_24h_change", 0)
                if sp > 0:
                    sign = "+" if sc >= 0 else ""
                    snap_lines.append(f"  {sym:6s} ${sp:>12,.2f}  {sign}{sc:.2f}%")
            sections.append("\n".join(snap_lines))
    except Exception:
        pass

    # ── FX rates ──
    try:
        fx = get_fx_context()
        if fx:
            sections.append(fx)
    except Exception:
        pass

    # ── Stock indexes ──
    try:
        idx = get_indexes_context()
        if idx:
            sections.append(idx)
    except Exception:
        pass

    # ── Commodities (Gold, Silver, Oil) ──
    try:
        com = get_commodities_context()
        if com:
            sections.append(com)
    except Exception:
        pass

    return "\n\n".join(sections)


def build_full_context() -> str:
    """
    Build a complete market context block without a specific pair.
    Used when user asks general market questions.
    """
    sections = []

    try:
        sections.append(get_datetime_context())
    except Exception:
        pass

    try:
        snap = get_top_snapshot()
        if snap:
            lines = ["━━━ LIVE CRYPTO SNAPSHOT ━━━"]
            labels = [
                ("bitcoin","BTC"),("ethereum","ETH"),("solana","SOL"),
                ("binancecoin","BNB"),("ripple","XRP"),("cardano","ADA"),
                ("dogecoin","DOGE"),("avalanche-2","AVAX"),
            ]
            for cg_id, sym in labels:
                d = snap.get(cg_id, {})
                sp = d.get("usd", 0)
                sc = d.get("usd_24h_change", 0)
                if sp > 0:
                    sign = "+" if sc >= 0 else ""
                    lines.append(f"  {sym:6s} ${sp:>12,.2f}  {sign}{sc:.2f}%")
            lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            sections.append("\n".join(lines))
    except Exception:
        pass

    try:
        fx = get_fx_context()
        if fx:
            sections.append(fx)
    except Exception:
        pass

    try:
        idx = get_indexes_context()
        if idx:
            sections.append(idx)
    except Exception:
        pass

    # ── Commodities (Gold, Silver, Oil) ──
    try:
        com = get_commodities_context()
        if com:
            sections.append(com)
    except Exception:
        pass

    return "\n\n".join(sections)
