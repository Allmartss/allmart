# AllMart

> AllMart — your one-click shop for everything. Browse thousands of products, buy instantly, and get it delivered fast. Built for America. 🇺🇸🛍️

AI-powered e-commerce platform. pnpm monorepo, Node.js 24, TypeScript.

---

## Quick Start

```bash
pnpm install
pnpm --filter @workspace/db run push        # apply DB schema
pnpm --filter @workspace/api-server run dev # API on port 8080
pnpm --filter @workspace/storefront run dev # storefront on port 18539
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
| File Storage | Local disk + S3-compatible mirror (Supabase / R2 / AWS) |
| Email | SMTP (primary) → Resend SDK (fallback) |
| Payments | Stripe |
| AI | Groq, NVIDIA NIM, OpenAI |
| Bot | Telegram webhook bot |

---

## Project Layout

```
artifacts/
  api-server/src/routes/     — Express route handlers
  storefront/src/pages/      — React pages (home, products, cart, checkout, admin …)
  storefront/src/components/ — shared UI components

lib/
  db/src/schema/             — Drizzle schema (users, products, orders, cart …)
  api-spec/openapi.yaml      — OpenAPI contract (source of truth for hooks/Zod)
  api-client-react/src/generated/ — generated React Query hooks
  api-zod/src/generated/     — generated Zod schemas

scripts/src/                 — seed, backup, and restore scripts
```

---

## Useful Commands

```bash
pnpm run typecheck                               # full typecheck, all packages
pnpm run build                                   # typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen    # regenerate hooks/Zod from openapi.yaml
pnpm --filter @workspace/db run push             # push DB schema
pnpm --filter @workspace/scripts run seed-admin  # seed/reset admin user
pnpm --filter @workspace/scripts run seed-products # seed sample products
pnpm --filter @workspace/scripts run backup      # dump DB to JSON
npx tsx test.ts                                  # ping all services
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `SUPABASE_DB_URL` | Supabase Postgres URL (checked first) |
| `DATABASE_URL` | Postgres URL fallback |
| `SESSION_SECRET` | Cookie signing secret (32+ chars) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | SMTP email |
| `RESEND_API_KEY` | Email fallback (optional) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLIC_KEY` | Stripe publishable key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram notification target |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook auth |
| `GROQ_API_KEY` | Groq AI API key |
| `NVIDIA_API_KEY` | NVIDIA NIM API key |
| `GITHUB_TOKEN` | GitHub API token |
| `FILE_ACCESS_KEY_ID` | S3 access key ID |
| `FILE_SECRET_ACCESS_KEY` | S3 secret access key |
| `FILE_ENDPOINT_URL` | S3 endpoint (e.g. `https://<ref>.supabase.co/storage/v1/s3`) |
| `FILE_REGION` | S3 region (e.g. `us-east-1`) |
| `FILE_BUCKET` | S3 bucket name (default: `allmart`) |
| `APP_URL` | Public base URL for email links |

> **File uploads** always save to the local `uploads/` folder. When `FILE_*` vars are set, uploads are also mirrored to S3 under the `Allnart/` prefix — and the stored image URL points to the S3 CDN for durability.

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

## Auth Flow

- Signup → `/verify-email` — user enters 6-digit code sent by email.
- Unverified users can browse but **cannot place orders**.
- Forgot password → `/account` → "Forgot password?" → email reset code → `/reset-password`.
- Admin can manually verify any user from `/admin/users`.

---

## File Storage

Uploads always write to local disk (`uploads/`). When `FILE_*` S3 credentials are configured:

- The file is also uploaded to S3 under the `Allnart/` prefix.
- The S3 public URL is stored in the database as the canonical image URL.
- S3 upload is **awaited** before returning success — so a stored URL is always reachable.

---

## Deployment

See `local.txt` for step-by-step instructions:
- Local development
- Cloudflare Pages (storefront) + Railway (API)
- Vercel (full-stack)
- Self-hosted VPS with nginx
