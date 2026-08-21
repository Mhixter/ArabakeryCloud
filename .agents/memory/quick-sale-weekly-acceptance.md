---
name: Quick Sale Weekly Acceptance
description: Weekly Managing Director acceptance of manager-recorded amount-only Quick Sales
---

Quick Sale settlement is a revenue handover workflow, not a bread-unit workflow. The dedicated Managing Director page shows only Quick Sales recorded by managers, grouped by business day, with a weekly total and one acceptance state for the week.

**Why:** Quick Sales are amount-only and must not be mixed with product stock or supplier allocation settlement. Weekly acceptance needs an auditable, idempotent handover without duplicating the underlying sales.

**How to apply:** Keep manager Quick Sale creation in Sales. Filter the settlement view to manager-owned Quick Sale rows, preserve daily detail, and prevent a second acceptance for the same company, branch, and week.