import { Router } from "express";
import { db, superAdminsTable, companiesTable, subscriptionsTable, usersTable, paymentGatewayConfigTable, transactionsTable, branchesTable, productsTable, salesTable, productionBatchesTable, sellerAllocationsTable, productReturnsTable, inventoryItemsTable, inventoryLogsTable, expensesTable, expenseCategoriesTable, workersTable, workerCategoriesTable } from "@workspace/db";
import { eq, desc, count, isNull, and } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";

/* ─ Super admin middleware ─ */
function authenticateSuperAdmin(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    if (payload.role !== "super_admin") return res.status(403).json({ error: "Forbidden" });
    req.superAdmin = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* ─ Login ─ */
router.post("/admin/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  const [admin] = await db.select().from(superAdminsTable).where(eq(superAdminsTable.username, username));
  if (!admin || !admin.isActive) return res.status(401).json({ error: "Invalid credentials" });

  const valid = verifyPassword(password, admin.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { superAdminId: admin.id, role: "super_admin", fullName: admin.fullName },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
  res.json({ token, admin: { id: admin.id, username: admin.username, fullName: admin.fullName } });
});

/* ─ All companies with subscription info ─ */
router.get("/admin/companies", authenticateSuperAdmin, async (_req, res) => {
  const companies = await db
    .select({
      id: companiesTable.id,
      name: companiesTable.name,
      phone: companiesTable.phone,
      address: companiesTable.address,
      themeColor: companiesTable.themeColor,
      createdAt: companiesTable.createdAt,
      subStatus: subscriptionsTable.status,
      subPlan: subscriptionsTable.plan,
      subStart: subscriptionsTable.currentPeriodStart,
      subEnd: subscriptionsTable.currentPeriodEnd,
      trialEndsAt: subscriptionsTable.trialEndsAt,
    })
    .from(companiesTable)
    .leftJoin(subscriptionsTable, eq(subscriptionsTable.companyId, companiesTable.id))
    .orderBy(desc(companiesTable.createdAt));
  res.json(companies);
});

/* ─ Single company detail ─ */
router.get("/admin/companies/:id", authenticateSuperAdmin, async (req, res) => {
  const companyId = parseInt(req.params.id);
  const [company] = await db
    .select({
      id: companiesTable.id,
      name: companiesTable.name,
      phone: companiesTable.phone,
      address: companiesTable.address,
      themeColor: companiesTable.themeColor,
      createdAt: companiesTable.createdAt,
      subStatus: subscriptionsTable.status,
      subPlan: subscriptionsTable.plan,
      subStart: subscriptionsTable.currentPeriodStart,
      subEnd: subscriptionsTable.currentPeriodEnd,
      trialEndsAt: subscriptionsTable.trialEndsAt,
    })
    .from(companiesTable)
    .leftJoin(subscriptionsTable, eq(subscriptionsTable.companyId, companiesTable.id))
    .where(eq(companiesTable.id, companyId));

  if (!company) return res.status(404).json({ error: "Not found" });

  const [userCount] = await db.select({ cnt: count() }).from(usersTable).where(eq(usersTable.companyId, companyId));
  res.json({ ...company, userCount: Number(userCount?.cnt ?? 0) });
});

/* ─ Update subscription ─ */
router.patch("/admin/companies/:id/subscription", authenticateSuperAdmin, async (req, res) => {
  const companyId = parseInt(req.params.id);
  const { status, days } = req.body ?? {};

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  if (!sub) return res.status(404).json({ error: "Subscription not found" });

  const now = new Date();
  const updates: any = { updatedAt: now };
  if (status) updates.status = status;
  if (days && typeof days === "number" && days > 0) {
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    updates.currentPeriodStart = now;
    updates.currentPeriodEnd = endDate;
    updates.trialEndsAt = null;
    if (!status) updates.status = "active";
  }

  await db.update(subscriptionsTable).set(updates).where(eq(subscriptionsTable.companyId, companyId));
  res.json({ success: true });
});

/* ─ Platform analytics ─ */
router.get("/admin/analytics", authenticateSuperAdmin, async (_req, res) => {
  const [totalCompanies] = await db.select({ cnt: count() }).from(companiesTable);
  const subStats = await db
    .select({ status: subscriptionsTable.status, cnt: count() })
    .from(subscriptionsTable)
    .groupBy(subscriptionsTable.status);

  const active = Number(subStats.find(s => s.status === "active")?.cnt ?? 0);
  const trial  = Number(subStats.find(s => s.status === "trial")?.cnt ?? 0);
  const expired = Number(subStats.find(s => s.status === "expired")?.cnt ?? 0);

  const recentCompanies = await db
    .select({ id: companiesTable.id, name: companiesTable.name, createdAt: companiesTable.createdAt, status: subscriptionsTable.status })
    .from(companiesTable)
    .leftJoin(subscriptionsTable, eq(subscriptionsTable.companyId, companiesTable.id))
    .orderBy(desc(companiesTable.createdAt))
    .limit(5);

  res.json({
    totalCompanies: Number(totalCompanies?.cnt ?? 0),
    active,
    trial,
    expired,
    monthlyRevenue: active * 3000,
    recentCompanies,
  });
});

/* ─ Payment gateway config ─ */
router.get("/admin/gateway", authenticateSuperAdmin, async (_req, res) => {
  const [config] = await db.select().from(paymentGatewayConfigTable).limit(1);
  if (!config) {
    return res.json({ provider: "paystack", publicKey: "", secretKey: "", webhookSecret: "", mode: "test", isActive: true });
  }
  res.json(config);
});

router.put("/admin/gateway", authenticateSuperAdmin, async (req: any, res) => {
  const { provider, publicKey, secretKey, webhookSecret, mode, isActive } = req.body ?? {};
  const [existing] = await db.select().from(paymentGatewayConfigTable).limit(1);

  if (existing) {
    const [updated] = await db.update(paymentGatewayConfigTable)
      .set({ provider, publicKey, secretKey, webhookSecret, mode, isActive, updatedBy: req.superAdmin?.fullName })
      .where(eq(paymentGatewayConfigTable.id, existing.id))
      .returning();
    return res.json(updated);
  }

  const [created] = await db.insert(paymentGatewayConfigTable)
    .values({ provider: provider ?? "paystack", publicKey: publicKey ?? "", secretKey: secretKey ?? "", webhookSecret: webhookSecret ?? "", mode: mode ?? "test", isActive: isActive ?? true, updatedBy: req.superAdmin?.fullName })
    .returning();
  res.json(created);
});

/* ─ Reset MD password for a company ─ */
router.patch("/admin/companies/:id/reset-password", authenticateSuperAdmin, async (req, res) => {
  const companyId = parseInt(req.params.id);
  const { newPassword } = req.body ?? {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters" });
  }

  const md = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.companyId, companyId));

  const managingDirector = md.find(u => u.role === "managing_director" && !u.deletedAt);
  if (!managingDirector) return res.status(404).json({ error: "Managing Director not found for this company" });

  await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(newPassword) })
    .where(eq(usersTable.id, managingDirector.id));

  res.json({ success: true, message: `Password reset for ${managingDirector.username}` });
});

