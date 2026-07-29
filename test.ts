/**
 * AllMart service ping suite
 * Run with: npx tsx test.ts
 */

import { loadEnv } from "./lib/db/src/load-env.js";
loadEnv(); // load .env before anything reads process.env

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
  await pingHttp(
    "GET /api/products  (product list)",
    "http://localhost:8080/api/products",
  );
}

async function checkStorefront() {
  section("Storefront  (port 18539)");
  await pingHttp("GET /  (Vite dev server)", "http://localhost:18539/");
}

async function checkDatabase() {
  section("Database  (Supabase Postgres)");
  const url = env("SUPABASE_DB_URL") ?? env("DATABASE_URL");
  if (!url) {
    skip("Postgres query", "SUPABASE_DB_URL not set");
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const { rows } = await pool.query<{ now: string }>("SELECT NOW() AS now");
    ok("SELECT NOW()", rows[0]?.now);
    // Quick schema sanity-check
    const { rows: tables } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
    );
    ok(
      "Schema tables visible",
      tables.map((r) => r.tablename).join(", ") || "(none)",
    );
  } catch (e) {
    fail("Postgres query", e);
  } finally {
    await pool.end();
  }
}

async function checkS3() {
  section("Supabase S3 Storage");
  const keyId = env("FILE_ACCESS_KEY_ID");
  const secret = env("FILE_SECRET_ACCESS_KEY");
  const endpoint = env("FILE_ENDPOINT_URL");
  const region = env("FILE_REGION");
  const bucket = env("FILE_BUCKET");

  if (!keyId || !secret || !endpoint || !region || !bucket) {
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
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASSWORD");
  if (!host || !user || !pass) {
    skip("SMTP verify", "SMTP_HOST / SMTP_USER / SMTP_PASSWORD not set");
    return;
  }

  const configuredPort = Number(env("SMTP_PORT") ?? "587");
  // Many VPS providers (e.g. HostVds) block 587 and 465. Include 2525 which
  // SendGrid/Mailgun keep open and most VPS firewalls leave unblocked.
  // If SMTP_PORT is explicitly set, respect it and don't add extras.
  const pinnedByUser = !!env("SMTP_PORT");
  const portsToTry: number[] = pinnedByUser
    ? [configuredPort]
    : [...new Set([configuredPort, 2525, 465])];

  let lastErr: unknown;
  for (const port of portsToTry) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 8_000,
      greetingTimeout: 5_000,
    });
    try {
      await transporter.verify();
      ok("SMTP connection + auth", `${host}:${port}`);
      if (port !== configuredPort) {
        console.log(`         ${c.yellow}⚠  Port ${configuredPort} was unreachable — port ${port} works.`);
        console.log(`            Set  SMTP_PORT=${port}  in your .env and restart the server.${c.reset}`);
      }
      return;
    } catch (e) {
      lastErr = e;
      if (port !== portsToTry[portsToTry.length - 1]!) {
        console.log(`         ${c.dim}port ${port} unreachable — trying next port…${c.reset}`);
      }
    }
  }

  fail(`SMTP  (tried ports: ${portsToTry.join(", ")})`, lastErr);
  console.log(`\n         ${c.yellow}Troubleshooting hints:`);
  console.log(`           • VPS (HostVds etc.): set SMTP_PORT=2525 — widely unblocked.`);
  console.log(`           • Gmail: use an App Password, not your login password.`);
  console.log(`             Create one at  https://myaccount.google.com/apppasswords`);
  console.log(`           • Alternative: use Brevo API (BREVO_API_KEY).${c.reset}\n`);
}

async function checkStripe() {
  section("Stripe");
  const key = env("STRIPE_SECRET_KEY");
  if (!key) {
    skip("GET /v1/balance", "STRIPE_SECRET_KEY not set");
    return;
  }
  try {
    const r = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = (await r.json()) as { object: string };
      ok("GET /v1/balance", `object=${data.object}`);
    } else {
      const err = (await r.json()) as { error?: { message?: string } };
      fail("GET /v1/balance", err.error?.message ?? `HTTP ${r.status}`);
    }
  } catch (e) {
    fail("GET /v1/balance", e);
  }
}

async function checkTelegram() {
  section("Telegram Bot");
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) {
    skip("getMe", "TELEGRAM_BOT_TOKEN not set");
    return;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = (await r.json()) as {
      ok: boolean;
      result?: { username?: string };
    };
    if (data.ok) ok("getMe", `@${data.result?.username}`);
    else fail("getMe", JSON.stringify(data));
  } catch (e) {
    fail("getMe", e);
  }
}

async function checkGroq() {
  section("Groq API");
  const key = env("GROQ_API_KEY");
  if (!key) {
    skip("GET /openai/v1/models", "GROQ_API_KEY not set");
    return;
  }
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = (await r.json()) as { data?: { id: string }[] };
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
  if (!key) {
    skip("GET /v1/models", "NVIDIA_API_KEY not set");
    return;
  }
  try {
    const r = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = (await r.json()) as { data?: { id: string }[] };
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
  if (!token) {
    skip("GET /user", "GITHUB_TOKEN not set");
    return;
  }
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "allmart-ping",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = (await r.json()) as {
        login?: string;
        plan?: { name?: string };
      };
      ok("GET /user", `@${data.login} (plan: ${data.plan?.name ?? "n/a"})`);
    } else {
      fail("GET /user", `HTTP ${r.status}`);
    }
  } catch (e) {
    fail("GET /user", e);
  }
}

