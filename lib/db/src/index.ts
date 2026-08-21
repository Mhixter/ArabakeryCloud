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
        ADD COLUMN IF NOT EXISTS counted boolean NOT NULL DEFAULT false
      ;
      ALTER TABLE daily_closings
        ADD COLUMN IF NOT EXISTS stock_settled_amount numeric(12, 2),
        ADD COLUMN IF NOT EXISTS stock_settlement_payment_method text,
        ADD COLUMN IF NOT EXISTS stock_settlement_notes text,
        ADD COLUMN IF NOT EXISTS stock_settled_by_id integer,
        ADD COLUMN IF NOT EXISTS stock_settled_at timestamptz
      ;
      CREATE TABLE IF NOT EXISTS quick_sale_settlements (
        id serial PRIMARY KEY,
        company_id integer NOT NULL REFERENCES companies(id),
        branch_id integer NOT NULL REFERENCES branches(id),
        week_start text NOT NULL,
        week_end text NOT NULL,
        amount numeric(12, 2) NOT NULL,
        payment_method text NOT NULL,
        notes text,
        accepted_by_id integer NOT NULL REFERENCES users(id),
        accepted_at timestamptz NOT NULL DEFAULT now(),
        stock_cleared_at timestamptz,
        stock_cleared_products integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE quick_sale_settlements
        ADD COLUMN IF NOT EXISTS stock_cleared_at timestamptz,
        ADD COLUMN IF NOT EXISTS stock_cleared_products integer NOT NULL DEFAULT 0
      ;
      CREATE UNIQUE INDEX IF NOT EXISTS quick_sale_settlements_company_branch_week_idx
        ON quick_sale_settlements(company_id, branch_id, week_start);
      ALTER TABLE daily_closing_lines
        ADD COLUMN IF NOT EXISTS stock_settled_amount numeric(12, 2),
        ADD COLUMN IF NOT EXISTS stock_settlement_payment_method text,
        ADD COLUMN IF NOT EXISTS stock_settlement_notes text,
        ADD COLUMN IF NOT EXISTS stock_settled_by_id integer,
        ADD COLUMN IF NOT EXISTS stock_settled_at timestamptz
      ;
      CREATE TABLE IF NOT EXISTS product_identity_backfill_issues (
        id serial PRIMARY KEY,
        company_id integer NOT NULL REFERENCES companies(id),
        transaction_type text NOT NULL,
        transaction_id integer NOT NULL,
        bread_type text NOT NULL,
        candidate_count integer NOT NULL DEFAULT 0,
        reason text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (transaction_type, transaction_id)
      );
      CREATE INDEX IF NOT EXISTS product_identity_backfill_issues_company_idx
        ON product_identity_backfill_issues(company_id);
      /* Older deployments may have the table without its newer UNIQUE
         constraint. Remove duplicate legacy issue rows before restoring the
         idempotency index used by the backfill below. */
      DELETE FROM product_identity_backfill_issues a
      USING product_identity_backfill_issues b
      WHERE a.id > b.id
        AND a.transaction_type = b.transaction_type
        AND a.transaction_id = b.transaction_id;
      CREATE UNIQUE INDEX IF NOT EXISTS product_identity_backfill_issues_tx_idx
        ON product_identity_backfill_issues(transaction_type, transaction_id);

      /* Only assign an active product when the company/branch/name match is
         unique. Rows with zero or multiple candidates stay untouched and are
         recorded for review instead of being guessed. */
      WITH candidates AS (
        SELECT t.id AS transaction_id, t.company_id, t.bread_type,
               p.id AS product_id, count(*) OVER (PARTITION BY t.id) AS candidate_count
        FROM production_batches t
        JOIN products p ON p.company_id = t.company_id
          AND p.is_active = true
          AND lower(trim(p.name)) = lower(trim(t.bread_type))
          AND (p.branch_id IS NULL OR p.branch_id = t.branch_id)
        WHERE t.product_id IS NULL
      )
      UPDATE production_batches t
      SET product_id = c.product_id
      FROM candidates c
      WHERE t.id = c.transaction_id AND c.candidate_count = 1;
      INSERT INTO product_identity_backfill_issues
        (company_id, transaction_type, transaction_id, bread_type, candidate_count, reason)
      SELECT t.company_id, 'production', t.id, t.bread_type, count(p.id),
        CASE WHEN count(p.id) = 0 THEN 'no_active_product_match' ELSE 'multiple_active_product_matches' END
      FROM production_batches t
      LEFT JOIN products p ON p.company_id = t.company_id AND p.is_active = true
        AND lower(trim(p.name)) = lower(trim(t.bread_type))
        AND (p.branch_id IS NULL OR p.branch_id = t.branch_id)
      WHERE t.product_id IS NULL
      GROUP BY t.company_id, t.id, t.bread_type
      HAVING count(p.id) <> 1
      ON CONFLICT (transaction_type, transaction_id) DO NOTHING;

      WITH candidates AS (
        SELECT t.id AS transaction_id, p.id AS product_id,
               count(*) OVER (PARTITION BY t.id) AS candidate_count
        FROM sales t
        JOIN products p ON p.company_id = t.company_id AND p.is_active = true
          AND lower(trim(p.name)) = lower(trim(t.bread_type))
          AND (p.branch_id IS NULL OR p.branch_id = t.branch_id)
        WHERE t.product_id IS NULL
      )
      UPDATE sales t SET product_id = c.product_id
      FROM candidates c WHERE t.id = c.transaction_id AND c.candidate_count = 1;
      INSERT INTO product_identity_backfill_issues
        (company_id, transaction_type, transaction_id, bread_type, candidate_count, reason)
      SELECT t.company_id, 'sale', t.id, t.bread_type, count(p.id),
        CASE WHEN count(p.id) = 0 THEN 'no_active_product_match' ELSE 'multiple_active_product_matches' END
      FROM sales t LEFT JOIN products p ON p.company_id = t.company_id AND p.is_active = true
        AND lower(trim(p.name)) = lower(trim(t.bread_type))
        AND (p.branch_id IS NULL OR p.branch_id = t.branch_id)
      WHERE t.product_id IS NULL
      GROUP BY t.company_id, t.id, t.bread_type HAVING count(p.id) <> 1
      ON CONFLICT (transaction_type, transaction_id) DO NOTHING;

      WITH candidates AS (
        SELECT t.id AS transaction_id, p.id AS product_id,
               count(*) OVER (PARTITION BY t.id) AS candidate_count
        FROM seller_allocations t
        JOIN products p ON p.company_id = t.company_id AND p.is_active = true
          AND lower(trim(p.name)) = lower(trim(t.bread_type))
          AND (p.branch_id IS NULL OR p.branch_id = t.branch_id)
        WHERE t.product_id IS NULL
      )
      UPDATE seller_allocations t SET product_id = c.product_id
      FROM candidates c WHERE t.id = c.transaction_id AND c.candidate_count = 1;
      INSERT INTO product_identity_backfill_issues
        (company_id, transaction_type, transaction_id, bread_type, candidate_count, reason)
      SELECT t.company_id, 'allocation', t.id, t.bread_type, count(p.id),
        CASE WHEN count(p.id) = 0 THEN 'no_active_product_match' ELSE 'multiple_active_product_matches' END
      FROM seller_allocations t LEFT JOIN products p ON p.company_id = t.company_id AND p.is_active = true
        AND lower(trim(p.name)) = lower(trim(t.bread_type))
        AND (p.branch_id IS NULL OR p.branch_id = t.branch_id)
      WHERE t.product_id IS NULL
      GROUP BY t.company_id, t.id, t.bread_type HAVING count(p.id) <> 1
      ON CONFLICT (transaction_type, transaction_id) DO NOTHING;

      WITH candidates AS (
        SELECT t.id AS transaction_id, p.id AS product_id,
               count(*) OVER (PARTITION BY t.id) AS candidate_count
        FROM product_returns t
        JOIN products p ON p.company_id = t.company_id AND p.is_active = true
          AND lower(trim(p.name)) = lower(trim(t.bread_type))
          AND (p.branch_id IS NULL OR p.branch_id = t.branch_id)
        WHERE t.product_id IS NULL
      )
      UPDATE product_returns t SET product_id = c.product_id
      FROM candidates c WHERE t.id = c.transaction_id AND c.candidate_count = 1;
      INSERT INTO product_identity_backfill_issues
        (company_id, transaction_type, transaction_id, bread_type, candidate_count, reason)
      SELECT t.company_id, 'return', t.id, t.bread_type, count(p.id),
        CASE WHEN count(p.id) = 0 THEN 'no_active_product_match' ELSE 'multiple_active_product_matches' END
      FROM product_returns t LEFT JOIN products p ON p.company_id = t.company_id AND p.is_active = true
        AND lower(trim(p.name)) = lower(trim(t.bread_type))
        AND (p.branch_id IS NULL OR p.branch_id = t.branch_id)
      WHERE t.product_id IS NULL
      GROUP BY t.company_id, t.id, t.bread_type HAVING count(p.id) <> 1
      ON CONFLICT (transaction_type, transaction_id) DO NOTHING
      ;
      DELETE FROM product_identity_backfill_issues i
      WHERE (i.transaction_type = 'production' AND EXISTS (SELECT 1 FROM production_batches t WHERE t.id = i.transaction_id AND t.product_id IS NOT NULL))
         OR (i.transaction_type = 'sale' AND EXISTS (SELECT 1 FROM sales t WHERE t.id = i.transaction_id AND t.product_id IS NOT NULL))
         OR (i.transaction_type = 'allocation' AND EXISTS (SELECT 1 FROM seller_allocations t WHERE t.id = i.transaction_id AND t.product_id IS NOT NULL))
         OR (i.transaction_type = 'return' AND EXISTS (SELECT 1 FROM product_returns t WHERE t.id = i.transaction_id AND t.product_id IS NOT NULL))
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
