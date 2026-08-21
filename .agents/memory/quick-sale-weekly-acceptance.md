---
name: Quick Sale Weekly Acceptance
description: Weekly Managing Director acceptance of manager-recorded amount-only Quick Sales
---

Quick Sale settlement accepts the manager-recorded weekly cash amount and clears all remaining in-store stock for the selected branch/week through zero-revenue product stock-clearing sales. Supplier allocations remain unchanged. The dedicated Managing Director page shows Quick Sales grouped by business day and supports a one-time repair for older accepted weeks that have not yet cleared stock.

**Why:** The business treats acceptance as the handover of both the collected Quick Sale amount and the remaining branch stock, but Quick Sale amounts do not identify product quantities. Zero-revenue stock-clearing records reduce physical balances without counting the accepted cash twice.

**How to apply:** Keep manager Quick Sale creation in Sales. Filter the settlement view to manager-owned Quick Sale rows, preserve daily detail, and make acceptance idempotent per company, branch, and week. Record stock-cleared metadata so later retries cannot clear newly produced stock.