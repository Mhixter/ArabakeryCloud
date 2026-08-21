import { Router, IRouter } from "express";
import {
  db, dailyClosingsTable, dailyClosingLinesTable, productsTable,
  productionBatchesTable, salesTable, sellerAllocationsTable, productReturnsTable, usersTable,
} from "@workspace/db";
import { eq, and, or, isNull, gte, lte, desc, sql } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
const editableRoles = ["managing_director", "manager", "receptionist"] as const;

function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  return { start, end };
}

function effectiveBranch(req: AuthenticatedRequest, requested?: string) {
  if (req.user!.role !== "managing_director") return req.user!.branchId ?? null;
  const id = requested && !isNaN(parseInt(requested, 10)) ? parseInt(requested, 10) : req.user!.branchId;
  return id ?? null;
}

function key(value: string) {
  return value.trim().toLowerCase();
}

async function movementSummary(companyId: number, branchId: number, date: string) {
  const { start, end } = dayRange(date);
  const products = await db.select().from(productsTable).where(and(
    eq(productsTable.companyId, companyId),
    eq(productsTable.isActive, true),
    or(eq(productsTable.branchId, branchId), isNull(productsTable.branchId)),
  ));
  const [production, sales, allocations, returns, previous] = await Promise.all([
    db.select().from(productionBatchesTable).where(and(
      eq(productionBatchesTable.companyId, companyId), eq(productionBatchesTable.branchId, branchId),
      isNull(productionBatchesTable.deletedAt), gte(productionBatchesTable.productionDate, start), lte(productionBatchesTable.productionDate, end),
    )),
    db.select({ sale: salesTable, cashierRole: usersTable.role }).from(salesTable)
      .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
      .where(and(
        eq(salesTable.companyId, companyId), eq(salesTable.branchId, branchId), isNull(salesTable.deletedAt),
        gte(salesTable.saleDate, start), lte(salesTable.saleDate, end),
      )),
    db.select().from(sellerAllocationsTable).where(and(
      eq(sellerAllocationsTable.companyId, companyId), eq(sellerAllocationsTable.branchId, branchId),
      isNull(sellerAllocationsTable.deletedAt), gte(sellerAllocationsTable.allocationDate, start), lte(sellerAllocationsTable.allocationDate, end),
    )),
    db.select().from(productReturnsTable).where(and(
      eq(productReturnsTable.companyId, companyId), eq(productReturnsTable.branchId, branchId),
      eq(productReturnsTable.status, "approved" as const), gte(productReturnsTable.returnDate, start), lte(productReturnsTable.returnDate, end),
    )),
    db.select({ line: dailyClosingLinesTable })
      .from(dailyClosingLinesTable)
      .innerJoin(dailyClosingsTable, eq(dailyClosingLinesTable.closingId, dailyClosingsTable.id))
      .where(and(
        eq(dailyClosingsTable.companyId, companyId), eq(dailyClosingsTable.branchId, branchId),
        sql`${dailyClosingsTable.businessDate} < ${date}`,
        or(eq(dailyClosingsTable.status, "submitted"), eq(dailyClosingsTable.status, "approved")),
      ))
      .orderBy(desc(dailyClosingsTable.businessDate)),
  ]);

  const previousByProduct = new Map<string, number>();
  for (const row of previous) {
    const k = key(row.line.productName);
    if (!previousByProduct.has(k)) previousByProduct.set(k, row.line.closingStock);
  }

  const cumulativeBefore = async (name: string) => {
    const [prod, sold, alloc, returned] = await Promise.all([
      db.select().from(productionBatchesTable).where(and(
        eq(productionBatchesTable.companyId, companyId), eq(productionBatchesTable.branchId, branchId),
        isNull(productionBatchesTable.deletedAt), sql`lower(trim(${productionBatchesTable.breadType})) = ${key(name)}`,
        sql`${productionBatchesTable.productionDate} < ${start}`,
      )),
      db.select({ sale: salesTable, cashierRole: usersTable.role }).from(salesTable)
        .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
        .where(and(
          eq(salesTable.companyId, companyId), eq(salesTable.branchId, branchId), isNull(salesTable.deletedAt),
          sql`lower(trim(${salesTable.breadType})) = ${key(name)}`, sql`${salesTable.saleDate} < ${start}`,
        )),
      db.select().from(sellerAllocationsTable).where(and(
        eq(sellerAllocationsTable.companyId, companyId), eq(sellerAllocationsTable.branchId, branchId),
        isNull(sellerAllocationsTable.deletedAt), sql`lower(trim(${sellerAllocationsTable.breadType})) = ${key(name)}`,
        sql`${sellerAllocationsTable.allocationDate} < ${start}`,
      )),
      db.select().from(productReturnsTable).where(and(
        eq(productReturnsTable.companyId, companyId), eq(productReturnsTable.branchId, branchId),
        eq(productReturnsTable.status, "approved" as const), sql`lower(trim(${productReturnsTable.breadType})) = ${key(name)}`,
        sql`${productReturnsTable.returnDate} < ${start}`,
      )),
    ]);
    return (prod as any[]).reduce((sum: number, row: any) => sum + row.quantityProduced - row.wasteQuantity, 0)
      + (returned as any[]).reduce((sum: number, row: any) => sum + (["not_sold", "wrong_item", "other"].includes(row.reason) ? row.quantity : 0), 0)
      - (sold as any[]).reduce((sum: number, row: any) => sum + (row.cashierRole === "supplier" ? 0 : row.sale.quantity), 0)
      - (alloc as any[]).reduce((sum: number, row: any) => sum + row.quantity, 0);
  };

  const todayMap = new Map<string, { produced: number; allocated: number; returned: number; recordedSales: number }>();
  const add = (name: string, field: keyof Omit<NonNullable<typeof todayMap extends Map<string, infer V> ? V : never>, never>, amount: number) => {
    const row = todayMap.get(key(name)) ?? { produced: 0, allocated: 0, returned: 0, recordedSales: 0 };
    row[field] += amount;
    todayMap.set(key(name), row);
  };
  for (const row of production) add(row.breadType, "produced", row.quantityProduced - row.wasteQuantity);
  for (const row of allocations) add(row.breadType, "allocated", row.quantity);
  for (const row of returns) if (["not_sold", "wrong_item", "other"].includes(row.reason)) add(row.breadType, "returned", row.quantity);
  for (const row of sales) if (row.cashierRole !== "supplier" && row.sale.breadType !== "Quick Sale") add(row.sale.breadType, "recordedSales", row.sale.quantity);

  const lines = [];
  for (const product of products) {
    const movements = todayMap.get(key(product.name)) ?? { produced: 0, allocated: 0, returned: 0, recordedSales: 0 };
    const openingStock = previousByProduct.get(key(product.name)) ?? await cumulativeBefore(product.name);
    lines.push({
      productId: product.id, productName: product.name, openingStock: Math.max(0, openingStock),
      ...movements, closingStock: 0,
      calculatedSales: openingStock + movements.produced + movements.returned - movements.allocated,
      variance: 0, varianceReason: null,
    });
  }
  return lines;
}

