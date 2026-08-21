import { Router, IRouter } from "express";
import {
  db, sellerAllocationsTable, usersTable, branchesTable,
  salesTable, productionBatchesTable, productsTable, productReturnsTable,
} from "@workspace/db";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";
import crypto from "crypto";

const router: IRouter = Router();

function generateReceiptNumber(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `NMB-${dateStr}-${random}`;
}

const formatAllocation = (
  a: typeof sellerAllocationsTable.$inferSelect,
  sellerName: string,
  issuedByName: string,
  branchName: string,
  clearedByName?: string,
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
  isCleared: a.isCleared ?? false,
  clearedAt: a.clearedAt ? a.clearedAt.toISOString() : null,
  clearedById: a.clearedById ?? null,
  clearedByName: clearedByName ?? null,
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

    /* Resolve branchId: explicit body > seller's branch > issuer's branch > company default */
    const [defaultBranch] = await db
      .select({ id: branchesTable.id })
      .from(branchesTable)
      .where(eq(branchesTable.companyId, companyId))
      .limit(1);
    const branchId = (bodyBranchId ? parseInt(bodyBranchId) : null) ?? seller.branchId ?? userBranchId ?? defaultBranch?.id;
    if (!branchId) { res.status(400).json({ error: "branchId could not be determined — please select a branch" }); return; }

    /*
     * Stock check mirrors the product dashboard:
     * in-store = net produced + restorable returns - direct sales - uncleared allocations.
     * Supplier sales are already part of allocated stock and must not reduce store stock.
     */
    const [production, sales, existingAllocations, approvedReturns] = await Promise.all([
      db.select().from(productionBatchesTable).where(and(eq(productionBatchesTable.companyId, companyId), eq(productionBatchesTable.branchId, branchId), sql`lower(trim(${productionBatchesTable.breadType})) = lower(trim(${breadType}))`, isNull(productionBatchesTable.deletedAt))),
      db.select({ sale: salesTable, cashierRole: usersTable.role })
        .from(salesTable)
        .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
         .where(and(eq(salesTable.companyId, companyId), eq(salesTable.branchId, branchId), sql`lower(trim(${salesTable.breadType})) = lower(trim(${breadType}))`, isNull(salesTable.deletedAt))),
      db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.companyId, companyId), eq(sellerAllocationsTable.branchId, branchId), sql`lower(trim(${sellerAllocationsTable.breadType})) = lower(trim(${breadType}))`, isNull(sellerAllocationsTable.deletedAt), eq(sellerAllocationsTable.isCleared, false))),
      db.select().from(productReturnsTable).where(and(eq(productReturnsTable.companyId, companyId), eq(productReturnsTable.branchId, branchId), sql`lower(trim(${productReturnsTable.breadType})) = lower(trim(${breadType}))`, eq(productReturnsTable.status, "approved" as const))),
    ]);

    const totalProduced = production.reduce((s, b) => s + b.quantityProduced - b.wasteQuantity, 0);
    const directSold = sales.reduce((s, { sale, cashierRole }) => s + (cashierRole === "supplier" ? 0 : sale.quantity), 0);
    const totalAllocated = existingAllocations.reduce((s, a) => s + a.quantity, 0);
    const restorableReturned = approvedReturns.reduce(
      (sum, r) => sum + (["not_sold", "wrong_item", "other"].includes(r.reason) ? r.quantity : 0),
      0,
    );
    const remaining = totalProduced + restorableReturned - directSold - totalAllocated;

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

/* PATCH /allocations/:id/clear — company owner / manager / receptionist marks allocation cleared */
router.patch("/allocations/:id/clear", authenticate, requireRole("managing_director", "manager", "receptionist"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { userId, companyId } = req.user!;
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db
      .select()
      .from(sellerAllocationsTable)
      .where(and(eq(sellerAllocationsTable.id, id), eq(sellerAllocationsTable.companyId, companyId), isNull(sellerAllocationsTable.deletedAt)));

    if (!existing) { res.status(404).json({ error: "Allocation not found" }); return; }

    const now = new Date();
    const [updated] = await db
      .update(sellerAllocationsTable)
      .set({
        isCleared: true,
        clearedAt: now,
        clearedById: userId,
      })
      .where(eq(sellerAllocationsTable.id, id))
      .returning();

    const [[sellerRow], [branchRow], [issuerRow], [clearedByRow]] = await Promise.all([
      db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, updated.sellerId)),
      db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, updated.branchId)),
      db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, updated.issuedById)),
      db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, userId)),
    ]);

    await logAudit({
      req, userId, companyId,
      action: "ALLOCATION_CLEARED",
      entityType: "allocation",
      entityId: id,
      details: `Cleared ${updated.breadType} x${updated.quantity} for supplier ${sellerRow?.fullName ?? "Unknown"}`,
      branchId: updated.branchId,
    });

    res.json(formatAllocation(
      updated,
      sellerRow?.fullName ?? "Unknown",
      issuerRow?.fullName ?? "Unknown",
      branchRow?.name ?? "Unknown",
      clearedByRow?.fullName ?? "Unknown",
    ));
  } catch (err) {
    console.error("PATCH /allocations/:id/clear error:", err);
    res.status(500).json({ error: "Failed to clear allocation" });
  }
});

