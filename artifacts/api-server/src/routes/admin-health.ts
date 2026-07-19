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
import { requireRole } from "../lib/auth";
import { logger } from "../lib/logger";

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

async function checkDatabase(): Promise<ServiceCheck> {
  const base: Omit<ServiceCheck, "status" | "detail"> = {
    service: "PostgreSQL",
    key: "db",
    envVars: ["SUPABASE_DB_URL", "DATABASE_URL"],
    configured: !!(process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL),
  };
  const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!url) return { ...base, status: "skip", detail: "SUPABASE_DB_URL / DATABASE_URL not set" };

  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
  const t0 = Date.now();
  try {
    const { rows } = await pool.query<{ now: string }>("SELECT NOW() AS now");
    const ms = Date.now() - t0;
    return { ...base, status: "ok", detail: `${rows[0]?.now}  (${ms} ms)` };
  } catch (err) {
    return { ...base, status: "fail", detail: err instanceof Error ? err.message : String(err) };
  } finally {
    await pool.end().catch(() => undefined);
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

  const port = Number(SMTP_PORT ?? "587");
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
    return { ...base, status: "ok", detail: `${SMTP_HOST}:${port} — auth OK` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, status: "fail", detail: msg };
  }
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

// ── Route ─────────────────────────────────────────────────────────────────────

router.get("/admin/health-watch", requireRole("admin"), async (req: Request, res: Response) => {
  const t0 = Date.now();

  try {
    const results = await Promise.allSettled([
      checkDatabase(),
      checkSmtp(),
      checkResend(),
      checkS3(),
      checkStripe(),
      checkTelegram(),
      checkGroq(),
      checkNvidia(),
    ]);

    const checks: ServiceCheck[] = results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { service: "Unknown", key: "unknown", status: "fail" as CheckStatus, detail: String((r as PromiseRejectedResult).reason), envVars: [], configured: false },
    );

    const summary = {
      ok: checks.filter((c) => c.status === "ok").length,
      fail: checks.filter((c) => c.status === "fail").length,
      skip: checks.filter((c) => c.status === "skip").length,
    };

    res.json({ checks, summary, durationMs: Date.now() - t0, checkedAt: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "Health watch failed");
    res.status(500).json({ error: "Health check failed", detail: String(err) });
  }
});

export default router;