router.get("/daily-closings", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const branchId = effectiveBranch(req, req.query.branchId as string | undefined);
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  if (!branchId) { res.status(400).json({ error: "A branch is required" }); return; }
  const [closing] = await db.select().from(dailyClosingsTable).where(and(
    eq(dailyClosingsTable.companyId, req.user!.companyId), eq(dailyClosingsTable.branchId, branchId), eq(dailyClosingsTable.businessDate, date),
  ));
  if (!closing) { res.json({ closing: null, lines: await movementSummary(req.user!.companyId, branchId, date), branchId, date }); return; }
  const lines = await db.select().from(dailyClosingLinesTable).where(eq(dailyClosingLinesTable.closingId, closing.id));
  res.json({ closing, lines, branchId, date });
});

router.post("/daily-closings", authenticate, requireRole(...editableRoles), async (req: AuthenticatedRequest, res): Promise<void> => {
  const branchId = effectiveBranch(req, req.body.branchId);
  const date = String(req.body.businessDate ?? new Date().toISOString().slice(0, 10));
  if (!branchId) { res.status(400).json({ error: "A branch is required" }); return; }
  const [existing] = await db.select().from(dailyClosingsTable).where(and(
    eq(dailyClosingsTable.companyId, req.user!.companyId), eq(dailyClosingsTable.branchId, branchId), eq(dailyClosingsTable.businessDate, date),
  ));
  if (existing) { res.json(existing); return; }
  const movementLines = await movementSummary(req.user!.companyId, branchId, date);
  const [closing] = await db.insert(dailyClosingsTable).values({ companyId: req.user!.companyId, branchId, businessDate: date, submittedById: req.user!.userId }).returning();
  await db.insert(dailyClosingLinesTable).values(movementLines.map(line => ({ ...line, closingId: closing.id })));
  res.status(201).json({ closing, lines: await db.select().from(dailyClosingLinesTable).where(eq(dailyClosingLinesTable.closingId, closing.id)) });
});

