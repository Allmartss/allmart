import { Router, type IRouter, type Request, type Response } from "express";
import { BrevoClient } from "@getbrevo/brevo";
import { logger } from "../lib/logger";
import nodemailer from "nodemailer";
import {
  loadTemplate,
  loadOrderStatuses,
  renderTemplate,
  buildOrderTableHtml,
  buildAlertTableHtml,
} from "./email-templates";

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
  const statusMessages = await loadOrderStatuses();
  const msg = statusMessages[opts.orderStatus] ?? `Your order status is now: ${opts.orderStatus}.`;
  const statusLabel = opts.orderStatus.charAt(0).toUpperCase() + opts.orderStatus.slice(1);

  const template = await loadTemplate("order");
  const extraBodyHtml = buildOrderTableHtml({
    trackingCode: opts.trackingCode,
    total: fmt,
    shippingAddress: opts.shippingAddress,
    orderStatus: opts.orderStatus,
  });

  const html = renderTemplate(
    { ...template, subject: template.subject },
    {
      name: opts.name,
      tracking_code: opts.trackingCode,
      order_status: opts.orderStatus,
      order_status_label: statusLabel,
      status_message: msg,
      total: fmt,
      shipping_address: opts.shippingAddress,
    },
    extraBodyHtml,
  );

  const subject = template.subject
    .split("{{tracking_code}}").join(opts.trackingCode)
    .split("{{order_status_label}}").join(statusLabel);

  await sendEmail({ to: opts.to, subject, html });
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
  const resolvedAdminUrl = opts.adminUrl ?? process.env.STOREFRONT_URL ?? "https://allmarts.us";

  try {
    const template = await loadTemplate("admin_alert");
    const extraBodyHtml = buildAlertTableHtml({
      trackingCode: opts.trackingCode,
      total: fmt,
      customerName: opts.customerName,
      customerEmail: opts.customerEmail,
      shippingAddress: opts.shippingAddress,
      paymentNote: opts.paymentNote,
      adminUrl: resolvedAdminUrl,
    });

    const html = renderTemplate(
      template,
      {
        tracking_code: opts.trackingCode,
        total: fmt,
        customer_name: opts.customerName,
        customer_email: opts.customerEmail,
        shipping_address: opts.shippingAddress,
      },
      extraBodyHtml,
    );

    const subject = template.subject
      .split("{{tracking_code}}").join(opts.trackingCode);

    await sendEmail({ to: adminEmail, subject, html });
  } catch (err) {
    logger.error({ err }, "Admin payment alert email failed");
  }
}

export async function sendSupportCaseStatusEmail(opts: {
  to: string;
  name: string;
  caseType: "report" | "refund";
  trackingCode: string;
  status: string;
  adminNote: string;
}) {
  const template = await loadTemplate(opts.caseType === "report" ? "report_status" : "refund_status");
  const statusLabel = opts.status.charAt(0).toUpperCase() + opts.status.slice(1);
  const vars = {
    name: opts.name,
    tracking_code: opts.trackingCode,
    case_status: opts.status,
    case_status_label: statusLabel,
    admin_response: opts.adminNote,
  };
  const html = renderTemplate(template, vars);
  const subject = template.subject
    .split("{{tracking_code}}").join(opts.trackingCode)
    .split("{{case_status}}").join(opts.status)
    .split("{{case_status_label}}").join(statusLabel);

  await sendEmail({ to: opts.to, subject, html });
  logger.info({ to: opts.to, caseType: opts.caseType, status: opts.status }, "Support case status email sent");
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
