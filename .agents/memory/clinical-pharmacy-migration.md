---
name: Clinical imaging and pharmacy migration
description: Durable rules for imaging records, SOAP permissions, and pharmacy-order compatibility.
---

Imaging records are intentionally dummy prototype data with a sample SVG X-ray, downloadable text reports, and read-only patient/admin views. Admin SOAP notes are read-only unless the current session explicitly carries the clinical editing permission.

**Why:** The portal has no real imaging repository or clinical authorization service, so sample data must remain clearly separated from production clinical records and admin edits must not be implied.

**How to apply:** Keep imaging/report actions local and visibly prototype-only. Use structured SOAP fields and metadata. Treat `sugbodoc_pharmacy_orders` as the current order key while mirroring `sugbodoc_medication_orders` for legacy carts/orders and accepting old Stripe session metadata during migration.

Completed appointments are the source of truth for encounter creation: use appointment ID for idempotency, keep legacy completed records visible through name-compatible migration, and attach pharmacy/billing relationships to the latest matching encounter.

**Why:** The prototype must preserve older mock records while ensuring new clinical, pharmacy, and billing data can be traced back to one completed consultation without introducing a backend migration.

**How to apply:** Create encounters only from Confirmed → Completed transitions, expose encounter selectors in clinical views, and keep patient data read-only unless the session is an authorized clinical user.

Demo clinical fixtures must use a unique database ID for every encounter/category record; never derive a shared or optional ID from nested order data.

**Why:** A non-unique pharmacy fixture ID caused later encounter orders to overwrite earlier rows, leaving apparently complete encounters without pharmacy data.

**How to apply:** Build deterministic IDs from encounter ID plus record category, and verify category coverage across every seeded encounter after each fixture run.

For Gmail SMTP, use `smtp.gmail.com` as the host; `smtp@gmail.com` is an email address-like value and causes DNS `ENOTFOUND` failures.

**Why:** Appointment confirmation emails failed at DNS resolution before authentication could run.

**How to apply:** Keep Gmail on port 587 with secure mode false and use a Gmail app password when account security requires it.