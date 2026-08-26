---
name: Managing Director sales visibility
description: Customer-facing sales APIs and reports hide sales whose cashier has the managing_director role, while stock ledgers retain them.
---

Managing Director-created sales are private operational entries: exclude them from customer-facing lists, details, summaries, dashboards, trends, and activity views, but keep them in inventory and reconciliation inputs whenever they are needed to preserve stock balances.

**Why:** Hiding a transaction from users must not make physical stock appear available again or cause later allocations and settlements to overstate inventory.

**How to apply:** Filter by the cashier user's role at user-facing query boundaries; do not apply the same filter to internal stock-flow calculations unless the calculation is explicitly a customer-revenue metric.