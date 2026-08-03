---
name: Shared pharmacy commerce
description: Durable rules for the database-backed pharmacy catalog, orders, stock, and portal synchronization.
---

The pharmacy catalog, orders, bills, payments, stock, and fulfillment timestamps are shared database records. Patient checkout must validate against server inventory and authenticated ownership; Admin inventory/status changes must use the pharmacy API. Encounter-linked pharmacy records remain a clinical-view compatibility projection.

**Why:** Browser-local catalog/order data allowed Patient and Admin views, prices, stock, and fulfillment statuses to diverge.

**How to apply:** Keep browser storage for temporary cart/draft state only, use authenticated pharmacy endpoints for catalog/orders/financial history, reserve stock inside a locked payment-confirmation transaction, enforce patient ownership, make receipt confirmation a conditional one-time transition, and synchronize status changes to the linked encounter record.