import { Router, IRouter } from "express";
import { db, salesTable, productionBatchesTable, productsTable, productReturnsTable, sellerAllocationsTable, usersTable, auditLogsTable, branchesTable, expensesTable, expenseCategoriesTable } from "@workspace/db";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";
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
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const { companyId, role, branchId: userBranchId } = req.user!;
  const { branchId: queryBranchId, date: queryDate, scope } = req.query as { branchId?: string; date?: string; scope?: string };
  const companyWide = role === "managing_director" && scope === "company";
  const branchFilter = companyWide ? null : queryBranchId && !isNaN(parseInt(queryBranchId))
    ? parseInt(queryBranchId)
    : role !== "managing_director" ? userBranchId : null;
  /* Stock and KPI calculations use the selected branch for MDs too. */
  const stockBranchFilter = companyWide ? null : branchFilter;
  /* Support custom date for "view by date" filter — fallback to today */
  const baseDate = queryDate ? new Date(queryDate + "T12:00:00") : new Date();
  const now = new Date();
  const todayStart = new Date(baseDate); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(baseDate); todayEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);

  const activeProducts = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.companyId, companyId), eq(productsTable.isActive, true)));

  const todayConds = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), gte(salesTable.saleDate, todayStart), lte(salesTable.saleDate, todayEnd)];
  if (branchFilter) todayConds.push(eq(salesTable.branchId, branchFilter));
  const todaySales = await db.select({ sale: salesTable }).from(salesTable).where(and(...todayConds));

  const todayExpConds = [isNull(expensesTable.deletedAt), eq(expensesTable.companyId, companyId), gte(expensesTable.expenseDate, todayStart), lte(expensesTable.expenseDate, todayEnd)];
  if (branchFilter) todayExpConds.push(eq(expensesTable.branchId, branchFilter));
  const todayExpenses = await db.select({ amount: expensesTable.amount }).from(expensesTable).where(and(...todayExpConds));

  const weekExpConds = [isNull(expensesTable.deletedAt), eq(expensesTable.companyId, companyId), gte(expensesTable.expenseDate, weekStart)];
  if (branchFilter) weekExpConds.push(eq(expensesTable.branchId, branchFilter));
  const weekExpenses = await db.select({ amount: expensesTable.amount }).from(expensesTable).where(and(...weekExpConds));

  const weekConds = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId), gte(salesTable.saleDate, weekStart)];
  if (branchFilter) weekConds.push(eq(salesTable.branchId, branchFilter));
  const weekSales = await db.select({ sale: salesTable }).from(salesTable).where(and(...weekConds));

  /* Production, allocations & returns use stockBranchFilter so the MD always sees
     company-wide bread stock regardless of which branch KPI tab they have open. */
  const prodConds = [isNull(productionBatchesTable.deletedAt), eq(productionBatchesTable.companyId, companyId)];
  if (stockBranchFilter) prodConds.push(eq(productionBatchesTable.branchId, stockBranchFilter));
  const allProduction = await db.select().from(productionBatchesTable).where(and(...prodConds));

  /* Join sales with cashier role so we can split direct vs supplier sales.
     Supplier sales are WITHIN allocated bread — counting both would double-subtract. */
  const allSalesConds = [isNull(salesTable.deletedAt), eq(salesTable.companyId, companyId)];
  if (stockBranchFilter) allSalesConds.push(eq(salesTable.branchId, stockBranchFilter));
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
  if (stockBranchFilter) returnsConds.push(eq(productReturnsTable.branchId, stockBranchFilter));
  const allReturns = await db.select().from(productReturnsTable).where(and(...returnsConds));
  const RESTORABLE = ["not_sold", "wrong_item", "other"];
  const DAMAGED    = ["damaged", "expired"];
  const productKey = (value: string) => value.trim().toLowerCase();

  /* Total allocations ever made that are still UNCLEARED (bread currently with suppliers) */
  const allocConds = [
    eq(sellerAllocationsTable.companyId, companyId),
    isNull(sellerAllocationsTable.deletedAt),
    eq(sellerAllocationsTable.isCleared, false),
  ];
  if (stockBranchFilter) allocConds.push(eq(sellerAllocationsTable.branchId, stockBranchFilter));
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
    const key = productKey(b.breadType);
    productionByType.set(key, (productionByType.get(key) ?? 0) + b.quantityProduced - b.wasteQuantity);
  }

  /* Split sales: direct (non-supplier staff sell from store) vs supplier (sell from their allocation) */
  const directSalesByType   = new Map<string, number>();
  const supplierSalesByType = new Map<string, number>();
  const allSalesByType      = new Map<string, number>(); // for today/week display
  for (const { sale: s, cashierRole } of allSalesEver) {
    const key = productKey(s.breadType);
    allSalesByType.set(key, (allSalesByType.get(key) ?? 0) + s.quantity);
    if (cashierRole === "supplier") {
      supplierSalesByType.set(key, (supplierSalesByType.get(key) ?? 0) + s.quantity);
    } else {
      directSalesByType.set(key, (directSalesByType.get(key) ?? 0) + s.quantity);
    }
  }

  /* Approved returns: restorable goes back to store, damaged is wasted */
  const restorableByType = new Map<string, number>();
  const damagedByType    = new Map<string, number>();
  const allReturnsByType = new Map<string, number>(); // all approved returns (restorable + damaged)
  for (const r of allReturns) {
    const key = productKey(r.breadType);
    allReturnsByType.set(key, (allReturnsByType.get(key) ?? 0) + r.quantity);
    if (RESTORABLE.includes(r.reason)) {
      restorableByType.set(key, (restorableByType.get(key) ?? 0) + r.quantity);
    } else if (DAMAGED.includes(r.reason)) {
      damagedByType.set(key, (damagedByType.get(key) ?? 0) + r.quantity);
    }
  }

  const totalAllocatedByType = new Map<string, number>();
  for (const a of activeAllocations) {
    const key = productKey(a.breadType);
    totalAllocatedByType.set(key, (totalAllocatedByType.get(key) ?? 0) + a.quantity);
  }

  const remaining = activeProducts.map(p => {
    const key = productKey(p.name);
    const produced      = productionByType.get(key) ?? 0;
    const totalAllocated = totalAllocatedByType.get(key) ?? 0;
    const directSold    = directSalesByType.get(key) ?? 0;
    const supplierSold  = supplierSalesByType.get(key) ?? 0;
    const restored      = restorableByType.get(key) ?? 0;
    const damaged       = damagedByType.get(key) ?? 0;
    const allReturned   = allReturnsByType.get(key) ?? 0;
    const totalSold     = allSalesByType.get(key) ?? 0;

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
      totalExpenses: todayExpenses.reduce((s, x) => s + parseFloat(x.amount as unknown as string), 0),
      byProduct: aggregateByProduct(todaySales),
    },
    week: {
      totalAmount: weekSales.reduce((s, x) => s + parseFloat(x.sale.totalAmount as unknown as string), 0),
      totalQuantity: weekSales.reduce((s, x) => s + x.sale.quantity, 0),
      salesCount: weekSales.length,
      totalExpenses: weekExpenses.reduce((s, x) => s + parseFloat(x.amount as unknown as string), 0),
      byProduct: aggregateByProduct(weekSales),
    },
    allTime: {
      totalAmount: allSalesEver.reduce((s, x) => s + parseFloat(x.sale.totalAmount as unknown as string), 0),
      totalQuantity: allSalesEver.reduce((s, x) => s + x.sale.quantity, 0),
      salesCount: allSalesEver.length,
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

/* ── User activity summary (all users) ── */
router.get("/reports/user-activity", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId, role } = req.user!;
  if (role !== "managing_director" && role !== "manager") { res.status(403).json({ error: "Forbidden" }); return; }

  const [users, allSales, allReturns, allBatches, allAllocations, lastLogs] = await Promise.all([
    db.select().from(usersTable).where(and(eq(usersTable.companyId, companyId), isNull(usersTable.deletedAt))),
    db.select().from(salesTable).where(and(eq(salesTable.companyId, companyId), isNull(salesTable.deletedAt))),
    db.select().from(productReturnsTable).where(eq(productReturnsTable.companyId, companyId)),
    db.select().from(productionBatchesTable).where(and(eq(productionBatchesTable.companyId, companyId), isNull(productionBatchesTable.deletedAt))),
    db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.companyId, companyId), isNull(sellerAllocationsTable.deletedAt))),
    db.select({ userId: auditLogsTable.userId, createdAt: auditLogsTable.createdAt })
      .from(auditLogsTable).where(eq(auditLogsTable.companyId, companyId))
      .orderBy(desc(auditLogsTable.createdAt)),
  ]);

  const branches = await db.select().from(branchesTable).where(eq(branchesTable.companyId, companyId));
  const branchMap = new Map(branches.map(b => [b.id, b.name]));

  /* Last activity per user */
  const lastActiveMap = new Map<number, string>();
  for (const l of lastLogs) {
    if (l.userId && !lastActiveMap.has(l.userId)) lastActiveMap.set(l.userId, l.createdAt.toISOString());
  }

  const result = users
    .filter(u => u.role !== "managing_director")
    .map(u => {
      const uid = u.id;
      const userSales = allSales.filter(s => s.cashierId === uid);
      const supplierReturns = allReturns.filter(r => r.sellerId === uid);
      const approvedReturns = allReturns.filter(r => r.receptionistId === uid && r.status === "approved");
      const batches = allBatches.filter(b => b.staffId === uid);
      const allocIssued = allAllocations.filter(a => a.issuedById === uid);
      /* Allocations received by this user (as a supplier) that are still uncleared */
      const allocReceived = allAllocations.filter(a => a.sellerId === uid && !a.isCleared);
      const totalReceivedUnits = allocReceived.reduce((s, a) => s + a.quantity, 0);
      const unitsSold = userSales.reduce((s, x) => s + x.quantity, 0);
      const unitsReturned = supplierReturns.filter(r => r.status === "approved").reduce((s, r) => s + r.quantity, 0);
      const inHandUnits = Math.max(0, totalReceivedUnits - unitsSold - unitsReturned);

      return {
        id: uid,
        fullName: u.fullName,
        role: u.role,
        agentId: u.agentId,
        branchId: u.branchId,
        branchName: u.branchId ? branchMap.get(u.branchId) ?? null : null,
        lastActiveAt: lastActiveMap.get(uid) ?? null,
        /* Sales stats */
        salesCount: userSales.length,
        totalRevenue: userSales.reduce((s, x) => s + parseFloat(x.totalAmount as unknown as string), 0),
        totalUnitsSold: unitsSold,
        /* Returns */
        returnsSubmitted: supplierReturns.length,
        returnsApproved: approvedReturns.length,
        /* Production */
        batchesLogged: batches.length,
        totalProduced: batches.reduce((s, b) => s + b.quantityProduced, 0),
        totalWaste: batches.reduce((s, b) => s + b.wasteQuantity, 0),
        /* Allocations issued (receptionist/manager) */
        allocationsIssued: allocIssued.length,
        totalAllocatedUnits: allocIssued.reduce((s, a) => s + a.quantity, 0),
        /* Allocations received (supplier) */
        allocationsReceived: allocReceived.length,
        totalReceivedUnits,
        inHandUnits,
      };
    });

  res.json(result);
});