/* ─ List all users in a company ─ */
router.get("/admin/companies/:id/users", authenticateSuperAdmin, async (req, res) => {
  const companyId = parseInt(req.params.id);
  const users = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      username: usersTable.username,
      role: usersTable.role,
      isActive: usersTable.isActive,
      agentId: usersTable.agentId,
      branchId: usersTable.branchId,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(and(eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt)))
    .orderBy(usersTable.role, usersTable.fullName);
  res.json(users);
});

/* ─ Change a user's role ─ */
router.patch("/admin/companies/:id/users/:userId/role", authenticateSuperAdmin, async (req, res) => {
  const companyId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const { role } = req.body ?? {};
  const validRoles = ["managing_director", "manager", "receptionist", "production_staff", "supplier"];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const [user] = await db.select().from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt)));
  if (!user) return res.status(404).json({ error: "User not found" });

  const [updated] = await db.update(usersTable)
    .set({ role, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id, role: usersTable.role });
  res.json(updated);
});

/* ─ Change a user's password ─ */
router.patch("/admin/companies/:id/users/:userId/password", authenticateSuperAdmin, async (req, res) => {
  const companyId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const { newPassword } = req.body ?? {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }
  const [user] = await db.select().from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt)));
  if (!user) return res.status(404).json({ error: "User not found" });

  await db.update(usersTable)
    .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
  res.json({ success: true, message: `Password updated for ${user.username}` });
});

