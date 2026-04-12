import { Router } from "express";
import { db, superAdminsTable, companiesTable, subscriptionsTable, usersTable, paymentGatewayConfigTable, transactionsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
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
    updates.startDate = now;
    updates.endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
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

export default router;
