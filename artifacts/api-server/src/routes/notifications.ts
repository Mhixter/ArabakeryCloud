import { Router, IRouter } from "express";
import { db, inventoryItemsTable, notificationsTable, sellerAllocationsTable, subscriptionsTable, usersTable, branchesTable } from "@workspace/db";
import { eq, and, isNull, gte, desc } from "drizzle-orm";
import { authenticate, AuthenticatedRequest, rateLimitByUser } from "../middlewares/authMiddleware";

const router: IRouter = Router();
const ENTITY_LINKS: Record<string, string> = {
  allocation: "/allocations",
  sale: "/sales",
  production: "/production",
  expense: "/expenses",
  inventory: "/inventory",
};

interface Notification {
  id: string;
  type: "warning" | "info" | "danger" | "success";
  category: "inventory" | "subscription" | "allocation" | "activity";
  title: string;
  message: string;
  link?: string;
  createdAt: string;
  isRead?: boolean;
}

router.get("/notifications", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId, userId, role } = req.user!;
  const notifications: Notification[] = [];
  const now = new Date();

  try {
    const storedNotifications = await db
      .select()
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.companyId, companyId),
        eq(notificationsTable.recipientUserId, userId),
      ))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(100);

    notifications.push(...storedNotifications.map((n) => ({
      id: `db-${n.id}`,
      type: "info",
      category: "activity" as const,
      title: n.title,
      message: n.message,
      link: n.entityType ? ENTITY_LINKS[n.entityType] : undefined,
      createdAt: n.createdAt.toISOString(),
      isRead: n.isRead,
    })));

    /* ── 1. Low-stock inventory alerts (MD, manager, production_staff) ── */
    if (["managing_director", "manager", "production_staff"].includes(role)) {
      const items = await db
        .select({ item: inventoryItemsTable, branchName: branchesTable.name })
        .from(inventoryItemsTable)
        .leftJoin(branchesTable, eq(inventoryItemsTable.branchId, branchesTable.id))
        .where(and(eq(inventoryItemsTable.companyId, companyId), isNull(inventoryItemsTable.deletedAt)));

      const lowStock = items.filter(({ item }) =>
        parseFloat(item.currentQuantity as unknown as string) <= parseFloat(item.minimumQuantity as unknown as string),
      );

      if (lowStock.length > 0) {
        notifications.push({
          id: "low-stock-summary",
          type: "danger",
          category: "inventory",
          title: `${lowStock.length} item${lowStock.length > 1 ? "s" : ""} low on stock`,
          message: lowStock.slice(0, 3).map(({ item, branchName }) =>
            `${item.name}${branchName ? ` (${branchName})` : ""}`,
          ).join(", ") + (lowStock.length > 3 ? ` and ${lowStock.length - 3} more` : ""),
          link: "/inventory",
          createdAt: now.toISOString(),
        });
      }
    }

    /* ── 2. Subscription expiry warning (MD only) ── */
    if (role === "managing_director") {
      const [sub] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.companyId, companyId));

      if (sub) {
        const expiryDate = sub.status === "trial" ? sub.trialEndsAt : sub.currentPeriodEnd;
        if (expiryDate) {
          const msLeft = new Date(expiryDate).getTime() - now.getTime();
          const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

          if (sub.status === "expired") {
            notifications.push({
              id: "sub-expired",
              type: "danger",
              category: "subscription",
              title: "Subscription expired",
              message: "Your subscription has expired. Renew now to continue using all features.",
              link: "/subscription",
              createdAt: now.toISOString(),
            });
          } else if (daysLeft <= 7 && daysLeft > 0) {
            notifications.push({
              id: `sub-expiring-${daysLeft}`,
              type: daysLeft <= 2 ? "danger" : "warning",
              category: "subscription",
              title: `Subscription expiring in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
              message: `Your ${sub.status === "trial" ? "free trial" : "subscription"} ends on ${new Date(expiryDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}.`,
              link: "/subscription",
              createdAt: now.toISOString(),
            });
          }
        }
      }
    }

    /* ── 3. Recent allocations assigned to me today (supplier, receptionist) ── */
    if (["supplier", "receptionist", "manager", "managing_director"].includes(role)) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const myAllocations = await db
        .select({
          id: sellerAllocationsTable.id,
          breadType: sellerAllocationsTable.breadType,
          quantity: sellerAllocationsTable.quantity,
          allocationDate: sellerAllocationsTable.allocationDate,
          issuedByName: usersTable.fullName,
        })
        .from(sellerAllocationsTable)
        .leftJoin(usersTable, eq(sellerAllocationsTable.issuedById, usersTable.id))
        .where(
          and(
            eq(sellerAllocationsTable.companyId, companyId),
            eq(sellerAllocationsTable.sellerId, userId),
            isNull(sellerAllocationsTable.deletedAt),
            gte(sellerAllocationsTable.allocationDate, todayStart),
          ),
        );

      if (myAllocations.length > 0) {
        const total = myAllocations.reduce((sum, a) => sum + a.quantity, 0);
        notifications.push({
          id: `alloc-today-${myAllocations.length}`,
          type: "info",
          category: "allocation",
          title: `${myAllocations.length} allocation${myAllocations.length > 1 ? "s" : ""} assigned today`,
          message: `${total} unit${total > 1 ? "s" : ""} total — ${myAllocations.slice(0, 2).map(a => a.breadType).join(", ")}${myAllocations.length > 2 ? " and more" : ""}`,
          link: "/allocations",
          createdAt: now.toISOString(),
        });
      }
    }

    res.json(notifications);
  } catch {
    res.json([]);
  }
});

router.patch("/notifications/:id/read", authenticate, rateLimitByUser(), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId, userId } = req.user!;
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid notification id" });
      return;
    }

    const [updated] = await db
      .update(notificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.companyId, companyId),
        eq(notificationsTable.recipientUserId, userId),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

router.post("/notifications/read-all", authenticate, rateLimitByUser(), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId, userId } = req.user!;
    await db
      .update(notificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notificationsTable.companyId, companyId),
        eq(notificationsTable.recipientUserId, userId),
        eq(notificationsTable.isRead, false),
      ));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

export default router;
