---
name: Render forwarded origins
description: Same-origin browser requests can appear behind Render with an internal Express host.
---

When an app is served through Render's proxy, compare browser origins against `X-Forwarded-Host` or the platform's external URL rather than relying only on Express `req.get("host")`.

**Why:** The production browser origin and API URL were identical, but Render's internal host comparison failed and sent the request through the CORS rejection path.

**How to apply:** For same-service SPA/API deployments, preserve the explicit cross-origin allowlist while recognizing the forwarded external host and `RENDER_EXTERNAL_URL`.