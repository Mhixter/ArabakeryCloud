import { Router, IRouter } from "express";
import { db, salesTable, usersTable, branchesTable, productsTable, productionBatchesTable, sellerAllocationsTable, productReturnsTable, quickSaleSettlementsTable } from "@workspace/db";
import { eq, and, isNull, gte, lte, or, sql } from "drizzle-orm";
import { authenticate, AuthenticatedRequest, requireRole } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";
import { notifyManagers } from "../lib/push";
import { businessDateFor, businessDateRange, queryDateRange } from "../lib/business-date";
import crypto from "crypto";

const router: IRouter = Router();

/* Director-created sales are private operational entries, not customer-facing
 * sales. Keep this rule server-side so every client gets the same visibility. */
function visibleSaleForUsers() {
  return or(isNull(usersTable.role), sql`${usersTable.role} <> 'managing_director'`);
}

function normalizeWeekStart(value?: string) {
  const date = value ? new Date(`${value}T12:00:00Z`) : new Date();
  if (isNaN(date.getTime())) return null;
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function addBusinessDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

const formatSale = (
  s: typeof salesTable.$inferSelect,
  cashierName: string,
  branchName: string,
  cashierRole?: string,
  branchPhone?: string | null,
  branchAddress?: string | null,
) => ({
  id: s.id,
  receiptNumber: s.receiptNumber,
  productId: s.productId,
  breadType: s.breadType,
  quantity: s.quantity,
  pricePerUnit: parseFloat(s.pricePerUnit as unknown as string),
  totalAmount: parseFloat(s.totalAmount as unknown as string),
  costAmount: parseFloat(s.costAmount as unknown as string),
  profitAmount: parseFloat(s.profitAmount as unknown as string),
  paymentMethod: s.paymentMethod,
  cashierId: s.cashierId,
  cashierName,
  cashierRole: cashierRole ?? null,
  branchId: s.branchId,
  branchName,
  branchPhone: branchPhone ?? null,
  branchAddress: branchAddress ?? null,
  notes: s.notes,
  saleDate: s.saleDate.toISOString(),
  createdAt: s.createdAt.toISOString(),
});

function generateReceiptNumber(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `NMB-${dateStr}-${random}`;
}

router.get("/quick-sale-settlements", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const businessDate = String(req.body.businessDate ?? "");
  const branchId = req.body.branchId ? parseInt(String(req.body.branchId)) : req.user!.branchId;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate) || !branchId) { res.status(400).json({ error: "A valid business date and branch are required" }); return; }
  try {
    const range = businessDateRange(businessDate);
    const rows = await db.select({ sale: salesTable, cashierName: usersTable.fullName })
      .from(salesTable).leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
      .where(and(
        eq(salesTable.companyId, req.user!.companyId), eq(salesTable.branchId, branchId),
        eq(usersTable.role, "manager" as const), isNull(salesTable.deletedAt),
        sql`lower(trim(${salesTable.breadType})) = 'quick sale'`,
        gte(salesTable.saleDate, range.start), lte(salesTable.saleDate, range.end),
      ));
    const byDate = new Map<string, { amount: number; count: number; entries: { id: number; amount: number; paymentMethod: string; recordedBy: string; saleDate: string; notes: string | null }[] }>();
    byDate.set(businessDate, { amount: 0, count: 0, entries: [] });
    for (const row of rows) {
      const date = businessDateFor(row.sale.saleDate);
    const day = byDate.get(businessDate)!;
      if (!day) continue;
      const amount = Number(row.sale.totalAmount);
      day.amount += amount;
      day.count += 1;
      day.entries.push({ id: row.sale.id, amount, paymentMethod: row.sale.paymentMethod, recordedBy: row.cashierName ?? "Manager", saleDate: row.sale.saleDate.toISOString(), notes: row.sale.notes });
    }
    const [accepted] = await db.transaction(async tx => {
      let settlement = existing;
      if (!settlement) {
        [settlement] = await tx.insert(quickSaleSettlementsTable).values({
          companyId: req.user!.companyId, branchId, weekStart: businessDate, weekEnd: businessDate, businessDate, amount: totalAmount.toFixed(2),
          paymentMethod, notes: req.body.notes ? String(req.body.notes).trim() : null, acceptedById: req.user!.userId,
        }).returning();
      }
      if (stockClearingRows.length > 0) await tx.insert(salesTable).values(stockClearingRows);
      const [updated] = await tx.update(quickSaleSettlementsTable).set({
        stockClearedAt: new Date(),
        stockClearedProducts: stockClearingRows.length,
      }).where(eq(quickSaleSettlementsTable.id, settlement.id)).returning();
      return [updated];
    });
    const day = byDate.get(businessDate)!;
    res.json({ businessDate, branchId, day: { date: businessDate, ...day }, totalAmount: day.amount, accepted: accepted ? { ...accepted, amount: Number(accepted.amount) } : null });
  } catch (err) {
    console.error("GET /quick-sale-settlements error:", err);
    res.status(500).json({ error: "Failed to load quick sale settlements" });
  }
});

