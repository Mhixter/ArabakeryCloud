import { Router, IRouter } from "express";
import { db, salesTable, productionBatchesTable, productsTable, productReturnsTable, sellerAllocationsTable, usersTable } from "@workspace/db";
import { eq, and, isNull, gte, lte } from "drizzle-orm";
import { authenticate, AuthenticatedRequest } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/reports/dashboard", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { branchId } = req.query as { branchId?: string };
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);
  const branchFilter = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : null;

  const todaySalesConds = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), gte(salesTable.saleDate, todayStart), lte(salesTable.saleDate, todayEnd)];
  if (branchFilter) todaySalesConds.push(eq(salesTable.branchId, branchFilter));
  const todaySales = await db.select().from(salesTable).where(and(...todaySalesConds));

  const weekSalesConds = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), gte(salesTable.saleDate, weekStart)];
  if (branchFilter) weekSalesConds.push(eq(salesTable.branchId, branchFilter));
  const weekSales = await db.select().from(salesTable).where(and(...weekSalesConds));

  const todayProdConds = [isNull(productionBatchesTable.deletedAt), eq(productionBatchesTable.companyId, companyId), gte(productionBatchesTable.productionDate, todayStart), lte(productionBatchesTable.productionDate, todayEnd)];
  if (branchFilter) todayProdConds.push(eq(productionBatchesTable.branchId, branchFilter));
  const todayProduction = await db.select().from(productionBatchesTable).where(and(...todayProdConds));

  res.json({
    today: {
      revenue: todaySales.reduce((s, x) => s + parseFloat(x.totalAmount as unknown as string), 0),
      profit: todaySales.reduce((s, x) => s + parseFloat(x.profitAmount as unknown as string), 0),
      salesCount: todaySales.length,
      unitsSold: todaySales.reduce((s, x) => s + x.quantity, 0),
      produced: todayProduction.reduce((s, x) => s + x.quantityProduced, 0),
      waste: todayProduction.reduce((s, x) => s + x.wasteQuantity, 0),
    },
    week: {
      revenue: weekSales.reduce((s, x) => s + parseFloat(x.totalAmount as unknown as string), 0),
      profit: weekSales.reduce((s, x) => s + parseFloat(x.profitAmount as unknown as string), 0),
      salesCount: weekSales.length,
    },
  });
});

