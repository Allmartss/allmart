---
name: Stripe callback cookie behavior
description: Authentication cookie requirements for Stripe Checkout returns in local preview and production.
---

Stripe Checkout can return to a new browser tab, so the callback must not depend on sessionStorage from the originating tab. The signed auth cookie must also be `Secure` only when the incoming request is actually HTTPS; otherwise local HTTP previews omit it from callback requests.

**Why:** The callback previously reported an expired checkout before contacting Stripe, and local preview browsers refused to send the `Secure` session cookie, producing a misleading 401 verification failure after successful sandbox payments.

**How to apply:** Store fulfillment inputs in Stripe metadata, verify using the returned Stripe session ID, include credentials on the callback fetch, and derive the cookie’s `secure` flag from the request protocol.