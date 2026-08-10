from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger
from src.notifications.notifier import Notifier

notifier = Notifier()
scheduler = BackgroundScheduler(timezone="UTC")


def send_daily_portfolio_summary():
    try:
        from src.trading.trade_bot import bot_manager
        statuses = list(bot_manager.get_all_status().values())
        if not statuses:
            notifier._send_all("📊 Daily Summary: No active bots running.", "Daily Portfolio Summary")
            return
        notifier.send_daily_summary(statuses)
        logger.success("📧 Daily portfolio summary sent via all channels")
    except Exception as e:
        logger.error(f"Daily summary failed: {e}")


def check_stop_loss_take_profit():
    """Auto-close positions when Stop Loss or Take Profit price is hit.
    Works correctly for both LONG and SHORT positions.
    """
    try:
        from datetime import datetime
        from src.database.session import SessionLocal
        from src.database.models import Position, TradeLog, User
        from src.trading.trade_bot import _fetch_live_price

        with SessionLocal() as db:
            open_positions = (
                db.query(Position)
                .filter(
                    Position.status == "open",
                    # Only process positions that have at least one of SL / TP set
                    (Position.stop_loss.isnot(None)) | (Position.take_profit.isnot(None)),
                )
                .all()
            )
            if not open_positions:
                return

            triggered = 0
            for pos in open_positions:
                try:
                    current_price = _fetch_live_price(pos.ticker)
                except Exception:
                    continue

                entry_price = float(pos.entry_price or 0)
                lot         = float(pos.lot_size or 1.0)
                cs          = float(pos.contract_size or 1.0)
                margin      = float(pos.margin or 0)

                reason = None
                # SL/TP logic differs by side
                if pos.side == "LONG":
                    if pos.stop_loss is not None and current_price <= pos.stop_loss:
                        reason = f"Stop Loss triggered @ ${current_price:.4f} (SL: ${pos.stop_loss:.4f})"
                    elif pos.take_profit is not None and current_price >= pos.take_profit:
                        reason = f"Take Profit triggered @ ${current_price:.4f} (TP: ${pos.take_profit:.4f})"
                else:  # SHORT
                    if pos.stop_loss is not None and current_price >= pos.stop_loss:
                        reason = f"Stop Loss triggered @ ${current_price:.4f} (SL: ${pos.stop_loss:.4f})"
                    elif pos.take_profit is not None and current_price <= pos.take_profit:
                        reason = f"Take Profit triggered @ ${current_price:.4f} (TP: ${pos.take_profit:.4f})"

                if not reason:
                    continue

                # Correct PnL formula per side
                if pos.side == "SHORT":
                    pnl = (entry_price - current_price) * lot * cs
                else:
                    pnl = (current_price - entry_price) * lot * cs

                proceeds      = max(margin + pnl, 0.0)
                is_liquidated = (margin + pnl) <= 0

                # Credit proceeds to user wallet
                user = db.query(User).filter(User.id == pos.user_id).first()
                if user:
                    user.balance_usdt = round((user.balance_usdt or 0) + proceeds, 8)

                # Mark position closed
                pos.status       = "liquidated" if is_liquidated else "closed"
                pos.close_price  = round(current_price, 8)
                pos.realized_pnl = round(pnl, 8)
                pos.closed_at    = datetime.utcnow()

                # Log the closing leg in trade_logs for history
                close_action = "SELL" if pos.side == "LONG" else "BUY"
                close_log = TradeLog(
                    user_id=pos.user_id,
                    ticker=pos.ticker,
                    action=close_action,
                    price=current_price,
                    qty=lot,
                    pnl=round(pnl, 8),
                    reason=reason,
                    paper=False,
                    exchange=pos.exchange or "internal",
                    leverage=float(pos.leverage or 1),
                    lot_size=lot,
                    position_id=pos.id,
                )
                db.add(close_log)
                db.flush()
                pos.close_trade_id = close_log.id

                triggered += 1
                logger.info(
                    f"⚡ Auto-closed position #{pos.id} {pos.side} {pos.ticker}: "
                    f"{reason} | P&L: ${pnl:.2f}"
                )

                # Push notification
                if user:
                    prefs = dict(user.notification_preferences or {})
                    tg_token  = prefs.get("telegram_bot_token")
                    tg_chat_id = prefs.get("telegram_chat_id")
                    msg = (
                        f"⚡ FinAi Auto-Close Alert\n"
                        f"{'🔴 LIQUIDATED' if is_liquidated else '✅ CLOSED'} "
                        f"{pos.ticker} {pos.side}\n"
                        f"{reason}\n"
                        f"P&L: {'+'if pnl>=0 else ''}${pnl:.2f}\n"
                        f"Proceeds: ${proceeds:.2f} USDT credited\n"
                        f"Balance: ${user.balance_usdt:,.2f} USDT"
                    )
                    if tg_token and tg_chat_id:
                        try:
                            import threading
                            def _send_tg(tok, cid, text):
                                try:
                                    import requests as _r
                                    _r.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                                            json={"chat_id": cid, "text": text}, timeout=5)
                                except Exception:
                                    pass
                            threading.Thread(target=_send_tg, args=(tg_token, tg_chat_id, msg), daemon=True).start()
                        except Exception:
                            pass
                    wa_verified = prefs.get("whatsapp_verified")
                    wa_phone    = prefs.get("whatsapp_number")
                    if wa_verified and wa_phone:
                        try:
                            import os, threading
                            def _send_wa(phone, text):
                                try:
                                    from twilio.rest import Client as _TC
                                    tc = _TC(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
                                    tc.messages.create(
                                        from_=f"whatsapp:{os.getenv('TWILIO_WHATSAPP_NUMBER','+14155238886')}",
                                        body=text, to=f"whatsapp:{phone}"
                                    )
                                except Exception:
                                    pass
                            threading.Thread(target=_send_wa, args=(wa_phone, msg), daemon=True).start()
                        except Exception:
                            pass

            if triggered > 0:
                db.commit()
                logger.success(f"✅ SL/TP check: {triggered} position(s) auto-closed")

    except Exception as e:
        logger.error(f"SL/TP check failed: {e}")


def check_price_alerts_job():
    """Periodic price alert check — notifies users via Telegram/WhatsApp when targets hit."""
    try:
        from src.database.session import SessionLocal
        from src.database.models import PriceAlert, User
        import requests as _req

        with SessionLocal() as db:
            active = db.query(PriceAlert).filter(PriceAlert.is_active == True).all()
            if not active:
                return

            # Fetch current prices — try Binance global first, fallback to CoinGecko
            prices: dict = {}

            # Source 1: Binance global (com, not .us — far better uptime)
            for _binance_url in [
                "https://api.binance.com/api/v3/ticker/price",
                "https://api.binance.us/api/v3/ticker/price",
            ]:
                if prices:
                    break
                try:
                    r = _req.get(_binance_url, timeout=5)
                    if r.status_code == 200:
                        raw = r.json()
                        for item in raw:
                            sym = item.get("symbol", "")
                            price_val = float(item.get("price", 0))
                            if sym.endswith("USDT") and price_val > 0:
                                key = sym[:-4] + "/USDT"
                                prices[key] = price_val
                except Exception:
                    pass

            # Source 2: CoinGecko fallback when Binance is unreachable
            if not prices:
                try:
                    _CG_IDS = {
                        "BTC/USDT": "bitcoin", "ETH/USDT": "ethereum",
                        "BNB/USDT": "binancecoin", "SOL/USDT": "solana",
                        "XRP/USDT": "ripple", "ADA/USDT": "cardano",
                        "DOGE/USDT": "dogecoin", "AVAX/USDT": "avalanche-2",
                        "DOT/USDT": "polkadot", "LINK/USDT": "chainlink",
                        "LTC/USDT": "litecoin", "UNI/USDT": "uniswap",
                        "ATOM/USDT": "cosmos", "TRX/USDT": "tron",
                        "MATIC/USDT": "matic-network", "NEAR/USDT": "near",
                        "APT/USDT": "aptos", "ARB/USDT": "arbitrum",
                        "OP/USDT": "optimism", "SUI/USDT": "sui",
                    }
                    ids_str = ",".join(_CG_IDS.values())
                    cg_r = _req.get(
                        f"https://api.coingecko.com/api/v3/simple/price?ids={ids_str}&vs_currencies=usd",
                        timeout=8
                    )
                    if cg_r.status_code == 200:
                        cg_data = cg_r.json()
                        for sym, coin_id in _CG_IDS.items():
                            usd_val = cg_data.get(coin_id, {}).get("usd", 0)
                            if usd_val > 0:
                                prices[sym] = float(usd_val)
                except Exception:
                    pass

            from datetime import datetime
            triggered_count = 0
            for alert in active:
                current = prices.get(alert.symbol, 0)
                if current == 0:
                    continue
                fired = (
                    (alert.direction == "above" and current >= alert.target_price) or
                    (alert.direction == "below" and current <= alert.target_price)
                )
                if not fired:
                    continue

                alert.is_active = False
                alert.triggered_at = datetime.utcnow()
                triggered_count += 1
                user = db.query(User).filter(User.id == alert.user_id).first()
                if not user:
                    continue

                _fire_alert_notifications(db, alert, user, current)

            if triggered_count > 0:
                db.commit()
                logger.info(f"🔔 Price alerts: {triggered_count} triggered")

    except Exception as e:
        logger.error(f"Price alert check failed: {e}")


def _create_in_app_notification(db, user_id: int, title: str, message: str):
    """Insert an in-app Notification record for the user's notification bell."""
    try:
        from src.database.models import Notification
        notif = Notification(
            title=title,
            message=message,
            target_all=False,
            target_user_id=user_id,
            created_by=None,
            read_by_user_ids=[],
        )
        db.add(notif)
    except Exception as _e:
        logger.warning(f"In-app notification insert failed: {_e}")


def _fire_alert_notifications(db, alert, user, current_price: float):
    """Send all notification channels for a triggered price alert."""
    msg = (
        f"🔔 FinAi Price Alert Triggered!\n"
        f"{alert.symbol} hit ${alert.target_price:,.2f} ({alert.direction})\n"
        f"Current Price: ${current_price:,.4f}"
    )
    prefs = dict(user.notification_preferences or {})

    # In-app notification (notify_browser flag)
    if alert.notify_browser:
        _create_in_app_notification(
            db, user.id,
            f"🔔 {alert.symbol} Alert Triggered",
            f"{alert.symbol} reached ${current_price:,.4f} ({alert.direction} ${alert.target_price:,.2f})"
        )

    # Telegram
    if alert.notify_telegram:
        tg_token = prefs.get("telegram_bot_token")
        tg_chat_id = prefs.get("telegram_chat_id")
        if tg_token and tg_chat_id:
            try:
                import threading
                def _send_tg(tok, cid, text):
                    try:
                        import requests as _r2
                        _r2.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                                 json={"chat_id": cid, "text": text}, timeout=5)
                    except Exception:
                        pass
                threading.Thread(target=_send_tg, args=(tg_token, tg_chat_id, msg), daemon=True).start()
            except Exception:
                pass

    # WhatsApp
    if alert.notify_whatsapp:
        wa_verified = prefs.get("whatsapp_verified")
        wa_phone = prefs.get("whatsapp_number")
        if wa_verified and wa_phone:
            try:
                import os, threading
                def _send_wa(phone, text):
                    try:
                        from twilio.rest import Client as _TC
                        import os as _os
                        tc = _TC(_os.getenv("TWILIO_ACCOUNT_SID"), _os.getenv("TWILIO_AUTH_TOKEN"))
                        tc.messages.create(
                            from_=f"whatsapp:{_os.getenv('TWILIO_WHATSAPP_NUMBER','+14155238886')}",
                            body=text,
                            to=f"whatsapp:{phone}"
                        )
                    except Exception:
                        pass
                threading.Thread(target=_send_wa, args=(wa_phone, msg), daemon=True).start()
            except Exception:
                pass