/* ── Product-focused dashboard (new) ── */
router.get("/reports/product-dashboard", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId, role, branchId: userBranchId } = req.user!;
  const { branchId: queryBranchId } = req.query as { branchId?: string };
  const branchFilter = queryBranchId && !isNaN(parseInt(queryBranchId))
    ? parseInt(queryBranchId)
    : role !== "managing_director" ? userBranchId : null;
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);

  const activeProducts = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.companyId, companyId), eq(productsTable.isActive, true)));

  const todayConds = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), gte(salesTable.saleDate, todayStart), lte(salesTable.saleDate, todayEnd)];
  if (branchFilter) todayConds.push(eq(salesTable.branchId, branchFilter));
  const todaySales = await db.select({ sale: salesTable }).from(salesTable).where(and(...todayConds));

  const weekConds = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), gte(salesTable.saleDate, weekStart)];
  if (branchFilter) weekConds.push(eq(salesTable.branchId, branchFilter));
  const weekSales = await db.select({ sale: salesTable }).from(salesTable).where(and(...weekConds));

  const prodConds = [isNull(productionBatchesTable.deletedAt), eq(productionBatchesTable.companyId, companyId)];
  if (branchFilter) prodConds.push(eq(productionBatchesTable.branchId, branchFilter));
  const allProduction = await db.select().from(productionBatchesTable).where(and(...prodConds));

  /* Join sales with cashier role so we can split direct vs supplier sales.
     Supplier sales are WITHIN allocated bread — counting both would double-subtract. */
  const allSalesConds = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId)];
  if (branchFilter) allSalesConds.push(eq(salesTable.branchId, branchFilter));
  const allSalesEver = await db
    .select({ sale: salesTable, cashierRole: usersTable.role })
    .from(salesTable)
    .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
    .where(and(...allSalesConds));

  /* Fetch approved returns only — pending/rejected don't affect stock */
  const returnsConds = [
    eq(productReturnsTable.companyId, companyId),
    eq(productReturnsTable.status, "approved" as const),
  ];
  if (branchFilter) returnsConds.push(eq(productReturnsTable.branchId, branchFilter));
  const allReturns = await db.select().from(productReturnsTable).where(and(...returnsConds));
  const RESTORABLE = ["not_sold", "wrong_item", "other"];
  const DAMAGED    = ["damaged", "expired"];

  /* Total allocations ever made (bread sent out to suppliers) */
  const allocConds = [eq(sellerAllocationsTable.companyId, companyId), isNull(sellerAllocationsTable.deletedAt)];
  if (branchFilter) allocConds.push(eq(sellerAllocationsTable.branchId, branchFilter));
  const activeAllocations = await db.select().from(sellerAllocationsTable).where(and(...allocConds));

  function aggregateByProduct(rows: { sale: typeof salesTable.$inferSelect }[]) {
    const map = new Map<string, { quantity: number; amount: number }>();
    for (const { sale: s } of rows) {
      const p = map.get(s.breadType) ?? { quantity: 0, amount: 0 };
      map.set(s.breadType, { quantity: p.quantity + s.quantity, amount: p.amount + parseFloat(s.totalAmount as unknown as string) });
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, quantity: d.quantity, amount: d.amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  const productionByType = new Map<string, number>();
  for (const b of allProduction) {
    productionByType.set(b.breadType, (productionByType.get(b.breadType) ?? 0) + b.quantityProduced - b.wasteQuantity);
  }

  /* Split sales: direct (non-supplier staff sell from store) vs supplier (sell from their allocation) */
  const directSalesByType   = new Map<string, number>();
  const supplierSalesByType = new Map<string, number>();
  const allSalesByType      = new Map<string, number>(); // for today/week display
  for (const { sale: s, cashierRole } of allSalesEver) {
    allSalesByType.set(s.breadType, (allSalesByType.get(s.breadType) ?? 0) + s.quantity);
    if (cashierRole === "supplier") {
      supplierSalesByType.set(s.breadType, (supplierSalesByType.get(s.breadType) ?? 0) + s.quantity);
    } else {
      directSalesByType.set(s.breadType, (directSalesByType.get(s.breadType) ?? 0) + s.quantity);
    }
  }

  /* Approved returns: restorable goes back to store, damaged is wasted */
  const restorableByType = new Map<string, number>();
  const damagedByType    = new Map<string, number>();
  const allReturnsByType = new Map<string, number>(); // all approved returns (restorable + damaged)
  for (const r of allReturns) {
    allReturnsByType.set(r.breadType, (allReturnsByType.get(r.breadType) ?? 0) + r.quantity);
    if (RESTORABLE.includes(r.reason)) {
      restorableByType.set(r.breadType, (restorableByType.get(r.breadType) ?? 0) + r.quantity);
    } else if (DAMAGED.includes(r.reason)) {
      damagedByType.set(r.breadType, (damagedByType.get(r.breadType) ?? 0) + r.quantity);
    }
  }

  const totalAllocatedByType = new Map<string, number>();
  for (const a of activeAllocations) {
    totalAllocatedByType.set(a.breadType, (totalAllocatedByType.get(a.breadType) ?? 0) + a.quantity);
  }

  const remaining = activeProducts.map(p => {
    const produced      = productionByType.get(p.name) ?? 0;
    const totalAllocated = totalAllocatedByType.get(p.name) ?? 0;
    const directSold    = directSalesByType.get(p.name) ?? 0;
    const supplierSold  = supplierSalesByType.get(p.name) ?? 0;
    const restored      = restorableByType.get(p.name) ?? 0;
    const damaged       = damagedByType.get(p.name) ?? 0;
    const allReturned   = allReturnsByType.get(p.name) ?? 0;
    const totalSold     = allSalesByType.get(p.name) ?? 0;

    /*
     * Bread flow:
     *   produced → store → [sold directly] OR [allocated to suppliers]
     *   allocated → suppliers → [sold by suppliers] OR [returned: restored back / damaged wasted]
     *
     * In-store = net_produced + restorable_returns - direct_sales - total_allocated
     *   (allocations remove bread from store; restorable returns bring some back)
     *
     * With-suppliers = total_allocated - supplier_sales - all_approved_returns
     *   (what suppliers currently hold, net of what they sold or gave back)
     */
    const inStore       = Math.max(0, produced + restored - directSold - totalAllocated);
    const withSuppliers = Math.max(0, totalAllocated - supplierSold - allReturned);

    return {
      name: p.name,
      produced,
      sold: totalSold,        // all sales (for display as "X sold total")
      restored,
      damaged,
      allocated: withSuppliers, // how many are CURRENTLY with suppliers
      remaining: inStore,       // how many are in the store right now
    };
  });

  res.json({
    activeProductCount: activeProducts.length,
    today: {
      totalAmount: todaySales.reduce((s, x) => s + parseFloat(x.sale.totalAmount as unknown as string), 0),
      totalQuantity: todaySales.reduce((s, x) => s + x.sale.quantity, 0),
      salesCount: todaySales.length,
      byProduct: aggregateByProduct(todaySales),
    },
    week: {
      totalAmount: weekSales.reduce((s, x) => s + parseFloat(x.sale.totalAmount as unknown as string), 0),
      totalQuantity: weekSales.reduce((s, x) => s + x.sale.quantity, 0),
      salesCount: weekSales.length,
      byProduct: aggregateByProduct(weekSales),
    },
    remaining,
  });
});

