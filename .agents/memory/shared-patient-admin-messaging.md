---
name: Shared Patient/Admin messaging
description: Durable rules for the SugboDoc database-backed Patient/Admin message inbox.
---

Patient and Admin messaging uses one PostgreSQL conversation per patient. Patients can access only their own conversation; Admin and Clinician users can access patient conversations and reply. The UI refreshes conversations and messages periodically instead of using browser storage.

**Why:** The original inbox was static mock data and had no matching Admin workflow. Shared server state is required for messages to cross tabs, browsers, and portal roles.

**How to apply:** Keep message ownership enforced by the API, derive sender identity from the authenticated session, preserve unread/read state in the database, and treat polling as the current freshness path until realtime delivery is added.