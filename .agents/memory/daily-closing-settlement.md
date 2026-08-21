---
name: Daily Closing Settlement
description: The operational distinction between physical closing stock settlement and supplier allocation settlement
---

In-store settlement is a Managing Director-only dashboard workflow organized by business date and product. The Managing Director settles the entire remaining quantity as a separate manager stock sale; supplier allocation rows must remain unchanged. Each product/date keeps an uncleared or cleared history state.

**Why:** Allocated stock and remaining in-store stock are different responsibilities and must not be cleared together or settlement of one can distort supplier inventory history. The manager needs a simple date-based handover record rather than a separate physical-count approval page.

**How to apply:** Keep allocation settlement in the Allocations flow. The dashboard settlement should only create separate stock-sale records for the full remaining product quantity, with amount, payment method, notes, and audit activity, and should be idempotent per product/date.