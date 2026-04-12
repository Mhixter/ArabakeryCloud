import { Router, IRouter } from "express";
import { db, salesTable, productionBatchesTable } from "@workspace/db";
import { eq, and, isNull, gte, lte, sql } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/reports/dashboard", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { branchId } = req.query as { branchId?: string };

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const branchFilter = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : null;

  // Today's sales
  const todaySalesConditions = [
    isNull(salesTable.deletedAt),
    gte(salesTable.saleDate, todayStart),
    lte(salesTable.saleDate, todayEnd),
  ];
  if (branchFilter) todaySalesConditions.push(eq(salesTable.branchId, branchFilter));

  const todaySales = await db.select().from(salesTable).where(and(...todaySalesConditions));

  // Week's sales
  const weekSalesConditions = [
    isNull(salesTable.deletedAt),
    gte(salesTable.saleDate, weekStart),
  ];
  if (branchFilter) weekSalesConditions.push(eq(salesTable.branchId, branchFilter));

  const weekSales = await db.select().from(salesTable).where(and(...weekSalesConditions));

  // Today's production
  const todayProdConditions = [
    isNull(productionBatchesTable.deletedAt),
    gte(productionBatchesTable.productionDate, todayStart),
    lte(productionBatchesTable.productionDate, todayEnd),
  ];
  if (branchFilter) todayProdConditions.push(eq(productionBatchesTable.branchId, branchFilter));

  const todayProduction = await db.select().from(productionBatchesTable).where(and(...todayProdConditions));

  // Week's production
  const weekProdConditions = [
    isNull(productionBatchesTable.deletedAt),
    gte(productionBatchesTable.productionDate, weekStart),
  ];
  if (branchFilter) weekProdConditions.push(eq(productionBatchesTable.branchId, branchFilter));

  const weekProduction = await db.select().from(productionBatchesTable).where(and(...weekProdConditions));

  const todayRevenue = todaySales.reduce((sum, s) => sum + parseFloat(s.totalAmount as unknown as string), 0);
  const todayProfit = todaySales.reduce((sum, s) => sum + parseFloat(s.profitAmount as unknown as string), 0);
  const weekRevenue = weekSales.reduce((sum, s) => sum + parseFloat(s.totalAmount as unknown as string), 0);
  const weekProfit = weekSales.reduce((sum, s) => sum + parseFloat(s.profitAmount as unknown as string), 0);
  const todayProdQty = todayProduction.reduce((sum, b) => sum + (b.quantityProduced - b.wasteQuantity), 0);
  const weekProdQty = weekProduction.reduce((sum, b) => sum + (b.quantityProduced - b.wasteQuantity), 0);

  // Inventory summary (inline query)
  const { inventoryItemsTable } = await import("@workspace/db");
  const invConditions = [isNull(inventoryItemsTable.deletedAt)];
  if (branchFilter) invConditions.push(eq(inventoryItemsTable.branchId, branchFilter));
  const invItems = await db.select().from(inventoryItemsTable).where(and(...invConditions));
  const lowStockCount = invItems.filter(i =>
    parseFloat(i.currentQuantity as unknown as string) <= parseFloat(i.minimumQuantity as unknown as string)
  ).length;

  const profitMargin = weekRevenue > 0 ? (weekProfit / weekRevenue) * 100 : 0;

  res.json({
    todayRevenue,
    todayProfit,
    todaySalesCount: todaySales.length,
    todayProduction: todayProdQty,
    weekRevenue,
    weekProfit,
    weekSalesCount: weekSales.length,
    weekProduction: weekProdQty,
    totalInventoryItems: invItems.length,
    lowStockCount,
    totalLoavesInStock: 0, // track from production - sales in future
    profitMargin,
  });
});

router.get("/reports/sales-trend", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { branchId, days } = req.query as { branchId?: string; days?: string };

  const numDays = days && !isNaN(parseInt(days)) ? parseInt(days) : 14;
  const branchFilter = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - numDays);
  startDate.setHours(0, 0, 0, 0);

  const conditions = [isNull(salesTable.deletedAt), gte(salesTable.saleDate, startDate)];
  if (branchFilter) conditions.push(eq(salesTable.branchId, branchFilter));

  const sales = await db.select().from(salesTable).where(and(...conditions));

  // Group by day
  const dayMap = new Map<string, { revenue: number; profit: number; count: number }>();

  for (let i = 0; i <= numDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    if (key) dayMap.set(key, { revenue: 0, profit: 0, count: 0 });
  }

  for (const s of sales) {
    const key = s.saleDate.toISOString().split("T")[0];
    if (key && dayMap.has(key)) {
      const existing = dayMap.get(key)!;
      dayMap.set(key, {
        revenue: existing.revenue + parseFloat(s.totalAmount as unknown as string),
        profit: existing.profit + parseFloat(s.profitAmount as unknown as string),
        count: existing.count + 1,
      });
    }
  }

  const trend = Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    revenue: data.revenue,
    profit: data.profit,
    salesCount: data.count,
  }));

  res.json(trend);
});

router.get("/reports/production-summary", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { branchId, startDate, endDate } = req.query as { branchId?: string; startDate?: string; endDate?: string };
  const branchFilter = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : null;

  const conditions = [isNull(productionBatchesTable.deletedAt)];
  if (branchFilter) conditions.push(eq(productionBatchesTable.branchId, branchFilter));
  if (startDate) conditions.push(gte(productionBatchesTable.productionDate, new Date(startDate)));
  if (endDate) conditions.push(lte(productionBatchesTable.productionDate, new Date(endDate)));

  const batches = await db.select().from(productionBatchesTable).where(and(...conditions));

  const totalProduced = batches.reduce((sum, b) => sum + b.quantityProduced, 0);
  const totalWaste = batches.reduce((sum, b) => sum + b.wasteQuantity, 0);
  const wastePercentage = totalProduced > 0 ? (totalWaste / totalProduced) * 100 : 0;
  const efficiency = 100 - wastePercentage;

  const breadTypeMap = new Map<string, { produced: number; waste: number }>();
  for (const b of batches) {
    const existing = breadTypeMap.get(b.breadType) ?? { produced: 0, waste: 0 };
    breadTypeMap.set(b.breadType, {
      produced: existing.produced + b.quantityProduced,
      waste: existing.waste + b.wasteQuantity,
    });
  }

  res.json({
    totalProduced,
    totalWaste,
    wastePercentage,
    efficiency,
    byBreadType: Array.from(breadTypeMap.entries()).map(([breadType, data]) => ({
      breadType,
      totalProduced: data.produced,
      totalWaste: data.waste,
    })),
  });
});

export default router;
