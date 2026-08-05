import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable, DEFAULT_FOOTER } from "@workspace/db";
import type { EmailBlock, CampaignFooter } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { renderCampaignHtml } from "./email-campaigns";

const router: IRouter = Router();

// ── Types ────────────────────────────────────────────────────────────────────

export type EmailTemplate = {
  subject: string;
  blocks: EmailBlock[];
  footer: CampaignFooter;
};

export type OrderStatusMessages = Record<string, string>;

const TEMPLATE_KEYS = ["welcome", "login", "verification", "order", "admin_alert", "report_status", "refund_status"] as const;
type TemplateKey = (typeof TEMPLATE_KEYS)[number];

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  welcome: {
    subject: "Welcome to AllMart 🎉",
    blocks: [
      { type: "header", text: "Welcome to AllMart, {{name}}!", size: "h2", align: "center", color: "#111827" },
      { type: "text", text: "Your account has been created successfully. Start shopping thousands of products across every category." },
      { type: "text", text: "{{signup_bonus_text}}" },
      { type: "button", text: "Start Shopping", url: "https://allmarts.us/products", bgColor: "#7c3aed", align: "center" },
      { type: "divider" },
      { type: "text", text: "If you didn't create this account, please ignore this email." },
    ],
    footer: { ...DEFAULT_FOOTER },
  },
  login: {
    subject: "New login to your AllMart account",
    blocks: [
      { type: "header", text: "Login detected", size: "h2", align: "left", color: "#111827" },
      { type: "text", text: "Hi {{name}}, a new sign-in to your AllMart account was detected." },
      { type: "text", text: "Time: {{login_time}}" },
      { type: "divider" },
      { type: "text", text: "If this wasn't you, please change your password immediately." },
    ],
    footer: { ...DEFAULT_FOOTER },
  },
  verification: {
    subject: "Your AllMart verification code",
    blocks: [
      { type: "header", text: "Verify your email", size: "h2", align: "left", color: "#111827" },
      { type: "text", text: "Hi {{name}}, use the code below to verify your AllMart account." },
    ],
    footer: { ...DEFAULT_FOOTER },
  },
  order: {
    subject: "Order {{tracking_code}} — {{order_status_label}}",
    blocks: [
      { type: "header", text: "Order Update", size: "h2", align: "left", color: "#111827" },
      { type: "text", text: "Hi {{name}}," },
      { type: "text", text: "{{status_message}}" },
    ],
    footer: { ...DEFAULT_FOOTER },
  },
  admin_alert: {
    subject: "Payment screenshot uploaded — Order {{tracking_code}}",
    blocks: [
      { type: "header", text: "AllMart — Admin Alert", size: "h2", align: "left", color: "#111827" },
      { type: "text", text: "A customer has uploaded a payment screenshot and is awaiting verification." },
    ],
    footer: { ...DEFAULT_FOOTER },
  },
  report_status: {
    subject: "Order report {{tracking_code}} — {{case_status_label}}",
    blocks: [
      { type: "header", text: "Order report update", size: "h2", align: "left", color: "#111827" },
      { type: "text", text: "Hi {{name}}," },
      { type: "text", text: "Your report for order {{tracking_code}} is now {{case_status_label}}." },
      { type: "text", text: "Support response: {{admin_response}}" },
    ],
    footer: { ...DEFAULT_FOOTER },
  },
  refund_status: {
    subject: "Refund request {{tracking_code}} — {{case_status_label}}",
    blocks: [
      { type: "header", text: "Refund request update", size: "h2", align: "left", color: "#111827" },
      { type: "text", text: "Hi {{name}}," },
      { type: "text", text: "Your refund request for order {{tracking_code}} is now {{case_status_label}}." },
      { type: "text", text: "Support response: {{admin_response}}" },
    ],
    footer: { ...DEFAULT_FOOTER },
  },
};

export const DEFAULT_ORDER_STATUSES: OrderStatusMessages = {
  placed: "Your order has been placed and is being processed.",
  confirmed: "Your payment has been confirmed. Your order is now being prepared.",
  dispatched: "Great news! Your order is on its way.",
  delivered: "Your order has been delivered. Enjoy!",
  cancelled: "Your order has been cancelled.",
  payment_rejected:
    "Your payment could not be verified. Please contact support or resubmit your proof of payment.",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function loadTemplate(key: TemplateKey): Promise<EmailTemplate> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, `email_template_${key}`));
    if (!row) return DEFAULT_TEMPLATES[key];
    const parsed = JSON.parse(row.value) as Partial<EmailTemplate>;
    return {
      ...DEFAULT_TEMPLATES[key],
      ...parsed,
      footer: { ...DEFAULT_FOOTER, ...(parsed.footer ?? {}) },
    };
  } catch {
    return DEFAULT_TEMPLATES[key];
  }
}

