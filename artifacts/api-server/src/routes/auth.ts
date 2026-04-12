import { Router, IRouter } from "express";
import { db, usersTable, branchesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken } from "../lib/auth";
import { authenticate, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.username, username), isNull(usersTable.deletedAt)));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Account is deactivated" });
    return;
  }

  const valid = verifyPassword(password, user.passwordHash);

  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    branchId: user.branchId,
  });

  // Update last login
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  await logAudit({
    req,
    userId: user.id,
    userName: user.fullName,
    action: "LOGIN",
    entityType: "auth",
    branchId: user.branchId,
  });

  // Get branch name if set
  let branchName: string | undefined;
  if (user.branchId) {
    const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, user.branchId));
    branchName = branch?.name;
  }

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      deletedAt: user.deletedAt?.toISOString() ?? null,
    },
  });
});

router.post("/auth/logout", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.user!;
  await logAudit({
    req,
    userId: user.userId,
    action: "LOGOUT",
    entityType: "auth",
  });
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.user!;
  const [dbUser] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, user.userId), isNull(usersTable.deletedAt)));

  if (!dbUser) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: dbUser.id,
    username: dbUser.username,
    fullName: dbUser.fullName,
    email: dbUser.email,
    role: dbUser.role,
    branchId: dbUser.branchId,
    isActive: dbUser.isActive,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
    deletedAt: dbUser.deletedAt?.toISOString() ?? null,
  });
});

export default router;
