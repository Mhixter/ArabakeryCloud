---
name: Allocation stock date scope
description: Allocation availability uses an exact selected Lagos business-date bucket.
---

Allocation planning uses the selected business date as an exact bucket: prior submitted/approved physical closing stock plus production, direct sales, supplier allocations, and approved restorable returns within that Lagos business day determine the quantity available for that date. Unused stock does not carry forward unless it is recorded by a physical closing.

**Why:** A cumulative cutoff makes adjacent business days indistinguishable, while a physical closing provides an auditable and product-specific boundary for stock that genuinely remains available.

**How to apply:** Pass an allocation scope plus date to the stock endpoint, add the latest prior submitted/approved closing by product, use the same exact range in allocation submission validation, preserve branch/product identity, and discard stale UI responses when the date changes.