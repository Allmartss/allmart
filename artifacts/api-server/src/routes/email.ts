import { Router, type IRouter, type Request, type Response } from "express";
import { BrevoClient } from "@getbrevo/brevo";
import { logger } from "../lib/logger";
import nodemailer from "nodemailer";

const router: IRouter = Router();

// Default FROM (used for SMTP and as a fallback)
const DEFAULT_FROM = process.env.SMTP_USER
  ? `AllMart <${process.env.SMTP_USER}>`
  : "AllMart <noreply@allmart.com>";

// Brevo-specific FROM — BREVO_SENDER_EMAIL must be a verified sender in your Brevo account.
// If not set, falls back to SMTP_USER which may not be verified in Brevo and can cause delivery failure.
const BREVO_FROM = process.env.BREVO_SENDER_EMAIL
  ? `AllMart <${process.env.BREVO_SENDER_EMAIL}>`
  : DEFAULT_FROM;

// ---------------------------------------------------------------------------
// Brevo (Sendinblue) sender — exported so ping endpoint can target it directly
// ---------------------------------------------------------------------------

export async function sendViaBrevo(payload: { to: string[]; subject: string; html: string; from: string }): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY not set");

  const brevo = new BrevoClient({ apiKey });

  // Parse "Name <email>" or plain email
  const fromMatch = payload.from.match(/^(.*?)\s*<([^>]+)>$/);
  const senderName = fromMatch ? fromMatch[1].trim() || "AllMart" : "AllMart";
  const senderEmail = fromMatch ? fromMatch[2] : payload.from;

  await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: senderName, email: senderEmail },
    to: payload.to.map((email) => ({ email })),
    subject: payload.subject,
    htmlContent: payload.html,
  });

  logger.info({ to: payload.to, subject: payload.subject, sender: senderEmail }, "Email sent via Brevo");
}

// ---------------------------------------------------------------------------
// SMTP sender — exported so ping endpoint can target it directly
// ---------------------------------------------------------------------------

export async function sendViaSmtp(payload: { to: string[]; subject: string; html: string; from: string }): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD)
    throw new Error("SMTP_HOST / SMTP_USER / SMTP_PASSWORD not set");

  const configuredPort = Number(SMTP_PORT ?? "587");
  const pinnedByUser = !!SMTP_PORT;
  const fallbackPort = process.env.SMTP_PORT_FALLBACK ? Number(process.env.SMTP_PORT_FALLBACK) : 2525;
  const portsToTry: number[] = pinnedByUser
    ? [configuredPort]
    : [...new Set([configuredPort, fallbackPort, 465])];

  let lastErr: unknown;
  for (const port of portsToTry) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      connectionTimeout: 8_000,
      greetingTimeout: 5_000,
    });
    try {
      await transporter.sendMail({ from: payload.from, to: payload.to.join(", "), subject: payload.subject, html: payload.html });
      logger.info({ to: payload.to, subject: payload.subject, host: SMTP_HOST, port }, "Email sent via SMTP");
      return;
    } catch (smtpErr) {
      lastErr = smtpErr;
      if (port !== portsToTry[portsToTry.length - 1]) {
        logger.warn({ port, err: smtpErr }, `SMTP port ${port} failed, retrying on next port`);
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Unified email sender — tries Brevo first, falls back to SMTP.
// Returns the name of the provider that was used.
// ---------------------------------------------------------------------------

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<"smtp" | "brevo"> {
  const { to, subject, html } = payload;
  const toArr = Array.isArray(to) ? to : [to];

  // When caller passes an explicit from, honour it for both providers.
  // Otherwise use provider-specific defaults so Brevo uses its verified sender.
  const brevoFrom = payload.from ?? BREVO_FROM;
  const smtpFrom  = payload.from ?? DEFAULT_FROM;

  // --- Brevo (primary) ---
  if (process.env.BREVO_API_KEY) {
    try {
      await sendViaBrevo({ to: toArr, subject, html, from: brevoFrom });
      return "brevo";
    } catch (brevoErr) {
      logger.error(
        { err: brevoErr, to: toArr, subject, brevoFrom },
        "Brevo send failed — falling back to SMTP. " +
        "Most common cause: sender email not verified in Brevo (Settings → Senders & IPs). " +
        "Set BREVO_SENDER_EMAIL to your verified Brevo sender address.",
      );
    }
  }

  // --- SMTP (fallback) ---
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    try {
      await sendViaSmtp({ to: toArr, subject, html, from: smtpFrom });
      return "smtp";
    } catch (smtpErr) {
      logger.warn({ err: smtpErr, to: toArr, subject }, "SMTP send failed on all ports");
      throw smtpErr;
    }
  }

  // --- No transport configured ---
  const err = "Email not sent: set BREVO_API_KEY or SMTP_HOST + SMTP_USER + SMTP_PASSWORD to enable emails";
  logger.warn({ to: toArr, subject }, err);
  throw new Error(err);
}

// ---------------------------------------------------------------------------
// Exported helpers used by other routes
// ---------------------------------------------------------------------------

export async function sendOrderEmail(opts: {
  to: string;
  name: string;
  orderStatus: string;
  trackingCode: string;
  total: number;
  currency: string;
  shippingAddress: string;
}) {
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: opts.currency }).format(opts.total);
  const statusMessages: Record<string, string> = {
    placed: "Your order has been placed and is being processed.",
    confirmed: "Your payment has been confirmed. Your order is now being prepared.",
    dispatched: "Great news! Your order is on its way.",
    delivered: "Your order has been delivered. Enjoy!",
    cancelled: "Your order has been cancelled.",
    payment_rejected: "Your payment could not be verified. Please contact support or resubmit your proof of payment.",
  };
  const msg = statusMessages[opts.orderStatus] ?? `Your order status is now: ${opts.orderStatus}.`;
  const statusLabel = opts.orderStatus.charAt(0).toUpperCase() + opts.orderStatus.slice(1);

  await sendEmail({
    to: opts.to,
    subject: `Order ${opts.trackingCode} — ${statusLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff">
        <div style="border-bottom:2px solid #1a56e8;padding-bottom:16px;margin-bottom:24px">
          <h1 style="color:#1a56e8;margin:0;font-size:24px">AllMart</h1>
        </div>
        <p style="color:#111;font-size:16px">Hi ${opts.name},</p>
        <p style="color:#333;font-size:15px">${msg}</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee;border-radius:8px;overflow:hidden">
          <tr style="background:#f0f5ff">
            <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Order ref</td>
            <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #eee">${opts.trackingCode}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Total</td>
            <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #eee">${fmt}</td>
          </tr>
          <tr style="background:#f0f5ff">
            <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Shipping to</td>
            <td style="padding:12px 16px;border-bottom:1px solid #eee">${opts.shippingAddress}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#666;font-size:13px">Status</td>
            <td style="padding:12px 16px;text-transform:capitalize;color:#1a56e8;font-weight:600">${opts.orderStatus}</td>
          </tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
          — The AllMart Team · support@allmart.com
        </p>
      </div>`,
  });

  logger.info({ to: opts.to, orderStatus: opts.orderStatus }, "Order email sent");
}

