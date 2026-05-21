import { Router, IRouter } from "express";
import {
  db, sellerAllocationsTable, usersTable, branchesTable,
  salesTable, productionBatchesTable, productsTable,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const formatAllocation = (
  a: typeof sellerAllocationsTable.$inferSelect,
  sellerName: string,
  issuedByName: string,
  branchName: string,
) => ({
  id: a.id,
  companyId: a.companyId,
  branchId: a.branchId,
  branchName,
  sellerId: a.sellerId,
  sellerName,
  issuedById: a.issuedById,
  issuedByName,
  breadType: a.breadType,
  quantity: a.quantity,
  notes: a.notes,
  allocationDate: a.allocationDate.toISOString(),
  createdAt: a.createdAt.toISOString(),
});

/* GET /allocations/sellers — list sellers for dropdown (must come before :id routes) */
router.get("/allocations/sellers", authenticate, requireRole("managing_director", "manager", "receptionist"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const conditions = [
      eq(usersTable.companyId, companyId),
      eq(usersTable.role, "supplier" as const),
      isNull(usersTable.deletedAt),
      eq(usersTable.isActive, true),
    ] as Parameters<typeof and>[0][];

    const sellers = await db
      .select({ id: usersTable.id, fullName: usersTable.fullName, agentId: usersTable.agentId, branchId: usersTable.branchId })
      .from(usersTable)
      .where(and(...conditions));
    res.json(sellers);
  } catch (err) {
    console.error("GET /allocations/sellers error:", err);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

/* GET /allocations */
router.get("/allocations", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { userId, role, companyId, branchId: userBranchId } = req.user!;
    const { branchId: queryBranchId } = req.query as { branchId?: string };

    const conditions = [
      isNull(sellerAllocationsTable.deletedAt),
      eq(sellerAllocationsTable.companyId, companyId),
    ] as Parameters<typeof and>[0][];

    if (role === "supplier") {
      conditions.push(eq(sellerAllocationsTable.sellerId, userId));
    } else {
      const branchFilter = queryBranchId && !isNaN(parseInt(queryBranchId))
        ? parseInt(queryBranchId)
        : (role !== "managing_director" ? userBranchId : null);
      if (branchFilter) conditions.push(eq(sellerAllocationsTable.branchId, branchFilter));
    }

    const rows = await db
      .select({
        allocation: sellerAllocationsTable,
        sellerName: usersTable.fullName,
        branchName: branchesTable.name,
      })
      .from(sellerAllocationsTable)
      .leftJoin(usersTable, eq(sellerAllocationsTable.sellerId, usersTable.id))
      .leftJoin(branchesTable, eq(sellerAllocationsTable.branchId, branchesTable.id))
      .where(and(...conditions))
      .orderBy(sellerAllocationsTable.allocationDate);

    const companyUsers = await db
      .select({ id: usersTable.id, fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.companyId, companyId));
    const issuerMap = new Map(companyUsers.map(u => [u.id, u.fullName]));

    res.json(rows.map(({ allocation, sellerName, branchName }) =>
      formatAllocation(
        allocation,
        sellerName ?? "Unknown",
        issuerMap.get(allocation.issuedById) ?? "Unknown",
        branchName ?? "Unknown",
      ),
    ));
  } catch (err) {
    console.error("GET /allocations error:", err);
    res.status(500).json({ error: "Failed to fetch allocations" });
  }
});

/* POST /allocations */
router.post("/allocations", authenticate, requireRole("managing_director", "manager", "receptionist"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { userId: issuedById, companyId, branchId: userBranchId } = req.user!;
    const { sellerId, breadType, quantity, branchId: bodyBranchId, notes } = req.body;

    if (!sellerId || !breadType || !quantity) {
      res.status(400).json({ error: "sellerId, breadType, and quantity are required" }); return;
    }

    const [seller] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, parseInt(sellerId)), eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt)));

    if (!seller) { res.status(404).json({ error: "Supplier not found" }); return; }
    if (seller.role !== "supplier") { res.status(400).json({ error: "Selected user is not a supplier" }); return; }

    /* Resolve branchId: explicit body > seller's branch > issuer's branch */
    const branchId = (bodyBranchId ? parseInt(bodyBranchId) : null) ?? seller.branchId ?? userBranchId;
    if (!branchId) { res.status(400).json({ error: "branchId could not be determined — please select a branch" }); return; }

    /* Stock check: produced - sold - already allocated */
    const [production, sales, existingAllocations] = await Promise.all([
      db.select().from(productionBatchesTable).where(and(eq(productionBatchesTable.companyId, companyId), eq(productionBatchesTable.breadType, breadType), isNull(productionBatchesTable.deletedAt))),
      db.select().from(salesTable).where(and(eq(salesTable.companyId, companyId), eq(salesTable.breadType, breadType), isNull(salesTable.deletedAt))),
      db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.companyId, companyId), eq(sellerAllocationsTable.breadType, breadType), isNull(sellerAllocationsTable.deletedAt))),
    ]);

    const totalProduced = production.reduce((s, b) => s + b.quantityProduced - b.wasteQuantity, 0);
    const totalSold = sales.reduce((s, s2) => s + s2.quantity, 0);
    const totalAllocated = existingAllocations.reduce((s, a) => s + a.quantity, 0);
    const remaining = totalProduced - totalSold - totalAllocated;

    if (parseInt(quantity) > remaining) {
      res.status(400).json({
        error: remaining <= 0
          ? `No stock available for "${breadType}". Record production first.`
          : `Only ${remaining} unit${remaining !== 1 ? "s" : ""} of "${breadType}" available to allocate.`,
      }); return;
    }

    const [allocation] = await db.insert(sellerAllocationsTable).values({
      companyId, branchId, sellerId: parseInt(sellerId), issuedById,
      breadType, quantity: parseInt(quantity), notes: notes ?? null,
      allocationDate: new Date(),
    }).returning();

    const [[sellerRow], [branchRow], [issuerRow]] = await Promise.all([
      db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, allocation.sellerId)),
      db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, allocation.branchId)),
      db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, allocation.issuedById)),
    ]);

    await logAudit({ req, userId: issuedById, companyId, action: "ALLOCATION_CREATED", entityType: "allocation", entityId: allocation.id, details: `Allocated ${quantity}x ${breadType} to ${sellerRow?.fullName}`, branchId });
    res.status(201).json(formatAllocation(allocation, sellerRow?.fullName ?? "Unknown", issuerRow?.fullName ?? "Unknown", branchRow?.name ?? "Unknown"));
  } catch (err) {
    console.error("POST /allocations error:", err);
    res.status(500).json({ error: "Failed to create allocation" });
  }
});

/* DELETE /allocations/:id */
router.delete("/allocations/:id", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { userId, companyId, role } = req.user!;
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.id, id), eq(sellerAllocationsTable.companyId, companyId), isNull(sellerAllocationsTable.deletedAt)));
    if (!existing) { res.status(404).json({ error: "Allocation not found" }); return; }
    if (role !== "managing_director" && existing.issuedById !== userId) {
      res.status(403).json({ error: "Only the issuer or admin can cancel this allocation" }); return;
    }

    await db.update(sellerAllocationsTable).set({ deletedAt: new Date() }).where(eq(sellerAllocationsTable.id, id));
    await logAudit({ req, userId, companyId, action: "ALLOCATION_CANCELLED", entityType: "allocation", entityId: id, details: `Cancelled ${existing.breadType} x${existing.quantity}`, branchId: existing.branchId });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /allocations/:id error:", err);
    res.status(500).json({ error: "Failed to cancel allocation" });
  }
});

export default router;
