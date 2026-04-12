import { Router, IRouter } from "express";
import { db, companiesTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

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

router.get("/company", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }

  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));

  res.json({
    ...formatCompany(company),
    subscription: subscription ? {
      status: subscription.status,
      plan: subscription.plan,
      priceMonthly: parseFloat(subscription.priceMonthly as unknown as string),
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    } : null,
  });
});

router.patch("/company", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { name, phone, address, themeColor, logoUrl } = req.body;

  const updates: Partial<typeof companiesTable.$inferInsert> = {};
  if (name != null) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (themeColor != null) updates.themeColor = themeColor;
  if (logoUrl !== undefined) updates.logoUrl = logoUrl;

  const [company] = await db.update(companiesTable).set(updates).where(eq(companiesTable.id, companyId)).returning();
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }

  await logAudit({
    req,
    userId: req.user!.userId,
    companyId,
    action: "COMPANY_UPDATED",
    entityType: "company",
    entityId: companyId,
    details: `Updated fields: ${Object.keys(updates).join(", ")}`,
  });

  res.json(formatCompany(company));
});

export default router;
