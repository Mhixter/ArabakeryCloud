---
name: Business date rule
description: The bakery's operational calendar and timezone boundary convention
---

All operational daily totals use calendar dates in `America/Los_Angeles`, not the server or browser's local timezone. Date-only API filters are interpreted as that timezone's full day, and UI grouping uses the same timezone.

**Why:** Records created near midnight previously landed on different dates depending on which page or runtime calculated the boundary.

**How to apply:** Reuse the shared business-date helpers for new daily reports, exports, dashboard cards, and reconciliation screens. Keep date-only values date-only when calling the API.