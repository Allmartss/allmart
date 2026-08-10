---
name: Marts isolation
description: Marts must use its own environment namespace and explicit /marts routing.
---

Marts is intentionally deployed beside AllMart, not inside its application
boundary. Its optional credentials, notification settings, broker settings,
public URLs, and service configuration must use `MARTS_*` variables. The only
shared environment fallback is the explicitly documented `DATABASE_URL`.

**Why:** The extraction plan requires independent secrets, processes, routing,
and database behavior so Marts cannot accidentally consume or modify AllMart
configuration.

**How to apply:** When adding extracted Marts code, load only `marts/.env`,
keep frontend/API/WebSocket URLs under `/marts`, and add new settings to
`marts/.env.example` with the `MARTS_` prefix.