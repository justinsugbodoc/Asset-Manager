---
name: Admin portal prototype
description: Durable decisions for SugboDoc's role-based administrator workspace and prototype data boundaries.
---

The SugboDoc administrator workspace uses PostgreSQL-backed APIs for patient accounts, medication inventory, medication orders, payments, schedules, claims, and audit events. Browser storage is limited to temporary UI state and legacy compatibility.

**Why:** Patient and Admin must see the same authoritative records across browsers, tabs, and devices; browser-local state caused divergent records and could silently discard Admin changes.

**How to apply:** Use authenticated database endpoints for new Admin features. Do not introduce real payer, payment, or clinical-system integrations implicitly. Treat SOAP notes, diagnoses, prescriptions, and lab results as read-only for administrators unless explicit clinical authorization is added.

SugboDoc accounts, appointments, and Admin operations use PostgreSQL-backed API records for cross-device patient/admin visibility. Legacy local account fallback has been removed from the sign-in and registration flows.

**Why:** The user explicitly requested that patients registered on the published app be visible to administrators on another browser or device.

**How to apply:** New accounts register through the shared API. Keep clinical records read-only by default and preserve only explicitly scoped demo-data migrations.

The Admin patient record workspace presents all selected-encounter sections in one continuous scrollable page; the encounter selector remains the only record-level navigation control, and payments show explicit descriptions and payment dates.

**Why:** Users found switching between separate clinical, billing, payment, and pharmacy tabs tiring and needed payment context to be immediately understandable.

**How to apply:** Keep vitals, SOAP notes, diagnoses, prescriptions, labs, imaging, billing, payments, and pharmacy orders together for the selected completed encounter. Preserve read-only clinical access and encounter scoping.