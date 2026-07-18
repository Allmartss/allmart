# AllMart

AI-powered e-commerce platform. React + Vite storefront, Express 5 API, PostgreSQL (Supabase), Stripe payments, AI search (Groq/NVIDIA), Telegram bot, SMTP email.

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 20+, TypeScript |
| API | Express 5 — port 8080, base `/api` |
| Frontend | React + Vite + Tailwind CSS v4 + Wouter — port 18539 |
| Database | PostgreSQL (Supabase) + Drizzle ORM |
| Auth | Cookie-based sessions (bcryptjs) |
| Payments | Stripe |
| AI | Groq, NVIDIA NIM |
| Bot | Telegram webhook bot |

## How to Run (Replit)

Workflows are already configured and will start automatically:
- **API Server** — `pnpm --filter @workspace/api-server run dev` (port 8080)
- **Storefront** — `pnpm --filter @workspace/storefront run dev` (port 18539)

To apply schema changes or re-seed after pulling new code:
```bash
pnpm --filter @workspace/db run push   # apply DB schema
pnpm --filter @workspace/db run seed   # seed admin user + default settings
```

Or run `./deploy.sh` which does install + build + push + seed in one shot (for production builds), then `./start.sh` to serve.

## Required Secrets (already configured in Replit)

| Secret | Purpose |
|---|---|
| `SUPABASE_DB_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Cookie signing key (32+ chars) |

## Optional Secrets (configured)

File storage (S3/Supabase Storage), SMTP email, Groq AI, NVIDIA AI, Telegram bot — all set as Replit secrets.

## Admin Account

- URL: `/admin`
- Email: `supportallmart@gmail.com`
- Password: `admin@allmart1234`

## Project Layout

```
artifacts/
  api-server/   — Express 5 API (port 8080)
  storefront/   — React + Vite frontend (port 18539)
  mobile/       — Expo mobile app
  mockup-sandbox/ — Component preview server

lib/
  db/           — Drizzle ORM schema + migrations
  api-client-react/ — Generated API client (React)
  api-zod/      — Generated Zod types
```

## User Preferences
