import { Router, IRouter } from "express";
import { db, subscriptionsTable, transactionsTable, paymentGatewayConfigTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";
import crypto from "crypto";

const router: IRouter = Router();

const formatSubscription = (s: typeof subscriptionsTable.$inferSelect) => ({
  id: s.id,
  companyId: s.companyId,
  plan: s.plan,
  status: s.status,
  priceMonthly: parseFloat(s.priceMonthly as unknown as string),
  trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
  currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
  currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
  daysRemaining: (() => {
    const now = new Date();
    if (s.status === "trial" && s.trialEndsAt) {
      return Math.max(0, Math.ceil((s.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }
    if (s.status === "active" && s.currentPeriodEnd) {
      return Math.max(0, Math.ceil((s.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }
    return 0;
  })(),
});

router.get("/subscription", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  if (!subscription) { res.status(404).json({ error: "No subscription found" }); return; }

  if (subscription.status === "trial" && subscription.trialEndsAt && new Date() > subscription.trialEndsAt) {
    const [updated] = await db.update(subscriptionsTable).set({ status: "expired" }).where(eq(subscriptionsTable.id, subscription.id)).returning();
    res.json(formatSubscription(updated));
    return;
  }

  res.json(formatSubscription(subscription));
});

router.post("/subscription/renew", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const months = Math.max(1, Math.min(12, parseInt(req.body?.months ?? "1") || 1));

  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  if (!subscription) { res.status(404).json({ error: "No subscription found" }); return; }

  // Get company name for description
  const [company] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, companyId));

  // Get gateway config — must be configured with a secret key before renewal is allowed
  const [gateway] = await db.select().from(paymentGatewayConfigTable).limit(1);

  if (!gateway || !gateway.secretKey || gateway.secretKey.trim() === "") {
    res.status(400).json({
      error: "Payment gateway not configured. Please contact the platform administrator to set up payments before renewing.",
      code: "GATEWAY_NOT_CONFIGURED",
    });
    return;
  }

  const now = new Date();
  const periodStart = now;
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + months);

  // Generate unique payment reference
  const reference = `NMB-${companyId}-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const amount = (3000 * months).toFixed(2);

  // Create transaction record
  await db.insert(transactionsTable).values({
    companyId,
    reference,
    amount,
    status: "success",
    gateway: gateway?.provider ?? "manual",
    description: `${months} month${months > 1 ? "s" : ""} subscription for ${company?.name ?? "company"}`,
    months,
  });

  const [updated] = await db.update(subscriptionsTable).set({
    status: "active",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  }).where(eq(subscriptionsTable.id, subscription.id)).returning();

  await logAudit({
    req,
    userId: req.user!.userId,
    companyId,
    action: "SUBSCRIPTION_RENEWED",
    entityType: "subscription",
    entityId: subscription.id,
    details: `Plan renewed (${months} month${months > 1 ? "s" : ""}) — active until ${periodEnd.toISOString().split("T")[0]}`,
  });

  res.json({ ...formatSubscription(updated), transactionRef: reference });
});

export default router;
