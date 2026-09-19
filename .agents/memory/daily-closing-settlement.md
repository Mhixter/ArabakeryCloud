---
name: Daily Closing Settlement
description: The operational distinction between physical closing stock settlement and supplier allocation settlement
---

Daily closing is the physical source of truth for end-of-day in-store stock. A submitted/approved closing keeps its counted product quantities as the next business day's opening balance. Quick Sale acceptance may add zero-revenue reconciliation rows for only the unexplained product quantities; supplier allocation rows remain unchanged.

**Why:** Allocated stock and remaining in-store stock are different responsibilities, and amount-only Quick Sales cannot identify product types. Carrying the physical count forward preserves inventory while still reconciling bulk sales without assigning money to a guessed product.

**How to apply:** Require all closing lines to be physically counted before Quick Sale acceptance. Use the latest submitted/approved prior closing for allocation opening stock, calculate residual quantities per product, and keep reconciliation rows at zero revenue with audit metadata.