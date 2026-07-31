---
name: Admin portal prototype
description: Durable decisions for SugboDoc's role-based administrator workspace and prototype data boundaries.
---

The SugboDoc administrator workspace is intentionally a localStorage-backed prototype. Patient accounts, medication inventory, medication orders, payments, schedules, claims, and audit events should stay on the shared localStorage model until a server-backed admin API is explicitly requested.

**Why:** The existing patient portal is also prototype-oriented and already persists cart, order, insurance, and account state locally. Keeping the admin and patient views on shared keys makes management changes immediately visible without introducing a migration or a new backend contract.

**How to apply:** Reuse the shared admin data layer for new admin features. Do not introduce real payer, payment, or clinical-system integrations implicitly. Treat SOAP notes, diagnoses, prescriptions, and lab results as read-only for administrators unless explicit clinical authorization is added.

SugboDoc accounts and appointments now use PostgreSQL-backed API records for cross-device patient/admin visibility, with localStorage retained only as a compatibility fallback for legacy prototype data.

**Why:** The user explicitly requested that patients registered on the published app be visible to administrators on another browser or device.

**How to apply:** New accounts register through the shared API. Legacy local accounts are migrated when the owner signs in again with the same credentials; the admin portal should prefer shared patients while retaining seeded demo data only when the shared database is empty.