/* ── User activity detail (single user) ── */
router.get("/reports/user-activity/:userId", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId, role } = req.user!;
  if (role !== "managing_director" && role !== "manager") { res.status(403).json({ error: "Forbidden" }); return; }
  const targetId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const [userRows, recentLogs] = await Promise.all([
    db.select().from(usersTable).where(and(eq(usersTable.id, targetId), eq(usersTable.companyId, companyId))),
    db.select().from(auditLogsTable)
      .where(and(eq(auditLogsTable.userId, targetId), eq(auditLogsTable.companyId, companyId)))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(100),
  ]);
  const user = userRows[0];
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const targetRole = user.role;

  const [userSales, supplierReturns, approvedByUser, batches, allocIssued, allocReceived] = await Promise.all([
    db.select({ sale: salesTable }).from(salesTable).leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
      .where(and(eq(salesTable.cashierId, targetId), isNull(salesTable.deletedAt))).orderBy(desc(salesTable.saleDate)),
    targetRole === "supplier"
      ? db.select().from(productReturnsTable).where(eq(productReturnsTable.sellerId, targetId)).orderBy(desc(productReturnsTable.returnDate))
      : Promise.resolve([]),
    (targetRole === "receptionist" || targetRole === "manager" || targetRole === "managing_director")
      ? db.select().from(productReturnsTable).where(and(eq(productReturnsTable.receptionistId, targetId), eq(productReturnsTable.status, "approved" as const))).orderBy(desc(productReturnsTable.returnDate))
      : Promise.resolve([]),
    targetRole === "production_staff"
      ? db.select().from(productionBatchesTable).where(and(eq(productionBatchesTable.staffId, targetId), isNull(productionBatchesTable.deletedAt))).orderBy(desc(productionBatchesTable.productionDate))
      : Promise.resolve([]),
    (targetRole === "receptionist" || targetRole === "manager" || targetRole === "managing_director")
      ? db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.issuedById, targetId), isNull(sellerAllocationsTable.deletedAt))).orderBy(desc(sellerAllocationsTable.allocationDate))
      : Promise.resolve([]),
    targetRole === "supplier"
      ? db.select().from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.sellerId, targetId), isNull(sellerAllocationsTable.deletedAt))).orderBy(desc(sellerAllocationsTable.allocationDate))
      : Promise.resolve([]),
  ]);

  const branches = await db.select().from(branchesTable).where(eq(branchesTable.companyId, companyId));
  const branchMap = new Map(branches.map(b => [b.id, b.name]));

  res.json({
    user: {
      id: user.id, fullName: user.fullName, role: user.role, agentId: user.agentId,
      branchName: user.branchId ? branchMap.get(user.branchId) ?? null : null,
    },
    sales: userSales.map(({ sale: s }) => ({
      id: s.id, breadType: s.breadType, quantity: s.quantity,
      totalAmount: parseFloat(s.totalAmount as unknown as string),
      paymentMethod: s.paymentMethod, saleDate: s.saleDate.toISOString(),
      receiptNumber: s.receiptNumber,
    })),
    returns: (supplierReturns as typeof productReturnsTable.$inferSelect[]).map(r => ({
      id: r.id, breadType: r.breadType, quantity: r.quantity, reason: r.reason,
      status: r.status, returnDate: r.returnDate.toISOString(),
    })),
    approvedReturns: (approvedByUser as typeof productReturnsTable.$inferSelect[]).map(r => ({
      id: r.id, breadType: r.breadType, quantity: r.quantity, reason: r.reason,
      returnDate: r.returnDate.toISOString(),
    })),
    batches: (batches as typeof productionBatchesTable.$inferSelect[]).map(b => ({
      id: b.id, breadType: b.breadType, quantityProduced: b.quantityProduced,
      wasteQuantity: b.wasteQuantity, productionDate: b.productionDate.toISOString(),
    })),
    allocationsIssued: (allocIssued as typeof sellerAllocationsTable.$inferSelect[]).map(a => ({
      id: a.id, breadType: a.breadType, quantity: a.quantity,
      allocationDate: a.allocationDate.toISOString(),
    })),
    allocationsReceived: (allocReceived as typeof sellerAllocationsTable.$inferSelect[]).map(a => ({
      id: a.id, breadType: a.breadType, quantity: a.quantity,
      allocationDate: a.allocationDate.toISOString(),
    })),
    recentLogs: recentLogs.map(l => ({
      id: l.id, action: l.action, entityType: l.entityType,
      details: l.details, createdAt: l.createdAt.toISOString(),
    })),
  });
});

