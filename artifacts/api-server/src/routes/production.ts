import { Router, IRouter } from "express";
import { db, productionBatchesTable, usersTable, branchesTable, productsTable } from "@workspace/db";
import { eq, and, isNull, gte, lte, or } from "drizzle-orm";
import { authenticate, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";
import { queryDateRange } from "../lib/business-date";

const router: IRouter = Router();

const formatBatch = (b: typeof productionBatchesTable.$inferSelect, staffName: string, branchName: string) => ({
  id: b.id,
  productId: b.productId,
  breadType: b.breadType,
  quantityProduced: b.quantityProduced,
  wasteQuantity: b.wasteQuantity,
  netQuantity: b.quantityProduced - b.wasteQuantity,
  staffId: b.staffId,
  staffName,
  branchId: b.branchId,
  branchName,
  notes: b.notes,
  productionDate: b.productionDate.toISOString(),
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

router.get("/production", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { branchId, startDate, endDate } = req.query as { branchId?: string; startDate?: string; endDate?: string };
  const conditions = [isNull(productionBatchesTable.deletedAt), eq(productionBatchesTable.companyId, companyId)];
  if (branchId && !isNaN(parseInt(branchId))) conditions.push(eq(productionBatchesTable.branchId, parseInt(branchId)));
  if (startDate) conditions.push(gte(productionBatchesTable.productionDate, queryDateRange(startDate).start));
  if (endDate) conditions.push(lte(productionBatchesTable.productionDate, queryDateRange(endDate).end));
  const batches = await db.select({ batch: productionBatchesTable, staffName: usersTable.fullName, branchName: branchesTable.name }).from(productionBatchesTable).leftJoin(usersTable, eq(productionBatchesTable.staffId, usersTable.id)).leftJoin(branchesTable, eq(productionBatchesTable.branchId, branchesTable.id)).where(and(...conditions)).orderBy(productionBatchesTable.productionDate);
  res.json(batches.map(({ batch, staffName, branchName }) => formatBatch(batch, staffName ?? "Unknown", branchName ?? "Unknown")));
});

router.post("/production", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { breadType, productId: requestedProductId, quantityProduced, wasteQuantity, branchId, notes, productionDate } = req.body;
  const user = req.user!;
  if ((!breadType && !requestedProductId) || !quantityProduced || branchId == null) { res.status(400).json({ error: "productId or breadType, quantityProduced, and branchId are required" }); return; }
  const productionBranchId = Number.parseInt(String(branchId), 10);
  if (!Number.isInteger(productionBranchId) || productionBranchId < 1) {
    res.status(400).json({ error: "branchId must be a valid positive number" }); return;
  }
  const productCandidates = await db.select().from(productsTable).where(and(
    eq(productsTable.companyId, companyId),
    requestedProductId ? eq(productsTable.id, parseInt(requestedProductId)) : eq(productsTable.name, breadType),
    or(eq(productsTable.branchId, productionBranchId), isNull(productsTable.branchId)),
  ));
  /* Prefer a branch-specific product over a company-wide product when names
     overlap. This keeps production, allocation, and stock rows on one product
     identity for the selected branch. */
  const product = productCandidates.find(candidate => candidate.branchId === productionBranchId)
    ?? productCandidates.find(candidate => candidate.branchId == null);
  if (!product || !product.isActive) { res.status(400).json({ error: `"${breadType}" is not an active product.` }); return; }
  const parsedProductionDate = productionDate ? new Date(productionDate) : new Date();
  if (Number.isNaN(parsedProductionDate.getTime())) {
    res.status(400).json({ error: "productionDate must be a valid date" });
    return;
  }
  const [batch] = await db.insert(productionBatchesTable).values({ companyId, productId: product.id, breadType: product.name, quantityProduced: parseInt(quantityProduced), wasteQuantity: parseInt(wasteQuantity ?? 0), staffId: user.userId, branchId: productionBranchId, notes: notes ?? null, productionDate: parsedProductionDate }).returning();
  const [staff] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, batch.branchId));
  await logAudit({ req, userId: user.userId, companyId, action: "PRODUCTION_RECORDED", entityType: "production", entityId: batch.id, details: `${breadType}: produced ${quantityProduced}, waste ${wasteQuantity ?? 0}`, branchId: batch.branchId });
  res.status(201).json(formatBatch(batch, staff?.fullName ?? "Unknown", branch?.name ?? "Unknown"));
});

router.get("/production/:id", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [result] = await db.select({ batch: productionBatchesTable, staffName: usersTable.fullName, branchName: branchesTable.name }).from(productionBatchesTable).leftJoin(usersTable, eq(productionBatchesTable.staffId, usersTable.id)).leftJoin(branchesTable, eq(productionBatchesTable.branchId, branchesTable.id)).where(and(eq(productionBatchesTable.id, id), eq(productionBatchesTable.companyId, companyId), isNull(productionBatchesTable.deletedAt)));
  if (!result) { res.status(404).json({ error: "Production batch not found" }); return; }
  res.json(formatBatch(result.batch, result.staffName ?? "Unknown", result.branchName ?? "Unknown"));
});

export default router;
