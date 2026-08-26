---
name: Branch product identity
description: Product-name resolution for production and allocations must stay aligned with the selected branch.
---

When a company has products with the same name in multiple branches, resolve the branch-specific product first and use a company-wide product only as a fallback. Production and allocation records must use the same branch/product identity.

**Why:** Resolving by company-wide name alone can attach production to the wrong product ID, making the allocation screen report zero available stock even though production was recorded.

**How to apply:** Scope product queries by company and selected branch, prefer an exact branch match, then allow a branchless company-wide product; reject unrelated branch-specific products.