def auto_cancel_expired_deposits():
    """Cancel pending deposit requests that are older than 30 minutes."""
    try:
        from src.database.session import SessionLocal
        from src.database.models import Transaction
        from datetime import datetime, timedelta
        db = SessionLocal()
        try:
            cutoff = datetime.utcnow() - timedelta(minutes=30)
            expired = db.query(Transaction).filter(
                Transaction.tx_type == "deposit",
                Transaction.status == "pending",
                Transaction.created_at < cutoff,
            ).all()
            if expired:
                for tx in expired:
                    tx.status = "cancelled"
                db.commit()
                logger.info(f"⏱️ Auto-cancelled {len(expired)} expired deposit(s)")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Auto-cancel deposits failed: {e}")


scheduler.add_job(
    auto_cancel_expired_deposits,
    trigger=IntervalTrigger(minutes=2),
    id="deposit_expiry_checker",
    replace_existing=True,
)

scheduler.add_job(
    send_daily_portfolio_summary,
    trigger=CronTrigger(hour=20, minute=0),
    id="daily_portfolio_summary",
    replace_existing=True,
)

scheduler.add_job(
    check_stop_loss_take_profit,
    trigger=IntervalTrigger(seconds=30),
    id="sl_tp_checker",
    replace_existing=True,
)

scheduler.add_job(
    check_price_alerts_job,
    trigger=IntervalTrigger(minutes=1),
    id="price_alert_checker",
    replace_existing=True,
)

logger.info("⏰ Scheduler configured: Daily summary (20:00 UTC), SL/TP check (30s), Price alerts (60s), Deposit expiry (2m)")
