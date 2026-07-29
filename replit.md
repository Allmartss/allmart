# AllMart

> AllMart — your one-click shop for everything. AI-powered e-commerce platform built for America. 🇺🇸🛍️

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24, TypeScript 5.9 |
| API | Express 5 — port 8080, base `/api` |
| Frontend | React + Vite + Tailwind CSS v4 + Wouter — port 18539 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Cookie-based sessions (bcryptjs) |
| File Storage | Local disk (`uploads/`) + optional S3-compatible mirror |
| Email | SMTP (primary) → Resend SDK (fallback) |
| Payments | Stripe |
| AI | Groq, NVIDIA NIM |
| Bot | Telegram webhook bot |
| Mobile | Expo (React Native) |

## Running on Replit

Four workflows are configured:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 |
| `artifacts/storefront: web` | `pnpm --filter @workspace/storefront run dev` | 18539 |
| `artifacts/mobile: expo` | `pnpm --filter @workspace/mobile run dev` | — |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | 8081 |

## Database schema

To apply schema changes:
```bash
pnpm --filter @workspace/db run push
```

## Admin account

| Field | Value |
|---|---|
| URL | `/admin` |
| Email | `supportallmart@gmail.com` |
| Password | `admin@allmart1234` |

## Environment variables

All secrets are managed via Replit Secrets. Required:
- `SUPABASE_DB_URL` — PostgreSQL connection string
- `SESSION_SECRET` — random 32+ char string (already set)

Optional (features disabled if absent):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` — email
- `RESEND_API_KEY` — email fallback
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — payments
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` — bot
- `GROQ_API_KEY`, `NVIDIA_API_KEY` — AI features
- `FILE_*` — S3-compatible file storage

### SMTP port note (HostVds / VPS)
HostVds blocks the default SMTP ports (587, 465). Set `SMTP_PORT=2525` — SendGrid supports it and HostVds leaves it open. The app automatically tries ports `[configuredPort, 2525, 465]` in order when `SMTP_PORT` is not explicitly set.

## VPS deployment

See `explanation.txt` in the project root for the full step-by-step guide covering:
- Server hardening (UFW, Fail2Ban, SSH keys)
- Nginx reverse proxy + SSL (Let's Encrypt + Cloudflare)
- systemd service setup
- GitHub Actions auto-deploy

## User preferences
