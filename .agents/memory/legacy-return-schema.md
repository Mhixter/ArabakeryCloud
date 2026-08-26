---
name: Legacy return schema
description: Compatibility constraints for product return queries across older deployed databases
---

Reports that read product returns must not use `select *` or assume the newer `return_date` and `deleted_at` columns exist. Use the stable return fields needed by the calculation and filter by `created_at` when a legacy deployment is possible.

**Why:** The app can run against an older external or previously published database whose schema is behind the current Drizzle definitions. A single missing return column can make unrelated stock and allocation screens appear empty because they depend on the product dashboard.

**How to apply:** When adding a report or stock calculation that reads returns, explicitly project only compatible fields and keep the request resilient to legacy schema differences. Publish schema changes separately through the supported publish flow rather than adding runtime assumptions.