router.post("/quick-sale-settlements/accept", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const businessDate = String(req.body.businessDate ?? "");
  const branchId = req.body.branchId ? parseInt(String(req.body.branchId)) : req.user!.branchId;
  const paymentMethod = req.body.paymentMethod === "transfer" ? "transfer" : "cash";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate) || !branchId) { res.status(400).json({ error: "A valid business date and branch are required" }); return; }
  try {
    const range = businessDateRange(businessDate);
    const quickSales = await db.select({ sale: salesTable }).from(salesTable)
      .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
      .where(and(
        eq(salesTable.companyId, req.user!.companyId), eq(salesTable.branchId, branchId),
        eq(usersTable.role, "manager" as const), isNull(salesTable.deletedAt),
        sql`lower(trim(${salesTable.breadType})) = 'quick sale'`,
        gte(salesTable.saleDate, range.start), lte(salesTable.saleDate, range.end),
      ));
  const totalAmount = parseFloat(amount);
    if (totalAmount <= 0) { res.status(400).json({ error: "There are no manager Quick Sales to accept for this day" }); return; }
    const [existing] = await db.select().from(quickSaleSettlementsTable).where(and(
      eq(quickSaleSettlementsTable.companyId, req.user!.companyId), eq(quickSaleSettlementsTable.branchId, branchId), eq(quickSaleSettlementsTable.businessDate, businessDate),
    ));
    if (existing?.stockClearedAt) { res.status(400).json({ error: "This day has already been accepted and stock was cleared" }); return; }

    /*
     * A daily Quick Sale acceptance also hands over all remaining physical
     * stock in the selected branch. Quick Sale itself is amount-only, so the
     * stock handover is represented by zero-revenue product sales. This keeps
     * the stock ledger balanced without counting the accepted cash twice as
     * revenue, and supplier allocations remain untouched.
     */
    const [activeProducts, production, stockSales, approvedReturns, activeAllocations] = await Promise.all([
      db.select().from(productsTable).where(and(
        eq(productsTable.companyId, req.user!.companyId),
        eq(productsTable.isActive, true),
        or(eq(productsTable.branchId, branchId), isNull(productsTable.branchId)),
      )),
      db.select().from(productionBatchesTable).where(and(
        eq(productionBatchesTable.companyId, req.user!.companyId),
        eq(productionBatchesTable.branchId, branchId),
        isNull(productionBatchesTable.deletedAt),
        lte(productionBatchesTable.productionDate, range.end),
      )),
      db.select({ sale: salesTable, cashierRole: usersTable.role })
        .from(salesTable)
        .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
        .where(and(
          eq(salesTable.companyId, req.user!.companyId),
          eq(salesTable.branchId, branchId),
          isNull(salesTable.deletedAt),
           lte(salesTable.saleDate, range.end),
        )),
      db.select().from(productReturnsTable).where(and(
        eq(productReturnsTable.companyId, req.user!.companyId),
        eq(productReturnsTable.branchId, branchId),
        eq(productReturnsTable.status, "approved" as const),
        lte(productReturnsTable.returnDate, range.end),
      )),
      db.select().from(sellerAllocationsTable).where(and(
        eq(sellerAllocationsTable.companyId, req.user!.companyId),
        eq(sellerAllocationsTable.branchId, branchId),
        isNull(sellerAllocationsTable.deletedAt),
        eq(sellerAllocationsTable.isCleared, false),
        lte(sellerAllocationsTable.allocationDate, range.end),
      )),
    ]);

    const nameKey = (value: string) => value.trim().toLowerCase();
    const addToMap = (map: Map<string, number>, productId: number | null, breadType: string, quantity: number) => {
      const key = productId == null ? `legacy:${nameKey(breadType)}` : `product:${productId}`;
      map.set(key, (map.get(key) ?? 0) + quantity);
    };
    const sumForProduct = (map: Map<string, number>, product: typeof productsTable.$inferSelect) =>
      (map.get(`product:${product.id}`) ?? 0) + (map.get(`legacy:${nameKey(product.name)}`) ?? 0);

    const producedByProduct = new Map<string, number>();
    for (const row of production) addToMap(producedByProduct, row.productId, row.breadType, row.quantityProduced - row.wasteQuantity);

    const directSalesByProduct = new Map<string, number>();
    for (const { sale, cashierRole } of stockSales) {
      if (cashierRole !== "supplier" && sale.breadType.trim().toLowerCase() !== "quick sale") {
        addToMap(directSalesByProduct, sale.productId, sale.breadType, sale.quantity);
      }
    }

    const restoredByProduct = new Map<string, number>();
    for (const row of approvedReturns) {
      if (["not_sold", "wrong_item", "other"].includes(row.reason)) {
        addToMap(restoredByProduct, row.productId, row.breadType, row.quantity);
      }
    }

    const allocatedByProduct = new Map<string, number>();
    for (const row of activeAllocations) addToMap(allocatedByProduct, row.productId, row.breadType, row.quantity);

    const stockClearingRows = activeProducts.flatMap(product => {
      const remaining = Math.max(0,
        sumForProduct(producedByProduct, product)
        + sumForProduct(restoredByProduct, product)
        - sumForProduct(directSalesByProduct, product)
        - sumForProduct(allocatedByProduct, product),
      );
      if (remaining <= 0) return [];
      return [{
        companyId: req.user!.companyId,
        receiptNumber: generateReceiptNumber(),
        productId: product.id,
        breadType: product.name,
        quantity: remaining,
        pricePerUnit: "0",
        totalAmount: "0",
        costAmount: "0",
        profitAmount: "0",
        paymentMethod,
        cashierId: req.user!.userId,
        branchId,
        notes: `[Quick Sale stock settlement] ${req.body.notes ? String(req.body.notes).trim() : "Remaining in-store stock cleared"}`,
         saleDate: range.end,
      }];
    });

    const [accepted] = await db.transaction(async tx => {
      let settlement = existing;
      if (!settlement) {
        [settlement] = await tx.insert(quickSaleSettlementsTable).values({
          companyId: req.user!.companyId, branchId, weekStart: businessDate, weekEnd: businessDate, businessDate, amount: totalAmount.toFixed(2),
          paymentMethod, notes: req.body.notes ? String(req.body.notes).trim() : null, acceptedById: req.user!.userId,
        }).returning();
      }
      if (stockClearingRows.length > 0) await tx.insert(salesTable).values(stockClearingRows);
      const [updated] = await tx.update(quickSaleSettlementsTable).set({
        stockClearedAt: new Date(),
        stockClearedProducts: stockClearingRows.length,
      }).where(eq(quickSaleSettlementsTable.id, settlement.id)).returning();
      return [updated];
    });
     await logAudit({ req, userId: req.user!.userId, companyId: req.user!.companyId, action: "QUICK_SALE_DAY_ACCEPTED", entityType: "quick_sale_settlement", entityId: accepted.id, details: `Accepted ₦${totalAmount.toLocaleString()} manager Quick Sales for ${businessDate}`, branchId });
     await logAudit({ req, userId: req.user!.userId, companyId: req.user!.companyId, action: "IN_STOCK_SETTLED", entityType: "quick_sale_settlement", entityId: accepted.id, details: `Cleared ${stockClearingRows.length} product stock balances for ${businessDate}; supplier allocations unchanged`, branchId });
    res.json({ success: true, settlement: { ...accepted, amount: Number(accepted.amount) }, stockClearedProducts: stockClearingRows.length });
  } catch (err) {
    console.error("POST /quick-sale-settlements/accept error:", err);
     res.status(500).json({ error: "Failed to accept daily Quick Sale settlement" });
  }
});

