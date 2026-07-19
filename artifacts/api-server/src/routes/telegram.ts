import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { sendTelegram, setWebhook, isTelegramConfigured } from "../lib/telegram";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/telegram/webhook", async (req: Request, res: Response) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const incoming = req.headers["x-telegram-bot-api-secret-token"] as string;

  if (secret && incoming !== secret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = req.body as {
    message?: { text?: string; chat?: { id: number } };
  };

  const text = body.message?.text?.trim() ?? "";

  const botName = process.env.TELEGRAM_BOT_NAME ? `@${process.env.TELEGRAM_BOT_NAME.replace(/^@/, "")}` : null;

  if (text === "/orders" || (botName && text === `/orders${botName}`)) {
    const orders = await db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.createdAt))
      .limit(5);

    if (orders.length === 0) {
      await sendTelegram("📦 No orders yet.");
    } else {
      const lines = orders.map((o) =>
        `• <b>#${o.id}</b> [${o.trackingCode}] — ${o.status.toUpperCase()} — $${o.total} — ${new Date(o.createdAt).toLocaleDateString()}`
      );
      await sendTelegram(`📦 <b>Last ${orders.length} orders:</b>\n\n${lines.join("\n")}`);
    }
  } else if (text === "/pending" || (botName && text === `/pending${botName}`)) {
    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.paymentVerified, "pending"))
      .orderBy(desc(ordersTable.createdAt))
      .limit(10);

    const withScreenshot = orders.filter((o) => !!o.paymentScreenshotUrl);
    if (withScreenshot.length === 0) {
      await sendTelegram("✅ No pending payment screenshots.");
    } else {
      const lines = withScreenshot.map((o) =>
        `• <b>#${o.id}</b> [${o.trackingCode}] — $${o.total}`
      );
      await sendTelegram(`⏳ <b>Pending payment screenshots (${withScreenshot.length}):</b>\n\n${lines.join("\n")}`);
    }
  } else if (text === "/notifications" || (botName && text === `/notifications${botName}`)) {
    const admins = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);

    if (admins.length === 0) {
      await sendTelegram("No admin users found.");
    } else {
      const notifs = await db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, admins[0]!.id))
        .orderBy(desc(notificationsTable.createdAt))
        .limit(5);

      if (notifs.length === 0) {
        await sendTelegram("🔔 No notifications yet.");
      } else {
        const lines = notifs.map((n) =>
          `• <b>${n.title}</b>\n  ${n.message.slice(0, 80)}${n.message.length > 80 ? "…" : ""}`
        );
        await sendTelegram(`🔔 <b>Last ${notifs.length} notifications:</b>\n\n${lines.join("\n\n")}`);
      }
    }
  } else if (text === "/help" || text === "/start" || (botName && (text === `/help${botName}` || text === `/start${botName}`))) {
    await sendTelegram(
      `🤖 <b>AllMart Admin Bot</b>\n\n` +
      `Available commands:\n` +
      `/orders — Last 5 orders\n` +
      `/pending — Orders awaiting payment verification\n` +
      `/notifications — Latest admin notifications\n` +
      `/help — Show this message`
    );
  }

  res.status(200).json({ ok: true });
});

router.post(
  "/telegram/set-webhook",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    if (!isTelegramConfigured()) {
      res.status(503).json({ error: "Telegram not configured" });
      return;
    }
    const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
    if (!appUrl) {
      res.status(500).json({ error: "APP_URL is not set. Add APP_URL=https://yourdomain.com to your .env file." });
      return;
    }
    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    try {
      const result = await setWebhook(webhookUrl);
      logger.info({ webhookUrl, result }, "Telegram webhook set");
      res.json({ ok: true, webhookUrl, result });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  }
);

router.get(
  "/telegram/status",
  requireRole("admin"),
  async (_req: Request, res: Response) => {
    res.json({ configured: isTelegramConfigured() });
  }
);

export default router;
