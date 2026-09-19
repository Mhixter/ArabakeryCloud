---
name: Quick Sale Daily Acceptance
description: Daily Managing Director acceptance of manager-recorded amount-only Quick Sales
---

Quick Sale settlement accepts the manager-recorded cash amount for one business day after a submitted physical closing. It creates zero-revenue reconciliation rows only for product quantities not explained by recorded sales; counted closing stock carries into the next business day. Supplier allocations remain unchanged. Older weekly settlement records remain historical.

**Why:** Quick Sale amounts do not identify product quantities, while the physical count identifies what remains in-store. Using the count as the carryover source avoids guessing bread types from money and prevents accepted revenue from deleting stock that is still physically present.

**How to apply:** Keep manager Quick Sale creation in Sales. Filter the settlement view to manager-owned Quick Sale rows, require a submitted physical closing, calculate the residual per product as expected sales minus recorded product sales, and make acceptance idempotent per company, branch, and date. Preserve submitted/approved closing quantities as the next date's opening balance.