router.get("/sales", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId, branchId: userBranchId } = req.user!;
  const { branchId, startDate, endDate } = req.query as { branchId?: string; startDate?: string; endDate?: string };

  const conditions = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), visibleSaleForUsers(), gte(salesTable.saleDate, startOfDay), lte(salesTable.saleDate, endOfDay)];

  if (role === "supplier") {
    /* Sellers only see their own sales */
    conditions.push(eq(salesTable.cashierId, userId));
  } else {
    /* Others filtered by branch query param or their own branch (non-MD) */
    const branchFilter = branchId && !isNaN(parseInt(branchId))
      ? parseInt(branchId)
      : (role !== "managing_director" ? userBranchId : null);
    if (branchFilter) conditions.push(eq(salesTable.branchId, branchFilter));
  }

  if (startDate) conditions.push(gte(salesTable.saleDate, queryDateRange(startDate).start));
  if (endDate) conditions.push(lte(salesTable.saleDate, queryDateRange(endDate).end));

  const sales = (await db.select({ sale: salesTable }).from(salesTable)
    .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
    .where(and(...conditions)))
    .map(({ sale }) => sale);

  res.json(sales.map(({ sale, cashierName, cashierRole, branchName, branchPhone, branchAddress }) => formatSale(sale, cashierName ?? "Unknown", branchName ?? "Unknown", cashierRole ?? undefined, branchPhone, branchAddress)));
});

