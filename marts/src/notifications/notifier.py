import os
from datetime import datetime
from loguru import logger

try:
    import resend as _resend_mod
    _HAS_RESEND = True
except ImportError:
    _resend_mod = None
    _HAS_RESEND = False

try:
    from twilio.rest import Client as TwilioClient
    _HAS_TWILIO = True
except ImportError:
    _HAS_TWILIO = False

from src.notifications.whatsapp_provider import send_whatsapp as _wa_send

try:
    from telegram import Bot as TelegramBot
    _HAS_TELEGRAM = True
except ImportError:
    _HAS_TELEGRAM = False

try:
    from slack_sdk import WebClient as SlackWebClient
    _HAS_SLACK = True
except ImportError:
    _HAS_SLACK = False


class Notifier:
    def __init__(self):
        # Twilio for WhatsApp / SMS
        sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        token = os.getenv("TWILIO_AUTH_TOKEN", "")
        if _HAS_TWILIO and sid and token:
            self.twilio_client = TwilioClient(sid, token)
        else:
            self.twilio_client = None
        self.whatsapp_from = f"whatsapp:{os.getenv('TWILIO_WHATSAPP_NUMBER', '')}"
        self.whatsapp_to = os.getenv("WHATSAPP_TO_NUMBER", "")

        # Telegram
        tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        if _HAS_TELEGRAM and tg_token:
            self.telegram_bot = TelegramBot(token=tg_token)
        else:
            self.telegram_bot = None
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
        self.telegram_admin_chat_id = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")

        # Slack (optional)
        slack_token = os.getenv("SLACK_BOT_TOKEN", "")
        if _HAS_SLACK and slack_token:
            self.slack_client = SlackWebClient(token=slack_token)
        else:
            self.slack_client = None
        self.slack_channel = os.getenv("SLACK_CHANNEL", "#trading-alerts")

        # Resend (email) — from FinAi
        resend_key = os.getenv("RESEND_API_KEY", "")
        if _HAS_RESEND and resend_key:
            _resend_mod.api_key = resend_key
        self.resend_api_key = resend_key
        self.email_from = "FinAi <onboarding@resend.dev>"
        self.email_to = os.getenv("EMAIL_TO", "")

    def send_trade_alert(self, trade: dict):
        message = (
            f"🚨 FinAi Trade Alert @ {trade['time'].strftime('%Y-%m-%d %H:%M')}\n"
            f"Action: {trade['action']} {trade.get('qty', '')} {trade.get('ticker', 'UNKNOWN')}\n"
            f"Price: ${trade['price']:.2f}\n"
            f"P&L: ${trade.get('pnl', 0):.2f}\n"
            f"Reason: {trade.get('reason', 'Signal')}\n"
            f"Portfolio: ${trade.get('portfolio_value', 0):.2f}"
        )
        self._send_all(message, f"FinAi Trade: {trade['action']} {trade.get('ticker')}")

    def send_event_alert(self, event):
        message = (
            f"📰 New Financial Event Detected\n"
            f"Type: {event.event_type}\n"
            f"Title: {event.title}\n"
            f"Impact: {event.impact_score}/10 | Sentiment: {event.sentiment}\n"
            f"Short-term: {event.short_term_impact}"
        )
        self._send_all(message, "FinAi — New Event Detected")

    def send_forecast_alert(self, analysis):
        message = (
            f"📈 Trendline Forecast\n"
            f"Ticker: {analysis.ticker}\n"
            f"State: {analysis.trend_state}\n"
            f"Current: ${analysis.current_price:.2f} → Predicted: ${analysis.predicted_price:.2f}\n"
            f"Confidence: {analysis.confidence:.0%}\n"
            f"{analysis.prediction_text}"
        )
        self._send_all(message, f"FinAi Forecast: {analysis.ticker} {analysis.trend_state}")

    def send_admin_alert(self, message: str, subject: str = "FinAi Admin Alert"):
        """Send notification specifically to admin Telegram chat + email."""
        if self.telegram_bot and self.telegram_admin_chat_id:
            try:
                import asyncio
                loop = asyncio.new_event_loop()
                loop.run_until_complete(
                    self.telegram_bot.send_message(
                        chat_id=self.telegram_admin_chat_id,
                        text=message
                    )
                )
                loop.close()
            except Exception as e:
                logger.error(f"Admin Telegram failed: {e}")
        self._send_email(message, subject)

    def _send_all(self, message: str, subject: str = "FinAi Alert"):
        self._send_whatsapp(message)
        self._send_telegram(message)
        self._send_slack(message)
        self._send_email(message, subject)

    def _send_whatsapp(self, message: str):
        if self.whatsapp_to:
            try:
                _wa_send(self.whatsapp_to, message)
            except Exception as e:
                logger.error(f"WhatsApp failed: {e}")

    def _send_telegram(self, message: str):
        if self.telegram_bot and self.telegram_chat_id:
            try:
                import asyncio
                loop = asyncio.new_event_loop()
                loop.run_until_complete(
                    self.telegram_bot.send_message(
                        chat_id=self.telegram_chat_id,
                        text=message
                    )
                )
                loop.close()
            except Exception as e:
                logger.error(f"Telegram failed: {e}")

    def _send_slack(self, message: str):
        if self.slack_client:
            try:
                self.slack_client.chat_postMessage(channel=self.slack_channel, text=message)
            except Exception as e:
                logger.error(f"Slack failed: {e}")

    def _send_email(self, message: str, subject: str = "FinAi Alert"):
        if not _HAS_RESEND or not self.resend_api_key or not self.email_to:
            return
        try:
            _resend_mod.Emails.send({
                "from": self.email_from,
                "to": [self.email_to],
                "subject": subject,
                "text": message,
                "html": f"<pre style='font-family:sans-serif;white-space:pre-wrap'>{message}</pre>",
            })
        except Exception as e:
            logger.error(f"Email (Resend) failed: {e}")

    def send_daily_summary(self, bot_status_list: list):
        if not bot_status_list:
            return
        summary = "📊 FinAi Daily Portfolio Summary\n\n"
        for status in bot_status_list:
            summary += (
                f"{status['ticker']}: ${status['portfolio_value']:.2f} "
                f"| DD: {status['current_drawdown_pct']}% "
                f"| Pos: {status['position']}\n"
            )
        summary += f"\nGenerated at: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        self._send_all(summary, "FinAi — Daily Portfolio Summary")
