/**
 * GET /admin/health-watch
 *
 * Runs a live ping against every configured service and returns a JSON
 * status report.  Admin-only.  All checks run in parallel.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import nodemailer from "nodemailer";
import pg from "pg";
import fs from "fs";
import { requireRole } from "../lib/auth";
import { logger } from "../lib/logger";
import { LOCAL_UPLOADS_DIR } from "../lib/localStorageFallback";
import { sendEmail } from "./email";

const router: IRouter = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = "ok" | "fail" | "skip";

interface ServiceCheck {
  service: string;       // human label shown in the UI
  key: string;           // stable identifier used as React key
  status: CheckStatus;
  detail: string;        // short note (latency, username, error message …)
  envVars: string[];     // which env vars this check reads
  configured: boolean;   // true if the env vars are present
}

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkSupabase(): Promise<ServiceCheck> {
  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "Supabase / PostgreSQL",
    key: "supabase",
    envVars: ["SUPABASE_DB_URL", "DATABASE_URL"],
    configured: !!(process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL),
  };
  const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!url) return { ...base, status: "skip", detail: "SUPABASE_DB_URL / DATABASE_URL not set" };

  // Build a safe host string without the password
  let hostDisplay = "";
  try {
    const p = new URL(url);
    hostDisplay = `${p.hostname}:${p.port || "5432"}${p.pathname}`;
  } catch { /* malformed URL */ }

  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
  const t0 = Date.now();
  try {
    const { rows } = await pool.query<{ now: string; version: string }>(
      "SELECT NOW() AS now, current_setting('server_version') AS version",
    );
    const ms = Date.now() - t0;
    const ver = rows[0]?.version?.split(" ")[0] ?? "";
    return {
      ...base,
      status: "ok",
      detail: `${hostDisplay}${ver ? ` · pg ${ver}` : ""} · ${ms} ms`,
    };
  } catch (err) {
    return { ...base, status: "fail", detail: err instanceof Error ? err.message : String(err) };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function checkApiSelf(): ServiceCheck {
  const uptimeSec = Math.floor(process.uptime());
  let uptimeStr: string;
  if (uptimeSec < 60) uptimeStr = `${uptimeSec}s`;
  else if (uptimeSec < 3600) uptimeStr = `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`;
  else uptimeStr = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

  const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const port = process.env.PORT_API ?? process.env.PORT ?? "?";

  return {
    service: "Express API server",
    key: "api-server",
    status: "ok",
    detail: `port ${port} · up ${uptimeStr} · ${memMb} MB RSS · Node ${process.version}`,
    envVars: [],
    configured: true,
  };
}

async function checkStorefront(): Promise<ServiceCheck> {
  // Nginx sits on port 80 and proxies / → storefront process.
  // We ping localhost:80 so the check goes through nginx, confirming both
  // nginx and the storefront process are alive.
  // Override with PORT_STOREFRONT for a direct process-level check (bypasses nginx).
  const directPort = process.env.PORT_STOREFRONT;
  const target = directPort
    ? `http://localhost:${directPort}`
    : "http://localhost:80";

  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "Storefront (nginx → React)",
    key: "storefront",
    envVars: directPort ? ["PORT_STOREFRONT"] : [],
    configured: true, // always attempt — nginx:80 is expected on every VPS deploy
  };

  const t0 = Date.now();
  try {
    const r = await fetch(`${target}/`, { signal: AbortSignal.timeout(8000) });
    const ms = Date.now() - t0;
    if (r.status < 400) {
      return { ...base, status: "ok", detail: `${target} → HTTP ${r.status} (${ms} ms)` };
    }
    return { ...base, status: "fail", detail: `${target} → HTTP ${r.status} (${ms} ms)` };
  } catch (err) {
    return {
      ...base,
      status: "fail",
      detail: `${target}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function checkSmtp(): Promise<ServiceCheck> {
  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "SMTP email",
    key: "smtp",
    envVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"],
    configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  };
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD)
    return { ...base, status: "skip", detail: "SMTP_HOST / SMTP_USER / SMTP_PASSWORD not set" };

  const configuredPort = Number(SMTP_PORT ?? "587");
  // Try configured port first; fall back to 465 (SSL) if blocked by VPS firewall
  const portsToTry = configuredPort === 465 ? [465] : [configuredPort, 465];

  let lastErr = "";
  for (const port of portsToTry) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      connectionTimeout: 8000,
      greetingTimeout: 5000,
    });
    try {
      await transporter.verify();
      const note = port !== configuredPort ? ` (port ${configuredPort} blocked — set SMTP_PORT=${port})` : "";
      return { ...base, status: "ok", detail: `${SMTP_HOST}:${port} — auth OK${note}` };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  return { ...base, status: "fail", detail: `Tried ports ${portsToTry.join(" & ")}: ${lastErr}` };
}

async function checkResend(): Promise<ServiceCheck> {
  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "Resend (fallback email)",
    key: "resend",
    envVars: ["RESEND_API_KEY"],
    configured: !!process.env.RESEND_API_KEY,
  };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ...base, status: "skip", detail: "RESEND_API_KEY not set" };

  try {
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return { ...base, status: "ok", detail: "API key valid" };
    const data = (await r.json()) as { message?: string };
    return { ...base, status: "fail", detail: data.message ?? `HTTP ${r.status}` };
  } catch (err) {
    return { ...base, status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkS3(): Promise<ServiceCheck> {
  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "S3 file storage",
    key: "s3",
    envVars: ["FILE_ACCESS_KEY_ID", "FILE_SECRET_ACCESS_KEY", "FILE_ENDPOINT_URL", "FILE_REGION", "FILE_BUCKET"],
    configured: !!(
      process.env.FILE_ACCESS_KEY_ID &&
      process.env.FILE_SECRET_ACCESS_KEY &&
      process.env.FILE_ENDPOINT_URL &&
      process.env.FILE_REGION &&
      process.env.FILE_BUCKET
    ),
  };
  const { FILE_ACCESS_KEY_ID, FILE_SECRET_ACCESS_KEY, FILE_ENDPOINT_URL, FILE_REGION, FILE_BUCKET } = process.env;
  if (!FILE_ACCESS_KEY_ID || !FILE_SECRET_ACCESS_KEY || !FILE_ENDPOINT_URL || !FILE_REGION || !FILE_BUCKET)
    return { ...base, status: "skip", detail: "FILE_* env vars not set — using local disk" };

  const client = new S3Client({
    region: FILE_REGION,
    endpoint: FILE_ENDPOINT_URL,
    credentials: { accessKeyId: FILE_ACCESS_KEY_ID, secretAccessKey: FILE_SECRET_ACCESS_KEY },
    forcePathStyle: true,
    requestHandler: { requestTimeout: 8000 } as unknown as undefined,
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: FILE_BUCKET }));
    return { ...base, status: "ok", detail: `bucket "${FILE_BUCKET}" reachable` };
  } catch (err) {
    return { ...base, status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkStripe(): Promise<ServiceCheck> {
  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "Stripe payments",
    key: "stripe",
    envVars: ["STRIPE_SECRET_KEY"],
    configured: !!process.env.STRIPE_SECRET_KEY,
  };
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ...base, status: "skip", detail: "STRIPE_SECRET_KEY not set" };

  try {
    const r = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = (await r.json()) as { available?: { amount: number; currency: string }[] };
      const bal = data.available?.[0];
      return { ...base, status: "ok", detail: bal ? `${bal.currency.toUpperCase()} ${(bal.amount / 100).toFixed(2)} available` : "balance OK" };
    }
    const err = (await r.json()) as { error?: { message?: string } };
    return { ...base, status: "fail", detail: err.error?.message ?? `HTTP ${r.status}` };
  } catch (err) {
    return { ...base, status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkTelegram(): Promise<ServiceCheck> {
  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "Telegram bot",
    key: "telegram",
    envVars: ["TELEGRAM_BOT_TOKEN"],
    configured: !!process.env.TELEGRAM_BOT_TOKEN,
  };
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ...base, status: "skip", detail: "TELEGRAM_BOT_TOKEN not set" };

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8000) });
    const data = (await r.json()) as { ok: boolean; result?: { username?: string; first_name?: string } };
    if (data.ok) return { ...base, status: "ok", detail: `@${data.result?.username} (${data.result?.first_name})` };
    return { ...base, status: "fail", detail: JSON.stringify(data) };
  } catch (err) {
    return { ...base, status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkGroq(): Promise<ServiceCheck> {
  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "Groq AI",
    key: "groq",
    envVars: ["GROQ_API_KEY"],
    configured: !!process.env.GROQ_API_KEY,
  };
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ...base, status: "skip", detail: "GROQ_API_KEY not set" };

  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = (await r.json()) as { data?: { id: string }[] };
      const count = data.data?.length ?? 0;
      return { ...base, status: "ok", detail: `${count} model${count !== 1 ? "s" : ""} available` };
    }
    return { ...base, status: "fail", detail: `HTTP ${r.status}` };
  } catch (err) {
    return { ...base, status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkNvidia(): Promise<ServiceCheck> {
  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "NVIDIA NIM",
    key: "nvidia",
    envVars: ["NVIDIA_API_KEY"],
    configured: !!process.env.NVIDIA_API_KEY,
  };
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return { ...base, status: "skip", detail: "NVIDIA_API_KEY not set" };

  try {
    const r = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = (await r.json()) as { data?: { id: string }[] };
      const count = data.data?.length ?? 0;
      return { ...base, status: "ok", detail: `${count} model${count !== 1 ? "s" : ""} available` };
    }
    return { ...base, status: "fail", detail: `HTTP ${r.status}` };
  } catch (err) {
    return { ...base, status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}

function checkLocalStorage(): ServiceCheck {
  let fileCount = 0;
  let totalBytes = 0;

  try {
    if (fs.existsSync(LOCAL_UPLOADS_DIR)) {
      const files = fs.readdirSync(LOCAL_UPLOADS_DIR);
      fileCount = files.length;
      for (const f of files) {
        try {
          const stat = fs.statSync(`${LOCAL_UPLOADS_DIR}/${f}`);
          totalBytes += stat.size;
        } catch { /* skip unreadable */ }
      }
    }
  } catch { /* folder missing */ }

  const mb = (totalBytes / 1024 / 1024).toFixed(2);
  const s3Ready = !!(
    process.env.FILE_ACCESS_KEY_ID &&
    process.env.FILE_SECRET_ACCESS_KEY &&
    process.env.FILE_ENDPOINT_URL &&
    process.env.FILE_REGION &&
    process.env.FILE_BUCKET
  );

  return {
    service: "Local storage (Allnart/)",
    key: "local-storage",
    status: "ok",
    detail: `${fileCount} file${fileCount !== 1 ? "s" : ""} · ${mb} MB on disk${s3Ready ? " · S3 sync available" : " · S3 not configured"}`,
    envVars: [],
    configured: true,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/admin/health-watch", requireRole("admin"), async (req: Request, res: Response) => {
  const t0 = Date.now();

  try {
    const [supabaseR, smtpR, resendR, s3R, stripeR, telegramR, groqR, nvidiaR, storefrontR] = await Promise.allSettled([
      checkSupabase(),
      checkSmtp(),
      checkResend(),
      checkS3(),
      checkStripe(),
      checkTelegram(),
      checkGroq(),
      checkNvidia(),
      checkStorefront(),
    ]);

    const settled = [supabaseR, smtpR, resendR, s3R, stripeR, telegramR, groqR, nvidiaR, storefrontR];
    const checks: ServiceCheck[] = [
      checkApiSelf(),
      ...settled.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : { service: "Unknown", key: "unknown", status: "fail" as CheckStatus, detail: String((r as PromiseRejectedResult).reason), envVars: [], configured: false },
      ),
      checkLocalStorage(),
    ];

    const summary = {
      ok: checks.filter((c) => c.status === "ok").length,
      fail: checks.filter((c) => c.status === "fail").length,
      skip: checks.filter((c) => c.status === "skip").length,
    };

    res.json({
      checks,
      summary,
      durationMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
      adminEmail: process.env.ADMIN_EMAIL ?? null,
      envInfo: {
        PORT: process.env.PORT ?? null,
        PORT_API: process.env.PORT_API ?? null,
        APP_URL: process.env.APP_URL ?? null,
        ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, "Health watch failed");
    res.status(500).json({ error: "Health check failed", detail: String(err) });
  }
});

/**
 * POST /admin/email/ping
 * Sends a test email to ADMIN_EMAIL env var. Admin-only.
 */
router.post("/admin/email/ping", requireRole("admin"), async (req: Request, res: Response) => {
  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    res.status(400).json({ error: "ADMIN_EMAIL is not set in your environment." });
    return;
  }
  try {
    await sendEmail({
      to,
      subject: "AllMart — Admin email ping",
      html: `<div style="font-family:sans-serif;padding:24px;max-width:480px">
        <h2 style="color:#1a56e8;margin:0 0 12px">AllMart</h2>
        <p>✅ This is a health-watch ping from your AllMart admin panel.</p>
        <p style="color:#555;font-size:13px">Sent at: ${new Date().toISOString()}<br>Server: ${process.env.APP_URL ?? "unknown"}</p>
      </div>`,
    });
    res.json({ ok: true, to });
  } catch (err) {
    res.status(500).json({ error: "Email failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
