---
name: Shared pharmacy commerce
description: Durable rules for the database-backed pharmacy catalog, orders, stock, and portal synchronization.
---

The pharmacy catalog and orders are shared database records. Patient checkout must validate against server inventory and authenticated ownership; Admin inventory/status changes must use the pharmacy API. Encounter-linked pharmacy records remain a clinical-view compatibility projection.

**Why:** Browser-local catalog/order data allowed Patient and Admin views, prices, stock, and fulfillment statuses to diverge.

**How to apply:** Keep localStorage as fallback only, use the authenticated pharmacy endpoints for catalog/orders, reserve stock atomically after confirmed payment, enforce patient ownership, and synchronize status changes to the linked encounter record.