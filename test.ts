/**
 * AllMart service ping suite
 * Run with: npx tsx test.ts
 */

import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import nodemailer from "nodemailer";
import pg from "pg";

// ── Colour helpers ────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function ok(label: string, note = "") {
  const tag = `${c.green}${c.bold} ✔ PASS${c.reset}`;
  console.log(`  ${tag}  ${label}${note ? `  ${c.dim}${note}${c.reset}` : ""}`);
}

function fail(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const tag = `${c.red}${c.bold} ✘ FAIL${c.reset}`;
  console.log(`  ${tag}  ${label}`);
  console.log(`         ${c.dim}${msg}${c.reset}`);
}

function skip(label: string, reason: string) {
  const tag = `${c.yellow}${c.bold} – SKIP${c.reset}`;
  console.log(`  ${tag}  ${label}  ${c.dim}(${reason})${c.reset}`);
}

function section(name: string) {
  console.log(`\n${c.cyan}${c.bold}▸ ${name}${c.reset}`);
}

// ── Env helper ────────────────────────────────────────────────────────────────
function env(key: string): string | undefined {
  return process.env[key];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function pingHttp(label: string, url: string, expectStatus = 200) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (r.status === expectStatus) {
      ok(label, `HTTP ${r.status}`);
    } else {
      fail(label, `Expected ${expectStatus}, got ${r.status}`);
    }
  } catch (e) {
    fail(label, e);
  }
}

async function checkApiHealth() {
  section("API Server  (port 8080)");
  await pingHttp("GET /api/healthz", "http://localhost:8080/api/healthz");
  await pingHttp("GET /api/products  (product list)", "http://localhost:8080/api/products");
}

async function checkStorefront() {
  section("Storefront  (port 18539)");
  await pingHttp("GET /  (Vite dev server)", "http://localhost:18539/");
}

async function checkDatabase() {
  section("Database  (Supabase Postgres)");
  const url = env("SUPABASE_DB_URL") ?? env("DATABASE_URL");
  if (!url) { skip("Postgres query", "SUPABASE_DB_URL not set"); return; }
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const { rows } = await pool.query<{ now: string }>("SELECT NOW() AS now");
    ok("SELECT NOW()", rows[0]?.now);
    // Quick schema sanity-check
    const { rows: tables } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );
    ok("Schema tables visible", tables.map(r => r.tablename).join(", ") || "(none)");
  } catch (e) {
    fail("Postgres query", e);
  } finally {
    await pool.end();
  }
}

async function checkS3() {
  section("Supabase S3 Storage");
  const keyId   = env("FILE_ACCESS_KEY_ID");
  const secret  = env("FILE_SECRET_ACCESS_KEY");
  const endpoint = env("FILE_ENDPOINT_URL");
  const region  = env("FILE_REGION");
  const bucket  = env("FILE_BUCKET") ?? "allmart";

  if (!keyId || !secret || !endpoint || !region) {
    skip("S3 HeadBucket", "FILE_* env vars not set");
    return;
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: keyId, secretAccessKey: secret },
    forcePathStyle: true,
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    ok(`HeadBucket "${bucket}"`, endpoint);
  } catch (e) {
    fail(`HeadBucket "${bucket}"`, e);
  }
}

async function checkSmtp() {
  section("SMTP");
  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT") ?? "587");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASSWORD");
  if (!host || !user || !pass) { skip("SMTP verify", "SMTP_* env vars not set"); return; }
  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  try {
    await transporter.verify();
    ok("SMTP connection + auth", `${host}:${port}`);
  } catch (e) {
    fail("SMTP connection", e);
  }
}

async function checkStripe() {
  section("Stripe");
  const key = env("STRIPE_SECRET_KEY");
  if (!key) { skip("GET /v1/balance", "STRIPE_SECRET_KEY not set"); return; }
  try {
    const r = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = await r.json() as { object: string };
      ok("GET /v1/balance", `object=${data.object}`);
    } else {
      const err = await r.json() as { error?: { message?: string } };
      fail("GET /v1/balance", err.error?.message ?? `HTTP ${r.status}`);
    }
  } catch (e) {
    fail("GET /v1/balance", e);
  }
}

async function checkTelegram() {
  section("Telegram Bot");
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) { skip("getMe", "TELEGRAM_BOT_TOKEN not set"); return; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json() as { ok: boolean; result?: { username?: string } };
    if (data.ok) ok("getMe", `@${data.result?.username}`);
    else fail("getMe", JSON.stringify(data));
  } catch (e) {
    fail("getMe", e);
  }
}

async function checkGroq() {
  section("Groq API");
  const key = env("GROQ_API_KEY");
  if (!key) { skip("GET /openai/v1/models", "GROQ_API_KEY not set"); return; }
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = await r.json() as { data?: { id: string }[] };
      const first = data.data?.[0]?.id ?? "n/a";
      ok("GET /openai/v1/models", `first model: ${first}`);
    } else {
      fail("GET /openai/v1/models", `HTTP ${r.status}`);
    }
  } catch (e) {
    fail("GET /openai/v1/models", e);
  }
}

async function checkNvidia() {
  section("NVIDIA NIM API");
  const key = env("NVIDIA_API_KEY");
  if (!key) { skip("GET /v1/models", "NVIDIA_API_KEY not set"); return; }
  try {
    const r = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = await r.json() as { data?: { id: string }[] };
      const first = data.data?.[0]?.id ?? "n/a";
      ok("GET /v1/models", `first model: ${first}`);
    } else {
      fail("GET /v1/models", `HTTP ${r.status}`);
    }
  } catch (e) {
    fail("GET /v1/models", e);
  }
}

async function checkGitHub() {
  section("GitHub API");
  const token = env("GITHUB_TOKEN");
  if (!token) { skip("GET /user", "GITHUB_TOKEN not set"); return; }
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "allmart-ping" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = await r.json() as { login?: string; plan?: { name?: string } };
      ok("GET /user", `@${data.login} (plan: ${data.plan?.name ?? "n/a"})`);
    } else {
      fail("GET /user", `HTTP ${r.status}`);
    }
  } catch (e) {
    fail("GET /user", e);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${c.bold}AllMart — service ping suite${c.reset}  ${c.dim}${new Date().toISOString()}${c.reset}`);

  await checkApiHealth();
  await checkStorefront();
  await checkDatabase();
  await checkS3();
  await checkSmtp();
  await checkStripe();
  await checkTelegram();
  await checkGroq();
  await checkNvidia();
  await checkGitHub();

  console.log(`\n${c.dim}Done.${c.reset}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
