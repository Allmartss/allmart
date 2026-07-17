# AllMart — Project Reference

AI-powered Nigerian e-commerce platform. pnpm monorepo, Node.js 24, TypeScript.

---

## Quick Start (inside Replit)

```
pnpm install
pnpm --filter @workspace/db run push      # apply DB schema
pnpm --filter @workspace/api-server run dev   # API on port 8080
pnpm --filter @workspace/storefront run dev   # storefront on port 18539
```

---

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24, TypeScript 5.9 |
| API | Express 5 — port 8080, base `/api` |
| Frontend | React + Vite + Tailwind CSS v4 + Wouter |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| API contract | OpenAPI → Orval codegen |
| Auth | Cookie-based sessions (bcryptjs), no JWT |
| Object Storage | Replit Object Storage (GCS sidecar) — swap to R2/S3 outside Replit |
| Email | SMTP (primary) → Resend SDK (fallback) |
| Payments | Stripe |
| AI | OpenAI via Replit AI Integrations |
| Bot | Telegram webhook bot |

---

## Where Things Live

```
artifacts/
  api-server/src/routes/   — Express route handlers
  storefront/src/pages/    — React pages (home, products, cart, checkout, admin, …)
  storefront/src/components/ — shared components (users-manager, cart, nav, …)

lib/
  db/src/schema/           — Drizzle schema (users, products, orders, cart, …)
  api-spec/openapi.yaml    — OpenAPI contract (source of truth for all hooks/Zod)
  api-client-react/src/generated/ — generated React Query hooks
  api-zod/src/generated/   — generated Zod schemas

scripts/src/               — seed, backup, and restore scripts
```

---

## Useful Commands

```bash
pnpm run typecheck                              # full typecheck, all packages
pnpm run build                                 # typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen  # regenerate hooks/Zod from openapi.yaml
pnpm --filter @workspace/db run push           # push DB schema (dev/staging only)
pnpm --filter @workspace/scripts run seed-admin    # seed/reset admin user
pnpm --filter @workspace/scripts run seed-products # seed sample products
pnpm --filter @workspace/scripts run backup        # dump DB to JSON
```

---

## Required Secrets

Set these in **Replit → Secrets** (or in `.env` outside Replit):

| Secret | Purpose |
|---|---|
| `SUPABASE_DB_URL` | Supabase Postgres connection string (checked first) |
| `DATABASE_URL` | Postgres connection string (fallback if `SUPABASE_DB_URL` is not set) |
| `SESSION_SECRET` | Cookie signing secret (32+ random chars) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | SMTP email (Gmail, Zoho, etc.) |
| `RESEND_API_KEY` | Resend email fallback (optional if SMTP is set) |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_PUBLIC_KEY` | Stripe frontend key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot |
| `TELEGRAM_CHAT_ID` | Telegram notification target |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook auth |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Replit Object Storage bucket (Replit only) |
| `PRIVATE_OBJECT_DIR` | Storage prefix for private uploads (e.g. `uploads`) |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Storage prefix for public serving (e.g. `uploads`) |
| `APP_URL` | Public base URL for email links (e.g. `https://allmart.replit.app`) |
| `FILE_ACCESS_KEY_ID` | S3-compatible access key ID (Supabase / R2 / AWS) |
| `FILE_SECRET_ACCESS_KEY` | S3-compatible secret access key |
| `FILE_ENDPOINT_URL` | S3 endpoint URL (e.g. `https://<ref>.supabase.co/storage/v1/s3`) |
| `FILE_REGION` | S3 region (e.g. `ap-southeast-1`) |
| `FILE_BUCKET` | S3 bucket name (default: `allmart`) |

> **File uploads always save to the local `uploads/` folder.** When the `FILE_*` vars are set, uploads are also mirrored to S3 (Supabase/R2/AWS) under the `Allmart/` prefix. This dual-write happens in the background and does not block the upload response.

---

## Admin Account

| Field | Value |
|---|---|
| URL | `/admin` |
| Email | `admin@allmart.com` |
| Password | `admin@allmart1234` |

---

## User Roles

| Role | Access |
|---|---|
| `buyer` | Regular customers |
| `admin` | Full access (users, orders, catalog, bank, notifications, support, Telegram) |
| `pm` | Product manager (orders + catalog only) |

---

## Object Storage — Replit vs Outside

**Inside Replit** the app uses a Google Cloud Storage sidecar (`http://127.0.0.1:1106`). This is fully managed — just create a bucket in the Replit Object Storage tool and set the three env vars above.

**Outside Replit** the sidecar is not available. Swap the client in `artifacts/api-server/src/lib/objectStorage.ts` to target any S3-compatible service. Recommended:

- **Cloudflare R2** — zero egress fees, S3-compatible. See `local.txt` § Storage for the exact env var swap.
- **AWS S3** — standard option if already on AWS.
- **Backblaze B2** — cheap cold storage, S3-compatible.

The presigned-URL flow (`POST /storage/uploads/request-url`) and the public/private serving routes (`GET /storage/public-objects/*`, `GET /storage/objects/*`) stay the same — only the underlying client changes.

---

## Email Flow

1. Requests go through `artifacts/api-server/src/routes/email.ts`.
2. SMTP is tried first (nodemailer). If it fails, Resend is used as fallback.
3. Set `SMTP_*` vars for Gmail: host `smtp.gmail.com`, port `587`, user = Gmail address, password = [App Password](https://myaccount.google.com/apppasswords).

---

## Auth & Verification Flow

- Signup → redirect to `/verify-email` — user enters 6-digit code sent by email.
- Unverified users can browse but **cannot place orders** (blocked at API + frontend).
- Forgot password → `/account` → "Forgot password?" → email reset code → `/reset-password`.
- Admin can manually verify any user from `/admin/users` → ✉️ check icon.

---

## Architecture Decisions

- Cookie-based sessions (no JWT) — sessions stored server-side.
- NGN currency throughout.
- All API routes prefixed at `/api`.
- Vite dev proxy: `/api` → `http://localhost:8080`.
- Pay on Delivery locked to Tier ≥ 3 users.
- Rate limits on verification + reset endpoints (in-memory, single-process).

---

## Replit-Specific Files (not needed outside Replit)

| File | Purpose |
|---|---|
| `.replit` | Replit IDE config: workflows, port mappings, deployment target. Ignored outside Replit. |
| `.replitignore` | Like `.dockerignore` — excludes files from Replit's deployment image. Ignored outside Replit. |
| `replit.nix` | NixOS package list for the Replit shell (e.g. `pkgs.nginx`). Ignored outside Replit. |

---

## Deployment

See `local.txt` for step-by-step instructions for:
- Local development
- Cloudflare Pages (storefront) + Railway (API)
- Vercel (full-stack)
- Self-hosted VPS with nginx

---

## User Preferences

_Add explicit user instructions to remember across sessions here._
