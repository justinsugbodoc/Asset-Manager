---
name: Doctor portal access
description: Doctor workspace authorization and shared clinical-record behavior.
---

Doctors are a distinct role from Admin and Clinician. Their workspace is limited to patients with an appointment assigned to their provider profile. They may update shared encounters and create follow-up appointments, while billing, insurance, payments, pharmacy, and operational records remain read-only.

**Why:** Clinical edits must synchronize across Patient and Admin views without granting Doctors administrative or financial-management access.

**How to apply:** Keep Doctor endpoints and routes provider-assignment scoped, log record access and clinical changes, and preserve database encounters as the shared source of truth. Starting an appointment creates or reuses its linked encounter; saving records keeps that appointment link and synchronizes appointment metadata without regressing terminal statuses.