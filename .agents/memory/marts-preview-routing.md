---
name: Marts preview routing
description: How the shared Replit development preview reaches the isolated Marts service.
---

The shared Replit preview domain fronts the AllMart storefront Vite server, not the
standalone Marts FastAPI port. Marts must therefore be proxied through the
storefront development server under `/marts`, including `/marts/api` and
`/marts/ws`, while the Marts service remains on its own private port.

**Why:** Opening Marts only on its standalone workflow port makes direct local
checks pass but causes the public preview URL `/marts/` to fall through to the
storefront's not-found route.

**How to apply:** Keep the Marts service on its configured private port and add a
Vite proxy for `/marts` with WebSocket support. Verify the shared preview URL,
an asset, and `/marts/api/health` together after restarting the storefront.