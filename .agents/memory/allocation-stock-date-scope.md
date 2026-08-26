---
name: Allocation stock date scope
description: Product availability for a supplier allocation is calculated at the selected business-day end.
---

Allocation planning uses the selected business date as an inclusive cutoff: production, direct sales, supplier allocations, and approved returns through that business-day end determine the quantity available for that date.

**Why:** An all-time balance counts future production when planning historical allocations and can show a misleading quantity beside the selected product.

**How to apply:** Pass the date to the stock endpoint, use the same cutoff in allocation submission validation, preserve branch/product identity, and discard stale UI responses when the date changes.