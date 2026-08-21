import { Router, IRouter } from "express";
import { db, salesTable, usersTable, branchesTable, productsTable, productionBatchesTable, sellerAllocationsTable } from "@workspace/db";
import { eq, and, isNull, gte, lte, or, sql } from "drizzle-orm";
import { authenticate, AuthenticatedRequest, requireRole } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";
import { notifyManagers } from "../lib/push";
import crypto from "crypto";

const router: IRouter = Router();

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

router.get("/sales", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId, branchId: userBranchId } = req.user!;
  const { branchId, startDate, endDate } = req.query as { branchId?: string; startDate?: string; endDate?: string };

  const conditions = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId)];

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

  if (startDate) conditions.push(gte(salesTable.saleDate, new Date(startDate)));
  if (endDate) conditions.push(lte(salesTable.saleDate, new Date(endDate)));

  const sales = await db
    .select({ sale: salesTable, cashierName: usersTable.fullName, cashierRole: usersTable.role, branchName: branchesTable.name, branchPhone: branchesTable.phone, branchAddress: branchesTable.address })
    .from(salesTable)
    .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
    .leftJoin(branchesTable, eq(salesTable.branchId, branchesTable.id))
    .where(and(...conditions))
    .orderBy(salesTable.saleDate);

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
  let effectiveBranchId = parseInt(branchId) || userBranchId;
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
      db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.sellerId, userId), eq(sellerAllocationsTable.breadType, breadType), isNull(sellerAllocationsTable.deletedAt))),
      db.select().from(salesTable).where(and(eq(salesTable.cashierId, userId), eq(salesTable.breadType, breadType), isNull(salesTable.deletedAt))),
    ]);

    const totalAllocated = allocations.reduce((s, a) => s + a.quantity, 0);
    const totalSold = myPastSales.reduce((s, s2) => s + s2.quantity, 0);
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
      db.select().from(productionBatchesTable).where(and(eq(productionBatchesTable.companyId, companyId), eq(productionBatchesTable.branchId, effectiveBranchId), sql`lower(trim(${productionBatchesTable.breadType})) = lower(trim(${breadType}))`, isNull(productionBatchesTable.deletedAt))),
      db.select({ sale: salesTable, cashierRole: usersTable.role }).from(salesTable).leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id)).where(and(eq(salesTable.companyId, companyId), eq(salesTable.branchId, effectiveBranchId), sql`lower(trim(${salesTable.breadType})) = lower(trim(${breadType}))`, isNull(salesTable.deletedAt))),
      db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.companyId, companyId), eq(sellerAllocationsTable.branchId, effectiveBranchId), sql`lower(trim(${sellerAllocationsTable.breadType})) = lower(trim(${breadType}))`, isNull(sellerAllocationsTable.deletedAt), eq(sellerAllocationsTable.isCleared, false))),
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
  const totalAmount = qty * price;
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
    companyId, receiptNumber, breadType, quantity: qty,
    pricePerUnit: price.toString(), totalAmount: totalAmount.toString(),
    costAmount: "0", profitAmount: totalAmount.toString(),
    paymentMethod, cashierId: userId, branchId: effectiveBranchId,
    notes: notes ?? null, saleDate: new Date(),
  }).returning();

  const [[cashier], [branch]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)),
    db.select().from(branchesTable).where(eq(branchesTable.id, sale.branchId)),
  ]);

  await logAudit({ req, userId, companyId, action: "SALE_CREATED", entityType: "sale", entityId: sale.id, details: `${breadType} x${qty} @ ${price} = ${totalAmount} (${paymentMethod})`, branchId: sale.branchId });

  if (role === "supplier") {
    notifyManagers(companyId, {
      title: "New Supplier Sale",
      body: `${cashier?.fullName ?? "A supplier"} sold ${qty}× ${breadType} — ₦${totalAmount.toLocaleString()}`,
      url: "/sales",
      tag: `sale-${sale.id}`,
    }).catch(() => {});
  }

  res.status(201).json(formatSale(sale, cashier?.fullName ?? "Unknown", branch?.name ?? "Unknown", undefined, branch?.phone, branch?.address));
});

/* ── Quick Sale (manager / managing_director only) ── */
router.post("/sales/quick", authenticate, requireRole("manager", "managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
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
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);
  const conditions = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), gte(salesTable.saleDate, startOfDay), lte(salesTable.saleDate, endOfDay)];
  if (role === "supplier") {
    conditions.push(eq(salesTable.cashierId, userId));
  } else if (branchId && !isNaN(parseInt(branchId))) {
    conditions.push(eq(salesTable.branchId, parseInt(branchId)));
  } else if (role !== "managing_director" && userBranchId) {
    conditions.push(eq(salesTable.branchId, userBranchId));
  }
  const sales = await db.select().from(salesTable).where(and(...conditions));
  const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount as unknown as string), 0);
  const totalProfit = sales.reduce((sum, s) => sum + parseFloat(s.profitAmount as unknown as string), 0);
  const cashSales = sales.filter(s => s.paymentMethod === "cash").reduce((sum, s) => sum + parseFloat(s.totalAmount as unknown as string), 0);
  const transferSales = sales.filter(s => s.paymentMethod === "transfer").reduce((sum, s) => sum + parseFloat(s.totalAmount as unknown as string), 0);
  const breadTypeMap = new Map<string, { quantity: number; revenue: number }>();
  for (const s of sales) {
    const prev = breadTypeMap.get(s.breadType) ?? { quantity: 0, revenue: 0 };
    breadTypeMap.set(s.breadType, { quantity: prev.quantity + s.quantity, revenue: prev.revenue + parseFloat(s.totalAmount as unknown as string) });
  }
  res.json({ date: targetDate.toISOString().split("T")[0], totalSales: sales.length, totalRevenue, totalProfit, totalCost: 0, cashSales, transferSales, breadTypes: Array.from(breadTypeMap.entries()).map(([breadType, data]) => ({ breadType, quantity: data.quantity, revenue: data.revenue })) });
});

router.get("/sales/:id", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId } = req.user!;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [result] = await db.select({ sale: salesTable, cashierName: usersTable.fullName, branchName: branchesTable.name, branchPhone: branchesTable.phone, branchAddress: branchesTable.address })
    .from(salesTable)
    .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
    .leftJoin(branchesTable, eq(salesTable.branchId, branchesTable.id))
    .where(and(eq(salesTable.id, id), eq(salesTable.companyId, companyId), isNull(salesTable.deletedAt)));
  if (!result) { res.status(404).json({ error: "Sale not found" }); return; }
  /* Sellers can only view their own sales */
  if (role === "supplier" && result.sale.cashierId !== userId) {
    res.status(403).json({ error: "Access denied" }); return;
  }
  res.json(formatSale(result.sale, result.cashierName ?? "Unknown", result.branchName ?? "Unknown", undefined, result.branchPhone, result.branchAddress));
});

export default router;
