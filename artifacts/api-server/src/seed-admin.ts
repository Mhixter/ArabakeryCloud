import { db, superAdminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth";

async function seedSuperAdmin() {
  const username = "saidumuhammed664@gmail.com";
  const password = "Mhixter@664";

  const existing = await db
    .select()
    .from(superAdminsTable)
    .where(eq(superAdminsTable.username, username));

  if (existing.length > 0) {
    console.log("Super admin already exists:", existing[0].username);
    process.exit(0);
  }

  // Remove old default admin if present
  await db.delete(superAdminsTable).where(eq(superAdminsTable.username, "superadmin"));

  const passwordHash = hashPassword(password);
  await db.insert(superAdminsTable).values({
    username,
    passwordHash,
    fullName: "Platform Administrator",
    isActive: true,
  });
  console.log(`✓ Super admin created — login: ${username} / ${password}`);
  process.exit(0);
}

seedSuperAdmin().catch(e => { console.error(e); process.exit(1); });