router.post("/sales", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId, branchId: userBranchId } = req.user!;
  const { breadType, quantity, pricePerUnit, paymentMethod, branchId, notes } = req.body;

  if (!breadType || !quantity || !pricePerUnit || !paymentMethod || branchId == null) {
    res.status(400).json({ error: "breadType, quantity, pricePerUnit, paymentMethod, and branchId are required" });
    return;
  }

  const qty = parseInt(quantity);
  const effectiveBranchId = parseInt(branchId) || userBranchId || 1;
  if (!effectiveBranchId) {
    res.status(400).json({ error: "Select a branch before recording a sale" });
    return;
  }

  /* 1. Validate product exists and is active */
  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(
      eq(productsTable.companyId, companyId), eq(productsTable.name, breadType), eq(productsTable.isActive, true),
      or(eq(productsTable.branchId, effectiveBranchId), isNull(productsTable.branchId)),
    ));

  if (!product) {
    res.status(400).json({ error: `"${breadType}" is not an active product. Ask your admin to add it.` });
    return;
  }

  /* Conflict detection: if the client sent X-Offline-Queued-At, check whether
     the product was changed (price, availability) after the mutation was queued.
     This catches cases where a sale was recorded offline but the product price
     changed on the server in the meantime. */
  const queuedAtHeader = req.headers["x-offline-queued-at"];
  if (queuedAtHeader) {
    const queuedAt = new Date(parseInt(queuedAtHeader as string, 10));
    if (product.updatedAt > queuedAt) {
      res.status(409).json({
        error: "Conflict",
        message: `The product "${breadType}" was updated (price or availability changed) while you were offline. Please review the current price before recording this sale.`,
        serverData: {
          id:           product.id,
          name:         product.name,
          pricePerUnit: parseFloat(product.pricePerUnit as unknown as string),
          isActive:     product.isActive,
          updatedAt:    product.updatedAt.toISOString(),
        },
      });
      return;
    }
  }

  /* 2. Stock check — logic differs for sellers vs. others */
  if (role === "supplier") {
    /* Seller can only sell what they've been allocated minus what they've sold */
    const [allocations, myPastSales] = await Promise.all([
      db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.sellerId, userId), eq(sellerAllocationsTable.productId, product.id), isNull(sellerAllocationsTable.deletedAt))),
      db.select().from(salesTable).where(and(eq(salesTable.cashierId, userId), eq(salesTable.productId, product.id), isNull(salesTable.deletedAt))),
    ]);

    const totalAllocated = allAllocations.reduce((s, a) => s + a.quantity, 0);
    const totalSold = allSales.reduce((s, s2) => s + (s2.cashierRole === "supplier" ? 0 : s2.sale.quantity), 0);
    const canSell = totalAllocated - totalSold;

    if (qty > canSell) {
      res.status(400).json({
        error: canSell <= 0
          ? `You have no "${breadType}" allocated to you. Ask the receptionist to allocate some.`
          : `You only have ${canSell} unit${canSell !== 1 ? "s" : ""} of "${breadType}" available to sell.`,
      });
      return;
    }
  } else {
    /* Receptionists/managers: check overall stock (produced - allocated - direct sales) */
    const [allProduction, allSales, allAllocations] = await Promise.all([
      db.select().from(productionBatchesTable).where(and(eq(productionBatchesTable.companyId, companyId), eq(productionBatchesTable.branchId, effectiveBranchId), eq(productionBatchesTable.productId, product.id), isNull(productionBatchesTable.deletedAt))),
      db.select({ sale: salesTable, cashierRole: usersTable.role }).from(salesTable).leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id)).where(and(eq(salesTable.companyId, companyId), eq(salesTable.branchId, effectiveBranchId), eq(salesTable.productId, product.id), isNull(salesTable.deletedAt))),
      db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.companyId, companyId), eq(sellerAllocationsTable.branchId, effectiveBranchId), eq(sellerAllocationsTable.productId, product.id), isNull(sellerAllocationsTable.deletedAt), eq(sellerAllocationsTable.isCleared, false))),
    ]);

    const totalProduced = allProduction.reduce((s, b) => s + b.quantityProduced - b.wasteQuantity, 0);
    const totalSold = allSales.reduce((s, s2) => s + (s2.cashierRole === "supplier" ? 0 : s2.sale.quantity), 0);
    const totalAllocated = allAllocations.reduce((s, a) => s + a.quantity, 0);
    const remaining = totalProduced - totalSold - totalAllocated;

    if (qty > remaining) {
      res.status(400).json({
        error: remaining <= 0
          ? `No direct stock available for "${breadType}". (Check if bread is allocated to sellers.)`
          : `Only ${remaining} unit${remaining !== 1 ? "s" : ""} of "${breadType}" available for direct sale.`,
      });
      return;
    }
  }

  const price = parseFloat(pricePerUnit);
  const totalAmount = parseFloat(amount);
  const receiptNumber = generateReceiptNumber();

  /* Resolve branchId: use request body value, else user's branchId.
     For suppliers without a branchId, fall back to their most recent allocation's branch. */
  // effectiveBranchId was resolved before stock validation so every check is branch-scoped.
  if (!effectiveBranchId && role === "supplier") {
    const [recentAlloc] = await db
      .select()
      .from(sellerAllocationsTable)
      .where(and(eq(sellerAllocationsTable.sellerId, userId), isNull(sellerAllocationsTable.deletedAt)))
      .limit(1);
    if (recentAlloc?.branchId) effectiveBranchId = recentAlloc.branchId;
  }
  effectiveBranchId = effectiveBranchId || 1;

  const [sale] = await db.insert(salesTable).values({
    companyId,
    receiptNumber,
    productId: null,
    breadType: "Quick Sale",
    quantity: 1,
    pricePerUnit: totalAmount.toString(),
    totalAmount: totalAmount.toString(),
    costAmount: "0",
    profitAmount: totalAmount.toString(),
    paymentMethod: pm as "cash" | "transfer",
    cashierId: userId,
    branchId: effectiveBranchId,
    notes: notes ?? null,
    saleDate: new Date(),
  }).returning();

  const [[cashier], [branch]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)),
    db.select().from(branchesTable).where(eq(branchesTable.id, sale.branchId)),
  ]);

  await logAudit({
    req, userId, companyId,
    action: "QUICK_SALE_CREATED",
    entityType: "sale",
    entityId: sale.id,
    details: `Quick Sale ₦${totalAmount} (${pm})`,
    branchId: sale.branchId,
  });

  res.status(201).json(formatSale(sale, cashier?.fullName ?? "Unknown", branch?.name ?? "Unknown", role, branch?.phone, branch?.address));
});

