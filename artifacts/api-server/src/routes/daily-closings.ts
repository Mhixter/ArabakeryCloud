import { Router, IRouter } from "express";
import {
  db, dailyClosingsTable, dailyClosingLinesTable, productsTable,
  productionBatchesTable, salesTable, sellerAllocationsTable, productReturnsTable, usersTable,
} from "@workspace/db";
import { eq, and, or, isNull, gte, lte, desc, sql } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";
import {
  calculateClosingLine, canApproveClosing, canEditClosing,
  isDirectStoreSale, latestPriorClosingLine, nextClosingStatus, validateSubmission,
} from "./daily-closing-logic";
import { businessDateFor, businessDateRange } from "../lib/business-date";
import crypto from "crypto";

const router: IRouter = Router();
const editableRoles = ["managing_director", "manager", "receptionist"] as const;

function closingReceiptNumber() {
  return `NMB-CLOSE-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function dayRange(date: string) {
  return businessDateRange(date);
}

function effectiveBranch(req: AuthenticatedRequest, requested?: string) {
  if (req.user!.role !== "managing_director") return req.user!.branchId ?? null;
  const id = requested && !isNaN(parseInt(requested, 10)) ? parseInt(requested, 10) : req.user!.branchId;
  return id ?? null;
}

function key(value: string) {
  return value.trim().toLowerCase();
}

function movementKey(productId: number | null | undefined, name: string) {
  return productId != null ? `id:${productId}` : `name:${key(name)}`;
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
    db.select({ line: dailyClosingLinesTable, closing: dailyClosingsTable })
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
    const prior = latestPriorClosingLine(
      [{
        companyId: row.closing.companyId,
        branchId: row.closing.branchId,
        businessDate: row.closing.businessDate,
        status: row.closing.status as "draft" | "submitted" | "approved",
        line: row.line,
      }],
      companyId,
      branchId,
      row.line.productName,
      date,
    );
    const k = movementKey(row.line.productId, row.line.productName);
    if (prior && !previousByProduct.has(k)) previousByProduct.set(k, prior.closingStock);
  }

  const cumulativeBefore = async (productId: number, name: string) => {
    const [prod, sold, alloc, returned] = await Promise.all([
      db.select().from(productionBatchesTable).where(and(
        eq(productionBatchesTable.companyId, companyId), eq(productionBatchesTable.branchId, branchId),
        isNull(productionBatchesTable.deletedAt), or(eq(productionBatchesTable.productId, productId), and(isNull(productionBatchesTable.productId), sql`lower(trim(${productionBatchesTable.breadType})) = ${key(name)}`)),
        sql`${productionBatchesTable.productionDate} < ${start}`,
      )),
      db.select({ sale: salesTable, cashierRole: usersTable.role }).from(salesTable)
        .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
        .where(and(
          eq(salesTable.companyId, companyId), eq(salesTable.branchId, branchId), isNull(salesTable.deletedAt),
          or(eq(salesTable.productId, productId), and(isNull(salesTable.productId), sql`lower(trim(${salesTable.breadType})) = ${key(name)}`)), sql`${salesTable.saleDate} < ${start}`,
        )),
      db.select().from(sellerAllocationsTable).where(and(
        eq(sellerAllocationsTable.companyId, companyId), eq(sellerAllocationsTable.branchId, branchId),
        isNull(sellerAllocationsTable.deletedAt), or(eq(sellerAllocationsTable.productId, productId), and(isNull(sellerAllocationsTable.productId), sql`lower(trim(${sellerAllocationsTable.breadType})) = ${key(name)}`)),
        sql`${sellerAllocationsTable.allocationDate} < ${start}`,
      )),
      db.select().from(productReturnsTable).where(and(
        eq(productReturnsTable.companyId, companyId), eq(productReturnsTable.branchId, branchId),
        eq(productReturnsTable.status, "approved" as const), or(eq(productReturnsTable.productId, productId), and(isNull(productReturnsTable.productId), sql`lower(trim(${productReturnsTable.breadType})) = ${key(name)}`)),
        sql`${productReturnsTable.returnDate} < ${start}`,
      )),
    ]);
    return (prod as any[]).reduce((sum: number, row: any) => sum + row.quantityProduced - row.wasteQuantity, 0)
      + (returned as any[]).reduce((sum: number, row: any) => sum + (["not_sold", "wrong_item", "other"].includes(row.reason) ? row.quantity : 0), 0)
      - (sold as any[]).reduce((sum: number, row: any) => sum + (row.cashierRole === "supplier" ? 0 : row.sale.quantity), 0)
      - (alloc as any[]).reduce((sum: number, row: any) => sum + row.quantity, 0);
  };

  const todayMap = new Map<string, { produced: number; allocated: number; returned: number; recordedSales: number }>();
  const add = (productId: number | null | undefined, name: string, field: keyof Omit<NonNullable<typeof todayMap extends Map<string, infer V> ? V : never>, never>, amount: number) => {
    const movementId = movementKey(productId, name);
    const row = todayMap.get(movementId) ?? { produced: 0, allocated: 0, returned: 0, recordedSales: 0 };
    row[field] += amount;
    todayMap.set(movementId, row);
  };
  for (const row of production) add(row.productId, row.breadType, "produced", row.quantityProduced - row.wasteQuantity);
  for (const row of allocations) add(row.productId, row.breadType, "allocated", row.quantity);
  for (const row of returns) if (["not_sold", "wrong_item", "other"].includes(row.reason)) add(row.productId, row.breadType, "returned", row.quantity);
  for (const row of sales) if (isDirectStoreSale(row.sale, row.cashierRole)) add(row.sale.productId, row.sale.breadType, "recordedSales", row.sale.quantity);

  const lines = [];
  for (const product of products) {
    const movements = todayMap.get(movementKey(product.id, product.name))
      ?? todayMap.get(movementKey(null, product.name))
      ?? { produced: 0, allocated: 0, returned: 0, recordedSales: 0 };
    const openingStock = previousByProduct.get(movementKey(product.id, product.name))
      ?? previousByProduct.get(movementKey(null, product.name))
      ?? await cumulativeBefore(product.id, product.name);
    lines.push({
      productId: product.id, productName: product.name, openingStock: Math.max(0, openingStock),
      ...movements, closingStock: 0,
      counted: false,
      calculatedSales: openingStock + movements.produced + movements.returned - movements.allocated,
      variance: 0, varianceReason: null,
    });
  }
  return lines;
}

router.get("/daily-closings", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const branchId = effectiveBranch(req, req.query.branchId as string | undefined);
  const date = String(req.query.date ?? businessDateFor());
  if (!branchId) { res.status(400).json({ error: "A branch is required" }); return; }
  const [closing] = await db.select().from(dailyClosingsTable).where(and(
    eq(dailyClosingsTable.companyId, req.user!.companyId), eq(dailyClosingsTable.branchId, branchId), eq(dailyClosingsTable.businessDate, date),
  ));
  if (!closing) { res.json({ closing: null, lines: await movementSummary(req.user!.companyId, branchId, date), branchId, date }); return; }
  const lines = await db.select().from(dailyClosingLinesTable).where(eq(dailyClosingLinesTable.closingId, closing.id));
  res.json({ closing, lines, branchId, date });
});

/* Managing Director stock settlement: separate from supplier allocations and product allocation history. */
router.get("/stock-settlements", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const branchId = effectiveBranch(req, req.query.branchId as string | undefined);
  const date = String(req.query.date ?? businessDateFor());
  if (!branchId) { res.status(400).json({ error: "A branch is required" }); return; }
  try {
    const movementLines = await movementSummary(req.user!.companyId, branchId, date);
    const [closing] = await db.select().from(dailyClosingsTable).where(and(
      eq(dailyClosingsTable.companyId, req.user!.companyId),
      eq(dailyClosingsTable.branchId, branchId),
      eq(dailyClosingsTable.businessDate, date),
    ));
    const settledLines = closing
      ? await db.select().from(dailyClosingLinesTable).where(eq(dailyClosingLinesTable.closingId, closing.id))
      : [];
    const settledByProduct = new Map(settledLines.map(line => [movementKey(line.productId, line.productName), line]));
    res.json({
      branchId,
      date,
      lines: movementLines.map(line => {
        const settled = settledByProduct.get(movementKey(line.productId, line.productName));
        const remaining = Math.max(0, line.openingStock + line.produced + line.returned - line.allocated - line.recordedSales);
        return {
          productId: line.productId,
          productName: line.productName,
          remaining,
          status: settled?.stockSettledAt ? "cleared" : "uncleared",
          settledAmount: settled?.stockSettledAmount ?? null,
          settledAt: settled?.stockSettledAt ?? null,
        };
      }),
    });
  } catch (err) {
    console.error("GET /stock-settlements error:", err);
    res.status(500).json({ error: "Failed to load stock settlements" });
  }
});

router.get("/stock-settlements/history", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const branchId = effectiveBranch(req, req.query.branchId as string | undefined);
  if (!branchId) { res.status(400).json({ error: "A branch is required" }); return; }
  try {
    const [production, sales, allocations, closings] = await Promise.all([
      db.select({ date: productionBatchesTable.productionDate }).from(productionBatchesTable).where(and(eq(productionBatchesTable.companyId, req.user!.companyId), eq(productionBatchesTable.branchId, branchId), isNull(productionBatchesTable.deletedAt))),
      db.select({ date: salesTable.saleDate }).from(salesTable).where(and(eq(salesTable.companyId, req.user!.companyId), eq(salesTable.branchId, branchId), isNull(salesTable.deletedAt))),
      db.select({ date: sellerAllocationsTable.allocationDate }).from(sellerAllocationsTable).where(and(eq(sellerAllocationsTable.companyId, req.user!.companyId), eq(sellerAllocationsTable.branchId, branchId), isNull(sellerAllocationsTable.deletedAt))),
      db.select().from(dailyClosingsTable).where(and(eq(dailyClosingsTable.companyId, req.user!.companyId), eq(dailyClosingsTable.branchId, branchId))),
    ]);
    const dates = new Set<string>([businessDateFor()]);
    for (const row of production) dates.add(businessDateFor(row.date));
    for (const row of sales) dates.add(businessDateFor(row.date));
    for (const row of allocations) dates.add(businessDateFor(row.date));
    for (const row of closings) dates.add(row.businessDate);
    const history = [...dates].filter(date => date <= businessDateFor()).sort().reverse().map(date => {
      const closing = closings.find(row => row.businessDate === date);
      return { date, status: closing?.stockSettledAt ? "cleared" : "uncleared", settledAt: closing?.stockSettledAt ?? null };
    });
    res.json({ history });
  } catch (err) {
    console.error("GET /stock-settlements/history error:", err);
    res.status(500).json({ error: "Failed to load stock settlement history" });
  }
});

router.post("/stock-settlements", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const branchId = effectiveBranch(req, req.body.branchId);
  const date = String(req.body.businessDate ?? businessDateFor());
  const productId = Number(req.body.productId);
  const amountSettled = Number(req.body.amountSettled);
  const paymentMethod = req.body.paymentMethod === "transfer" ? "transfer" : "cash";
  if (!branchId || !Number.isInteger(productId) || !Number.isFinite(amountSettled) || amountSettled < 0) {
    res.status(400).json({ error: "branch, product, and a valid amount collected are required" }); return;
  }
  try {
    const movementLines = await movementSummary(req.user!.companyId, branchId, date);
    const movement = movementLines.find(line => line.productId === productId);
    if (!movement) { res.status(404).json({ error: "Product movement not found for this date" }); return; }
    const remaining = Math.max(0, movement.openingStock + movement.produced + movement.returned - movement.allocated - movement.recordedSales);
    if (remaining <= 0) { res.status(400).json({ error: "There is no remaining in-store stock for this product on this date" }); return; }

    let [closing] = await db.select().from(dailyClosingsTable).where(and(
      eq(dailyClosingsTable.companyId, req.user!.companyId), eq(dailyClosingsTable.branchId, branchId), eq(dailyClosingsTable.businessDate, date),
    ));
    if (!closing) {
      [closing] = await db.insert(dailyClosingsTable).values({ companyId: req.user!.companyId, branchId, businessDate: date, status: "approved", approvedById: req.user!.userId, approvedAt: new Date() }).returning();
      await db.insert(dailyClosingLinesTable).values(movementLines.map(line => ({
        closingId: closing.id, productId: line.productId, productName: line.productName,
        openingStock: line.openingStock, produced: line.produced, allocated: line.allocated, returned: line.returned,
        recordedSales: line.recordedSales, closingStock: Math.max(0, line.openingStock + line.produced + line.returned - line.allocated - line.recordedSales),
        counted: true, calculatedSales: 0, variance: 0,
      })));
    }
    const [line] = await db.select().from(dailyClosingLinesTable).where(and(eq(dailyClosingLinesTable.closingId, closing.id), eq(dailyClosingLinesTable.productId, productId)));
    if (!line) { res.status(404).json({ error: "Settlement line not found" }); return; }
    if (line.stockSettledAt) { res.status(400).json({ error: "This product is already cleared for the selected date" }); return; }

    const product = (await db.select().from(productsTable).where(and(eq(productsTable.companyId, req.user!.companyId), eq(productsTable.id, productId))))[0];
    const unitPrice = amountSettled / remaining;
    const { end } = businessDateRange(date);
    await db.transaction(async tx => {
      await tx.insert(salesTable).values({
        companyId: req.user!.companyId, receiptNumber: closingReceiptNumber(), productId,
        breadType: movement.productName, quantity: remaining, pricePerUnit: unitPrice.toFixed(2),
        totalAmount: amountSettled.toFixed(2), costAmount: "0", profitAmount: amountSettled.toFixed(2),
        paymentMethod, cashierId: req.user!.userId, branchId,
        notes: req.body.notes ? `[In-stock settlement] ${String(req.body.notes).trim()}` : "In-stock settlement",
        saleDate: end,
      });
      await tx.update(dailyClosingLinesTable).set({
        closingStock: remaining, counted: true, stockSettledAmount: amountSettled.toFixed(2),
        stockSettlementPaymentMethod: paymentMethod, stockSettlementNotes: req.body.notes ? String(req.body.notes).trim() : null,
        stockSettledById: req.user!.userId, stockSettledAt: new Date(), updatedAt: new Date(),
      }).where(eq(dailyClosingLinesTable.id, line.id));
    });
    await logAudit({ req, userId: req.user!.userId, companyId: req.user!.companyId, action: "IN_STOCK_SETTLED", entityType: "daily_closing_line", entityId: line.id, details: `Settled ${remaining} ${movement.productName} for ${date}; allocations unchanged`, branchId });
    res.json({ success: true, productId, productName: movement.productName, quantity: remaining, settledAmount: amountSettled, date });
  } catch (err) {
    console.error("POST /stock-settlements error:", err);
    res.status(500).json({ error: "Failed to settle in-store stock" });
  }
});

router.post("/daily-closings", authenticate, requireRole(...editableRoles), async (req: AuthenticatedRequest, res): Promise<void> => {
  const branchId = effectiveBranch(req, req.body.branchId);
  const date = String(req.body.businessDate ?? businessDateFor());
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
  if (!canEditClosing(closing.status as "draft" | "submitted" | "approved")) { res.status(400).json({ error: "Only draft closings can be edited" }); return; }
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  const reasonError = req.body.submit ? validateSubmission(lines) : null;
  if (reasonError) { res.status(400).json({ error: reasonError }); return; }
  for (const input of lines) {
    if (!input.counted) continue;
    const { closingStock, calculatedSales, variance, varianceReason } = calculateClosingLine(input);
    await db.update(dailyClosingLinesTable).set({
      closingStock, counted: true, calculatedSales, variance, varianceReason, updatedAt: new Date(),
    }).where(and(eq(dailyClosingLinesTable.id, Number(input.id)), eq(dailyClosingLinesTable.closingId, id)));
  }
  const status = nextClosingStatus(closing.status as "draft" | "submitted" | "approved", Boolean(req.body.submit));
  const [updated] = await db.update(dailyClosingsTable).set({
    status, submittedById: req.user!.userId, submittedAt: req.body.submit ? new Date() : closing.submittedAt, notes: req.body.notes ?? closing.notes, updatedAt: new Date(),
  }).where(eq(dailyClosingsTable.id, id)).returning();
  await logAudit({ req, userId: req.user!.userId, companyId: req.user!.companyId, action: req.body.submit ? "DAILY_CLOSING_SUBMITTED" : "DAILY_CLOSING_SAVED", entityType: "daily_closing", entityId: id, details: `${closing.businessDate} branch ${closing.branchId}`, branchId: closing.branchId });
  res.json(updated);
});

router.patch("/daily-closings/:id/approve", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [closing] = await db.select().from(dailyClosingsTable).where(and(eq(dailyClosingsTable.id, id), eq(dailyClosingsTable.companyId, req.user!.companyId)));
  if (!closing || !canApproveClosing(closing.status as "draft" | "submitted" | "approved")) { res.status(400).json({ error: "Only submitted closings can be approved" }); return; }
  if (req.user!.role !== "managing_director" && req.user!.branchId !== closing.branchId) { res.status(403).json({ error: "You can only approve closings for your branch" }); return; }
  const [updated] = await db.update(dailyClosingsTable).set({ status: "approved", approvedById: req.user!.userId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(dailyClosingsTable.id, id)).returning();
  await logAudit({ req, userId: req.user!.userId, companyId: req.user!.companyId, action: "DAILY_CLOSING_APPROVED", entityType: "daily_closing", entityId: id, details: `${closing.businessDate} branch ${closing.branchId}`, branchId: closing.branchId });
  res.json(updated);
});

/* POST /daily-closings/:id/settle-stock — settle counted remaining stock without changing allocations */
router.post("/daily-closings/:id/settle-stock", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid closing ID" }); return; }

  const amountSettled = Number(req.body.amountSettled);
  const paymentMethod = req.body.paymentMethod === "transfer" ? "transfer" : "cash";
  if (!Number.isFinite(amountSettled) || amountSettled < 0) {
    res.status(400).json({ error: "A valid non-negative settled amount is required" }); return;
  }

  try {
    const [closing] = await db.select().from(dailyClosingsTable).where(and(
      eq(dailyClosingsTable.id, id),
      eq(dailyClosingsTable.companyId, req.user!.companyId),
    ));
    if (!closing) { res.status(404).json({ error: "Closing not found" }); return; }
    if (closing.stockSettledAt) { res.status(400).json({ error: "Remaining stock for this closing is already settled" }); return; }
    if (closing.status !== "submitted" && closing.status !== "approved") {
      res.status(400).json({ error: "The manager must submit the physical count before settlement" }); return;
    }

    const lines = await db.select().from(dailyClosingLinesTable).where(eq(dailyClosingLinesTable.closingId, id));
    if (lines.length === 0 || lines.some(line => !line.counted)) {
      res.status(400).json({ error: "Every product must have a physical count before settlement" }); return;
    }
    const settledLines = lines.filter(line => line.closingStock > 0);
    const totalUnits = settledLines.reduce((sum, line) => sum + line.closingStock, 0);
    if (totalUnits === 0) {
      res.status(400).json({ error: "There is no remaining stock to settle" }); return;
    }

    const products = await db.select().from(productsTable).where(eq(productsTable.companyId, req.user!.companyId));
    const productMap = new Map(products.map(product => [product.id, product]));
    const standardTotal = settledLines.reduce((sum, line) => {
      const product = line.productId ? productMap.get(line.productId) : products.find(p => p.name.trim().toLowerCase() === line.productName.trim().toLowerCase());
      return sum + (Number(product?.pricePerUnit ?? 0) * line.closingStock);
    }, 0);
    const cashierId = closing.submittedById ?? req.user!.userId;
    const { end } = businessDateRange(closing.businessDate);

    await db.transaction(async tx => {
      for (const line of settledLines) {
        const product = line.productId ? productMap.get(line.productId) : products.find(p => p.name.trim().toLowerCase() === line.productName.trim().toLowerCase());
        const standardLineTotal = Number(product?.pricePerUnit ?? 0) * line.closingStock;
        const lineAmount = standardTotal > 0
          ? Math.round(amountSettled * (standardLineTotal / standardTotal) * 100) / 100
          : Math.round(amountSettled * (line.closingStock / totalUnits) * 100) / 100;
        const unitPrice = line.closingStock > 0 ? lineAmount / line.closingStock : 0;
        await tx.insert(salesTable).values({
          companyId: req.user!.companyId,
          receiptNumber: closingReceiptNumber(),
          productId: product?.id ?? line.productId ?? null,
          breadType: line.productName,
          quantity: line.closingStock,
          pricePerUnit: unitPrice.toFixed(2),
          totalAmount: lineAmount.toFixed(2),
          costAmount: "0",
          profitAmount: lineAmount.toFixed(2),
          paymentMethod,
          cashierId,
          branchId: closing.branchId,
          notes: req.body.notes ? `[Daily Closing settlement] ${String(req.body.notes).trim()}` : "Daily Closing settlement",
          saleDate: end,
        });
      }

      await tx.update(dailyClosingsTable).set({
        stockSettledAmount: amountSettled.toFixed(2),
        stockSettlementPaymentMethod: paymentMethod,
        stockSettlementNotes: req.body.notes ? String(req.body.notes).trim() : null,
        stockSettledById: req.user!.userId,
        stockSettledAt: new Date(),
        status: "approved",
        approvedById: req.user!.userId,
        approvedAt: closing.approvedAt ?? new Date(),
        updatedAt: new Date(),
      }).where(eq(dailyClosingsTable.id, id));
    });

    await logAudit({
      req,
      userId: req.user!.userId,
      companyId: req.user!.companyId,
      action: "DAILY_CLOSING_STOCK_SETTLED",
      entityType: "daily_closing",
      entityId: id,
      details: `Settled ${totalUnits} remaining units for ${closing.businessDate} (₦${amountSettled.toLocaleString()}); allocations unchanged`,
      branchId: closing.branchId,
    });

    res.json({ success: true, settledAmount: amountSettled, totalUnits, closingId: id });
  } catch (err) {
    console.error("POST /daily-closings/:id/settle-stock error:", err);
    res.status(500).json({ error: "Failed to settle remaining stock" });
  }
});

export default router;