/* POST /allocations/clear-supplier — clear all active allocations for a specific supplier */
router.post("/allocations/clear-supplier", authenticate, requireRole("managing_director", "manager", "receptionist"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { userId, companyId } = req.user!;
    const { sellerId } = req.body;

    if (!sellerId) {
      res.status(400).json({ error: "sellerId is required" });
      return;
    }

    const sid = parseInt(sellerId);
    if (isNaN(sid)) {
      res.status(400).json({ error: "Invalid sellerId" });
      return;
    }

    const [seller] = await db
      .select({ fullName: usersTable.fullName })
      .from(usersTable)
      .where(and(eq(usersTable.id, sid), eq(usersTable.companyId, companyId)));

    if (!seller) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }

    const unclearedAllocations = await db
      .select()
      .from(sellerAllocationsTable)
      .where(and(
        eq(sellerAllocationsTable.sellerId, sid),
        eq(sellerAllocationsTable.companyId, companyId),
        isNull(sellerAllocationsTable.deletedAt),
        eq(sellerAllocationsTable.isCleared, false),
      ));

    if (unclearedAllocations.length === 0) {
      res.json({ success: true, clearedCount: 0, message: "No uncleared allocations found for this supplier" });
      return;
    }

    const now = new Date();
    await db
      .update(sellerAllocationsTable)
      .set({
        isCleared: true,
        clearedAt: now,
        clearedById: userId,
      })
      .where(and(
        eq(sellerAllocationsTable.sellerId, sid),
        eq(sellerAllocationsTable.companyId, companyId),
        isNull(sellerAllocationsTable.deletedAt),
        eq(sellerAllocationsTable.isCleared, false),
      ));

    await logAudit({
      req, userId, companyId,
      action: "SUPPLIER_ALLOCATIONS_CLEARED",
      entityType: "supplier_allocations",
      details: `Cleared ${unclearedAllocations.length} allocations for supplier ${seller.fullName}`,
    });

    res.json({
      success: true,
      clearedCount: unclearedAllocations.length,
      message: `Successfully cleared ${unclearedAllocations.length} allocations for ${seller.fullName}`,
    });
  } catch (err) {
    console.error("POST /allocations/clear-supplier error:", err);
    res.status(500).json({ error: "Failed to clear supplier allocations" });
  }
});

