import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companyRouter from "./company";
import subscriptionsRouter from "./subscriptions";
import usersRouter from "./users";
import branchesRouter from "./branches";
import productionRouter from "./production";
import inventoryRouter from "./inventory";
import salesRouter from "./sales";
import reportsRouter from "./reports";
import auditLogsRouter from "./auditLogs";
import adminRouter from "./admin";
import productsRouter from "./products";
import allocationsRouter from "./allocations";
import { verifyToken } from "../lib/auth";
import { db, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

/* ─────────────────────── Subscription enforcement ─────────────────────── */
// Routes exempt from subscription checking entirely
const EXEMPT_PREFIXES = [
  "/auth/", "/login", "/register",
  "/subscription",
  "/admin",
  "/health",
  "/company",
  "/branches",
];

// Write methods that are blocked for expired subscriptions
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

async function subscriptionGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const path = req.path;

  // Skip exempt paths entirely
  if (EXEMPT_PREFIXES.some(p => path.startsWith(p))) {
    next(); return;
  }

  // GET requests: always allow — expired users can view their data (read-only mode)
  if (!WRITE_METHODS.includes(req.method)) {
    next(); return;
  }

  // From here: only checking write operations
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { next(); return; }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload?.companyId) { next(); return; }

  try {
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.companyId, payload.companyId));

    if (!sub) {
      res.status(402).json({ error: "No subscription found.", code: "NO_SUBSCRIPTION" });
      return;
    }

    const now = new Date();

    // Auto-expire trial
    if (sub.status === "trial" && sub.trialEndsAt && now > sub.trialEndsAt) {
      await db.update(subscriptionsTable).set({ status: "expired" }).where(eq(subscriptionsTable.id, sub.id));
      res.status(402).json({ error: "Your trial has expired. Please renew your subscription.", code: "SUBSCRIPTION_EXPIRED" });
      return;
    }

    // Auto-expire active plan
    if (sub.status === "active" && sub.currentPeriodEnd && now > sub.currentPeriodEnd) {
      await db.update(subscriptionsTable).set({ status: "expired" }).where(eq(subscriptionsTable.id, sub.id));
      res.status(402).json({ error: "Your subscription has expired. Please renew to continue.", code: "SUBSCRIPTION_EXPIRED" });
      return;
    }

    if (sub.status === "expired") {
      res.status(402).json({ error: "Subscription expired. Renew to make changes.", code: "SUBSCRIPTION_EXPIRED" });
      return;
    }

    next();
  } catch {
    next(); // fail open — don't block if DB error
  }
}

router.use(subscriptionGuard);

/* ─────────────────────── Route registration ─────────────────────── */
router.use(healthRouter);
router.use(authRouter);
router.use(companyRouter);
router.use(subscriptionsRouter);
router.use(usersRouter);
router.use(branchesRouter);
router.use(productionRouter);
router.use(inventoryRouter);
router.use(salesRouter);
router.use(reportsRouter);
router.use(auditLogsRouter);
router.use(productsRouter);
router.use(allocationsRouter);
router.use(adminRouter);

export default router;
