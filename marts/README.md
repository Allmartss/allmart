# Marts

Marts is an isolated financial intelligence and paper-trading mini-application
extracted from FinAi for hosting at `/marts` inside the AllMart deployment.

## What is included

- FastAPI backend in `src/`
- React/Vite frontend in `frontend/`
- SQLAlchemy models and Alembic configuration
- Authentication, market data, AI analysis, positions, trade history, and bot modules

The unrelated mobile app, WhatsApp service, monitoring stack, backups, and Git
history were intentionally not copied.

## Database isolation

The backend reads:

1. `MARTS_DATABASE_URL` when configured
2. `DATABASE_URL` only as a fallback

Marts-specific session signing uses `MARTS_JWT_SECRET`. No AllMart session
secret or Supabase client configuration is loaded by this extracted service.

Copy `.env.example` to `.env` inside this folder before starting the backend.
Do not commit `.env`.

## Local development

From the Marts folder:

```bash
python3 -m uvicorn src.api.main:app --host 0.0.0.0 --port 8090
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The production frontend is built with `/marts/` as its base path and calls the
backend through `/marts/api/...`.