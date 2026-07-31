---
name: Admin portal prototype
description: Durable decisions for SugboDoc's role-based administrator workspace and prototype data boundaries.
---

The SugboDoc administrator workspace is intentionally a localStorage-backed prototype. Patient accounts, medication inventory, medication orders, payments, schedules, claims, and audit events should stay on the shared localStorage model until a server-backed admin API is explicitly requested.

**Why:** The existing patient portal is also prototype-oriented and already persists cart, order, insurance, and account state locally. Keeping the admin and patient views on shared keys makes management changes immediately visible without introducing a migration or a new backend contract.

**How to apply:** Reuse the shared admin data layer for new admin features. Do not introduce real payer, payment, or clinical-system integrations implicitly. Treat SOAP notes, diagnoses, prescriptions, and lab results as read-only for administrators unless explicit clinical authorization is added.