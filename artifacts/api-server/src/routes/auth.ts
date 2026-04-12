import { Router, IRouter } from "express";
import { db, usersTable, branchesTable, companiesTable, subscriptionsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken } from "../lib/auth";
import { authenticate, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const formatUser = (u: typeof usersTable.$inferSelect) => ({
  id: u.id,
  username: u.username,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  branchId: u.branchId,
  companyId: u.companyId,
  isActive: u.isActive,
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
});

const formatCompany = (c: typeof companiesTable.$inferSelect) => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  logoUrl: c.logoUrl,
  themeColor: c.themeColor,
  address: c.address,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const { companyName, phone, adminUsername, adminPassword, adminFullName, adminEmail } = req.body;

  if (!companyName || !adminUsername || !adminPassword || !adminFullName) {
    res.status(400).json({ error: "Company name, admin username, password, and full name are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, adminUsername));
  if (existing.length > 0) {
    res.status(400).json({ error: "Username already exists" });
    return;
  }

  const [company] = await db.insert(companiesTable).values({
    name: companyName,
    phone: phone || null,
    themeColor: "amber",
  }).returning();

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);

  await db.insert(subscriptionsTable).values({
    companyId: company.id,
    status: "trial",
    trialEndsAt: trialEnd,
  });

  const [mainBranch] = await db.insert(branchesTable).values({
    companyId: company.id,
    name: "Main Branch",
    isActive: true,
  }).returning();

  const passwordHash = hashPassword(adminPassword);
  const [user] = await db.insert(usersTable).values({
    companyId: company.id,
    username: adminUsername,
    passwordHash,
    fullName: adminFullName,
    email: adminEmail || null,
    role: "managing_director",
    branchId: mainBranch.id,
    isActive: true,
  }).returning();

  const token = signToken({ userId: user.id, role: user.role, branchId: user.branchId, companyId: company.id });

  await logAudit({
    userId: user.id,
    userName: adminFullName,
    companyId: company.id,
    action: "COMPANY_REGISTERED",
    entityType: "company",
    entityId: company.id,
    details: `Registered company ${companyName}`,
  });

  res.status(201).json({ token, user: formatUser(user), company: formatCompany(company) });
});

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

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId));
  if (!company) {
    res.status(401).json({ error: "Company not found" });
    return;
  }

  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.companyId, company.id));

  const token = signToken({ userId: user.id, role: user.role, branchId: user.branchId, companyId: company.id });

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  let branchName: string | undefined;
  if (user.branchId) {
    const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, user.branchId));
    branchName = branch?.name;
  }

  await logAudit({
    req,
    userId: user.id,
    userName: user.fullName,
    companyId: company.id,
    action: "LOGIN",
    entityType: "auth",
    branchId: user.branchId,
  });

  res.json({
    token,
    user: { ...formatUser(user), branchName },
    company: formatCompany(company),
    subscription: subscription ? {
      status: subscription.status,
      plan: subscription.plan,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    } : null,
  });
});

router.post("/auth/logout", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.user!;
  await logAudit({
    req,
    userId: user.userId,
    companyId: user.companyId,
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

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId));

  res.json({ ...formatUser(dbUser), company: company ? formatCompany(company) : null });
});

export default router;
