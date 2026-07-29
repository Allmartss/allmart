---
name: Email provider order and architecture
description: How AllMart sends email — provider priority, per-provider forcing, and where the logic lives
---

# Email provider order and architecture

## Rule
Brevo is the **primary** provider. SMTP is the **fallback**. Resend has been removed.

**Why:** User explicitly requested Brevo-first ordering for all transactional mail (OTP, order notifications, admin alerts).

## How to apply
- `sendEmail()` in `artifacts/api-server/src/routes/email.ts` tries Brevo first, then SMTP.
- `sendViaBrevo()` and `sendViaSmtp()` are exported for forcing a specific provider.
- `POST /api/admin/email/ping` accepts `{ provider: "brevo" | "smtp" | "auto" }` to target one provider directly.
- `sendEmail()` returns `"brevo" | "smtp"` so callers can log/report which provider was used.

## Front-end (admin health watch)
- When both providers are configured: two separate ping rows appear (one per provider).
- When only one is configured: one row for that provider.
- Success message shows the actual provider used (returned by the API).
- File: `artifacts/storefront/src/components/admin-health-watch.tsx`

## GitHub check
- `GITHUB_TOKEN` added to: `admin-health.ts` (checkGitHub), `test.ts` (optionalGroups), `check-env.sh`.
