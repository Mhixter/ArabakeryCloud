import { Router, IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

function generateAgentId(fullName: string): string {
  const prefix = fullName.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
  const digits = String(Math.floor(10000 + Math.random() * 90000));
  return prefix + digits;
}

async function uniqueAgentId(fullName: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = generateAgentId(fullName);
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.agentId, id));
    if (!existing) return id;
  }
  return generateAgentId(fullName) + Math.floor(Math.random() * 10);
}

const formatUser = (u: typeof usersTable.$inferSelect) => ({
  id: u.id,
  username: u.username,
  agentId: u.agentId,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  branchId: u.branchId,
  companyId: u.companyId,
  isActive: u.isActive,
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
  deletedAt: u.deletedAt?.toISOString() ?? null,
});

router.get("/users", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt)))
    .orderBy(usersTable.createdAt);
  res.json(users.map(formatUser));
});

router.post("/users", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { username, password, fullName, email, role, branchId } = req.body;
  if (!username || !password || !fullName || !role) {
    res.status(400).json({ error: "username, password, fullName, and role are required" }); return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing.length > 0) { res.status(400).json({ error: "Username already exists" }); return; }

  const agentId = await uniqueAgentId(fullName);
  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    companyId, username, passwordHash, fullName, email: email ?? null, role,
    branchId: branchId ?? null, agentId,
  }).returning();

  await logAudit({ req, userId: req.user!.userId, companyId, action: "USER_CREATED", entityType: "user", entityId: user.id, details: `Created user ${username} (Agent ID: ${agentId}) with role ${role}` });
  res.status(201).json(formatUser(user));
});

router.get("/users/:id", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt)));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { fullName, email, role, branchId, isActive, password } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (fullName != null) updates.fullName = fullName;
  if (email !== undefined) updates.email = email;
  if (role != null) updates.role = role;
  if (branchId !== undefined) updates.branchId = branchId;
  if (isActive != null) updates.isActive = isActive;
  if (password) updates.passwordHash = hashPassword(password);
  const [user] = await db.update(usersTable).set(updates).where(and(eq(usersTable.id, id), eq(usersTable.companyId, companyId))).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await logAudit({ req, userId: req.user!.userId, companyId, action: "USER_UPDATED", entityType: "user", entityId: id, details: JSON.stringify(Object.keys(updates)) });
  res.json(formatUser(user));
});

/* Reset password — managing_director only */
router.patch("/users/:id/reset-password", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ error: "New password must be at least 4 characters" }); return;
  }

  const [existing] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt)));
  if (!existing) { res.status(404).json({ error: "User not found" }); return; }

  const [user] = await db.update(usersTable).set({ passwordHash: hashPassword(newPassword) }).where(and(eq(usersTable.id, id), eq(usersTable.companyId, companyId))).returning();
  await logAudit({ req, userId: req.user!.userId, companyId, action: "PASSWORD_RESET", entityType: "user", entityId: id, details: `Password reset for ${existing.username}` });
  res.json({ success: true, message: "Password updated" });
});

router.delete("/users/:id", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [user] = await db.update(usersTable).set({ deletedAt: new Date() }).where(and(eq(usersTable.id, id), eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt))).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await logAudit({ req, userId: req.user!.userId, companyId, action: "USER_DELETED", entityType: "user", entityId: id });
  res.json({ success: true, message: "User deleted" });
});

export default router;
