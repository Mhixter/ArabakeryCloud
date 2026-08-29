---
name: Allocation stock date scope
description: Allocation availability uses an exact selected Lagos business-date bucket.
---

Allocation planning uses the selected business date as an exact bucket: production, direct sales, supplier allocations, and approved restorable returns within that Lagos business day determine the quantity available for that date. Unused stock does not automatically carry into another allocation date.

**Why:** A cumulative cutoff makes August 25 and August 26 indistinguishable when staff need to allocate against a specific production date.

**How to apply:** Pass an allocation scope plus date to the stock endpoint, use the same exact range in allocation submission validation, preserve branch/product identity, and discard stale UI responses when the date changes.