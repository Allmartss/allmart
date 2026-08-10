---
name: Checkout total authority
description: Durable rule for keeping bonus-credit checkout totals consistent across preview, payment, and order records.
---

The server must calculate the checkout quote from the current cart and user balance, and that result must be the source for the UI preview, provider charge, order total, bonus deduction, and receipt breakdown.

**Why:** Client-side totals can diverge from the cart and balance at payment time, causing users to see one amount while Stripe charges another or allowing concurrent attempts to overspend bonus credit.

**How to apply:** Keep provider initialization and final order creation server-authoritative; compare the paid amount and expected discounts before creating the order, and make the balance decrement conditional inside the order transaction.