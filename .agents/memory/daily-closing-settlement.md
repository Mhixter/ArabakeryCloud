---
name: Daily Closing Settlement
description: The operational distinction between physical closing stock settlement and supplier allocation settlement
---

Daily Closing is a physical-count workflow, not an allocation-clearing workflow. The Managing Director settles the counted remaining in-store units as a separate manager stock sale after the manager submits the count; supplier allocation rows must remain unchanged.

**Why:** Allocated stock and remaining in-store stock are different responsibilities and must not be cleared together or settlement of one can distort supplier inventory history.

**How to apply:** Keep allocation settlement in the Allocations flow. Daily Closing settlement should only create the separate stock-sale records for counted closing units, with payment details and audit activity, and should be idempotent per closing.