router.get("/reports/sales-trend", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { branchId, days = "14" } = req.query as { branchId?: string; days?: string };
  const numDays = parseInt(days);
  const start = new Date(); start.setDate(start.getDate() - numDays); start.setHours(0, 0, 0, 0);
  const branchFilter = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : null;
  const conds = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), gte(salesTable.saleDate, start)];
  if (branchFilter) conds.push(eq(salesTable.branchId, branchFilter));
  const sales = await db.select().from(salesTable).where(and(...conds)).orderBy(salesTable.saleDate);
  const dayMap = new Map<string, { revenue: number; profit: number; count: number }>();
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().split("T")[0], { revenue: 0, profit: 0, count: 0 });
  }
  for (const s of sales) {
    const key = s.saleDate.toISOString().split("T")[0];
    const prev = dayMap.get(key) ?? { revenue: 0, profit: 0, count: 0 };
    dayMap.set(key, { revenue: prev.revenue + parseFloat(s.totalAmount as unknown as string), profit: prev.profit + parseFloat(s.profitAmount as unknown as string), count: prev.count + 1 });
  }
  res.json(Array.from(dayMap.entries()).map(([date, data]) => ({ date, revenue: data.revenue, profit: data.profit, salesCount: data.count })));
});

router.get("/reports/production-summary", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { branchId, startDate, endDate } = req.query as { branchId?: string; startDate?: string; endDate?: string };
  const branchFilter = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : null;
  const conds = [isNull(productionBatchesTable.deletedAt), eq(productionBatchesTable.companyId, companyId)];
  if (branchFilter) conds.push(eq(productionBatchesTable.branchId, branchFilter));
  if (startDate) conds.push(gte(productionBatchesTable.productionDate, new Date(startDate)));
  if (endDate) conds.push(lte(productionBatchesTable.productionDate, new Date(endDate)));
  const batches = await db.select().from(productionBatchesTable).where(and(...conds));
  const totalProduced = batches.reduce((s, b) => s + b.quantityProduced, 0);
  const totalWaste = batches.reduce((s, b) => s + b.wasteQuantity, 0);
  const wastePercentage = totalProduced > 0 ? (totalWaste / totalProduced) * 100 : 0;
  const breadTypeMap = new Map<string, { produced: number; waste: number }>();
  for (const b of batches) {
    const existing = breadTypeMap.get(b.breadType) ?? { produced: 0, waste: 0 };
    breadTypeMap.set(b.breadType, { produced: existing.produced + b.quantityProduced, waste: existing.waste + b.wasteQuantity });
  }
  res.json({ totalProduced, totalWaste, wastePercentage, efficiency: 100 - wastePercentage, byBreadType: Array.from(breadTypeMap.entries()).map(([breadType, data]) => ({ breadType, totalProduced: data.produced, totalWaste: data.waste })) });
});

export default router;