/* ─ Transactions ─ */
router.get("/admin/transactions", authenticateSuperAdmin, async (_req, res) => {
  const txs = await db
    .select({
      id: transactionsTable.id,
      companyId: transactionsTable.companyId,
      companyName: companiesTable.name,
      reference: transactionsTable.reference,
      amount: transactionsTable.amount,
      status: transactionsTable.status,
      gateway: transactionsTable.gateway,
      gatewayReference: transactionsTable.gatewayReference,
      description: transactionsTable.description,
      months: transactionsTable.months,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .leftJoin(companiesTable, eq(companiesTable.id, transactionsTable.companyId))
    .orderBy(desc(transactionsTable.createdAt));
  res.json(txs);
});

router.patch("/admin/transactions/:id/status", authenticateSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body ?? {};
  const allowed = ["success", "failed", "pending", "refunded"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const [updated] = await db.update(transactionsTable)
    .set({ status })
    .where(eq(transactionsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Transaction not found" });
  res.json(updated);
});

/* ─ Company backup (super-admin only) ─ */
router.get("/admin/backup/:companyId", authenticateSuperAdmin, async (req, res) => {
  const companyId = parseInt(req.params.companyId);

  const [company]  = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company) return res.status(404).json({ error: "Company not found" });

  const [branches, users, products, sales, production, allocations, returns_, inventory, invLogs, expenses, expCats, workers, workerCats] = await Promise.all([
    db.select().from(branchesTable).where(eq(branchesTable.companyId, companyId)),
    db.select({ id: usersTable.id, fullName: usersTable.fullName, username: usersTable.username, role: usersTable.role, branchId: usersTable.branchId, isActive: usersTable.isActive, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.companyId, companyId)),
    db.select().from(productsTable).where(eq(productsTable.companyId, companyId)),
    db.select().from(salesTable).where(and(eq(salesTable.companyId, companyId), isNull(salesTable.deletedAt))),
    db.select().from(productionBatchesTable).where(and(eq(productionBatchesTable.companyId, companyId), isNull(productionBatchesTable.deletedAt))),
    db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.companyId, companyId), isNull(sellerAllocationsTable.deletedAt))),
    db.select().from(productReturnsTable).where(eq(productReturnsTable.companyId, companyId)),
    db.select().from(inventoryItemsTable).where(and(eq(inventoryItemsTable.companyId, companyId), isNull(inventoryItemsTable.deletedAt))),
    db.select().from(inventoryLogsTable).where(eq(inventoryLogsTable.companyId, companyId)),
    db.select().from(expensesTable).where(and(eq(expensesTable.companyId, companyId), isNull(expensesTable.deletedAt))),
    db.select().from(expenseCategoriesTable).where(eq(expenseCategoriesTable.companyId, companyId)),
    db.select().from(workersTable).where(and(eq(workersTable.companyId, companyId), isNull(workersTable.deletedAt))),
    db.select().from(workerCategoriesTable).where(eq(workerCategoriesTable.companyId, companyId)),
  ]);

  res.json({
    meta: { exportedAt: new Date().toISOString(), companyId, companyName: company.name },
    company: { ...company, passwordHash: undefined },
    branches, users, products, sales, production, allocations,
    returns: returns_, inventory, inventoryLogs: invLogs,
    expenses, expenseCategories: expCats, workers, workerCategories: workerCats,
  });
});

export default router;
