import { Router, IRouter } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

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

  // Auto-expire trial if past trialEndsAt
  if (subscription.status === "trial" && subscription.trialEndsAt && new Date() > subscription.trialEndsAt) {
    const [updated] = await db.update(subscriptionsTable).set({ status: "expired" }).where(eq(subscriptionsTable.id, subscription.id)).returning();
    res.json(formatSubscription(updated));
    return;
  }

  res.json(formatSubscription(subscription));
});

// Manual renewal (placeholder — connect to Paystack in production)
router.post("/subscription/renew", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  if (!subscription) { res.status(404).json({ error: "No subscription found" }); return; }

  const now = new Date();
  const periodStart = now;
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

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
    details: `Plan renewed — active until ${periodEnd.toISOString().split("T")[0]}`,
  });

  res.json(formatSubscription(updated));
});

export default router;
