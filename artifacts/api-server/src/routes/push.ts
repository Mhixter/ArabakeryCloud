import { Router, IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate, AuthenticatedRequest } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/push/vapid-public-key", (_req, res): void => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    res.status(503).json({ error: "Push notifications not configured" });
    return;
  }
  res.json({ publicKey: key });
});

router.post("/push/subscribe", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, companyId } = req.user!;
  const { endpoint, keys } = req.body as { endpoint: string; keys?: { p256dh: string; auth: string } };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "endpoint, keys.p256dh, and keys.auth are required" });
    return;
  }

  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({ userId, companyId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { userId, companyId, p256dh: keys.p256dh, auth: keys.auth },
      });

    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

router.post("/push/unsubscribe", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId } = req.user!;
  const { endpoint } = req.body as { endpoint: string };

  if (!endpoint) {
    res.status(400).json({ error: "endpoint is required" });
    return;
  }

  await db
    .delete(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, userId)));

  res.json({ ok: true });
});

export default router;