router.get("/sales/daily-summary", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId, branchId: userBranchId } = req.user!;
  const { amount, paymentMethod, branchId, notes } = req.body;

  if (!amount || !paymentMethod || branchId == null) {
    res.status(400).json({ error: "amount, paymentMethod, and branchId are required" });
    return;
  }

  const totalAmount = parseFloat(amount);
  if (isNaN(totalAmount) || totalAmount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const pm = paymentMethod as string;
  if (pm !== "cash" && pm !== "transfer") {
    res.status(400).json({ error: "paymentMethod must be cash or transfer" });
    return;
  }

  const effectiveBranchId = parseInt(branchId) || userBranchId || 1;
  const receiptNumber = generateReceiptNumber();

  const [sale] = await db.insert(salesTable).values({
    companyId,
    receiptNumber,
    productId: null,
    breadType: "Quick Sale",
    quantity: 1,
    pricePerUnit: totalAmount.toString(),
    totalAmount: totalAmount.toString(),
    costAmount: "0",
    profitAmount: totalAmount.toString(),
    paymentMethod: pm as "cash" | "transfer",
    cashierId: userId,
    branchId: effectiveBranchId,
    notes: notes ?? null,
    saleDate: new Date(),
  }).returning();

  const [[cashier], [branch]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)),
    db.select().from(branchesTable).where(eq(branchesTable.id, sale.branchId)),
  ]);

  await logAudit({
    req, userId, companyId,
    action: "QUICK_SALE_CREATED",
    entityType: "sale",
    entityId: sale.id,
    details: `Quick Sale ₦${totalAmount} (${pm})`,
    branchId: sale.branchId,
  });

  res.status(201).json(formatSale(sale, cashier?.fullName ?? "Unknown", branch?.name ?? "Unknown", role, branch?.phone, branch?.address));
});

