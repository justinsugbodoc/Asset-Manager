---
name: Shared clinical records
description: Rules for the SugboDoc database-backed encounter and clinical-record model.
---

The database is the source of truth for patient encounters and clinical records. Legacy localStorage records may be migrated only for the matching demo patient, never copied to arbitrary registered patients.

**Why:** Patient records must remain synchronized across Patient and Admin portals, and broad legacy migration could expose one patient's clinical data to another patient.

**How to apply:** Keep encounter IDs patient-scoped, enforce ownership on patient API requests, restrict clinical record edits to Admin/Clinician users, and use the patient-data endpoint only for patient-owned pharmacy and billing updates.