/* POST /allocations/settle-supplier — settle active allocations for a supplier, record sales, and clear allocations */
router.post("/allocations/settle-supplier", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { userId, companyId, branchId: userBranchId } = req.user!;
    const { sellerId, amountSettled, paymentMethod = "cash", notes, branchId: bodyBranchId, allocationIds } = req.body;

    if (!sellerId) {
      res.status(400).json({ error: "sellerId is required" });
      return;
    }

    const sid = parseInt(sellerId, 10);
    if (isNaN(sid)) {
      res.status(400).json({ error: "Invalid sellerId" });
      return;
    }

    const requestedAllocationIds = Array.isArray(allocationIds)
      ? [...new Set(allocationIds.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0))]
      : null;
    if (Array.isArray(allocationIds) && requestedAllocationIds?.length === 0) {
      res.status(400).json({ error: "allocationIds must contain at least one valid allocation ID" });
      return;
    }

    const [seller] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, sid), eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt)));

    if (!seller) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }

    // Find active uncleared allocations for this supplier. When allocationIds
    // are supplied, settlement is limited to the selected allocation date/group.
    const allocationConditions = [
        eq(sellerAllocationsTable.sellerId, sid),
        eq(sellerAllocationsTable.companyId, companyId),
        isNull(sellerAllocationsTable.deletedAt),
        eq(sellerAllocationsTable.isCleared, false),
      ] as Parameters<typeof and>[0][];
    if (requestedAllocationIds) {
      allocationConditions.push(inArray(sellerAllocationsTable.id, requestedAllocationIds));
    }
    const activeAllocations = await db
      .select()
      .from(sellerAllocationsTable)
      .where(and(...allocationConditions));

    if (activeAllocations.length === 0) {
      res.status(400).json({ error: "No active uncleared allocations found for this supplier" });
      return;
    }
    if (requestedAllocationIds && activeAllocations.length !== requestedAllocationIds.length) {
      res.status(409).json({ error: "One or more selected allocations are already settled or unavailable. Refresh and try again." });
      return;
    }

    // Fetch product prices to calculate normal total
    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.companyId, companyId));
    const priceMap = new Map<string, number>();
    for (const p of products) {
      priceMap.set(p.name, parseFloat(p.pricePerUnit as unknown as string) || 0);
    }

    // Group active allocations by breadType
    const byBreadType = new Map<string, { quantity: number; allocationIds: number[]; branchId: number }>();
    for (const alloc of activeAllocations) {
      const prev = byBreadType.get(alloc.breadType) ?? { quantity: 0, allocationIds: [], branchId: alloc.branchId };
      prev.quantity += alloc.quantity;
      prev.allocationIds.push(alloc.id);
      byBreadType.set(alloc.breadType, prev);
    }

    const totalAllocatedUnits = activeAllocations.reduce((s, a) => s + a.quantity, 0);
    const parsedAmountSettled = amountSettled !== undefined && amountSettled !== null && amountSettled !== ""
      ? parseFloat(amountSettled)
      : null;

    // Calculate standard total value
    let calculatedStandardTotal = 0;
    for (const [breadType, data] of byBreadType.entries()) {
      const unitPrice = priceMap.get(breadType) ?? 0;
      calculatedStandardTotal += unitPrice * data.quantity;
    }

    const finalTotalAmount = parsedAmountSettled !== null && !isNaN(parsedAmountSettled) && parsedAmountSettled >= 0
      ? parsedAmountSettled
      : calculatedStandardTotal;

    const pm = (paymentMethod === "transfer" ? "transfer" : "cash") as "cash" | "transfer";
    const [directorUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const directorName = directorUser?.fullName ?? "Managing Director";

    const { createdSales, now } = await db.transaction(async (tx) => {
      const createdSales = [];
      const now = new Date();

      // Create sales records for each bread type
      for (const [breadType, data] of byBreadType.entries()) {
        const standardPrice = priceMap.get(breadType) ?? 0;
        let itemTotalAmount: number;
        let itemPricePerUnit: number;

        if (parsedAmountSettled !== null && calculatedStandardTotal > 0) {
          // Proportionally scale the amount settled if custom total provided
          const proportion = (standardPrice * data.quantity) / calculatedStandardTotal;
          itemTotalAmount = Math.round(finalTotalAmount * proportion * 100) / 100;
          itemPricePerUnit = data.quantity > 0 ? Math.round((itemTotalAmount / data.quantity) * 100) / 100 : standardPrice;
        } else if (parsedAmountSettled !== null && calculatedStandardTotal === 0 && totalAllocatedUnits > 0) {
          itemTotalAmount = Math.round((finalTotalAmount * (data.quantity / totalAllocatedUnits)) * 100) / 100;
          itemPricePerUnit = data.quantity > 0 ? Math.round((itemTotalAmount / data.quantity) * 100) / 100 : 0;
        } else {
          itemPricePerUnit = standardPrice;
          itemTotalAmount = standardPrice * data.quantity;
        }

        const effectiveBranchId = (bodyBranchId ? parseInt(bodyBranchId, 10) : null) || data.branchId || seller.branchId || userBranchId || 1;
        const receiptNumber = generateReceiptNumber();

        const [sale] = await tx.insert(salesTable).values({
          companyId,
          receiptNumber,
          breadType,
          quantity: data.quantity,
          pricePerUnit: itemPricePerUnit.toFixed(2),
          totalAmount: itemTotalAmount.toFixed(2),
          costAmount: "0",
          profitAmount: itemTotalAmount.toFixed(2),
          paymentMethod: pm,
          cashierId: sid, // Credited to the supplier!
          branchId: effectiveBranchId,
          notes: notes ? `[Settled by ${directorName}] ${notes}` : `Settled by ${directorName}`,
          saleDate: now,
        }).returning();

        createdSales.push(sale);
      }

      // Mark exactly the selected active allocations as cleared.
      await tx
        .update(sellerAllocationsTable)
        .set({
          isCleared: true,
          clearedAt: now,
          clearedById: userId,
        })
        .where(and(...allocationConditions));

      return { createdSales, now };
    });

    await logAudit({
      req,
      userId,
      companyId,
      action: "SUPPLIER_SETTLED",
      entityType: "supplier_settlement",
      details: `Settled ${totalAllocatedUnits} units (₦${finalTotalAmount.toLocaleString()})${requestedAllocationIds ? " for selected allocation date" : ""} for supplier ${seller.fullName} by ${directorName}`,
      branchId: seller.branchId ?? userBranchId ?? undefined,
    });

    res.json({
      success: true,
      message: `Successfully settled ₦${finalTotalAmount.toLocaleString()} (${totalAllocatedUnits} units) for ${seller.fullName}`,
      settledAmount: finalTotalAmount,
      totalUnits: totalAllocatedUnits,
      salesCount: createdSales.length,
      clearedAllocationsCount: activeAllocations.length,
    });
  } catch (err) {
    console.error("POST /allocations/settle-supplier error:", err);
    res.status(500).json({ error: "Failed to process supplier settlement" });
  }
});