async function checkBrevo() {
  section("Brevo (Sendinblue) API");
  const key = env("BREVO_API_KEY");
  if (!key) {
    skip("GET account", "BREVO_API_KEY not set");
    return;
  }
  try {
    const r = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const data = (await r.json()) as { email?: string; plan?: { type?: string }[] };
      const plan = data.plan?.[0]?.type ?? "unknown";
      ok("GET /v3/account", `${data.email ?? ""} · plan: ${plan}`);
    } else {
      const body = (await r.json()) as { message?: string };
      fail("GET /v3/account", body.message ?? `HTTP ${r.status}`);
    }
  } catch (e) {
    fail("GET /v3/account", e);
  }
}

// ── Environment variable checks (mirrors check-env.sh) ───────────────────────

function checkEnvVars() {
  section("Environment variables  (check-env.sh parity)");

  // ── Required ──────────────────────────────────────────────────────────────
  const dbUrl = env("SUPABASE_DB_URL") ?? env("DATABASE_URL");
  if (!dbUrl) {
    fail("DATABASE_URL / SUPABASE_DB_URL", "missing — database will not connect");
  } else {
    const masked = dbUrl.slice(0, 20) + "***";
    if (/^postgres(ql)?:\/\//.test(dbUrl)) {
      ok("DATABASE_URL / SUPABASE_DB_URL", masked);
    } else {
      fail("DATABASE_URL / SUPABASE_DB_URL", `unexpected format (got: ${masked}) — expected postgres://...`);
    }
  }

  const sessionSecret = env("SESSION_SECRET");
  if (!sessionSecret) {
    fail("SESSION_SECRET", "missing — sessions will not work");
  } else if (sessionSecret.length < 32) {
    fail("SESSION_SECRET", `only ${sessionSecret.length} chars — minimum 32 required for security`);
  } else {
    ok("SESSION_SECRET", `${sessionSecret.length} chars ✓`);
  }

  // ── Optional groups ───────────────────────────────────────────────────────
  const optionalGroups: Array<{ label: string; vars: string[]; hint?: string }> = [
    {
      label: "File storage (S3)",
      vars: ["FILE_ENDPOINT_URL", "FILE_BUCKET", "FILE_ACCESS_KEY_ID", "FILE_SECRET_ACCESS_KEY", "FILE_REGION"],
      hint: "images stored locally only",
    },
    {
      label: "Stripe payments",
      vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      hint: "checkout disabled",
    },
    {
      label: "Telegram bot",
      vars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET"],
      hint: "notifications disabled",
    },
    {
      label: "SMTP email",
      vars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"],
      hint: "email disabled",
    },
    {
      label: "Brevo email",
      vars: ["BREVO_API_KEY"],
      hint: "Brevo disabled",
    },
    {
      label: "GitHub API",
      vars: ["GITHUB_TOKEN"],
      hint: "GitHub integration disabled",
    },
    {
      label: "AI features",
      vars: ["GROQ_API_KEY", "NVIDIA_API_KEY"],
      hint: "AI assistant disabled",
    },
    {
      label: "Server config",
      vars: ["APP_URL", "PORT_API", "NODE_ENV"],
    },
  ];

  for (const group of optionalGroups) {
    const set = group.vars.filter((v) => !!env(v));
    const missing = group.vars.filter((v) => !env(v));
    if (set.length === 0) {
      const tag = `${c.yellow}${c.bold} – SKIP${c.reset}`;
      console.log(`  ${tag}  ${group.label}  ${c.dim}(none set${group.hint ? ` — ${group.hint}` : ""})${c.reset}`);
    } else if (missing.length > 0) {
      ok(`${group.label}`, `partial — missing: ${missing.join(", ")}`);
    } else {
      ok(`${group.label}`, `all ${group.vars.length} vars set`);
    }
  }

  // ── Stripe key mode ───────────────────────────────────────────────────────
  const stripeKey = env("STRIPE_SECRET_KEY");
  if (stripeKey) {
    if (stripeKey.startsWith("sk_live_")) {
      console.log(`         ${c.yellow}⚠  STRIPE_SECRET_KEY is a LIVE key — real charges will occur.${c.reset}`);
    } else if (stripeKey.startsWith("sk_test_")) {
      console.log(`         ${c.dim}ℹ  STRIPE_SECRET_KEY is a TEST key — safe for development.${c.reset}`);
    } else {
      console.log(`         ${c.yellow}⚠  STRIPE_SECRET_KEY has an unexpected prefix.${c.reset}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n${c.bold}AllMart — service ping suite${c.reset}  ${c.dim}${new Date().toISOString()}${c.reset}`,
  );

  // Environment variable audit first — surfaces missing config before network checks
  checkEnvVars();

  await checkApiHealth();
  await checkStorefront();
  await checkDatabase();
  await checkS3();
  await checkSmtp();
  await checkBrevo();
  await checkStripe();
  await checkTelegram();
  await checkGroq();
  await checkNvidia();
  await checkGitHub();

  console.log(`\n${c.dim}Done.${c.reset}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
