import os
from datetime import datetime
from loguru import logger

try:
    from telegram import Update
    from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
    _HAS_TELEGRAM = True
except ImportError:
    _HAS_TELEGRAM = False

from src.trading.trade_bot import bot_manager
from src.notifications.notifier import Notifier

notifier = Notifier()

APP_URL = os.getenv("APP_URL", "")

# ─── DB helpers ─────────────────────────────────────────────────────────────

def _get_user_by_tg_chat_id(chat_id: str):
    try:
        from src.database.session import SessionLocal
        from src.database.models import User
        db = SessionLocal()
        try:
            for u in db.query(User).all():
                prefs = dict(u.notification_preferences or {})
                if (
                    str(prefs.get("telegram_chat_id", "")) == str(chat_id)
                    or str(getattr(u, "telegram_chat_id", "") or "") == str(chat_id)
                ):
                    return u
            return None
        finally:
            db.close()
    except Exception:
        return None


def _get_user_by_wa_number(phone: str):
    try:
        from src.database.session import SessionLocal
        from src.database.models import User
        db = SessionLocal()
        try:
            clean = phone.replace("whatsapp:", "").strip()
            for u in db.query(User).all():
                prefs = dict(u.notification_preferences or {})
                wa = str(getattr(u, "whatsapp_number", "") or prefs.get("whatsapp_number", ""))
                if wa.replace("whatsapp:", "").strip() == clean:
                    return u
            return None
        finally:
            db.close()
    except Exception:
        return None


def _fetch_user_history(user_id: int, limit: int = 5):
    try:
        from src.database.session import SessionLocal
        from src.database.models import Transaction
        db = SessionLocal()
        try:
            return (
                db.query(Transaction)
                .filter(Transaction.user_id == user_id)
                .order_by(Transaction.created_at.desc())
                .limit(limit)
                .all()
            )
        finally:
            db.close()
    except Exception:
        return []


def _fetch_latest_events(limit: int = 10):
    try:
        from src.database.session import SessionLocal
        from src.database.models import Event
        db = SessionLocal()
        try:
            return db.query(Event).order_by(Event.created_at.desc()).limit(limit).all()
        finally:
            db.close()
    except Exception:
        return []


def _fetch_btc_price():
    try:
        import requests
        r = requests.get(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
            timeout=6,
        )
        return r.json()["bitcoin"]["usd"] if r.ok else None
    except Exception:
        return None


# ─── Help text ───────────────────────────────────────────────────────────────

HELP_TEXT = """
📖 *FinAi Bot Commands*

1️⃣ /status — Active bot portfolio
2️⃣ /balance — Your USDT balance
3️⃣ /history — Last 5 trades & transactions
4️⃣ /support — Get support link
5️⃣ /chatfin <msg> — Chat with FinAi AI
6️⃣ /news — Latest 10 market news
7️⃣ /wallet — Deposit / withdrawal guide
❓ /help — This menu

*Quick shortcuts (type directly):*
• `btc` — Live BTC price
• `stop all` — Stop all running bots
""".strip()


# ─── Telegram command handlers ────────────────────────────────────────────────

