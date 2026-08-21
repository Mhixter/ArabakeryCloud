import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: any;
let schemaReady: Promise<void> = Promise.resolve();

try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
    /*
     * Render uses the existing Neon database without an automatic Drizzle
     * migration step. Keep this additive and idempotent so older deployments
     * receive the settlement fields without changing existing allocation rows.
    */
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS daily_closings (
        id serial PRIMARY KEY,
        company_id integer NOT NULL REFERENCES companies(id),
        branch_id integer NOT NULL REFERENCES branches(id),
        business_date text NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        notes text,
        submitted_by_id integer REFERENCES users(id),
        submitted_at timestamptz,
        approved_by_id integer REFERENCES users(id),
        approved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS daily_closings_company_branch_date_idx
        ON daily_closings(company_id, branch_id, business_date);
      CREATE TABLE IF NOT EXISTS daily_closing_lines (
        id serial PRIMARY KEY,
        closing_id integer NOT NULL REFERENCES daily_closings(id) ON DELETE CASCADE,
        product_id integer,
        product_name text NOT NULL,
        opening_stock integer NOT NULL DEFAULT 0,
        produced integer NOT NULL DEFAULT 0,
        allocated integer NOT NULL DEFAULT 0,
        returned integer NOT NULL DEFAULT 0,
        recorded_sales integer NOT NULL DEFAULT 0,
        closing_stock integer NOT NULL DEFAULT 0,
        calculated_sales integer NOT NULL DEFAULT 0,
        variance integer NOT NULL DEFAULT 0,
        variance_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE seller_allocations
        ADD COLUMN IF NOT EXISTS is_cleared boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS cleared_at timestamptz,
         ADD COLUMN IF NOT EXISTS cleared_by_id integer;
      ALTER TABLE production_batches
        ADD COLUMN IF NOT EXISTS product_id integer;
      ALTER TABLE sales
        ADD COLUMN IF NOT EXISTS product_id integer;
      ALTER TABLE seller_allocations
        ADD COLUMN IF NOT EXISTS product_id integer;
      ALTER TABLE product_returns
        ADD COLUMN IF NOT EXISTS product_id integer;
      ALTER TABLE daily_closing_lines
        ADD COLUMN IF NOT EXISTS counted integer NOT NULL DEFAULT 0
    `).then(() => undefined);
  } else {
    console.warn("[AI Studio] DATABASE_URL missing — using mock DB proxy");
    const noOp = {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      create: async (d: any) => d?.data ?? {},
      update: async (d: any) => d?.data ?? {},
      delete: async () => ({}),
    };
    db = new Proxy({}, {
      get: (_, prop) => (prop === "query" ? new Proxy({}, { get: () => noOp }) : async () => []),
    });
  }
} catch (err) {
  console.warn("[AI Studio] Database initialization warning — using mock DB proxy", err);
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  };
  db = new Proxy({}, {
    get: (_, prop) => (prop === "query" ? new Proxy({}, { get: () => noOp }) : async () => []),
  });
}

export { pool, db, schemaReady };
export * from "./schema";
