import { Response, NextFunction } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AuthenticatedRequest } from "./authMiddleware";

export async function requireActiveSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.companyId, companyId));

    if (!sub) {
      res.status(402).json({ error: "No subscription found", code: "NO_SUBSCRIPTION" });
      return;
    }

    const now = new Date();

    // Auto-expire trial
    if (sub.status === "trial" && sub.trialEndsAt && now > sub.trialEndsAt) {
      await db
        .update(subscriptionsTable)
        .set({ status: "expired" })
        .where(eq(subscriptionsTable.id, sub.id));
      res.status(402).json({ error: "Trial has expired. Please renew your subscription.", code: "TRIAL_EXPIRED" });
      return;
    }

    // Check active period expiry
    if (sub.status === "active" && sub.currentPeriodEnd && now > sub.currentPeriodEnd) {
      await db
        .update(subscriptionsTable)
        .set({ status: "expired" })
        .where(eq(subscriptionsTable.id, sub.id));
      res.status(402).json({ error: "Subscription has expired. Please renew to continue.", code: "SUBSCRIPTION_EXPIRED" });
      return;
    }

    if (sub.status === "expired") {
      res.status(402).json({ error: "Subscription expired. Please renew to continue.", code: "SUBSCRIPTION_EXPIRED" });
      return;
    }

    next();
  } catch {
    next();
  }
}