async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    statuses = bot_manager.get_all_status()
    if not statuses:
        await update.message.reply_text("ℹ️ No active bots running.")
        return
    msg = "📊 *Active Bot Portfolio*\n\n"
    for t, s in statuses.items():
        mode = "🟢 LIVE" if s.get("mode") == "LIVE" else "📄 PAPER"
        pnl = s.get("realized_pnl", 0)
        sign = "+" if pnl >= 0 else ""
        msg += (
            f"*{t}* {mode}\n"
            f"Value: ${s['portfolio_value']:.2f} | P&L: {sign}${pnl:.2f}\n"
            f"Drawdown: {s['current_drawdown_pct']}% | Pos: {s['position']:.6f}\n\n"
        )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    user = _get_user_by_tg_chat_id(chat_id)
    if not user:
        await update.message.reply_text(
            "❌ Your Telegram is not linked to a FinAi account.\n"
            f"Go to Profile → FinAPI tab to connect: {APP_URL}/app/profile"
        )
        return
    name = user.first_name or user.username or "User"
    bal = user.balance_usdt or 0.0
    sub = (user.subscription or "free").title()
    msg = (
        f"💰 *Balance — {name}*\n\n"
        f"Available: `${bal:,.2f} USDT`\n"
        f"Plan: {sub}\n\n"
        f"[🔗 Open Wallet]({APP_URL}/app/wallet)"
    )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_history(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    user = _get_user_by_tg_chat_id(chat_id)
    if not user:
        await update.message.reply_text(
            "❌ Telegram not linked.\n"
            f"Connect at: {APP_URL}/app/profile"
        )
        return
    name = user.first_name or "User"
    txs = _fetch_user_history(user.id, limit=5)

    bot_trades: list = []
    for b in list(bot_manager.bots.values()):
        bot_trades.extend(b.trades[-5:] if hasattr(b, "trades") else [])
    bot_trades.sort(key=lambda t: t.get("time", datetime.min), reverse=True)

    msg = f"📜 *Recent Activity — {name}*\n\n"

    if txs:
        msg += "*Transactions:*\n"
        for tx in txs:
            dt = tx.created_at.strftime("%b %d %H:%M") if tx.created_at else "—"
            icon = "✅" if tx.status in ("approved", "completed") else ("❌" if tx.status == "rejected" else "⏳")
            label = tx.tx_type.replace("_", " ").title()
            msg += f"{icon} {label} `${tx.amount_usdt:.2f}` · {dt}\n"
        msg += "\n"

    if bot_trades:
        msg += "*AI Bot Trades:*\n"
        for trade in bot_trades[:5]:
            pnl = trade.get("pnl")
            pnl_str = f"P&L ${pnl:+.2f}" if pnl is not None else "Open"
            t_str = trade["time"].strftime("%b %d %H:%M") if isinstance(trade.get("time"), datetime) else "—"
            msg += f"• {trade.get('action','?')} `{trade.get('ticker','?')}` @${trade.get('price',0):.2f} | {pnl_str} · {t_str}\n"

    if not txs and not bot_trades:
        msg += "_No history found yet._"

    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_support(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = (
        f"🆘 *FinAi Support Centre*\n\n"
        f"Open a ticket or live-chat with our team:\n\n"
        f"[📩 Visit Support]({APP_URL}/app/support)\n\n"
        f"_Response time: typically within 1–4 hours._"
    )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_chatfin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    user = _get_user_by_tg_chat_id(chat_id)
    name = (user.first_name or user.username or "there") if user else "there"
    question = " ".join(context.args) if context.args else ""

    if not question:
        await update.message.reply_text(
            f"👋 Hey *{name}*! I'm FinAi — your AI trading assistant.\n\n"
            f"Ask me anything:\n"
            f"• `/chatfin What is BTC doing today?`\n"
            f"• `/chatfin How should I diversify my portfolio?`\n"
            f"• `/chatfin What are the top opportunities right now?`",
            parse_mode="Markdown",
        )
        return

    await update.message.reply_text("🤔 Thinking…")
    user_email = user.email if user else None
    try:
        from src.conversation.agent import chat_with_agent
        reply = chat_with_agent(question, user_email=user_email)
    except Exception:
        try:
            from src.utils.local_llm import local_chat
            reply = local_chat(question, user_email)
        except Exception:
            reply = "Sorry, AI is temporarily unavailable. Try again in a moment."

    await update.message.reply_text(f"🤖 {reply}", parse_mode="Markdown")


async def cmd_news(update: Update, context: ContextTypes.DEFAULT_TYPE):
    events = _fetch_latest_events(limit=10)
    if not events:
        await update.message.reply_text("📰 No recent market news available right now.")
        return
    msg = "📰 *Latest Market News*\n\n"
    for i, ev in enumerate(events, 1):
        sentiment = getattr(ev, "sentiment", "") or ""
        icon = "🟢" if sentiment.lower() == "positive" else ("🔴" if sentiment.lower() == "negative" else "⚪")
        title = getattr(ev, "title", "News")[:65]
        impact = getattr(ev, "impact_score", None)
        dt = ""
        if hasattr(ev, "created_at") and ev.created_at:
            dt = f" · {ev.created_at.strftime('%b %d')}"
        extra = f" | Impact {impact}/10" if impact else ""
        msg += f"{i}. {icon} *{title}*{extra}{dt}\n"
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_wallet(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    user = _get_user_by_tg_chat_id(chat_id)
    name = (user.first_name or "User") if user else "there"
    bal = f"${user.balance_usdt:,.2f}" if user else "N/A"
    msg = (
        f"💳 *Wallet Guide — {name}*\n\n"
        f"Current Balance: `{bal} USDT`\n\n"
        f"*How to Deposit:*\n"
        f"1. Go to Wallet → Deposit tab\n"
        f"2. Choose method: BTC · ETH · USDT TRC-20 · Bank\n"
        f"3. Send to the provided address / account details\n"
        f"4. Submit the form — admin approves within 1–2 h\n\n"
        f"*How to Withdraw:*\n"
        f"1. Go to Wallet → Withdraw tab\n"
        f"2. Enter amount, destination address & Transfer PIN\n"
        f"3. Submit — processed within 24 h\n\n"
        f"_Min deposit: $10 · Min withdrawal: $20_\n\n"
        f"[🔗 Open Wallet]({APP_URL}/app/wallet)"
    )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(HELP_TEXT, parse_mode="Markdown")


# ─── Free-text shortcut handler ──────────────────────────────────────────────

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (update.message.text or "").lower().strip()
    if text in ("btc", "btc price", "bitcoin price", "bitcoin"):
        price = _fetch_btc_price()
        if price:
            await update.message.reply_text(
                f"₿ *Bitcoin (BTC)*: `${price:,.2f} USD`", parse_mode="Markdown"
            )
        else:
            await update.message.reply_text("❌ Could not fetch BTC price right now.")
    elif text in ("stop all", "stop all bots", "stopall", "stop bots"):
        stopped = []
        for t in list(bot_manager.bots.keys()):
            bot_manager.stop_bot(t)
            stopped.append(t)
        if stopped:
            await update.message.reply_text(f"⛔ Stopped {len(stopped)} bot(s): {', '.join(stopped)}")
        else:
            await update.message.reply_text("ℹ️ No bots were running.")
    elif text in ("help",):
        await update.message.reply_text(HELP_TEXT, parse_mode="Markdown")
    else:
        await update.message.reply_text(
            "❓ I didn't understand that.\n\n"
            "Try:\n• `btc` — BTC price\n• `stop all` — Stop all bots\n• `/help` — Full command list",
            parse_mode="Markdown",
        )


# ─── WhatsApp handler ─────────────────────────────────────────────────────────

WHATSAPP_HELP = """
📖 FinAi Bot Commands:
/1 /status — Active bot portfolio
/2 /balance — Your USDT balance
/3 /history — Last 5 trades & transactions
/4 /support — Support link
/5 /chatfin <msg> — Chat with FinAi AI
/6 /news — Latest 10 market news
/7 /wallet — Deposit / withdrawal guide
/help — This menu
btc — Live BTC price
stop all — Stop all running bots
""".strip()


def handle_whatsapp_command(body: str, from_number: str) -> str:
    user = _get_user_by_wa_number(from_number)
    name = (user.first_name or user.username or "there") if user else "there"
    parts = body.strip().split()
    cmd = parts[0].lower() if parts else ""
    args = parts[1:] if len(parts) > 1 else []
    text_lower = body.lower().strip()

    reply = "❓ Unknown command. Send /help or 'help' for all commands."

    if cmd in ("/1", "/status", "status"):
        statuses = bot_manager.get_all_status()
        if not statuses:
            reply = "ℹ️ No active bots running."
        else:
            lines = [
                f"{t}: ${s['portfolio_value']:.2f} P&L ${s.get('realized_pnl',0):+.2f} DD:{s['current_drawdown_pct']}%"
                for t, s in statuses.items()
            ]
            reply = "📊 Active Bot Portfolio:\n" + "\n".join(lines)

    elif cmd in ("/2", "/balance", "balance"):
        if not user:
            reply = f"❌ WhatsApp not linked. Connect at: {APP_URL}/app/profile"
        else:
            reply = (
                f"💰 Balance — {name}\n"
                f"${user.balance_usdt:,.2f} USDT\n"
                f"Plan: {(user.subscription or 'free').title()}"
            )

    elif cmd in ("/3", "/history", "history"):
        if not user:
            reply = f"❌ WhatsApp not linked. Connect at: {APP_URL}/app/profile"
        else:
            txs = _fetch_user_history(user.id, limit=5)
            if txs:
                lines = [
                    f"• {tx.tx_type} ${tx.amount_usdt:.2f} [{tx.status}] {tx.created_at.strftime('%b %d') if tx.created_at else '—'}"
                    for tx in txs
                ]
                reply = f"📜 Recent activity — {name}:\n" + "\n".join(lines)
            else:
                reply = f"📜 No transactions found yet."

    elif cmd in ("/4", "/support", "support"):
        reply = (
            f"🆘 FinAi Support Centre\n"
            f"Open a ticket: {APP_URL}/app/support\n"
            f"Response: typically 1–4 hours."
        )

    elif cmd in ("/5", "/chatfin", "chatfin"):
        question = " ".join(args)
        if not question:
            reply = f"👋 Hey {name}! Ask me anything:\nExample: /chatfin What is BTC doing today?"
        else:
            user_email = user.email if user else None
            try:
                from src.conversation.agent import chat_with_agent
                reply = chat_with_agent(question, user_email=user_email)
            except Exception:
                try:
                    from src.utils.local_llm import local_chat
                    reply = local_chat(question, user_email)
                except Exception:
                    reply = "AI is temporarily unavailable. Try again shortly."

    elif cmd in ("/6", "/news", "news"):
        events = _fetch_latest_events(limit=10)
        if not events:
            reply = "📰 No recent market news."
        else:
            lines = []
            for i, ev in enumerate(events, 1):
                sent = getattr(ev, "sentiment", "") or ""
                icon = "🟢" if sent.lower() == "positive" else ("🔴" if sent.lower() == "negative" else "⚪")
                lines.append(f"{i}. {icon} {getattr(ev,'title','News')[:60]}")
            reply = "📰 Latest Market News:\n" + "\n".join(lines)

    elif cmd in ("/7", "/wallet", "wallet"):
        bal = f"${user.balance_usdt:,.2f}" if user else "N/A"
        reply = (
            f"💳 Wallet Guide\nBalance: {bal} USDT\n\n"
            f"Deposit: Wallet → Deposit tab, choose method, send payment, submit.\n"
            f"Withdraw: Wallet → Withdraw, enter amount + Transfer PIN, submit.\n"
            f"Min deposit: $10 · Min withdrawal: $20\n"
            f"Link: {APP_URL}/app/wallet"
        )

    elif cmd in ("/help", "help") or text_lower == "help":
        reply = WHATSAPP_HELP

    elif text_lower in ("btc", "btc price", "bitcoin"):
        price = _fetch_btc_price()
        reply = f"₿ Bitcoin: ${price:,.2f} USD" if price else "❌ Could not fetch BTC price."

    elif text_lower in ("stop all", "stop all bots", "stopall"):
        stopped = []
        for t in list(bot_manager.bots.keys()):
            bot_manager.stop_bot(t)
            stopped.append(t)
        reply = f"⛔ Stopped {len(stopped)} bot(s): {', '.join(stopped)}" if stopped else "ℹ️ No bots running."

    # Send via Twilio
    if notifier.twilio_client and from_number:
        try:
            notifier.twilio_client.messages.create(
                from_=notifier.whatsapp_from,
                body=reply,
                to=from_number,
            )
        except Exception as e:
            logger.error(f"WhatsApp reply failed: {e}")

    return reply


# ─── Telegram bot setup ───────────────────────────────────────────────────────

def start_telegram_bot():
    if not _HAS_TELEGRAM:
        logger.warning("python-telegram-bot not installed — Telegram bot skipped")
        return

    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        logger.info("TELEGRAM_BOT_TOKEN not set — Telegram polling bot skipped")
        return

    app = Application.builder().token(token).build()

    # Numbered aliases + named commands
    for alias in ("1",):
        app.add_handler(CommandHandler(alias, cmd_status))
    app.add_handler(CommandHandler("status", cmd_status))

    for alias in ("2",):
        app.add_handler(CommandHandler(alias, cmd_balance))
    app.add_handler(CommandHandler("balance", cmd_balance))

    for alias in ("3",):
        app.add_handler(CommandHandler(alias, cmd_history))
    app.add_handler(CommandHandler("history", cmd_history))

    for alias in ("4",):
        app.add_handler(CommandHandler(alias, cmd_support))
    app.add_handler(CommandHandler("support", cmd_support))

    for alias in ("5",):
        app.add_handler(CommandHandler(alias, cmd_chatfin))
    app.add_handler(CommandHandler("chatfin", cmd_chatfin))

    for alias in ("6",):
        app.add_handler(CommandHandler(alias, cmd_news))
    app.add_handler(CommandHandler("news", cmd_news))

    for alias in ("7",):
        app.add_handler(CommandHandler(alias, cmd_wallet))
    app.add_handler(CommandHandler("wallet", cmd_wallet))

    app.add_handler(CommandHandler("help", cmd_help))

    # Free-text shortcuts
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    logger.success("🤖 Telegram Command Bot started — 7 commands + shortcuts")
    app.run_polling()
