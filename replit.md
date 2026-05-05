# Workspace

## Overview

pnpm workspace monorepo using TypeScript. **New Model Bread** is a full-stack Bakery Management System.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui
- **Charts**: Recharts
- **Auth**: JWT (PBKDF2 password hashing via Node crypto)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Application: New Model Bread

### Artifacts
- **API Server** (`artifacts/api-server`): Express REST API on port 8080 (`/api/*`)
- **Bakery Frontend** (`artifacts/bakery`): React+Vite SPA on port 23375, proxies `/api` to port 8080

### Multi-Tenant SaaS Architecture
- Each company is fully isolated (all tables have `companyId` FK)
- JWT carries `{ userId, role, branchId, companyId }` — `companyId` drives all queries
- Registration creates: company + trial subscription + main branch + admin user
- Subscription statuses: `trial` (7 days) | `active` | `expired` | `cancelled`
- Price: ₦3,000/month (plan: "starter")
- Theme colors: `amber` (default) | `orange` | `blue` | `green` | `slate` — stored on companies.themeColor, applied via CSS `[data-theme]` attribute

### ID System
- **Company Login ID** (`companies.loginId`): auto-generated on registration — first 3 letters of company name + 5 random digits (e.g. `NEW58759`). Shown in Company Settings. Can be used to log in as the Managing Director.
- **Agent ID** (`users.agentId`): auto-generated on user creation — first 3 letters of full name + 5 random digits (e.g. `ADA96857`). Shown in Users table. Can be used at login.
- Login accepts: `username` OR `agentId` OR `loginId` (loginId authenticates as MD of that company)

### Auth & Local Storage
- `nmb_token`: JWT
- `nmb_user`: user object (includes companyId, agentId)
- `nmb_company`: company object (name, phone, logoUrl, themeColor, address, loginId)
- Helper functions in `artifacts/bakery/src/lib/auth.ts`
- Theme utilities in `artifacts/bakery/src/lib/theme.ts`
- `setAuthTokenGetter(() => getToken())` in main.tsx for auto-JWT injection

### Roles & Access
| Role | Pages |
|------|-------|
| managing_director | All pages + Company + Subscription + Users + User Activity + Audit Logs |
| manager | Dashboard, Production, Inventory, Reports, User Activity |
| receptionist | Dashboard, Sales, Allocations, Products |
| supplier | Dashboard, Sales, Allocations |
| production_staff | Dashboard, Production, Inventory |

### Seed Credentials (Demo Company: "New Model Bread")
| Role | Username | Password |
|------|----------|----------|
| Managing Director | admin | admin123 |
| Manager | manager1 | manager123 |
| Receptionist | receptionist1 | staff123 |
| Production Staff | production1 | staff123 |

Run seed: `cd artifacts/api-server && pnpm exec tsx src/seed.ts`

### Pages
- `/login` — Login page with "Register for free trial" link
- `/register` — New company registration (creates company + 7-day trial)
- `/dashboard` — Executive dashboard with KPIs and sales trend chart
- `/sales` — Record sales, view branded receipts (company logo + name on receipt)
- `/production` — Record production batches with waste tracking
- `/inventory` — Inventory management with low-stock alerts
- `/reports` — Analytics charts (sales trend, production by type, efficiency pie chart)
- `/users` — User management (MD only)
- `/user-activity` — Staff performance dashboard: KPI cards per user, role filter tabs, click-to-detail sheet with role-specific metrics + recent activity feed (MD + manager)
- `/audit-logs` — Audit trail with filters (action type, user, date range) + CSV export + pagination (MD only)
- `/settings` — Branch management (MD only)
- `/company-settings` — Company profile, logo upload (base64 ≤200KB), 5 theme colors (MD only)
- `/subscription` — Subscription status + renewal (₦3,000/month) (MD only)

### API Routes (Bakery tenants)
- `POST /api/auth/register` — Multi-tenant registration
- `POST /api/auth/login` — Returns token + user + company + subscription
- `GET /api/company` — Company profile
- `PATCH /api/company` — Update name/phone/address/logo/theme
- `GET /api/subscription` — Subscription status (auto-expires trial)
- `POST /api/subscription/renew` — Renew for 1 month
- `GET /api/reports/user-activity` — All-user performance summary (MD + manager): salesCount, totalRevenue, batchesLogged, allocationsIssued, returnsApproved, lastActiveAt per user
- `GET /api/reports/user-activity/:userId` — Detailed user activity: role-specific data (sales/returns/batches/allocations) + last 100 audit log entries
- `GET /api/audit-logs` — Paginated audit log with filters: action, userId, branchId, startDate, endDate, limit, offset

### API Routes (Super Admin — /api/admin/*)
- `POST /api/admin/auth/login` — Super admin login (returns 8h JWT with role: "super_admin")
- `GET /api/admin/companies` — List all companies with subscription info
- `GET /api/admin/companies/:id` — Company details + user count
- `PATCH /api/admin/companies/:id/subscription` — Update subscription (status + extend days)
- `GET /api/admin/analytics` — Platform stats (total, active, trial, expired, MRR)

### Super Admin Credentials
| Email | Password |
|-------|----------|
| saidumuhammed664@gmail.com | Mhixter664@gmail.com |

Access at: `/admin/login` → `/admin` (dashboard) → `/admin/companies` → `/admin/settings` (payment gateway)
Super admin has its own dark blue UI (separate from bakery theme system).
Re-seed with: `cd artifacts/api-server && pnpm exec tsx src/seed-admin.ts`

### Subscription Enforcement
- API: Global `subscriptionGuard` middleware in `routes/index.ts` returns HTTP 402 for expired companies on all core routes (production, sales, inventory, reports, etc.)
- Frontend: `SubscriptionGuard` component wraps all `Protected` routes — expired companies see a full-screen "Subscription Expired" wall with a Renew button; companies with ≤2 days remaining see an amber warning banner
- Subscription/auth routes and admin routes are exempt from the guard
- Trial auto-expires on API access (status updated to "expired" in DB)

### Database Tables
- `companies` — Tenant companies with theme/logo/branding
- `subscriptions` — Per-company subscription (trial/active/expired)
- `branches` — Bakery locations (scoped per company)
- `users` — Staff accounts (scoped per company)
- `production_batches` — Production records (scoped per company)
- `inventory_items` — Ingredient/material stock (scoped per company)
- `inventory_logs` — Stock adjustment history (scoped per company)
- `sales` — Sales transactions with receipts (scoped per company)
- `audit_logs` — System audit trail (scoped per company)

### Important Notes
- Radix Select: never use `value=""` — use `"none"` and convert in submit handlers
- DB numeric fields stored as strings in Postgres — always `parseFloat()` when reading
- Logo upload: base64 data URL, max 200KB, stored in companies.logoUrl
- Receipt branding: company logo + name + phone shown when company data exists in localStorage
