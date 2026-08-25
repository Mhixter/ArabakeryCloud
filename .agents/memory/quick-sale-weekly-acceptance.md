---
name: Quick Sale Daily Acceptance
description: Daily Managing Director acceptance of manager-recorded amount-only Quick Sales
---

Quick Sale settlement accepts the manager-recorded cash amount for one business day and clears the selected branch's in-store stock snapshot at the end of that day through zero-revenue product stock-clearing sales. Supplier allocations remain unchanged. Older weekly settlement records remain historical.

**Why:** The business treats acceptance as the handover of both the collected Quick Sale amount and the remaining branch stock, but Quick Sale amounts do not identify product quantities. A daily boundary prevents accepting a past day from clearing later production or sales. Zero-revenue stock-clearing records reduce physical balances without counting the accepted cash twice.

**How to apply:** Keep manager Quick Sale creation in Sales. Filter the settlement view to manager-owned Quick Sale rows, accept one business date at a time, calculate stock using records through that date's business-day end, and make acceptance idempotent per company, branch, and date. Record stock-cleared metadata so retries cannot clear stock twice.