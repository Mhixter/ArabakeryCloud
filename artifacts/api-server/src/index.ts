import app from "./app";
import { logger } from "./lib/logger";
import { db, superAdminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureSuperAdmin() {
  try {
    const username = "saidumuhammed664@gmail.com";
    const existing = await db
      .select()
      .from(superAdminsTable)
      .where(eq(superAdminsTable.username, username));
    if (existing.length > 0) return;
    await db.delete(superAdminsTable).where(eq(superAdminsTable.username, "superadmin"));
    await db.insert(superAdminsTable).values({
      username,
      passwordHash: hashPassword("Mhixter@664"),
      fullName: "Platform Administrator",
      isActive: true,
    });
    logger.info("Super admin seeded successfully");
  } catch (err) {
    logger.warn({ err }, "Could not auto-seed super admin (non-fatal)");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  await ensureSuperAdmin();
});
