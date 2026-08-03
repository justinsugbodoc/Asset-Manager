---
name: Shared billing payments
description: Durable rule for Stripe bill payments and synchronized Patient/Admin billing views.
---

Stripe Checkout success is only a payment signal. The authenticated server confirmation endpoint must verify the session, mark owned database bills Paid, create uniquely linked payment records, and update encounter billing before the Patient or Admin UI treats the bill as settled. Pharmacy payments additionally link patient, order, bill, amount, payment date, Stripe reference, and fulfillment state.

**Why:** Frontend-only success handling left Stripe-paid bills Pending in the database and caused stale pending states after refresh or in the Admin portal.

**How to apply:** Pass bill IDs in checkout metadata, enforce patient ownership server-side, make confirmation idempotent with database uniqueness/locking, load pending/history from database status, and project encounter and pharmacy bills/payments into both portals.