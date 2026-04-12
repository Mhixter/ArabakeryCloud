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

### Auth
- Token stored as `nmb_token` in localStorage
- User stored as `nmb_user` in localStorage
- Helper functions in `artifacts/bakery/src/lib/auth.ts`
- `setAuthTokenGetter(() => getToken())` in main.tsx for auto-JWT injection

### Roles & Access
| Role | Pages |
|------|-------|
| managing_director | All pages |
| manager | Dashboard, Production, Inventory, Reports |
| receptionist | Dashboard, Sales |
| production_staff | Production only |

### Seed Credentials
| Role | Username | Password |
|------|----------|----------|
| Managing Director | admin | admin123 |
| Manager | manager1 | manager123 |
| Receptionist | receptionist1 | staff123 |
| Production Staff | production1 | staff123 |

### Pages
- `/login` — Login page
- `/dashboard` — Executive dashboard with KPIs and sales trend chart
- `/sales` — Record sales, view receipts, print receipts
- `/production` — Record production batches with waste tracking
- `/inventory` — Inventory management with low-stock alerts
- `/reports` — Analytics charts (sales trend, production by type, efficiency pie chart)
- `/users` — User management (MD only)
- `/audit-logs` — Audit trail (MD only)
- `/settings` — Branch management (MD only)

### Database Tables
- `branches` — Bakery locations
- `users` — Staff accounts
- `production_batches` — Production records with waste
- `inventory_items` — Ingredient/material stock
- `inventory_logs` — Stock adjustment history
- `sales` — Sales transactions with receipts
- `audit_logs` — System audit trail

### Seed Script
Run seed (builds then runs):
```bash
cd artifacts/api-server
node --input-type=module -e "import { build } from './node_modules/esbuild/lib/main.js'; build({ entryPoints: ['src/seed.ts'], platform: 'node', bundle: true, format: 'cjs', outfile: 'dist/seed.cjs', external: ['*.node'] }).then(() => console.log('built'))"
node dist/seed.cjs
```