export async function sendAdminPaymentAlert(opts: {
  trackingCode: string;
  total: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  paymentNote?: string | null;
  adminUrl?: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@allmart.com";
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: opts.currency }).format(opts.total);

  try {
    await sendEmail({
      to: adminEmail,
      subject: `Payment screenshot uploaded — Order ${opts.trackingCode}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff">
          <div style="border-bottom:2px solid #1a56e8;padding-bottom:16px;margin-bottom:24px">
            <h1 style="color:#1a56e8;margin:0;font-size:24px">AllMart — Admin Alert</h1>
          </div>
          <p style="color:#111;font-size:16px;font-weight:600">A customer has uploaded a payment screenshot and is awaiting verification.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee;border-radius:8px;overflow:hidden">
            <tr style="background:#f0f5ff">
              <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee;width:140px">Order ref</td>
              <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #eee">${opts.trackingCode}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Customer</td>
              <td style="padding:12px 16px;border-bottom:1px solid #eee">${opts.customerName} (${opts.customerEmail})</td>
            </tr>
            <tr style="background:#f0f5ff">
              <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Order total</td>
              <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #eee">${fmt}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Shipping to</td>
              <td style="padding:12px 16px;border-bottom:1px solid #eee">${opts.shippingAddress}</td>
            </tr>
            ${opts.paymentNote ? `
            <tr style="background:#f0f5ff">
              <td style="padding:12px 16px;color:#666;font-size:13px">Customer note</td>
              <td style="padding:12px 16px;font-style:italic">${opts.paymentNote}</td>
            </tr>` : ""}
          </table>
          <a href="${opts.adminUrl ?? "https://allmart.replit.app"}/orders"
             style="display:inline-block;background:#1a56e8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
            Review in Admin Panel →
          </a>
          <p style="color:#888;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
            — AllMart automated alert
          </p>
        </div>`,
    });
  } catch (err) {
    logger.error({ err }, "Admin payment alert email failed");
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.post("/email/order-status", async (req: Request, res: Response) => {
  const { to, name, orderStatus, trackingCode, total, currency, shippingAddress } = req.body as {
    to: string; name: string; orderStatus: string;
    trackingCode: string; total: number; currency: string; shippingAddress: string;
  };
  try {
    await sendOrderEmail({ to, name, orderStatus, trackingCode, total, currency, shippingAddress });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Email failed", detail: String(err) });
  }
});

router.post("/email/test", async (req: Request, res: Response) => {
  const { to } = req.body as { to?: string };
  if (!to) { res.status(400).json({ error: "to required" }); return; }
  try {
    const provider = await sendEmail({
      to,
      subject: "AllMart — Email test",
      html: "<div style='font-family:sans-serif;padding:24px'><h2 style='color:#1a56e8'>AllMart</h2><p>This is a test email. If you received this, emails are working correctly!</p></div>",
    });
    res.json({ ok: true, provider });
  } catch (err) {
    res.status(500).json({ error: "Email failed", detail: String(err) });
  }
});

export default router;
