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
      ALTER TABLE seller_allocations
        ADD COLUMN IF NOT EXISTS is_cleared boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS cleared_at timestamptz,
        ADD COLUMN IF NOT EXISTS cleared_by_id integer
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