/* POST /allocations/:id/settle — settle a specific single allocation */
router.post("/allocations/:id/settle", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { userId, companyId, branchId: userBranchId } = req.user!;
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { amountSettled, paymentMethod = "cash", notes } = req.body;

    const [allocation] = await db
      .select()
      .from(sellerAllocationsTable)
      .where(and(
        eq(sellerAllocationsTable.id, id),
        eq(sellerAllocationsTable.companyId, companyId),
        isNull(sellerAllocationsTable.deletedAt),
      ));

    if (!allocation) { res.status(404).json({ error: "Allocation not found" }); return; }
    if (allocation.isCleared) { res.status(400).json({ error: "Allocation is already cleared/settled" }); return; }

    const [[seller], [directorUser], [product]] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, allocation.sellerId)),
      db.select().from(usersTable).where(eq(usersTable.id, userId)),
      db.select().from(productsTable).where(and(eq(productsTable.companyId, companyId), eq(productsTable.name, allocation.breadType))),
    ]);

    const directorName = directorUser?.fullName ?? "Managing Director";
    const standardPrice = product ? parseFloat(product.pricePerUnit as unknown as string) : 0;
    const standardTotal = standardPrice * allocation.quantity;

    const parsedAmount = amountSettled !== undefined && amountSettled !== null && amountSettled !== ""
      ? parseFloat(amountSettled)
      : null;
    const finalAmount = parsedAmount !== null && !isNaN(parsedAmount) && parsedAmount >= 0 ? parsedAmount : standardTotal;
    const unitPrice = allocation.quantity > 0 ? finalAmount / allocation.quantity : standardPrice;
    const pm = (paymentMethod === "transfer" ? "transfer" : "cash") as "cash" | "transfer";
    const now = new Date();
    const receiptNumber = generateReceiptNumber();

    const [sale] = await db.insert(salesTable).values({
      companyId,
      receiptNumber,
      breadType: allocation.breadType,
      quantity: allocation.quantity,
      pricePerUnit: unitPrice.toFixed(2),
      totalAmount: finalAmount.toFixed(2),
      costAmount: "0",
      profitAmount: finalAmount.toFixed(2),
      paymentMethod: pm,
      cashierId: allocation.sellerId,
      branchId: allocation.branchId || seller?.branchId || userBranchId || 1,
      notes: notes ? `[Settled by ${directorName}] ${notes}` : `Settled by ${directorName}`,
      saleDate: now,
    }).returning();

    const [updated] = await db
      .update(sellerAllocationsTable)
      .set({
        isCleared: true,
        clearedAt: now,
        clearedById: userId,
      })
      .where(eq(sellerAllocationsTable.id, id))
      .returning();

    await logAudit({
      req,
      userId,
      companyId,
      action: "SUPPLIER_SETTLED",
      entityType: "allocation",
      entityId: id,
      details: `Settled ${allocation.breadType} x${allocation.quantity} (₦${finalAmount.toLocaleString()}) for supplier ${seller?.fullName ?? "Unknown"} by ${directorName}`,
      branchId: allocation.branchId,
    });

    res.json({
      success: true,
      allocation: updated,
      sale,
      message: `Settled ₦${finalAmount.toLocaleString()} for ${allocation.breadType} (x${allocation.quantity})`,
    });
  } catch (err) {
    console.error("POST /allocations/:id/settle error:", err);
    res.status(500).json({ error: "Failed to settle allocation" });
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