export async function loadOrderStatuses(): Promise<OrderStatusMessages> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "email_template_order_statuses"));
    if (!row) return DEFAULT_ORDER_STATUSES;
    return { ...DEFAULT_ORDER_STATUSES, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_ORDER_STATUSES;
  }
}

function replaceVars(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

export function buildOrderTableHtml(opts: {
  trackingCode: string;
  total: string;
  shippingAddress: string;
  orderStatus: string;
}): string {
  const { trackingCode, total, shippingAddress, orderStatus } = opts;
  return `
    <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee;border-radius:8px;overflow:hidden">
      <tr style="background:#f0f5ff">
        <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Order ref</td>
        <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #eee">${escHtml(trackingCode)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Total</td>
        <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #eee">${escHtml(total)}</td>
      </tr>
      <tr style="background:#f0f5ff">
        <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Shipping to</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee">${escHtml(shippingAddress)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#666;font-size:13px">Status</td>
        <td style="padding:12px 16px;text-transform:capitalize;color:#1a56e8;font-weight:600">${escHtml(orderStatus)}</td>
      </tr>
    </table>`;
}

export function buildAlertTableHtml(opts: {
  trackingCode: string;
  total: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  paymentNote?: string | null;
  adminUrl: string;
}): string {
  const { trackingCode, total, customerName, customerEmail, shippingAddress, paymentNote, adminUrl } = opts;
  return `
    <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee;border-radius:8px;overflow:hidden">
      <tr style="background:#f0f5ff">
        <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee;width:140px">Order ref</td>
        <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #eee">${escHtml(trackingCode)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Customer</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee">${escHtml(customerName)} (${escHtml(customerEmail)})</td>
      </tr>
      <tr style="background:#f0f5ff">
        <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Order total</td>
        <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #eee">${escHtml(total)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #eee">Shipping to</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee">${escHtml(shippingAddress)}</td>
      </tr>
      ${paymentNote ? `<tr style="background:#f0f5ff">
        <td style="padding:12px 16px;color:#666;font-size:13px">Customer note</td>
        <td style="padding:12px 16px;font-style:italic">${escHtml(paymentNote)}</td>
      </tr>` : ""}
    </table>
    <a href="${escHtml(adminUrl)}/orders"
       style="display:inline-block;background:#1a56e8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
      Review in Admin Panel →
    </a>`;
}

export function buildVerificationCodeHtml(code: string): string {
  return `
    <div style="margin:24px 0;padding:20px;background:#f9f5f1;border-radius:12px;text-align:center">
      <p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#e07b39;margin:0">${escHtml(code)}</p>
      <p style="font-size:12px;color:#888;margin:8px 0 0">Expires in 30 minutes</p>
    </div>
    <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>`;
}

export function renderTemplate(
  template: EmailTemplate,
  vars: Record<string, string>,
  extraBodyHtml?: string,
): string {
  const html = renderCampaignHtml(
    template.subject,
    template.blocks,
    template.footer,
    "",
    extraBodyHtml,
  );
  return replaceVars(html, vars);
}

// ── Routes ───────────────────────────────────────────────────────────────────

/** List all templates (merged with defaults) */
router.get("/admin/email-templates", requireRole("admin"), async (_req: Request, res: Response) => {
  const rows = await db.select().from(settingsTable);
  const saved: Record<string, string> = {};
  for (const row of rows) {
    if (row.key.startsWith("email_template_")) {
      saved[row.key.replace("email_template_", "")] = row.value;
    }
  }

  const result: Record<string, unknown> = {};
  for (const key of TEMPLATE_KEYS) {
    const base = DEFAULT_TEMPLATES[key];
    const override = saved[key] ? (JSON.parse(saved[key]) as Partial<EmailTemplate>) : {};
    result[key] = {
      ...base,
      ...override,
      footer: { ...DEFAULT_FOOTER, ...(override.footer ?? base.footer) },
    };
  }
  result["order_statuses"] = saved["order_statuses"]
    ? { ...DEFAULT_ORDER_STATUSES, ...JSON.parse(saved["order_statuses"]) }
    : DEFAULT_ORDER_STATUSES;

  res.json(result);
});

/** Get defaults for all templates (ignores any saved overrides) */
router.get("/admin/email-templates/defaults", requireRole("admin"), (_req: Request, res: Response) => {
  const result: Record<string, unknown> = {};
  for (const key of TEMPLATE_KEYS) result[key] = DEFAULT_TEMPLATES[key];
  result["order_statuses"] = DEFAULT_ORDER_STATUSES;
  res.json(result);
});

/** Save a template (or order_statuses) */
router.put(
  "/admin/email-templates/:key",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { key } = req.params;
    const settingKey = `email_template_${key}`;
    const value = JSON.stringify(req.body);
    const [existing] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, settingKey));
    if (existing) {
      await db
        .update(settingsTable)
        .set({ value, updatedAt: new Date() })
        .where(eq(settingsTable.key, settingKey));
    } else {
      await db.insert(settingsTable).values({ key: settingKey, value });
    }
    res.json({ ok: true });
  },
);