/* ─ Weekly Summary Report ─ */
router.get("/reports/weekly-summary", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId, role, branchId: userBranchId } = req.user!;
  const { weekStart: weekStartStr, branchId: qBranch } = req.query as { weekStart?: string; branchId?: string };

  const weekStart = weekStartStr ? new Date(`${weekStartStr}T00:00:00`) : (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d;
  })();
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23,59,59,999);

  const effectiveBranchId = qBranch ? parseInt(qBranch) : role !== "managing_director" ? userBranchId : null;

  const saleConds: any[] = [eq(salesTable.companyId, companyId), isNull(salesTable.deletedAt), gte(salesTable.saleDate, weekStart), lte(salesTable.saleDate, weekEnd)];
  if (effectiveBranchId) saleConds.push(eq(salesTable.branchId, effectiveBranchId));

  const prodConds: any[] = [eq(productionBatchesTable.companyId, companyId), isNull(productionBatchesTable.deletedAt), gte(productionBatchesTable.productionDate, weekStart), lte(productionBatchesTable.productionDate, weekEnd)];
  if (effectiveBranchId) prodConds.push(eq(productionBatchesTable.branchId, effectiveBranchId));

  const expConds: any[] = [eq(expensesTable.companyId, companyId), isNull(expensesTable.deletedAt), gte(expensesTable.expenseDate, weekStart), lte(expensesTable.expenseDate, weekEnd)];
  if (effectiveBranchId) expConds.push(eq(expensesTable.branchId, effectiveBranchId));

  const [sales, production, expenses] = await Promise.all([
    db.select({ totalAmount: salesTable.totalAmount, profitAmount: salesTable.profitAmount, quantity: salesTable.quantity, breadType: salesTable.breadType, saleDate: salesTable.saleDate, branchId: salesTable.branchId })
      .from(salesTable).where(and(...saleConds)),
    db.select({ breadType: productionBatchesTable.breadType, quantityProduced: productionBatchesTable.quantityProduced, wasteQuantity: productionBatchesTable.wasteQuantity, productionDate: productionBatchesTable.productionDate })
      .from(productionBatchesTable).where(and(...prodConds)),
    db.select({ amount: expensesTable.amount, categoryId: expensesTable.expenseCategoryId, note: expensesTable.note, expenseDate: expensesTable.expenseDate, categoryName: expenseCategoriesTable.name })
      .from(expensesTable)
      .leftJoin(expenseCategoriesTable, eq(expensesTable.expenseCategoryId, expenseCategoriesTable.id))
      .where(and(...expConds)),
  ]);

  /* aggregate sales by bread type */
  const salesByType: Record<string, { breadType: string; revenue: number; profit: number; qty: number }> = {};
  let totalRevenue = 0, totalProfit = 0, totalQty = 0;
  sales.forEach(s => {
    totalRevenue += parseFloat(s.totalAmount as unknown as string ?? "0");
    totalProfit  += parseFloat(s.profitAmount as unknown as string ?? "0");
    totalQty     += Number(s.quantity ?? 0);
    const k = s.breadType ?? "Unknown";
    if (!salesByType[k]) salesByType[k] = { breadType: k, revenue: 0, profit: 0, qty: 0 };
    salesByType[k].revenue += parseFloat(s.totalAmount as unknown as string ?? "0");
    salesByType[k].profit  += parseFloat(s.profitAmount as unknown as string ?? "0");
    salesByType[k].qty     += Number(s.quantity ?? 0);
  });

  /* aggregate production by bread type */
  const prodByType: Record<string, { produced: number; waste: number }> = {};
  let totalProduced = 0, totalWaste = 0;
  production.forEach(p => {
    totalProduced += Number(p.quantityProduced ?? 0);
    totalWaste    += Number(p.wasteQuantity ?? 0);
    const k = p.breadType ?? "Unknown";
    if (!prodByType[k]) prodByType[k] = { produced: 0, waste: 0 };
    prodByType[k].produced += Number(p.quantityProduced ?? 0);
    prodByType[k].waste    += Number(p.wasteQuantity ?? 0);
  });

  /* aggregate expenses by category */
  const expByCat: Record<string, number> = {};
  let totalExpenses = 0;
  expenses.forEach(e => {
    totalExpenses += parseFloat(e.amount as unknown as string ?? "0");
    const k = e.categoryName ?? "Uncategorised";
    expByCat[k] = (expByCat[k] ?? 0) + parseFloat(e.amount as unknown as string ?? "0");
  });

  res.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    branchId: effectiveBranchId,
    sales: {
      total: { revenue: totalRevenue, profit: totalProfit, qty: totalQty },
      byProduct: Object.values(salesByType),
    },
    production: {
      total: { produced: totalProduced, waste: totalWaste },
      byType: Object.entries(prodByType).map(([type, d]) => ({ type, ...d })),
    },
    expenses: {
      total: totalExpenses,
      byCategory: Object.entries(expByCat).map(([category, amount]) => ({ category, amount })),
      records: expenses.map(e => ({ note: e.note, amount: parseFloat(e.amount as unknown as string ?? "0"), category: e.categoryName ?? "Uncategorised", date: e.expenseDate })),
    },
  });
});

export default router;
