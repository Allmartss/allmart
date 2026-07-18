# AllMart

AI-powered e-commerce platform — React + Vite storefront, Express 5 API, PostgreSQL, Stripe, Telegram bot, and SMTP email. pnpm monorepo, Node.js 24, TypeScript.

## How to run

Two workflows are configured and run automatically:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 |
| `artifacts/storefront: web` | `pnpm --filter @workspace/storefront run dev` | 18539 |

The storefront proxies `/api/*` to the API server. The preview pane shows the storefront.

### Database

Schema is already applied. To re-push after schema changes:

```bash
pnpm --filter @workspace/db run push
```

### Rebuilding lib packages

If you see `Output file ... has not been built from source file` TypeScript errors, run:

```bash
pnpm run typecheck:libs
```

This builds the shared `lib/` packages (db, api-zod, api-client-react) and generates their `.d.ts` files.

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24, TypeScript 5.9 |
| API | Express 5 — port 8080, base `/api` |
| Frontend | React + Vite + Tailwind CSS v4 + Wouter |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Cookie-based sessions (bcryptjs) |
| File Storage | Local disk (`uploads/`) + optional S3 mirror |
| Email | SMTP primary → Resend SDK fallback |
| Payments | Stripe |
| AI | Groq, NVIDIA NIM |
| Bot | Telegram webhook bot |

## Admin account

The admin panel is at `/admin`. Default credentials are defined in the seed script — check `scripts/src/` or the original repository README for setup instructions. Change the password immediately after first login.

## Environment secrets configured

- `SUPABASE_DB_URL` — PostgreSQL connection
- `SESSION_SECRET` — cookie signing
- `GROQ_API_KEY`, `NVIDIA_API_KEY` — AI features
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` — email
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` — Telegram bot
- `FILE_ENDPOINT_URL`, `FILE_BUCKET`, `FILE_ACCESS_KEY_ID`, `FILE_SECRET_ACCESS_KEY`, `FILE_REGION` — S3 file storage
- `GITHUB_TOKEN` — GitHub integration

## User preferences

<!-- Add preferences here as you work with the user -->