/** Reset a template to default */
router.delete(
  "/admin/email-templates/:key",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { key } = req.params;
    await db
      .delete(settingsTable)
      .where(eq(settingsTable.key, `email_template_${key}`));
    res.json({ ok: true });
  },
);

/** Live preview — renders the posted template with sample data */
router.post(
  "/admin/email-templates/:key/preview",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { key } = req.params;
    const templateData = req.body as Partial<EmailTemplate>;
    const base = TEMPLATE_KEYS.includes(key as TemplateKey)
      ? DEFAULT_TEMPLATES[key as TemplateKey]
      : DEFAULT_TEMPLATES.welcome;
    const template: EmailTemplate = {
      ...base,
      ...templateData,
      footer: { ...DEFAULT_FOOTER, ...(base.footer ?? {}), ...(templateData.footer ?? {}) },
    };

    let extraBodyHtml = "";
    let vars: Record<string, string> = {};

    if (key === "welcome") {
      vars = {
        name: "Jane Smith",
        signup_bonus_text: "🎁 You've received a <strong>20 signup bonus</strong> credited to your account!",
      };
    } else if (key === "login") {
      vars = {
        name: "Jane Smith",
        login_time: "Monday, 3 August 2026 at 10:30 AM",
      };
    } else if (key === "verification") {
      vars = { name: "Jane Smith", code: "382916" };
      extraBodyHtml = buildVerificationCodeHtml("382916");
    } else if (key === "order") {
      const statuses = await loadOrderStatuses();
      vars = {
        name: "Jane Smith",
        tracking_code: "AM-2026-0001",
        order_status: "dispatched",
        order_status_label: "Dispatched",
        status_message: statuses["dispatched"] ?? "Your order is on its way.",
        total: "$49.99",
        shipping_address: "123 Main St, Lagos, Nigeria",
      };
      extraBodyHtml = buildOrderTableHtml({
        trackingCode: "AM-2026-0001",
        total: "$49.99",
        shippingAddress: "123 Main St, Lagos, Nigeria",
        orderStatus: "dispatched",
      });
    } else if (key === "admin_alert") {
      vars = {
        tracking_code: "AM-2026-0001",
        total: "$49.99",
        customer_name: "Jane Smith",
        customer_email: "jane@example.com",
        shipping_address: "123 Main St, Lagos, Nigeria",
      };
      extraBodyHtml = buildAlertTableHtml({
        trackingCode: "AM-2026-0001",
        total: "$49.99",
        customerName: "Jane Smith",
        customerEmail: "jane@example.com",
        shippingAddress: "123 Main St, Lagos, Nigeria",
        paymentNote: "Payment sent via bank transfer",
        adminUrl: process.env.STOREFRONT_URL ?? "https://allmarts.us",
      });
    } else if (key === "report_status" || key === "refund_status") {
      vars = {
        name: "Jane Smith",
        tracking_code: "AM-2026-0001",
        case_status: "reviewed",
        case_status_label: "Reviewed",
        admin_response: "We have reviewed your request and will update you again soon.",
      };
    }

    const html = renderTemplate(template, vars, extraBodyHtml);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  },
);

export default router;