router.get("/sales/daily-summary", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId, branchId: userBranchId } = req.user!;
  const { date, branchId } = req.query as { date?: string; branchId?: string };
  const targetDate = date ?? businessDateFor();
  const { start: startOfDay, end: endOfDay } = businessDateRange(targetDate);
  const conditions = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), visibleSaleForUsers(), gte(salesTable.saleDate, startOfDay), lte(salesTable.saleDate, endOfDay)];
  if (role === "supplier") {
    conditions.push(eq(salesTable.cashierId, userId));
  } else if (branchId && !isNaN(parseInt(branchId))) {
    conditions.push(eq(salesTable.branchId, parseInt(branchId)));
  } else if (role !== "managing_director" && userBranchId) {
    conditions.push(eq(salesTable.branchId, userBranchId));
  }
  const sales = (await db.select({ sale: salesTable }).from(salesTable)
    .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
    .where(and(...conditions)))
    .map(({ sale }) => sale);
  const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount as unknown as string), 0);
  const totalProfit = sales.reduce((sum, s) => sum + parseFloat(s.profitAmount as unknown as string), 0);
  const cashSales = sales.filter(s => s.paymentMethod === "cash").reduce((sum, s) => sum + parseFloat(s.totalAmount as unknown as string), 0);
  const transferSales = sales.filter(s => s.paymentMethod === "transfer").reduce((sum, s) => sum + parseFloat(s.totalAmount as unknown as string), 0);
  const breadTypeMap = new Map<string, { quantity: number; revenue: number }>();
  for (const s of sales) {
    const prev = breadTypeMap.get(s.breadType) ?? { quantity: 0, revenue: 0 };
    breadTypeMap.set(s.breadType, { quantity: prev.quantity + s.quantity, revenue: prev.revenue + parseFloat(s.totalAmount as unknown as string) });
  }
  res.json({ date: targetDate, totalSales: sales.length, totalRevenue, totalProfit, totalCost: 0, cashSales, transferSales, breadTypes: Array.from(breadTypeMap.entries()).map(([breadType, data]) => ({ breadType, quantity: data.quantity, revenue: data.revenue })) });
});

router.get("/sales/:id", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId } = req.user!;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [result] = await db.select({ sale: salesTable, cashierName: usersTable.fullName, cashierRole: usersTable.role, branchName: branchesTable.name, branchPhone: branchesTable.phone, branchAddress: branchesTable.address })
    .from(salesTable)
    .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
    .leftJoin(branchesTable, eq(salesTable.branchId, branchesTable.id))
    .where(and(eq(salesTable.id, id), eq(salesTable.companyId, companyId), isNull(salesTable.deletedAt), visibleSaleForUsers()));
  if (!result) { res.status(404).json({ error: "Sale not found" }); return; }
  /* Sellers can only view their own sales */
  if (role === "supplier" && result.sale.cashierId !== userId) {
    res.status(403).json({ error: "Access denied" }); return;
  }
  res.json(formatSale(result.sale, result.cashierName ?? "Unknown", result.branchName ?? "Unknown", result.cashierRole ?? undefined, result.branchPhone, result.branchAddress));
});

export default router;