router.patch("/daily-closings/:id", authenticate, requireRole(...editableRoles), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [closing] = await db.select().from(dailyClosingsTable).where(and(eq(dailyClosingsTable.id, id), eq(dailyClosingsTable.companyId, req.user!.companyId)));
  if (!closing) { res.status(404).json({ error: "Closing not found" }); return; }
  if (closing.status !== "draft") { res.status(400).json({ error: "Only draft closings can be edited" }); return; }
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  for (const input of lines) {
    const closingStock = Math.max(0, parseInt(input.closingStock) || 0);
    const calculatedSales = input.openingStock + input.produced + input.returned - input.allocated - closingStock;
    const variance = calculatedSales - input.recordedSales;
    if (req.body.submit && variance !== 0 && !String(input.varianceReason ?? "").trim()) {
      res.status(400).json({ error: `A reason is required for the ${input.productName} variance` }); return;
    }
    await db.update(dailyClosingLinesTable).set({
      closingStock, calculatedSales, variance, varianceReason: input.varianceReason ? String(input.varianceReason).trim() : null, updatedAt: new Date(),
    }).where(and(eq(dailyClosingLinesTable.id, Number(input.id)), eq(dailyClosingLinesTable.closingId, id)));
  }
  const status = req.body.submit ? "submitted" : "draft";
  const [updated] = await db.update(dailyClosingsTable).set({
    status, submittedById: req.user!.userId, submittedAt: req.body.submit ? new Date() : closing.submittedAt, notes: req.body.notes ?? closing.notes, updatedAt: new Date(),
  }).where(eq(dailyClosingsTable.id, id)).returning();
  await logAudit({ req, userId: req.user!.userId, companyId: req.user!.companyId, action: req.body.submit ? "DAILY_CLOSING_SUBMITTED" : "DAILY_CLOSING_SAVED", entityType: "daily_closing", entityId: id, details: `${closing.businessDate} branch ${closing.branchId}`, branchId: closing.branchId });
  res.json(updated);
});

router.patch("/daily-closings/:id/approve", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [closing] = await db.select().from(dailyClosingsTable).where(and(eq(dailyClosingsTable.id, id), eq(dailyClosingsTable.companyId, req.user!.companyId)));
  if (!closing || closing.status !== "submitted") { res.status(400).json({ error: "Only submitted closings can be approved" }); return; }
  if (req.user!.role !== "managing_director" && req.user!.branchId !== closing.branchId) { res.status(403).json({ error: "You can only approve closings for your branch" }); return; }
  const [updated] = await db.update(dailyClosingsTable).set({ status: "approved", approvedById: req.user!.userId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(dailyClosingsTable.id, id)).returning();
  await logAudit({ req, userId: req.user!.userId, companyId: req.user!.companyId, action: "DAILY_CLOSING_APPROVED", entityType: "daily_closing", entityId: id, details: `${closing.businessDate} branch ${closing.branchId}`, branchId: closing.branchId });
  res.json(updated);
});

export default router;